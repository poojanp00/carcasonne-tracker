-- ════════════════════════════════════════════════════════════════════════════
-- RANK FORMULA: switch to a (rank-1)/(maxRank-1) progress curve
--
-- src/utils/metaRank.js's tiersRequiredForRank changed from
-- ceil((rank/maxRank)^1.5 * totalTiers) to
-- round((totalTiers-1) * ((rank-1)/(maxRank-1))^1.5) + 1 — normalizing rank
-- onto an exact 0..1 progress scale (rank 1 = 0, maxRank = 1), bending it
-- with a ^1.5 curve, then scaling by (totalTiers-1) and adding 1 back. That
-- paired -1/+1 guarantees rank 2's own requirement is always at least 1 no
-- matter how small totalTiers is (plain round(totalTiers * progress^x)
-- could round rank 2's requirement down to 0, making it "free" alongside
-- rank 1's unconditional floor) — while still landing maxRank exactly on
-- totalTiers with no leftover rounding slack, so totalTiers can keep
-- changing later without reopening that edge case.
--
-- compute_account_progress duplicates this formula in SQL (see
-- server_side_progress.sql / remove_expansions_milestone.sql's
-- redefinition) so realm co-members' ranks stay correct no matter who
-- records a shared game — this migration brings that copy in line with the
-- client's new one, same pattern as every other rank-math change in this
-- project. Only the final rank SELECT changes; everything else in the
-- function is unchanged from migrations/remove_expansions_milestone.sql.
-- ════════════════════════════════════════════════════════════════════════════

begin;

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

  -- New progress curve: (rank-1)/(maxRank-1) normalized to 0..1, ^1.5,
  -- scaled by (totalTiers-1) then +1 — see metaRank.js's tiersRequiredForRank.
  select coalesce(max(r), 1) into v_rank
  from generate_series(2, v_max_rank) r
  where v_tier_count >= (round((v_total_tiers - 1) * power((r::float8 - 1) / (v_max_rank - 1), 1.5)) + 1)::int;

  return query select v_rank, v_tier_count, v_category_progress, v_games_count;
end;
$$;

revoke execute on function compute_account_progress(uuid) from public, anon, authenticated;

-- ── Retroactively recompute every account with a progress row ─────────────────
-- Same pattern as every other rank-formula migration here — the same
-- tierCount can map to a different rank under the new curve.
do $$
declare v_uid uuid;
begin
  for v_uid in select user_id from user_progress loop
    perform sync_user_progress_row(v_uid);
  end loop;
end $$;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select user_id, rank, tier_count, updated_at from user_progress order by updated_at desc limit 10;
