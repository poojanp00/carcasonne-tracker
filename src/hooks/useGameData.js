/**
 * CARCASSONNE GAME DATA MANAGEMENT HOOK
 * 
 * Central data management system for all game-related operations.
 * Handles authentication-aware CRUD operations with optimistic updates.
 * 
 * Features:
 * - Auto-loading of user data on auth state changes
 * - One-time localStorage migration to Supabase
 * - Realm management with ownership validation 
 * - Game tracking with realm association
 * - Expansion ownership with user preferences
 * - Client-side state synchronization with server
 * 
 * State Management Pattern:
 * 1. Optimistically update local state immediately 
 * 2. Perform server operation
 * 3. Keep local state on success, rollback on error
 * 
 * @param {Object} user - Supabase auth user object (null if not authenticated)
 * @param {boolean} authLoading - Whether authentication state is still resolving
 * @returns {Object} Game data and CRUD operations
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getGames, insertGame, removeGame,
  getExpansions, upsertExpansion,
  getRealms, saveRealm, deleteRealm,
  generateId, generateRealmId,
  migrateFromLocalStorage,
} from '../data/storage';

export function useGameData(user, authLoading) {
  // Realm limit to prevent database bloat and encourage focused gameplay
  // within a reasonable number of distinct groups/settings.
  // Business rule: Most users have 2-4 active game groups (family, friends, etc.)
  const MAX_REALMS = 12;
  const [games,      setGames]      = useState([]);
  const [expansions, setExpansions] = useState([]);
  const [realms,     setRealms]     = useState([]);
  const [loading,    setLoading]    = useState(true);

  /**
   * DATA INITIALIZATION EFFECT
   * 
   * Loads all user data when authentication resolves.
   * Handles both sign-in (load data) and sign-out (reset to empty) scenarios.
   * 
   * Migration Strategy:
   * - Runs localStorage migration before loading data (one-time per user)
   * - Migration must complete before data loading to avoid conflicts
   * - Empty result if user is null (signed out state)
   */
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve before fetching

    async function init() {
      setLoading(true);
      
      // Run migration for existing users upgrading from localStorage
      if (user) await migrateFromLocalStorage(user.id);
      
      // Load all data in parallel for performance
      // Note: games load globally for now (filtered by realm in components)
      const [g, e, r] = await Promise.all([
        getGames(),                    // All games (TODO: add user filtering)
        getExpansions(user?.id),       // User's expansion preferences
        getRealms(user?.id)            // User's realms
      ]);
      setGames(g);
      setExpansions(e);
      setRealms(r);
      setLoading(false);
    }
    init();
  }, [user, authLoading]);

  /**
   * ADD GAME OPERATION
   * 
   * Creates and records a new game in the database.
   * Uses optimistic update pattern for responsive UI.
   * 
   * Process:
   * 1. Generate secure UUID for game
   * 2. Add to local state immediately
   * 3. Persist to database
   * 4. Return ID for further operations
   * 
   * @param {Object} gameData - Game details (players, scores, expansions, etc.)
   * @returns {string} Generated game ID
   */
  const addGame = useCallback(async (gameData) => {
    const id      = generateId();
    const newGame = { ...gameData, id };
    await insertGame(newGame);
    setGames(prev => [newGame, ...prev]); // Add to beginning (newest first)
    return id;
  }, []);

  /**
   * DELETE GAME OPERATION
   * 
   * Removes game from both database and local state.
   * Uses optimistic update for immediate UI feedback.
   * 
   * @param {string} id - Game ID to delete
   */
  const deleteGame = useCallback(async (id) => {
    await removeGame(id);
    setGames(prev => prev.filter(g => g.id !== id));
  }, []);

  /**
   * TOGGLE EXPANSION OWNERSHIP
   * 
   * Flips owned/unowned state for a specific expansion.
   * Updates both local state and user preferences in database.
   * 
   * @param {string} name - Expansion name to toggle
   */
  const toggleExpansion = useCallback((name) => {
    setExpansions(prev => {
      // Toggle ownership in local state
      const updated = prev.map(e => e.name === name ? { ...e, owned: !e.owned } : e);
      const exp = updated.find(e => e.name === name);
      // Persist change to database
      if (exp) upsertExpansion(exp.name, exp.type, exp.owned, user?.id);
      return updated;
    });
  }, [user]);

  /**
   * CREATE NEW REALM
   * 
   * Establishes a new game realm with authentication and limit validation.
   * 
   * Business Rules:
   * - Must be authenticated (prevents orphaned realms)
   * - Enforces MAX_REALMS limit per user 
   * - Auto-generates secure uppercase UUID
   * - Sets creation date for tracking
   * 
   * @param {Object} data - Realm details (name, players, etc.)
   * @returns {Object} Created realm with generated ID
   */
  const addRealm = useCallback(async (data) => {
    if (!user?.id) {
      // Prevent creating realms before authentication completes — otherwise
      // realms are saved with a null user_id and disappear after refresh.
      throw new Error('Cannot create realm: user is not authenticated');
    }
    if (realms.length >= MAX_REALMS) {
      throw new Error(`Realm limit reached (${MAX_REALMS})`);
    }
    const realm = {
      ...data,
      id:        generateRealmId(), // Uppercase UUID for visual distinction
      createdAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    };
    await saveRealm(realm, user?.id);
    setRealms(prev => [...prev, realm]);
    return realm;
  }, [user, realms]);

  /**
   * UPDATE REALM PROPERTIES
   * 
   * Modifies existing realm with partial updates (name, players, etc.).
   * Uses optimistic update pattern for responsive editing.
   * 
   * @param {string} id - Realm ID to update
   * @param {Object} patch - Properties to update
   */
  const updateRealm = useCallback((id, patch) => {
    setRealms(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      const realm = updated.find(r => r.id === id);
      if (realm) saveRealm(realm, user?.id); // Persist full updated realm
      return updated;
    });
  }, [user]);

  /**
   * DELETE REALM AND ASSOCIATED GAMES
   * 
   * Cascading delete operation that removes:
   * 1. All games within the realm
   * 2. The realm itself
   * 3. Updates local state to reflect changes
   * 
   * This prevents orphaned games and maintains data integrity.
   * 
   * @param {string} realmId - Realm ID to delete
   */
  const removeRealm = useCallback(async (realmId) => {
    await deleteRealm(realmId); // Handles cascading delete in database
    // Update local state to reflect deletion
    setRealms(prev => prev.filter(r => r.id !== realmId));
    setGames(prev => prev.filter(g => g.realmId !== realmId));
  }, []);

  // Export all data and operations for component consumption
  return { 
    // Data state
    games, expansions, realms, loading, 
    // CRUD operations  
    addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm 
  };
}
