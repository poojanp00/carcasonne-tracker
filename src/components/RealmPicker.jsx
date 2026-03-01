import { useState } from 'react';

const TYPE_ORDER = ['road', 'city', 'monastery', 'field'];

function calcRealmStats(games) {
  let totalPoints = 0, farmWins = 0, clutchGames = 0;
  const typePoints = {};
  for (const g of games) {
    const scores = g.players.map(p => p.score);
    const sorted = [...scores].sort((a, b) => b - a);
    totalPoints += scores.reduce((s, v) => s + v, 0);
    if (g.farmWin) farmWins++;
    if (sorted.length >= 2) {
      const combined = sorted[0] + sorted[1];
      if (combined > 0 && (sorted[0] - sorted[1]) / combined < 0.05) clutchGames++;
    }
    for (const p of g.players) {
      for (const [type, pts] of Object.entries(p.breakdown || {})) {
        typePoints[type] = (typePoints[type] || 0) + pts;
      }
    }
  }
  return { totalPoints, farmWins, clutchGames, typePoints };
}

function calcPlayerRecords(games, players) {
  const records = Object.fromEntries(players.map(p => [p.toLowerCase(), { w: 0, l: 0, t: 0 }]));
  for (const g of games) {
    const maxScore = Math.max(...g.players.map(p => p.score));
    const winners  = g.players.filter(p => p.score === maxScore);
    for (const p of g.players) {
      const key = p.name.toLowerCase();
      if (!records[key]) continue;
      if (winners.length > 1 && p.score === maxScore) records[key].t++;
      else if (p.score === maxScore)                   records[key].w++;
      else                                             records[key].l++;
    }
  }
  return records;
}

export default function RealmPicker({ realms, currentRealm = null, games = [], onSelect, onCreate, onDelete, initialMode = null }) {
  const [mode,             setMode]             = useState(initialMode);
  const [hoveredId,        setHoveredId]        = useState(null);
  const [realmName,        setRealmName]        = useState('');
  const [playerCount,      setPlayerCount]      = useState(2);
  const [playerNames,      setPlayerNames]      = useState(['', '']);
  const [nameError,        setNameError]        = useState('');
  const [pendingAction,    setPendingAction]    = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    const names = playerNames.map(n => n.trim()).filter(Boolean);
    if (!realmName.trim() || names.length === 0) return;
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      setNameError('Player names must be unique.');
      return;
    }
    if (realms.some(r => r.name.toLowerCase() === realmName.trim().toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return;
    }
    setNameError('');
    onCreate({ name: realmName.trim(), players: names, passwordHash: null });
    setRealmName('');
    setPlayerNames(['', '']);
    setPlayerCount(2);
  };

  const openJoin = (realm) => {
    onSelect(realm);
  };

  const openDelete = (e, realm) => {
    e.stopPropagation();
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

      {/* Join mode */}
      {mode === 'join' && (
        <div className="realm-screen">
          <div className="realm-list">
            {realms.map(realm => (
              <div
                key={realm.id}
                className="realm-card"
                onClick={() => openJoin(realm)}
                onMouseEnter={() => setHoveredId(realm.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="realm-card-top">
                  <span className="realm-card-name">{realm.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      className="realm-trash-btn"
                      onClick={e => openDelete(e, realm)}
                      title="Delete realm"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={`realm-card-players ${hoveredId === realm.id ? 'visible' : ''}`}>
                  {realm.players.join(' · ')}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>← Back</button>
          </div>
        </div>
      )}

      {/* Create mode */}
      {mode === 'create' && (
        <div className="realm-screen">
          <form onSubmit={handleCreate}>
            <div className="tile-card" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ maxWidth: '360px' }}>
                <label className="form-label">Realm Name</label>
                <input
                  className="form-input"
                  value={realmName}
                  onChange={e => setRealmName(e.target.value)}
                  placeholder="e.g. Mont Shastaire"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Number of Players</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => syncCount(playerCount - 1)}
                    disabled={playerCount <= 2}
                    style={{ width: '2.2rem', justifyContent: 'center' }}
                  >−</button>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--earth-brown)' }}>
                    {playerCount}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => syncCount(playerCount + 1)}
                    disabled={playerCount >= 6}
                    style={{ width: '2.2rem', justifyContent: 'center' }}
                  >+</button>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: '360px' }}>
                <label className="form-label">Player Names</label>
                <div className="realm-player-inputs">
                  {playerNames.map((name, i) => (
                    <input
                      key={i}
                      className="form-input"
                      value={name}
                      onChange={e => {
                        const u = [...playerNames];
                        u[i] = e.target.value;
                        setPlayerNames(u);
                        setNameError('');
                      }}
                      placeholder={`Player ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            {nameError && (
              <p style={{ fontSize: '0.88rem', color: 'var(--deep-red)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                {nameError}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>← Back</button>
              <button type="submit" className="btn">Create Realm</button>
            </div>
          </form>
        </div>
      )}

      {/* Landing */}
      {!mode && (
        <div style={{ paddingTop: '0.5rem' }}>
          {currentRealm && (() => {
            const rs = calcRealmStats(games);
            const records = calcPlayerRecords(games, currentRealm.players);
            const typeEntries = [
              ...TYPE_ORDER.filter(t => (rs.typePoints[t] ?? 0) > 0),
              ...Object.keys(rs.typePoints).filter(t => !TYPE_ORDER.includes(t) && (rs.typePoints[t] ?? 0) > 0),
            ];
            return (
              <div className="tile-card" style={{ marginBottom: '1.5rem', borderTop: '4px solid var(--warm-gold)' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.12em', color: 'var(--stone-gray)', marginBottom: '0.5rem' }}>
                  ACTIVE REALM
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', fontWeight: 700, color: 'var(--earth-brown)', marginBottom: '0.35rem' }}>
                  {currentRealm.name}
                </div>

                {games.length > 0 && (
                  <>
                    {/* Per-player record */}
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
                  </>
                )}

                {games.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.5rem' }}>
                      REALM STATS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem 1.2rem', marginBottom: typeEntries.length > 0 ? '0.9rem' : 0 }}>
                      {[
                        ['Games',       games.length],
                        ['Total Pts',   rs.totalPoints],
                        ['Farm Wins',   rs.farmWins],
                        ['Clutch Games', rs.clutchGames],
                      ].map(([label, val]) => (
                        <div key={label} className="stat-row" style={{ margin: 0 }}>
                          <span className="stat-label" style={{ fontSize: '0.82rem' }}>{label}</span>
                          <span className="stat-value" style={{ fontSize: '0.82rem' }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {typeEntries.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.5rem' }}>
                          POINT TOTALS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem 1.2rem' }}>
                          {typeEntries.map(t => (
                            <div key={t} className="stat-row" style={{ margin: 0 }}>
                              <span className="stat-label" style={{ fontSize: '0.82rem' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                              <span className="stat-value" style={{ fontSize: '0.82rem' }}>{rs.typePoints[t]}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })()}
          <div className="realm-btn-group">
            <button
              className="btn realm-btn"
              onClick={() => setMode('join')}
              disabled={realms.length === 0}
              title={realms.length === 0 ? 'No realms yet — create one first' : undefined}
            >
              Load Realm
            </button>
            <button className="btn realm-btn" onClick={() => setMode('create')}>
              Create New Realm
            </button>
          </div>
          {realms.length === 0 && (
            <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--stone-gray)' }}>
              No realms yet — create one to begin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
