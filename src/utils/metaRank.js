// Account meta-rank: a 16-step ladder climbed by unlocking milestone tiers
// across every category (see data/accountMilestones.js). Standalone so other
// parts of the app can reuse the rank math outside the Profile carousel.

import { ACCOUNT_MILESTONES, accountMilestoneProgress, categoryTierState, tierStateForProgress } from '../data/accountMilestones';
import { CHESTS, chestUnlockRank } from '../data/chests';
import { SPINES, spineUnlockRank } from '../data/spines';

export const RANK_TITLES = [
  'Wanderer', 'Pioneer', 'Settler', 'Reeve', 'Steward', 'Magistrate',
  'Castellan', 'Baron', 'Count', 'Duke', 'Champion', 'Exemplar',
  'Ascendant', 'Paragon', 'Realmkeeper', 'Legend',
]; // index = rank - 1

// Mutable, not a const — applyMaxRank() replaces this once the authoritative
// migrations/milestone_config.sql app_config.max_rank value is fetched (see
// data/storage.js getMaxRankConfig), so this can never silently disagree
// with the server-side rank formula in compute_account_progress. Falls back
// to RANK_TITLES.length (today's value) until that fetch resolves or if it
// fails — callers use getMaxRank(), never a bare constant.
let _maxRank = RANK_TITLES.length;

export function getMaxRank() {
  return _maxRank;
}

export function applyMaxRank(n) {
  if (Number.isInteger(n) && n > 0) _maxRank = n;
}

// Total tiers across every category — grows as categories/tiers are added,
// so it's derived live from ACCOUNT_MILESTONES on every call rather than
// cached once, since applyMilestoneConfig (data/accountMilestones.js) can
// replace that array's contents after this module has already loaded.
export function getTotalTiers() {
  return ACCOUNT_MILESTONES.reduce((sum, c) => sum + c.tiers.length, 0);
}

// Tiers needed to hold a given rank: normalizes rank onto a 0..1 progress
// scale — (rank-1)/(maxRank-1), so rank 1 sits at exactly 0 and maxRank
// sits at exactly 1 — then bends that scale with a ^1.5 curve (later ranks
// need disproportionately more) before scaling by (totalTiers-1) and adding
// 1 back. That +1 (paired with the -1 above) guarantees rank 2's own
// requirement is always at least 1 no matter how small totalTiers is —
// without it, a small enough totalTiers could round rank 2's requirement
// down to 0, making it "free" alongside rank 1's unconditional floor — while
// still landing maxRank exactly on totalTiers with no leftover rounding
// slack. Shaped this way (rather than just totalTiers*progress^x) so
// totalTiers can keep changing as categories/tiers are added later without
// ever reopening this "rank 2 is free" edge case.
export function tiersRequiredForRank(rank, totalTiers = getTotalTiers()) {
  const maxRank = getMaxRank();
  const progress = (rank - 1) / (maxRank - 1);
  return Math.round((totalTiers - 1) * Math.pow(progress, 1.5)) + 1;
}

// How many tier thresholds the account has met across ALL categories
// (a category not yet started contributes 0)
export function countUnlockedTiers(account) {
  return ACCOUNT_MILESTONES.reduce((sum, category) => {
    const progress = accountMilestoneProgress(category, account);
    return sum + category.tiers.filter((t) => progress >= t.threshold).length;
  }, 0);
}

// Highest rank whose tier requirement is met. Rank 1 (Wanderer) is the floor —
// it applies even with 0 tiers unlocked.
export function getCurrentRank(tierCount, totalTiers = getTotalTiers()) {
  const maxRank = getMaxRank();
  for (let rank = maxRank; rank >= 2; rank--) {
    if (tierCount >= tiersRequiredForRank(rank, totalTiers)) return rank;
  }
  return 1;
}

export function rankTitle(rank) {
  return RANK_TITLES[Math.min(Math.max(rank, 1), getMaxRank()) - 1];
}

// Per-category snapshot ({ [categoryId]: { progress, tierNumber } }) from a
// LIVE calcAccountStats() account object — used by Profile.jsx's own display
// (never sent to the server anymore; user_progress.category_progress is
// computed server-side, see migrations/server_side_progress.sql).
export function buildCategoryProgress(account) {
  const out = {};
  for (const category of ACCOUNT_MILESTONES) {
    const state = categoryTierState(category, account);
    out[category.id] = { progress: state.progress, tierNumber: state.currentTierNumber };
  }
  return out;
}

