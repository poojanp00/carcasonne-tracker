import { useState } from 'react';

// Dynamically load all meeple PNGs from the meeples folder
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLES = Object.entries(MEEPLE_MODULES).map(([path, img]) => {
  const key   = path.split('/').pop();
  const label = key.replace('.png', '');
  return { key, img, label };
}).sort((a, b) => a.label.localeCompare(b.label));

// Fun meeples for mystery resolution (keyed as fun/<filename>)
const FUN_MODULES = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const FUN_MEEPLES = Object.entries(FUN_MODULES)
  .filter(([path]) => !path.endsWith('.heic'))
  .map(([path, img]) => ({ key: `fun/${path.split('/').pop()}`, img }));

const MAX_GAME_PLAYERS = 6;

export default function PreGame({ realm, ownedExpansions, onStart, onBack }) {
  const [step, setStep] = useState(2);

  const activePlayers = (realm.players || []).slice(0, MAX_GAME_PLAYERS);

  // Step 2: meeple per active player
  const [meeples, setMeeples] = useState(() =>
    Object.fromEntries(activePlayers.map(p => [p, MEEPLES[0]?.key || 'poojan.png']))
  );

  // Step 3: expansions
  const [selectedExp, setSelectedExp] = useState(() =>
    ['The River', 'The Abbot'].filter(name => ownedExpansions.includes(name))
  );

  const toggleExpansion = (name) =>
    setSelectedExp(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]);

  const handleStart = () => {
    const resolved = { ...meeples };
    const mysteryPlayers = activePlayers.filter(p => resolved[p] === 'mystery.png');
    if (mysteryPlayers.length > 0) {
      const shuffled = [...FUN_MEEPLES].sort(() => Math.random() - 0.5);
      mysteryPlayers.forEach((p, i) => {
        resolved[p] = shuffled[i % shuffled.length].key;
      });
    }
    onStart({ players: activePlayers, meeples: resolved, expansions: selectedExp });
  };

  // ── Step 2: Meeples ──
  if (step === 2) {
    return (
      <div className="pregame-screen">
        <div className="section-title" style={{ position: 'relative' }}>
          <h2>Choose Your Meeples</h2>
          <div className="section-title-line" />
          <span style={{
            position: 'absolute', top: 0, right: 0,
            fontFamily: 'Cinzel, serif', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.06em', color: 'var(--earth-brown)',
            background: 'var(--warm-gold)', opacity: 0.85,
            padding: '0.2rem 0.55rem', borderRadius: '999px',
          }}>
            {realm.name}
          </span>
        </div>

        <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
          <div className="tile-card-header">Each player selects their character</div>
          <div className="meeple-picker-grid">
            {activePlayers.map(name => (
              <div key={name} className="meeple-picker-row">
                <div className="meeple-picker-name">{name}</div>
                <div className="meeple-options">
                  {MEEPLES.map(({ key, img, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`meeple-option ${meeples[name] === key ? 'selected' : ''}`}
                      onClick={() => setMeeples(prev => ({ ...prev, [name]: key }))}
                      title={label}
                    >
                      <img src={img} alt={label} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.7rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button type="button" className="btn" onClick={() => setStep(3)}>Next: Expansions →</button>
        </div>
      </div>
    );
  }

  // ── Step 3: Expansions + Start ──
  return (
    <div className="pregame-screen">
      <div className="section-title" style={{ position: 'relative' }}>
        <h2>Expansions in Play</h2>
        <div className="section-title-line" />
        <span style={{
          position: 'absolute', top: 0, right: 0,
          fontFamily: 'Cinzel, serif', fontSize: '0.75rem', fontWeight: 600,
          letterSpacing: '0.06em', color: 'var(--earth-brown)',
          background: 'var(--warm-gold)', opacity: 0.85,
          padding: '0.2rem 0.55rem', borderRadius: '999px',
        }}>
          {realm.name}
        </span>
      </div>

      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        <div className="tile-card-header">Select expansions for this game</div>
        {ownedExpansions.length === 0 ? (
          <p className="section-intro">No expansions owned — base game only.</p>
        ) : (
          <>
            <p className="section-intro">Only owned expansions are shown.</p>
            <div className="expansion-chips">
              {ownedExpansions.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`expansion-chip ${selectedExp.includes(name) ? 'selected' : ''}`}
                  onClick={() => toggleExpansion(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
        <button type="button" className="btn" onClick={handleStart}>Begin Battle</button>
        <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem' }}>
          {selectedExp.length === 0 ? 'Base game' : selectedExp.join(' · ')}
        </span>
      </div>
    </div>
  );
}
