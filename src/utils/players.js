/**
 * REALM PLAYER HELPERS
 *
 * realms.players is a jsonb array of { name, user_id, status } objects where
 * status is 'owner' | 'member' | 'pending' | 'uninvited'. The client works
 * with the camelCase shape { name, userId, status }; these helpers convert at
 * the storage boundary and normalize legacy string arrays (old localStorage
 * backups, demo data) into the object shape.
 */

export const PLAYER_STATUSES = ['owner', 'member', 'pending', 'uninvited'];

/** Client shape from any source: strings and partial objects become full
 *  { name, userId, status } objects. */
export function normalizePlayers(players) {
  return (players || []).map(p =>
    typeof p === 'string'
      ? { name: p, userId: null, status: 'uninvited' }
      : {
          name:   p.name || '',
          userId: p.userId ?? p.user_id ?? null,
          status: PLAYER_STATUSES.includes(p.status) ? p.status : 'uninvited',
        }
  );
}

/** DB shape for upserts into realms.players. */
export function toDbPlayers(players) {
  return normalizePlayers(players).map(p => ({
    name:    p.name,
    user_id: p.userId,
    status:  p.status,
  }));
}

/** Just the display names, in order. */
export function playerNames(players) {
  return normalizePlayers(players).map(p => p.name);
}
