import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PostGameForm  from './components/PostGameForm';
import Library       from './components/Library';
import Profile       from './components/Profile';
import { GUEST_ALLOWED_MINIS } from './data/expansions';
import Board         from './components/Board';
import Lobby         from './components/Lobby';
import PreGameSetup  from './components/PreGameSetup';
import Auth          from './components/Auth';
import Landing       from './components/Landing';
import InvitePrompt  from './components/InvitePrompt';
import { HowToPlayModal } from './components/HowToGuide';
import { useGameData } from './hooks/useGameData';
import { useAuth }     from './hooks/useAuth';
import { resetBoard }  from './data/boardStorage';
import { deleteAccount, sendRealmInvite, updateDisplayName, updateHighestMetaRank } from './data/storage';
import { getGuestMetaRank, setGuestMetaRank, countUnlockedTiers, getCurrentRank } from './utils/metaRank';
import { calcAccountStats } from './utils/stats';
import { DEFAULT_EXPANSIONS } from './data/expansions';
import { DEMO_REALMS, DEMO_GAMES, DEMO_USER_ID, DEMO_USER_NAME } from './data/demoData';
import { TABS, APP_CONFIG, EXPANSION_TYPES, PINNED_EXPANSIONS } from './constants';
import { normalizeMeeples } from './utils/formatters';
import { createSession, endSession, deleteSession } from './data/partySession';


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
  // Which gameKey the guest how-to guide has already auto-shown for — lives here (not in
  // Board) so switching tabs away and back to the same game doesn't re-trigger it, while a
  // genuinely new game (new gameKey) still gets a fresh auto-show.
  const howToShownForGameRef = useRef(null);
  // Guest-only "How to Play" modal — re-shown every time a guest navigates to the play tab.
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  // Set right after a guest creates their group so PreGameSetup continues forward to mode
  // selection; cleared on any navigation away so a fresh visit restarts at Choose Group.
  const [guestResumeAtMode, setGuestResumeAtMode] = useState(false);

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

  // Guest mode state
  const [guestRealms,   setGuestRealms]   = useState([]);
  const [showDemoData,  setShowDemoData]  = useState(false);
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
    () => calcAccountStats(appData.games, appData.realms, userId),
    [appData.games, appData.realms, userId]
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
      if (session && session.realm?.id?.includes('guest-realm')) {
        setSession(null);
      }
    }
  }, [isGuest, session]);

  const goHome = useCallback(() => {
    setSession(null);
    setTab('home');
    setGuestResumeAtMode(false);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), APP_CONFIG.TOAST_DURATION);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    setSession({ realm });
  }, []);

  const handleRealmCreate = useCallback(async (data) => {
    try {
      // addRealm embeds the creator's 'owner' element from data.selfPlayer —
      // no separate claim step needed anymore.
      const realm = await appOperations.addRealm(data);
      setSession({ realm, showRealmCreation: false });
      if (isGuest) setGuestResumeAtMode(true);
    } catch (err) {
      console.error('create realm failed', err);
      showToast(`Failed to create realm: ${err?.message || 'Unknown error'}`);
    }
  }, [appOperations.addRealm, showToast, isGuest]);


  const handleGameStart = useCallback(async (setup) => {
    const extraTypes = (setup.expansions || []).flatMap(e => EXPANSION_TYPES[e] || []);

    // Delete any lingering party session before starting fresh
    const prevSessionId = session?.partySessionId;
    if (prevSessionId) { try { await deleteSession(prevSessionId); } catch {} }

    await resetBoard(userId, setup.players, extraTypes, isGuest);

    if (setup.mode === 'party' && userId && !isGuest) {
      try {
        const { id, code } = await createSession({
          runnerUserId: userId,
          roster: setup.players,
          expansions: setup.expansions || [],
        });
        setSession(prev => ({ ...prev, ...setup, finalScores: null, partySessionId: id, partyCode: code, partyStarted: false }));
      } catch (err) {
        console.error('Failed to create party session:', err);
        setSession(prev => ({ ...prev, ...setup, finalScores: null }));
      }
    } else {
      setSession(prev => ({ ...prev, ...setup, finalScores: null }));
    }

    setGameKey(k => k + 1);
  }, [userId, isGuest, session?.partySessionId]);

  const handleBoardReset = useCallback(() => {
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    normalizeMeeples(prev.meeples),
      lastExpansions: prev.expansions,
    }));
  }, []);

  const handleLobbyStart = useCallback(() => {
    setSession(prev => ({ ...prev, partyStarted: true }));
  }, []);

  const handleLobbyCancel = useCallback(async () => {
    const id = session?.partySessionId;
    if (id) { try { await deleteSession(id); } catch {} }
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    normalizeMeeples(prev.meeples),
      lastExpansions: prev.expansions,
    }));
  }, [session?.partySessionId]);

  const handleClaimUpdate = useCallback((roster) => {
    const meepleMap = {};
    roster.forEach(r => { if (r.meeple) meepleMap[r.name] = r.meeple; });
    setSession(prev => ({ ...prev, meeples: { ...(prev.meeples || {}), ...meepleMap } }));
  }, []);

  const handleFinishGame = useCallback((finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline) => {
    setSession(prev => ({ ...prev, finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures, scoreTimeline }));
    setTab('board');
    window.scrollTo(0, 0);
  }, []);

  const handleRecordGame = useCallback((gameData) => {
    if (isGuest) {
      // For guests, redirect to sign-in instead of recording
      setSession(null);
      setTab('history');
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
    setTab('board');
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
        setTab('history');
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
    if (id === 'board') {
      // Guests get the "How to Play" popup on every visit to the play tab
      if (isGuest) setShowHowToPlay(true);
      // Entering Play should always land on the chest-row chooser unless
      // there's an active game (players dealt) or a just-finished one waiting
      // on final scores to resume. session.realm can get set as a side effect
      // of just VIEWING a realm elsewhere (e.g. Library's onRealmChange keeps
      // the app-wide selection in sync when you open a logbook) — so check on
      // every entry, not just when leaving Play, or that contaminates the
      // next visit into jumping straight to that realm's Players screen.
      if (!session?.players && !session?.finalScores) setSession(null);
    } else {
      // Leaving the play tab abandons any in-progress pregame setup, so the next visit restarts
      setGuestResumeAtMode(false);
      // Clear postgame state and players when leaving board tab to return to pregame setup
      if (session?.finalScores) {
        setSession(prev => ({ ...prev, finalScores: null, scoreBreakdown: null, players: null }));
      }
    }
    // Demo mode is per-visit — switching tabs always exits it
    setShowDemoData(false);
    setTab(id);
  }, [session, isGuest]);

  // When demo mode is on for guests, swap in the demo dataset
  const demoOn = isGuest && showDemoData;
  const displayGames        = demoOn ? DEMO_GAMES        : appData.games;
  const displayRealms       = demoOn ? DEMO_REALMS       : appData.realms;
  const displayCurrentRealm = demoOn ? DEMO_REALMS[0]    : (session?.realm || null);
  const toggleDemo          = () => setShowDemoData(v => !v);

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
            {tab === 'board' && (
              session
                ? session.finalScores
                  ? <PostGameForm
                      session={session}
                      ownedExpansions={ownedExpansions}
                      onSubmit={handleRecordGame}
                      onCancel={() => setSession(prev => ({ ...prev, finalScores: null }))}
                      onPlayAgain={handlePlayAgain}
                      isGuest={isGuest}
                    />
                  : session.players
                    ? <>
                        <Board
                          key={gameKey}
                          userId={userId}
                          isGuest={isGuest}
                          session={session}
                          onFinish={handleFinishGame}
                          onReset={handleBoardReset}
                          autoShowHowTo={howToShownForGameRef.current !== gameKey}
                          onHowToShown={() => { howToShownForGameRef.current = gameKey; }}
                        />
                        {session.mode === 'party' && !session.partyStarted && session.partySessionId && (
                          <Lobby
                            session={session}
                            onStart={handleLobbyStart}
                            onCancel={handleLobbyCancel}
                            onClaimUpdate={handleClaimUpdate}
                          />
                        )}
                      </>
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
                          onRealmChange={handleRealmSelect}
                          onRealmCreate={handleRealmCreate}
                          onExportGroup={isGuest ? null : handleExportGroup}
                          startAtRealmCreation={true}
                          isGuest={isGuest}
                          selfName={displayName}
                          onToggleOwned={appOperations.toggleExpansion}
                          selfRank={selfRank}
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
                        onRealmChange={handleRealmSelect}
                        onRealmCreate={handleRealmCreate}
                        onExportGroup={isGuest ? null : handleExportGroup}
                        startAtModeSelection={isGuest && guestResumeAtMode}
                        isGuest={isGuest}
                        selfName={displayName}
                        onToggleOwned={appOperations.toggleExpansion}
                        selfRank={selfRank}
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
                      onRealmChange={handleRealmSelect}
                      onRealmCreate={handleRealmCreate}
                      onExportGroup={isGuest ? null : handleExportGroup}
                      startAtRealmCreation={true}
                      isGuest={isGuest}
                      selfName={displayName}
                      onToggleOwned={appOperations.toggleExpansion}
                      selfRank={selfRank}
                    />
                  : <PreGameSetup
                      key="choose-realm"
                      realm={null}
                      ownedExpansions={ownedExpansions}
                      onStart={handleGameStart}
                      defaultMeeples={null}
                      defaultExpansions={null}
                      realms={appData.realms}
                      currentRealm={null}
                      onRealmChange={handleRealmSelect}
                      onRealmCreate={handleRealmCreate}
                      onExportGroup={isGuest ? null : handleExportGroup}
                      isGuest={isGuest}
                      selfName={displayName}
                      onToggleOwned={appOperations.toggleExpansion}
                      selfRank={selfRank}
                    />
            )}
            {tab === 'board' && isGuest && showHowToPlay && !session?.players && !session?.finalScores && (
              <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
            )}
            {tab === 'home' && <Landing />}
            {tab === 'history' && (
              <Library
                games={displayGames}
                realms={displayRealms}
                currentRealm={displayCurrentRealm}
                onRealmChange={handleRealmSelect}
                onDeleteGame={handleDelete}
                onDeleteRealm={handleRealmDelete}
                onLeaveRealm={handleRealmLeave}
                onUpdateRealm={appOperations.updateRealm}
                selfRank={selfRank}
                isGuest={isGuest}
                showDemoData={showDemoData}
                onToggleDemoData={isGuest ? toggleDemo : null}
                openGame={openGame}
                onOpenGameClear={() => setOpenGame(null)}
              />
            )}
            {tab === 'me' && (
              <Profile
                games={demoOn ? DEMO_GAMES : appData.games}
                realms={demoOn ? DEMO_REALMS : appData.realms}
                userId={demoOn ? DEMO_USER_ID : user?.id}
                displayName={demoOn ? DEMO_USER_NAME : displayName}
                isGuest={isGuest}
                showDemoData={showDemoData}
                onToggleDemoData={isGuest ? toggleDemo : null}
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
