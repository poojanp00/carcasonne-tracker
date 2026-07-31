import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PostGameForm  from './components/PostGameForm';
import RealmsTab     from './components/RealmsTab';
import Profile       from './components/Profile';
import { GUEST_ALLOWED_MINIS } from './data/expansions';
import Board         from './components/Board';
import PreGameSetup  from './components/PreGameSetup';
import Auth          from './components/Auth';
import Landing       from './components/Landing';
import InvitePrompt  from './components/InvitePrompt';
import { useGameData } from './hooks/useGameData';
import { useAuth }     from './hooks/useAuth';
import { resetBoard }  from './data/boardStorage';
import {
  deleteAccount, sendRealmInvite, updateDisplayName,
  getUserProgress, acknowledgeRankUp,
  acknowledgeRankUpFor,
  getMilestoneConfig, getMaxRankConfig,
  getArtUnlockState, saveArtUnlockState,
} from './data/storage';
import { getGuestMetaRank, setGuestMetaRank, buildRankUpDiff, applyMaxRank } from './utils/metaRank';
import { createInitialArtUnlockState, syncArtUnlocks, unlockedIndices } from './utils/artUnlocks';
import { applyMilestoneConfig } from './data/accountMilestones';
import RankUpModal from './components/RankUpModal';
import { ProfileTabTourCard } from './components/HowToGuide';
import { useTourHighlightRect } from './hooks/useTourHighlightRect';
import { DEFAULT_EXPANSIONS } from './data/expansions';
import { TABS, APP_CONFIG, EXPANSION_TYPES, PINNED_EXPANSIONS } from './constants';


function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}


