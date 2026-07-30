-- ════════════════════════════════════════════════════════════════════════════
-- CHEST/LOGBOOK ART UNLOCKS v2: two independent rolling grab-bag tracks
--
-- Replaces the earlier "18 fixed chest+logbook pairs with per-rank
-- choice/special rules" system (unlocked_pairs/grab_bag_pool/
-- processed_pair_rank/pending_pair_choice below — now fully unused, left in
-- place harmlessly rather than dropped) with something much simpler: chests
-- and logbooks are no longer coupled into pairs at all. Each has its own
-- track that grants one item per rank — rank 1 grants item 1 directly,
-- rank 2 seeds a 4-item pool and draws one at random, every rank after that
-- tops the pool back up to 4 with one more item and draws again. See
-- src/utils/artUnlocks.js for the actual state machine.
--
-- One jsonb blob for both tracks together, not a column per field — this
-- state is never queried/filtered on directly, only ever read/written
-- whole by the app, so mirroring every field into its own SQL column would
-- just be more surface area for no benefit.
--
-- Run in the Supabase SQL editor BEFORE deploying a client build that calls
-- getArtUnlockState/saveArtUnlockState (data/storage.js) — additive only,
-- so a stale pre-migration client keeps working fine against a
-- post-migration DB.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Column ────────────────────────────────────────────────────────────────
alter table user_progress
  add column if not exists art_unlock_state jsonb;
  -- shape: { chest: {unlocked:number[], pool:number[], nextItem:number, processedRank:number},
  --          logbook: <same shape> }

-- ── 2. save_art_unlock_state RPC ─────────────────────────────────────────────
-- Self-write, plain overwrite (no ratchet/merge needed — the client is the
-- sole author of this linear state machine, same rationale as the pair
-- system's save_pair_unlock_state it replaces). Must upsert (insert on
-- conflict), not assume the row already exists — an account can reach
-- unlock rank 1 before any game/realm/expansion activity has lazily
-- created its user_progress row via the sync triggers in
-- server_side_progress.sql.
create or replace function save_art_unlock_state(p_state jsonb)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into user_progress (user_id, art_unlock_state)
  values (v_uid, p_state)
  on conflict (user_id) do update
    set art_unlock_state = excluded.art_unlock_state;
end $$;

revoke execute on function save_art_unlock_state(jsonb) from anon, public;
grant execute on function save_art_unlock_state(jsonb) to authenticated;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--     where table_name = 'user_progress' and column_name = 'art_unlock_state';
--
--   select routine_name from information_schema.routines
--     where routine_name = 'save_art_unlock_state';
--
--   -- as an authenticated test user (client or SQL editor "Run as"), confirm
--   -- the RPC creates a fresh row when none exists yet, then updates it:
--   select save_art_unlock_state('{"chest":{"unlocked":[1],"pool":[],"nextItem":2,"processedRank":1},"logbook":{"unlocked":[1],"pool":[],"nextItem":2,"processedRank":1}}'::jsonb);
--   select art_unlock_state from user_progress where user_id = auth.uid();
--
--   -- to fully reset a test account back to zero:
--   update user_progress set art_unlock_state = null where user_id = auth.uid();
