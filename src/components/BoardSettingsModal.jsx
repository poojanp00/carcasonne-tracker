import { useState } from 'react';
import { GearIcon } from './icons';
import { MAX_GAME_PLAYERS } from '../constants';

// Standard + fun meeples, directly pickable (no mystery/random step —
// that's a pre-game convenience, not something an in-progress edit needs).
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLES = Object.entries(MEEPLE_MODULES).map(([path, img]) => {
  const key = path.split('/').pop();
  return { key, img, label: key.replace('.png', '') };
}).sort((a, b) => a.label.localeCompare(b.label));

const FUN_MODULES = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const FUN_MEEPLES = Object.entries(FUN_MODULES)
  .filter(([path]) => !path.endsWith('.heic'))
  .map(([path, img]) => ({ key: `fun/${path.split('/').pop()}`, img }));

const MEEPLE_OPTIONS = [...MEEPLES, ...FUN_MEEPLES];

// In-game settings — reached from the score board's Settings button (was a
// bare Reset button). Styled after RealmSettingsModal (same menu → sub-view
// pattern, same .settings-* classes) so this reads as "the same kind of
// settings panel" rather than a one-off. Every edit here applies instantly
// (Board.jsx's callbacks own the actual state surgery and any confirm
// dialogs for destructive edits) — there's no separate Save step, so the
// board's own buttons react live as players/meeples/expansions are toggled.
export default function BoardSettingsModal({
  realm,
  players,
  meepleMap,
  expansions,
  ownedExpansions,
  onTogglePlayer,
  onSetMeeple,
  onToggleExpansion,
  onResetGame,
  onClose,
}) {
  const [view, setView] = useState('menu'); // 'menu' | 'players' | 'meeples' | 'expansions'
  const [meepleError, setMeepleError] = useState('');

  const roster = realm?.players || [];

  const handlePickMeeple = (name, key) => {
    setMeepleError(onSetMeeple(name, key) || '');
  };

  return (
    <>
      {view === 'menu' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <GearIcon /> Game Settings
            </h3>

            <div className="settings-section">
              <div className="settings-section-header">This Game</div>
              <div className="settings-row">
                <span className="settings-row-label">Players</span>
                <span className="settings-row-control">
                  <span className="settings-row-value">{players.length}</span>
                  <button type="button" className="settings-edit-btn" onClick={() => setView('players')}>Edit</button>
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Meeples</span>
                <span className="settings-row-control">
                  <button type="button" className="settings-edit-btn" onClick={() => setView('meeples')}>Edit</button>
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Expansions</span>
                <span className="settings-row-control">
                  <span className="settings-row-value">{expansions.length === 0 ? 'Base Game' : `${expansions.length} active`}</span>
                  <button type="button" className="settings-edit-btn" onClick={() => setView('expansions')}>Edit</button>
                </span>
              </div>
            </div>

            <div className="settings-section settings-danger">
              <div className="settings-section-header">Danger Zone</div>
              <div className="settings-row">
                <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                  Clear all scores and start this game over
                </span>
                <button type="button" className="settings-delete-btn" onClick={() => { onClose(); onResetGame(); }}>
                  Reset Game
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.4rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      )}

      {view === 'players' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.3rem' }}>Edit Players</h3>
            <p className="section-intro" style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
              Tap a name to add or remove them from this game (2–{MAX_GAME_PLAYERS} players).
            </p>
            <div className="expansion-chips">
              {roster.map(p => {
                const active = players.includes(p.name);
                const disabled = (!active && players.length >= MAX_GAME_PLAYERS) || (active && players.length <= 2);
                return (
                  <button
                    key={p.name}
                    type="button"
                    className={`expansion-chip ${active ? 'selected' : ''}`}
                    disabled={disabled}
                    style={disabled ? { opacity: 0.45, cursor: 'var(--cursor-arrow)' } : undefined}
                    onClick={() => onTogglePlayer(p.name)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Back</button>
            </div>
          </div>
        </div>
      )}

      {view === 'meeples' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.8rem' }}>Edit Meeples</h3>
            <div className="meeple-picker-grid">
              {players.map(name => (
                <div key={name} className="meeple-picker-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                  <span className="meeple-picker-name">{name}</span>
                  <div className="meeple-options">
                    {MEEPLE_OPTIONS.map(({ key, img }) => (
                      <button
                        key={key}
                        type="button"
                        className={`meeple-option ${meepleMap[name] === key ? 'selected' : ''}`}
                        onClick={() => handlePickMeeple(name, key)}
                      >
                        <img src={img} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {meepleError && (
              <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginTop: '0.9rem' }}>{meepleError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Back</button>
            </div>
          </div>
        </div>
      )}

      {view === 'expansions' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.3rem' }}>Edit Expansions</h3>
            <p className="section-intro" style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
              Tap an expansion to add or remove it from this game. The board's buttons update right away.
            </p>
            <div className="expansion-chips">
              {ownedExpansions.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`expansion-chip ${expansions.includes(name) ? 'selected' : ''}`}
                  onClick={() => onToggleExpansion(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Back</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
