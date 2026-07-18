export const DEMO_REALM = {
  id: 'demo-realm',
  name: 'Demo Realm',
  // Same object shape as DB realms ({ name, userId, status })
  players: [
    { name: 'Player 1', userId: null, status: 'uninvited' },
    { name: 'Player 2', userId: null, status: 'uninvited' },
  ],
  created_at: '2026-03-25T00:00:00.000Z',
  isOwner: true, // Uniform owner-gating shape with DB realms
};

export const DEMO_GAMES = [
  {
    id: 'demo-game-1',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Player 1', score: 273, meeple: '3blue.png', breakdown: { inn: 28, barn: 52, city: 71, road: 30, abbot: 27, cloth: 10, field: 21, grain: 10, cathedral: 15, monastery: 9 } },
      { name: 'Player 2', score: 324, meeple: '1yellow.png', breakdown: { inn: 20, pig: 20, city: 111, road: 24, wine: 10, abbey: 8, abbot: 25, cloth: 10, field: 21, cathedral: 30, monastery: 45 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Player 2'],
    max_score: 324,
    clutchWin: true,
    farmWin: false,
    gameDuration: 3534157,
    achievements: {
      longestRoad:      { amount: 8,  player: 'Player 1' },
      largestCity:      { amount: 24, player: 'Player 1' },
      largestField:     { amount: 12, player: 'Player 1' },
      longestInn:       { amount: 20, player: 'Player 1' },
      largestCathedral: { amount: 30, player: 'Player 2' },
      biggestPig:       { amount: 20, player: 'Player 2' },
      largestBarn:      { amount: 52, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-2',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Player 1', score: 320, meeple: '3blue.png', breakdown: { inn: 28, pig: 44, city: 108, road: 24, abbey: 9, abbot: 8, cloth: 10, field: 18, grain: 10, cathedral: 45, monastery: 16 } },
      { name: 'Player 2', score: 251, meeple: '1yellow.png', breakdown: { inn: 38, pig: 24, city: 56, road: 15, wine: 10, abbey: 8, abbot: 28, field: 6, grain: 10, cathedral: 24, monastery: 32 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Player 1'],
    max_score: 320,
    clutchWin: false,
    farmWin: false,
    gameDuration: 6370963,
    achievements: {
      longestRoad:      { amount: 4,  player: 'Player 1' },
      largestCity:      { amount: 22, player: 'Player 1' },
      largestField:     { amount: 18, player: 'Player 1' },
      longestInn:       { amount: 18, player: 'Player 2' },
      largestCathedral: { amount: 45, player: 'Player 1' },
      biggestPig:       { amount: 44, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-3',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Player 1', score: 206, meeple: '3blue.png', breakdown: { inn: 54, pig: 24, city: 64, road: 12, abbey: 9, abbot: 9, field: 0, monastery: 34 } },
      { name: 'Player 2', score: 310, meeple: '1yellow.png', breakdown: { inn: 36, pig: 44, city: 100, road: 7, wine: 10, abbey: 9, abbot: 19, cloth: 10, field: 12, grain: 10, cathedral: 30, monastery: 23 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Player 2'],
    max_score: 310,
    clutchWin: false,
    farmWin: false,
    gameDuration: 3971602,
    achievements: {
      longestRoad:      { amount: 3,  player: 'Player 1' },
      largestCity:      { amount: 26, player: 'Player 2' },
      largestField:     { amount: 12, player: 'Player 2' },
      longestInn:       { amount: 20, player: 'Player 1' },
      largestCathedral: { amount: 30, player: 'Player 2' },
      biggestPig:       { amount: 44, player: 'Player 2' },
    },
  },
  {
    id: 'demo-game-4',
    realmId: 'demo-realm',
    date: '2026-03-31',
    players: [
      { name: 'Player 1', score: 116, meeple: '3blue.png', breakdown: { city: 38, road: 22, abbot: 20, field: 18, monastery: 18 } },
      { name: 'Player 2', score: 127, meeple: '1yellow.png', breakdown: { city: 61, road: 18, abbot: 39, field: 9, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Player 2'],
    max_score: 127,
    clutchWin: true,
    farmWin: false,
    gameDuration: 1716638,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Player 1' },
      largestCity:  { amount: 22, player: 'Player 1' },
      largestField: { amount: 18, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-5',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Player 1', score: 116, meeple: '3blue.png', breakdown: { city: 38, road: 22, abbot: 20, field: 18, monastery: 18 } },
      { name: 'Player 2', score: 127, meeple: '1yellow.png', breakdown: { city: 61, road: 18, abbot: 39, field: 9, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Player 2'],
    max_score: 127,
    clutchWin: true,
    farmWin: false,
    gameDuration: 1716638,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Player 1' },
      largestCity:  { amount: 22, player: 'Player 1' },
      largestField: { amount: 18, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-6',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Player 1', score: 326, meeple: '1yellow.png', breakdown: { inn: 10, pig: 32, barn: 48, city: 101, road: 28, wine: 10, abbey: 9, abbot: 25, cloth: 10, field: 0, grain: 10, monastery: 43 } },
      { name: 'Player 2', score: 271, meeple: '3blue.png', breakdown: { inn: 26, city: 81, road: 19, abbey: 9, abbot: 47, field: 39, grain: 10, cathedral: 36, monastery: 4 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Player 1'],
    max_score: 326,
    clutchWin: true,
    farmWin: true,
    gameDuration: 9884772,
    achievements: {
      longestRoad:      { amount: 9,  player: 'Player 1' },
      largestCity:      { amount: 22, player: 'Player 1' },
      largestField:     { amount: 48, player: 'Player 1' },
      longestInn:       { amount: 26, player: 'Player 2' },
      largestCathedral: { amount: 36, player: 'Player 2' },
      biggestPig:       { amount: 32, player: 'Player 1' },
      largestBarn:      { amount: 48, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-7',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Player 1', score: 198, meeple: '1yellow.png', breakdown: { inn: 18, city: 33, road: 5, abbot: 31, field: 9, cathedral: 87, monastery: 15 } },
      { name: 'Player 2', score: 156, meeple: '3blue.png', breakdown: { inn: 42, pig: 40, city: 37, road: 4, abbot: 23, field: 0, monastery: 10 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'Traders & Builders'],
    winners: ['Player 1'],
    max_score: 198,
    clutchWin: false,
    farmWin: false,
    gameDuration: 2030225,
    achievements: {
      longestRoad:      { amount: 3,  player: 'Player 1' },
      largestCity:      { amount: 12, player: 'Player 1' },
      largestField:     { amount: 9,  player: 'Player 1' },
      longestInn:       { amount: 30, player: 'Player 2' },
      largestCathedral: { amount: 87, player: 'Player 1' },
      biggestPig:       { amount: 40, player: 'Player 2' },
    },
  },
  {
    id: 'demo-game-8',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Player 1', score: 127, meeple: '3blue.png', breakdown: { city: 39, road: 11, abbot: 26, field: 24, monastery: 27 } },
      { name: 'Player 2', score: 99,  meeple: '1yellow.png', breakdown: { city: 33, road: 19, abbot: 23, field: 24, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Player 1'],
    max_score: 127,
    clutchWin: false,
    farmWin: false,
    gameDuration: 1372608,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Player 2' },
      largestCity:  { amount: 15, player: 'Player 2' },
      largestField: { amount: 24, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-9',
    realmId: 'demo-realm',
    date: '2026-03-26',
    players: [
      { name: 'Player 1', score: 148, meeple: '3blue.png', breakdown: { inn: 12, city: 34, road: 26, abbot: 26, field: 6, cathedral: 36, monastery: 8 } },
      { name: 'Player 2', score: 141, meeple: '1yellow.png', breakdown: { inn: 10, city: 40, road: 6, abbot: 24, field: 30, cathedral: 15, monastery: 16 } },
    ],
    expansions: ['Inns & Cathedrals', 'The Abbot'],
    winners: ['Player 1'],
    max_score: 148,
    clutchWin: true,
    farmWin: false,
    gameDuration: 2910952,
    achievements: {
      longestRoad:      { amount: 8,  player: 'Player 1' },
      largestCity:      { amount: 20, player: 'Player 2' },
      largestField:     { amount: 24, player: 'Player 2' },
      longestInn:       { amount: 12, player: 'Player 1' },
      largestCathedral: { amount: 36, player: 'Player 1' },
    },
  },
  {
    id: 'demo-game-10',
    realmId: 'demo-realm',
    date: '2026-03-25',
    players: [
      { name: 'Player 1', score: 167, meeple: '3blue.png', breakdown: { inn: 44, city: 56, road: 10, abbot: 6, field: 27, monastery: 24 } },
      { name: 'Player 2', score: 121, meeple: '1yellow.png', breakdown: { inn: 20, city: 51, road: 3, abbot: 26, field: 21, monastery: 0 } },
    ],
    expansions: ['Inns & Cathedrals', 'The Abbot'],
    winners: ['Player 1'],
    max_score: 167,
    clutchWin: false,
    farmWin: false,
    gameDuration: 2995341,
    achievements: {
      longestRoad:  { amount: 4,  player: 'Player 1' },
      largestCity:  { amount: 24, player: 'Player 1' },
      largestField: { amount: 27, player: 'Player 1' },
      longestInn:   { amount: 20, player: 'Player 2' },
    },
  },
];

// ── Synthetic score timelines ──────────────────────────────────────────────
// The demo games predate score-timeline tracking, so their timelines are
// synthesized from each player's breakdown: category totals are chunked into
// realistic scoring events and spread across the game clock, with final-scoring
// categories (fields, pigs, barns, trade goods) landing in the last stretch.
// Chunks partition each total exactly, so every line ends at the final score.
// Seeded per game id so the demo renders identically on every load.

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per category: [min chunk, max chunk, scores during final scoring]
const TIMELINE_RULES = {
  road:      [2, 6, false],
  inn:       [4, 16, false],
  city:      [4, 14, false],
  cathedral: [12, 36, false],
  monastery: [9, 9, false],
  abbey:     [8, 9, false],
  abbot:     [3, 9, false],
  field:     [3, 12, true],
  pig:       [4, 16, true],
  barn:      [36, 60, true],
  wine:      [10, 10, true],
  grain:     [10, 10, true],
  cloth:     [10, 10, true],
};

function synthTimeline(game) {
  const rand = mulberry32([...game.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
  const events = [];
  game.players.forEach(({ name, breakdown = {} }) => {
    Object.entries(breakdown).forEach(([type, total]) => {
      const [min, max, endGame] = TIMELINE_RULES[type] || [4, 12, false];
      let remaining = total;
      while (remaining > 0) {
        // Undersized last chunks are fine — incomplete features score small at game end
        const amount = Math.min(remaining, min + Math.floor(rand() * (max - min + 1)));
        remaining -= amount;
        const t = (endGame ? 0.88 + rand() * 0.11 : 0.04 + rand() * 0.82) * game.gameDuration;
        events.push({ player: name, type, amount, t: Math.round(t) });
      }
    });
  });
  return events.sort((a, b) => a.t - b.t);
}

DEMO_GAMES.forEach(g => { g.scoreTimeline = synthTimeline(g); });
