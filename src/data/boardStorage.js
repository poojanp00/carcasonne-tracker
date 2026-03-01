import { supabase } from './supabase';

function makeDefault(players = []) {
  const positions = {};
  const laps      = {};
  for (const p of players) { positions[p] = 0; laps[p] = 0; }
  return { positions, laps, trackLength: 50, players };
}

export async function getBoard(players = []) {
  try {
    const { data } = await supabase
      .from('board_state')
      .select('*')
      .eq('id', 1)
      .single();
    if (!data) return makeDefault(players);
    const stored = data.players || [];
    if (players.length > 0) {
      const same = players.length === stored.length && players.every(p => stored.includes(p));
      if (!same) return makeDefault(players);
    }
    return {
      positions:   data.positions    || {},
      laps:        data.laps         || {},
      trackLength: data.track_length || 50,
      players:     data.players      || [],
    };
  } catch {
    return makeDefault(players);
  }
}

// Fire-and-forget — no need to await in callers
export function saveBoard(board) {
  supabase.from('board_state').upsert({
    id:           1,
    positions:    board.positions,
    laps:         board.laps,
    track_length: board.trackLength || 50,
    players:      board.players     || [],
  }).then(({ error }) => {
    if (error) console.warn('Failed to save board:', error);
  });
}

export function resetBoard(players = []) {
  const d = makeDefault(players);
  saveBoard(d);
  return d;
}
