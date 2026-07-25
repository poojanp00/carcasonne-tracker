-- ════════════════════════════════════════════════════════════════════════════
-- FIX: last_celebrated_* must drop when true progress drops
--
-- Follow-up to rank_up_acknowledgement.sql. sync_user_progress_row never
-- touched last_celebrated_* on conflict — meaning if a game gets deleted and
-- rank/tier_count genuinely drop (e.g. rank 9/17 tiers -> rank 8/14 tiers),
-- last_celebrated_* stays frozen at the old, now-higher-than-reality peak
-- (9/17). Playing back up to that SAME peak later looks like "no increase"
-- (tier_count <= last_celebrated_tier_count) and silently shows nothing —
-- exactly the bug already fixed once for user_progress's rank/tier_count/
-- category_progress themselves (see migrations/user_progress_live_cache.sql)
-- reintroduced here for the acknowledgement columns.
--
-- Fix: sync_user_progress_row (called by every trigger whenever true
-- progress is recomputed) now also pulls last_celebrated_* DOWN to match
-- whenever the new true value is lower — a decrease is never something to
-- celebrate anyway, and this keeps last_celebrated_* from ever sitting above
-- current truth, so a later re-increase — even just back to an old peak —
-- correctly looks like an increase again. It's still never moved UP here;
-- only the client's own acknowledge_rank_up call (after actually showing the
-- celebration) does that — unchanged, still a ratchet in that direction.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function sync_user_progress_row(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  r                            record;
  v_existing_last_celebrated   jsonb;
  v_clamped_category_progress  jsonb;
begin
  select * into r from compute_account_progress(p_user_id);

  select last_celebrated_category_progress into v_existing_last_celebrated
  from user_progress where user_id = p_user_id;

  -- Per category: new last_celebrated = LEAST(old last_celebrated, new
  -- current) — pulls down on a drop, stays put (preserving the gap for a
  -- future celebration) when current is equal or higher. Only used in the
  -- ON CONFLICT branch below; a brand-new row's INSERT branch seeds
  -- last_celebrated_* to match current directly, same as before.
  select jsonb_object_agg(
    coalesce(new_e.key, old_e.key),
    jsonb_build_object(
      'progress',   least(coalesce((old_e.val->>'progress')::numeric, 0), coalesce((new_e.val->>'progress')::numeric, 0)),
      'tierNumber', least(coalesce((old_e.val->>'tierNumber')::int, 0),    coalesce((new_e.val->>'tierNumber')::int, 0))
    )
  )
  into v_clamped_category_progress
  from jsonb_each(coalesce(r.category_progress, '{}'::jsonb)) as new_e(key, val)
  full outer join jsonb_each(coalesce(v_existing_last_celebrated, '{}'::jsonb)) as old_e(key, val)
    on old_e.key = new_e.key;

  insert into user_progress (
    user_id, rank, tier_count, category_progress, games_count, updated_at,
    last_celebrated_rank, last_celebrated_tier_count, last_celebrated_category_progress
  )
  values (
    p_user_id, r.rank, r.tier_count, r.category_progress, r.games_count, now(),
    r.rank, r.tier_count, r.category_progress
  )
  on conflict (user_id) do update
    set rank              = excluded.rank,
        tier_count        = excluded.tier_count,
        category_progress = excluded.category_progress,
        games_count       = excluded.games_count,
        updated_at        = now(),
        last_celebrated_rank = least(user_progress.last_celebrated_rank, excluded.rank),
        last_celebrated_tier_count = least(user_progress.last_celebrated_tier_count, excluded.tier_count),
        last_celebrated_category_progress = coalesce(v_clamped_category_progress, user_progress.last_celebrated_category_progress);
end;
$$;

revoke execute on function sync_user_progress_row(uuid) from public, anon, authenticated;
