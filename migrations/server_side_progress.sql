-- ════════════════════════════════════════════════════════════════════════════
-- SERVER-SIDE RANK/MILESTONE COMPUTATION
--
-- SUPERSEDED IN PART by migrations/fix_winners_array_type.sql — run that one
-- too. compute_account_progress below incorrectly treated games.winners as
-- jsonb; it's actually a native text[] column, which threw "COALESCE types
-- text[] and jsonb cannot be matched" on every account that had any games —
-- aborting the whole transaction (and, since insertGame/deleteRealm didn't
-- check for errors client-side until that was also fixed, silently rolling
-- back game saves and realm deletes while the UI showed success).
--
-- Part 2 (run migrations/milestone_config.sql FIRST — this reads from those
-- tables). Fixes: today, only the account that records a game gets its
-- rank/milestone diffed and celebrated (App.jsx's handleRecordGame runs
-- entirely client-side, computed only for whoever is signed in and
-- submitting). If a realm's owner controls/records a shared game, a member
-- playing alongside them never gets their own account recomputed for that
-- event, even if it pushed THEIR stats across a threshold — a client only
-- has RLS visibility into realms it can access, so it can't correctly
-- compute another linked account's true cross-realm stats.
--
-- This migration adds compute_account_progress(uuid) — a full server-side
-- port of calcAccountStats + accountMilestoneProgress + countUnlockedTiers/
-- getCurrentRank (see src/utils/stats.js, src/data/accountMilestones.js,
-- src/utils/metaRank.js) scoped to just what rank/milestones need (not the
-- full rich Profile stats — no rival/favMeeple/longestGame/etc, just
-- games_count/wins/expansions/breakdown sums) — and wires it to fire
-- automatically via triggers whenever any game is inserted/deleted, a realm
-- is deleted, expansion ownership changes, or a realm invite is accepted, so
-- every LINKED account's user_progress row updates correctly regardless of
-- who caused the change.
--
-- Run BEFORE deploying a client build that relies on this (the client-side
-- change re-fetches user_progress right after a game save instead of
-- recomputing locally — see the plan's Phase D). Additive-only against a
-- stale client: a pre-migration client's own local computation still works
-- fine meanwhile, it just won't see OTHER members' rows update automatically
-- until this is deployed.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. compute_account_progress ────────────────────────────────────────────────
-- Truthful cross-realm rank/milestone snapshot for one account. Deliberately
-- narrow in scope vs the full calcAccountStats() — only what rank/milestones
-- need. SECURITY DEFINER because it must read every realm/game the target
-- account is linked to, which the CALLER (a different account, via the
-- trigger below) has no RLS access to — revoked from every role at the end
-- so it's only ever reachable from other SECURITY DEFINER functions in this
-- file, never called directly by a client with an arbitrary uuid (that would
-- let anyone read anyone else's full progress, bypassing can_access_realm).
create or replace function compute_account_progress(p_user_id uuid)
returns table (rank int, tier_count int, category_progress jsonb, games_count int)
language plpgsql security definer stable
set search_path = public as $$
declare
  v_max_rank          int;
  v_total_tiers       int;
  v_games_count       int;
  v_wins              int;
  v_expansions        int;
  v_breakdown         jsonb;
  v_tier_count        int := 0;
  v_category_progress jsonb := '{}'::jsonb;
  v_rank              int;
  cat                 record;
  v_progress          numeric;
  v_tier_number       int;
  v_reached           int;
begin
  select (value #>> '{}')::int into v_max_rank from app_config where key = 'max_rank';
  select count(*) into v_total_tiers from milestone_tiers;

  with my_slots as (
    -- Every realm this account owns/is a member of, and which player NAME it
    -- is IN THAT REALM — per-realm, never a single global name (the same
    -- account can be "Alex" in one realm and something else in another).
    select r.id as realm_id, e->>'name' as player_name
    from realms r
    cross join lateral jsonb_array_elements(r.players) e
    where e->>'user_id' = p_user_id::text
      and e->>'status' in ('owner', 'member')
  ),
  my_games as (
    -- One row per game this account played, carrying its own matched player
    -- element. `limit 1` is defensive against a duplicate name inside one
    -- game's players array (nothing in the schema forbids it).
    select g.winners, mp.elem as my_player, s.player_name
    from my_slots s
    join games g on g.realm_id = s.realm_id
    cross join lateral (
      select gp.elem
      from jsonb_array_elements(g.players) with ordinality gp(elem, ord)
      where lower(gp.elem->>'name') = lower(s.player_name)
      order by gp.ord
      limit 1
    ) mp
  ),
  breakdown_totals as (
    select kv.key, sum(kv.value::numeric) as total
    from my_games mg
    cross join lateral jsonb_each_text(coalesce(mg.my_player->'breakdown', '{}'::jsonb)) as kv(key, value)
    group by kv.key
  )
  select
    (select count(*) from my_games),
    (select count(*) from my_games mg
       where exists (
         -- Case-insensitive, matching buildAccountGames' w.toLowerCase() === low
         -- in src/utils/stats.js — NOT `@>` containment (exact-case only).
         select 1 from jsonb_array_elements_text(coalesce(mg.winners, '[]'::jsonb)) w
         where lower(w) = lower(mg.player_name)
       )),
    (select jsonb_object_agg(key, total) from breakdown_totals)
  into v_games_count, v_wins, v_breakdown;

  v_breakdown := coalesce(v_breakdown, '{}'::jsonb);

  select count(*) into v_expansions
  from user_expansions ue
  cross join lateral jsonb_array_elements_text(coalesce(ue.owned, '[]'::jsonb)) o(name)
  where ue.user_id = p_user_id and o.name in (select name from full_expansions);

  for cat in
    select mc.id, mc.metric, mc.types,
           jsonb_agg(jsonb_build_object('tierNumber', mt.tier_number, 'threshold', mt.threshold) order by mt.tier_number) as tiers
    from milestone_categories mc
    join milestone_tiers mt on mt.category_id = mc.id
    group by mc.id, mc.metric, mc.types
  loop
    if cat.metric = 'games' then
      v_progress := v_games_count;
    elsif cat.metric = 'wins' then
      v_progress := v_wins;
    elsif cat.metric = 'expansions' then
      v_progress := v_expansions;
    else
      select coalesce(sum((v_breakdown ->> t)::numeric), 0)
      into v_progress
      from unnest(cat.types) as t;
    end if;

    -- tierNumber (display field) = the tierNumber of the highest reached
    -- tier — NOT a count. reached (rank-math contribution) = count of
    -- reached tiers. These are different quantities in the JS
    -- (categoryTierState.currentTier.tierNumber vs countUnlockedTiers'
    -- filter(...).length) that only look the same today because tiers
    -- happen to be numbered 1..4 with no gaps — keep them separate so a
    -- future non-sequential tier numbering doesn't silently break this.
    select coalesce(max((t->>'tierNumber')::int), 0), count(*)
    into v_tier_number, v_reached
    from jsonb_array_elements(cat.tiers) t
    where (t->>'threshold')::numeric <= v_progress;

    v_tier_count := v_tier_count + v_reached;
    v_category_progress := v_category_progress ||
      jsonb_build_object(cat.id, jsonb_build_object('progress', v_progress, 'tierNumber', v_tier_number));
  end loop;

  -- rank = highest rank in [2, max_rank] whose requirement is met; floors at
  -- 1 unconditionally (rank 1 itself is never threshold-checked — matches
  -- getCurrentRank's `for (rank = MAX_RANK; rank >= 2; rank--)`).
  select coalesce(max(r), 1) into v_rank
  from generate_series(2, v_max_rank) r
  where v_tier_count >= ceil(power((r::float8) / v_max_rank, 1.5) * v_total_tiers)::int;

  return query select v_rank, v_tier_count, v_category_progress, v_games_count;
end;
$$;

revoke execute on function compute_account_progress(uuid) from public, anon, authenticated;

-- ── 2. sync_user_progress_row — shared upsert helper ───────────────────────────
-- Only touches the "current truth" columns; last_celebrated_* (added in the
-- next migration) are intentionally left alone here — seeding those on
-- first-ever insert is added by that migration's replacement of this
-- function, once the columns actually exist.
create or replace function sync_user_progress_row(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  r record;
begin
  select * into r from compute_account_progress(p_user_id);

  insert into user_progress (user_id, rank, tier_count, category_progress, games_count, updated_at)
  values (p_user_id, r.rank, r.tier_count, r.category_progress, r.games_count, now())
  on conflict (user_id) do update
    set rank              = excluded.rank,
        tier_count        = excluded.tier_count,
        category_progress = excluded.category_progress,
        games_count       = excluded.games_count,
        updated_at        = now();
end;
$$;

revoke execute on function sync_user_progress_row(uuid) from public, anon, authenticated;

-- ── 3. Triggers ────────────────────────────────────────────────────────────────

-- Games inserted/deleted — recompute every linked (owner/member) account in
-- that realm, not just whoever caused the change.
create or replace function sync_realm_progress()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_realm_id text := coalesce(new.realm_id, old.realm_id);
  v_uid      text;
begin
  if v_realm_id is null then
    return coalesce(new, old);
  end if;

  for v_uid in
    select distinct e->>'user_id'
    from realms r
    cross join lateral jsonb_array_elements(r.players) e
    where r.id = v_realm_id
      and e->>'status' in ('owner', 'member')
      and e->>'user_id' is not null
  loop
    perform sync_user_progress_row(v_uid::uuid);
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists games_sync_progress on games;
create trigger games_sync_progress
  after insert or delete on games
  for each row execute function sync_realm_progress();

-- Realm deleted — reads OLD.players directly rather than re-querying realms
-- (which is already gone by the time this fires), so cascade-deleted games
-- don't leave every former member's progress frozen forever.
create or replace function sync_progress_on_realm_delete()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_uid text;
begin
  for v_uid in
    select distinct e->>'user_id'
    from jsonb_array_elements(old.players) e
    where e->>'status' in ('owner', 'member')
      and e->>'user_id' is not null
  loop
    perform sync_user_progress_row(v_uid::uuid);
  end loop;
  return old;
end;
$$;

drop trigger if exists realms_sync_progress_on_delete on realms;
create trigger realms_sync_progress_on_delete
  after delete on realms
  for each row execute function sync_progress_on_realm_delete();

-- Expansion ownership changed — self-only (affects just the 'expansions'
-- category for that one account), no cross-account RLS concern.
create or replace function sync_progress_on_expansions_change()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform sync_user_progress_row(new.user_id);
  return new;
end;
$$;

drop trigger if exists user_expansions_sync_progress on user_expansions;
create trigger user_expansions_sync_progress
  after insert or update on user_expansions
  for each row execute function sync_progress_on_expansions_change();

-- The realm/games join every trigger above relies on has no supporting index.
create index if not exists games_realm_id_idx on games (realm_id);

-- ── 4. Recompute on realm-membership changes (self-only) ───────────────────────
-- Joining a realm (accept) or leaving one changes which games count toward
-- THIS account's own totals all at once — recompute for the caller
-- (auth.uid()) at the end of each. Bodies otherwise unchanged from
-- migrations/realm_members_to_players.sql.

create or replace function respond_to_realm_invite(p_realm_id text, p_accept boolean)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  perform 1 from realms where id = p_realm_id for update;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'user_id' = v_uid::text and e.elem->>'status' = 'pending'
        then case when p_accept
          then e.elem || jsonb_build_object('status', 'member')
          else e.elem || jsonb_build_object('user_id', null, 'status', 'uninvited')
        end
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;

  if p_accept then
    perform sync_user_progress_row(v_uid);
  end if;
end $$;

create or replace function leave_realm(p_realm_id text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  perform 1 from realms where id = p_realm_id for update;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'user_id' = v_uid::text and e.elem->>'status' = 'member'
        then e.elem || jsonb_build_object('user_id', null, 'status', 'uninvited')
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;

  perform sync_user_progress_row(v_uid);
end $$;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   -- Compare against a known account's current Profile page (rank, tier_count,
--   -- per-category progress) — must match exactly:
--   select * from compute_account_progress('<some-user-id>'::uuid);
--
--   -- After recording a test game as one linked account, confirm a DIFFERENT
--   -- linked account in the same realm also got updated with no action on
--   -- their part:
--   select user_id, rank, tier_count, updated_at from user_progress
--     where user_id in ('<owner-id>', '<member-id>');
