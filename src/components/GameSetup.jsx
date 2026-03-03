import { useState } from 'react';

export default function GameSetup({ realms, onRealmSelect, onRealmCreate, onCancel }) {
  const [mode, setMode] = useState('initial'); // 'initial' | 'pick-realm' | 'create-realm'
  const [realmName, setRealmName] = useState('');
  const [playerCount, setPlayerCount] = useState(3);
  const [playerNames, setPlayerNames] = useState(['', '', '']);
  const [nameError, setNameError] = useState('');

  const syncCount = (count) => {
    const clamped = Math.max(2, Math.min(6, count));
    setPlayerCount(clamped);
    setPlayerNames(prev => {
      const updated = [...prev];
      while (updated.length < clamped) updated.push('');
      return updated.slice(0, clamped);
    });
  };

  const handleRealmSelect = (realm) => {
    onRealmSelect(realm);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const filtered = playerNames.filter(n => n.trim());
    if (filtered.length < 2) {
      setNameError('At least 2 player names required.');
      return;
    }
    if (new Set(filtered.map(n => n.trim().toLowerCase())).size < filtered.length) {
      setNameError('Player names must be unique.');
      return;
    }
    onRealmCreate({
      name: realmName.trim(),
      players: filtered.map(n => n.trim())
    });
  };

  // Initial choice screen
  if (mode === 'initial') {
    return (
      <div>
        <div className="section-title">
          <h2>Start New Game</h2>
          <div className="section-title-line" />
        </div>

        <div className="tile-card" style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('pick-realm')}
              disabled={realms.length === 0}
            >
              Load Existing Realm
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode('create-realm')}
            >
              Create New Realm
            </button>

            {realms.length === 0 && (
              <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>
                No existing realms found. Create a new one to get started.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pick existing realm
  if (mode === 'pick-realm') {
    return (
      <div>
        <div className="section-title">
          <h2>Select Realm</h2>
          <div className="section-title-line" />
        </div>

        <div className="tile-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="expansion-chips" style={{ justifyContent: 'center' }}>
              {realms.map(realm => (
                <button
                  key={realm.id}
                  type="button"
                  className="expansion-chip"
                  onClick={() => handleRealmSelect(realm)}
                  style={{ cursor: 'pointer' }}
                >
                  {realm.name}
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>
                    {realm.players?.length || 0} players
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMode('initial')}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create new realm
  if (mode === 'create-realm') {
    return (
      <div>
        <div className="section-title">
          <h2>Create New Realm</h2>
          <div className="section-title-line" />
        </div>

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
            <div style={{ color: '#DC2626', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '1rem', textAlign: 'center' }}>
              {nameError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode('initial')}
            >
              ← Back
            </button>
            <button type="submit" className="btn">
              Create & Continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}