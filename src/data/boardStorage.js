const KEY = 'carcassonne_board_v1';

const DEFAULT = {
  positions: {
    Poojan: 0, // 0..49
    Diya: 0,
  },
  laps: {
    Poojan: 0,
    Diya: 0,
  },
  trackLength: 50,
};

export function getBoard() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function saveBoard(board) {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
  } catch (e) {
    // ignore quota errors for now
    console.warn('Failed to save board', e);
  }
}

export function resetBoard() {
  saveBoard(DEFAULT);
  return DEFAULT;
}
