import { useState } from 'react';
import { hashPassword } from '../data/storage';

export default function RealmPicker({ realms, onSelect, onCreate, onDelete, initialMode = null, isAuthed = false, onAuthRequired }) {
  const [mode,             setMode]             = useState(initialMode);
  const [hoveredId,        setHoveredId]        = useState(null);
  const [realmName,        setRealmName]        = useState('');
  const [playerCount,      setPlayerCount]      = useState(2);
  const [playerNames,      setPlayerNames]      = useState(['', '']);
  const [nameError,        setNameError]        = useState('');
  const [pendingAction,    setPendingAction]    = useState(null); // { type: 'join'|'delete', realm }
  const [passwordInput,    setPasswordInput]    = useState('');
  const [passwordError,    setPasswordError]    = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [verifying,        setVerifying]        = useState(false);
  const [pendingCreate,    setPendingCreate]    = useState(null); // { name, players }
  const [createPassInput,  setCreatePassInput]  = useState('');
  const [createVerifying,  setCreateVerifying]  = useState(false);

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
    setPendingCreate({ name: realmName.trim(), players: names });
    setCreatePassInput('');
  };

  const handleSetPasscode = async () => {
    if (!createPassInput.trim()) return;
    setCreateVerifying(true);
    const passwordHash = await hashPassword(createPassInput.trim());
    const data = pendingCreate;
    setPendingCreate(null);
    setCreateVerifying(false);
    onCreate({ ...data, passwordHash });
  };

  const openJoin = (realm) => {
    if (!isAuthed) { onAuthRequired?.(); return; }
    if (!realm.passwordHash) { onSelect(realm); return; }
    setPendingAction({ type: 'join', realm });
    setPasswordInput('');
    setPasswordError('');
    setConfirmingDelete(false);
  };

  const openDelete = (e, realm) => {
    e.stopPropagation();
    if (!isAuthed) { onAuthRequired?.(); return; }
    setPendingAction({ type: 'delete', realm });
    setPasswordInput('');
    setPasswordError('');
    // no password set — jump straight to confirm step
    setConfirmingDelete(!realm.passwordHash);
  };

  const closeModal = () => {
    setPendingAction(null);
    setPasswordInput('');
    setPasswordError('');
    setConfirmingDelete(false);
    setVerifying(false);
  };

  const handleModalConfirm = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Passcode required.');
      return;
    }
    setVerifying(true);
    const hash = await hashPassword(passwordInput.trim());
    const { realm } = pendingAction;
    if (hash !== realm.passwordHash) {
      setPasswordError('Incorrect passcode.');
      setVerifying(false);
      return;
    }
    if (pendingAction.type === 'join') {
      setPendingAction(null);
      onSelect(realm);
    } else {
      setConfirmingDelete(true);
      setVerifying(false);
    }
  };

  const handleDeleteConfirm = () => {
    const realmId = pendingAction.realm.id;
    closeModal();
    onDelete(realmId);
  };

  return (
    <>
      {/* Join/delete password modal */}
      {pendingAction && (
        <div className="realm-modal-overlay" onClick={closeModal}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            {!confirmingDelete ? (
              <>
                <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.3rem' }}>
                  {pendingAction.type === 'join'
                    ? pendingAction.realm.name
                    : `Delete "${pendingAction.realm.name}"`}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--stone-gray)', fontStyle: 'italic', marginBottom: '1.1rem' }}>
                  {pendingAction.type === 'join'
                    ? 'Enter the realm passcode to continue.'
                    : 'Enter the realm passcode to confirm deletion.'}
                </p>
                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordInput}
                    onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleModalConfirm()}
                    placeholder="Passcode"
                    autoFocus
                  />
                </div>
                {passwordError && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--deep-red)', fontStyle: 'italic', marginBottom: '0.6rem' }}>
                    {passwordError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={closeModal}>Cancel</button>
                  <button
                    className={`btn btn-sm${pendingAction.type === 'delete' ? ' btn-danger' : ''}`}
                    onClick={handleModalConfirm}
                    disabled={verifying}
                  >
                    {verifying ? '...' : pendingAction.type === 'join' ? 'Enter' : 'Verify'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
                <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
                  This will permanently delete <strong>{pendingAction.realm.name}</strong> and all its recorded games. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={closeModal}>Cancel</button>
                  <button className="btn btn-danger btn-sm" onClick={handleDeleteConfirm}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Optional passcode modal shown after create form submit */}
      {pendingCreate && (
        <div className="realm-modal-overlay" onClick={() => setPendingCreate(null)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.3rem' }}>Set a Passcode</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--stone-gray)', fontStyle: 'italic', marginBottom: '1.1rem' }}>
              Optionally protect <strong>{pendingCreate.name}</strong> with a passcode. Anyone with the code can play — leave blank and proceed if you want it open.
            </p>
            <div className="form-group" style={{ marginBottom: '0.8rem' }}>
              <input
                type="password"
                className="form-input"
                value={createPassInput}
                onChange={e => setCreatePassInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetPasscode()}
                placeholder="Passcode (optional)"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { const data = pendingCreate; setPendingCreate(null); onCreate({ ...data, passwordHash: null }); }}
              >
                Proceed without
              </button>
              <button
                className="btn btn-sm"
                onClick={handleSetPasscode}
                disabled={!createPassInput.trim() || createVerifying}
              >
                {createVerifying ? '...' : 'Set Passcode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join mode */}
      {mode === 'join' && (
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
                onClick={() => openJoin(realm)}
                onMouseEnter={() => setHoveredId(realm.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="realm-card-top">
                  <span className="realm-card-name">{realm.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="realm-card-id">{realm.id}</span>
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
        </div>
      )}

      {/* Create mode */}
      {mode === 'create' && (
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
      )}

      {/* Landing */}
      {!mode && (
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
              <button className="btn realm-btn" onClick={() => isAuthed ? setMode('create') : onAuthRequired?.()}>
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
      )}
    </>
  );
}
