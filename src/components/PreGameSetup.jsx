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

export default function PreGame({ realm, ownedExpansions, onStart, defaultMeeples, defaultExpansions, realms = [], currentRealm = null, onRealmChange }) {
  // Start at step 2 (meeple selection) - step 1 is realm selection handled elsewhere
  const [step, setStep] = useState(2);

  // Limit active players to game maximum and ensure they exist
  const activePlayers = (realm.players || []).slice(0, MAX_GAME_PLAYERS);

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
                      className={`meeple-option ${meeples[name] === key ? 'selected' : ''}`}
                      onClick={() => handleMeepleSelect(name, key)}
                      title={label}
                    >
                      <img src={img} alt={label} />
                    </button>
                  ))}
                  
                  {/* Mystery option - randomly selects from fun meeples */}
                  <button
                    key="mystery"
                    type="button"
                    className="meeple-option mystery-option"
                    onClick={() => handleMeepleSelect(name, 'mystery.png')}
                    title="Random fun meeple"
                  >
                    <div className="mystery-icon">?</div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
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
