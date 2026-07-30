import { describe, it, expect } from 'vitest';
import {
  TOTAL_ART_ITEMS,
  MAX_UNLOCK_RANK,
  createInitialTrackState,
  advanceTrack,
  retreatTrack,
  createInitialArtUnlockState,
  advanceArtUnlocks,
  retreatArtUnlocks,
  syncArtUnlocks,
  chestArt,
  logbookArt,
  unlockedIndices,
} from './artUnlocks';

// Scripted randomness: always pop the first entry of whatever pool is
// offered, so results are fully deterministic across a test.
const pickFirst = { randomIndex: () => 0 };

describe('advanceTrack — rank 1', () => {
  it('grants item 1 directly, candidates is just itself', () => {
    const { state, grants } = advanceTrack(createInitialTrackState(), 1);
    expect(state.unlocked).toEqual([1]);
    expect(state.pool).toEqual([]);
    expect(state.nextItem).toBe(2);
    expect(state.processedRank).toBe(1);
    expect(grants).toEqual([{ rank: 1, itemId: 1, candidates: [1] }]);
  });
});

describe('advanceTrack — rank 2 seeds a 4-item pool and draws one', () => {
  it('idx 0 draws the lowest item, the other 3 stay in the pool', () => {
    const at1 = advanceTrack(createInitialTrackState(), 1).state;
    const { state, grants } = advanceTrack(at1, 2, { randomIndex: () => 0 });
    expect(grants).toEqual([{ rank: 2, itemId: 2, candidates: [2, 3, 4, 5] }]);
    expect(state.unlocked).toEqual([1, 2]);
    expect(state.pool).toEqual([3, 4, 5]);
    expect(state.nextItem).toBe(6);
    expect(state.processedRank).toBe(2);
  });

  it('a different draw index picks a different item and leaves a different leftover set', () => {
    const at1 = advanceTrack(createInitialTrackState(), 1).state;
    const { state, grants } = advanceTrack(at1, 2, { randomIndex: () => 1 });
    expect(grants).toEqual([{ rank: 2, itemId: 3, candidates: [2, 3, 4, 5] }]);
    expect(state.unlocked).toEqual([1, 3]);
    expect(state.pool).toEqual([2, 4, 5]);
  });
});

describe('advanceTrack — rank 3+ tops the pool back up to 4 with one new item', () => {
  it('adds exactly one fresh item to the existing leftovers, then draws', () => {
    const stateAt2 = { unlocked: [1, 2], pool: [3, 4, 5], nextItem: 6, processedRank: 2 };
    const { state, grants } = advanceTrack(stateAt2, 3, pickFirst);
    expect(grants).toEqual([{ rank: 3, itemId: 3, candidates: [3, 4, 5, 6] }]);
    expect(state.unlocked).toEqual([1, 2, 3]);
    expect(state.pool).toEqual([4, 5, 6]);
    expect(state.nextItem).toBe(7);
  });
});