// Before/after diff for the RankUpModal celebration: which categories
// crossed a new tier — tierNameChain lists EVERY tier name crossed in
// order (not just the endpoints), so a category that jumps two tiers in one
// update (e.g. skipping straight from tier 0 to tier 2) still scrolls
// through the skipped tier's name instead of it never being shown at all —
// same idea as the rank reel already showing every rank crossed, not just
// the endpoints. Also plus before/after bar data for each (for the
// fill-to-100%-then-settle animation) and which chest/logbook art newly
// unlocked in the given rank range. Only fires alongside a rank-up (see
// App.jsx's gating), so every included category is one that actually earned
// a tier this update — nothing here is "just progress, no crossing." Pure —
// both the live-controller path and the deferred/other-device path
// (App.jsx) feed it whatever before/after values they have (locally computed
// or read back from user_progress).
export function buildRankUpDiff({ beforeCategoryProgress, afterCategoryProgress, beforeRank, afterRank }) {
  const categoryDiffs = ACCOUNT_MILESTONES
    .map(cat => {
      const beforeTierNum = beforeCategoryProgress?.[cat.id]?.tierNumber ?? 0;
      const afterTierNum = afterCategoryProgress?.[cat.id]?.tierNumber ?? 0;
      if (afterTierNum <= beforeTierNum) return null; // only categories that newly earned a tier

      const beforeProgress = beforeCategoryProgress?.[cat.id]?.progress ?? 0;
      const afterProgress = afterCategoryProgress?.[cat.id]?.progress ?? 0;
      const beforeTierName = cat.tiers.find(t => t.tierNumber === beforeTierNum)?.name ?? null;
      const afterTierName = cat.tiers.find(t => t.tierNumber === afterTierNum)?.name ?? null;
      // Every tier name from beforeTierNum through afterTierNum, in order —
      // tier 0 (not yet started) has no name, represented as null.
      const tierNameChain = [];
      for (let t = beforeTierNum; t <= afterTierNum; t++) {
        tierNameChain.push(t === 0 ? null : cat.tiers.find(tt => tt.tierNumber === t)?.name ?? null);
      }

      // Stage-1 (tier-completion) bar data: notches shown before the
      // fill-to-100% animation reflect whatever was ALREADY unlocked going
      // into this update — derived from beforeProgress via
      // tierStateForProgress, not from tier-number arithmetic, so a
      // multi-tier jump in a single update still gets the correct
      // pre-crossing notch set.
      const crossedTier = cat.tiers.find(t => t.tierNumber === afterTierNum);
      const beforeBar = tierStateForProgress(cat, beforeProgress);
      const afterBar = tierStateForProgress(cat, afterProgress);
      return {
        category: cat,
        beforeTierName,
        afterTierName,
        tierNameChain,
        beforeBar,
        afterBar,
        crossedTier,
        beforeReached: beforeBar.reached,
        beforePctOfCrossed: Math.min(100, (beforeProgress / crossedTier.threshold) * 100),
      };
    })
    .filter(Boolean);

  const newChests = CHESTS
    .map((img, i) => ({ img, unlockRank: chestUnlockRank(i) }))
    .filter(c => c.unlockRank > beforeRank && c.unlockRank <= afterRank);
  const newSpines = SPINES
    .map((img, i) => ({ img, unlockRank: spineUnlockRank(i) }))
    .filter(s => s.unlockRank > beforeRank && s.unlockRank <= afterRank);

  // Grouped by the rank they unlocked at — crossing several ranks in one
  // celebration (e.g. a big multi-tier jump) unlocks a chest/logbook per
  // rank crossed, so without grouping they'd render as two flat, unrelated
  // rows of art. One rank's chest+logbook are the "set" for that rank, so
  // they're paired here and share that rank's title as a single label,
  // rather than each rendering its own generic "New chest/logbook" caption.
  const artRanks = [...new Set([...newChests, ...newSpines].map(a => a.unlockRank))].sort((a, b) => a - b);
  const newArtPairs = artRanks.map(rank => ({
    rank,
    name: rankTitle(rank),
    chests: newChests.filter(c => c.unlockRank === rank),
    spines: newSpines.filter(s => s.unlockRank === rank),
  }));

  return { categoryDiffs, newChests, newSpines, newArtPairs };
}

// Guest fallback: no auth user_metadata to write to, so the highest rank
// achieved lives in localStorage (same approach as the guest board state).
const GUEST_RANK_KEY = 'carcassonne_guest_meta_rank';

export function getGuestMetaRank() {
  try {
    return parseInt(localStorage.getItem(GUEST_RANK_KEY), 10) || 0;
  } catch {
    return 0;
  }
}

export function setGuestMetaRank(rank) {
  try {
    localStorage.setItem(GUEST_RANK_KEY, String(rank));
  } catch {
    // localStorage unavailable — rank just won't persist this session
  }
}
