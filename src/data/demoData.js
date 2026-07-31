// ── Demo data (guest "See how it works!" mode) ─────────────────────────────
// One realm with a realistic group. "Alex" is the static demo account —
// their player slot is linked via DEMO_USER_ID, so the demo Profile
// aggregates stats across the shelf.

import { LIVE_PLAY_ONLY_RECORD_TYPES, MONASTERY_RECORD_TYPES, MONASTERY_LIKE_MAX, MAX_GAME_PLAYERS } from '../constants';

export const DEMO_USER_ID   = 'demo-user';
export const DEMO_USER_NAME = 'Alex';

// Profile tour's Gallery (see Profile.jsx's demoActive) — a guest's own
// real unlock set is just item 1 (index 0, same lock everyone starts at),
// which would make the Gallery step look empty/pointless mid-tour. These
// stand in for a populated account instead, matching CHESTS/SPINES'
// 001.png.. filename-sorted indices (see data/chests.js/spines.js) — 001,
// 002, 003, 005, 008, 009 zero-indexed. Same indices for both chest and
// logbook since the tour just needs "several unlocked, not all", not any
// particular pairing.
export const DEMO_UNLOCKED_CHEST_INDICES    = new Set([0, 1, 2, 4, 7, 8]);
export const DEMO_UNLOCKED_LOGBOOK_INDICES  = new Set([0, 1, 2, 4, 7, 8]);

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

// Assigned positionally (not by name) so the same generator also works for
// makeTourLogbookGames' arbitrary real player names below — order here is
// exactly what the original 4 canonical demo players (Alex/Sam/Jordan/Elena)
// already used, so the static DEMO_GAMES export is unaffected.
const MEEPLE_BY_INDEX = ['3blue.png', '1yellow.png', '4ered.png', 'black.png', '2pink.png', '5green.png'];

const EXP_SETS = [
  ['The Abbot'],
  ['Inns & Cathedrals', 'The Abbot', 'The River'],
];

// ── Synthetic score timelines ──────────────────────────────────────────────
// The demo games predate score-timeline tracking, so their timelines are
// synthesized from each player's breakdown: category totals are chunked into
// realistic scoring events and spread across the game clock, with final-scoring
// categories (fields, pigs, barns, trade goods) landing in the last stretch.
// Chunks partition each total exactly, so every line ends at the final score.
// Seeded per game id so the demo renders identically on every load. Events
// past FINAL_SCORING_FRACTION are tagged inFinalScoring, same as a real
// Board.jsx game (see LIVE_PLAY_ONLY_RECORD_TYPES in constants.js) — without
// this, achievements derived below would have nothing to exclude, and the
// demo would never show the "an oversized city closed out during final
// scoring doesn't steal the record" behavior real games do.

// Per category: [min chunk, max chunk, scores during final scoring]
const TIMELINE_RULES = {
  road:      [2, 6, false],
  inn:       [4, 16, false],
  city:      [4, 14, false],
  cathedral: [12, 36, false],
  monastery: [9, 9, false],
  abbot:     [3, 9, false],
  field:     [3, 12, true],
};
const FINAL_SCORING_FRACTION = 0.85; // where the marker (and inFinalScoring cutoff) sits

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
        const frac = endGame ? 0.88 + rand() * 0.11 : 0.04 + rand() * 0.82;
        events.push({ player: name, type, amount, t: Math.round(frac * game.gameDuration), inFinalScoring: frac >= FINAL_SCORING_FRACTION });
      }
    });
  });
  // Player-less marker for when Final Scoring was pressed (see Board.jsx) —
  // ScoreTimelineChart draws a vertical reference line at it.
  events.push({ type: 'final-scoring', t: Math.round(FINAL_SCORING_FRACTION * game.gameDuration) });
  return events.sort((a, b) => a.t - b.t);
}

