-- ════════════════════════════════════════════════════════════════════════════
-- REMOVE THE "EXPANSIONS OWNED" MILESTONE CATEGORY
--
-- Drops the 'expansions' milestone category (Fan/Hobbyist/Collector/
-- Aficionado, gated on how many full expansions a user owns) entirely — it
-- rewarded shelf ownership, not actual play, which sat oddly next to the
-- other categories (all of which are earned by playing games). The client
-- side of this (src/data/accountMilestones.js, src/utils/stats.js,
-- src/data/expansions.js, src/data/storage.js, src/App.jsx,
-- src/components/Profile.jsx) already had the category/metric/derived
-- 'expansions'-milestone-only plumbing (expansionsFullCount, FULL_EXPANSION_NAMES,
-- full_expansions fetch) removed in the same change as this migration — run
-- this migration BEFORE deploying that client build, same ordering
-- convention as every other migration here, so a stale pre-deploy client
-- doesn't briefly see an empty/broken "Expansions" card (get_milestone_config
-- would just return one category fewer, which the OLD client tolerates fine —
-- applyMilestoneConfig only ever narrows to what the DB actually returns).
--
-- get_totalTiers()/compute_account_progress's v_total_tiers are both derived
-- live from milestone_tiers' row count (48 after this, was 52) — so the rank
-- formula (ceil((rank/maxRank)^1.5 * totalTiers)) automatically re-derives
-- itself against the new, smaller tier pool with no separate "redo the math"
-- step needed; max_rank (20) is untouched, only the tier denominator shrinks.
-- Every account whose rank/tier_count included any 'expansions' tiers is
-- recomputed at the bottom of this file, so ranks propped up purely by
-- expansion ownership settle to their true, play-earned rank immediately
-- (not just next time they play/get invited) — sync_user_progress_row's
-- last_celebrated_* ratchet (fix_last_celebrated_drop.sql) already pulls
-- those columns down to match on a drop, so this can never look like a
-- fresh rank-up worth re-celebrating.
--
-- full_expansions existed solely to tell compute_account_progress which
-- expansion names count as "full" for this milestone's ownership count —
-- with the milestone gone, nothing reads that table, so it's dropped too.
-- user_expansions (which expansions each account owns — powers the
-- in-game expansion picker's pre-checked chips, src/components/
-- BoardSettingsModal.jsx) is unrelated and untouched; only the
-- rank-recompute-on-ownership-change trigger is dropped, since expansion
-- ownership no longer affects rank/milestones at all.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Drop the category (cascades its 4 tiers via milestone_tiers' FK) ────────
delete from milestone_categories where id = 'expansions';

-- ── 2. Drop the now-dead "ownership change -> recompute rank" trigger ──────────
drop trigger if exists user_expansions_sync_progress on user_expansions;
drop function if exists sync_progress_on_expansions_change();

-- ── 3. Redefine compute_account_progress WITHOUT the full_expansions-backed
-- v_expansions computation (unconditional, ran regardless of whether the
-- 'expansions' category still existed in milestone_categories) — must happen
-- BEFORE dropping full_expansions below, or every subsequent call (including
-- step 4's recompute loop) fails with "relation full_expansions does not
-- exist". Body is identical to server_side_progress.sql's version minus the
-- v_expansions declare/select and the now-unreachable 'expansions' metric
-- branch in the category loop.
create or replace function compute_account_progress(p_user_id uuid)
returns table (rank int, tier_count int, category_progress jsonb, games_count int)
language plpgsql security definer stable
set search_path = public as $$
declare
  v_max_rank          int;
  v_total_tiers       int;
  v_games_count       int;
  v_wins              int;
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
    select r.id as realm_id, e->>'name' as player_name
    from realms r
    cross join lateral jsonb_array_elements(r.players) e
    where e->>'user_id' = p_user_id::text
      and e->>'status' in ('owner', 'member')
  ),
  my_games as (
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
         -- winners is text[], not jsonb — unnest(), not
         -- jsonb_array_elements_text() (see fix_winners_array_type.sql).
         select 1 from unnest(coalesce(mg.winners, array[]::text[])) w
         where lower(w) = lower(mg.player_name)
       )),
    (select jsonb_object_agg(key, total) from breakdown_totals)
  into v_games_count, v_wins, v_breakdown;

  v_breakdown := coalesce(v_breakdown, '{}'::jsonb);

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
    else
      select coalesce(sum((v_breakdown ->> t)::numeric), 0)
      into v_progress
      from unnest(cat.types) as t;
    end if;

    select coalesce(max((t->>'tierNumber')::int), 0), count(*)
    into v_tier_number, v_reached
    from jsonb_array_elements(cat.tiers) t
    where (t->>'threshold')::numeric <= v_progress;

    v_tier_count := v_tier_count + v_reached;
    v_category_progress := v_category_progress ||
      jsonb_build_object(cat.id, jsonb_build_object('progress', v_progress, 'tierNumber', v_tier_number));
  end loop;

  select coalesce(max(r), 1) into v_rank
  from generate_series(2, v_max_rank) r
  where v_tier_count >= ceil(power((r::float8) / v_max_rank, 1.5) * v_total_tiers)::int;

  return query select v_rank, v_tier_count, v_category_progress, v_games_count;
end;
$$;

revoke execute on function compute_account_progress(uuid) from public, anon, authenticated;

-- ── 4. Drop full_expansions — nothing reads it once the milestone is gone ──────
drop table if exists full_expansions;

-- ── 5. Retroactively recompute every account with a progress row ──────────────
-- Cheap: compute_account_progress is STABLE and scoped to one account's own
-- games/realms; a handful of accounts today, not a hot path.
do $$
declare v_uid uuid;
begin
  for v_uid in select user_id from user_progress loop
    perform sync_user_progress_row(v_uid);
  end loop;
end $$;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select count(*) from milestone_categories;              -- 12 (was 13)
--   select count(*) from milestone_tiers;                   -- 48 (was 52)
--   select to_regclass('public.full_expansions');           -- null (dropped)
--   select tgname from pg_trigger where tgname = 'user_expansions_sync_progress'; -- no rows
--   -- Spot-check a known account's rank dropped/held correctly:
--   select user_id, rank, tier_count, category_progress->'expansions' as expansions_progress
--     from user_progress where user_id = '<some-user-id>'::uuid;
--   -- expansions_progress should be null (key no longer present)
