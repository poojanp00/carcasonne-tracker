-- ════════════════════════════════════════════════════════════════════════════
-- USER PROGRESS: LIVE CACHE, NOT A PERMANENT-ACHIEVEMENT RATCHET
--
-- Follow-up to add_user_progress.sql. That version's upsert_user_progress
-- only ever moved rank/tier_count/category_progress upward (a "highest ever"
-- ratchet, matching the old highest_meta_rank behavior it replaced). That's
-- wrong for this table: if an owner deletes a game and an account's real
-- rank drops, the cached row needs to drop with it — otherwise re-earning
-- that rank later never re-fires the rank-up celebration in App.jsx (the
-- before/after diff compares against the cached "before" value, which was
-- stuck at the old high-water mark and never looked lower than the new
-- "after" value again).
--
-- upsert_user_progress now does a plain overwrite: whatever the caller's own
-- client just computed (the actual current truth — that client has full
-- access to its own games/realms/expansions) replaces the stored row
-- outright. The client side (App.jsx) now resyncs on game deletion too, not
-- just on game insertion, so the cache tracks reality in both directions.
--
-- Run this file in the Supabase SQL editor after add_user_progress.sql — it
-- only replaces the function, no table/column changes, so it's safe to run
-- against a database that already has real rows in user_progress.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function upsert_user_progress(
  p_rank int,
  p_tier_count int,
  p_category_progress jsonb,
  p_games_count int
)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into user_progress (user_id, rank, tier_count, category_progress, games_count, updated_at)
  values (
    auth.uid(),
    greatest(1, least(20, p_rank)),
    greatest(0, p_tier_count),
    coalesce(p_category_progress, '{}'::jsonb),
    greatest(0, p_games_count),
    now()
  )
  on conflict (user_id) do update
    set rank              = excluded.rank,
        tier_count        = excluded.tier_count,
        category_progress = excluded.category_progress,
        games_count       = excluded.games_count,
        updated_at        = now();
end $$;
