import { supabase } from './supabase';
import { DEFAULT_EXPANSIONS } from './expansions';
import { computeWinners } from '../utils/scoring';
import { normalizePlayers, toDbPlayers } from '../utils/players';

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
 * Fetches all game realms visible to the authenticated user: realms they own
 * plus realms shared with them via a membership element in the realm's
 * players jsonb (status 'owner' or 'member').
 *
 * Security: RLS (migrations/realm_members_to_players.sql) scopes the select —
 * owners see their realms, accepted members see shared ones. No app-side
 * filter beyond defense in depth, since that would hide shared realms.
 * Ordering: Sorted by creation date for consistent display.
 *
 * @param {string} userId - Supabase auth user ID (used to derive isOwner)
 * @returns {Promise<Array>} Array of realm objects with normalized structure
 */
export async function getRealms(userId) {
  if (!userId) return []; // No user = no realms

  const { data } = await supabase.from('realms').select('*').order('created_at');

  // Defense in depth: even though RLS should already scope the select, only
  // keep realms the user owns or is linked to as owner/member. A leftover
  // permissive policy (or RLS accidentally disabled) must never leak other
  // people's realms into the UI.
  return (data || [])
    .map(r => ({
      id:           r.id,
      name:         r.name,
      players:      normalizePlayers(r.players),
      createdAt:    r.created_at,
      ownerId:      r.user_id,
      isOwner:      r.user_id === userId, // Gates delete/invite/edit UI for shared realms
      spine:        r.spine, // Book art index, fixed at creation (null on legacy realms)
      chest:        r.chest, // Treasure chest index, fixed at creation
    }))
    .filter(r =>
      r.isOwner ||
      r.players.some(p => p.userId === userId && (p.status === 'owner' || p.status === 'member'))
    );
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
    players:       toDbPlayers(realm.players),
    created_at:    realm.createdAt,
    user_id:       userId, // Enforce ownership
    spine:         realm.spine ?? null, // Fixed at creation; legacy realms stay null
    chest:         realm.chest ?? null, // Fixed at creation
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

// ── Realm sharing (invites & membership) ─────────────────────────────────────
// Membership lives in the realm's players jsonb; all membership writes go
// through SECURITY DEFINER RPCs (migrations/realm_members_to_players.sql).

/**
 * SEND A GROUP INVITE
 *
 * Owner invites another account (by email) to one of the group's uninvited
 * players. The RPC validates ownership, the player slot, and that the email
 * has an account — errors come back with user-facing messages ("No account
 * found with that email.", "That player is already linked…").
 */
export async function sendRealmInvite(realmId, email, playerName) {
  const { error } = await supabase.rpc('invite_to_realm', {
    p_realm_id: realmId,
    p_email:    email,
    p_player:   playerName,
  });
  if (error) throw new Error(error.message || 'Failed to send invite');
}

/**
 * PENDING INVITES FOR THE SIGNED-IN USER
 *
 * Everything the accept/decline prompt shows: group name, its players, which
 * player this account would be linked to, and who invited them (the owner's
 * display name plus account email).
 */
export async function getPendingInvites() {
  const { data, error } = await supabase.rpc('list_my_pending_invites');
  if (error) return [];
  return (data || []).map(i => ({
    realmId:      i.realm_id,
    realmName:    i.realm_name,
    players:      normalizePlayers(i.players),
    playerName:   i.player_name,
    inviterName:  i.inviter_name,
    inviterEmail: i.inviter_email,
  }));
}

/**
 * ACCEPT OR DECLINE AN INVITE
 *
 * Keyed by realm — an account has at most one player element per realm.
 * Accept flips it to 'member' (the shared realm becomes visible); decline
 * resets it to uninvited, freeing the player slot for a future invite.
 */
export async function respondToInvite(realmId, accept) {
  const { error } = await supabase.rpc('respond_to_realm_invite', {
    p_realm_id: realmId,
    p_accept:   accept,
  });
  if (error) throw new Error(error.message || 'Failed to respond to invite');
}

/**
 * EMAILS OF A REALM'S LINKED ACCOUNTS
 *
 * Read-time lookup for the status-label tooltips — emails are deliberately
 * not stored in the players jsonb. Returns a { userId: email } map; empty on
 * error (tooltips just don't show).
 */
export async function getRealmMemberEmails(realmId) {
  const { data, error } = await supabase.rpc('get_realm_member_emails', {
    p_realm_id: realmId,
  });
  if (error) {
    console.warn('getRealmMemberEmails failed (status tooltips disabled):', error.message);
    return {};
  }
  return Object.fromEntries((data || []).map(r => [r.user_id, r.email]));
}

/**
 * LEAVE A SHARED REALM
 *
 * Member removes their own membership; the realm and its games disappear
 * from their account on the next realms refresh.
 */
export async function leaveRealm(realmId) {
  const { error } = await supabase.rpc('leave_realm', { p_realm_id: realmId });
  if (error) throw new Error(error.message || 'Failed to leave realm');
}

// ── Games ─────────────────────────────────────────────────────────────────────

/**
 * RETRIEVE VISIBLE GAMES
 *
 * Fetches game history for every realm the user can access. RLS
 * (migrations/realm_sharing.sql) scopes the select to games whose realm the
 * user owns or is an accepted member of; anon sessions get an empty result.
 *
 * @returns {Promise<Array>} Array of game objects with normalized structure
 */
export async function getGames() {
  const { data } = await supabase
    .from('games')
    .select('*')
    .order('inserted_at', { ascending: false }); // Newest first for recent game display
    
  // Normalize database structure to application format
  return (data || []).map(g => {
    // Transform database achievement columns back to UI format
    const achievements = {};
    if (g.longest_road)    achievements.longestRoad    = g.longest_road;
    if (g.largest_city)    achievements.largestCity    = g.largest_city;
    if (g.largest_field)   achievements.largestField   = g.largest_field;
    if (g.longest_inn)     achievements.longestInn     = g.longest_inn;
    if (g.largest_cathedral) achievements.largestCathedral = g.largest_cathedral;
    if (g.biggest_pig)     achievements.biggestPig     = g.biggest_pig;
    if (g.largest_barn)    achievements.largestBarn    = g.largest_barn;
    if (g.most_monastery)  achievements.mostMonastery  = g.most_monastery;
    if (g.best_trader)     achievements.bestTrader     = g.best_trader;

    return {
      id:            g.id,
      realmId:       g.realm_id,      // Foreign key to realms table
      date:          g.date,          // Game date (YYYY-MM-DD)
      players:       g.players    || [], // Player objects with scores and breakdowns
      expansions:    g.expansions || [], // Active expansion names
      winners:       g.winners    || [], // Precomputed winners from database
      maxScore:      g.max_score  || 0,  // Maximum score in the game
      clutchWin:     g.clutch_win || false, // Close game victory flag
      farmWin:       g.farm_win   || false, // Farm-dominant victory flag
      achievements,  // Live-tracked achievements in UI format
      gameDuration:  g.duration || 0, // Game duration in milliseconds
      scoreTimeline: g.score_timeline || [], // Scoring events: {player, type, amount, t (elapsed ms)}
    };
  });
}

/**
 * CREATE NEW GAME RECORD
 *
 * Persists completed game data to database.
 * Games are associated with realms for organization and access control.
 * Stores live-tracked game achievements (longest road, largest city, etc.).
 *
 * @param {Object} game - Game object with players, scores, expansions, maxFeatures, etc.
 */
// Requires: ALTER TABLE games ADD COLUMN IF NOT EXISTS score_timeline jsonb DEFAULT '[]'::jsonb;
export async function insertGame(game) {
  // maxFeatures is live-tracked during gameplay: {road: {amount, player}, city: {amount, player}, ...}
  // Map to database column names
  const maxFeatures = game.maxFeatures || {};

  await supabase.from('games').insert({
    id:               game.id,
    realm_id:         game.realmId  || null, // Optional realm association
    date:             game.date,              // YYYY-MM-DD format
    players:          game.players,           // Array of player objects
    expansions:       game.expansions || [],  // Active expansion names
    winners:          game.winners    || [],  // Precomputed winners from frontend
    max_score:        game.maxScore  || 0,    // Maximum score in the game
    clutch_win:       game.clutchWin  || false, // Victory in close game
    farm_win:         game.farmWin    || false, // Victory via farm dominance
    duration:         game.gameDuration || 0, // Game duration in milliseconds
    score_timeline:   game.scoreTimeline || [], // Scoring events with elapsed-time offsets
    longest_road:      maxFeatures.road        || null,
    largest_city:      maxFeatures.city        || null,
    largest_field:     maxFeatures.field       || null,
    longest_inn:       maxFeatures.inn         || null,
    largest_cathedral: maxFeatures.cathedral   || null,
    biggest_pig:       maxFeatures.pig         || null,
    largest_barn:      maxFeatures.barn        || null,
    most_monastery:    maxFeatures.monastery   || null,
    best_trader:       maxFeatures.bestTrader  || null,
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
// Schema (one row per user):
//   create table user_expansions (
//     user_id uuid primary key references auth.users(id) on delete cascade,
//     owned   jsonb not null default '[]'::jsonb  -- canonical names of owned expansions
//   );
// The catalog itself (name/type/order) lives in code (DEFAULT_EXPANSIONS); the DB only
// records which expansions each user owns.

export async function getExpansions(userId) {
  if (!userId) return DEFAULT_EXPANSIONS;
  const { data } = await supabase
    .from('user_expansions')
    .select('owned')
    .eq('user_id', userId)
    .maybeSingle();

  // No saved row yet → fall back to catalog defaults (River/Abbot owned).
  if (!data) return DEFAULT_EXPANSIONS;

  // Rebuild from the canonical catalog, applying the user's saved ownership.
  // Any stored name not in the catalog (e.g. legacy comma-less duplicates) is ignored.
  const ownedSet = new Set(data.owned || []);
  return DEFAULT_EXPANSIONS.map(e => ({ ...e, owned: ownedSet.has(e.name) }));
}

export async function saveOwnedExpansions(ownedNames, userId, email) {
  if (!userId) return;
  // email is stored only to make the table human-readable in the DB editor.
  const row = { user_id: userId, owned: ownedNames };
  if (email) row.email = email;
  await supabase
    .from('user_expansions')
    .upsert(row, { onConflict: 'user_id' });
}

// ── Account settings ──────────────────────────────────────────────────────────

/**
 * Update the account's display name (auth user_metadata.display_name).
 * The USER_UPDATED auth event refreshes the app-wide user state, so the new
 * name shows up everywhere without a re-login. Existing realm player slots
 * keep their names — display_name only prefills future realms.
 *
 * @param {string} name - New display name (caller trims/validates)
 */
export async function updateDisplayName(name) {
  const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
  if (error) throw new Error(error.message || 'Failed to update display name');
}

/**
 * Persist the highest meta-rank the account has ever achieved
 * (auth user_metadata.highest_meta_rank). Only ever written upward — the
 * displayed rank is max(computed, stored) so it never visibly regresses,
 * even if the total tier pool grows later.
 *
 * @param {number} rank - Meta rank (1-20)
 */
export async function updateHighestMetaRank(rank) {
  const { error } = await supabase.auth.updateUser({ data: { highest_meta_rank: rank } });
  if (error) throw new Error(error.message || 'Failed to update meta rank');
}

// ── Account deletion ──────────────────────────────────────────────────────────

/**
 * DELETE ACCOUNT (GDPR/CCPA right to be forgotten)
 *
 * Cascades: shared-realm links → games → realms → user_expansions → auth user.
 * The auth.users delete is handled by the delete_user() RPC (SECURITY DEFINER).
 * Memberships live in other owners' realms.players jsonb, so they must be
 * reset explicitly via the unlink RPC — there is no FK cascade for them.
 *
 * @param {string} userId - Supabase auth user ID
 */
export async function deleteAccount(userId) {
  if (!userId) throw new Error('deleteAccount called without userId');

  // 0. Reset this account's player links in realms it doesn't own, so those
  //    groups show the slot as uninvited again.
  await supabase.rpc('unlink_me_from_shared_realms');

  // 1. Delete all games belonging to the user's realms
  const { data: realms } = await supabase
    .from('realms')
    .select('id')
    .eq('user_id', userId);

  const realmIds = (realms || []).map(r => r.id);
  if (realmIds.length > 0) {
    await supabase.from('games').delete().in('realm_id', realmIds);
  }

  // 2. Delete all realms
  await supabase.from('realms').delete().eq('user_id', userId);

  // 3. Delete expansion ownership record
  await supabase.from('user_expansions').delete().eq('user_id', userId);

  // 4. Delete the auth user via SECURITY DEFINER RPC
  const { error } = await supabase.rpc('delete_user');
  if (error) throw new Error(error.message || 'Failed to delete account');
}

// ── localStorage migration (runs once on first load) ─────────────────────────
/**
 * One-time migration from localStorage to Supabase database.
 * Migrates user data including realms, games, expansions, and board state.
 * Runs only once per user, tracked by localStorage migration flag.
 * Safely handles missing or corrupted data during the transition.
 * i do not understand what this function is used for. 
 */

export async function migrateFromLocalStorage(userId, email) {
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
            players:    toDbPlayers(r.players), // legacy backups store plain name strings
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
        const { winners } = computeWinners(Object.fromEntries(g.players.map(p => [p.name, p.score || 0])));
        
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

    if (rawExpansions && userId) {
      const exps = JSON.parse(rawExpansions);
      const ownedNames = exps.filter(e => e.owned).map(e => e.name);
      const row = { user_id: userId, owned: ownedNames };
      if (email) row.email = email;
      await supabase
        .from('user_expansions')
        .upsert(row, { onConflict: 'user_id' });
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
