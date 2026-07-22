-- Removes Party Mode's backend entirely — the feature was never reachable
-- from the UI (PreGameSetup.jsx always used table mode) and its app-side
-- code has been deleted. Party Mode's own tables/columns were defined in
-- supabase/party_mode.sql.
--
-- Run this by hand against your Supabase instance when you're ready —
-- nothing in the app runs this automatically, and it's destructive
-- (drops tables and a column outright).

drop table if exists public.score_events;
drop table if exists public.party_sessions;

alter table public.board_state
  drop column if exists last_event_seq;
