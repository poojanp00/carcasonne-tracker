import { supabase } from './supabase';
import { DEFAULT_EXPANSIONS } from './expansions';

export function generateRealmId() {
  return crypto.randomUUID().toUpperCase();
}

export function generateId() {
  return crypto.randomUUID();
}


// ── Realms ────────────────────────────────────────────────────────────────────
// Schema requires: ALTER TABLE realms ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

/**
 * RETRIEVE USER'S REALMS
 * 
 * Fetches all game realms owned by the authenticated user.
 * Realms represent distinct gaming groups or contexts (family, friends, etc.).
 * 
 * Security: Only returns realms owned by the specified user.
 * Ordering: Sorted by creation date for consistent display.
 * 
 * @param {string} userId - Supabase auth user ID
 * @returns {Promise<Array>} Array of realm objects with normalized structure
 */
export async function getRealms(userId) {
  if (!userId) return []; // No user = no realms
  
  const { data } = await supabase
    .from('realms')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
    
  // Normalize database structure to application format
  return (data || []).map(r => ({
    id:           r.id,
    name:         r.name,
    players:      r.players || [],
    createdAt:    r.created_at,
  }));
}

/**
 * CREATE OR UPDATE REALM
 * 
 * Saves realm data with strict ownership validation.
 * Uses upsert for both create and update operations.
 * 
 * Security: Requires authenticated user to prevent orphaned realms.
 * Validation: Ensures user ownership before any database operations.
 * 
 * @param {Object} realm - Realm object with id, name, players, etc.
 * @param {string} userId - Owner's Supabase auth user ID  
 * @throws {Error} If userId is missing or database operation fails
 */
export async function saveRealm(realm, userId) {
  if (!userId) {
    throw new Error('saveRealm called without userId — refusing to save realm without owner');
  }

  const { data, error } = await supabase.from('realms').upsert({
    id:            realm.id,
    name:          realm.name,
    players:       realm.players || [],
    created_at:    realm.createdAt,
    user_id:       userId, // Enforce ownership
  });

  if (error) {
    console.error('saveRealm error:', error);
    throw new Error(error.message || 'Failed to save realm');
  }
}

/**
 * CASCADE DELETE REALM AND ASSOCIATED GAMES
 * 
 * Removes realm and all games within it to maintain data integrity.
 * Two-step delete ensures no orphaned games remain in the database.
 * 
 * Order matters: Games deleted first to avoid foreign key constraints.
 * 
 * @param {string} realmId - UUID of realm to delete
 */
export async function deleteRealm(realmId) {
  // Step 1: Delete all games in this realm
  await supabase.from('games').delete().eq('realm_id', realmId);
  // Step 2: Delete the realm itself
  await supabase.from('realms').delete().eq('id', realmId);
}

// ── Games ─────────────────────────────────────────────────────────────────────

/**
 * RETRIEVE ALL GAMES (GLOBAL QUERY)
 * 
 * Fetches complete game history across all users and realms.
 * 
 * NOTE: This is a temporary implementation - games should be filtered by user
 * for proper multi-tenant security. Currently relies on client-side filtering
 * by realm ownership for access control.
 * 
 * TODO: Add user_id column and filter games by authenticated user
 * 
 * @returns {Promise<Array>} Array of game objects with normalized structure
 */
export async function getGames() {
  const { data } = await supabase
    .from('games')
    .select('*')
    .order('inserted_at', { ascending: false }); // Newest first for recent game display
    
  // Normalize database structure to application format
  return (data || []).map(g => ({
    id:         g.id,
    realmId:    g.realm_id,      // Foreign key to realms table
    date:       g.date,          // Game date (YYYY-MM-DD)
    players:    g.players    || [], // Player objects with scores and breakdowns
    expansions: g.expansions || [], // Active expansion names
    winners:    g.winners    || [], // Precomputed winners from database
    maxScore:   g.max_score  || 0,  // Maximum score in the game
    clutchWin:  g.clutch_win || false, // Close game victory flag
    farmWin:    g.farm_win   || false, // Farm-dominant victory flag
  }));
}

/**
 * CREATE NEW GAME RECORD
 * 
 * Persists completed game data to database.
 * Games are associated with realms for organization and access control.
 * 
 * @param {Object} game - Game object with players, scores, expansions, etc.
 */
export async function insertGame(game) {
  await supabase.from('games').insert({
    id:          game.id,
    realm_id:    game.realmId  || null, // Optional realm association
    date:        game.date,              // YYYY-MM-DD format
    players:     game.players,           // Array of player objects
    expansions:  game.expansions || [],  // Active expansion names
    winners:     game.winners    || [],  // Precomputed winners from frontend
    max_score:   game.maxScore  || 0,    // Maximum score in the game
    clutch_win:  game.clutchWin  || false, // Victory in close game
    farm_win:    game.farmWin    || false, // Victory via farm dominance
  });
}

