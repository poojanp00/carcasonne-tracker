import { useState, useCallback } from 'react';
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

const TABS = [
  { id: 'realms',     label: 'Realms'     },
  { id: 'statistics', label: 'Statistics' },
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
  const [session,        setSession]        = useState(null);
  const [tab,            setTab]            = useState('realms');
  const [gameKey,        setGameKey]        = useState(0);
  const [toast,          setToast]          = useState(null);
  const [realmPickerKey, setRealmPickerKey] = useState(0);

  const { user, authLoading, signOut } = useAuth();
  const { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm } = useGameData(user, authLoading);

  const goHome = useCallback(() => {
    setSession(null);
    setTab('realms');
    setRealmPickerKey(k => k + 1);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3100);
  }, []);

  const handleRealmSelect = useCallback((realm) => {
    setSession({ realm });
    setRealmPickerKey(k => k + 1);
  }, []);

  const handleRealmCreate = useCallback(async (data) => {
    const realm = await addRealm(data);
    setSession({ realm });
    setRealmPickerKey(k => k + 1);
  }, [addRealm]);

  const handleGameStart = useCallback((setup) => {
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
    deleteGame(id);
    showToast('Game removed.');
  }, [deleteGame, showToast]);

  const handleRealmDelete = useCallback(async (realmId) => {
    await removeRealm(realmId);
    if (session?.realm?.id === realmId) setSession(null);
    const remaining = realms.filter(r => r.id !== realmId);
    if (remaining.length === 0) { setRealmPickerKey(k => k + 1); setTab('realms'); }
    showToast('Realm deleted.');
  }, [removeRealm, session, realms, showToast]);

  const handleUpdateRealm = useCallback((patch) => {
    if (!session?.realm?.id) return;
    updateRealm(session.realm.id, patch);
    setSession(prev => ({ ...prev, realm: { ...prev.realm, ...patch } }));
  }, [session, updateRealm]);

  const handleTabChange = useCallback((id) => {
    if (id === 'realms') setRealmPickerKey(k => k + 1);
    setTab(id);
  }, []);

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
    : [];

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
            <div style={{ flex: 1 }} />
            <h1 style={{ cursor: 'pointer' }} onClick={goHome}>Meeple Log</h1>
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

      {/* ── Auth (signed out) ── */}
      {!loading && !authLoading && !user && (
        <Auth onSuccess={() => {}} />
      )}

      {/* ── Main (signed in) ── */}
      {!loading && !authLoading && user && (
        <div className="app-wrapper">
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

          <div className="section-panel">
            {tab === 'realms' && (
              <RealmPicker
                key={realmPickerKey}
                realms={realms}
                currentRealm={session?.realm || null}
                onSelect={handleRealmSelect}
                onCreate={handleRealmCreate}
                onDelete={handleRealmDelete}
                isAuthed={true}
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
                    />
                  : session.players
                    ? <Board key={gameKey} session={session} onFinish={handleFinishGame} onReset={handleBoardReset} />
                    : <PreGameSetup realm={session.realm} ownedExpansions={ownedExpansions} onStart={handleGameStart} defaultMeeples={session.lastMeeples} defaultExpansions={session.lastExpansions} />
                : (
                  <div>
                    <div className="section-title">
                      <h2>Game Board</h2>
                      <div className="section-title-line" />
                    </div>
                    <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', paddingTop: '2rem', textAlign: 'center' }}>Load a realm to begin.</p>
                  </div>
                )
            )}
            {tab === 'history' && <Logbook games={realmGames} onDelete={handleDelete} noRealm={!session} />}
            {tab === 'statistics' && <Statistics games={realmGames} noRealm={!session} />}
            {tab === 'collection' && <Collection expansions={expansions} onToggle={toggleExpansion} userId={user?.id} />}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
