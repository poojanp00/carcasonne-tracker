// ── Demo data (guest "See how it works!" mode) ─────────────────────────────
// Three realms with realistic groups. "Alex" is the static demo account —
// their player slot is linked via DEMO_USER_ID in every realm, so the demo
// Profile aggregates stats across all three shelves.

export const DEMO_USER_ID   = 'demo-user';
export const DEMO_USER_NAME = 'Alex';

const demoPlayers = (names) => names.map((name, i) =>
  i === 0
    ? { name, userId: DEMO_USER_ID, status: 'owner' }
    : { name, userId: null, status: 'uninvited' }
);

export const DEMO_REALMS = [
  {
    id: 'demo-realm',
    name: 'New York City',
    players: demoPlayers(['Alex', 'Maya']),
    created_at: '2026-03-25T00:00:00.000Z',
    isOwner: true,
    spine: 3,
  },
  {
    id: 'demo-realm-2',
    name: 'Family Game Night',
    players: demoPlayers(['Alex', 'Priya', 'Raj']),
    created_at: '2026-04-20T00:00:00.000Z',
    isOwner: true,
    spine: 8,
  },
  {
    id: 'demo-realm-3',
    name: 'Club Thursday\'s ',
    players: demoPlayers(['Alex', 'Sam', 'Jordan', 'Elena']),
    created_at: '2026-02-10T00:00:00.000Z',
    isOwner: true,
    spine: 14,
  },
];

