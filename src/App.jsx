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
import { deleteAccount, sendRealmInvite, updateDisplayName, updateHighestMetaRank } from './data/storage';
import { getGuestMetaRank, setGuestMetaRank, countUnlockedTiers, getCurrentRank } from './utils/metaRank';
import { calcAccountStats } from './utils/stats';
import { DEFAULT_EXPANSIONS } from './data/expansions';
import { DEMO_REALMS, DEMO_GAMES, DEMO_USER_ID, DEMO_USER_NAME, DEMO_EXPANSIONS } from './data/demoData';
import { TABS, APP_CONFIG, EXPANSION_TYPES, PINNED_EXPANSIONS } from './constants';
import { normalizeMeeples } from './utils/formatters';


function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}


export default function App() {
  const [session,        setSession]        = useState(null);
  const [tab,            setTab]            = useState('home');
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
  const handleTourActiveChange = useCallback((active) => {
    setTourActive(active);
    if (active) {
      setTourVisitedChest(false);
      setTourVisitedBook(false);
    }
  }, []);
  // Which gameKey the guest how-to guide has already auto-shown for — lives here (not in
  // Board) so switching tabs away and back to the same game doesn't re-trigger it, while a
  // genuinely new game (new gameKey) still gets a fresh auto-show.
  const howToShownForGameRef = useRef(null);

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

  const storedMetaRank = isGuest ? getGuestMetaRank() : (user?.user_metadata?.highest_meta_rank || 0);

  // The signed-in account's live rank — used only to gate which chest
  // folders are unlocked in the realm-creation picker (see data/chests.js).
  // Guests always sit at rank 1 (folder 1 only), matching their locked-down
  // chest/logbook picker.
  const selfAccountStats = useMemo(
    () => calcAccountStats(appData.games, appData.realms, userId, appData.expansions),
    [appData.games, appData.realms, userId, appData.expansions]
  );
  const selfRank = isGuest ? 1 : getCurrentRank(countUnlockedTiers(selfAccountStats));

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
    setTab('home');
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
        // for a first-timer — the demo realm is already baked into their
        // realm list permanently (see displayRealms below), so there's no
        // separate "turn demo on" step needed here anymore.
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

  const handleBoardReset = useCallback(() => {
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    normalizeMeeples(prev.meeples),
      lastExpansions: prev.expansions,
    }));
  }, []);

  const handleFinishGame = useCallback((finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline) => {
    setSession(prev => ({ ...prev, finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline }));
    setTab('realms');
    window.scrollTo(0, 0);
  }, []);

  const handleRecordGame = useCallback((gameData) => {
    if (isGuest) {
      // For guests, redirect to sign-in instead of recording
      setSession(null);
      setTab('realms');
      signOutGuest();
      return;
    }
    appOperations.addGame({ ...gameData, realmId: session.realm.id });
    showToast('Game recorded in the logbook.');
    // Keep the session as-is so PostGameForm can still show breakdown/winner
    // User will click "Play Again" to reset and go back to scoreboard
  }, [appOperations.addGame, session, showToast, isGuest, signOutGuest]);

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
    setTab('realms');
  }, [session, resetBoard, userId, isGuest]);

  const handleDelete = useCallback(async (id) => {
    await appOperations.deleteGame(id);
    showToast('Game removed.');
  }, [appOperations.deleteGame, showToast]);

  const handleRealmDelete = useCallback(async (realmId) => {
    await appOperations.removeRealm(realmId);
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
  }, [appOperations.removeRealm, session, appData.realms, showToast]);

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
  }, [leaveSharedRealm, session, appData.realms, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    appOperations.updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, appOperations.updateRealm]);

  const handleTabChange = useCallback((id) => {
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
  }, [session, isGuest, tab]);

  // Demo data is baked permanently into guest mode — no toggle, no "turn it
  // on for the tour" step: a guest's own games are never real (see
  // appData.games above), so there's nothing else the Realms/Profile tours
  // could walk through, and nothing else for a guest to see day to day
  // either. A signed-in account, even with 0 recorded games, just uses its
  // own real (if sparse) realms/stats instead — no demo data involved, and
  // (see RealmsTab.jsx/Profile.jsx) it doesn't get the tour auto-opened for
  // it either, unlike guests. For the Realms hub, the demo realm is
  // *prepended* before whatever real realm a guest already has (see
  // RealmsTab.jsx/RealmsHub.jsx's shelf sort, which pins it first
  // regardless of date) rather than replacing it. Its chest/book are
  // always clickable, not locked — clicking either one just engages the
  // tour on that path (see handlePlayRealm/handleOpenBook in
  // RealmsTab.jsx), starting it first if needed. Profile shows one
  // account's aggregate stats rather than a list, so it keeps the simpler
  // full-replace behavior via its own inline isGuest ternaries below
  // instead of this prepended version.
  const demoOn = isGuest;
  const displayGames  = demoOn ? [...DEMO_GAMES,  ...appData.games]  : appData.games;
  const displayRealms = demoOn ? [...DEMO_REALMS, ...appData.realms] : appData.realms;

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

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="app-wrapper">
          <div className="header-layout">
            <div className="header-left">
              {/* Signed-in users log out from Profile → Account Settings */}
              {isGuest && (
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
              )}
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
            setTab('home');
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
                className={`tab-btn${tab === id ? ' active' : ''}${id === 'me' ? ' tab-btn-right' : ''}`}
                onClick={() => handleTabChange(id)}
                role="tab"
                aria-selected={tab === id}
              >
                {label}
              </button>
            ))}
          </nav>

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
                          onToggleOwned={appOperations.toggleExpansion}
                          selfRank={selfRank}
                          tourActive={tourActive}
                          onTourActiveChange={handleTourActiveChange}
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
                        onToggleOwned={appOperations.toggleExpansion}
                        selfRank={selfRank}
                        tourActive={tourActive}
                        onTourActiveChange={handleTourActiveChange}
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
                      onToggleOwned={appOperations.toggleExpansion}
                      selfRank={selfRank}
                      tourActive={tourActive}
                      onTourActiveChange={handleTourActiveChange}
                    />
                  : <RealmsTab
                      realms={displayRealms}
                      games={displayGames}
                      onPlayRealm={handleRealmSelect}
                      onCreateRealm={() => setSession({ showRealmCreation: true })}
                      onDeleteGame={handleDelete}
                      onDeleteRealm={handleRealmDelete}
                      onLeaveRealm={handleRealmLeave}
                      onUpdateRealm={appOperations.updateRealm}
                      selfRank={selfRank}
                      isGuest={isGuest}
                      openGame={openGame}
                      onOpenGameClear={() => setOpenGame(null)}
                      resetSignal={hubResetKey}
                      tourActive={tourActive}
                      onTourActiveChange={handleTourActiveChange}
                      tourVisitedChest={tourVisitedChest}
                      tourVisitedBook={tourVisitedBook}
                      onTourVisitChest={() => setTourVisitedChest(true)}
                      onTourVisitBook={() => setTourVisitedBook(true)}
                      tourShown={guestRealmsTourShown}
                      onTourShown={() => setGuestRealmsTourShown(true)}
                      scrollToRealmId={hubSpotlightRealmId}
                      onScrollToRealmConsumed={() => setHubSpotlightRealmId(null)}
                    />
            )}
            {tab === 'home' && <Landing />}
            {tab === 'me' && (
              <Profile
                games={demoOn ? DEMO_GAMES : appData.games}
                realms={demoOn ? DEMO_REALMS : appData.realms}
                expansions={demoOn ? DEMO_EXPANSIONS : appData.expansions}
                userId={demoOn ? DEMO_USER_ID : userId}
                displayName={demoOn ? DEMO_USER_NAME : displayName}
                isGuest={isGuest}
                tourShown={guestProfileTourShown}
                onTourShown={() => setGuestProfileTourShown(true)}
                storedMetaRank={storedMetaRank}
                onMetaRankAchieved={isGuest ? setGuestMetaRank : updateHighestMetaRank}
                onChangeDisplayName={updateDisplayName}
                onDeleteAccount={async () => { await deleteAccount(user?.id); signOut(); }}
                onSignOut={() => { signOut(); goHome(); }}
              />
            )}
          </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} />}
      
      {/* Footer */}
      <footer className="site-footer">
        {/* Space for future footer content */}
      </footer>
    </div>
  );
}
