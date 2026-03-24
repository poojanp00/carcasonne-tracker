import { useState } from 'react';

const TYPE_ORDER = ['road', 'city', 'monastery', 'field'];

const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  inn: 'Inn', cathedral: 'Cathedral',
  princess: 'Princess', fairy: 'Fairy',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  largest_city: 'Largest City', largest_road: 'Largest Road',
};

function calcRealmStats(games) {
  let totalPoints = 0, farmWins = 0, clutchGames = 0;
  const typePoints = {};
  for (const g of games) {
    const scores = g.players.map(p => p.score);
    const sorted = [...scores].sort((a, b) => b - a);
    totalPoints += scores.reduce((s, v) => s + v, 0);
    if (g.farmWin) farmWins++;
    if (g.clutchWin)clutchGames++;
    for (const p of g.players) {
      for (const [type, pts] of Object.entries(p.breakdown || {})) {
        typePoints[type] = (typePoints[type] || 0) + pts;
      }
    }
  }
  return { totalPoints, farmWins, clutchGames, typePoints };
}

// Calculate win-loss records for each player (no ties)
// {p1: {w: 5, l: 2}, p2: {w: 3, l: 4}}
function calcPlayerRecords(games, players) {
  const records = Object.fromEntries(players.map(p => [p.toLowerCase(), { w: 0, l: 0 }]));
  for (const g of games) {
    for (const p of g.players) {
      const key = p.name.toLowerCase();
      if (!records[key]) continue;
      
      // WIN RULE: Use precomputed winners from database
      const isWinner = g.winners?.includes(p.name) || false;
      if (isWinner) records[key].w++;
      else          records[key].l++;
    }
  }
  return records;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default function RealmPicker({ realms, currentRealm = null, games = [], onSelect, onCreate, onDelete, initialMode = null, isGuest = false }) {
  const [mode,             setMode]             = useState(initialMode);
  const [realmName,        setRealmName]        = useState('');
  const [playerCount,      setPlayerCount]      = useState(2);
  const [playerNames,      setPlayerNames]      = useState(['', '']);
  const [nameError,        setNameError]        = useState('');
  const [pendingAction,    setPendingAction]    = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const MAX_REALMS = 12;

  const syncCount = (n) => {
    const clamped = Math.max(2, Math.min(6, n));
    setPlayerCount(clamped);
    setPlayerNames(prev => {
      const updated = [...prev];
      while (updated.length < clamped) updated.push('');
      return updated.slice(0, clamped);
    });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (realms.length >= MAX_REALMS) {
      setNameError(`Realm limit reached. Delete an existing realm to create a new one.`);
      return;
    }
    
    // For guests and users: use defaults for empty player names
    const names = playerNames.map((name, i) => {
      const trimmed = name.trim();
      return trimmed || `Player ${i + 1}`;
    });
    
    // For guests: auto-name realm "Guest"
    // For users: require realm name
    const finalRealmName = isGuest ? 'Guest' : realmName.trim();
    
    if (!isGuest && !finalRealmName) return;
    if (names.length === 0) return;
    
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      setNameError('Player names must be unique.');
      return;
    }
    
    if (realms.some(r => r.name.toLowerCase() === finalRealmName.toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return;
    }
    
    setNameError('');
    onCreate({ name: finalRealmName, players: names });
    setRealmName('');
    setPlayerNames(['', '']);
    setPlayerCount(2);
  };

  const openDelete = (realm) => {
    setPendingAction({ type: 'delete', realm });
    setConfirmingDelete(true);
  };

  const closeModal = () => {
    setPendingAction(null);
    setConfirmingDelete(false);
  };

  const handleDeleteConfirm = () => {
    const realmId = pendingAction?.realm?.id;
    closeModal();
    if (realmId) onDelete(realmId);
  };

  return (
    <div>
      <div className="section-title">
        <h2>Realms</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{realms.length} {realms.length === 1 ? 'realm' : 'realms'}</span>}
      </div>

      {/* Delete confirmation modal */}
      {pendingAction && confirmingDelete && (
        <div className="realm-modal-overlay" onClick={closeModal}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently delete <strong>{pendingAction.realm.name}</strong> and all its recorded games. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

        <div style={{ paddingTop: '0.5rem' }}>

          {/* Realm chips */}
          {realms.length > 0 && (
            <div style={{ marginBottom: '1.3rem' }}>
              <div className="expansion-chips">
                {realms.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    className={`expansion-chip ${currentRealm?.id === r.id ? 'selected' : ''}`}
                    onClick={() => onSelect(r)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active realm stats */}
          {currentRealm && (() => {
            const rs      = calcRealmStats(games);
            const records = calcPlayerRecords(games, currentRealm.players);
            const typeEntries = [
              ...TYPE_ORDER,
              ...Object.keys(rs.typePoints).filter(t => !TYPE_ORDER.includes(t)),
            ];
            return (
              <div className="tile-card" style={{ marginBottom: '1.2rem', borderTop: '4px solid var(--warm-gold)' }}>
                {/* Header row: realm name + trash */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.12em', color: 'var(--stone-gray)', marginBottom: '0.25rem' }}>
                      ACTIVE REALM
                    </div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', fontWeight: 700, color: 'var(--earth-brown)' }}>
                      {currentRealm.name}
                    </div>
                  </div>
                  <button
                    className="realm-trash-btn"
                    onClick={() => openDelete(currentRealm)}
                    title="Delete realm"
                    style={{ marginTop: '0.1rem' }}
                  >
                    <TrashIcon />
                  </button>
                </div>

                <div style={{ marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                  {[...currentRealm.players]
                    .sort((a, b) => (records[b.toLowerCase()]?.w || 0) - (records[a.toLowerCase()]?.w || 0))
                    .map((name, i) => {
                      const w = records[name.toLowerCase()]?.w || 0;
                      return (
                        <span key={name}>
                          {i > 0 && <span style={{ color: 'var(--stone-gray)' }}> · </span>}
                          <span style={{ color: 'var(--charcoal)' }}>{name}</span>
                          {' '}
                          <span style={{ color: 'var(--forest-green)', fontWeight: 600 }}>{w}</span>
                        </span>
                      );
                    })}
                </div>
                <div className="stat-divider" style={{ margin: '0.5rem 0 0.8rem' }} />

                <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.5rem' }}>
                  REALM STATS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem 1.2rem', marginBottom: '0.9rem' }}>
                  {[
                    ['Games',        games.length],
                    ['Total Pts',    rs.totalPoints],
                    ['Farm Wins',    rs.farmWins],
                    ['Clutch Games', rs.clutchGames],
                  ].map(([label, val]) => (
                    <div key={label} className="stat-row" style={{ margin: 0 }}>
                      <span className="stat-label" style={{ fontSize: '0.82rem' }}>{label}</span>
                      <span className="stat-value" style={{ fontSize: '0.82rem' }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.5rem' }}>
                  POINT TOTALS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem 1.2rem' }}>
                  {typeEntries.map(t => (
                    <div key={t} className="stat-row" style={{ margin: 0 }}>
                      <span className="stat-label" style={{ fontSize: '0.82rem' }}>{TYPE_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1)}</span>
                      <span className="stat-value" style={{ fontSize: '0.82rem' }}>{rs.typePoints[t] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {realms.length === 0 && (
            <p style={{ marginBottom: '1rem', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--stone-gray)' }}>
              No realms yet — create one to begin.
            </p>
          )}
        </div>
    </div>
  );
}
