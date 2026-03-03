/**
 * PRE-GAME SETUP COMPONENT
 * 
 * Guides players through multi-step game configuration before starting a Carcassonne session.
 * Remembers previous game settings for continuity and convenience.
 * 
 * Setup Flow:
 * Step 2: Meeple Selection - Each player chooses their game piecer
 * Step 3: Expansion Selection - Choose which expansions to include
 * 
 * Business Rules:
 * - Max 6 players per game (standard Carcassonne limit)
 * - Each player must have unique meeple (no duplicates)
 * - Mystery meeples don't count toward uniqueness validation
 * - Expansion choices filtered to user's owned collection
 * - Previous game settings used as smart defaults
 */

import { useState } from 'react';

/**
 * MEEPLE LOADING SYSTEM (STANDARD MEEPLES)
 * 
 * Dynamically imports all standard meeple images from the meeples folder.
 * Creates sorted list with human-readable labels for the selection interface.
 * Vite's glob import bundles these at build time for performance.
 */
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLES = Object.entries(MEEPLE_MODULES).map(([path, img]) => {
  const key   = path.split('/').pop();             // Extract filename: '1red.png'
  const label = key.replace('.png', '');           // Display name: '1red'
  return { key, img, label };
}).sort((a, b) => a.label.localeCompare(b.label)); // Alphabetical sorting for consistent UI

/**
 * FUN MEEPLES SYSTEM (CUSTOM/SPECIAL MEEPLES)
 * 
 * Loads custom meeples from the fun/ subdirectory for mystery resolution.
 * These are special character meeples that add personality to the game.
 * Filtered to exclude .heic files which aren't web-compatible.
 */
const FUN_MODULES = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const FUN_MEEPLES = Object.entries(FUN_MODULES)
  .filter(([path]) => !path.endsWith('.heic'))     // Remove incompatible formats
  .map(([path, img]) => ({ 
    key: `fun/${path.split('/').pop()}`,           // Prefix with 'fun/' for distinction
    img 
  }));

// Carcassonne game supports maximum 6 players with base game + expansions
const MAX_GAME_PLAYERS = 6;

