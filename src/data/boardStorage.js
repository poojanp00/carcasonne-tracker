const KEY = 'carcassonne_board_v1';

function makeDefault(players = []) {
  const positions = {};
  const laps      = {};
  for (const p of players) { positions[p] = 0; laps[p] = 0; }
  return { positions, laps, trackLength: 50, players };
}

export function getBoard(players = []) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefault(players);
    const parsed = JSON.parse(raw);
    // Reset if player set changed
    if (players.length > 0) {
      const stored = parsed.players || Object.keys(parsed.positions || {});
      const same   = players.length === stored.length && players.every(p => stored.includes(p));
      if (!same) return makeDefault(players);
    }
    return parsed;
  } catch {
    return makeDefault(players);
  }
}

export function saveBoard(board) {
  try   { localStorage.setItem(KEY, JSON.stringify(board)); }
  catch (e) { console.warn('Failed to save board', e); }
}

export function resetBoard(players = []) {
  const d = makeDefault(players);
  saveBoard(d);
  return d;
}
