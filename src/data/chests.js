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
