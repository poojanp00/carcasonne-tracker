// Treasure chest art — folders 1 through 5 (images/chests/1 .. 5), flattened
// folder-major into one stable list so a realm's persisted `chest` index
// (see PreGameSetup) always resolves to the same image, forever, regardless
// of the viewer's current rank. Folders aren't assumed to all hold the same
// number of chests — each folder's own image count is tracked so the picker's
// unlock boundary lands at the real edge of a folder, not an assumed size.
const FOLDER_COUNT = 5;

const CHEST_MODULES = import.meta.glob('../../images/chests/*/*.png', { eager: true, import: 'default' });
const byFolder = {};
for (const [path, img] of Object.entries(CHEST_MODULES)) {
  const m = path.match(/chests\/(\d+)\/(\d+)\.png$/);
  if (!m) continue;
  const folder = Number(m[1]);
  if (folder < 1 || folder > FOLDER_COUNT) continue; // ignore stray/experimental folders (e.g. 6)
  const idx = Number(m[2]);
  (byFolder[folder] ??= []).push([idx, img]);
}
// Each folder's images sorted by filename number, then compacted — a skipped
// filename number (e.g. 3.png missing) shouldn't leave a hole in the array.
const folderImages = Array.from({ length: FOLDER_COUNT }, (_, i) =>
  (byFolder[i + 1] || []).sort((a, b) => a[0] - b[0]).map(([, img]) => img)
);
export const CHESTS = folderImages.flat();

// Cumulative chest count through folder N (1-indexed) — e.g. [5, 11, 16, 22, 28]
// if the folders hold 5, 6, 5, 6, 6 chests respectively.
const FOLDER_CUM = folderImages.reduce((acc, imgs) => {
  acc.push((acc[acc.length - 1] || 0) + imgs.length);
  return acc;
}, []);

export function chestFor(realm) {
  const idx = Number.isInteger(realm.chest) ? realm.chest % CHESTS.length : 0;
  return CHESTS[idx];
}

// How many chest folders are unlocked at a given account rank — folder 1 is
// always available; every 4 ranks unlocks the next one, capping at all 5
// by rank 16 (rank 20 is MAX_RANK, still just the 5th and final folder).
export function unlockedChestFolders(rank) {
  return Math.min(FOLDER_COUNT, Math.floor(Math.max(0, rank) / 4) + 1);
}

// The chests selectable in the picker at a given rank — a prefix of CHESTS,
// so its indices always line up with chestFor/realm.chest.
export function unlockedChests(rank) {
  const n = unlockedChestFolders(rank);
  return CHESTS.slice(0, n > 0 ? FOLDER_CUM[n - 1] : 0);
}
