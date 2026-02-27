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
    // Merge: preserve any new expansions added to the default list
    const storedNames = new Set(parsed.map(e => e.name));
    const merged = [
      ...parsed,
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
