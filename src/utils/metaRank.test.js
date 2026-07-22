import { describe, it, expect } from 'vitest';
import {
  TOTAL_TIERS,
  MAX_RANK,
  tiersRequiredForRank,
  getCurrentRank,
  rankTitle,
  countUnlockedTiers,
} from './metaRank';

describe('TOTAL_TIERS', () => {
  it('is derived from the config (13 categories × 4 tiers today)', () => {
    expect(TOTAL_TIERS).toBe(52);
  });
});

describe('tiersRequiredForRank', () => {
  it('matches ceil((rank/20)^1.5 * total) spot checks at total=33', () => {
    expect(tiersRequiredForRank(1, 33)).toBe(1);
    expect(tiersRequiredForRank(5, 33)).toBe(5);
    expect(tiersRequiredForRank(9, 33)).toBe(10);
    expect(tiersRequiredForRank(10, 33)).toBe(12);
    expect(tiersRequiredForRank(19, 33)).toBe(31);
    expect(tiersRequiredForRank(20, 33)).toBe(33);
  });

  it('scales with totalTiersInSystem', () => {
    expect(tiersRequiredForRank(20, 66)).toBe(66);
    expect(tiersRequiredForRank(10, 66)).toBe(24);
  });
});

describe('getCurrentRank', () => {
  it('returns rank 1 (Wanderer) at 0 tiers unlocked', () => {
    expect(getCurrentRank(0, 33)).toBe(1);
    expect(rankTitle(1)).toBe('Wanderer');
  });

  it('returns max rank with every tier unlocked', () => {
    expect(getCurrentRank(33, 33)).toBe(MAX_RANK);
    expect(rankTitle(MAX_RANK)).toBe('Master of Carcassonne');
  });

  it('holds a rank until the next requirement is met', () => {
    // rank 9 needs 10 tiers, rank 10 needs 12
    expect(getCurrentRank(10, 33)).toBe(9);
    expect(getCurrentRank(11, 33)).toBe(9);
    expect(getCurrentRank(12, 33)).toBe(10);
    // rank 19 needs 31, rank 20 needs 33
    expect(getCurrentRank(32, 33)).toBe(19);
  });

  it('handles the low end of the ladder', () => {
    expect(getCurrentRank(1, 33)).toBe(1);
    // ranks 2 and 3 both require 2 tiers — ties resolve to the higher rank
    expect(getCurrentRank(2, 33)).toBe(3);
  });

  it('never exceeds MAX_RANK even with excess tiers', () => {
    expect(getCurrentRank(1000, 33)).toBe(MAX_RANK);
  });
});

describe('countUnlockedTiers', () => {
  it('sums tiers reached across categories', () => {
    // games 150 → tier 2 (1, 100); city 26000 → tier 4 (all thresholds met)
    const account = { gamesCount: 150, breakdown: { city: 26000 }, stats: { wins: 0 }, expansionsFullCount: 0 };
    expect(countUnlockedTiers(account)).toBe(6);
  });

  it('is 0 for a fresh account', () => {
    expect(countUnlockedTiers({ gamesCount: 0, breakdown: {}, stats: { wins: 0 }, expansionsFullCount: 0 })).toBe(0);
  });
});
