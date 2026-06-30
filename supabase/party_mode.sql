-- Party Mode Tables
-- Run this in the Supabase SQL editor before using party mode.

-- ── party_sessions ──────────────────────────────────────────────────────────
-- roster items: { name, name_lower, meeple, device_id, claimed }
CREATE TABLE IF NOT EXISTS party_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        NOT NULL,
  runner_user_id  uuid        NOT NULL,
  phase           text        NOT NULL DEFAULT 'lobby',  -- lobby | active | final_scoring | ended
  roster          jsonb       NOT NULL DEFAULT '[]',
  expansions      jsonb       NOT NULL DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  last_active_at  timestamptz DEFAULT now(),
  ended_at        timestamptz,
  final_data      jsonb
);

-- Only one active session per code at a time
CREATE UNIQUE INDEX IF NOT EXISTS party_sessions_code_active
  ON party_sessions (code)
  WHERE phase != 'ended';

-- ── score_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_events (
  seq          bigserial,
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES party_sessions(id) ON DELETE CASCADE,
  player_name  text        NOT NULL,
  category     text        NOT NULL,
  delta        integer     NOT NULL,
  source       text        NOT NULL DEFAULT 'phone',  -- 'host' | 'phone'
  submitted_at timestamptz DEFAULT now()
);

-- ── board_state cursor ───────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE board_state ADD COLUMN IF NOT EXISTS last_event_seq bigint DEFAULT 0;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE party_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events   ENABLE ROW LEVEL SECURITY;

-- party_sessions: anyone can look up; only runner can write/delete
DROP POLICY IF EXISTS "anon_select_party_sessions"   ON party_sessions;
DROP POLICY IF EXISTS "runner_insert_party_sessions" ON party_sessions;
DROP POLICY IF EXISTS "runner_update_party_sessions" ON party_sessions;
DROP POLICY IF EXISTS "runner_delete_party_sessions" ON party_sessions;
CREATE POLICY "anon_select_party_sessions"   ON party_sessions FOR SELECT USING (true);
CREATE POLICY "runner_insert_party_sessions" ON party_sessions FOR INSERT WITH CHECK (runner_user_id = auth.uid());
CREATE POLICY "runner_update_party_sessions" ON party_sessions FOR UPDATE USING (runner_user_id = auth.uid());
CREATE POLICY "runner_delete_party_sessions" ON party_sessions FOR DELETE USING (runner_user_id = auth.uid());

-- score_events: phones INSERT; runner SELECTs own session's events
DROP POLICY IF EXISTS "anon_insert_score_events"   ON score_events;
DROP POLICY IF EXISTS "runner_select_score_events" ON score_events;
CREATE POLICY "anon_insert_score_events"   ON score_events FOR INSERT WITH CHECK (true);
CREATE POLICY "runner_select_score_events" ON score_events FOR SELECT
  USING (session_id IN (SELECT id FROM party_sessions WHERE runner_user_id = auth.uid()));

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE party_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE score_events;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RPC: phones claim / unclaim roster slots ─────────────────────────────────
-- SECURITY DEFINER so anon users can atomically update party_sessions.roster
-- without needing an UPDATE policy (which would be too broad).

CREATE OR REPLACE FUNCTION claim_roster_slot(
  p_session_id uuid,
  p_name_lower text,
  p_device_id  text,
  p_meeple     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur_roster jsonb;
  new_roster jsonb := '[]';
  item       jsonb;
  i          integer;
BEGIN
  SELECT roster INTO cur_roster
  FROM party_sessions
  WHERE id = p_session_id AND phase != 'ended';

  IF cur_roster IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;

  FOR i IN 0 .. jsonb_array_length(cur_roster) - 1 LOOP
    item := cur_roster -> i;

    IF lower(item ->> 'name') = p_name_lower OR item ->> 'name_lower' = p_name_lower THEN
      -- Block if actively claimed by a different device
      IF (item ->> 'claimed')::boolean = true AND item ->> 'device_id' != p_device_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'taken');
      END IF;
      item := item
        || jsonb_build_object('meeple',    p_meeple)
        || jsonb_build_object('device_id', p_device_id)
        || jsonb_build_object('claimed',   true);
    END IF;

    new_roster := new_roster || jsonb_build_array(item);
  END LOOP;

  UPDATE party_sessions SET roster = new_roster WHERE id = p_session_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION unclaim_roster_slot(
  p_session_id uuid,
  p_name_lower text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur_roster jsonb;
  new_roster jsonb := '[]';
  item       jsonb;
  i          integer;
BEGIN
  SELECT roster INTO cur_roster FROM party_sessions WHERE id = p_session_id;
  IF cur_roster IS NULL THEN RETURN; END IF;

  FOR i IN 0 .. jsonb_array_length(cur_roster) - 1 LOOP
    item := cur_roster -> i;
    IF lower(item ->> 'name') = p_name_lower OR item ->> 'name_lower' = p_name_lower THEN
      item := item || '{"claimed": false}'::jsonb;
    END IF;
    new_roster := new_roster || jsonb_build_array(item);
  END LOOP;

  UPDATE party_sessions SET roster = new_roster WHERE id = p_session_id;
END;
$$;

-- ── Migrations (run if tables already exist) ─────────────────────────────────
ALTER TABLE party_sessions ADD COLUMN IF NOT EXISTS final_data jsonb;
ALTER TABLE score_events   ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'phone';

-- Drop old session_claims table (data migrated into party_sessions.roster)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE session_claims; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP TABLE IF EXISTS session_claims CASCADE;
