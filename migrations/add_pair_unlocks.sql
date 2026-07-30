-- ════════════════════════════════════════════════════════════════════════════
-- CHEST/LOGBOOK PAIR UNLOCKS: tiered grab-bag pool state
--
-- New account-level unlock system layered on top of the rank ladder:
-- chests and logbooks are bundled into 18 fixed "pairs" (pair N = chest
-- index N-1 + spine index N-1 — see src/utils/pairUnlocks.js) and granted
-- across the account's 16 ranks via a mix of direct grants, binary player
-- choices, and random grab-bag draws. This does NOT replace or touch the
-- existing per-rank chest/logbook unlock counts (chestUnlockRank/
-- spineUnlockRank in data/chests.js/data/spines.js) that the realm-creation
-- picker (PreGameSetup.jsx/RealmSettingsModal.jsx) still uses today — this
-- is new, additive state for a picker/choice-prompt UI to be built in a
-- later task.
--
-- Lands on the existing user_progress table (same account-level home as
-- rank/tier_count) rather than a new table.
--
-- Client-authoritative, NOT server-computed like rank/tier_count: this is
-- purely cosmetic (no multiplayer fairness concern), same trust level
-- already extended to realms.spine/realms.chest (add_realm_spine.sql/
-- add_realm_chest.sql — client picks, writes directly, no server
-- validation). Unlike those columns, though, user_progress has never had a
-- direct client write path (every prior write — including the now-retired
-- client-push upsert_user_progress in add_user_progress.sql — went through
-- a SECURITY DEFINER RPC, never a raw client UPDATE/INSERT grant), so this
-- migration keeps that convention: a new save_pair_unlock_state RPC, not an
-- RLS insert/update policy.
--
-- Run in the Supabase SQL editor BEFORE deploying a client build that calls
-- getPairUnlockState/savePairUnlockState (data/storage.js) — additive only,
-- so a stale pre-migration client keeps working fine against a
-- post-migration DB.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table user_progress
  add column if not exists unlocked_pairs jsonb not null default '[]'::jsonb, -- number[] of granted pair ids (1-18)
  add column if not exists grab_bag_pool jsonb not null default '[]'::jsonb, -- number[] of pair ids queued, not yet granted
  add column if not exists processed_pair_rank int not null default 0
    check (processed_pair_rank between 0 and 16), -- 16 = MAX_PAIR_UNLOCK_RANK (src/utils/pairUnlocks.js), hardcoded there — see that file's header
  add column if not exists pending_pair_choice jsonb; -- null, or {"rank":n,"candidates":[a,b]} while awaiting a user pick

-- ── 2. save_pair_unlock_state RPC ────────────────────────────────────────────
-- Self-write, plain overwrite (no ratchet/merge needed — the client is the
-- sole author of this linear state machine; ratchet semantics exist
-- elsewhere in this table only because rank/tier_count/last_celebrated_*
-- have server-side or multi-writer concerns this doesn't). Must upsert
-- (insert on conflict), not assume the row already exists like
-- acknowledge_rank_up does — an account can reach pair-unlock rank 1 before
-- any game/realm/expansion activity has lazily created its user_progress
-- row via the sync triggers in server_side_progress.sql.
create or replace function save_pair_unlock_state(
  p_unlocked_pairs jsonb,
  p_grab_bag_pool jsonb,
  p_processed_pair_rank int,
  p_pending_pair_choice jsonb
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into user_progress (
    user_id, unlocked_pairs, grab_bag_pool, processed_pair_rank, pending_pair_choice
  )
  values (
    v_uid,
    coalesce(p_unlocked_pairs, '[]'::jsonb),
    coalesce(p_grab_bag_pool, '[]'::jsonb),
    coalesce(p_processed_pair_rank, 0),
    p_pending_pair_choice
  )
  on conflict (user_id) do update
    set unlocked_pairs       = excluded.unlocked_pairs,
        grab_bag_pool        = excluded.grab_bag_pool,
        processed_pair_rank  = excluded.processed_pair_rank,
        pending_pair_choice  = excluded.pending_pair_choice;
end $$;

revoke execute on function save_pair_unlock_state(jsonb, jsonb, int, jsonb) from anon, public;
grant execute on function save_pair_unlock_state(jsonb, jsonb, int, jsonb) to authenticated;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select column_name, column_default from information_schema.columns
--     where table_name = 'user_progress' and column_name in
--     ('unlocked_pairs','grab_bag_pool','processed_pair_rank','pending_pair_choice');
--
--   select routine_name from information_schema.routines
--     where routine_name = 'save_pair_unlock_state';
--
--   -- as an authenticated test user (client or SQL editor "Run as"), confirm
--   -- the RPC creates a fresh row when none exists yet, then updates it:
--   select save_pair_unlock_state('[1]'::jsonb, '[]'::jsonb, 1, null);
--   select unlocked_pairs, grab_bag_pool, processed_pair_rank, pending_pair_choice
--     from user_progress where user_id = auth.uid();
