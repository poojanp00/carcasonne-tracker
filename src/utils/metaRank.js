// Account meta-rank: a 20-step ladder climbed by unlocking milestone tiers
// across every category (see data/accountMilestones.js). Standalone so other
// parts of the app can reuse the rank math outside the Profile carousel.

import { ACCOUNT_MILESTONES, accountMilestoneProgress, categoryTierState } from '../data/accountMilestones';
import { CHESTS, chestUnlockRank } from '../data/chests';
import { SPINES, spineUnlockRank } from '../data/spines';

export const RANK_TITLES = [
  'Wanderer', 'Pioneer', 'Settler', 'Founder', 'Villager', 'Steward', 'Reeve',
  'Magistrate', 'Castellan', 'Baron', 'Count', 'Duke', 'Lord', 'Prince',
  'Sovereign', 'High Sovereign', 'Realmkeeper', 'Grand Castellan',
  'Keeper of the Realm', 'Master of Carcassonne',
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

// Tiers needed to hold a given rank: ceil((rank/maxRank)^1.5 * totalTiers)
export function tiersRequiredForRank(rank, totalTiers = getTotalTiers()) {
  return Math.ceil(Math.pow(rank / getMaxRank(), 1.5) * totalTiers);
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
// crossed a new tier (endpoints only — initial tier name -> new tier name,
// not every tier crossed in between), and which chest/logbook art newly
// unlocked in the given rank range. Pure — both the live-controller path and
// the deferred/other-device path (App.jsx) feed it whatever before/after
// values they have (locally computed or read back from user_progress).
export function buildRankUpDiff({ beforeCategoryProgress, afterCategoryProgress, beforeRank, afterRank }) {
  const categoryDiffs = ACCOUNT_MILESTONES
    .map(cat => {
      const beforeTierNum = beforeCategoryProgress?.[cat.id]?.tierNumber ?? 0;
      const afterTierNum = afterCategoryProgress?.[cat.id]?.tierNumber ?? 0;
      if (afterTierNum <= beforeTierNum) return null;
      const beforeTierName = cat.tiers.find(t => t.tierNumber === beforeTierNum)?.name ?? null;
      const afterTierName = cat.tiers.find(t => t.tierNumber === afterTierNum)?.name;
      return { category: cat, beforeTierName, afterTierName };
    })
    .filter(Boolean);

  const newChests = CHESTS
    .map((img, i) => ({ img, unlockRank: chestUnlockRank(i) }))
    .filter(c => c.unlockRank > beforeRank && c.unlockRank <= afterRank);
  const newSpines = SPINES
    .map((img, i) => ({ img, unlockRank: spineUnlockRank(i) }))
    .filter(s => s.unlockRank > beforeRank && s.unlockRank <= afterRank);

  return { categoryDiffs, newChests, newSpines };
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
