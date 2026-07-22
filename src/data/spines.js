// Book spine art — images/logbook/*.png, flattened into one flat, ordered
// list. Filenames are the sort key so a realm's persisted `spine` index
// always resolves to the same image forever, regardless of viewer rank or
// how many more spines get added later. Drop new art in as the next
// number(s) in sequence.
const SPINE_MODULES = import.meta.glob('../../images/logbook/*.png', { eager: true, import: 'default' });
export const SPINES = Object.keys(SPINE_MODULES)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map(key => SPINE_MODULES[key]);

// Legacy fallback for realms created before spines were stored: stable id hash
function hashIndex(realmId) {
  return [...String(realmId)].reduce((s, c) => s + c.charCodeAt(0), 0) % SPINES.length;
}

// Resolve a realm to its spine index — the stored pick wins; legacy realms
// (spine null/undefined) keep the book their id has always hashed to
export function spineIndex(realm) {
  return Number.isInteger(realm.spine) ? realm.spine % SPINES.length : hashIndex(realm.id);
}

export function spineFor(realm) {
  return SPINES[spineIndex(realm)];
}

// Cumulative logbook count unlocked AT each rank — same shape as
// CHEST_UNLOCK_SCHEDULE in data/chests.js: 3 available from the start, then
// +1 per rank up to rank 20. Only 12 logbook images exist today, so
// unlockedSpineCount's clamp to SPINES.length caps this out well before the
// schedule itself would (same "ahead of the art" spirit as chests).
const LOGBOOK_UNLOCK_SCHEDULE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

// How many logbooks are unlocked at a given account rank — clamped to
// however many logbook images actually exist on disk today (same spirit as
// unlockedChestCount in data/chests.js).
export function unlockedSpineCount(rank) {
  const r = Math.min(Math.max(Math.floor(rank) || 1, 1), LOGBOOK_UNLOCK_SCHEDULE.length);
  return Math.min(LOGBOOK_UNLOCK_SCHEDULE[r - 1], SPINES.length);
}

// A prefix of SPINES — used only for picking a randomized starting logbook.
export function unlockedSpines(rank) {
  return SPINES.slice(0, unlockedSpineCount(rank));
}

// Lowest rank at which SPINES[index] becomes unlocked — drives the per-tile
// "Unlocks at Rank N" tooltip in the picker.
export function spineUnlockRank(index) {
  for (let r = 1; r <= LOGBOOK_UNLOCK_SCHEDULE.length; r++) {
    if (LOGBOOK_UNLOCK_SCHEDULE[r - 1] > index) return r;
  }
  return LOGBOOK_UNLOCK_SCHEDULE.length;
}

// How many logbooks the picker renders at all — unlocked + whatever the
// NEXT rank that unlocks something adds (same spirit as visibleChestCount
// in data/chests.js).
export function visibleSpineCount(rank) {
  const current = unlockedSpineCount(rank);
  if (current >= SPINES.length) return current;
  return unlockedSpineCount(spineUnlockRank(current));
}
