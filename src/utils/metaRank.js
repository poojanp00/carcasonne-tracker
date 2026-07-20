// Account meta-rank: a 20-step ladder climbed by unlocking milestone tiers
// across every category (see data/accountMilestones.js). Standalone so other
// parts of the app can reuse the rank math outside the Profile carousel.

import { ACCOUNT_MILESTONES, accountMilestoneProgress } from '../data/accountMilestones';

export const RANK_TITLES = [
  'Wanderer', 'Pioneer', 'Settler', 'Founder', 'Villager', 'Steward', 'Reeve',
  'Magistrate', 'Castellan', 'Baron', 'Count', 'Duke', 'Lord', 'Prince',
  'Sovereign', 'High Sovereign', 'Realmkeeper', 'Grand Castellan',
  'Keeper of the Realm', 'Master of Carcassonne',
]; // index = rank - 1

export const MAX_RANK = RANK_TITLES.length;

// Total tiers across every category — grows as categories/tiers are added,
// so it must always be derived from the config.
export const TOTAL_TIERS = ACCOUNT_MILESTONES.reduce((sum, c) => sum + c.tiers.length, 0);

// Tiers needed to hold a given rank: ceil((rank/20)^1.5 * totalTiers)
export function tiersRequiredForRank(rank, totalTiers = TOTAL_TIERS) {
  return Math.ceil(Math.pow(rank / MAX_RANK, 1.5) * totalTiers);
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
export function getCurrentRank(tierCount, totalTiers = TOTAL_TIERS) {
  for (let rank = MAX_RANK; rank >= 2; rank--) {
    if (tierCount >= tiersRequiredForRank(rank, totalTiers)) return rank;
  }
  return 1;
}

export function rankTitle(rank) {
  return RANK_TITLES[Math.min(Math.max(rank, 1), MAX_RANK) - 1];
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
