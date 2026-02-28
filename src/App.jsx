import { useState, useCallback } from 'react';
import GameLogForm  from './components/GameLogForm';
import GameHistory  from './components/GameHistory';
import Stats        from './components/Stats';
import Collection   from './components/Collection';
import Board        from './components/Board';
import RealmPicker  from './components/RealmPicker';
import PreGame      from './components/PreGame';
import { useGameData } from './hooks/useGameData';
import { resetBoard }  from './data/boardStorage';

const IN_GAME_TABS = [
  { id: 'board',      label: 'Game Board' },
  { id: 'history',    label: 'Logbook'    },
  { id: 'standings',  label: 'Standings'  },
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
  const [phase,   setPhase]   = useState('realm');
  const [session, setSession] = useState(null);
  const [tab,     setTab]     = useState('board');
  const [gameKey, setGameKey] = useState(0); // incremented each new game so Board remounts fresh
  const [toast,   setToast]   = useState(null);

  const { games, expansions, realms, addGame, deleteGame, toggleExpansion, addRealm, updateRealm } = useGameData();

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3100);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    setSession({ realm });
    setPhase('pre-game');
  }, []);

  const handleRealmCreate = useCallback((data) => {
    const realm = addRealm(data);
    setSession({ realm });
    setPhase('pre-game');
  }, [addRealm]);

  const handleGameStart = useCallback((setup) => {
    // setup = { players, meeples, expansions }
    resetBoard(setup.players);
    setSession(prev => ({ ...prev, ...setup, finalScores: null }));
    setGameKey(k => k + 1);
    setPhase('in-game');
    setTab('board');
  }, []);

  const handleFinishGame = useCallback((finalScores) => {
    setSession(prev => {
      resetBoard(prev.players);
      return { ...prev, finalScores };
    });
    setPhase('record-game');
  }, []);

  const handleRecordGame = useCallback((gameData) => {
    addGame({ ...gameData, realmId: session.realm.id });
    showToast('Game recorded in the logbook.');
    setPhase('in-game');
    setTab('history');
  }, [addGame, session, showToast]);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Remove this game from the logbook? This cannot be undone.')) return;
    deleteGame(id);
    showToast('Game removed.');
  }, [deleteGame, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, updateRealm]);

  const ownedExpansions = expansions.filter(e => e.owned).map(e => e.name);
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
          <h1>Carcassonne</h1>
          <div className="header-ornament" style={{ marginTop: '0.45rem' }}>
            <div className="ornament-line" />
            <span style={{ color: 'var(--warm-gold)', fontSize: '0.75rem', letterSpacing: '0.3em' }}>✦ ✦ ✦</span>
            <div className="ornament-line" />
          </div>
        </div>
      </header>

      {/* ── Realm picker ── */}
      {phase === 'realm' && (
        <div className="app-wrapper">
          <RealmPicker
            realms={realms}
            onSelect={handleRealmSelect}
            onCreate={handleRealmCreate}
          />
        </div>
      )}

      {/* ── Pre-game setup ── */}
      {phase === 'pre-game' && (
        <div className="app-wrapper">
          <div className="section-panel">
            <PreGame
              realm={session.realm}
              ownedExpansions={ownedExpansions}
              onStart={handleGameStart}
              onBack={() => { setSession(null); setPhase('realm'); }}
            />
          </div>
        </div>
      )}

      {/* ── In-game + record-game ── */}
      {(phase === 'in-game' || phase === 'record-game') && (
        <div className="app-wrapper">
          {/* Tab nav only shown during active in-game phase */}
          {phase === 'in-game' && (
            <nav className="tab-nav" role="tablist">
              {IN_GAME_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`tab-btn ${tab === id ? 'active' : ''}`}
                  onClick={() => setTab(id)}
                  role="tab"
                  aria-selected={tab === id}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}

          <div className="section-panel">
            {phase === 'in-game' && tab === 'board' && (
              <Board key={gameKey} session={session} onFinish={handleFinishGame} />
            )}
            {phase === 'in-game' && tab === 'history' && (
              <GameHistory games={realmGames} onDelete={handleDelete} />
            )}
            {phase === 'in-game' && tab === 'standings' && (
              <Stats games={realmGames} />
            )}
            {phase === 'in-game' && tab === 'collection' && (
              <Collection expansions={expansions} onToggle={toggleExpansion} />
            )}
            {phase === 'record-game' && (
              <GameLogForm
                session={session}
                ownedExpansions={ownedExpansions}
                onSubmit={handleRecordGame}
                onCancel={() => { setPhase('in-game'); setTab('board'); }}
              />
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