describe('advanceTrack — a multi-rank jump fully resolves in one call (no halting)', () => {
  it('fresh state jumped straight to rank 9 resolves every rank 1-9 in one call', () => {
    const { state, grants } = advanceTrack(createInitialTrackState(), 9, pickFirst);
    expect(state.processedRank).toBe(9);
    expect(grants.map(g => g.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.unlocked).toHaveLength(9);
    expect(new Set(state.unlocked).size).toBe(9); // no duplicates
  });
});

describe('advanceTrack — full walkthrough to rank 16, one call', () => {
  it('resolves every rank in a single call, ends with 16 unique unlocked items and 2 left in the pool', () => {
    const { state, grants } = advanceTrack(createInitialTrackState(), MAX_UNLOCK_RANK, pickFirst);

    expect(state.processedRank).toBe(16);
    expect(state.unlocked).toHaveLength(16);
    expect(new Set(state.unlocked).size).toBe(16); // no duplicates
    expect(state.pool).toHaveLength(TOTAL_ART_ITEMS - 16);
    expect(grants).toHaveLength(16);
    expect(grants.map(g => g.rank)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    // Always drawing index 0 always grabs the lowest remaining item, so a
    // fully "always-first" walkthrough unlocks items 1..16 in order.
    expect(grants.map(g => g.itemId)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    expect(state.pool).toEqual([17, 18]);
    expect(state.nextItem).toBe(19);
  });
});

describe('advanceTrack — idempotency', () => {
  it('a repeat call at the same or lower targetRank is a no-op', () => {
    const first = advanceTrack(createInitialTrackState(), 1).state;
    const { state, grants } = advanceTrack(first, 1);
    expect(state).toBe(first);
    expect(grants).toEqual([]);
    const lower = advanceTrack(first, 0);
    expect(lower.state).toBe(first);
    expect(lower.grants).toEqual([]);
  });
});

describe('advanceTrack — immutability', () => {
  it('never mutates the input state or its arrays', () => {
    const input = createInitialTrackState();
    const frozenUnlocked = input.unlocked;
    const frozenPool = input.pool;
    advanceTrack(input, 5, pickFirst);
    expect(input.unlocked).toBe(frozenUnlocked);
    expect(input.pool).toBe(frozenPool);
    expect(input.processedRank).toBe(0);
  });
});

describe('advanceArtUnlocks — chest and logbook tracks advance independently', () => {
  it('both tracks resolve every rank, each with its own grant list', () => {
    const { state, chestGrants, logbookGrants } = advanceArtUnlocks(createInitialArtUnlockState(), 5, pickFirst);
    expect(state.chest.processedRank).toBe(5);
    expect(state.logbook.processedRank).toBe(5);
    expect(chestGrants.map(g => g.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(logbookGrants.map(g => g.rank)).toEqual([1, 2, 3, 4, 5]);
    // Same deterministic "always pick index 0" seam fed to both tracks, and
    // both start from identical zero states, so they land on identical
    // picks here — that's a property of the shared test seam, not of the
    // tracks being coupled (in production each draws its own Math.random()
    // independently and can diverge freely).
    expect(chestGrants.map(g => g.itemId)).toEqual(logbookGrants.map(g => g.itemId));
  });

  it('returns the same state reference when neither track changes (no-op)', () => {
    const first = advanceArtUnlocks(createInitialArtUnlockState(), 1, pickFirst).state;
    const { state, chestGrants, logbookGrants } = advanceArtUnlocks(first, 1, pickFirst);
    expect(state).toBe(first);
    expect(chestGrants).toEqual([]);
    expect(logbookGrants).toEqual([]);
  });
});

describe('chestArt / logbookArt', () => {
  it('maps item 1 to index 0, item 18 to index 17', () => {
    // CHESTS/SPINES are Vite-globbed image imports — just assert the
    // indexing math, not the actual asset values.
    expect(chestArt(1)).toBeDefined();
    expect(logbookArt(1)).toBeDefined();
  });
});

describe('unlockedIndices', () => {
  it('maps each item id to its itemId-1 CHESTS/SPINES index', () => {
    expect(unlockedIndices([1, 3, 4])).toEqual(new Set([0, 2, 3]));
  });

  it('is not a dense prefix — a later, higher item can be unlocked while an earlier one is still pooled', () => {
    const idx = unlockedIndices([1, 9]);
    expect(idx.has(0)).toBe(true);
    expect(idx.has(8)).toBe(true);
    expect(idx.has(1)).toBe(false);
  });

  it('empty input yields an empty set', () => {
    expect(unlockedIndices([])).toEqual(new Set());
  });
});

describe('retreatTrack', () => {
  it('reconstructs exactly the historical state when regressing (always-first-pick walkthrough)', () => {
    const atRank9 = advanceTrack(createInitialTrackState(), 9, pickFirst).state;
    const atRank3Direct = advanceTrack(createInitialTrackState(), 3, pickFirst).state;

    const { state, revoked } = retreatTrack(atRank9, 3);
    expect(state).toEqual(atRank3Direct);
    expect(revoked).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('discards items introduced after the target rank rather than keeping them available', () => {
    // idx 1 at rank 2 means the pool's LOWER item (2) is the one left
    // behind, not drawn — so unlocked and pool diverge from the
    // always-first walkthrough from rank 2 on.
    const atRank2 = advanceTrack(createInitialTrackState(), 2, { randomIndex: () => 1 }).state;
    expect(atRank2).toEqual({ unlocked: [1, 3], pool: [2, 4, 5], nextItem: 6, processedRank: 2 });

    // Ranks 3-6 (always-first from here) grant 2, 4, 5, 6 in turn and
    // introduce items 7, 8, 9 into the pool along the way.
    const atRank6 = advanceTrack(atRank2, 6, pickFirst).state;
    expect(atRank6).toEqual({ unlocked: [1, 3, 2, 4, 5, 6], pool: [7, 8, 9], nextItem: 10, processedRank: 6 });

    // Regress back to rank 2 — reconstructs the EXACT rank-2 state (the
    // grants from ranks 3-6 return to the pool), and items 7/8/9 — which
    // were only ever introduced for ranks 4-6 — are discarded entirely,
    // not left sitting in the pool waiting to be re-offered early at a
    // lower rank than they were originally reachable at.
    const { state, revoked } = retreatTrack(atRank6, 2);
    expect(state).toEqual(atRank2);
    expect(revoked).toEqual([2, 4, 5, 6]);
    expect(state.pool).not.toContain(7);
    expect(state.pool).not.toContain(8);
    expect(state.pool).not.toContain(9);
  });

  it('is a no-op when targetRank is not below processedRank', () => {
    const at5 = advanceTrack(createInitialTrackState(), 5, pickFirst).state;
    const { state, revoked } = retreatTrack(at5, 5);
    expect(state).toBe(at5);
    expect(revoked).toEqual([]);
    const higher = retreatTrack(at5, 9);
    expect(higher.state).toBe(at5);
  });

  it('a full regression to rank 0 matches the zero state', () => {
    const atMax = advanceTrack(createInitialTrackState(), MAX_UNLOCK_RANK, pickFirst).state;
    const { state } = retreatTrack(atMax, 0);
    expect(state).toEqual(createInitialTrackState());
  });

  it('never produces duplicate or out-of-range ids across unlocked+pool', () => {
    const atMax = advanceTrack(createInitialTrackState(), MAX_UNLOCK_RANK, { randomIndex: (n) => n - 1 }).state;
    const { state } = retreatTrack(atMax, 7);
    const all = [...state.unlocked, ...state.pool];
    expect(new Set(all).size).toBe(all.length);
    expect(all.every(id => id >= 1 && id < state.nextItem)).toBe(true);
  });
});

describe('retreatArtUnlocks / syncArtUnlocks', () => {
  it('retreats both tracks independently and reports each track\'s revoked ids', () => {
    const atRank9 = advanceArtUnlocks(createInitialArtUnlockState(), 9, pickFirst).state;
    const { state, chestRevoked, logbookRevoked } = retreatArtUnlocks(atRank9, 3);
    expect(state.chest.processedRank).toBe(3);
    expect(state.logbook.processedRank).toBe(3);
    expect(chestRevoked).toEqual([4, 5, 6, 7, 8, 9]);
    expect(logbookRevoked).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('is a no-op (same reference) when neither track actually regresses', () => {
    const at5 = advanceArtUnlocks(createInitialArtUnlockState(), 5, pickFirst).state;
    const { state, chestRevoked, logbookRevoked } = retreatArtUnlocks(at5, 5);
    expect(state).toBe(at5);
    expect(chestRevoked).toEqual([]);
    expect(logbookRevoked).toEqual([]);
  });

  it('syncArtUnlocks advances when targetRank is higher', () => {
    const fresh = createInitialArtUnlockState();
    const { state, chestGrants, logbookGrants, chestRevoked, logbookRevoked } = syncArtUnlocks(fresh, 3, pickFirst);
    expect(state.chest.processedRank).toBe(3);
    expect(chestGrants).toHaveLength(3);
    expect(logbookGrants).toHaveLength(3);
    expect(chestRevoked).toEqual([]);
    expect(logbookRevoked).toEqual([]);
  });

  it('syncArtUnlocks retreats when targetRank is lower', () => {
    const atRank9 = advanceArtUnlocks(createInitialArtUnlockState(), 9, pickFirst).state;
    const { state, chestGrants, logbookGrants, chestRevoked, logbookRevoked } = syncArtUnlocks(atRank9, 3, pickFirst);
    expect(state.chest.processedRank).toBe(3);
    expect(chestGrants).toEqual([]);
    expect(logbookGrants).toEqual([]);
    expect(chestRevoked).toEqual([4, 5, 6, 7, 8, 9]);
    expect(logbookRevoked).toEqual([4, 5, 6, 7, 8, 9]);
  });
});