export default function PreGame({ realm, ownedExpansions, onStart, defaultMeeples, defaultExpansions, realms = [], currentRealm = null, onRealmChange, onRealmCreate, startAtRealmCreation = false }) {
  // Start at step 1 (realm creation) if requested, otherwise step 2 (meeple selection) when realm exists
  const [step, setStep] = useState(startAtRealmCreation ? 1 : 2);

  // Realm creation state (step 1)
  const [realmName, setRealmName] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [nameError, setNameError] = useState('');
  const MAX_REALMS = 12;

  // Limit active players to game maximum and ensure they exist
  const activePlayers = (realm?.players || playerNames.filter(n => n.trim())).slice(0, MAX_GAME_PLAYERS);

  const syncCount = (n) => {
    const clamped = Math.max(2, Math.min(6, n));
    setPlayerCount(clamped);
    setPlayerNames(prev => {
      const updated = [...prev];
      while (updated.length < clamped) updated.push('');
      return updated.slice(0, clamped);
    });
  };

  const handleCreateRealm = async (e) => {
    e.preventDefault();
    if (realms.length >= MAX_REALMS) {
      setNameError(`Realm limit reached. Delete an existing realm to create a new one.`);
      return;
    }
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
    await onRealmCreate({ name: realmName.trim(), players: names });
    setStep(2); // Move to meeple selection
  };

  /**
   * MEEPLE ASSIGNMENT STATE
   * 
   * Maps each player to their chosen meeple image.
   * Smart defaults from previous game or systematic assignment:
   * 1. Use previous game meeples if available (continuity)
   * 2. Fall back to sequential assignment from available meeples
   * 3. Ultimate fallback to first meeple or 'poojan.png'
   */
  const [meeples, setMeeples] = useState(() =>
    Object.fromEntries(
      activePlayers.map((p, i) => [
        p, 
        defaultMeeples?.[p] ||           // Previous game preference
        MEEPLES[i]?.key ||               // Sequential assignment
        MEEPLES[0]?.key ||               // First available meeple
        'poojan.png'                     // Hardcoded fallback
      ])
    )
  );

  /**
   * EXPANSION SELECTION STATE
   * 
   * Tracks which expansions will be used in the upcoming game.
   * Smart defaults prioritize commonly-used foundational expansions:
   * 1. Previous game expansions (filtered to currently owned)
   * 2. Default to River + Abbot if owned (good starter combination)
   */
  const [selectedExp, setSelectedExp] = useState(() =>
    defaultExpansions
      ? defaultExpansions.filter(name => ownedExpansions.includes(name)) // Previous + owned
      : ['The River', 'The Abbot'].filter(name => ownedExpansions.includes(name)) // Safe defaults
  );

  const [meepleError, setMeepleError] = useState(null);

  /**
   * MEEPLE VALIDATION AND PROGRESSION
   * 
   * Validates meeple uniqueness before allowing progression to expansion selection.
   * Business rule: Each player must have a unique meeple for clear identification.
   * All meeples (including resolved mystery selections) count toward uniqueness.
   */
  const handleNextStep = () => {
    // Extract all meeple selections (no exclusions needed)
    const chosen = activePlayers.map(p => meeples[p]);
    
    // Check for duplicates using Set size comparison
    if (new Set(chosen).size < chosen.length) {
      setMeepleError('Meeples must be unique.');
      return;
    }
    setMeepleError(null);
    setStep(3); // Proceed to expansion selection
  };

  /**
   * HANDLE MEEPLE SELECTION WITH MYSTERY RESOLUTION
   * 
   * When a player selects a meeple, handle normal selection or mystery resolution.
   * If mystery is chosen, immediately pick a random fun meeple to maintain uniqueness validation.
   */
  const handleMeepleSelect = (playerName, selectedKey) => {
    setMeepleError(null);
    
    if (selectedKey === 'mystery.png') {
      // Immediately resolve mystery to random fun meeple 
      const availableFunMeeples = FUN_MEEPLES.filter(fm => 
        !Object.values(meeples).includes(fm.key) // Exclude already chosen fun meeples
      );
      
      if (availableFunMeeples.length > 0) {
        const randomFunMeeple = availableFunMeeples[Math.floor(Math.random() * availableFunMeeples.length)];
        setMeeples(prev => ({ ...prev, [playerName]: randomFunMeeple.key }));
      } else {
        // Fallback to any random fun meeple if all are taken
        const randomFunMeeple = FUN_MEEPLES[Math.floor(Math.random() * FUN_MEEPLES.length)];
        setMeeples(prev => ({ ...prev, [playerName]: randomFunMeeple.key }));
      }
    } else {
      // Normal meeple selection
      setMeeples(prev => ({ ...prev, [playerName]: selectedKey }));
    }
  };

  /**
   * EXPANSION TOGGLE LOGIC
   * 
   * Adds or removes expansions from the selected set.
   * Maintains array order for consistent UI display.
   */
  const toggleExpansion = (name) =>
    setSelectedExp(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]);

  /**
   * GAME START HANDLER
   * 
   * Initiates the game with selected players, meeples, and expansions.
   * No mystery resolution needed since it happens during selection.
   */
  const handleStart = () => {
    onStart({ players: activePlayers, meeples, expansions: selectedExp });
  };

  const realmChips = realms.length > 0 && onRealmChange && (
    <div style={{ marginBottom: '1.3rem' }}>
      <div className="expansion-chips">
        {realms.map(r => (
          <button
            key={r.id}
            type="button"
            className={`expansion-chip${currentRealm?.id === r.id ? ' selected' : ''}`}
            onClick={() => onRealmChange(r)}
          >
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Step 1: Create Realm ──
  if (step === 1) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Create New Realm</h2>
          <div className="section-title-line" />
        </div>

        <form onSubmit={handleCreateRealm}>
          <div className="tile-card" style={{ marginBottom: '0.9rem' }}>
            <div className="form-group" style={{ maxWidth: '360px' }}>
              <label className="form-label">Realm Name</label>
              <input
                className="form-input"
                value={realmName}
                onChange={e => setRealmName(e.target.value)}
                placeholder="e.g. Mont Shastaire"
                required
                autoFocus
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
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn">Next: Choose Meeples →</button>
          </div>
        </form>
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

        {realmChips}

        <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
          <div className="meeple-picker-grid">
            {activePlayers.map(name => (
              <div key={name} className="meeple-picker-row">
                <div className="meeple-picker-name">{name}</div>
                <div className="meeple-options">
                  {/* Standard meeples */}
                  {MEEPLES.map(({ key, img, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`meeple-option ${meeples[name] === key || (key === 'mystery.png' && meeples[name]?.startsWith('fun/')) ? 'selected' : ''}`}
                      onClick={() => handleMeepleSelect(name, key)}
                      title={key === 'mystery.png' && meeples[name]?.startsWith('fun/') ? 'Click for different random meeple' : label}
                    >
                      {key === 'mystery.png' && meeples[name]?.startsWith('fun/') ? (
                        <img 
                          src={FUN_MEEPLES.find(fm => fm.key === meeples[name])?.img} 
                          alt="Fun meeple" 
                        />
                      ) : (
                        <img src={img} alt={label} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setStep(1)}
          >
            Create New Realm
          </button>
          {meepleError && (
            <span style={{ fontStyle: 'italic', color: 'var(--red, #DC2626)', fontSize: '0.88rem' }}>
              {meepleError}
            </span>
          )}
          <button type="button" className="btn" onClick={handleNextStep}>Next: Expansions →</button>
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

      {realmChips}

      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        {ownedExpansions.length === 0 ? (
          <p className="section-intro">No expansions owned — base game only.</p>
        ) : (
          <>
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

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
        <button type="button" className="btn" onClick={handleStart}>Begin</button>
      </div>
    </div>
  );
}
