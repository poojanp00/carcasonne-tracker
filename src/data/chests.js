// Treasure chest art — images/chests/*.png, flattened into one flat, ordered
// list. Filenames are the sort key (001.png..NNNpng) so a realm's persisted
// `chest` index (see PreGameSetup) always resolves to the same image,
// forever, regardless of the viewer's current rank or how many more chests
// get added later. Drop new art in as the next number(s) in sequence.
const CHEST_MODULES = import.meta.glob('../../images/chests/*.png', { eager: true, import: 'default' });
export const CHESTS = Object.keys(CHEST_MODULES)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map(key => CHEST_MODULES[key]);

export function chestFor(realm) {
  const idx = Number.isInteger(realm.chest) ? realm.chest % CHESTS.length : 0;
  return CHESTS[idx];
}

// Cumulative chest count unlocked AT each rank (index 0 = rank 1 .. index 19
// = rank 20/MAX_RANK). One chest per rank, starting with 001.png at rank 1.
const CHEST_UNLOCK_SCHEDULE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// How many chests are unlocked at a given account rank — clamped to however
// many chest images actually exist on disk today, so the schedule can be
// "ahead of" the art without ever pointing past the end of CHESTS.
export function unlockedChestCount(rank) {
  const r = Math.min(Math.max(Math.floor(rank) || 1, 1), CHEST_UNLOCK_SCHEDULE.length);
  return Math.min(CHEST_UNLOCK_SCHEDULE[r - 1], CHESTS.length);
}

// A prefix of CHESTS — used only for picking a randomized starting chest.
export function unlockedChests(rank) {
  return CHESTS.slice(0, unlockedChestCount(rank));
}

// Lowest rank at which CHESTS[index] becomes unlocked — drives the per-tile
// "Unlocks at Rank N" tooltip in the picker.
export function chestUnlockRank(index) {
  for (let r = 1; r <= CHEST_UNLOCK_SCHEDULE.length; r++) {
    if (CHEST_UNLOCK_SCHEDULE[r - 1] > index) return r;
  }
  return CHEST_UNLOCK_SCHEDULE.length;
}

// How many chests the picker renders at all (unlocked + silhouetted preview)
// — unlocked chests plus whatever the NEXT rank that unlocks something adds
// (that rank might add 1, 2, or 3 chests — see CHEST_UNLOCK_SCHEDULE), so
// the picker isn't a wall of every remaining locked chest as the collection
// grows. Anything past that next milestone is summarized by a single "More
// coming soon!" tile instead of being rendered one-by-one.
export function visibleChestCount(rank) {
  const current = unlockedChestCount(rank);
  if (current >= CHESTS.length) return current;
  return unlockedChestCount(chestUnlockRank(current));
}