export default function App() {
  const [session,        setSession]        = useState(null);
  // 'realms' (not 'home'/About) is the landing page — where a user first
  // lands after auth and where goHome/guest-entry return them.
  const [tab,            setTab]            = useState('realms');
  const [gameKey,        setGameKey]        = useState(0);
  const [toast,          setToast]          = useState(null);
  const [openGame,       setOpenGame]       = useState(null);
  const [hubResetKey,    setHubResetKey]    = useState(0);
  // Lifted (not owned by RealmsTab) because the Realms guided tour spans a
  // chest click into PreGameSetup and back — RealmsTab unmounts for that
  // whole stretch (App.jsx swaps in PreGameSetup while `session` is set), so
  // "is the tour on" has to live somewhere that survives the boundary.
  const [tourActive,    setTourActive]      = useState(false);
  // Whether the Realms guided tour's two forked paths (Chests / Log Book)
  // have each been visited at least once this tour — once both are true the
  // tour closes itself instead of looping at the hub forever. Lifted here
  // (not owned by RealmsTab) for the same reason as `tourActive`: the chest
  // path's walkthrough unmounts RealmsTab entirely while PreGameSetup is
  // swapped in, so local state there wouldn't survive the round trip.
  const [tourVisitedChest, setTourVisitedChest] = useState(false);
  const [tourVisitedBook,  setTourVisitedBook]  = useState(false);
  // Third leg of the same tour — set the moment the user clicks the real
  // Profile tab from the Realms tour (see handleTabChange below), not on
  // finishing Profile's own tour, matching how tourVisitedChest/Book already
  // mark "entered", not "completed" (see handlePlayRealm/handleOpenBook in
  // RealmsTab.jsx).
  const [tourVisitedProfile, setTourVisitedProfile] = useState(false);
  // Whether RealmsTab is currently showing its own hub (vs. an open
  // logbook) — reported up via RealmsTab's onHubStageChange, since that
  // state (openBookRealmId/page) is local to it. Combined with `!session`
  // (true whenever the chest path's PreGameSetup/Board is what's actually
  // rendered) below, this is what keeps the Profile leg's card/highlight
  // (see profileLegActive) from showing while the user is inside either the
  // chest or logbook path instead of at the hub itself. Defaults to true —
  // the hub is what's shown before RealmsTab's first effect run.
  const [atRealmsHub, setAtRealmsHub] = useState(true);
  // Whichever realm the hub should scroll to and briefly highlight next —
  // one just created, or one just returned from (pregame setup's own
  // "back", or the post-game form's chest icon once a game's recorded) —
  // so that realm's card doesn't just vanish back into the grid unseen.
  // Cleared once RealmsHub has actually scrolled to it (see
  // onScrollToRealmConsumed below), or on leaving the tab as a safety net.
  const [hubSpotlightRealmId, setHubSpotlightRealmId] = useState(null);
  // Whether the Realms/Profile guided tours have already auto-opened once
  // this guest session — each only auto-opens the *first* time a guest
  // reaches that tab; after that they have to click "?" themselves (see
  // RealmsTab.jsx/Profile.jsx). Reset when guest mode is exited, below, so
  // a later guest session starts fresh.
  const [guestRealmsTourShown,  setGuestRealmsTourShown]  = useState(false);
  const [guestProfileTourShown, setGuestProfileTourShown] = useState(false);
  // Set once the Realms tour genuinely completes (both paths visited — see
  // handleRealmsTourComplete below) so Profile knows to auto-start its own
  // tour the moment it mounts, continuing the same onboarding walkthrough
  // regardless of guest/signed-in tourShown gating. Profile resets it via
  // onAutoStartTourConsumed once it's acted on it.
  const [profileTourAutoStart, setProfileTourAutoStart] = useState(false);
  const handleTourActiveChange = useCallback((active) => {
    setTourActive(active);
    if (active) {
      setTourVisitedChest(false);
      setTourVisitedBook(false);
      setTourVisitedProfile(false);
    }
  }, []);
  // Takes the Profile leg of the Realms tour — fires when the user clicks
  // the real Profile tab while the Realms tour is active (see
  // handleTabChange). Marks that leg visited and hands off into Profile's
  // own tour, but deliberately does NOT end the Realms tour itself —
  // RealmsTab.jsx's own completion effect is what decides that, gated on
  // `tourStage === 'hub'` so entering the last remaining leg (chest or
  // logbook) doesn't get read as "done" before its own walkthrough has even
  // started (see that effect's comment for why this has to be checked
  // locally there, not from a flags-only effect up here).
  const handleRealmsTourComplete = useCallback(() => {
    setTourVisitedProfile(true);
    setTab('me');
    setProfileTourAutoStart(true);
  }, []);
  // Mirrors the above in reverse once Profile's own tour finishes — always
  // returns to Realms; whether the tour still has anything left to show
  // there is already decided (see RealmsTab.jsx's completion effect).
  const handleProfileTourComplete = useCallback(() => {
    setTab('realms');
  }, []);
  // Which gameKey the guest how-to guide has already auto-shown for — lives here (not in
  // Board) so switching tabs away and back to the same game doesn't re-trigger it, while a
  // genuinely new game (new gameKey) still gets a fresh auto-show.
  const howToShownForGameRef = useRef(null);
  // Docking target for ProfileTabTourCard (see handleTabChange/tab-nav below) —
  // the Realms tour's third leg, pointing an arrow up at the real Profile tab.
  const meTabRef = useRef(null);
  // Same condition as ProfileTabTourCard's own — this leg of the tour is
  // "on". Drives both the card and the tab's own spotlight (see
  // meTabHighlightRect below) together. Restricted to the hub itself
  // (!session excludes the chest path, atRealmsHub excludes the logbook) —
  // showing "go check your Profile" while already mid-chest-setup or
  // mid-logbook would just be noise on top of whatever that path's own tour
  // card is already saying.
  const profileLegActive = tourActive && tab === 'realms' && !session && atRealmsHub && !tourVisitedProfile;
  // The Profile tab's spotlight is a floating overlay (see
  // useTourHighlightRect) rather than a `.tour-highlight` class on the tab
  // itself — the tab sits inside `.tab-nav`, which clips overflow for its
  // horizontal-scroll behavior, so a box-shadow spotlight applied directly
  // to a descendant would get cut off at the nav's own edge instead of
  // dimming the whole page.
  const meTabHighlightRect = useTourHighlightRect(meTabRef, profileLegActive);

  // Check for recovery mode once on mount
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    return sessionStorage.getItem('isRecoveryMode') === 'true';
  });

  // One-time URL check for recovery parameters on mount only
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const hasRecoveryParams = urlParams.get('type') === 'recovery' || urlParams.has('token');
    const hasHashRecovery = hashParams.get('type') === 'recovery' || hashParams.has('token') || hashParams.has('access_token');
    
    if (hasRecoveryParams || hasHashRecovery) {
      sessionStorage.setItem('isRecoveryMode', 'true');
      setIsRecoveryMode(true);
      console.log('Recovery mode detected and stored');
    }
  }, []); // Only run once on mount

  const { user, authLoading, signOut, completeRecovery, isGuest, enableGuestMode, signOutGuest, guestUserId } = useAuth();
  const userId = isGuest ? guestUserId : user?.id;
  // Signup name — prefills Player 1 when creating a group (empty for guests
  // and for accounts created before the name field existed).
  const displayName = isGuest ? '' : (user?.user_metadata?.display_name || '');
  const { games, expansions, realms, pendingInvites, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm, acceptInvite, declineInvite, leaveSharedRealm } = useGameData(isGuest ? null : user, authLoading || (isGuest && false));

  // Guest mode state — realms/games/expansions live here as plain React
  // state rather than localStorage, so a guest's data never survives a
  // reload; that's intentional, not a gap (a guest can't sign back into
  // anything, so persisting it would just be data with nowhere to go).
  // Board state (data/boardStorage.js) and meta rank (utils/metaRank.js)
  // DO persist to localStorage for guests, each independently, since both
  // are keyed by something stable across a session (a board's realm/players,
  // a rank number) rather than needing the realm list itself to survive.
  const [guestRealms,   setGuestRealms]   = useState([]);
  const [guestExpansionOverrides, setGuestExpansionOverrides] = useState({});

  // Unified data - guest mode provides default data, user mode uses database
  const appData = {
    games: isGuest ? [] : games,
    expansions: isGuest ? DEFAULT_EXPANSIONS.map(exp => {
      const defaultOwned = exp.type === 'mini' && exp.complete;
      return { ...exp, owned: guestExpansionOverrides[exp.name] ?? defaultOwned };
    }) : expansions,
    realms: isGuest ? guestRealms : realms,
    loading: isGuest ? false : loading
  };

  // App-wide config (category/tier thresholds, max rank) — fetched once from
  // Supabase (migrations/milestone_config.sql) and applied in place to the
  // existing JS config modules, so every component that already imports
  // ACCOUNT_MILESTONES/etc keeps working unchanged. Not user-specific — runs
  // once regardless of auth state. Falls back to the hardcoded values
  // already in those modules if the fetch fails.
  useEffect(() => {
    let stale = false;
    (async () => {
      const [milestoneConfig, maxRank] = await Promise.all([
        getMilestoneConfig(),
        getMaxRankConfig(),
      ]);
      if (stale) return;
      if (milestoneConfig) applyMilestoneConfig(milestoneConfig.categories, milestoneConfig.tiers);
      if (maxRank) applyMaxRank(maxRank);
    })();
    return () => { stale = true; };
  }, []);

  // Cached rank/milestone snapshot — the signed-in account's own row,
  // computed and kept up to date entirely server-side (a trigger recomputes
  // it whenever any relevant game/realm/expansion change happens — see
  // migrations/server_side_progress.sql) — the client only ever reads it.
  // Null until the fetch resolves, or for an account with no row yet (no
  // games/realms/expansions ever recorded) — treated as rank 1 / 0 tiers.
  const [selfProgress, setSelfProgress] = useState(null);
  // Chest/logbook art-unlock state (utils/artUnlocks.js) — self-only,
  // account-level, separate from selfProgress. Two independent tracks
  // (chest, logbook). Null until the mount-effect fetch resolves, or for a
  // guest (never fetched/computed at all).
  const [artUnlockState, setArtUnlockState] = useState(null);
  // Every rank's chest+logbook grant pair, accumulated since the last time
  // they were shown, so RankUpModal has something to animate/reveal —
  // without this, artUnlockState would just silently advance with no
  // on-screen feedback at all. Cleared once RankUpModal has shown them (see
  // the render below).
  const [artGrants, setArtGrants] = useState([]);
  // Queue of celebration payloads for the modal — one shared device at the
  // table, not each player checking their own phone later, so after a game
  // is recorded the controller's own screen shows EVERY linked player's
  // pending celebration in turn (see handleRecordGame), not just the
  // controller's own. Each entry carries which realm it came from (needed
  // to acknowledge on another account's behalf) or null for the self-only
  // mount-time fallback below. Cleared on close (after acknowledging the
  // current head) or when a new session starts (handlePlayAgain/
  // exitPreGameToHub) so a stale queue can't resurface.
  const [rankUpQueue, setRankUpQueue] = useState([]);
  const rankUpInfo = rankUpQueue[0] ?? null;
  // Every linked realm member's { rank, categoryProgress }, keyed by
  // lowercased player name — populated after a game is recorded (same fetch
  // that feeds rankUpQueue, see handleRecordGame) so the Final Scores screen
  // can show each player's rank + a "Show Milestones" button without a
  // separate round trip. Cleared alongside rankUpQueue so stale data from a
  // previous game can't resurface.
  const [postGameProgress, setPostGameProgress] = useState({});
  // True from the moment a non-guest game save kicks off until the save +
  // celebration fetch have both fully resolved — PostGameForm shows a
  // full-page loading gate instead of Final Scores while this is true, so
  // rank badges/celebration modals never "pop in" after the page already
  // rendered (see handleRecordGame).
  const [recordingGame, setRecordingGame] = useState(false);

  const queueCelebration = useCallback((entry) => {
    setRankUpQueue(q => [...q, entry]);
  }, []);

  // Self-only fallback, checked once at app load — this account's OWN
  // progress may have moved without anything in THIS session causing it
  // (e.g. played as a non-controlling member on someone else's device
  // earlier). No realmId, so handleCloseRankUp always acknowledges this one
  // via the plain self-only acknowledgeRankUp.
  const checkAndCelebrate = useCallback((row) => {
    if (!row || row.tierCount <= row.lastCelebratedTierCount) return;
    const diff = buildRankUpDiff({
      beforeCategoryProgress: row.lastCelebratedCategoryProgress,
      afterCategoryProgress: row.categoryProgress,
    });
    queueCelebration({
      userId,
      realmId: null,
      playerName: displayName,
      beforeRank: row.lastCelebratedRank,
      afterRank: row.rank,
      beforeTierCount: row.lastCelebratedTierCount,
      tierCount: row.tierCount,
      categoryProgress: row.categoryProgress, // the "after" state, needed to acknowledge on close
      ...diff,
    });
  }, [userId, displayName, queueCelebration]);

  // Serializes every art-unlock sync for this account. React StrictMode
  // double-invokes the mount effect below (mount → cleanup → mount) in dev,
  // and a background token-refresh can similarly remount this effect in
  // prod (see the comment in handleRecordGame) — without this, two
  // near-simultaneous calls could each fetch the SAME stale DB row, then
  // independently draw two different random winners for the same rank.
  // Chaining onto this ref forces each call to build on whatever the
  // previous call already computed before deciding what (if anything) is
  // left to advance.
  const artSyncChainRef = useRef(Promise.resolve());
  // The current authoritative state for a DRAW that's been computed but not
  // yet acknowledged (i.e. the player hasn't finished watching the reveal)
  // — null means "nothing pending, defer to whatever's persisted." Forward
  // draws are deliberately kept OUT of the database until
  // acknowledgeArtGrants below actually saves them: persisting immediately
  // (the old behavior) meant a refresh mid-celebration silently locked in
  // whatever had just been drawn, with no record left of "this still needs
  // to be shown" — the flip-reveal state lived only in React state
  // (artGrants), so it vanished on reload while the grant itself had
  // already been committed server-side. Deferring the save means a refresh
  // before acknowledging just leaves the true persisted state untouched, so
  // the next sync re-draws (and re-shows) fresh instead of silently
  // consuming the prize unseen.
  const pendingArtStateRef = useRef(null);

  // Brings both chest/logbook tracks to targetRank, starting from whatever
  // draw is already pending-but-unacknowledged this session, or the latest
  // persisted state otherwise. syncArtUnlocks picks the direction itself —
  // advances (drawing new grants) when targetRank is higher, retreats
  // (revoking grants back into the pool) when a deleted realm/game has
  // lowered rank — and is a documented no-op (returns the same object
  // reference) when targetRank already matches.
  const syncArtUnlocksToRank = useCallback((targetRank) => {
    const run = artSyncChainRef.current
      .catch(() => {})
      .then(async () => {
        const baseState = pendingArtStateRef.current || (await getArtUnlockState(userId)) || createInitialArtUnlockState();
        // Regression has no reveal to wait on — it's silent, so it commits
        // right away rather than sitting in the pending ref forever.
        const isRegression = targetRank < baseState.chest.processedRank;
        const { state: nextState, chestGrants, logbookGrants } = syncArtUnlocks(baseState, targetRank);
        setArtUnlockState(nextState);

        if (isRegression) {
          pendingArtStateRef.current = null;
          if (nextState !== baseState) {
            return saveArtUnlockState(userId, nextState).catch(err =>
              console.warn('saveArtUnlockState failed:', err.message));
          }
          return;
        }

        pendingArtStateRef.current = nextState;
        // Rank 1's grant is a fixed, single-candidate freebie (not a real
        // draw) — skip surfacing it in the reveal modal, only ranks 2+ show.
        // chestGrants/logbookGrants always share the same rank sequence
        // (both tracks process identical rank ranges in lockstep), so they
        // zip together by index.
        const rows = chestGrants
          .map((chest, i) => ({ rank: chest.rank, chest, logbook: logbookGrants[i] }))
          .filter(row => row.rank !== 1);
        if (rows.length > 0) setArtGrants(prev => [...prev, ...rows]);
      });
    artSyncChainRef.current = run;
    return run;
  }, [userId]);

  // Actually persists whatever draw is currently pending — called once the
  // player has watched the artGrants stage through to the end (see
  // RankUpModal's onClose below), never before. A refresh/close before that
  // point leaves pendingArtStateRef's contents unsaved, so the next sync
  // starts over from the last truly persisted state instead of resuming a
  // reveal that no longer has anything to show.
  const acknowledgeArtGrants = useCallback(() => {
    const state = pendingArtStateRef.current;
    pendingArtStateRef.current = null;
    if (!state) return;
    saveArtUnlockState(userId, state).catch(err =>
      console.warn('saveArtUnlockState failed:', err.message));
  }, [userId]);

  // Re-fetches this account's own progress and brings the art-unlock tracks
  // in line with it — needed after deleting a game/realm or leaving a
  // shared one, none of which flow through the normal post-game path, but
  // all of which can lower milestone progress server-side (the delete/leave
  // triggers in server_side_progress.sql already recomputed user_progress
  // by the time this runs) without anything else in this component noticing
  // on its own. Deliberately no celebration check here — deleting/leaving
  // can only lower progress, never cross a rank upward.
  const resyncSelfProgress = useCallback(() => {
    if (isGuest || !userId) return;
    getUserProgress(userId).then((row) => {
      if (!row) return;
      setSelfProgress(row);
      syncArtUnlocksToRank(row.rank);
    });
  }, [userId, isGuest, syncArtUnlocksToRank]);

  useEffect(() => {
    if (isGuest || !userId) { setSelfProgress(null); setArtUnlockState(null); setArtGrants([]); pendingArtStateRef.current = null; return; }
    if (appData.loading) return;
    let stale = false;
    getUserProgress(userId).then((row) => {
      if (stale || !row) return;
      setSelfProgress(row);
      checkAndCelebrate(row);
      syncArtUnlocksToRank(row.rank);
    });
    return () => { stale = true; };
  }, [userId, isGuest, appData.loading, checkAndCelebrate, syncArtUnlocksToRank]);

  const storedMetaRank = isGuest ? getGuestMetaRank() : (selfProgress?.rank || 0);

  // Chest/logbook indices actually selectable in the realm chest/logbook
  // pickers (PreGameSetup.jsx/RealmSettingsModal.jsx) — driven independently
  // by each track in the art-unlock system (utils/artUnlocks.js), not
  // account rank: a locked tile stays locked until its own item is actually
  // drawn, whatever rank that happens at. Defaults to just item 1's index
  // while artUnlockState hasn't loaded yet, never assuming more is unlocked
  // than confirmed. Guests bypass this entirely via their own isGuest-gated
  // lock in those components.
  const unlockedChestIndices = useMemo(
    () => unlockedIndices(artUnlockState?.chest.unlocked ?? [1]),
    [artUnlockState]
  );
  const unlockedLogbookIndices = useMemo(
    () => unlockedIndices(artUnlockState?.logbook.unlocked ?? [1]),
    [artUnlockState]
  );

  const handleCloseRankUp = useCallback(() => {
    const info = rankUpInfo;
    setRankUpQueue(q => q.slice(1)); // advance to the next queued celebration, if any
    if (!info) return;
    const isSelf = !info.realmId || info.userId === userId;
    const ack = isSelf
      ? acknowledgeRankUp(info.afterRank, info.tierCount, info.categoryProgress)
      : acknowledgeRankUpFor(info.realmId, info.userId, info.afterRank, info.tierCount, info.categoryProgress);
    ack
      .then(() => {
        if (!isSelf) return; // only this account's own selfProgress cache needs updating
        setSelfProgress(prev => (prev ? {
          ...prev,
          lastCelebratedRank: info.afterRank,
          lastCelebratedTierCount: info.tierCount,
          lastCelebratedCategoryProgress: info.categoryProgress,
        } : prev));
      })
      .catch(err => console.warn('acknowledgeRankUp failed:', err.message));
  }, [rankUpInfo, userId]);

  // Unified operations - guest mode uses no-ops, user mode uses database
  const appOperations = {
    addGame: isGuest ? () => Promise.resolve('guest-game-id') : addGame,
    deleteGame: isGuest ? () => {} : deleteGame,
    toggleExpansion: isGuest ? (name) => {
      if (!GUEST_ALLOWED_MINIS.has(name)) return;
      setGuestExpansionOverrides(prev => ({ ...prev, [name]: !(prev[name] ?? true) }));
    } : toggleExpansion,
    addRealm: isGuest ? (data) => {
      const guestRealm = {
        id: `guest-realm-${Date.now()}`,
        name: data.name || 'Guest Realm',
        // Same object shape as DB realms; guest players are never linked
        players: (data.players || []).map(name => ({ name, userId: null, status: 'uninvited' })),
        created_at: new Date().toISOString(),
        isOwner: true, // Uniform owner-gating shape with DB realms
        spine: data.spine, // User-chosen logbook art
        chest: data.chest, // User-chosen chest art
      };
      setGuestRealms([guestRealm]);
      return Promise.resolve(guestRealm);
    } : addRealm,
    updateRealm: isGuest ? () => {} : updateRealm,
    removeRealm: isGuest ? (realmId) => {
      setGuestRealms(prev => prev.filter(r => r.id !== realmId));
    } : removeRealm
  };

  // Clear guest data when exiting guest mode
  useEffect(() => {
    if (!isGuest) {
      setGuestRealms([]);
      setGuestExpansionOverrides({});
      setGuestRealmsTourShown(false);
      setGuestProfileTourShown(false);
      if (session && session.realm?.id?.includes('guest-realm')) {
        setSession(null);
      }
    }
  }, [isGuest, session]);

  const goHome = useCallback(() => {
    setSession(null);
    setTab('realms');
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), APP_CONFIG.TOAST_DURATION);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    setSession({ realm });
  }, []);

  // Shared by every PreGameSetup instance's onExitToHub (the chest icon,
  // "← Back", and the play-path tour's own Begin/Next/× all funnel through
  // this single prop — see PreGameSetup.jsx) so "return to hub" is wired
  // the same correct way regardless of which route got us into
  // PreGameSetup: an existing realm (`session.realm` set) spotlights it;
  // the realm-creation and no-realms routes have no realm yet at this
  // point, so `session?.realm?.id` is just undefined and nothing lights up.
  // Skipped entirely while the tour is driving this exit — the tour's own
  // steady highlight on that realm's card (RealmsTab.jsx's
  // highlightRealmId) already provides the focus; layering the brief
  // just-created-style fade spotlight on top of it doubles up and fights
  // for attention instead of helping.
  const exitPreGameToHub = useCallback(() => {
    const realmId = session?.realm?.id;
    if (realmId && !tourActive) setHubSpotlightRealmId(realmId);
    setSession(null);
    setRankUpQueue([]);
    setPostGameProgress({});
    setRecordingGame(false);
  }, [session, tourActive]);

  const handleRealmCreate = useCallback(async (data) => {
    try {
      // addRealm embeds the creator's 'owner' element from data.selfPlayer —
      // no separate claim step needed anymore.
      const realm = await appOperations.addRealm(data);
      // Everyone lands back on the Realms hub (not straight into meeple
      // selection) so they can see the chest/logbook combo they just picked
      // sitting on its own realm card — see the scroll-to effect this feeds
      // in RealmsHub. "Play Again" (a *different* flow, off an existing
      // realm — see handlePlayAgain) still goes straight back to Players.
      setHubSpotlightRealmId(realm.id);
      setSession(null);
      if (isGuest) {
        // Guests additionally get the guided tour on immediately, always,
        // for a first-timer.
        handleTourActiveChange(true);
        setGuestRealmsTourShown(true);
      }
    } catch (err) {
      console.error('create realm failed', err);
      showToast(`Failed to create realm: ${err?.message || 'Unknown error'}`);
    }
  }, [appOperations.addRealm, showToast, isGuest, handleTourActiveChange]);


  const handleGameStart = useCallback(async (setup) => {
    const extraTypes = (setup.expansions || []).flatMap(e => EXPANSION_TYPES[e] || []);
    await resetBoard(userId, setup.players, extraTypes, isGuest);
    setSession(prev => ({ ...prev, ...setup, finalScores: null }));
    setGameKey(k => k + 1);
  }, [userId, isGuest]);

  // Board's own Reset button already rewrote board_state (moves/scores back
  // to zero, same players/expansions — see Board.jsx's confirmResetBoard)
  // by the time this fires. Bumping gameKey just remounts Board (same
  // pattern handleGameStart uses) so it re-fetches that freshly-reset
  // state — session itself (players/meeples/expansions) is untouched, so
  // this stays on the scoreboard with the same setup instead of falling
  // back to PreGameSetup.
  const handleBoardReset = useCallback(() => {
    setGameKey(k => k + 1);
  }, []);

  const handleFinishGame = useCallback((finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline) => {
    setSession(prev => ({ ...prev, finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline }));
    setTab('realms');
    window.scrollTo(0, 0);
  }, []);

  const handleRecordGame = useCallback(async (gameData) => {
    if (isGuest) {
      // For guests, redirect to sign-in instead of recording
      setSession(null);
      setTab('realms');
      signOutGuest();
      return;
    }
    // Idempotency guard: PostGameForm auto-submits via a mount-local ref,
    // which resets if it ever remounts (e.g. a background Supabase token
    // refresh briefly flips appData.loading, unmounting/remounting the whole
    // signed-in tree — see useGameData.js). `session` lives in App, not in
    // that subtree, so it survives such a remount and reliably blocks a
    // second auto-submit from re-inserting the same game.
    if (session?.recorded) return;
    setSession(prev => ({ ...prev, recorded: true }));
    setRecordingGame(true);
    const fullGameData = { ...gameData, realmId: session.realm.id };
    let celebrationRows;
    try {
      // insertGameAndCelebrate does the insert AND returns every linked
      // realm member's updated rank/progress in the SAME round-trip (see
      // migrations/insert_game_and_celebrate.sql) — the games-insert
      // trigger (server_side_progress.sql) already recomputed user_progress
      // for every linked account (owner and every member) synchronously
      // within that same insert, so there's no need for a second, separate
      // fetch afterward. One shared device at the table, so show every
      // linked player's pending celebration on THIS screen, not just
      // whoever's holding it.
      ({ celebrations: celebrationRows } = await appOperations.addGame(fullGameData));
    } catch (err) {
      showToast(`Failed to record game: ${err?.message || 'Unknown error'}`);
      setRecordingGame(false);
      return;
    }
    showToast('Game recorded in the logbook.');
    // Keep the session as-is so PostGameForm can still show breakdown/winner
    // User will click "Play Again" to reset and go back to scoreboard

    try {
      const rows = celebrationRows || [];
      const ownRow = rows.find(r => r.userId === userId);
      if (ownRow) setSelfProgress(ownRow);
      // syncArtUnlocksToRank always re-reads the latest persisted state
      // itself (see its definition), so this runs unconditionally — no
      // guard needed for a brand new account's first game (no row existed
      // yet) or for a mount-effect sync still in flight (they're chained,
      // not raced).
      if (ownRow) {
        syncArtUnlocksToRank(ownRow.rank);
      }
      setPostGameProgress(Object.fromEntries(
        rows.map(r => [r.name.toLowerCase(), { rank: r.rank, categoryProgress: r.categoryProgress }])
      ));

      // Controller's own entry first (if any), then everyone else.
      const sorted = [...rows].sort((a, b) => (a.userId === userId ? -1 : b.userId === userId ? 1 : 0));
      const newEntries = sorted
        .filter(r => r.tierCount > r.lastCelebratedTierCount)
        .map(r => {
          const diff = buildRankUpDiff({
            beforeCategoryProgress: r.lastCelebratedCategoryProgress,
            afterCategoryProgress: r.categoryProgress,
          });
          return {
            userId: r.userId,
            realmId: session.realm.id,
            playerName: r.name,
            beforeRank: r.lastCelebratedRank,
            afterRank: r.rank,
            beforeTierCount: r.lastCelebratedTierCount,
            tierCount: r.tierCount,
            categoryProgress: r.categoryProgress,
            ...diff,
          };
        });
      if (newEntries.length > 0) setRankUpQueue(q => [...q, ...newEntries]);
    } catch (err) {
      console.warn('post-save progress refresh failed:', err.message);
    }
    setRecordingGame(false);
  }, [appOperations.addGame, session, showToast, isGuest, signOutGuest, userId, syncArtUnlocksToRank]);

  const handlePlayAgain = useCallback(async () => {
    // Reset board and show expansion selection screen
    const realm = session?.realm;
    const players = session?.players || [];
    const meeples = session?.meeples || {};
    const expansions = session?.expansions || [];
    await resetBoard(userId, players, [], isGuest);
    // Clear players so PreGameSetup shows (will be pre-filled from realm)
    // Keep meeples and expansions for next game
    setSession({
      realm,
      lastMeeples: meeples,
      lastExpansions: expansions,
    });
    setRankUpQueue([]);
    setPostGameProgress({});
    setRecordingGame(false);
    setTab('realms');
  }, [session, resetBoard, userId, isGuest]);

  const handleDelete = useCallback(async (id) => {
    try {
      await appOperations.deleteGame(id);
    } catch (err) {
      showToast(`Failed to remove game: ${err?.message || 'Unknown error'}`);
      return;
    }
    showToast('Game removed.');
    // The games-delete trigger (migrations/server_side_progress.sql) already
    // recomputed user_progress server-side for every linked account in that
    // realm — resyncSelfProgress just pulls that fresh row into this
    // account's own local state, so a rank drop correctly reverses any
    // chest/logbook grants that no longer apply.
    resyncSelfProgress();
  }, [appOperations.deleteGame, showToast, resyncSelfProgress]);

  const handleRealmDelete = useCallback(async (realmId) => {
    try {
      await appOperations.removeRealm(realmId);
    } catch (err) {
      showToast(`Failed to delete realm: ${err?.message || 'Unknown error'}`);
      return;
    }
    const remaining = appData.realms.filter(r => r.id !== realmId);
    if (session?.realm?.id === realmId) {
      if (remaining.length > 0) {
        setSession({ realm: remaining[0] });
      } else {
        setSession(null);
        setTab('realms');
      }
    }
    window.scrollTo(0, 0); // Delete button sits at the page bottom
    showToast('Realm deleted.');
    resyncSelfProgress();
  }, [appOperations.removeRealm, session, appData.realms, showToast, resyncSelfProgress]);

  // ── Realm sharing ──
  const handleExportGroup = useCallback(
    (realmId, email, playerName) => sendRealmInvite(realmId, email, playerName),
    []
  );

  const handleInviteAccept = useCallback(async (realmId) => {
    await acceptInvite(realmId);
    showToast('Realm added to your account.');
  }, [acceptInvite, showToast]);

  const handleInviteDecline = useCallback(
    (realmId) => declineInvite(realmId),
    [declineInvite]
  );

  const handleRealmLeave = useCallback(async (realmId) => {
    await leaveSharedRealm(realmId);
    // Fall back to the first remaining group so the stats page doesn't go blank
    const remaining = appData.realms.filter(r => r.id !== realmId);
    if (session?.realm?.id === realmId) {
      if (remaining.length > 0) {
        setSession({ realm: remaining[0] });
      } else {
        setSession(null);
      }
    }
    window.scrollTo(0, 0); // Leave button sits at the page bottom
    showToast('You left the realm.');
    resyncSelfProgress();
  }, [leaveSharedRealm, session, appData.realms, showToast, resyncSelfProgress]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    appOperations.updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, appOperations.updateRealm]);

  const handleTabChange = useCallback((id) => {
    // Clicking the real Profile tab mid-Realms-tour takes the tour's third
    // leg (see handleRealmsTourComplete) — doesn't end tourActive itself
    // (that's decided once all three legs are visited, see the effect near
    // tourVisitedProfile above), so if a leg's still unvisited the Realms
    // tour just picks back up once the user returns. Mirrors how the chest/
    // logbook icons themselves, not a button, drive those two legs —
    // clicking the real tab is what drives this one (see ProfileTabTourCard,
    // docked beside it).
    if (id === 'me' && tourActive && tab === 'realms') {
      handleRealmsTourComplete();
      return;
    }
    if (id === 'realms') {
      // Re-clicking the Realms tab while already there backs out to the hub —
      // closes an open logbook, or resets a non-active in-progress session.
      if (tab === 'realms') setHubResetKey(k => k + 1);
      // Entering (or re-entering) the hub should always land there unless
      // there's an active game (players dealt) or a just-finished one
      // waiting on final scores to resume — check on every visit, not just
      // when leaving, so a stale in-progress setup never persists underneath.
      if (!session?.players && !session?.finalScores) setSession(null);
    } else {
      // Clear postgame state and players when leaving the Realms tab to return to pregame setup
      if (session?.finalScores) {
        setSession(prev => ({ ...prev, finalScores: null, scoreBreakdown: null, players: null }));
      }
    }
    // Safety net if the scroll-to effect never got to consume it
    if (id !== tab) setHubSpotlightRealmId(null);
    setTab(id);
  }, [session, isGuest, tab, tourActive, handleRealmsTourComplete]);

  // Carcassonne expansion priority: Always show River and Abbot first since they're
  // commonly used foundational expansions that integrate well with other expansions.
  // River provides starting tile placement variety, Abbot offers monastery alternatives.
  const ownedExpansions = appData.expansions
    .filter(e => e.owned)
    .sort((a, b) => {
      const ai = PINNED_EXPANSIONS.indexOf(a.name);
      const bi = PINNED_EXPANSIONS.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    })
    .map(e => e.name);
  const realmGames = session?.realm?.id ? appData.games.filter(g => g.realmId === session.realm.id) : [];

  // Art-unlock grants (utils/artUnlocks.js) are self-only, so they only
  // ever attach to OUR OWN rankUpQueue entry — or, if the queue is empty/
  // never had one this round (e.g. a pure rollout catch-up with no
  // accompanying tierCount celebration), to no rankUpInfo at all — never
  // while showing a DIFFERENT realm member's celebration.
  const isSelfRankUpInfo = rankUpInfo && rankUpInfo.userId === userId;
  const attachedArtGrants = (isGuest || artGrants.length === 0) ? [] : ((isSelfRankUpInfo || !rankUpInfo) ? artGrants : []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="app-wrapper">
          <div className="header-layout">
            <div className="header-left">
              {isGuest ? (
                <button
                  type="button"
                  onClick={() => {
                    signOutGuest();
                    goHome();
                  }}
                  className="header-auth-btn"
                >
                  Sign In
                </button>
              ) : user ? (
                <button
                  type="button"
                  onClick={() => { signOut(); goHome(); }}
                  className="header-auth-btn"
                >
                  Sign Out
                </button>
              ) : null}
            </div>
            <h1 className="header-title" onClick={goHome}>Carcasscore</h1>
            <div className="header-right" />
          </div>
        </div>
      </header>

      {/* ── Loading ── */}
      {(appData.loading || authLoading) && (
        <div className="app-wrapper loading-state">
          Loading...
        </div>
      )}

      {/* ── Auth (signed out or password recovery) ── */}
      {!appData.loading && !authLoading && (!user && !isGuest || isRecoveryMode) && (
        <Auth 
          onSuccess={() => {
            completeRecovery();
            setIsRecoveryMode(false);
          }} 
          onGuestMode={() => {
            enableGuestMode();
            setTab('realms');
          }}
        />
      )}

      {/* ── Main (signed in or guest mode and not recovery) ── */}
      {!appData.loading && !authLoading && (user || isGuest) && !isRecoveryMode && (
        <>
          <nav className="tab-nav" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                ref={id === 'me' ? meTabRef : undefined}
                className={`tab-btn${tab === id ? ' active' : ''}${id === 'me' ? ' tab-btn-right' : ''}`}
                onClick={() => handleTabChange(id)}
                role="tab"
                aria-selected={tab === id}
              >
                {label}
              </button>
            ))}
          </nav>
          {/* Third leg of the Realms tour — a proper tour card (same look/
              arrow as every other tour popup) docked beside the real
              Profile tab, telling the user to click it rather than offering
              a stand-in action of its own. Disappears once that leg's been
              taken (tourVisitedProfile), same as the hub fork's own
              chest/logbook sections do — clicking the real tab is what
              hands off into Profile's own tour (see handleTabChange above).
              Its own X only dismisses this leg (marks it visited, same as
              taking it for real) rather than ending the whole Realms tour —
              a chest/logbook leg left unvisited stays available; the effect
              near tourVisitedProfile's declaration is what ends the tour
              once every leg (this one included) has been accounted for. */}
          {profileLegActive && (
            <ProfileTabTourCard
              onClose={() => setTourVisitedProfile(true)}
              targetRef={meTabRef}
            />
          )}
          {/* The tab's own spotlight cutout — see meTabHighlightRect above
              for why this is a floating overlay instead of a `.tour-highlight`
              class on the tab itself. tour-highlight-tab brightens it (see
              index.css) so it pops the way a full realm-card cutout does.
              pointerEvents: none so the real tab underneath stays clickable. */}
          {meTabHighlightRect && (
            <div
              className="tour-highlight tour-highlight-tab"
              style={{
                position: 'fixed',
                top: meTabHighlightRect.top,
                left: meTabHighlightRect.left,
                width: meTabHighlightRect.width,
                height: meTabHighlightRect.height,
                borderRadius: 'var(--radius-tile) var(--radius-tile) 0 0',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Pending group invite — must be answered explicitly; chains through
              multiple invites by always showing the first outstanding one. */}
          {!isGuest && pendingInvites.length > 0 && (
            <InvitePrompt
              invite={pendingInvites[0]}
              onAccept={handleInviteAccept}
              onDecline={handleInviteDecline}
            />
          )}

          <div className="app-wrapper">
          <div className="section-panel">
            {tab === 'realms' && (
              session
                ? session.finalScores
                  ? <PostGameForm
                      session={session}
                      ownedExpansions={ownedExpansions}
                      onSubmit={handleRecordGame}
                      onCancel={() => setSession(prev => ({ ...prev, finalScores: null }))}
                      onPlayAgain={handlePlayAgain}
                      onExitToHub={exitPreGameToHub}
                      isGuest={isGuest}
                      progressByName={postGameProgress}
                      isRecording={recordingGame}
                    />
                  : session.players
                    ? <Board
                        key={gameKey}
                        userId={userId}
                        isGuest={isGuest}
                        session={session}
                        onFinish={handleFinishGame}
                        onReset={handleBoardReset}
                        onExitToHub={exitPreGameToHub}
                        autoShowHowTo={howToShownForGameRef.current !== gameKey}
                        onHowToShown={() => { howToShownForGameRef.current = gameKey; }}
                        onSessionUpdate={patch => setSession(prev => ({ ...prev, ...patch }))}
                        ownedExpansions={ownedExpansions}
                      />
                    : session?.showRealmCreation
                      ? <PreGameSetup
                          key="realm-creation"
                          realm={null}
                          ownedExpansions={ownedExpansions}
                          onStart={handleGameStart}
                          defaultMeeples={null}
                          defaultExpansions={null}
                          realms={appData.realms}
                          currentRealm={null}
                          onExitToHub={exitPreGameToHub}
                          onRealmCreate={handleRealmCreate}
                          onExportGroup={isGuest ? null : handleExportGroup}
                          startAtRealmCreation={true}
                          isGuest={isGuest}
                          selfName={displayName}
                          unlockedChestIndices={unlockedChestIndices}
                          unlockedLogbookIndices={unlockedLogbookIndices}
                          tourActive={tourActive}
                        />
                      : <PreGameSetup
                        key={session.realm.id}
                        realm={session.realm}
                        ownedExpansions={ownedExpansions}
                        onStart={handleGameStart}
                        defaultMeeples={session.lastMeeples}
                        defaultExpansions={session.lastExpansions}
                        realms={appData.realms}
                        currentRealm={session?.realm || null}
                        onExitToHub={exitPreGameToHub}
                        onRealmCreate={handleRealmCreate}
                        onExportGroup={isGuest ? null : handleExportGroup}
                        isGuest={isGuest}
                        selfName={displayName}
                        unlockedChestIndices={unlockedChestIndices}
                        unlockedLogbookIndices={unlockedLogbookIndices}
                        tourActive={tourActive}
                      />
                : appData.realms.length === 0
                  ? <PreGameSetup
                      key="no-realms"
                      realm={null}
                      ownedExpansions={ownedExpansions}
                      onStart={handleGameStart}
                      defaultMeeples={null}
                      defaultExpansions={null}
                      realms={appData.realms}
                      currentRealm={null}
                      onExitToHub={exitPreGameToHub}
                      onRealmCreate={handleRealmCreate}
                      onExportGroup={isGuest ? null : handleExportGroup}
                      startAtRealmCreation={true}
                      isGuest={isGuest}
                      selfName={displayName}
                      unlockedChestIndices={unlockedChestIndices}
                      unlockedLogbookIndices={unlockedLogbookIndices}
                      tourActive={tourActive}
                    />
                  : <RealmsTab
                      realms={appData.realms}
                      games={appData.games}
                      onPlayRealm={handleRealmSelect}
                      onCreateRealm={() => setSession({ showRealmCreation: true })}
                      onDeleteGame={handleDelete}
                      onDeleteRealm={handleRealmDelete}
                      onLeaveRealm={handleRealmLeave}
                      onUpdateRealm={appOperations.updateRealm}
                      unlockedChestIndices={unlockedChestIndices}
                      unlockedLogbookIndices={unlockedLogbookIndices}
                      isGuest={isGuest}
                      openGame={openGame}
                      onOpenGameClear={() => setOpenGame(null)}
                      resetSignal={hubResetKey}
                      tourActive={tourActive}
                      onTourActiveChange={handleTourActiveChange}
                      tourVisitedChest={tourVisitedChest}
                      tourVisitedBook={tourVisitedBook}
                      tourVisitedProfile={tourVisitedProfile}
                      onTourVisitChest={() => setTourVisitedChest(true)}
                      onTourVisitBook={() => setTourVisitedBook(true)}
                      tourShown={guestRealmsTourShown}
                      onTourShown={() => setGuestRealmsTourShown(true)}
                      scrollToRealmId={hubSpotlightRealmId}
                      onScrollToRealmConsumed={() => setHubSpotlightRealmId(null)}
                      onHubStageChange={setAtRealmsHub}
                    />
            )}
            {tab === 'home' && <Landing />}
            {tab === 'me' && (
              <Profile
                games={appData.games}
                realms={appData.realms}
                userId={userId}
                displayName={displayName}
                isGuest={isGuest}
                tourShown={guestProfileTourShown}
                onTourShown={() => setGuestProfileTourShown(true)}
                autoStartTour={profileTourAutoStart}
                onAutoStartTourConsumed={() => setProfileTourAutoStart(false)}
                onTourComplete={handleProfileTourComplete}
                storedMetaRank={storedMetaRank}
                onGuestMetaRankAchieved={isGuest ? setGuestMetaRank : null}
                onChangeDisplayName={updateDisplayName}
                onDeleteAccount={async () => { await deleteAccount(user?.id); signOut(); }}
                onSignOut={() => { signOut(); goHome(); }}
                ownedExpansions={ownedExpansions}
                onToggleOwned={appOperations.toggleExpansion}
                unlockedChestIndices={unlockedChestIndices}
                unlockedLogbookIndices={unlockedLogbookIndices}
              />
            )}
          </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} />}

      {/* Reachable regardless of tab/session. One shared device at the
          table, so after a game is recorded this shows EVERY linked
          player's pending celebration in turn (queue head = rankUpInfo,
          advanced on each close) — playerName comes from the queue entry
          itself, not always this account's own displayName, since most
          entries here belong to other players in the realm.

          Art-unlock grants (utils/artUnlocks.js) are self-only, so they
          only ever attach to OUR OWN queue entry, or — if the queue is
          empty/never had one this round (e.g. a pure rollout catch-up with
          no accompanying tierCount celebration) — render with no rankUpInfo
          at all, in which case the fallback prop values below are inert
          (RankUpModal's own stage logic skips straight past
          milestones/rankup when there's nothing on them). */}
      {(rankUpInfo || attachedArtGrants.length > 0) && (
        <RankUpModal
          // Forces a full remount per queue entry — without a key tied to
          // the current player, React reuses the same RankUpModal (and every
          // Reel inside it) across queue advances, so each Reel's own
          // `revealed` state (already true from the PREVIOUS player's
          // completed animation) carries over and the next player's reel
          // renders already-settled instead of replaying the scroll. A
          // self-only art-grant reveal (no rankUpInfo) keeps a stable key —
          // remount is reserved for switching queue entries.
          key={rankUpInfo ? rankUpInfo.userId : 'self-art-grants'}
          playerName={rankUpInfo ? rankUpInfo.playerName : displayName}
          beforeRank={rankUpInfo ? rankUpInfo.beforeRank : (selfProgress?.rank ?? 1)}
          afterRank={rankUpInfo ? rankUpInfo.afterRank : (selfProgress?.rank ?? 1)}
          beforeTierCount={rankUpInfo ? rankUpInfo.beforeTierCount : (selfProgress?.tierCount ?? 0)}
          tierCount={rankUpInfo ? rankUpInfo.tierCount : (selfProgress?.tierCount ?? 0)}
          categoryDiffs={rankUpInfo ? rankUpInfo.categoryDiffs : []}
          newArtGrants={attachedArtGrants}
          // Only reached once every grant currently on screen has actually
          // finished revealing (RankUpModal blocks Nice!/close until then)
          // — acknowledgeArtGrants is what actually persists the pending
          // draw (see its own comment: staying unsaved until THIS point is
          // what makes a refresh mid-celebration re-draw/re-show instead of
          // silently locking in a prize the player never saw). Clears
          // artGrants either way, and when there's a real queue entry also
          // runs the normal close/acknowledge flow for that.
          onClose={() => { setArtGrants([]); acknowledgeArtGrants(); if (rankUpInfo) handleCloseRankUp(); }}
        />
      )}

      {/* Footer */}
      <footer className="site-footer">
        {/* Space for future footer content */}
      </footer>
    </div>
  );
}
