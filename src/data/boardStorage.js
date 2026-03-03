/**
 * CARCASSONNE BOARD STATE PERSISTENCE
 * 
 * Manages the active score board state with real-time synchronization to Supabase.
 * Uses singleton pattern (ID=1) since only one game can be active at a time per user.
 * 
 * Schema:
 * - positions: {player: number} - Current board position (0-49)
 * - laps: {player: number} - Number of complete 50-point laps
 * - track_length: number - Length of scoring track (always 50 for Carcassonne)
 * - players: string[] - Active player names in game order
 * - score_totals: {player: {type: number}} - Point breakdown by category
 * 
 * Data Validation:
 * - Player list consistency checking
 * - Automatic fallback to defaults on corruption
 * - Missing player data backfilling
 * - Graceful error handling with offline capability
 */

import { supabase } from './supabase';

// SQL migration required:
//   ALTER TABLE board_state ADD COLUMN IF NOT EXISTS score_totals jsonb DEFAULT '{}';

// Base scoring categories available in all Carcassonne games
const BASE_TYPES = ['road', 'city', 'monastery', 'field'];

// Default score breakdown for new players (all categories start at 0)
const BASE_BREAKDOWN = Object.fromEntries(BASE_TYPES.map(t => [t, 0]));

/**
 * Creates a fresh board state for new games or when existing state is invalid.
 * Initializes all players at position 0 with zero laps and empty score breakdowns.
 * Accommodates both base game and expansion scoring categories.
 * 
 * @param {string[]} players - Array of player names
 * @param {string[]} extraTypes - Additional scoring categories from expansions
 * @returns {Object} Complete board state object
 */
function makeDefault(players = [], extraTypes = []) {
  // Combine base types with expansion types (avoiding duplicates)
  const allTypes   = [...BASE_TYPES, ...extraTypes.filter(t => !BASE_TYPES.includes(t))];
  const breakdown  = Object.fromEntries(allTypes.map(t => [t, 0]));
  
  // Initialize tracking objects
  const positions   = {};
  const laps        = {};
  const scoreTotals = {};
  
  // Set starting state for each player
  for (const p of players) {
    positions[p]   = 0;            // Start at position 0 on the scoring track
    laps[p]        = 0;            // No completed laps initially
    scoreTotals[p] = { ...breakdown }; // Zero points in all categories
  }
  
  return { 
    positions, 
    laps, 
    trackLength: 50,  // Standard Carcassonne scoring track length
    players, 
    scoreTotals 
  };
}

/**
 * BOARD STATE RETRIEVAL WITH VALIDATION
 * 
 * Loads current board state from database with comprehensive validation.
 * Ensures data integrity and handles player list changes gracefully.
 * 
 * Validation Rules:
 * 1. Database record must exist and be retrievable
 * 2. If players provided, stored player list must exactly match
 * 3. All stored players must have complete score breakdown entries
 * 4. Fallback to fresh state on any validation failure
 * 
 * @param {string[]} players - Expected players (empty = accept any)
 * @returns {Promise<Object>} Validated board state
 */
export async function getBoard(players = []) {
  try {
    // Fetch singleton board record (ID=1)
    const { data } = await supabase
      .from('board_state')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (!data) return makeDefault(players);
    
    // PLAYER LIST VALIDATION
    // If specific players expected, ensure exact match with stored data
    const stored = data.players || [];
    if (players.length > 0) {
      const same = players.length === stored.length && 
                   players.every(p => stored.includes(p));
      if (!same) return makeDefault(players); // Player mismatch - fresh state
    }
    
    // SCORE BREAKDOWN VALIDATION
    // Ensure every stored player has complete scoring data
    const scoreTotals = data.score_totals || {};
    for (const p of (data.players || [])) {
      if (!scoreTotals[p]) scoreTotals[p] = { ...BASE_BREAKDOWN };
    }
    
    // Return validated and normalized state
    return {
      positions:   data.positions    || {},
      laps:        data.laps         || {},
      trackLength: data.track_length || 50,
      players:     data.players      || [],
      scoreTotals,
    };
  } catch {
    // Database error or corrupt data - fall back to clean state
    return makeDefault(players);
  }
}

/**
 * REAL-TIME BOARD STATE PERSISTENCE
 * 
 * Fire-and-forget save operation for frequent in-game updates.
 * Optimized for responsiveness - doesn't block UI on database latency.
 * Logs failures for debugging but doesn't interrupt gameplay.
 * 
 * Used during active scoring when players are adding points frequently.
 * 
 * @param {Object} board - Complete board state to persist
 */
export function saveBoard(board) {
  supabase.from('board_state').upsert({
    id:           1,  // Singleton pattern - only one active game
    positions:    board.positions,
    laps:         board.laps,
    track_length: board.trackLength || 50,
    players:      board.players     || [],
    score_totals: board.scoreTotals || {},
  }).then(({ error }) => {
    if (error) console.warn('Failed to save board:', error);
  });
}

/**
 * BOARD STATE RESET WITH SYNCHRONIZATION
 * 
 * Awaitable reset operation for game initialization and cleanup.
 * Ensures fresh state is committed before allowing game to proceed.
 * 
 * Used when starting new games or switching player configurations.
 * Callers that need guaranteed write completion should await this.
 * 
 * @param {string[]} players - New player list
 * @param {string[]} extraTypes - Expansion scoring categories
 * @returns {Promise<Object>} Fresh board state after database write
 */
export async function resetBoard(players = [], extraTypes = []) {
  const d = makeDefault(players, extraTypes);
  await supabase.from('board_state').upsert({
    id:           1,
    positions:    d.positions,
    laps:         d.laps,
    track_length: d.trackLength,
    players:      d.players,
    score_totals: d.scoreTotals,
  });
  return d;
}
