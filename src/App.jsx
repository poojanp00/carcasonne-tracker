import { useState, useCallback, useEffect } from 'react';
import PostGameForm  from './components/PostGameForm';
import Logbook       from './components/Logbook';
import Statistics    from './components/Statistics';
import Collection    from './components/Collection';
import Board         from './components/Board';
import RealmPicker   from './components/RealmPicker';
import PreGameSetup  from './components/PreGameSetup';
import Auth          from './components/Auth';
import { useGameData } from './hooks/useGameData';
import { useAuth }     from './hooks/useAuth';
import { resetBoard }  from './data/boardStorage';
import { DEFAULT_EXPANSIONS } from './data/expansions';
import crownImg from '../images/icons/crown.png';

// App-wide configuration constants
const APP_CONFIG = {
  TOAST_DURATION: 3100, // milliseconds before toast message disappears
};

const TABS = [
  { id: 'realms',     label: 'Realms'     },
  { id: 'statistics', label: 'Statistics' },
  { id: 'history',    label: 'Logbook'    },
  { id: 'board',      label: 'score board' },
  { id: 'collection', label: 'Collection' },
];


function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}

/**
 * Normalize meeple selections for consistency in session state.
 * Converts 'fun/' prefix meeples (custom/special meeples) to 'mystery.png'
 * to maintain a consistent interface while preserving the original selection.
 * This helps prevent UI issues when switching between different meeple sets.
 */
const normalizeMeeples = (meeples) =>
  meeples
    ? Object.fromEntries(Object.entries(meeples).map(([p, k]) => [p, k.startsWith('fun/') ? 'mystery.png' : k]))
    : meeples;

