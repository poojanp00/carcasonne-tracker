import { useState, useEffect } from 'react';
import ValInfo from './ValInfo';
import { TrashIcon, GearIcon } from './icons';
import { CHESTS, chestFor, unlockedChestCount, chestUnlockRank } from '../data/chests';
import { SPINES, spineFor, unlockedSpineCount, spineUnlockRank } from '../data/spines';

// Realm Settings — rename/chest/logbook (owner only) plus the Danger Zone
// (Delete for the owner, Leave for a member), mirroring Profile's Account
// Settings. Opened directly from a realm card's gear icon — the sole
// settings entry point for a realm.
export default function RealmSettingsModal({ realm, realms = [], selfRank = 1, onUpdateRealm, onDeleteRealm, onLeaveRealm, onClose }) {
  const [view,           setView]           = useState('menu'); // 'menu' | 'rename' | 'chest' | 'logbook'
  const [nameInput,      setNameInput]      = useState(realm.name);
  const [nameError,      setNameError]      = useState('');
  const [chestPick,      setChestPick]      = useState(realm.chest ?? 0);
  const [spinePick,      setSpinePick]      = useState(realm.spine ?? 0);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [confirmLeave,   setConfirmLeave]   = useState(false);

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
              </div>
            )}

            <div className="settings-section settings-danger">
              <div className="settings-section-header">Danger Zone</div>
              {realm.isOwner !== false ? (
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
              )}
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

      {/* Change chest */}
      {view === 'chest' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '0.8rem' }}>Change Chest</h3>
            <div className="chest-picker-row">
              {CHESTS.slice(0, unlockedChestCount(selfRank)).map((img, i) => (
                <ValInfo key={i} tip={`Unlocked at Rank ${chestUnlockRank(i)}`}>
                  <button
                    type="button"
                    className={`chest-pick${chestPick === i ? ' selected' : ''}`}
                    onClick={() => setChestPick(i)}
                  >
                    <img src={img} alt={`Chest ${i + 1}`} />
                  </button>
                </ValInfo>
              ))}
            </div>
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
            <div className="logbook-picker-row">
              {SPINES.slice(0, unlockedSpineCount(selfRank)).map((img, i) => (
                <ValInfo key={i} tip={`Unlocked at Rank ${spineUnlockRank(i)}`}>
                  <button
                    type="button"
                    className={`logbook-pick${spinePick === i ? ' selected' : ''}`}
                    onClick={() => setSpinePick(i)}
                  >
                    <img src={img} alt={`Logbook ${i + 1}`} draggable={false} />
                  </button>
                </ValInfo>
              ))}
            </div>
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
              This will permanently delete <strong>{realm.name}</strong> and all its recorded games. This cannot be undone.
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
