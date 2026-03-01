import { useState, useCallback } from 'react';
import GameLogForm  from './components/GameLogForm';
import GameHistory  from './components/GameHistory';
import Stats        from './components/Stats';
import Collection   from './components/Collection';
import Board        from './components/Board';
import RealmPicker  from './components/RealmPicker';
import PreGame      from './components/PreGame';
import Auth         from './components/Auth';
import { useGameData } from './hooks/useGameData';
import { useAuth }     from './hooks/useAuth';
import { resetBoard }  from './data/boardStorage';

const IN_GAME_TABS = [
  { id: 'standings',  label: 'Standings'  },
  { id: 'history',    label: 'Logbook'    },
  { id: 'board',      label: 'Game Board' },
  { id: 'collection', label: 'Collection' },
];

function NoiseOverlay() {
  return (
    <svg className="noise-overlay" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <filter id="parchmentNoise">
        <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#parchmentNoise)" />
    </svg>
  );
}

function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}

export default function App() {
  // 'realm' | 'pre-game' | 'in-game' | 'record-game'
  const [phase,            setPhase]            = useState('realm');
  const [session,          setSession]          = useState(null);
  const [tab,              setTab]              = useState('board');
  const [gameKey,          setGameKey]          = useState(0); // incremented each new game so Board remounts fresh
  const [toast,            setToast]            = useState(null);
  const [realmPickerKey,   setRealmPickerKey]   = useState(0);
  const [realmInitialMode, setRealmInitialMode] = useState(null);

  const { user, authLoading, signOut } = useAuth();
  const { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm } = useGameData(user, authLoading);

  const goHome = useCallback(() => {
    setSession(null);
    setPhase('realm');
    setTab('board');
    setRealmInitialMode(null);
    setRealmPickerKey(k => k + 1);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3100);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    if (!user) { setPhase('auth'); return; }
    setSession({ realm });
    setTab('standings');
    setPhase('in-game');
  }, [user]);

  const handleRealmCreate = useCallback(async (data) => {
    if (!user) { setPhase('auth'); return; }
    const realm = await addRealm(data);
    if (!data.passwordHash) showToast('No passcode set — this realm is open to anyone.');
    setSession({ realm });
    setTab('standings');
    setPhase('in-game');
  }, [user, addRealm, showToast]);

  const handleGameStart = useCallback((setup) => {
    // setup = { players, meeples, expansions }
    resetBoard(setup.players);
    setSession(prev => ({ ...prev, ...setup, finalScores: null }));
    setGameKey(k => k + 1);
  }, []);

  const handleBoardReset = useCallback(() => {
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    prev.meeples,
      lastExpansions: prev.expansions,
    }));
  }, []);

  const handleFinishGame = useCallback((finalScores) => {
    setSession(prev => ({ ...prev, finalScores }));
    setTab('board');
  }, []);

  const handleRecordGame = useCallback((gameData) => {
    addGame({ ...gameData, realmId: session.realm.id });
    showToast('Game recorded in the logbook.');
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    prev.meeples,
      lastExpansions: prev.expansions,
    }));
    setTab('history');
  }, [addGame, session, showToast]);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Remove this game from the logbook? This cannot be undone.')) return;
    deleteGame(id);
    showToast('Game removed.');
  }, [deleteGame, showToast]);

  const handleRealmDelete = useCallback(async (realmId) => {
    await removeRealm(realmId);
    showToast('Realm deleted.');
  }, [removeRealm, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, updateRealm]);

  const PINNED_EXPANSIONS = ['The River', 'The Abbot'];
  const ownedExpansions = expansions
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
  const realmGames = session?.realm?.id
    ? games.filter(g => g.realmId === session.realm.id)
    : games;

  return (
    <div className="app-shell">
      <NoiseOverlay />

      <header className="site-header">
        <div className="app-wrapper">
          <div className="header-ornament">
            <div className="ornament-line" />
            <span style={{ color: 'var(--warm-gold)', fontSize: '1.1rem' }}>⚜</span>
            <div className="ornament-line" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              {phase === 'in-game' && (
                <button
                  type="button"
                  onClick={goHome}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', fontSize: '1.0rem', letterSpacing: '0.06em',
                    color: 'var(--stone-gray)', padding: '0.2rem 0.4rem',
                  }}
                >
                  ←
                </button>
              )}
            </div>
            <h1 style={{ cursor: 'pointer' }} onClick={goHome}>Carcassonne</h1>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {user && (
                <button
                  type="button"
                  onClick={() => { signOut(); goHome(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.06em',
                    color: 'var(--stone-gray)', padding: '0.2rem 0.4rem',
                  }}
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
          <div className="header-ornament" style={{ marginTop: '0.45rem' }}>
            <div className="ornament-line" />
            <span style={{ color: 'var(--warm-gold)', fontSize: '0.75rem', letterSpacing: '0.3em' }}>✦ ✦ ✦</span>
            <div className="ornament-line" />
          </div>
        </div>
      </header>

      {/* ── Loading ── */}
      {(loading || authLoading) && (
        <div className="app-wrapper" style={{ textAlign: 'center', paddingTop: '4rem', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', letterSpacing: '0.1em' }}>
          Loading...
        </div>
      )}

      {/* ── Auth ── */}
      {!loading && !authLoading && phase === 'auth' && (
        <Auth onSuccess={() => setPhase('realm')} />
      )}

      {/* ── Realm picker ── */}
      {!loading && !authLoading && phase === 'realm' && (
        <div className="app-wrapper">
          <RealmPicker
            key={realmPickerKey}
            initialMode={realmInitialMode}
            realms={realms}
            onSelect={handleRealmSelect}
            onCreate={handleRealmCreate}
            onDelete={handleRealmDelete}
            isAuthed={!!user}
            onAuthRequired={() => setPhase('auth')}
          />
        </div>
      )}

      {/* ── In-game ── */}
      {!loading && !authLoading && phase === 'in-game' && (
        <div className="app-wrapper">
          <nav className="tab-nav" role="tablist">
              {IN_GAME_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`tab-btn${tab === id ? ' active' : ''}${id === 'collection' ? ' tab-btn-right' : ''}`}
                  onClick={() => setTab(id)}
                  role="tab"
                  aria-selected={tab === id}
                >
                  {label}
                </button>
              ))}
            </nav>

          <div className="section-panel">
            {tab === 'board' && (
              session.finalScores
                ? <GameLogForm
                    session={session}
                    ownedExpansions={ownedExpansions}
                    onSubmit={handleRecordGame}
                    onCancel={() => setSession(prev => ({ ...prev, finalScores: null }))}
                  />
                : session.players
                  ? <Board key={gameKey} session={session} onFinish={handleFinishGame} onReset={handleBoardReset} />
                  : <PreGame realm={session.realm} ownedExpansions={ownedExpansions} onStart={handleGameStart} defaultMeeples={session.lastMeeples} defaultExpansions={session.lastExpansions} />
            )}
            {tab === 'history' && <GameHistory games={realmGames} onDelete={handleDelete} />}
            {tab === 'standings' && <Stats games={realmGames} />}
            {tab === 'collection' && <Collection expansions={expansions} onToggle={toggleExpansion} userId={user?.id} />}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