/**
 * DELETE GAME RECORD
 * 
 * Removes single game from database by ID.
 * Used for correcting mistaken game entries.
 * 
 * @param {string} id - Game UUID to delete
 */
export async function removeGame(id) {
  await supabase.from('games').delete().eq('id', id);
}

// ── Expansions ────────────────────────────────────────────────────────────────
// Schema requires:
//   ALTER TABLE expansions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
//   ALTER TABLE expansions ADD CONSTRAINT expansions_name_user_id_key UNIQUE (name, user_id);

export async function getExpansions(userId) {
  if (!userId) return DEFAULT_EXPANSIONS;
  const { data } = await supabase.from('expansions').select('*').eq('user_id', userId);
  if (!data || data.length === 0) return DEFAULT_EXPANSIONS;
  
  // Merge user's owned expansions with default catalog
  // This ensures new expansions appear even if user hasn't seen them yet
  const defaultByName = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e]));
  const storedNames   = new Set(data.map(e => e.name));
  return [
    ...data.map(e => ({ name: e.name, type: e.type || defaultByName[e.name]?.type || 'full', owned: e.owned })),
    ...DEFAULT_EXPANSIONS.filter(e => !storedNames.has(e.name)),
  ];
}

export async function upsertExpansion(name, type, owned, userId) {
  await supabase.from('expansions').upsert(
    { name, type, owned, user_id: userId || null },
    { onConflict: 'name,user_id' }
  );
}

// ── localStorage migration (runs once on first load) ─────────────────────────
/**
 * One-time migration from localStorage to Supabase database.
 * Migrates user data including realms, games, expansions, and board state.
 * Runs only once per user, tracked by localStorage migration flag.
 * Safely handles missing or corrupted data during the transition.
 * i do not understand what this function is used for. 
 */

export async function migrateFromLocalStorage(userId) {
  const LS_MIGRATED = 'carcassonne_migrated_v1';
  if (localStorage.getItem(LS_MIGRATED)) return;

  const LS_REALMS     = 'carcassonne_realms';
  const LS_GAMES      = 'carcassonne_games';
  const LS_EXPANSIONS = 'carcassonne_expansions';
  const LS_BOARD      = 'carcassonne_board_v1';

  try {
    const rawRealms     = localStorage.getItem(LS_REALMS);
    const rawGames      = localStorage.getItem(LS_GAMES);
    const rawExpansions = localStorage.getItem(LS_EXPANSIONS);
    const rawBoard      = localStorage.getItem(LS_BOARD);

    if (rawRealms) {
      const realms = JSON.parse(rawRealms);
      if (realms.length > 0) {
        await supabase.from('realms').upsert(
          realms.map(r => ({
            id:         r.id,
            name:       r.name,
            players:    r.players || [],
            created_at: r.createdAt || new Date().toISOString().split('T')[0],
            user_id:    userId || null,
          }))
        );
      }
    }

    if (rawGames) {
      const games = JSON.parse(rawGames);
      for (const g of games) {
        if (!Array.isArray(g.players)) continue;
        
        // Calculate winners for migrated games (they won't have winners field)
        const maxScore = Math.max(...g.players.map(p => p.score || 0));
        const winners = g.players.filter(p => (p.score || 0) === maxScore).map(p => p.name);
        
        await supabase.from('games').upsert({
          id:         g.id,
          realm_id:   g.realmId || null,
          date:       g.date,
          players:    g.players,
          expansions: g.expansions || [],
          winners:    winners,              // Calculate winners during migration
          farm_win:   g.farmWin || false,
        });
      }
    }

    if (rawExpansions) {
      const exps = JSON.parse(rawExpansions);
      if (exps.length > 0) {
        await supabase.from('expansions').upsert(
          exps.map(e => ({ name: e.name, type: e.type || 'full', owned: e.owned || false, user_id: userId || null })),
          { onConflict: 'name,user_id' }
        );
      }
    }

    if (rawBoard) {
      const b = JSON.parse(rawBoard);
      await supabase.from('board_state').upsert({
        id:           1,
        positions:    b.positions    || {},
        laps:         b.laps         || {},
        track_length: b.trackLength  || 50,
        players:      b.players      || [],
      });
    }

    localStorage.setItem(LS_MIGRATED, '1');
    [LS_REALMS, LS_GAMES, LS_EXPANSIONS, LS_BOARD].forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('localStorage migration error:', err);
  }
}
