import { describe, it, expect } from 'vitest';
import {
  getTotalTiers,
  getMaxRank,
  tiersRequiredForRank,
  getCurrentRank,
  rankTitle,
  countUnlockedTiers,
  buildRankUpDiff,
} from './metaRank';

describe('getTotalTiers', () => {
  it('is derived from the config (12 categories × 4 tiers today)', () => {
    expect(getTotalTiers()).toBe(48);
  });
});

describe('tiersRequiredForRank', () => {
  it('matches round((total-1) * ((rank-1)/(maxRank-1))^1.5) + 1 spot checks at total=33', () => {
    expect(tiersRequiredForRank(1, 33)).toBe(1);
    expect(tiersRequiredForRank(5, 33)).toBe(5);
    expect(tiersRequiredForRank(9, 33)).toBe(13);
    expect(tiersRequiredForRank(10, 33)).toBe(16);
    expect(tiersRequiredForRank(15, 33)).toBe(30);
    expect(tiersRequiredForRank(16, 33)).toBe(33);
  });

  it('scales with totalTiersInSystem', () => {
    expect(tiersRequiredForRank(16, 66)).toBe(66);
    expect(tiersRequiredForRank(10, 66)).toBe(31);
  });
});

describe('getCurrentRank', () => {
  it('returns rank 1 (Wanderer) at 0 tiers unlocked', () => {
    expect(getCurrentRank(0, 33)).toBe(1);
    expect(rankTitle(1)).toBe('Wanderer');
  });

  it('returns max rank with every tier unlocked', () => {
    expect(getCurrentRank(33, 33)).toBe(getMaxRank());
    expect(rankTitle(getMaxRank())).toBe('Legend');
  });

  it('holds a rank until the next requirement is met', () => {
    // rank 9 needs 13 tiers, rank 10 needs 16
    expect(getCurrentRank(13, 33)).toBe(9);
    expect(getCurrentRank(15, 33)).toBe(9);
    expect(getCurrentRank(16, 33)).toBe(10);
    // rank 15 needs 30, rank 16 (max) needs 33
    expect(getCurrentRank(32, 33)).toBe(15);
  });

  it('handles the low end of the ladder', () => {
    expect(getCurrentRank(1, 33)).toBe(1);
    // rank 2 needs 2 tiers, rank 3 needs 3 — no tie at this total
    expect(getCurrentRank(2, 33)).toBe(2);
  });

  it('never exceeds getMaxRank() even with excess tiers', () => {
    expect(getCurrentRank(1000, 33)).toBe(getMaxRank());
  });
});

describe('countUnlockedTiers', () => {
  it('sums tiers reached across categories', () => {
    // games 150 → tier 2 (1, 100); city 26000 → tier 4 (all thresholds met)
    const account = { gamesCount: 150, breakdown: { city: 26000 }, stats: { wins: 0 } };
    expect(countUnlockedTiers(account)).toBe(6);
  });

  it('is 0 for a fresh account', () => {
    expect(countUnlockedTiers({ gamesCount: 0, breakdown: {}, stats: { wins: 0 } })).toBe(0);
  });
});

describe('buildRankUpDiff', () => {
  it('includes a crossed category with before/after bar data', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: { city: { progress: 50, tierNumber: 0 } },
      afterCategoryProgress: { city: { progress: 150, tierNumber: 1 } },
      beforeRank: 1,
      afterRank: 1,
    });
    const city = categoryDiffs.find(d => d.category.id === 'city');
    expect(city.beforeTierName).toBe(null);
    expect(city.afterTierName).toBe('Camp');
    expect(city.tierNameChain).toEqual([null, 'Camp']);
    expect(city.crossedTier.threshold).toBe(100);
    expect(city.beforeReached).toEqual([]);
    expect(city.beforePctOfCrossed).toBe(50); // 50/100 threshold
    expect(city.afterBar.pct).toBe(15); // 150/1000 (next tier, Town)
    expect(city.afterBar.axisMax).toBe(1000);
    expect(city.afterBar.reached.map(t => t.tierNumber)).toEqual([1]);
  });

  it('lists every tier crossed in order when a category jumps multiple tiers at once', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: { city: { progress: 50, tierNumber: 0 } },
      afterCategoryProgress: { city: { progress: 5000, tierNumber: 2 } },
      beforeRank: 1,
      afterRank: 1,
    });
    const city = categoryDiffs.find(d => d.category.id === 'city');
    // tier 0 (not started) -> tier 1 (Camp) -> tier 2 (Town), not just the endpoints
    expect(city.tierNameChain).toEqual([null, 'Camp', 'Town']);
  });

  it('omits a category that only moved progress, no tier crossed', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: { monastery: { progress: 10, tierNumber: 0 } },
      afterCategoryProgress: { monastery: { progress: 30, tierNumber: 0 } },
      beforeRank: 1,
      afterRank: 1,
    });
    expect(categoryDiffs.find(d => d.category.id === 'monastery')).toBeUndefined();
  });

  it('handles a first-ever celebration with no prior snapshot', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: {},
      afterCategoryProgress: { games: { progress: 15, tierNumber: 1 } },
      beforeRank: 1,
      afterRank: 1,
    });
    const games = categoryDiffs.find(d => d.category.id === 'games');
    expect(games.beforeTierName).toBe(null);
    expect(games.afterTierName).toBe('Folding Table');
    expect(games.beforePctOfCrossed).toBe(0);
  });

  it('reflects a maxed-out category (pct clamped to 100)', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: { wins: { progress: 300, tierNumber: 3 } },
      afterCategoryProgress: { wins: { progress: 600, tierNumber: 4 } },
      beforeRank: 1,
      afterRank: 1,
    });
    const wins = categoryDiffs.find(d => d.category.id === 'wins');
    expect(wins.afterBar.maxed).toBe(true);
    expect(wins.afterBar.pct).toBe(100);
    expect(wins.afterBar.axisMax).toBe(500); // last tier's threshold
  });

  it('omits categories with zero after-progress', () => {
    const { categoryDiffs } = buildRankUpDiff({
      beforeCategoryProgress: {},
      afterCategoryProgress: { road: { progress: 0, tierNumber: 0 } },
      beforeRank: 1,
      afterRank: 1,
    });
    expect(categoryDiffs.find(d => d.category.id === 'road')).toBeUndefined();
  });
});
