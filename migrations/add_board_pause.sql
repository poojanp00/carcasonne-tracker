-- ════════════════════════════════════════════════════════════════════════════
-- BOARD_STATE: pause support
--
-- Board.jsx's Game Settings gained a Pause/Resume control (freezes the
-- on-screen game clock; resuming folds the paused span straight into
-- start_time so every existing "X - start_time" computation — the live
-- clock, the final gameDuration, the score-timeline's per-event offsets —
-- stays correct with no other change needed). boardStorage.js's
-- getBoard/saveBoard/resetBoard already read and write `paused`/`paused_at`
-- unconditionally (defaulting to false/null when absent) — without this
-- migration, every save fails outright (PGRST204: "Could not find the
-- 'paused' column of 'board_state' in the schema cache").
-- ════════════════════════════════════════════════════════════════════════════

alter table board_state add column if not exists paused boolean default false;
alter table board_state add column if not exists paused_at bigint;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select column_name, data_type, column_default from information_schema.columns
--     where table_name = 'board_state' and column_name in ('paused', 'paused_at');
