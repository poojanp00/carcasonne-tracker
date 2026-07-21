// Book spine art — folders 1, 2, 3, ... under images/logbook, flattened
// folder-major into one stable list so a realm's persisted `spine` index
// always resolves to the same image forever, regardless of the viewer's
// current rank. Folder count is auto-detected from what's on disk, so adding
// folder 4, 5, etc. later needs no code change here — and folders aren't
// assumed to all hold the same number of books; each folder's own image
// count is tracked so the picker's unlock boundary lands at the real edge
// of a folder, not an assumed size.
const SPINE_MODULES = import.meta.glob('../../images/logbook/*/*.png', { eager: true, import: 'default' });
const byFolder = {};
for (const [path, img] of Object.entries(SPINE_MODULES)) {
  const m = path.match(/logbook\/(\d+)\/(\d+)\.png$/);
  if (!m) continue;
  const folder = Number(m[1]);
  const idx = Number(m[2]);
  (byFolder[folder] ??= []).push([idx, img]);
}
const folderKeys = Object.keys(byFolder).map(Number).sort((a, b) => a - b);
export const LOGBOOK_FOLDER_COUNT = folderKeys.length;

// Each folder's images sorted by filename number, then compacted — a skipped
// filename number (e.g. 6.png missing) shouldn't leave a hole in the array.
const folderImages = folderKeys.map(f => byFolder[f].sort((a, b) => a[0] - b[0]).map(([, img]) => img));
export const SPINES = folderImages.flat();

// Cumulative book count through folder N (1-indexed) — e.g. [5, 10, 14] if
// the folders hold 5, 5, 4 books respectively.
const FOLDER_CUM = folderImages.reduce((acc, imgs) => {
  acc.push((acc[acc.length - 1] || 0) + imgs.length);
  return acc;
}, []);

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

// How many logbook folders are unlocked at a given account rank — folder 1
// is always available; every 4 ranks unlocks the next one (same schedule as
// chests — see data/chests.js), capping at however many folders exist so far.
export function unlockedLogbookFolders(rank) {
  return Math.min(LOGBOOK_FOLDER_COUNT, Math.floor(Math.max(0, rank) / 4) + 1);
}

// The logbooks selectable in the picker at a given rank — a prefix of
// SPINES, so its indices always line up with spineFor/realm.spine.
export function unlockedSpines(rank) {
  const n = unlockedLogbookFolders(rank);
  return SPINES.slice(0, n > 0 ? FOLDER_CUM[n - 1] : 0);
}
