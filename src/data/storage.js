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
 * For new realms, also creates individual player records in the players table.
 * 
 * Security: Requires authenticated user to prevent orphaned realms.
 * Validation: Ensures user ownership before any database operations.
 * 
 * @param {Object} realm - Realm object with id, name, players, etc.
 * @param {string} userId - Owner's Supabase auth user ID  
 * @param {boolean} isNew - Whether this is a new realm (to create player records)
 * @throws {Error} If userId is missing or database operation fails
 */
export async function saveRealm(realm, userId, isNew = false) {
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
  
  // For new realms, create individual player records in the players table
  if (isNew && realm.players && realm.players.length > 0) {
    try {
      await createPlayersForRealm(realm.players, realm.id);
    } catch (playerError) {
      console.error('Failed to create player records for new realm:', playerError);
      // Don't throw here - realm was created successfully, player records can be created later
    }
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
 * RETRIEVE ALL GAMES WITH EFFICIENT PLAYER DATA LOADING
 * 
 * Fetches complete game history with normalized player data using efficient bulk queries.
 * Uses a single query with JOIN to load all game_players data at once instead of N+1 queries.
 * 
 * During migration period, falls back to legacy JSON for games without normalized data.
 * 
 * @returns {Promise<Array>} Array of game objects with normalized structure
 */
export async function getGames() {
  // Fetch games and all their players in two efficient queries
  const [gamesResult, gamePlayersResult] = await Promise.all([
    supabase
      .from('games')
      .select('*')
      .order('inserted_at', { ascending: false }),
    supabase
      .from('game_players_view')
      .select('*')
      .order('game_id, player_name')
  ]);
  
  if (!gamesResult.data) return [];
  
  // Group game_players by game_id for efficient lookup
  const gamePlayersMap = new Map();
  (gamePlayersResult.data || []).forEach(gp => {
    if (!gamePlayersMap.has(gp.game_id)) {
      gamePlayersMap.set(gp.game_id, []);
    }
    gamePlayersMap.get(gp.game_id).push({
      name: gp.player_name,
      score: gp.score || 0,
      meeple: gp.character || '',
      breakdown: gp.breakdown || {},
    });
  });
  
  // Merge games with their normalized player data
  return gamesResult.data.map(g => {
    const normalizedPlayers = gamePlayersMap.get(g.id);
    
    return {
      id:         g.id,
      realmId:    g.realm_id,
      date:       g.date,
      players:    normalizedPlayers || g.players || [], // Use normalized or fall back to legacy JSON
      expansions: g.expansions || [],
      winners:    g.winners    || [],
      maxScore:   g.max_score  || 0,
      clutchWin:  g.clutch_win || false,
      farmWin:    g.farm_win   || false,
    };
  });
}

/**
 * GET PLAYER STATISTICS FOR A REALM
 * 
 * Efficiently calculates comprehensive player statistics using database aggregation
 * instead of client-side computation. Much faster than processing all games in JS.
 * 
 * @param {string} realmId - UUID of the realm
 * @returns {Promise<Object>} Object mapping player names to their stats
 */
export async function getPlayerStatistics(realmId) {
  const { data } = await supabase.rpc('calculate_player_statistics', {
    realm_id: realmId
  });
  
  return data || {};
}

/**
 * ADD PLAYER TO REALM
 * 
 * Adds a new player to an existing realm in the normalized players table.
 * Components read directly from the players table, no legacy JSON updates needed.
 * 
 * @param {string} realmId - UUID of the realm  
 * @param {string} playerName - Name of player to add
 * @param {string} userId - Owner's user ID for validation
 */
export async function addPlayerToRealm(realmId, playerName, userId) {
  // Add to players table
  const { data: newPlayer, error: playerError } = await supabase
    .from('players')
    .insert({ name: playerName, realm_id: realmId })
    .select('*')
    .single();
    
  if (playerError) {
    throw new Error(playerError.message || 'Failed to add player');
  }
  
  return newPlayer;
}

/**
 * REMOVE PLAYER FROM REALM
 * 
 * Removes a player from a realm and all their associated game data.
 * This is a destructive operation that cascades to game_players records.
 * 
 * @param {string} realmId - UUID of the realm
 * @param {string} playerName - Name of player to remove
 * @param {string} userId - Owner's user ID for validation  
 */
export async function removePlayerFromRealm(realmId, playerName, userId) {
  // Remove from players table (cascades to game_players)
  await supabase
    .from('players')
    .delete()
    .eq('realm_id', realmId)
    .eq('name', playerName);
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

// ── Players ───────────────────────────────────────────────────────────────────

/**
 * CREATE OR UPDATE PLAYERS FOR A REALM
 * 
 * Inserts player names as individual UUID records in the players table.
 * This normalizes player data and allows names to repeat across realms.
 * 
 * @param {Array<string>} playerNames - Array of player name strings
 * @param {string} realmId - UUID of the realm these players belong to
 * @returns {Promise<Array>} Array of created player objects with UUIDs
 */
export async function createPlayersForRealm(playerNames, realmId) {
  if (!playerNames || playerNames.length === 0) return [];
  
  const playersToInsert = playerNames.map(name => ({
    name,
    realm_id: realmId,
  }));
  
  const { data, error } = await supabase
    .from('players')
    .insert(playersToInsert)
    .select('*');
    
  if (error) {
    console.error('createPlayersForRealm error:', error);
    throw new Error(error.message || 'Failed to create players');
  }
  
  return data || [];
}

/**
 * GET PLAYERS FOR A REALM
 * 
 * Retrieves all players associated with a specific realm.
 * Used for game setup and realm management.
 * 
 * @param {string} realmId - UUID of the realm
 * @returns {Promise<Array>} Array of player objects
 */
export async function getPlayersForRealm(realmId) {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('realm_id', realmId)
    .order('created_at');
    
  return data || [];
}

/**
 * CREATE GAME PLAYER RECORDS
 * 
 * Creates initial game_players records when a new game starts.
 * Each player gets a row with placeholder data that will be updated on completion.
 * 
 * @param {string} gameId - UUID of the game
 * @param {Array<string>} playerNames - Array of player names participating
 * @param {string} realmId - UUID of the realm (to look up player IDs)
 */
export async function createGamePlayerRecords(gameId, playerNames, realmId) {
  if (!playerNames || playerNames.length === 0) return;
  
  // Get player IDs for the names in this realm
  const players = await getPlayersForRealm(realmId);
  const playerMap = new Map(players.map(p => [p.name, p.id]));
  
  const gamePlayersToInsert = playerNames.map(name => {
    const playerId = playerMap.get(name);
    if (!playerId) {
      throw new Error(`Player "${name}" not found in realm ${realmId}`);
    }
    
    return {
      game_id: gameId,
      player_id: playerId,
      score: 0,
      character: null,
      breakdown: {},
    };
  });
  
  const { error } = await supabase
    .from('game_players')
    .insert(gamePlayersToInsert);
    
  if (error) {
    console.error('createGamePlayerRecords error:', error);
    throw new Error(error.message || 'Failed to create game player records');
  }
}

/**
 * UPDATE GAME PLAYER DATA
 * 
 * Updates a specific player's data when the game is completed.
 * Called from the PostGameForm when final scores are entered.
 * 
 * @param {string} gameId - UUID of the game
 * @param {string} playerName - Name of the player to update
 * @param {string} realmId - UUID of the realm (to look up player ID)
 * @param {Object} playerData - Player's final game data (score, character, breakdown)
 */
export async function updateGamePlayerData(gameId, playerName, realmId, playerData) {
  // Get the player ID for this name in this realm
  const players = await getPlayersForRealm(realmId);
  const player = players.find(p => p.name === playerName);
  
  if (!player) {
    throw new Error(`Player "${playerName}" not found in realm ${realmId}`);
  }
  
  const { error } = await supabase
    .from('game_players')
    .update({
      score: playerData.score || 0,
      character: playerData.meeple || null,
      breakdown: playerData.breakdown || {},
    })
    .eq('game_id', gameId)
    .eq('player_id', player.id);
    
  if (error) {
    console.error('updateGamePlayerData error:', error);
    throw new Error(error.message || 'Failed to update game player data');
  }
}

/**
 * GET GAME PLAYERS DATA
 * 
 * Retrieves normalized player data for a specific game.
 * Returns the same format as the old games.players JSON for compatibility.
 * 
 * @param {string} gameId - UUID of the game
 * @returns {Promise<Array>} Array of player objects with scores and breakdowns
 */
export async function getGamePlayersData(gameId) {
  const { data } = await supabase
    .from('game_players_view')
    .select('*')
    .eq('game_id', gameId);
    
  return (data || []).map(gp => ({
    name: gp.player_name,
    score: gp.score || 0,
    meeple: gp.character || '',
    breakdown: gp.breakdown || {},
  }));
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
