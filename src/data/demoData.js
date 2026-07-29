// ── Demo data (guest "See how it works!" mode) ─────────────────────────────
// One realm with a realistic group. "Alex" is the static demo account —
// their player slot is linked via DEMO_USER_ID, so the demo Profile
// aggregates stats across the shelf.

export const DEMO_USER_ID   = 'demo-user';
export const DEMO_USER_NAME = 'Alex';

const demoPlayers = (names) => names.map((name, i) =>
  i === 0
    ? { name, userId: DEMO_USER_ID, status: 'owner' }
    : { name, userId: null, status: 'uninvited' }
);

// `isDemo` marks this as fake data — RealmBook/RealmsTab use it to keep
// demo-only handling (locked chest, no delete, no settings, never rendered
// as its own shelf card, see RealmsTab.jsx's DEMO_REALM) scoped to this
// realm specifically. Logbook is pinned to 001.png (index 0) — the same one
// every guest's own real realm is locked to — so the demo logbook the tour
// shows matches what they'd actually get.
export const DEMO_REALMS = [
  {
    id: 'demo-realm-3',
    name: 'Club Thursday\'s ',
    players: demoPlayers(['Alex', 'Sam', 'Jordan', 'Elena']),
    created_at: '2026-02-10T00:00:00.000Z',
    isOwner: true,
    spine: 0,
    isDemo: true,
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

// ── Generated games ──────────────────────────────────────────────────────
// Seeded so every load renders the identical demo. Breakdowns sum exactly
// to each score, winners are unique, and clutch/farm flags follow the same
// rules the real tracker uses.

const MEEPLE_BY_NAME = {
  Alex: '3blue.png', Sam: '1yellow.png', Jordan: '4ered.png', Elena: 'black.png',
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
