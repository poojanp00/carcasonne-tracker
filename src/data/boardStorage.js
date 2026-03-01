import { supabase } from './supabase';

// SQL migration required:
//   ALTER TABLE board_state ADD COLUMN IF NOT EXISTS score_totals jsonb DEFAULT '{}';

const BASE_TYPES = ['road', 'city', 'monastery', 'field'];

function makeDefault(players = [], extraTypes = []) {
  const allTypes   = [...BASE_TYPES, ...extraTypes.filter(t => !BASE_TYPES.includes(t))];
  const breakdown  = Object.fromEntries(allTypes.map(t => [t, 0]));
  const positions   = {};
  const laps        = {};
  const scoreTotals = {};
  for (const p of players) {
    positions[p]   = 0;
    laps[p]        = 0;
    scoreTotals[p] = { ...breakdown };
  }
  return { positions, laps, trackLength: 50, players, scoreTotals };
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
    // Ensure every player has a breakdown entry
    const scoreTotals = data.score_totals || {};
    for (const p of (data.players || [])) {
      if (!scoreTotals[p]) scoreTotals[p] = { ...BASE_BREAKDOWN };
    }
    return {
      positions:   data.positions    || {},
      laps:        data.laps         || {},
      trackLength: data.track_length || 50,
      players:     data.players      || [],
      scoreTotals,
    };
  } catch {
    return makeDefault(players);
  }
}

// Fire-and-forget for in-game saves
export function saveBoard(board) {
  supabase.from('board_state').upsert({
    id:           1,
    positions:    board.positions,
    laps:         board.laps,
    track_length: board.trackLength || 50,
    players:      board.players     || [],
    score_totals: board.scoreTotals || {},
  }).then(({ error }) => {
    if (error) console.warn('Failed to save board:', error);
  });
}

// Awaitable — callers that need the write to commit before reading should await this
export async function resetBoard(players = [], extraTypes = []) {
  const d = makeDefault(players, extraTypes);
  await supabase.from('board_state').upsert({
    id:           1,
    positions:    d.positions,
    laps:         d.laps,
    track_length: d.trackLength,
    players:      d.players,
    score_totals: d.scoreTotals,
  });
  return d;
}
