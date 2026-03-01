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
import crownImg from '../images/icons/crown.png';

const TABS = [
  { id: 'realms',     label: 'Realms'     },
  { id: 'statistics', label: 'Statistics' },
  { id: 'history',    label: 'Logbook'    },
  { id: 'board',      label: 'Game Board' },
  { id: 'collection', label: 'Collection' },
];


function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}

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

  const { user, authLoading, signOut } = useAuth();
  const { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm } = useGameData(user, authLoading);

  // Auto-load the realm with the most recent game on initial data load
  useEffect(() => {
    if (loading || authLoading || !user || session || games.length === 0 || realms.length === 0) return;
    const latest = [...games].sort((a, b) => b.date.localeCompare(a.date))[0];
    const realm  = realms.find(r => r.id === latest?.realmId);
    if (realm) setSession({ realm });
  }, [loading, authLoading, user]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Maps expansion names to the score types they add beyond the base four
  const EXPANSION_TYPES = {
    'Inns & Cathedrals':          ['inn', 'cathedral'],
    'Bridges, Castles & Bazaars': ['inn', 'cathedral'],
    'The Princess & the Dragon':  ['princess', 'fairy'],
    'Traders & Builders':         ['wine', 'grain', 'cloth', 'pig'],
    'Count, King & Robber':       ['largest_city', 'largest_road'],
  };

  const handleGameStart = useCallback(async (setup) => {
    const extraTypes = (setup.expansions || []).flatMap(e => EXPANSION_TYPES[e] || []);
    await resetBoard(setup.players, extraTypes);
    setSession(prev => ({ ...prev, ...setup, finalScores: null }));
    setGameKey(k => k + 1);
  }, []);

  const handleBoardReset = useCallback(() => {
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    normalizeMeeples(prev.meeples),
      lastExpansions: prev.expansions,
    }));
  }, []);

  const handleFinishGame = useCallback((finalScores, scoreBreakdown, farmWin) => {
    setSession(prev => ({ ...prev, finalScores, scoreBreakdown, farmWin }));
    setTab('board');
  }, []);

  const handleRecordGame = useCallback((gameData) => {
    addGame({ ...gameData, realmId: session.realm.id });
    showToast('Game recorded in the logbook.');
    setSession(prev => ({
      realm: prev.realm,
      lastMeeples:    normalizeMeeples(prev.meeples),
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
      <header className="site-header">
        <div className="app-wrapper">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              {user && (
                <button
                  type="button"
                  onClick={() => { signOut(); goHome(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.06em',
                    color: 'var(--stone-gray)', padding: '0.1rem 0.3rem',
                  }}
                >
                  Sign Out
                </button>
              )}
            </div>
            <h1 style={{ cursor: 'pointer' }} onClick={goHome}>Meeple Log</h1>
            <div style={{ flex: 1 }} />
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
                realms={realms}
                currentRealm={session?.realm || null}
                games={realmGames}
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
                    : <PreGameSetup
                        key={session.realm.id}
                        realm={session.realm}
                        ownedExpansions={ownedExpansions}
                        onStart={handleGameStart}
                        defaultMeeples={session.lastMeeples}
                        defaultExpansions={session.lastExpansions}
                        realms={realms}
                        currentRealm={session?.realm || null}
                        onRealmChange={handleRealmSelect}
                      />
                : (
                  <div>
                    <div className="section-title">
                      <h2>Game Board</h2>
                      <div className="section-title-line" />
                    </div>
                    {realms.length > 0 && (
                      <div style={{ marginBottom: '1.3rem' }}>
                        <div className="expansion-chips">
                          {realms.map(r => (
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
                    <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', paddingTop: '1rem', textAlign: 'center' }}>
                      Select a realm to begin playing.
                    </p>
                  </div>
                )
            )}
            {tab === 'history' && <Logbook games={games} realms={realms} currentRealm={session?.realm || null} onRealmChange={handleRealmSelect} onDelete={handleDelete} />}
            {tab === 'statistics' && <Statistics games={games} realms={realms} currentRealm={session?.realm || null} onRealmChange={handleRealmSelect} />}
            {tab === 'collection' && <Collection expansions={expansions} onToggle={toggleExpansion} userId={user?.id} />}
          </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
