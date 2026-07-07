import { useState, useCallback, useEffect } from 'react';
import PostGameForm  from './components/PostGameForm';
import Logbook       from './components/Logbook';
import Statistics    from './components/Statistics';
import Collection, { GUEST_ALLOWED_MINIS } from './components/Collection';
import Board         from './components/Board';
import Lobby         from './components/Lobby';
import RealmPicker   from './components/RealmPicker';
import PreGameSetup  from './components/PreGameSetup';
import Auth          from './components/Auth';
import ChipGroup     from './components/ChipGroup';
import Landing       from './components/Landing';
import { useGameData } from './hooks/useGameData';
import { useAuth }     from './hooks/useAuth';
import { resetBoard }  from './data/boardStorage';
import { deleteAccount } from './data/storage';
import { DEFAULT_EXPANSIONS } from './data/expansions';
import { DEMO_REALM, DEMO_GAMES } from './data/demoData';
import { TABS, APP_CONFIG, EXPANSION_TYPES, PINNED_EXPANSIONS } from './constants';
import { normalizeMeeples } from './utils/formatters';
import { createSession, endSession, deleteSession } from './data/partySession';
import crownImg from '../images/icons/crown.png';


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
  const [realmPickerKey, setRealmPickerKey] = useState(0);
  const [openGame,       setOpenGame]       = useState(null);

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
  const { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm } = useGameData(isGuest ? null : user, authLoading || (isGuest && false));

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
        players: data.players || [],
        created_at: new Date().toISOString()
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

  // Auto-load the realm with the most recent game on initial data load
  // Business rule: When a user first logs in, automatically select the realm
  // where their most recent game was played to provide continuity
  useEffect(() => {
    // Skip if still loading data, no user, already have session, or no data available
    if (appData.loading || authLoading || (!user && !isGuest) || session || appData.games.length === 0 || appData.realms.length === 0) return;

    // Find the most recent game by sorting games by date (newest first)
    const latest = [...appData.games].sort((a, b) => b.date.localeCompare(a.date))[0];

    // Find the realm that contains this latest game
    const realm  = appData.realms.find(r => r.id === latest?.realmId);
    if (realm) setSession({ realm });
  }, [appData.loading, authLoading, user, isGuest]);  // eslint-disable-line react-hooks/exhaustive-deps

  const goHome = useCallback(() => {
    setSession(null);
    setTab('home');
    setRealmPickerKey(k => k + 1);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), APP_CONFIG.TOAST_DURATION);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    setSession({ realm });
    setRealmPickerKey(k => k + 1);
  }, []);

  const handleRealmCreate = useCallback(async (data) => {
    try {
      const realm = await appOperations.addRealm(data);
      setSession({ realm, showRealmCreation: false });
      setRealmPickerKey(k => k + 1);
    } catch (err) {
      console.error('create realm failed', err);
      showToast(`Failed to create group: ${err?.message || 'Unknown error'}`);
    }
  }, [appOperations.addRealm, showToast]);


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
      setTab('statistics');
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
        setRealmPickerKey(k => k + 1);
        setTab('statistics');
      }
    }
    showToast('Group deleted.');
  }, [appOperations.removeRealm, session, appData.realms, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    appOperations.updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, appOperations.updateRealm]);

  const handleTabChange = useCallback((id) => {
    if (id === 'statistics') setRealmPickerKey(k => k + 1);
    // Clear postgame state and players when leaving board tab to return to pregame setup
    if (id !== 'board' && session?.finalScores) {
      setSession(prev => ({ ...prev, finalScores: null, scoreBreakdown: null, players: null }));
    }
    setTab(id);
  }, [session]);

  // When demo mode is on for guests, swap in the demo dataset
  const demoOn = isGuest && showDemoData;
  const displayGames        = demoOn ? DEMO_GAMES        : appData.games;
  const displayRealms       = demoOn ? [DEMO_REALM]      : appData.realms;
  const displayCurrentRealm = demoOn ? DEMO_REALM        : (session?.realm || null);
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
              {(user || isGuest) && (
                <button
                  type="button"
                  onClick={() => {
                    if (user) {
                      signOut();
                    } else {
                      signOutGuest();
                    }
                    goHome();
                  }}
                  className="header-auth-btn"
                >
                  {isGuest ? 'Sign In' : 'Sign Out'}
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
                className={`tab-btn${tab === id ? ' active' : ''}${id === 'collection' ? ' tab-btn-right' : ''}`}
                onClick={() => handleTabChange(id)}
                role="tab"
                aria-selected={tab === id}
              >
                {label}
              </button>
            ))}
          </nav>

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
                        <Board key={gameKey} userId={userId} isGuest={isGuest} session={session} onFinish={handleFinishGame} onReset={handleBoardReset} />
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
                          startAtRealmCreation={true}
                          isGuest={isGuest}
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
                        isGuest={isGuest}
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
                      startAtRealmCreation={true}
                      isGuest={isGuest}
                    />
                  : (
                    <div>
                      <div className="section-title">
                        <h2>score board</h2>
                        <div className="section-title-line" />
                      </div>
                      {appData.realms.length > 0 && (
                        <div className="chip-section">
                          <ChipGroup
                            items={appData.realms}
                            selectedId={null}
                            onSelect={handleRealmSelect}
                            carousel
                          />
                        </div>
                      )}
                      <div className="empty-state">
                        Select a group to begin playing.
                      </div>
                    </div>
                  )
            )}
            {tab === 'home' && <Landing />}
            {tab === 'history' && <Logbook games={displayGames} realms={displayRealms} currentRealm={displayCurrentRealm} onRealmChange={handleRealmSelect} onDelete={handleDelete} isGuest={isGuest} showDemoData={showDemoData} onToggleDemoData={isGuest ? toggleDemo : null} openGame={openGame} onOpenGameClear={() => setOpenGame(null)} />}
            {tab === 'statistics' && (
              <>
                {!demoOn && (
                  <RealmPicker
                    key={realmPickerKey}
                    realms={appData.realms}
                    currentRealm={session?.realm || null}
                    onSelect={handleRealmSelect}
                    onCreate={handleRealmCreate}
                    isGuest={isGuest}
                  />
                )}
                {(session?.realm || isGuest) && (
                  <Statistics
                    games={displayGames}
                    realms={displayRealms}
                    currentRealm={displayCurrentRealm}
                    onRealmChange={handleRealmSelect}
                    onDelete={handleRealmDelete}
                    isGuest={isGuest}
                    showDemoData={showDemoData}
                    onToggleDemoData={isGuest ? toggleDemo : null}
                    onNavigateToGame={game => { setOpenGame(game); setTab('history'); }}
                  />
                )}
              </>
            )}
            {tab === 'collection' && <Collection expansions={appData.expansions} onToggle={appOperations.toggleExpansion} userId={user?.id} isGuest={isGuest} onDeleteAccount={async () => { await deleteAccount(user?.id); signOut(); }} />}
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
