-- Party Mode Tables
-- Run this in the Supabase SQL editor before using party mode.

-- ── party_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS party_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        NOT NULL,
  runner_user_id  uuid        NOT NULL,
  phase           text        NOT NULL DEFAULT 'lobby',  -- lobby | active | final_scoring | ended
  roster          jsonb       NOT NULL DEFAULT '[]',     -- [{name}]
  expansions      jsonb       NOT NULL DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  last_active_at  timestamptz DEFAULT now(),
  ended_at        timestamptz
);

-- Only one active session per code at a time
CREATE UNIQUE INDEX IF NOT EXISTS party_sessions_code_active
  ON party_sessions (code)
  WHERE phase != 'ended';

-- ── session_claims ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_claims (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES party_sessions(id) ON DELETE CASCADE,
  player_name  text        NOT NULL,
  meeple       text,                    -- chosen meeple filename (set on join)
  device_id    text        NOT NULL,
  claimed_at   timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

-- Prevent two players from claiming the same name in one session
CREATE UNIQUE INDEX IF NOT EXISTS session_claims_name_unique
  ON session_claims (session_id, lower(player_name));

-- ── score_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_events (
  seq          bigserial,
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES party_sessions(id) ON DELETE CASCADE,
  player_name  text        NOT NULL,
  category     text        NOT NULL,
  delta        integer     NOT NULL,
  submitted_at timestamptz DEFAULT now()
);

-- ── board_state cursor ───────────────────────────────────────────────────────
-- Tracks which score_events the runner has already consumed.
ALTER TABLE board_state ADD COLUMN IF NOT EXISTS last_event_seq bigint DEFAULT 0;

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE party_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_claims  ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events    ENABLE ROW LEVEL SECURITY;

-- party_sessions: anyone can look up a session by code; only the runner can write
CREATE POLICY "anon_select_party_sessions"
  ON party_sessions FOR SELECT USING (true);
CREATE POLICY "runner_insert_party_sessions"
  ON party_sessions FOR INSERT WITH CHECK (runner_user_id = auth.uid());
CREATE POLICY "runner_update_party_sessions"
  ON party_sessions FOR UPDATE USING (runner_user_id = auth.uid());

-- session_claims: phones read + write (unauthenticated)
CREATE POLICY "anon_select_session_claims"
  ON session_claims FOR SELECT USING (true);
CREATE POLICY "anon_insert_session_claims"
  ON session_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_session_claims"
  ON session_claims FOR UPDATE USING (true);

-- score_events: phones INSERT; runner SELECTs own session's events
CREATE POLICY "anon_insert_score_events"
  ON score_events FOR INSERT WITH CHECK (true);
CREATE POLICY "runner_select_score_events"
  ON score_events FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM party_sessions WHERE runner_user_id = auth.uid()
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE party_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE score_events;
