-- ════════════════════════════════════════════════════════════════════════════
-- FIX: compute_account_progress assumed games.winners was jsonb
--
-- Follow-up to server_side_progress.sql. games.winners is a native Postgres
-- text[] column (a flat list of name strings needs no nested structure,
-- unlike games.players, which is jsonb because each element carries a
-- nested breakdown object) — compute_account_progress incorrectly treated
-- it as jsonb (jsonb_array_elements_text(coalesce(mg.winners, '[]'::jsonb))),
-- which fails at runtime with "COALESCE types text[] and jsonb cannot be
-- matched" the moment any account with games hits this function — this was
-- silently rolling back every game insert/delete and realm delete that
-- reached the trigger (an AFTER trigger's exception aborts the whole
-- transaction), while the client showed success anyway since insertGame/
-- deleteRealm didn't check for errors (also now fixed, client-side).
--
-- Only the winners-matching line changes — everything else in this function
-- is unchanged from server_side_progress.sql.
-- ════════════════════════════════════════════════════════════════════════════

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
         -- FIX: winners is text[], not jsonb — unnest(), not
         -- jsonb_array_elements_text(). Still case-insensitive, matching
         -- buildAccountGames' w.toLowerCase() === low in src/utils/stats.js.
         select 1 from unnest(coalesce(mg.winners, array[]::text[])) w
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
