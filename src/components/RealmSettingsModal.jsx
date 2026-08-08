import { useState, useEffect } from 'react';
import { TrashIcon, GearIcon } from './icons';
import { CHESTS, chestFor } from '../data/chests';
import { SPINES, spineFor } from '../data/spines';
import ArtPickerGrid from './ArtPickerGrid';

// Realm Settings — rename/chest/logbook (owner only) plus the Danger Zone
// (Delete for the owner, Leave for a member), mirroring Profile's Account
// Settings. Opened directly from a realm card's gear icon — the sole
// settings entry point for a realm.
export default function RealmSettingsModal({ realm, realms = [], unlockedChestIndices = null, unlockedLogbookIndices = null, onUpdateRealm, onDeleteRealm, onLeaveRealm, onClose }) {
  // Which CHESTS/SPINES index is actually claimed via each independent
  // art-unlock track (see utils/artUnlocks.js) — defaults to just index 0
  // (item 1's guaranteed rank-1 grant) if the caller hasn't loaded real
  // state yet.
  const unlockedChestIdx = unlockedChestIndices || new Set([0]);
  const unlockedLogbookIdx = unlockedLogbookIndices || new Set([0]);
  const [view,           setView]           = useState('menu'); // 'menu' | 'rename' | 'chest' | 'logbook' | 'players'
  const [nameInput,      setNameInput]      = useState(realm.name);
  const [nameError,      setNameError]      = useState('');
  const [chestPick,      setChestPick]      = useState(realm.chest ?? 0);
  const [spinePick,      setSpinePick]      = useState(realm.spine ?? 0);
  const [newPlayerName,  setNewPlayerName]  = useState('');
  const [playerError,    setPlayerError]    = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [confirmLeave,   setConfirmLeave]   = useState(false);
  // Danger Zone starts collapsed — Delete/Leave only becomes visible (let
  // alone clickable) once deliberately opened.
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);

  useEffect(() => {
    const isOpen = view || confirmDelete || confirmLeave;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [view, confirmDelete, confirmLeave]);

  const startRename = () => { setNameInput(realm.name); setNameError(''); setView('rename'); };

  const handleSaveName = (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('Realm name cannot be empty.'); return; }
    if (realms.some(r => r.id !== realm.id && r.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return;
    }
    onUpdateRealm?.(realm.id, { name: trimmed });
    setView('menu');
  };

  const openChestPicker   = () => { setChestPick(realm.chest ?? 0); setView('chest'); };
  const handleSaveChest   = () => { onUpdateRealm?.(realm.id, { chest: chestPick }); setView('menu'); };

  const openLogbookPicker = () => { setSpinePick(realm.spine ?? 0); setView('logbook'); };
  const handleSaveLogbook = () => { onUpdateRealm?.(realm.id, { spine: spinePick }); setView('menu'); };

  // Add-player — no upper bound on a realm's roster (only a single game's
  // active roster is capped, see PreGameSetup.jsx's Players step). Stays on
  // this view after a successful add (just clears the input) rather than
  // returning to the menu, so adding several players in a row doesn't mean
  // re-opening this view each time.
  const openAddPlayer = () => { setNewPlayerName(''); setPlayerError(''); setView('players'); };
  const handleAddPlayer = (e) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) { setPlayerError('Enter a player name.'); return; }
    const existing = realm.players || [];
    if (existing.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setPlayerError('A player with this name already exists.');
      return;
    }
    onUpdateRealm?.(realm.id, { players: [...existing, { name: trimmed, userId: null, status: 'uninvited' }] });
    setNewPlayerName('');
    setPlayerError('');
  };

  return (
    <>
      {view === 'menu' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <GearIcon /> Realm Settings
            </h3>

            {realm.isOwner !== false && (
              <div className="settings-section">
                <div className="settings-section-header">Realm Identity</div>
                <div className="settings-row">
                  <span className="settings-row-label">Realm Name</span>
                  <span className="settings-row-control">
                    <span className="settings-row-value">{realm.name}</span>
                    <button type="button" className="settings-edit-btn" onClick={startRename}>Rename</button>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">Chest</span>
                  <span className="settings-row-control">
                    <img src={chestFor(realm)} alt="" style={{ height: '36px', width: 'auto' }} draggable={false} />
                    <button type="button" className="settings-edit-btn" onClick={openChestPicker}>Change</button>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">Logbook</span>
                  <span className="settings-row-control">
                    <img src={spineFor(realm)} alt="" style={{ height: '44px', width: 'auto' }} draggable={false} />
                    <button type="button" className="settings-edit-btn" onClick={openLogbookPicker}>Change</button>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">Players</span>
                  <span className="settings-row-control">
                    <span className="settings-row-value">{(realm.players || []).length}</span>
                    <button type="button" className="settings-edit-btn" onClick={openAddPlayer}>Add</button>
                  </span>
                </div>
              </div>
            )}

            <div className="settings-section settings-danger">
              <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Danger Zone</span>
                <button type="button" className="settings-edit-btn" onClick={() => setDangerZoneOpen(v => !v)}>
                  {dangerZoneOpen ? 'Close' : 'Open'}
                </button>
              </div>
              {dangerZoneOpen && (realm.isOwner !== false ? (
                <div className="settings-row">
                  <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                    Permanently delete this realm and all its games
                  </span>
                  <button
                    type="button"
                    className="settings-delete-btn"
                    onClick={() => { setView(null); setConfirmDelete(true); }}
                  >
                    <TrashIcon /> Delete Realm
                  </button>
                </div>
              ) : (
                <div className="settings-row">
                  <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                    Leave this shared realm
                  </span>
                  <button
                    type="button"
                    className="settings-delete-btn"
                    onClick={() => { setView(null); setConfirmLeave(true); }}
                  >
                    Leave Realm
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.4rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename realm */}
      {view === 'rename' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem' }}>Rename Realm</h3>
            <form onSubmit={handleSaveName}>
              <input
                type="text"
                className="form-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={20}
                autoFocus
                placeholder="Realm name"
                style={{ width: '100%', marginBottom: '1rem' }}
              />
              {nameError && (
                <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{nameError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Cancel</button>
                <button type="submit" className="btn btn-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add player */}
      {view === 'players' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem' }}>Add Player</h3>
            {(realm.players || []).length > 0 && (
              <div className="expansion-chips" style={{ marginBottom: '1rem' }}>
                {(realm.players || []).map(p => (
                  <span key={p.name} className="expansion-chip display-only">{p.name}</span>
                ))}
              </div>
            )}
            <form onSubmit={handleAddPlayer}>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label">Player Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlayerName}
                  onChange={e => { setNewPlayerName(e.target.value); setPlayerError(''); }}
                  maxLength={20}
                  autoFocus
                  placeholder="e.g. Alex"
                  style={{ width: '100%' }}
                />
              </div>
              {playerError && (
                <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{playerError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Done</button>
                <button type="submit" className="btn btn-sm">+ Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change chest */}
      {view === 'chest' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '0.8rem' }}>Change Chest</h3>
            <ArtPickerGrid
              items={CHESTS}
              rowClassName="chest-picker-row"
              pickClassName="chest-pick"
              altPrefix="Chest"
              selectedIndex={chestPick}
              onSelect={setChestPick}
              isLocked={i => !unlockedChestIdx.has(i)}
            />
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={handleSaveChest}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Change logbook */}
      {view === 'logbook' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '0.8rem' }}>Change Logbook</h3>
            <ArtPickerGrid
              items={SPINES}
              rowClassName="logbook-picker-row"
              pickClassName="logbook-pick"
              altPrefix="Logbook"
              selectedIndex={spinePick}
              onSelect={setSpinePick}
              isLocked={i => !unlockedLogbookIdx.has(i)}
            />
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={handleSaveLogbook}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-realm confirmation */}
      {confirmDelete && (
        <div className="realm-modal-overlay" onClick={() => { setConfirmDelete(false); onClose(); }}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently delete <strong>{realm.name}</strong> and all its data.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmDelete(false); onClose(); }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setConfirmDelete(false); onDeleteRealm?.(realm.id); onClose(); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave-realm confirmation (shared realms only) */}
      {confirmLeave && (
        <div className="realm-modal-overlay" onClick={() => { setConfirmLeave(false); onClose(); }}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.5rem' }}>Leave this realm?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              <strong>{realm.name}</strong> and its games will disappear from your account.
              The owner's data is unaffected, and they can invite you again later.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmLeave(false); onClose(); }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setConfirmLeave(false); onLeaveRealm?.(realm.id); onClose(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
