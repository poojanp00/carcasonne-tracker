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
  getExpansions, saveOwnedExpansions,
  getRealms, saveRealm, deleteRealm,
  getPendingInvites, respondToInvite, leaveRealm,
  generateId, generateRealmId,
  migrateFromLocalStorage,
} from '../data/storage';

export function useGameData(user, authLoading) {
  // Realm limit to prevent database bloat and encourage focused gameplay
  // within a reasonable number of distinct groups/settings.
  // Business rule: Most users have 2-4 active game groups (family, friends, etc.)
  const MAX_REALMS = 12;
  const [games,          setGames]          = useState([]);
  const [expansions,     setExpansions]     = useState([]);
  const [realms,         setRealms]         = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading,        setLoading]        = useState(true);

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
      if (user) await migrateFromLocalStorage(user.id, user.email);
      
      // Load all data in parallel for performance
      const [g, e, r, inv] = await Promise.all([
        getGames(),                    // Games in realms the user can access (RLS-scoped)
        getExpansions(user?.id),       // User's expansion preferences
        getRealms(user?.id),           // Owned + shared realms
        user ? getPendingInvites() : Promise.resolve([]), // Group invites awaiting a response
      ]);
      // Defense in depth: only keep games belonging to visible realms, even if
      // a DB misconfiguration (leftover permissive policy) returns more rows.
      const realmIds = new Set(r.map(x => x.id));
      setGames(g.filter(game => realmIds.has(game.realmId)));
      setExpansions(e);
      setRealms(r);
      setPendingInvites(inv);
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
      // Persist the user's full owned set as a single row.
      const ownedNames = updated.filter(e => e.owned).map(e => e.name);
      if (user?.id) saveOwnedExpansions(ownedNames, user.id, user.email);
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
   * @param {Object} data - Realm details: name, players (name strings), and
   *                        selfPlayer (which player the creator is, or null)
   * @returns {Object} Created realm with generated ID
   */
  const addRealm = useCallback(async (data) => {
    if (!user?.id) {
      // Prevent creating realms before authentication completes — otherwise
      // realms are saved with a null user_id and disappear after refresh.
      throw new Error('Cannot create realm: user is not authenticated');
    }
    // Shared realms don't count toward the cap — only groups the user owns.
    if (realms.filter(r => r.isOwner !== false).length >= MAX_REALMS) {
      throw new Error(`Realm limit reached (${MAX_REALMS})`);
    }
    const { selfPlayer, ...rest } = data;
    const realm = {
      ...rest,
      // The creator's own slot is written directly as 'owner' — everyone else
      // starts uninvited until an invite links their account.
      players: (data.players || []).map(name => name === selfPlayer
        ? { name, userId: user.id, status: 'owner' }
        : { name, userId: null, status: 'uninvited' }),
      id:        generateRealmId(), // Uppercase UUID for visual distinction
      createdAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      ownerId:   user.id,
      isOwner:   true,
    };
    await saveRealm(realm, user?.id);
    setRealms(prev => [...prev, realm]);
    return realm;
  }, [user, realms]);

  /**
   * RESPOND TO A GROUP INVITE
   *
   * Accepting makes the shared realm (and its full game history) visible, so
   * both realms and games are refetched. Declining just drops the invite.
   */
  const acceptInvite = useCallback(async (realmId) => {
    await respondToInvite(realmId, true);
    setPendingInvites(prev => prev.filter(i => i.realmId !== realmId));
    const [g, r] = await Promise.all([getGames(), getRealms(user?.id)]);
    const realmIds = new Set(r.map(x => x.id));
    setGames(g.filter(game => realmIds.has(game.realmId)));
    setRealms(r);
  }, [user]);

  const declineInvite = useCallback(async (realmId) => {
    await respondToInvite(realmId, false);
    setPendingInvites(prev => prev.filter(i => i.realmId !== realmId));
  }, []);

  /**
   * LEAVE A SHARED REALM (member side)
   *
   * Resets the member's player slot to uninvited; the realm and its games
   * vanish from this account's view. The owner's data is untouched.
   */
  const leaveSharedRealm = useCallback(async (realmId) => {
    await leaveRealm(realmId);
    setRealms(prev => prev.filter(r => r.id !== realmId));
    setGames(prev => prev.filter(g => g.realmId !== realmId));
  }, []);

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
    games, expansions, realms, pendingInvites, loading,
    // CRUD operations
    addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm,
    // Realm sharing
    acceptInvite, declineInvite, leaveSharedRealm,
  };
}
