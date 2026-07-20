// Book spine art, one per realm — numerically sorted so spine N stays stable
const SPINE_MODULES = import.meta.glob('../../images/logbook/*.png', { eager: true, import: 'default' });
export const SPINES = Object.entries(SPINE_MODULES)
  .sort((a, b) => parseInt(a[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10) - parseInt(b[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10))
  .map(([, img]) => img);

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
