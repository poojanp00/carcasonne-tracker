import { useState } from 'react';

// Dynamically load all meeple PNGs from the meeples folder
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLES = Object.entries(MEEPLE_MODULES).map(([path, img]) => {
  const key   = path.split('/').pop();
  const label = key.replace('.png', '');
  return { key, img, label };
}).sort((a, b) => a.label.localeCompare(b.label));

const MAX_GAME_PLAYERS = 6;

export default function PreGame({ realm, ownedExpansions, onStart, onBack }) {
  const [step, setStep] = useState(1);

  // Step 1: who is playing
  const [activePlayers, setActivePlayers] = useState((realm.players || []).slice(0, MAX_GAME_PLAYERS));

  // Step 2: meeple per active player
  const [meeples, setMeeples] = useState(() =>
    Object.fromEntries((realm.players || []).map(p => [p, MEEPLES[0]?.key || 'poojan.png']))
  );

  // Step 3: expansions
  const [selectedExp, setSelectedExp] = useState([]);

  const toggleActive = (name) => {
    setActivePlayers(prev => {
      if (prev.includes(name)) return prev.filter(p => p !== name);
      if (prev.length >= MAX_GAME_PLAYERS) return prev;
      return [...prev, name];
    });
  };

  const goToMeeples = () => {
    setMeeples(prev => {
      const m = {};
      for (const p of activePlayers) m[p] = prev[p] || MEEPLES[0]?.key || 'poojan.png';
      return m;
    });
    setStep(2);
  };

  const toggleExpansion = (name) =>
    setSelectedExp(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]);

  const handleStart = () => onStart({ players: activePlayers, meeples, expansions: selectedExp });

  // ── Step 1: Players ──
  if (step === 1) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Gather the Players</h2>
          <div className="section-title-line" />
          <span className="game-count">{realm.name} · {realm.id}</span>
        </div>

        <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
          <div className="tile-card-header">Who plays this battle?</div>
          <p className="section-intro">
            Select up to {MAX_GAME_PLAYERS} players.
          </p>
          <div className="expansion-chips" style={{ marginBottom: '1.2rem' }}>
            {(realm.players || []).map(name => (
              <button
                key={name}
                type="button"
                className={`expansion-chip ${activePlayers.includes(name) ? 'selected' : ''}`}
                onClick={() => toggleActive(name)}
              >
                {name}
                {activePlayers.includes(name) && (
                  <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', opacity: 0.75 }}>
                    #{activePlayers.indexOf(name) + 1}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activePlayers.length >= MAX_GAME_PLAYERS && (
            <p style={{ fontSize: '0.85rem', color: 'var(--deep-red)', fontStyle: 'italic' }}>
              Maximum of {MAX_GAME_PLAYERS} players per game.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.7rem' }}>
          {onBack && (
            <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          )}
          <button
            type="button"
            className="btn"
            onClick={goToMeeples}
            disabled={activePlayers.length < 2}
          >
            Next: Choose Meeples →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Meeples ──
  if (step === 2) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Choose Your Meeples</h2>
          <div className="section-title-line" />
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
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
          <button type="button" className="btn" onClick={() => setStep(3)}>Next: Expansions →</button>
        </div>
      </div>
    );
  }

  // ── Step 3: Expansions + Start ──
  return (
    <div className="pregame-screen">
      <div className="section-title">
        <h2>Expansions in Play</h2>
        <div className="section-title-line" />
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
