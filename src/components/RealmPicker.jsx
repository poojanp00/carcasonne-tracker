import { useState } from 'react';

export default function RealmPicker({ realms, onSelect, onCreate, initialMode = null }) {
  const [mode,        setMode]        = useState(initialMode); // null | 'join' | 'create'
  const [hoveredId,   setHoveredId]   = useState(null);
  const [realmName,   setRealmName]   = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [nameError,   setNameError]   = useState('');

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
    setNameError('');
    onCreate({ name: realmName.trim(), players: names });
  };

  if (mode === 'join') {
    return (
      <div className="realm-screen">
        <div className="realm-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>← Back</button>
          <h2>Choose Your Realm</h2>
        </div>
        <div className="realm-list">
          {realms.map(realm => (
            <div
              key={realm.id}
              className="realm-card"
              onClick={() => onSelect(realm)}
              onMouseEnter={() => setHoveredId(realm.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="realm-card-top">
                <span className="realm-card-name">{realm.name}</span>
                <span className="realm-card-id">{realm.id}</span>
              </div>
              <div className={`realm-card-players ${hoveredId === realm.id ? 'visible' : ''}`}>
                {realm.players.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="realm-screen">
        <div className="realm-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>← Back</button>
          <h2>Create New Realm</h2>
        </div>
        <form onSubmit={handleCreate} className="realm-create-form tile-card">
          <div className="form-group">
            <label className="form-label">Realm Name</label>
            <input
              className="form-input"
              value={realmName}
              onChange={e => setRealmName(e.target.value)}
              placeholder="e.g. The Keep"
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
          <div className="form-group">
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
          {nameError && (
            <p style={{ fontSize: '0.88rem', color: 'var(--deep-red)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
              {nameError}
            </p>
          )}
          <button type="submit" className="btn">Create Realm</button>
        </form>
      </div>
    );
  }

  // Landing
  return (
    <div className="realm-screen realm-landing">
      <div className="realm-landing-inner">
        <div className="header-ornament" style={{ marginBottom: '1.2rem' }}>
          <div className="ornament-line" />
          <span style={{ color: 'var(--warm-gold)', fontSize: '1.1rem' }}>⚜</span>
          <div className="ornament-line" />
        </div>
        <h2 style={{ color: 'var(--earth-brown)', marginBottom: '0.5rem' }}>Enter the Realm</h2>
        <p className="section-intro" style={{ marginBottom: '2rem' }}>
          Load an existing realm or create a new one.
        </p>
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
    </div>
  );
}
