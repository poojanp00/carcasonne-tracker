import { DEFAULT_EXPANSIONS } from './expansions';

const KEYS = {
  GAMES:      'carcassonne_games',
  EXPANSIONS: 'carcassonne_expansions',
};

export function getGames() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.GAMES) || '[]');
  } catch {
    return [];
  }
}

export function saveGames(games) {
  localStorage.setItem(KEYS.GAMES, JSON.stringify(games));
}

export function getExpansions() {
  try {
    const stored = localStorage.getItem(KEYS.EXPANSIONS);
    if (!stored) {
      saveExpansions(DEFAULT_EXPANSIONS);
      return DEFAULT_EXPANSIONS;
    }
    const parsed = JSON.parse(stored);
    // Name migrations (old → new)
    const RENAMES = {
      'Count King & Robber':         'Count, King & Robber',
      'Bridges Castles & Bazaars':   'Bridges, Castles & Bazaars',
      'Ghosts Castles & Cemeteries': 'Ghosts, Castles & Cemeteries',
    };
    const migrated = parsed.map(e => RENAMES[e.name] ? { ...e, name: RENAMES[e.name] } : e);
    // Backfill type from DEFAULT, add any new entries
    const defaultByName = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e]));
    const storedNames = new Set(migrated.map(e => e.name));
    const merged = [
      ...migrated.map(e => ({ type: defaultByName[e.name]?.type ?? 'full', ...e })),
      ...DEFAULT_EXPANSIONS.filter(e => !storedNames.has(e.name)),
    ];
    return merged;
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