// Derives this game's headline records straight from its own synthesized
// timeline, using the exact same rule Board.jsx applies to a real game: the
// largest single completed-feature event per type, excluding anything
// scored during final scoring for LIVE_PLAY_ONLY_RECORD_TYPES (a feature
// must be finished to score at its real value at all), and a count of
// 9-point monastery/abbot/abbey completions for mostMonastery. Grounding
// achievements in the actual events (rather than independently randomizing
// them, as this used to) guarantees ScoreTimelineChart always finds a real
// matching event to anchor each badge to.
function deriveAchievements(events) {
  const maxByType = {};
  events.forEach(ev => {
    if (!ev.player || MONASTERY_RECORD_TYPES.includes(ev.type)) return;
    if (LIVE_PLAY_ONLY_RECORD_TYPES.includes(ev.type) && ev.inFinalScoring) return;
    const cur = maxByType[ev.type] || { amount: 0, player: null };
    if (ev.amount > cur.amount) maxByType[ev.type] = { amount: ev.amount, player: ev.player };
  });

  const monCounts = {};
  events.forEach(ev => {
    if (MONASTERY_RECORD_TYPES.includes(ev.type) && ev.amount === MONASTERY_LIKE_MAX && !ev.inFinalScoring) {
      monCounts[ev.player] = (monCounts[ev.player] || 0) + 1;
    }
  });
  let topPlayer = null, topCount = 0;
  Object.entries(monCounts).forEach(([p, c]) => { if (c > topCount) { topCount = c; topPlayer = p; } });

  const achievements = {};
  if (maxByType.road)      achievements.longestRoad      = maxByType.road;
  if (maxByType.city)      achievements.largestCity      = maxByType.city;
  if (maxByType.field)     achievements.largestField     = maxByType.field;
  if (maxByType.inn)       achievements.longestInn       = maxByType.inn;
  if (maxByType.cathedral) achievements.largestCathedral = maxByType.cathedral;
  if (topPlayer)           achievements.mostMonastery    = { amount: topCount, player: topPlayer };
  return achievements;
}

function makeGames({ realmId, prefix, names, count, seed, lastDate }) {
  const rand = mulberry32(seed);
  const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));

  const games = [];
  const day = new Date(lastDate + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    const date = day.toISOString().split('T')[0];
    day.setDate(day.getDate() - ri(3, 9));

    const expansions = EXP_SETS[ri(0, EXP_SETS.length - 1)];
    const inns = expansions.includes('Inns & Cathedrals');

    const players = names.map((name, i) => {
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
      Object.keys(b).forEach(k => { if (!b[k]) delete b[k]; });
      const score = Object.values(b).reduce((s, v) => s + v, 0);
      return { name, score, meeple: MEEPLE_BY_INDEX[i % MEEPLE_BY_INDEX.length], breakdown: b };
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

    const game = {
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
    };
    game.scoreTimeline = synthTimeline(game);
    game.achievements = deriveAchievements(game.scoreTimeline);
    games.push(game);
  }
  return games;
}

export const DEMO_GAMES = [
  ...makeGames({ realmId: 'demo-realm-3', prefix: 'demo-club', names: ['Alex', 'Sam', 'Jordan', 'Elena'], count: 15, seed: 7,  lastDate: '2026-07-12' }),
].sort((a, b) => b.date.localeCompare(a.date)); // Newest first — streak logic relies on this order

// Small deterministic string hash — same realm always regenerates the exact
// same personalized game set below (stable across re-renders/re-entering
// the tour), without needing to persist anything.
function seedFromString(str) {
  let h = 7;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

/**
 * Personalized stand-in games for the Realms tour's logbook leg. Same
 * generation pipeline as the static DEMO_GAMES above, but using the guest's
 * own realm name and player names instead of the fixed Alex/Sam/Jordan/Elena
 * cast — so their own real realm's logbook (unlocked just for this tour, see
 * RealmsHub.jsx) can be walked through instead of a separate demo card.
 * Capped at MAX_GAME_PLAYERS names (extras beyond that dropped); a blank
 * name falls back to "Guest".
 */
export function makeTourLogbookGames(realm) {
  const names = (realm.players || [])
    .slice(0, MAX_GAME_PLAYERS)
    .map(p => (p.name && p.name.trim()) || 'Guest');
  if (names.length === 0) return [];
  return makeGames({
    realmId: realm.id,
    prefix: `tour-${realm.id}`,
    names,
    count: 15,
    seed: seedFromString(realm.id),
    lastDate: new Date().toISOString().split('T')[0],
  }).sort((a, b) => b.date.localeCompare(a.date));
}
