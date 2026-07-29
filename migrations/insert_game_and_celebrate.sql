-- ════════════════════════════════════════════════════════════════════════════
-- COMBINE GAME INSERT + CELEBRATION FETCH INTO ONE ROUND-TRIP
--
-- Today, App.jsx's handleRecordGame does two SEQUENTIAL network calls after a
-- game is played: insertGame() (a plain REST table insert), then a separate
-- getRealmCelebrations() RPC to fetch every linked realm member's updated
-- rank/progress (needed for the Final Scores rank badges + celebration
-- modal). The games_sync_progress trigger (server_side_progress.sql) already
-- recomputes every linked account's user_progress row synchronously within
-- that INSERT — so by the time the INSERT's response comes back, the
-- celebration data already exists. Fetching it via a SEPARATE round-trip
-- afterward is pure extra network latency for data that's already sitting
-- there. This is one (of two) contributors to the visible lag after
-- recording a game — the other, the full-history rescan inside
-- compute_account_progress itself, is a separate, larger follow-up.
--
-- Adds insert_game_and_celebrate(jsonb) — inserts the game row AND returns
-- get_realm_celebrations' result set, in one RPC call. Client (storage.js)
-- swaps insertGame()+getRealmCelebrations() for a single call to this.
--
-- SECURITY DEFINER (needed to read every linked account's user_progress row,
-- same as get_realm_celebrations already does) — so it must manually
-- replicate the games table's existing INSERT authorization check
-- (can_access_realm) itself, since SECURITY DEFINER bypasses table RLS.
--
-- Uses jsonb_populate_record(null::games, p_game) to extract+coerce each
-- field from the incoming jsonb blob into the games row's actual column
-- types, rather than hand-writing a cast per column (players/score_timeline/
-- longest_road etc. are jsonb, winners is a native text[] — see
-- fix_winners_array_type.sql — easy to get wrong by hand). p_game must be
-- shaped exactly like insertGame()'s existing payload object (same
-- snake_case column-name keys) — any table column NOT named in the INSERT's
-- explicit column list below (e.g. created_at) is left to its own default,
-- same as today's client-side insert already relies on.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function insert_game_and_celebrate(p_game jsonb)
returns table (
  user_id text,
  name text,
  rank int,
  tier_count int,
  category_progress jsonb,
  games_count int,
  last_celebrated_rank int,
  last_celebrated_tier_count int,
  last_celebrated_category_progress jsonb
)
language plpgsql security definer
set search_path = public as $$
declare
  v_realm_id text := p_game->>'realm_id';
  v_row       games;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if v_realm_id is null or not can_access_realm(v_realm_id) then
    raise exception 'Cannot access this realm.';
  end if;

  select * into v_row from jsonb_populate_record(null::games, p_game);

  insert into games (
    id, realm_id, date, players, expansions, winners, max_score,
    clutch_win, farm_win, duration, score_timeline,
    longest_road, largest_city, largest_field, longest_inn,
    largest_cathedral, biggest_pig, largest_barn, most_monastery, best_trader
  ) values (
    v_row.id, v_row.realm_id, v_row.date, v_row.players, v_row.expansions, v_row.winners, v_row.max_score,
    v_row.clutch_win, v_row.farm_win, v_row.duration, v_row.score_timeline,
    v_row.longest_road, v_row.largest_city, v_row.largest_field, v_row.longest_inn,
    v_row.largest_cathedral, v_row.biggest_pig, v_row.largest_barn, v_row.most_monastery, v_row.best_trader
  );

  -- Nested block = its own savepoint: the insert above is already durable by
  -- the time we get here, so a failure reading celebrations (an unexpected
  -- data anomaly in some OTHER linked account's row, say) can never roll
  -- back the game save — it just means this call surfaces no celebration
  -- data, matching today's independent try/catch around the separate
  -- getRealmCelebrations() call (see App.jsx).
  begin
    return query select * from get_realm_celebrations(v_realm_id);
  exception when others then
    return;
  end;
end;
$$;

revoke execute on function insert_game_and_celebrate(jsonb) from anon, public;
grant execute on function insert_game_and_celebrate(jsonb) to authenticated;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   -- Record a game through the app as normal, then confirm it landed:
--   select id, realm_id, date, players, winners from games order by id desc limit 1;
--   -- And that the linked accounts' progress reflects it (same as before):
--   select user_id, rank, tier_count, updated_at from user_progress
--     where user_id in ('<owner-id>', '<member-id>');
