// Treasure chest art, one per realm — numerically sorted so chest N stays
// stable. Chosen explicitly by the user at realm creation (see PreGameSetup),
// unlike logbook spines there's no automatic assignment for new realms.
const CHEST_MODULES = import.meta.glob('../../images/chests/basic/*.png', { eager: true, import: 'default' });
export const CHESTS = Object.entries(CHEST_MODULES)
  .sort((a, b) => parseInt(a[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10) - parseInt(b[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10))
  .map(([, img]) => img);

export function chestFor(realm) {
  const idx = Number.isInteger(realm.chest) ? realm.chest % CHESTS.length : 0;
  return CHESTS[idx];
}
