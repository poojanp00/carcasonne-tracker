import { DEFAULT_EXPANSIONS } from './expansions';

const KEYS = {
  GAMES:      'carcassonne_games',
  EXPANSIONS: 'carcassonne_expansions',
  REALMS:     'carcassonne_realms',
};

// ── Realm ──────────────────────────────────────────────────────────────────────

export function generateRealmId() {
  // Exclude 0/O and 1/I to avoid confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getRealms() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.REALMS) || '[]');
  } catch {
    return [];
  }
}

export function saveRealms(realms) {
  localStorage.setItem(KEYS.REALMS, JSON.stringify(realms));
}

// ── Games ─────────────────────────────────────────────────────────────────────

// Migrate old two-player shape → new N-player shape
function migrateGame(g) {
  if (Array.isArray(g.players)) return g;
  return {
    id:         g.id,
    realmId:    g.realmId || null,
    date:       g.date,
    players: [
      { name: g.player1?.name || 'Player 1', score: g.player1?.score ?? 0, meeple: 'poojan.png' },
      { name: g.player2?.name || 'Player 2', score: g.player2?.score ?? 0, meeple: 'diya.png'   },
    ],
    expansions: g.expansions || [],
    photo:      g.photo || null,
    farmWin:    g.farmWin || false,
  };
}

export function getGames() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.GAMES) || '[]').map(migrateGame);
  } catch {
    return [];
  }
}

export function saveGames(games) {
  localStorage.setItem(KEYS.GAMES, JSON.stringify(games));
}

// ── Expansions ────────────────────────────────────────────────────────────────

export function getExpansions() {
  try {
    const stored = localStorage.getItem(KEYS.EXPANSIONS);
    if (!stored) { saveExpansions(DEFAULT_EXPANSIONS); return DEFAULT_EXPANSIONS; }
    const parsed = JSON.parse(stored);
    const RENAMES = {
      'Count King & Robber':         'Count, King & Robber',
      'Bridges Castles & Bazaars':   'Bridges, Castles & Bazaars',
      'Ghosts Castles & Cemeteries': 'Ghosts, Castles & Cemeteries',
    };
    const migrated    = parsed.map(e => RENAMES[e.name] ? { ...e, name: RENAMES[e.name] } : e);
    const defaultByName = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e]));
    const storedNames   = new Set(migrated.map(e => e.name));
    return [
      ...migrated.map(e => ({ type: defaultByName[e.name]?.type ?? 'full', ...e })),
      ...DEFAULT_EXPANSIONS.filter(e => !storedNames.has(e.name)),
    ];
  } catch {
    return DEFAULT_EXPANSIONS;
  }
}

export function saveExpansions(expansions) {
  localStorage.setItem(KEYS.EXPANSIONS, JSON.stringify(expansions));
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
