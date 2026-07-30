// Chest/logbook unlocks: two fully independent tracks (chest, logbook),
// each granting one item per rank via a simple rolling grab-bag. No
// per-rank special-casing (no fixed pairs, no binary choices, no reserved
// "special" rank) — deliberately as simple as this can be:
//   Rank 1:  grants item 1 directly.
//   Rank 2:  seeds a pool with the next 4 unclaimed items, draws one at
//            random; the other 3 stay in the pool.
//   Rank 3+: tops the pool back up to 4 with exactly one more unclaimed
//            item (skipped once the catalog's exhausted), then draws one.
// Chest and logbook draw independently — a chest winner and a logbook
// winner for the same rank can land on completely different items; they're
// no longer coupled into "pairs" at all. Rank regression (a deleted
// realm/game lowering milestone progress) is handled too — see
// retreatTrack/syncArtUnlocks below — by reversing grants back into the
// pool rather than leaving them stuck (a one-way ratchet). Pure
// state-machine only — no I/O here, see data/storage.js for persistence.

import { CHESTS } from '../data/chests';
import { SPINES } from '../data/spines';

export const TOTAL_ART_ITEMS = 18;
export const MAX_UNLOCK_RANK = 16;

// Hardcoded, not derived from CHESTS.length/SPINES.length — see the
// dev-time guard below, which exists to surface drift loudly instead of
// silently mis-granting items if the art catalogs ever change size.
if (import.meta.env?.DEV) {
  if (CHESTS.length !== TOTAL_ART_ITEMS || SPINES.length !== TOTAL_ART_ITEMS) {
    // eslint-disable-next-line no-console
    console.warn(
      `artUnlocks: TOTAL_ART_ITEMS (${TOTAL_ART_ITEMS}) no longer matches CHESTS.length (${CHESTS.length}) / SPINES.length (${SPINES.length}) — the unlock schedule needs a manual update.`
    );
  }
}

// Default randomness seam — tests inject their own randomIndex instead of
// mocking Math.random, so exact draws can be scripted deterministically.
function defaultRandomIndex(poolLength) {
  return Math.floor(Math.random() * poolLength);
}

// One track's (chest's, or logbook's) zero state.
export function createInitialTrackState() {
  return { unlocked: [], pool: [], nextItem: 1, processedRank: 0 };
}

// Advances a single track from state.processedRank+1 up through targetRank
// (inclusive). Pure — never mutates the input state or its arrays. Every
// rank resolves immediately (nothing waits on external input), so a single
// call always reaches targetRank in one pass — a no-op (returns the input
// unchanged) only when targetRank <= processedRank.
//
// Each grant records `candidates` — every item id that was "in the draw"
// for that rank (just [itemId] itself for the fixed rank-1 grant, or the
// pool snapshot at draw time otherwise) — purely for the UI's flip-through
// reveal animation; the actual result is already decided by the time it's
// returned.
//
// A lower targetRank than state.processedRank is a no-op here — advancing
// never un-grants anything. Rank regression is handled separately, see
// retreatTrack below.
export function advanceTrack(state, targetRank, { randomIndex = defaultRandomIndex } = {}) {
  const clampedTarget = Math.max(0, Math.min(MAX_UNLOCK_RANK, targetRank));
  if (clampedTarget <= state.processedRank) return { state, grants: [] };

  let unlocked = state.unlocked;
  let pool = state.pool;
  let nextItem = state.nextItem;
  let processedRank = state.processedRank;
  const grants = [];

  for (let rank = state.processedRank + 1; rank <= clampedTarget; rank++) {
    if (rank === 1) {
      unlocked = [...unlocked, nextItem];
      grants.push({ rank, itemId: nextItem, candidates: [nextItem] });
      nextItem += 1;
      processedRank = 1;
      continue;
    }

    // Rank 2 seeds from scratch (4 fresh items, nothing carried over yet);
    // every rank after that just tops the existing pool back up to 4 with
    // one more, until the catalog runs out.
    const seedCount = rank === 2 ? 4 : 1;
    const fresh = [];
    while (fresh.length < seedCount && nextItem <= TOTAL_ART_ITEMS) {
      fresh.push(nextItem);
      nextItem += 1;
    }
    pool = [...pool, ...fresh];

    if (pool.length === 0) { processedRank = rank; continue; } // catalog exhausted, nothing left to grant

    const candidates = pool;
    const idx = randomIndex(pool.length);
    const itemId = pool[idx];
    pool = pool.filter((_, i) => i !== idx);
    unlocked = [...unlocked, itemId];
    processedRank = rank;
    grants.push({ rank, itemId, candidates });
  }

  return { state: { unlocked, pool, nextItem, processedRank }, grants };
}

// The zero state for both tracks together — what a brand-new account (or
// one with no persisted row yet) starts from.
export function createInitialArtUnlockState() {
  return { chest: createInitialTrackState(), logbook: createInitialTrackState() };
}

