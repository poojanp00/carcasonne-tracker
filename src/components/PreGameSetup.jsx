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

import { useState, useMemo } from 'react';
import { MAX_GAME_PLAYERS, MAX_REALMS } from '../constants';
import { formatPieceName } from '../utils/formatters';
import { DEFAULT_EXPANSIONS } from '../data/expansions';

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

export default function PreGame({ realm, ownedExpansions, onStart, defaultMeeples, defaultExpansions, realms = [], currentRealm = null, onRealmChange, onRealmCreate, startAtRealmCreation = false, isGuest = false }) {
  // Start at step 1 if requested, no realms exist, or no current realm - otherwise step 2 
  const initialStep = startAtRealmCreation || realms.length === 0 || !realm ? 1 : 2;
  const [step, setStep] = useState(initialStep);

  // Realm creation state (step 1)
  const [realmName, setRealmName] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [nameError, setNameError] = useState('');

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
      setNameError(`Group limit reached. Delete an existing group to create a new one.`);
      return;
    }
    
    // For guests and users: use defaults for empty player names
    const names = playerNames.map((name, i) => {
      const trimmed = name.trim();
      return trimmed || `Player ${i + 1}`;
    });
    
    // For guests: auto-name realm "Guest"
    // For users: require realm name
    const finalRealmName = isGuest ? 'Guest' : realmName.trim();
    
    if (!isGuest && !finalRealmName) return;
    if (names.length === 0) return;
    
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      setNameError('Player names must be unique.');
      return;
    }
    
    if (realms.some(r => r.name.toLowerCase() === finalRealmName.toLowerCase())) {
      setNameError('A group with this name already exists.');
      return;
    }
    
    setNameError('');
    if (onRealmCreate) {
      await onRealmCreate({ name: finalRealmName, players: names });
      // Don't automatically navigate to step 2 - let the parent component handle the flow
    } else {
      setStep(2); // Move to meeple selection only if handling internally
    }
  };

  /**
   * MEEPLE ASSIGNMENT STATE
   * 
   * Maps each player to their chosen meeple image.
   * Smart defaults from previous game or systematic assignment:
   * 1. Use previous game meeples if available (continuity)
   * 2. Fall back to sequential assignment from available meeples
   * 3. Ultimate fallback to first meeple or 'poojan.png'
   * 
   * Special handling: If a defaultMeeple is 'mystery.png', immediately resolve
   * it to a random fun meeple to avoid having mystery.png as the actual meeple.
   */
  const [meeples, setMeeples] = useState(() => {
    const initialMeeples = {};
    
    activePlayers.forEach((p, i) => {
      let selectedMeeple = defaultMeeples?.[p] ||           // Previous game preference
                          MEEPLES[i]?.key ||               // Sequential assignment
                          MEEPLES[0]?.key ||               // First available meeple
                          'poojan.png';                    // Hardcoded fallback
      
      // If the default meeple is mystery.png, resolve it immediately to a fun meeple
      if (selectedMeeple === 'mystery.png') {
        const availableFunMeeples = FUN_MEEPLES.filter(fm => 
          !Object.values(initialMeeples).includes(fm.key)
        );
        
        if (availableFunMeeples.length > 0) {
          const randomFunMeeple = availableFunMeeples[Math.floor(Math.random() * availableFunMeeples.length)];
          selectedMeeple = randomFunMeeple.key;
        } else {
          // Fallback to any random fun meeple if all are taken
          const randomFunMeeple = FUN_MEEPLES[Math.floor(Math.random() * FUN_MEEPLES.length)];
          selectedMeeple = randomFunMeeple.key;
        }
      }
      
      initialMeeples[p] = selectedMeeple;
    });
    
    return initialMeeples;
  });

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
   * REQUIRED PIECES CALCULATION
   *
   * Dynamically computes all required components based on selected expansions.
   * Organizes into three categories: tiles (by source), per-player pieces, and fixed items.
   * Includes base game (72 tiles, 8 followers per player) by default.
   */
  const requiredPieces = useMemo(() => {
    const pieces = {
      tiles: [{ source: 'Game', qty: 72 }], // Base game tiles
      perPlayer: {
        followers: 8, // Base game followers per player
      },
      fixed: new Set(),
    };

    // Map expansion names to their metadata
    const expansionMetadata = ownedExpansions.reduce((acc, name) => {
      // Find matching expansion in the metadata
      const exp = [
        { name: 'The River', category: 'base_mini', tiles: 12, perPlayer: [], fixed: [] },
        { name: 'The River II', category: 'base_mini', tiles: 12, perPlayer: [], fixed: [] },
        { name: 'The Abbot', category: 'base_mini', tiles: 0, perPlayer: ['abbot'], fixed: [] },
        { name: 'The Festival', category: 'base_mini', tiles: 10, perPlayer: [], fixed: [] },
        { name: 'Inns & Cathedrals', category: 'major', tiles: 18, perPlayer: ['large_meeple'], fixed: [] },
        { name: 'Traders & Builders', category: 'major', tiles: 24, perPlayer: ['builder', 'pig'], fixed: ['trade_goods_tokens'] },
        { name: 'The Princess & the Dragon', category: 'major', tiles: 30, perPlayer: [], fixed: ['dragon', 'fairy'] },
        { name: 'The Tower', category: 'major', tiles: 18, perPlayer: [], fixed: ['tower_pieces'] },
        { name: 'Abbey & Mayor', category: 'major', tiles: 12, perPlayer: ['mayor', 'wagon', 'barn'], fixed: ['abbey_tiles'] },
        { name: 'Count, King & Robber', category: 'major', tiles: 12, perPlayer: [], fixed: ['count', 'king_token', 'robber_baron_token'] },
        { name: 'The Catapult', category: 'major', tiles: 12, perPlayer: [], fixed: ['catapult_device', 'catapult_tokens'] },
        { name: 'Bridges, Castles & Bazaars', category: 'major', tiles: 12, perPlayer: [], fixed: ['bridge_pieces', 'castle_tokens'] },
        { name: 'Hills & Sheep', category: 'major', tiles: 18, perPlayer: ['shepherd'], fixed: ['sheep_tokens', 'wolf_tokens'] },
        { name: 'Under the Big Top', category: 'major', tiles: 20, perPlayer: ['ringmaster'], fixed: ['animal_tokens'] },
        { name: 'Ghosts, Castles & Cemeteries', category: 'mini', tiles: 18, perPlayer: [], fixed: ['ghost_meeples'] },
        { name: 'The Flying Machines', category: 'mini', tiles: 8, perPlayer: [], fixed: [] },
        { name: 'The Ferries', category: 'mini', tiles: 8, perPlayer: [], fixed: ['ferry_tokens'] },
        { name: 'The Gold Mines', category: 'mini', tiles: 8, perPlayer: [], fixed: ['gold_tokens'] },
        { name: 'Mage & Witch', category: 'mini', tiles: 8, perPlayer: [], fixed: ['mage', 'witch'] },
        { name: 'Robbers', category: 'mini', tiles: 8, perPlayer: ['robber'], fixed: [] },
        { name: 'Crop Circles', category: 'mini', tiles: 6, perPlayer: [], fixed: [] },
      ].find(e => e.name === name);

      if (exp) acc[name] = exp;
      return acc;
    }, {});

    // Aggregate pieces from selected expansions
    selectedExp.forEach(expName => {
      const exp = expansionMetadata[expName];
      if (!exp) return;

      // Add tiles as separate line item
      if (exp.tiles > 0) {
        pieces.tiles.push({ source: expName, qty: exp.tiles });
      }

      // Add per-player pieces (x1 per piece type, not multiplied by player count)
      exp.perPlayer?.forEach(piece => {
        if (!pieces.perPlayer[piece]) {
          pieces.perPlayer[piece] = 1;
        }
      });

      // Add fixed pieces
      exp.fixed?.forEach(piece => {
        pieces.fixed.add(piece);
      });
    });

    return pieces;
  }, [selectedExp, ownedExpansions]);


  /**
   * COMPONENT BREAKDOWN MAP
   * Maps fixed items to their detailed sub-components
   */
  const componentBreakdown = {
    trade_goods_tokens: [
      { name: 'Wine', qty: 9 },
      { name: 'Wheat', qty: 6 },
      { name: 'Cloth', qty: 5 },
    ],
  };

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
      <div className="expansion-chips-carousel">
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
          <h2>Create New Group</h2>
          <div className="section-title-line" />
        </div>

        <form onSubmit={handleCreateRealm}>
          <div className="tile-card" style={{ marginBottom: '0.9rem' }}>
            {!isGuest && (
              <div className="form-group" style={{ maxWidth: '360px' }}>
                <label className="form-label">Group Name</label>
                <input
                  className="form-input"
                  value={realmName}
                  onChange={e => setRealmName(e.target.value)}
                  placeholder="e.g. Mont Shastaire"
                  required
                  autoFocus
                />
              </div>
            )}
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
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: realms.length > 0 ? 'space-between' : 'flex-end' }}>
            {realms.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
            )}
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

        {activePlayers.length === 0 ? (
          <div className="tile-card" style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>
              Create a group first to configure players and meeples.
            </p>
          </div>
        ) : (
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
        )}

        {meepleError && (
          <p style={{ fontStyle: 'italic', color: 'var(--red, #DC2626)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
            {meepleError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', justifyContent: activePlayers.length === 0 ? 'center' : 'space-between' }}>
          <button
            type="button"
            className={activePlayers.length === 0 ? "btn" : "btn btn-ghost"}
            onClick={() => setStep(1)}
          >
            Create New Group
          </button>
          {activePlayers.length > 0 && (
            <button type="button" className="btn" onClick={handleNextStep}>Next: Expansions →</button>
          )}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.4rem', marginBottom: '1.4rem' }}>
        {/* Expansions Selection */}
        <div className="tile-card">
          <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.8rem' }}>
            SELECT EXPANSIONS
          </div>
          {ownedExpansions.length === 0 ? (
            <p className="section-intro">No expansions owned — base game only.</p>
          ) : (() => {
            const categoryOf = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.category]));
            const full = ownedExpansions.filter(n => categoryOf[n] === 'major');
            const mini = ownedExpansions.filter(n => categoryOf[n] === 'mini' || categoryOf[n] === 'base_mini');
            const renderGroup = (label, names) => names.length === 0 ? null : (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.65rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em', color: 'var(--stone-gray)', opacity: 0.7, marginTop: '0.5rem', marginBottom: '0.6rem' }}>
                  {label}
                </div>
                <div className="expansion-chips">
                  {names.map(name => (
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
              </div>
            );
            return (
              <>
                {renderGroup('FULL EXPANSIONS', full)}
                {renderGroup('MINI EXPANSIONS', mini)}
              </>
            );
          })()}
        </div>

        {/* Required Pieces Checklist */}
        <div className="tile-card">
          <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.8rem' }}>
            REQUIRED PIECES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Tiles section */}
              <div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  TILES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {requiredPieces.tiles.map(({ source, qty }) => (
                    <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'Crimson Text, serif' }}>
                      <span>{source === 'Game' ? 'Base game' : source}</span>
                      <span style={{ fontWeight: 600, color: 'var(--earth-brown)' }}>×{qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(201,163,74,0.2)', margin: '0.2rem 0' }} />

              {/* Per-player pieces section */}
              <div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  Meeples Per Player
                </div>
                {Object.keys(requiredPieces.perPlayer).length === 0 ? (
                  <p style={{ fontSize: '0.82rem', fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>None</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {Object.entries(requiredPieces.perPlayer)
                      .map(([piece, qty]) => (
                        <div key={piece} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'Crimson Text, serif' }}>
                          <span>{formatPieceName(piece)}</span>
                          <span style={{ fontWeight: 600, color: 'var(--earth-brown)' }}>×{qty}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {requiredPieces.fixed.size > 0 && (
                <>
                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(201,163,74,0.2)', margin: '0.2rem 0' }} />

                  {/* Other (Fixed) pieces section */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                      OTHER
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {Array.from(requiredPieces.fixed)
                        .map(piece => {
                          const breakdown = componentBreakdown[piece];
                          return (
                            <div key={piece} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'Crimson Text, serif' }}>
                                <span>{formatPieceName(piece)}</span>
                                {!breakdown && <span style={{ fontWeight: 600, color: 'var(--earth-brown)' }}>×1</span>}
                              </div>
                              {breakdown && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginLeft: '1rem', borderLeft: '2px solid rgba(201,163,74,0.3)', paddingLeft: '0.6rem' }}>
                                  {breakdown.map(comp => (
                                    <div key={comp.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', fontFamily: 'Crimson Text, serif', color: 'var(--stone-gray)' }}>
                                      <span>{comp.name}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--earth-brown)' }}>×{comp.qty}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
        <button type="button" className="btn" onClick={handleStart}>Begin</button>
      </div>
    </div>
  );
}
