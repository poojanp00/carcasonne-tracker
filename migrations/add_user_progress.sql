-- ════════════════════════════════════════════════════════════════════════════
-- ACCOUNT RANK/MILESTONE PROGRESS (cross-realm visibility + server-side cache)
--
-- SUPERSEDED IN PART — run these two follow-ups after this file too:
--   1. migrations/user_progress_live_cache.sql — upsert_user_progress's
--      ratchet semantics described below (never regresses) turned out to be
--      wrong: this table needs to reflect current truth, including going
--      down if a game is deleted, so a later re-earned rank still triggers
--      the rank-up celebration.
--   2. migrations/realm_member_progress_detail.sql — get_realm_member_progress
--      originally returned rank only (scoped that way deliberately); widened
--      to also return tier_count/category_progress so a co-member's current
--      milestone standing can be viewed on demand, not just their rank.
-- The table/RLS/backfill below are unchanged and still correct as-is.
--
-- Rank (utils/metaRank.js) and milestone tiers (data/accountMilestones.js) are
-- 100% client-computed today from calcAccountStats(), which scans every game
-- across every realm the account belongs to. The only thing persisted is
-- auth.users.raw_user_meta_data.highest_meta_rank — private to that account,
-- unreadable by anyone else, and only a bare rank number.
--
-- This table caches the full computed snapshot server-side so:
--   1. Realm co-members can see each other's rank (impossible today — games
--      have no per-row user_id, so another account's stats can't be computed
--      from a co-member's own client, which lacks RLS access to most of the
--      other account's realms).
--   2. The app stops re-deriving rank from a full games scan on every load —
--      chest/logbook-picker gating (App.jsx selfRank) now reads this cached
--      row instead of running calcAccountStats() just to get one number.
--
-- Self-written only (RLS: user_id = auth.uid()) — the owning account's own
-- client computes the real values (it has full access to its own data) and
-- pushes them via upsert_user_progress. Values are never independently
-- re-verified server-side (no SQL reimplementation of calcAccountStats) —
-- same trust level already extended to highest_meta_rank today.
--
-- Ratchet semantics match the existing highest_meta_rank behavior: rank,
-- tier_count, games_count, and each category's progress only ever move
-- upward, treating them as permanent achievements rather than a live mirror
-- of current state (games CAN be deleted — games_delete policy in
-- realm_sharing.sql — but a previously-earned rank/milestone should never
-- visibly un-unlock because of that).
--
-- Run this file in the Supabase SQL editor BEFORE deploying any client build
-- that calls upsert_user_progress / get_realm_member_progress — same
-- deploy-ordering convention as every prior migration in this repo. This one
-- is additive only (new table, new RPCs), so a stale pre-migration client
-- keeps working fine against a post-migration DB; the reverse (new client,
-- old DB) just degrades to "no rank badges yet / no rank-up modal yet" (every
-- call site below tolerates a missing table/RPC), not a crash — but don't
-- rely on that, run the migration first.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists user_progress (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  rank              int   not null default 1 check (rank between 1 and 20), -- 20 = MAX_RANK (utils/metaRank.js RANK_TITLES.length)
  tier_count        int   not null default 0 check (tier_count >= 0),
  category_progress jsonb not null default '{}'::jsonb, -- { [categoryId]: { progress, tierNumber } }, data/accountMilestones.js ids
  games_count       int   not null default 0 check (games_count >= 0), -- snapshot of gamesCount at last sync; staleness signal only
  updated_at        timestamptz not null default now()
);

-- ── 2. Backfill from existing auth metadata ──────────────────────────────────
-- tier_count/category_progress are unknown at backfill time (metadata only
-- ever stored rank) — 0/{} is fine: the next upsert_user_progress call from
-- that account (Profile visit or game save) ratchets them up for real, and
-- the co-member rank badge (rank only) is already correct immediately.
insert into user_progress (user_id, rank, tier_count, category_progress, games_count, updated_at)
select id, greatest(1, least(20, (raw_user_meta_data->>'highest_meta_rank')::int)), 0, '{}'::jsonb, 0, now()
from auth.users
where raw_user_meta_data ? 'highest_meta_rank'
on conflict (user_id) do nothing;

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
alter table user_progress enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = 'user_progress'
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- Self-read only; realm co-members read via get_realm_member_progress below
-- (SECURITY DEFINER), not this policy. Deliberately no insert/update policy —
-- all writes go through upsert_user_progress.
create policy user_progress_select on user_progress for select
  using (user_id = auth.uid());

-- ── 4. RPCs ────────────────────────────────────────────────────────────────────

-- Self-write, atomic ratchet (never regress rank/tier_count/games_count/any
-- category's progress or tierNumber), race-safe under concurrent writes from
-- the same account (e.g. two devices) via the row lock below.
create or replace function upsert_user_progress(
  p_rank int,
  p_tier_count int,
  p_category_progress jsonb,
  p_games_count int
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_existing jsonb;
  v_merged   jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select category_progress into v_existing
  from user_progress where user_id = v_uid
  for update;

  select jsonb_object_agg(
    coalesce(new_e.key, old_e.key),
    jsonb_build_object(
      'progress',   greatest(coalesce((old_e.val->>'progress')::numeric, 0), coalesce((new_e.val->>'progress')::numeric, 0)),
      'tierNumber', greatest(coalesce((old_e.val->>'tierNumber')::int, 0),    coalesce((new_e.val->>'tierNumber')::int, 0))
    )
  )
  into v_merged
  from jsonb_each(coalesce(p_category_progress, '{}'::jsonb)) as new_e(key, val)
  full outer join jsonb_each(coalesce(v_existing, '{}'::jsonb)) as old_e(key, val)
    on old_e.key = new_e.key;

  insert into user_progress (user_id, rank, tier_count, category_progress, games_count, updated_at)
  values (
    v_uid,
    greatest(1, least(20, p_rank)),
    greatest(0, p_tier_count),
    coalesce(v_merged, '{}'::jsonb),
    greatest(0, p_games_count),
    now()
  )
  on conflict (user_id) do update
    set rank              = greatest(user_progress.rank, excluded.rank),
        tier_count        = greatest(user_progress.tier_count, excluded.tier_count),
        category_progress = excluded.category_progress, -- already ratchet-merged above
        games_count       = greatest(user_progress.games_count, excluded.games_count),
        updated_at        = now();
end $$;

-- Realm co-members' rank (rank only — confirmed scope, not the full
-- milestone/category breakdown), gated by can_access_realm — mirrors
-- get_realm_member_emails exactly (migrations/allow_member_invites.sql).
create or replace function get_realm_member_progress(p_realm_id text)
returns table (user_id text, rank int)
language sql security definer stable
set search_path = public as $$
  select e->>'user_id', up.rank
  from realms r
  cross join lateral jsonb_array_elements(r.players) e
  join user_progress up on up.user_id = (e->>'user_id')::uuid
  where r.id = p_realm_id
    and can_access_realm(p_realm_id)
    and e->>'user_id' is not null;
$$;

revoke execute on function upsert_user_progress(int, int, jsonb, int) from anon, public;
revoke execute on function get_realm_member_progress(text) from anon, public;
grant execute on function upsert_user_progress(int, int, jsonb, int) to authenticated;
grant execute on function get_realm_member_progress(text) to authenticated;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select tablename, rowsecurity from pg_tables where tablename = 'user_progress';
--   select policyname, cmd from pg_policies where tablename = 'user_progress'; -- only user_progress_select
--   select count(*) from user_progress; -- should roughly match count of auth.users with highest_meta_rank set
