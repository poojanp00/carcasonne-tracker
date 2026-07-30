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