export default function App() {
  const [session,        setSession]        = useState(null);
  const [tab,            setTab]            = useState('realms');
  const [gameKey,        setGameKey]        = useState(0);
  const [toast,          setToast]          = useState(null);
  const [realmPickerKey, setRealmPickerKey] = useState(0);

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
  const [guestRealms, setGuestRealms] = useState([]);

  // Unified data - guest mode provides default data, user mode uses database
  const appData = {
    games: isGuest ? [] : games,
    expansions: isGuest ? DEFAULT_EXPANSIONS.map(exp => ({ ...exp, owned: true })) : expansions,
    realms: isGuest ? guestRealms : realms,
    loading: isGuest ? false : loading
  };

  // Unified operations - guest mode uses no-ops, user mode uses database
  const appOperations = {
    addGame: isGuest ? () => Promise.resolve('guest-game-id') : addGame,
    deleteGame: isGuest ? () => {} : deleteGame,
    toggleExpansion: isGuest ? () => {} : toggleExpansion,
    addRealm: isGuest ? (data) => {
      const guestRealm = { 
        id: `guest-realm-${Date.now()}`, 
        name: data.name || 'Guest Realm', 
        players: data.players || [],
        created_at: new Date().toISOString()
      };
      setGuestRealms(prev => [...prev, guestRealm]);
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
    setTab('realms');
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
      showToast(`Failed to create realm: ${err?.message || 'Unknown error'}`);
    }
  }, [appOperations.addRealm, showToast]);

  // Maps expansion names to the score types they add beyond the base four
  /**
   * Carcassonne Expansion Scoring Categories
   * Maps expansion names to the additional scoring types they introduce.
   * These determine what score input buttons appear during gameplay.
   * 
   * Base game: road, city, monastery, field
   * 
   * Inns & Cathedrals:
   * - inn: Road tiles with inns double points but score 0 if incomplete
   * - cathedral: City tiles with cathedrals +3 points per pennant, 0 if incomplete
   * 
   * Traders & Builders:
   * - wine, grain, cloth: Trade goods collected from completed cities
   * - pig: Placed on farms to increase field scoring by +1 per city
   * 
   * Abbey & Mayor:
   * - barn: Placed on farms for immediate scoring, locks the farm
   * - wagon: Can move between completed features for additional scoring
   */
  const EXPANSION_TYPES = {
    'Inns & Cathedrals':          ['inn', 'cathedral'],
    'Bridges, Castles & Bazaars': ['inn', 'cathedral'],
    'The Princess & the Dragon':  ['princess', 'fairy'],
    'Traders & Builders':         ['wine', 'grain', 'cloth', 'pig'],
    'Count, King & Robber':       ['largest_city', 'largest_road'],
    'Abbey & Mayor':              ['abbey', 'barn'],
    'The Abbot':                  ['abbot'],
  };

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

  const handleFinishGame = useCallback((finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures) => {
    setSession(prev => ({ ...prev, finalScores, scoreBreakdown, farmWin, gameDuration, maxFeatures }));
    setTab('board');
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
    setTab('board');
  }, [session, resetBoard, userId, isGuest]);

  const handleDelete = useCallback((id) => {
    appOperations.deleteGame(id);
    showToast('Game removed.');
  }, [appOperations.deleteGame, showToast]);

  const handleRealmDelete = useCallback(async (realmId) => {
    await appOperations.removeRealm(realmId);
    if (session?.realm?.id === realmId) setSession(null);
    const remaining = appData.realms.filter(r => r.id !== realmId);
    if (remaining.length === 0) { setRealmPickerKey(k => k + 1); setTab('realms'); }
    showToast('Realm deleted.');
  }, [appOperations.removeRealm, session, appData.realms, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    appOperations.updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, appOperations.updateRealm]);

  const handleTabChange = useCallback((id) => {
    if (id === 'realms') setRealmPickerKey(k => k + 1);
    // Clear postgame state and players when leaving board tab to return to pregame setup
    if (id !== 'board' && session?.finalScores) {
      setSession(prev => ({ ...prev, finalScores: null, scoreBreakdown: null, players: null }));
    }
    setTab(id);
  }, [session]);

  // Carcassonne expansion priority: Always show River and Abbot first since they're
  // commonly used foundational expansions that integrate well with other expansions.
  // River provides starting tile placement variety, Abbot offers monastery alternatives.
  const PINNED_EXPANSIONS = ['The River', 'The Abbot'];
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
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
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.06em',
                    color: 'var(--stone-gray)', padding: '0.1rem 0.3rem',
                  }}
                >
                  {isGuest ? 'Sign In' : 'Sign Out'}
                </button>
              )}
            </div>
            <h1 style={{ cursor: 'pointer' }} onClick={goHome}>Carcasscore</h1>
            <div style={{ flex: 1 }} />
          </div>
        </div>
      </header>

      {/* ── Loading ── */}
      {(appData.loading || authLoading) && (
        <div className="app-wrapper" style={{ textAlign: 'center', paddingTop: '4rem', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', letterSpacing: '0.1em' }}>
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
            setTab('board');
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
            {tab === 'realms' && (
              <RealmPicker
                key={realmPickerKey}
                realms={appData.realms}
                currentRealm={session?.realm || null}
                games={realmGames}
                onSelect={handleRealmSelect}
                onCreate={handleRealmCreate}
                onDelete={handleRealmDelete}
                isGuest={isGuest}
              />
            )}
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
                    ? <Board key={gameKey} userId={userId} isGuest={isGuest} session={session} onFinish={handleFinishGame} onReset={handleBoardReset} />
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
                      realms={realms}
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
                        <div style={{ marginBottom: '1.3rem' }}>
                          <div className="expansion-chips">
                            {appData.realms.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                className="expansion-chip"
                                onClick={() => handleRealmSelect(r)}
                              >
                                {r.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="empty-state">
                        Select a realm to begin playing.
                      </div>
                    </div>
                  )
            )}
            {tab === 'history' && <Logbook games={appData.games} realms={appData.realms} currentRealm={session?.realm || null} onRealmChange={handleRealmSelect} onDelete={handleDelete} isGuest={isGuest} />}
            {tab === 'statistics' && <Statistics games={appData.games} realms={appData.realms} currentRealm={session?.realm || null} onRealmChange={handleRealmSelect} isGuest={isGuest} />}
            {tab === 'collection' && <Collection expansions={appData.expansions} onToggle={appOperations.toggleExpansion} userId={user?.id} isGuest={isGuest} />}
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