// ── Seeded RNG (shared by the game generator and timeline synth) ───────────
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Realm 1: The Home Table — hand-authored games ──────────────────────────
const HOME_TABLE_GAMES = [
  {
    id: 'demo-game-1',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Alex', score: 273, meeple: '3blue.png', breakdown: { inn: 28, barn: 52, city: 71, road: 30, abbot: 27, cloth: 10, field: 21, grain: 10, cathedral: 15, monastery: 9 } },
      { name: 'Maya', score: 324, meeple: '1yellow.png', breakdown: { inn: 20, pig: 20, city: 111, road: 24, wine: 10, abbey: 8, abbot: 25, cloth: 10, field: 21, cathedral: 30, monastery: 45 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Maya'],
    max_score: 324,
    clutchWin: true,
    farmWin: false,
    gameDuration: 3534157,
    achievements: {
      longestRoad:      { amount: 8,  player: 'Alex' },
      largestCity:      { amount: 24, player: 'Alex' },
      largestField:     { amount: 12, player: 'Alex' },
      longestInn:       { amount: 20, player: 'Alex' },
      largestCathedral: { amount: 30, player: 'Maya' },
      biggestPig:       { amount: 20, player: 'Maya' },
      largestBarn:      { amount: 52, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-2',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Alex', score: 320, meeple: '3blue.png', breakdown: { inn: 28, pig: 44, city: 108, road: 24, abbey: 9, abbot: 8, cloth: 10, field: 18, grain: 10, cathedral: 45, monastery: 16 } },
      { name: 'Maya', score: 251, meeple: '1yellow.png', breakdown: { inn: 38, pig: 24, city: 56, road: 15, wine: 10, abbey: 8, abbot: 28, field: 6, grain: 10, cathedral: 24, monastery: 32 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Alex'],
    max_score: 320,
    clutchWin: false,
    farmWin: false,
    gameDuration: 6370963,
    achievements: {
      longestRoad:      { amount: 4,  player: 'Alex' },
      largestCity:      { amount: 22, player: 'Alex' },
      largestField:     { amount: 18, player: 'Alex' },
      longestInn:       { amount: 18, player: 'Maya' },
      largestCathedral: { amount: 45, player: 'Alex' },
      biggestPig:       { amount: 44, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-3',
    realmId: 'demo-realm',
    date: '2026-04-10',
    players: [
      { name: 'Alex', score: 206, meeple: '3blue.png', breakdown: { inn: 54, pig: 24, city: 64, road: 12, abbey: 9, abbot: 9, field: 0, monastery: 34 } },
      { name: 'Maya', score: 310, meeple: '1yellow.png', breakdown: { inn: 36, pig: 44, city: 100, road: 7, wine: 10, abbey: 9, abbot: 19, cloth: 10, field: 12, grain: 10, cathedral: 30, monastery: 23 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Maya'],
    max_score: 310,
    clutchWin: false,
    farmWin: false,
    gameDuration: 3971602,
    achievements: {
      longestRoad:      { amount: 3,  player: 'Alex' },
      largestCity:      { amount: 26, player: 'Maya' },
      largestField:     { amount: 12, player: 'Maya' },
      longestInn:       { amount: 20, player: 'Alex' },
      largestCathedral: { amount: 30, player: 'Maya' },
      biggestPig:       { amount: 44, player: 'Maya' },
    },
  },
  {
    id: 'demo-game-4',
    realmId: 'demo-realm',
    date: '2026-03-31',
    players: [
      { name: 'Alex', score: 116, meeple: '3blue.png', breakdown: { city: 38, road: 22, abbot: 20, field: 18, monastery: 18 } },
      { name: 'Maya', score: 127, meeple: '1yellow.png', breakdown: { city: 61, road: 18, abbot: 39, field: 9, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Maya'],
    max_score: 127,
    clutchWin: true,
    farmWin: false,
    gameDuration: 1716638,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Alex' },
      largestCity:  { amount: 22, player: 'Alex' },
      largestField: { amount: 18, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-5',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Alex', score: 116, meeple: '3blue.png', breakdown: { city: 38, road: 22, abbot: 20, field: 18, monastery: 18 } },
      { name: 'Maya', score: 127, meeple: '1yellow.png', breakdown: { city: 61, road: 18, abbot: 39, field: 9, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Maya'],
    max_score: 127,
    clutchWin: true,
    farmWin: false,
    gameDuration: 1716638,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Alex' },
      largestCity:  { amount: 22, player: 'Alex' },
      largestField: { amount: 18, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-6',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Alex', score: 326, meeple: '3blue.png', breakdown: { inn: 10, pig: 32, barn: 48, city: 101, road: 28, wine: 10, abbey: 9, abbot: 25, cloth: 10, field: 0, grain: 10, monastery: 43 } },
      { name: 'Maya', score: 271, meeple: '1yellow.png', breakdown: { inn: 26, city: 81, road: 19, abbey: 9, abbot: 47, field: 39, grain: 10, cathedral: 36, monastery: 4 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
    winners: ['Alex'],
    max_score: 326,
    clutchWin: true,
    farmWin: true,
    gameDuration: 9884772,
    achievements: {
      longestRoad:      { amount: 9,  player: 'Alex' },
      largestCity:      { amount: 22, player: 'Alex' },
      largestField:     { amount: 48, player: 'Alex' },
      longestInn:       { amount: 26, player: 'Maya' },
      largestCathedral: { amount: 36, player: 'Maya' },
      biggestPig:       { amount: 32, player: 'Alex' },
      largestBarn:      { amount: 48, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-7',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Alex', score: 198, meeple: '3blue.png', breakdown: { inn: 18, city: 33, road: 5, abbot: 31, field: 9, cathedral: 87, monastery: 15 } },
      { name: 'Maya', score: 156, meeple: '1yellow.png', breakdown: { inn: 42, pig: 40, city: 37, road: 4, abbot: 23, field: 0, monastery: 10 } },
    ],
    expansions: ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'Traders & Builders'],
    winners: ['Alex'],
    max_score: 198,
    clutchWin: false,
    farmWin: false,
    gameDuration: 2030225,
    achievements: {
      longestRoad:      { amount: 3,  player: 'Alex' },
      largestCity:      { amount: 12, player: 'Alex' },
      largestField:     { amount: 9,  player: 'Alex' },
      longestInn:       { amount: 30, player: 'Maya' },
      largestCathedral: { amount: 87, player: 'Alex' },
      biggestPig:       { amount: 40, player: 'Maya' },
    },
  },
  {
    id: 'demo-game-8',
    realmId: 'demo-realm',
    date: '2026-03-30',
    players: [
      { name: 'Alex', score: 127, meeple: '3blue.png', breakdown: { city: 39, road: 11, abbot: 26, field: 24, monastery: 27 } },
      { name: 'Maya', score: 99,  meeple: '1yellow.png', breakdown: { city: 33, road: 19, abbot: 23, field: 24, monastery: 0 } },
    ],
    expansions: ['The Abbot'],
    winners: ['Alex'],
    max_score: 127,
    clutchWin: false,
    farmWin: false,
    gameDuration: 1372608,
    achievements: {
      longestRoad:  { amount: 7,  player: 'Maya' },
      largestCity:  { amount: 15, player: 'Maya' },
      largestField: { amount: 24, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-9',
    realmId: 'demo-realm',
    date: '2026-03-26',
    players: [
      { name: 'Alex', score: 148, meeple: '3blue.png', breakdown: { inn: 12, city: 34, road: 26, abbot: 26, field: 6, cathedral: 36, monastery: 8 } },
      { name: 'Maya', score: 141, meeple: '1yellow.png', breakdown: { inn: 10, city: 40, road: 6, abbot: 24, field: 30, cathedral: 15, monastery: 16 } },
    ],
    expansions: ['Inns & Cathedrals', 'The Abbot'],
    winners: ['Alex'],
    max_score: 148,
    clutchWin: true,
    farmWin: false,
    gameDuration: 2910952,
    achievements: {
      longestRoad:      { amount: 8,  player: 'Alex' },
      largestCity:      { amount: 20, player: 'Maya' },
      largestField:     { amount: 24, player: 'Maya' },
      longestInn:       { amount: 12, player: 'Alex' },
      largestCathedral: { amount: 36, player: 'Alex' },
    },
  },
  {
    id: 'demo-game-10',
    realmId: 'demo-realm',
    date: '2026-03-25',
    players: [
      { name: 'Alex', score: 167, meeple: '3blue.png', breakdown: { inn: 44, city: 56, road: 10, abbot: 6, field: 27, monastery: 24 } },
      { name: 'Maya', score: 121, meeple: '1yellow.png', breakdown: { inn: 20, city: 51, road: 3, abbot: 26, field: 21, monastery: 0 } },
    ],
    expansions: ['Inns & Cathedrals', 'The Abbot'],
    winners: ['Alex'],
    max_score: 167,
    clutchWin: false,
    farmWin: false,
    gameDuration: 2995341,
    achievements: {
      longestRoad:  { amount: 4,  player: 'Alex' },
      largestCity:  { amount: 24, player: 'Alex' },
      largestField: { amount: 27, player: 'Alex' },
      longestInn:   { amount: 20, player: 'Maya' },
    },
  },
];

// ── Realms 2 & 3: generated games ──────────────────────────────────────────
// Seeded per realm so every load renders the identical demo. Breakdowns sum
// exactly to each score, winners are unique, and clutch/farm flags follow the
// same rules the real tracker uses.

const MEEPLE_BY_NAME = {
  Alex: '3blue.png', Maya: '1yellow.png',
  Priya: '2pink.png', Raj: '5green.png',
  Sam: '1yellow.png', Jordan: '4ered.png', Elena: 'black.png',
};

const EXP_SETS = [
  ['The Abbot'],
  ['Inns & Cathedrals', 'The Abbot', 'The River'],
  ['Abbey & Mayor', 'Inns & Cathedrals', 'The Abbot', 'The River', 'Traders & Builders'],
];

function makeGames({ realmId, prefix, names, count, seed, lastDate }) {
  const rand = mulberry32(seed);
  const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const pick = () => names[ri(0, names.length - 1)];

  const games = [];
  const day = new Date(lastDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    const date = day.toISOString().split('T')[0];
    day.setDate(day.getDate() - ri(3, 9));

    const expansions = EXP_SETS[ri(0, EXP_SETS.length - 1)];
    const inns = expansions.includes('Inns & Cathedrals');
    const tb   = expansions.includes('Traders & Builders');
    const am   = expansions.includes('Abbey & Mayor');

    const players = names.map(name => {
      const b = {
        road:      ri(4, 26),
        city:      ri(28, 100),
        monastery: ri(0, 5) * 9,
        field:     ri(0, 12) * 3,
        abbot:     ri(5, 32),
      };
      if (inns) {
        b.inn = ri(0, 4) * 10;
        if (rand() < 0.5) b.cathedral = ri(1, 2) * 24;
      }
      if (tb) {
        if (rand() < 0.45) b.pig = ri(4, 11) * 4;
        if (rand() < 0.5) b.wine = 10;
        if (rand() < 0.5) b.grain = 10;
        if (rand() < 0.5) b.cloth = 10;
      }
      if (am) {
        if (rand() < 0.5) b.abbey = 9;
        if (rand() < 0.2) b.barn = ri(9, 14) * 4;
      }
      Object.keys(b).forEach(k => { if (!b[k]) delete b[k]; });
      const score = Object.values(b).reduce((s, v) => s + v, 0);
      return { name, score, meeple: MEEPLE_BY_NAME[name], breakdown: b };
    });

    // Keep a single winner — break ties with a couple of extra city points
    let max = Math.max(...players.map(p => p.score));
    const tied = players.filter(p => p.score === max);
    if (tied.length > 1) {
      tied[0].breakdown.city = (tied[0].breakdown.city || 0) + 2;
      tied[0].score += 2;
      max = tied[0].score;
    }
    const winner = players.find(p => p.score === max);
    const sortedScores = players.map(p => p.score).sort((a, b) => b - a);
    const margin = sortedScores[0] - (sortedScores[1] ?? 0);

    const achievements = {
      longestRoad:  { amount: ri(3, 9),  player: pick() },
      largestCity:  { amount: ri(12, 30), player: pick() },
      largestField: { amount: ri(9, 42),  player: pick() },
    };
    if (inns) achievements.longestInn = { amount: ri(10, 30), player: pick() };
    if (players.some(p => p.breakdown.cathedral)) {
      achievements.largestCathedral = { amount: ri(24, 60), player: pick() };
    }
    if (players.some(p => p.breakdown.pig)) {
      achievements.biggestPig = { amount: ri(16, 44), player: pick() };
    }
    if (players.some(p => p.breakdown.barn)) {
      achievements.largestBarn = { amount: ri(36, 56), player: pick() };
    }

    games.push({
      id: `${prefix}-${i + 1}`,
      realmId,
      date,
      players,
      expansions,
      winners: [winner.name],
      max_score: max,
      clutchWin: margin / max < 0.07,
      farmWin: rand() < 0.15,
      gameDuration: ri(1500, 7200) * 1000,
      achievements,
    });
  }
  return games;
}

export const DEMO_GAMES = [
  ...HOME_TABLE_GAMES,
  ...makeGames({ realmId: 'demo-realm-2', prefix: 'demo-fam',  names: ['Alex', 'Priya', 'Raj'],           count: 7,  seed: 42, lastDate: '2026-07-05' }),
  ...makeGames({ realmId: 'demo-realm-3', prefix: 'demo-club', names: ['Alex', 'Sam', 'Jordan', 'Elena'], count: 15, seed: 7,  lastDate: '2026-07-12' }),
].sort((a, b) => b.date.localeCompare(a.date)); // Newest first — streak logic relies on this order

// ── Synthetic score timelines ──────────────────────────────────────────────
// The demo games predate score-timeline tracking, so their timelines are
// synthesized from each player's breakdown: category totals are chunked into
// realistic scoring events and spread across the game clock, with final-scoring
// categories (fields, pigs, barns, trade goods) landing in the last stretch.
// Chunks partition each total exactly, so every line ends at the final score.
// Seeded per game id so the demo renders identically on every load.

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