// Advances both tracks to targetRank in one call. Independent random draws
// per track (chest and logbook can land on different items for the same
// rank) — returns the SAME state reference when neither track actually
// changed, matching advanceTrack's own no-op contract, so callers can keep
// using reference equality to decide whether a save is needed.
export function advanceArtUnlocks(state, targetRank, opts) {
  const { state: chest, grants: chestGrants } = advanceTrack(state.chest, targetRank, opts);
  const { state: logbook, grants: logbookGrants } = advanceTrack(state.logbook, targetRank, opts);
  const changed = chest !== state.chest || logbook !== state.logbook;
  return { state: changed ? { chest, logbook } : state, chestGrants, logbookGrants };
}

// What nextItem SHOULD be after processedRank ranks have been advanced with
// no exhaustion surprises — rank 1 introduces item 1, rank 2 seeds 4 more,
// every rank after that introduces exactly 1 more, until the catalog runs
// out. Because advanceTrack always draws exactly one winner per rank and
// leaves the rest in the pool, this is a PURE function of processedRank
// alone — it doesn't matter which items were actually drawn along the way,
// only how many ranks' worth of items have been introduced. That's what
// makes retreatTrack below possible without needing to have recorded any
// history: "what should exist at an earlier rank" can always be
// recomputed from scratch.
function nextItemAtRank(rank) {
  if (rank <= 0) return 1;
  if (rank === 1) return 2;
  return Math.min(rank + 4, TOTAL_ART_ITEMS + 1);
}

// Reverses a track back down to targetRank — the inverse of advanceTrack,
// for when account rank regresses (a deleted realm/game lowering milestone
// progress). Fully deterministic, no randomness involved: every item
// introduced at or before targetRank goes back into circulation — either
// it's one of the targetRank grants being kept, or it returns to the pool
// (whether it was already sitting there, or it's a revoked grant being
// returned). Every item introduced AFTER targetRank is discarded outright,
// not stashed anywhere — it only re-enters circulation once rank naturally
// climbs that high again, via a fresh (possibly different) draw, not a
// replay of what happened before.
//
// A no-op (returns the input unchanged) when targetRank isn't actually
// below processedRank.
export function retreatTrack(state, targetRank) {
  const clampedTarget = Math.max(0, Math.min(state.processedRank, targetRank));
  if (clampedTarget >= state.processedRank) return { state, revoked: [] };

  const nextItem = nextItemAtRank(clampedTarget);
  const unlocked = state.unlocked.slice(0, clampedTarget);
  const revoked = state.unlocked.slice(clampedTarget);

  const kept = new Set(unlocked);
  const pool = [];
  for (let id = 1; id < nextItem; id++) {
    if (!kept.has(id)) pool.push(id);
  }

  return { state: { unlocked, pool, nextItem, processedRank: clampedTarget }, revoked };
}

// Reverses both tracks down to targetRank in one call. Returns the SAME
// state reference when neither track actually changed, same reference-
// equality contract as advanceArtUnlocks.
export function retreatArtUnlocks(state, targetRank) {
  const { state: chest, revoked: chestRevoked } = retreatTrack(state.chest, targetRank);
  const { state: logbook, revoked: logbookRevoked } = retreatTrack(state.logbook, targetRank);
  const changed = chest !== state.chest || logbook !== state.logbook;
  return { state: changed ? { chest, logbook } : state, chestRevoked, logbookRevoked };
}

// The single entry point callers should use to bring both tracks to
// targetRank, whichever direction that is — advances (drawing new grants)
// when targetRank is higher, retreats (revoking back to the pool) when
// it's lower. Always returns all four arrays so callers don't need to
// branch themselves; whichever direction didn't apply comes back empty.
export function syncArtUnlocks(state, targetRank, opts) {
  if (targetRank < state.chest.processedRank) {
    const { state: nextState, chestRevoked, logbookRevoked } = retreatArtUnlocks(state, targetRank);
    return { state: nextState, chestGrants: [], logbookGrants: [], chestRevoked, logbookRevoked };
  }
  const { state: nextState, chestGrants, logbookGrants } = advanceArtUnlocks(state, targetRank, opts);
  return { state: nextState, chestGrants, logbookGrants, chestRevoked: [], logbookRevoked: [] };
}

export function chestArt(itemId) { return CHESTS[itemId - 1]; }
export function logbookArt(itemId) { return SPINES[itemId - 1]; }

// The CHESTS/SPINES indices actually selectable in the chest/logbook
// pickers — every claimed item's index (itemId - 1), nothing else. Not a
// dense prefix — a later, higher item can be unlocked while an earlier one
// is still sitting in the pool, so callers must check membership, not
// compare against a count.
export function unlockedIndices(unlocked) {
  return new Set(unlocked.map(itemId => itemId - 1));
}
