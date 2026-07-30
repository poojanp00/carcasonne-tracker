import { useState } from 'react';
import { GearIcon } from './icons';
import { MAX_GAME_PLAYERS } from '../constants';
import { DEFAULT_EXPANSIONS } from '../data/expansions';

// Standard meeples only, same as the pregame Players step (PreGameSetup.jsx)
// — the fun/ meeples aren't offered directly as their own tiles there either;
// they only ever surface one at a time through the "mystery.png" slot below,
// which resolves to a random one on click instead of the full gallery being
// browsable. Kept identical here so an in-game edit doesn't reveal the whole
// fun collection up front.
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLES = Object.entries(MEEPLE_MODULES).map(([path, img]) => {
  const key = path.split('/').pop();
  return { key, img, label: key.replace('.png', '') };
}).sort((a, b) => a.label.localeCompare(b.label));

const FUN_MODULES = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const FUN_MEEPLES = Object.entries(FUN_MODULES)
  .filter(([path]) => !path.endsWith('.heic'))
  .map(([path, img]) => ({ key: `fun/${path.split('/').pop()}`, img }));

// In-game settings — reached from the score board's Settings button (was a
// bare Reset button). Styled after RealmSettingsModal (same menu → sub-view
// pattern, same .settings-* classes) so this reads as "the same kind of
// settings panel" rather than a one-off. Players toggles apply instantly
// (Board.jsx's callback owns the actual state surgery and any confirm
// dialogs for destructive edits). Meeples and Expansions both instead mirror
// their pregame counterparts — Back/Save, everything staged locally as a
// draft and only committed on Save — so the board (and any recorded-points
// warning, for Expansions) only updates once, not per click.
export default function BoardSettingsModal({
  realm,
  players,
  meepleMap,
  expansions,
  ownedExpansions,
  onTogglePlayer,
  onSaveMeeples,
  onSaveExpansions,
  onResetGame,
  onClose,
}) {
  const [view, setView] = useState('menu'); // 'menu' | 'players' | 'meeples' | 'expansions'
  const [meepleError, setMeepleError] = useState('');
  // Draft selections — only committed (via onSaveMeeples/onSaveExpansions)
  // when Save is pressed; seeded fresh from the live props every time the
  // relevant view is (re)entered (see openMeeples/openExpansions), so
  // backing out without saving always discards any in-progress picks.
  const [pendingMeeples,    setPendingMeeples]    = useState(meepleMap);
  const [pendingExpansions, setPendingExpansions] = useState(expansions);

  const roster = realm?.players || [];

  const openMeeples = () => { setPendingMeeples(meepleMap); setMeepleError(''); setView('meeples'); };
  // Mirrors PreGameSetup's handleMeepleSelect: picking the mystery slot
  // resolves immediately to a random fun meeple (preferring one no other
  // player's *draft* pick currently has) rather than setting 'mystery.png'
  // itself as the stored meeple. A regular pick is checked against the same
  // draft for a conflict, same rule Board.jsx used to enforce per click.
  const handlePickMeeple = (name, key) => {
    if (key === 'mystery.png') {
      const availableFunMeeples = FUN_MEEPLES.filter(fm => !Object.values(pendingMeeples).includes(fm.key));
      const pool = availableFunMeeples.length > 0 ? availableFunMeeples : FUN_MEEPLES;
      const randomFunMeeple = pool[Math.floor(Math.random() * pool.length)];
      setPendingMeeples(prev => ({ ...prev, [name]: randomFunMeeple.key }));
      setMeepleError('');
      return;
    }
    const conflict = Object.entries(pendingMeeples).find(([p, k]) => p !== name && k === key);
    if (conflict) { setMeepleError(`Already used by ${conflict[0]}.`); return; }
    setPendingMeeples(prev => ({ ...prev, [name]: key }));
    setMeepleError('');
  };
  const handleSaveMeeples = () => {
    onSaveMeeples(pendingMeeples);
    setView('menu');
  };

  const openExpansions = () => { setPendingExpansions(expansions); setView('expansions'); };
  const togglePendingExpansion = (name) => {
    setPendingExpansions(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const handleSaveExpansions = () => {
    onSaveExpansions(pendingExpansions);
    setView('menu');
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
                  <button type="button" className="settings-edit-btn" onClick={openMeeples}>Edit</button>
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Expansions</span>
                <span className="settings-row-control">
                  <span className="settings-row-value">{expansions.length === 0 ? 'Base Game' : `${expansions.length} active`}</span>
                  <button type="button" className="settings-edit-btn" onClick={openExpansions}>Edit</button>
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
                    {MEEPLES.map(({ key, img, label }) => {
                      const isMysterySlot = key === 'mystery.png';
                      const currentIsFun = pendingMeeples[name]?.startsWith('fun/');
                      const selected = pendingMeeples[name] === key || (isMysterySlot && currentIsFun);
                      const displaySrc = isMysterySlot && currentIsFun
                        ? FUN_MEEPLES.find(fm => fm.key === pendingMeeples[name])?.img
                        : img;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`meeple-option ${selected ? 'selected' : ''}`}
                          onClick={() => handlePickMeeple(name, key)}
                          title={isMysterySlot && currentIsFun ? 'Click for different random meeple' : label}
                        >
                          <img src={displaySrc} alt={isMysterySlot ? 'Mystery meeple' : label} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {meepleError && (
              <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginTop: '0.9rem' }}>{meepleError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Back</button>
              <button className="btn btn-sm" onClick={handleSaveMeeples}>Save</button>
            </div>
          </div>
        </div>
      )}

      {view === 'expansions' && (
        <div className="realm-modal-overlay" onClick={onClose}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.8rem' }}>Edit Expansions</h3>
            {/* Same Full/Mini grouping as the pregame Expansions step
                (PreGameSetup.jsx) — reads as the same picker, not a
                stripped-down one-off. */}
            {ownedExpansions.length === 0 ? (
              <p className="section-intro">No expansions owned — base game only.</p>
            ) : (() => {
              const categoryOf = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.category]));
              const full = ownedExpansions.filter(n => categoryOf[n] === 'major');
              const mini = ownedExpansions.filter(n => categoryOf[n] === 'mini' || categoryOf[n] === 'base_mini');
              const renderGroup = (label, names) => names.length === 0 ? null : (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--earth-brown)', marginBottom: '0.6rem' }}>
                    {label}
                  </div>
                  <div className="expansion-chips">
                    {names.map(name => (
                      <button
                        key={name}
                        type="button"
                        className={`expansion-chip ${pendingExpansions.includes(name) ? 'selected' : ''}`}
                        onClick={() => togglePendingExpansion(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              );
              return (
                <>
                  {renderGroup('Full Expansions', full)}
                  {renderGroup('Mini Expansions', mini)}
                </>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.2rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setView('menu')}>Back</button>
              <button className="btn btn-sm" onClick={handleSaveExpansions}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
