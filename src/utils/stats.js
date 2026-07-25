// Shared game-statistics calculators, used by the per-realm Statistics page
// and the account-wide Me page. All name matching is case-insensitive.

import { STATISTICS_CONFIG } from '../constants';
import { DEFAULT_EXPANSIONS, FULL_EXPANSION_NAMES } from '../data/expansions';

export function calcFavMeeple(games, name) {
  const low = name.toLowerCase();
  const counts = {};
  for (const g of games) {
    const me = g.players.find(p => p.name.toLowerCase() === low);
    if (!me?.meeple) continue;
    counts[me.meeple] = (counts[me.meeple] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { meeple: top[0], count: top[1] } : { meeple: null, count: 0 };
}

// Aggregate per-type score totals across all games for a player
export function calcBreakdown(games, name) {
  const low    = name.toLowerCase();
  const totals = {};
  for (const g of games) {
    const me = g.players.find(p => p.name.toLowerCase() === low);
    if (!me?.breakdown) continue;
    for (const [type, pts] of Object.entries(me.breakdown)) {
      totals[type] = (totals[type] || 0) + pts;
    }
  }
  return totals;
}

/**
 * COMPREHENSIVE CARCASSONNE GAME STATISTICS CALCULATOR
 *
 * Analyzes a player's complete game history to extract meaningful performance metrics.
 * All calculations are opponent-relative (comparing against other players in each game).
 *
 * Key Metrics Calculated:
 *
 * BASIC STATS:
 * - Win/Loss record and percentages
 * - High score achievements and dates
 * - Point differentials and averages
 *
 * ADVANCED ANALYSIS:
 * - Clutch factor: Performance in close games (margin < 7% of combined scores)
 * - Farm win percentage: How often victories come from field scoring dominance
 * - Biggest blowouts: Largest victory margins with game details
 * - Current streaks: Consecutive wins/losses from most recent games
 *
 * SCORING BREAKDOWNS:
 * - Per-category point totals across all games
 * - Expansion-specific scoring analysis
 *
 * @param {Array} games - Complete game history array
 * @param {string} name - Player name to analyze (case-insensitive)
 * @returns {Object} Comprehensive stats object with all calculated metrics
 */
export function calcStats(games, name) {
  const low  = name.toLowerCase();
  // Filter to only games where this player participated
  const mine = games.filter(g => g.players.some(p => p.name.toLowerCase() === low));

  // Initialize all tracking variables
  let wins = 0, losses = 0, highScore = 0, highScoreDate = null, highScoreGame = null, farmWins = 0, netPtDiff = 0, totalPoints = 0;
  let biggestBlowout = 0, biggestBlowoutDate = null, biggestBlowoutMyScore = 0, biggestBlowoutTheirScore = 0, biggestBlowoutGame = null;
  let clutchWins = 0, clutchLosses = 0, clutchGames = 0;

  // Process each game to extract statistics
  for (const g of mine) {
    // Find this player's performance in this game
    const me = g.players.find(p => p.name.toLowerCase() === low);
    const my = me.score;
    const isWinner = g.winners?.includes(me.name) || false;
    const opponents = g.players.filter(p => p.name.toLowerCase() !== low);
    const maxOpp = opponents.length > 0 ? Math.max(...opponents.map(p => p.score)) : 0;

    // WIN/LOSS ANALYSIS
    // Use precomputed winners from database instead of calculating
    if (isWinner) {
      wins++;

      // BLOWOUT TRACKING
      // Track the largest victory margin for bragging rights
      const margin = my - maxOpp;
      if (margin > biggestBlowout) {
        biggestBlowout          = margin;
        biggestBlowoutDate      = g.date;
        biggestBlowoutMyScore   = my;
        biggestBlowoutTheirScore = maxOpp;
        biggestBlowoutGame      = g;
      }
    } else {
      losses++;
    }

    // HIGH SCORE TRACKING
    // Personal best regardless of game outcome
    if (my > highScore) { highScore = my; highScoreDate = g.date; highScoreGame = g; }

    // POINT DIFFERENTIAL ANALYSIS
    // Cumulative margin tracking for average dominance calculation
    netPtDiff   += (my - maxOpp);
    totalPoints += my;

    // FARM WIN ANALYSIS
    // Track when victories come primarily from field scoring
    // Game must be marked as farmWin AND player must have won
    if (g.farmWin && isWinner) farmWins++;

    // CLUTCH GAME ANALYSIS
    // "Clutch" games are close contests where margin < 7% of combined score
    // Tests performance under pressure in competitive games
    const total_pts = my + maxOpp;
    if (total_pts > 0 && Math.abs(my - maxOpp) / total_pts < STATISTICS_CONFIG.CLUTCH_THRESHOLD) {
      clutchGames++;
      if (isWinner)     clutchWins++;
      else              clutchLosses++;
    }
  }

  // CALCULATE DERIVED STATISTICS
  const total       = mine.length;
  const winRate     = total > 0 ? Math.round((wins / total) * 100) : 0;
  const farm = wins > 0 ? Math.round((farmWins / wins) * 100) : null; // % of wins via farming
  const clutchFactor  = clutchGames > 0 ? Math.round((clutchWins / clutchGames) * 100) / 100 : null;

  /**
   * CURRENT STREAK CALCULATION
   *
   * Calculates consecutive wins or losses starting from most recent game.
   * Games are stored newest-first, so we iterate from index 0.
   * Streak breaks on first non-matching result (win breaks loss streak, etc.).
   * Equal scores now count as wins and continue win streaks.
   */
  let winStreak = 0, lossStreak = 0;
  for (let i = 0; i < mine.length; i++) {
    const g   = mine[i]; // Current game (newest first)
    const me2 = g.players.find(p => p.name.toLowerCase() === low);
    // Initialize streak on first game
    if (winStreak === 0 && lossStreak === 0) {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (isWinner2)  winStreak  = 1;   // Start win streak
      else            lossStreak = 1;   // Start loss streak
    }
    // Continue existing win streak
    else if (winStreak > 0) {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (isWinner2) winStreak++;
      else break;                           // Streak broken by loss
    }
    // Continue existing loss streak
    else {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (!isWinner2) lossStreak++;
      else break;                           // Streak broken by win
    }
  }

  /**
   * LONGEST WIN STREAK CALCULATION
   *
   * Max run of consecutive wins anywhere in the history (order-independent
   * for a maximum, so the stored newest-first order is fine).
   */
  let bestWinStreak = 0, run = 0;
  for (const g of mine) {
    const me2 = g.players.find(p => p.name.toLowerCase() === low);
    if (g.winners?.includes(me2.name)) {
      run++;
      if (run > bestWinStreak) bestWinStreak = run;
    } else {
      run = 0;
    }
  }

  // Return comprehensive statistics object
  return {
    // Basic game record
    wins, losses, winRate, total,

    // Scoring achievements
    highScore, highScoreDate, highScoreGame, totalPoints, netPtDiff,

    // Streak tracking
    winStreak, lossStreak, bestWinStreak,

    // Advanced metrics
    farmWins, farm,                    // Farm-based victory analysis
    clutchFactor, clutchGames, clutchWins, // Performance under pressure
    biggestBlowout, biggestBlowoutDate, biggestBlowoutGame, // Most dominant victory
    biggestBlowoutMyScore, biggestBlowoutTheirScore,
  };
}

export function calcGroupStats(games) {
  let totalPoints = 0, farmWins = 0, clutchGames = 0, longestGame = 0, longestGameObj = null, shortestGame = 0, shortestGameObj = null, highestPoints = 0, highestPointsObj = null;
  let closestFinishMargin = 0, closestFinishObj = null, durationSum = 0, timedCount = 0;
  const typePoints = {};
  const dayStats = {}; // date -> { count, duration } — for "Most Active Day"
  for (const g of games) {
    const gamePoints = g.players.reduce((s, p) => s + p.score, 0);
    totalPoints += gamePoints;
    if (g.farmWin) farmWins++;
    if (g.clutchWin) clutchGames++;
    if ((g.gameDuration || 0) > longestGame) { longestGame = g.gameDuration || 0; longestGameObj = g; }
    if ((g.gameDuration || 0) > 0 && (shortestGame === 0 || g.gameDuration < shortestGame)) { shortestGame = g.gameDuration; shortestGameObj = g; }
    if ((g.gameDuration || 0) > 0) { durationSum += g.gameDuration; timedCount++; }
    if (gamePoints > highestPoints) { highestPoints = gamePoints; highestPointsObj = g; }
    // Closest finish: smallest winning margin across single-winner games (ties excluded)
    if ((g.winners || []).length === 1 && g.players.length > 1) {
      const scores = g.players.map(p => p.score).sort((a, b) => b - a);
      const margin = scores[0] - (scores[1] ?? 0);
      if (!closestFinishObj || margin < closestFinishMargin) { closestFinishMargin = margin; closestFinishObj = g; }
    }
    for (const p of g.players)
      for (const [type, pts] of Object.entries(p.breakdown || {}))
        typePoints[type] = (typePoints[type] || 0) + pts;
    if (g.date) {
      const day = dayStats[g.date] || (dayStats[g.date] = { count: 0, duration: 0 });
      day.count++;
      day.duration += g.gameDuration || 0;
    }
  }
  const avgDuration = timedCount > 0 ? Math.round(durationSum / timedCount) : 0;

  // Most games played in a single day; ties broken by total time played that day.
  let mostActiveDay = null, mostActiveDayCount = 0, bestCount = -1, bestDuration = -1;
  for (const [day, stat] of Object.entries(dayStats)) {
    if (stat.count > bestCount || (stat.count === bestCount && stat.duration > bestDuration)) {
      bestCount = stat.count;
      bestDuration = stat.duration;
      mostActiveDay = day;
      mostActiveDayCount = stat.count;
    }
  }

  return { totalPoints, farmWins, clutchGames, longestGame, longestGameObj, shortestGame, shortestGameObj, highestPoints, highestPointsObj, closestFinishMargin, closestFinishObj, avgDuration, typePoints, mostActiveDay, mostActiveDayCount };
}

/**
 * Per-realm standings used by the Library (cover champion, overview chart,
 * Fellowship cards). Extracted from the old Statistics page.
 *
 * @returns {{ sorted: Array, leaders: Set<string> }} players ranked by
 *   winRate → wins → netPtDiff → winStreak, each with calcStats fields plus
 *   zero-filled breakdown and favorite meeple; leaders = names tied at the top.
 */
export function calcRealmStandings(realmGames, realm) {
  const BASE_BREAKDOWN = { road: 0, city: 0, monastery: 0, field: 0 };

  // Derive player names: from games if available, else from realm roster
  let names;
  if (realmGames.length > 0) {
    const seenLower = new Map();
    realmGames.flatMap(g => g.players.map(p => p.name)).forEach(n => {
      if (!seenLower.has(n.toLowerCase())) seenLower.set(n.toLowerCase(), n);
    });
    names = [...seenLower.values()];
  } else {
    names = (realm?.players || []).map(p => p.name);
  }

  // Collect all scoring types used in any game in the realm
  const allTypesInRealm = new Set();
  realmGames.forEach(g => {
    g.players.forEach(p => {
      if (p.breakdown) Object.keys(p.breakdown).forEach(t => allTypesInRealm.add(t));
    });
  });

  const allStats = names.map(name => ({
    name,
    ...calcStats(realmGames, name),
    breakdown: realmGames.length > 0
      ? { ...Object.fromEntries([...allTypesInRealm].map(t => [t, 0])), ...calcBreakdown(realmGames, name) }
      : { ...BASE_BREAKDOWN },
    ...(() => { const { meeple, count } = calcFavMeeple(realmGames, name); return { favMeeple: meeple, favMeepleCount: count }; })(),
  }));

  // Crown leader: best win rate — only meaningful with games
  const sorted = [...allStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.netPtDiff - a.netPtDiff || b.winStreak - a.winStreak);

  const leaders = new Set();
  if (realmGames.length > 0 && sorted[0]) {
    const top = sorted[0];
    sorted.forEach(p => {
      if (p.winRate === top.winRate && p.wins === top.wins && p.netPtDiff === top.netPtDiff && p.winStreak === top.winStreak)
        leaders.add(p.name);
    });
  }
  return { sorted, leaders };
}

// ── Player identity ──────────────────────────────────────────────────────────

// Rank ladder by career games played — the static stand-in for the future
// identity generator (see note below).
const TITLE_TIERS = [
  [300, 'High Lord'],
  [150, 'Duke'],
  [75,  'Count'],
  [30,  'Baron'],
  [10,  'Knight'],
  [1,   'Squire'],
  [0,   'Peasant'],
];

export function getPlayerTitle(gamesCount) {
  return TITLE_TIERS.find(([threshold]) => gamesCount >= threshold)?.[1] ?? 'Peasant';
}

/*
 * FUTURE: Player Identity generator (not yet implemented)
 *
 * Planned as src/utils/identity.js exporting
 *   generateIdentity(account) → { title, epithet, sentence }
 * where `account` is calcAccountStats output — it already carries every input
 * needed: stats (winRate, bestWinStreak, clutchFactor, totalPoints),
 * breakdown (favorite + highest-scoring feature), recordTallies,
 * favExpansions, rival, biggestPlay, sweeps, gamesCount, playingSince.
 *
 * Algorithm sketch:
 *  1. Trait extraction — dominantFeature (argmax breakdown), signatureRecord
 *     (argmax recordTallies), clutchness/dominance/streakiness buckets,
 *     veterancy (getPlayerTitle), expansionAffinity, nemesis (rival),
 *     spectacle (biggestPlay thresholds).
 *  2. Distinctiveness scoring vs a baseline (e.g. winRate − 50, breakdown
 *     share − uniform share) so the sentence highlights what is unusual
 *     about this player, not what is common.
 *  3. Ranked medieval-historian template table filled with the top 2-3
 *     distinctive traits; deterministic (seeded by userId) so the identity
 *     is stable between visits.
 * Surfaces as a replacement for the static getPlayerTitle line on the
 * Profile hero; the milestones→titles system will feed into it later.
 */

export function calcPlayerRecords(games, players) {
  const records = Object.fromEntries(players.map(p => [p.toLowerCase(), { w: 0, l: 0 }]));
  for (const g of games)
    for (const p of g.players) {
      const key = p.name.toLowerCase();
      if (!records[key]) continue;
      if (g.winners?.includes(p.name)) records[key].w++;
      else records[key].l++;
    }
  return records;
}

// key -> { [playerName]: { count, best } } — how many times each player has
// held each achievement across the given games, and their best (highest
// amount) instance of it.
function tallyAchievementsByPlayer(games) {
  const tallies = {};
  for (const g of games)
    for (const [key, a] of Object.entries(g.achievements || {})) {
      if (!a?.player) continue;
      tallies[key] ??= {};
      const entry = (tallies[key][a.player] ??= { count: 0, best: 0 });
      entry.count++;
      if (a.amount > entry.best) entry.best = a.amount;
    }
  return tallies;
}

// One player's own trophy tallies within a realm — key -> { count, best }.
export function calcPlayerTrophyTallies(games, playerName) {
  const tallies = tallyAchievementsByPlayer(games);
  const mine = {};
  for (const [key, byPlayer] of Object.entries(tallies))
    if (byPlayer[playerName]) mine[key] = byPlayer[playerName];
  return mine;
}

// ── Account-wide aggregation ─────────────────────────────────────────────────
// A signed-in account maps to one player slot per realm (realm.players entry
// with a matching userId and status owner/member) — possibly under a different
// name in each realm. These helpers gather that account's games across every
// realm so the name-based calculators above can run over the combined set.

// Sentinel player name guaranteed not to collide with any real player's name
export const ACCOUNT_ME = '__account_me__';

// Map<realmId, myNameInThatRealm> for realms where the user has a claimed slot
export function accountNamesByRealm(realms, userId) {
  const map = new Map();
  if (!userId) return map;
  for (const r of realms || []) {
    const slot = (r.players || []).find(
      p => p.userId === userId && (p.status === 'owner' || p.status === 'member')
    );
    if (slot) map.set(r.id, slot.name);
  }
  return map;
}

/**
 * Clone the games that belong to the account, renaming the user's player entry
 * (and matching winners, timeline, and achievement-holder entries) to
 * ACCOUNT_ME so the name-based calculators work unchanged across realms —
 * same-name strangers in other realms are never renamed, so they can't leak
 * into the aggregate.
 * Preserves input order (newest-first) so streak logic holds.
 */
export function buildAccountGames(games, realms, userId) {
  const nameByRealm = accountNamesByRealm(realms, userId);
  if (nameByRealm.size === 0) return [];
  const out = [];
  for (const g of games || []) {
    const myName = nameByRealm.get(g.realmId);
    if (!myName) continue;
    const low = myName.toLowerCase();
    if (!g.players.some(p => p.name.toLowerCase() === low)) continue;
    const achievements = Object.fromEntries(
      Object.entries(g.achievements || {}).map(([key, a]) =>
        [key, a?.player?.toLowerCase() === low ? { ...a, player: ACCOUNT_ME } : a]
      )
    );
    out.push({
      ...g,
      players: g.players.map(p => p.name.toLowerCase() === low ? { ...p, name: ACCOUNT_ME } : p),
      winners: (g.winners || []).map(w => w.toLowerCase() === low ? ACCOUNT_ME : w),
      scoreTimeline: (g.scoreTimeline || []).map(ev => ev.player?.toLowerCase() === low ? { ...ev, player: ACCOUNT_ME } : ev),
      achievements,
    });
  }
  return out;
}

export function calcAccountStats(games, realms, userId, expansions = []) {
  const accountGames = buildAccountGames(games, realms, userId);
  const stats = calcStats(accountGames, ACCOUNT_ME);
  const breakdown = calcBreakdown(accountGames, ACCOUNT_ME);
  const { meeple: favMeeple, count: favMeepleCount } = calcFavMeeple(accountGames, ACCOUNT_ME);

  const draws = accountGames.filter(g => g.winners.length > 1 && g.winners.includes(ACCOUNT_ME)).length;

  // Rival: opponent faced in the most games, aggregated by name across realms
  const rivalCounts = new Map(); // lowercase -> { name, count }
  for (const g of accountGames)
    for (const p of g.players) {
      if (p.name === ACCOUNT_ME) continue;
      const key = p.name.toLowerCase();
      const entry = rivalCounts.get(key) || { name: p.name, count: 0 };
      entry.count++;
      rivalCounts.set(key, entry);
    }
  const rival = [...rivalCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  let longestGame = null;
  for (const g of accountGames)
    if ((g.gameDuration || 0) > (longestGame?.duration || 0)) longestGame = { game: g, duration: g.gameDuration };

  // Earliest game date and lifetime time at the table
  let playingSince = null, totalPlaytime = 0;
  for (const g of accountGames) {
    if (g.date && (!playingSince || g.date < playingSince)) playingSince = g.date;
    totalPlaytime += g.gameDuration || 0;
  }

  // Biggest single scoring play from the timeline
  let biggestPlay = null;
  for (const g of accountGames)
    for (const ev of g.scoreTimeline)
      if (ev.player === ACCOUNT_ME && (ev.amount || 0) > (biggestPlay?.amount || 0))
        biggestPlay = { amount: ev.amount, type: ev.type, game: g };

  // Fastest win: shortest timed game I won
  let fastestWin = null;
  for (const g of accountGames)
    if (g.winners.includes(ACCOUNT_ME) && (g.gameDuration || 0) > 0 && (!fastestWin || g.gameDuration < fastestWin.duration))
      fastestWin = { game: g, duration: g.gameDuration };

  // Highest scoring game: biggest combined score across all players
  let highestCombined = null;
  for (const g of accountGames) {
    const combined = g.players.reduce((s, p) => s + p.score, 0);
    if (combined > (highestCombined?.points || 0)) highestCombined = { points: combined, game: g };
  }

  // Record tallies: how many times I held each best-in-game record, plus
  // sweeps — games with 2+ tracked records where I held every one
  const recordTallies = {};
  let sweeps = 0;
  for (const g of accountGames) {
    const held = Object.values(g.achievements || {}).filter(a => a?.player);
    for (const [key, a] of Object.entries(g.achievements || {}))
      if (a?.player === ACCOUNT_ME) recordTallies[key] = (recordTallies[key] || 0) + 1;
    if (held.length >= 2 && held.every(a => a.player === ACCOUNT_ME)) sweeps++;
  }

  // Favorite expansions, split full/mini like the per-realm group stats
  const EXP_TYPE = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.type]));
  const full = {}, mini = {};
  for (const g of accountGames)
    for (const exp of g.expansions || []) {
      if (EXP_TYPE[exp] === 'full') full[exp] = (full[exp] || 0) + 1;
      else if (EXP_TYPE[exp] === 'mini') mini[exp] = (mini[exp] || 0) + 1;
    }
  const topOf = counts => {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  };

  // Game references escape this module (Logbook links), so swap the sentinel-
  // renamed clones back for the original game objects.
  const originalById = new Map((games || []).map(g => [g.id, g]));
  const orig = g => (g && originalById.get(g.id)) || g;
  stats.highScoreGame = orig(stats.highScoreGame);
  stats.biggestBlowoutGame = orig(stats.biggestBlowoutGame);
  if (longestGame) longestGame.game = orig(longestGame.game);
  if (biggestPlay) biggestPlay.game = orig(biggestPlay.game);
  if (fastestWin) fastestWin.game = orig(fastestWin.game);
  if (highestCombined) highestCombined.game = orig(highestCombined.game);

  return {
    gamesCount: accountGames.length,
    realmsCount: accountNamesByRealm(realms, userId).size,
    stats,
    draws,
    breakdown,
    favMeeple,
    favMeepleCount,
    rival,
    longestGame,
    favExpansions: { full: topOf(full), mini: topOf(mini) },
    // FULL_EXPANSION_NAMES (not exp.type) so this always agrees with the
    // same full_expansions table the server-side rank computation uses.
    expansionsFullCount: expansions.filter(e => e.owned && FULL_EXPANSION_NAMES.has(e.name)).length,
    playingSince,
    totalPlaytime,
    biggestPlay,
    fastestWin,
    highestCombined,
    recordTallies,
    sweeps,
  };
}
