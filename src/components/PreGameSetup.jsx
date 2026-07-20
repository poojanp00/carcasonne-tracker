/**
 * PRE-GAME SETUP COMPONENT
 * 
 * Guides players through multi-step game configuration before starting a Carcassonne session.
 * Remembers previous game settings for continuity and convenience.
 * 
 * Setup Flow:
 * Step 0: Bookshelf - Pick an existing realm, or start a new one
 * Step 1: Players - Roster and invite status for the chosen realm
 * Step 2: Realm Creation - Name, players, chest, and logbook
 * Step 3: Mode Selection - Table or Party mode
 * Step 4: Meeple Selection - Each player chooses their game piece
 * Step 5: Expansion Selection - Choose which expansions to include, then Begin
 *
 * Business Rules:
 * - Max 6 players per game (standard Carcassonne limit)
 * - Each player must have unique meeple (no duplicates)
 * - Mystery meeples don't count toward uniqueness validation
 * - Expansion choices filtered to user's owned collection
 * - Previous game settings used as smart defaults
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { MAX_GAME_PLAYERS, MAX_REALMS } from '../constants';
import { formatPieceName } from '../utils/formatters';
import { DEFAULT_EXPANSIONS, GUEST_ALLOWED_MINIS } from '../data/expansions';
import { getRealmMemberEmails } from '../data/storage';
import { useClampTooltip } from '../hooks/useClampTooltip';
import { useTapTooltip } from '../hooks/useTapTooltip';
import { HowToPlayModal } from './HowToGuide';
import { CHESTS, chestFor } from '../data/chests';
import { SPINES } from '../data/spines';
import ValInfo from './ValInfo';

// Only the first 8 logbook designs are offered in the creation picker.
const PICKABLE_SPINES = SPINES.slice(0, 8);

/**
 * MEEPLE LOADING SYSTEM (STANDARD MEEPLES)
 *
 * Dynamically imports all standard meeple images from the meeples folder.
 * Creates sorted list with human-readable labels for the selection interface.
 * Vite's glob import bundles these at build time for performance.
 */
import partyModeImg from '../../images/game_modes/party_mode.png';
import tableModeImg from '../../images/game_modes/table_mode.png';

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

export default function PreGame({ realm, ownedExpansions, onStart, defaultMeeples, defaultExpansions, realms = [], currentRealm = null, onRealmChange, onRealmCreate, onExportGroup = null, startAtRealmCreation = false, startAtModeSelection = false, isGuest = false, selfName = '', userId = null, selfRankTitle = null, onToggleOwned = null }) {
  // Steps: 0=Bookshelf, 1=Players, 2=Realm creation, 3=Mode selection,
  // 4=Meeples (table only), 5=Expansions.
  // Every fresh mount starts at the bookshelf (or creation when no realms
  // exist yet) — except when a `currentRealm` prop already arrives populated,
  // which happens either because the parent explicitly resumed one, or
  // because picking a different book in the bookshelf remounts this
  // component (App.jsx keys it by realm id) with the newly-picked realm
  // already in place; either way that means land on Players, not the shelf.
  // startAtModeSelection is the other exception: right after a guest creates
  // their group the parent remounts us with it set, continuing the forward
  // flow to mode selection instead of bouncing back to the bookshelf.
  const initialStep = startAtModeSelection ? 3 : startAtRealmCreation ? 2 : realms.length === 0 ? 2 : currentRealm ? 1 : 0;
  const [step, setStep] = useState(initialStep);
  const [mode, setMode] = useState('table'); // 'table' | 'party'
  const tableInfo = useTapTooltip();
  const partyInfo = useTapTooltip();
  // Nudge these tooltips back on-screen if they'd otherwise spill off a narrow phone edge.
  const { tooltipRef: tableDescRef, tooltipStyle: tableDescStyle } = useClampTooltip(tableInfo.visible);
  const { tooltipRef: partyDescRef, tooltipStyle: partyDescStyle } = useClampTooltip(partyInfo.visible);

  // Realm creation state (step 2)
  const [showHowTo, setShowHowTo] = useState(false);
  const [realmName, setRealmName] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  // Player 1 is always the creator for signed-in users — prefilled with their
  // account name but editable (a per-group nickname is fine; the account link
  // is by slot, not by name).
  const [playerNames, setPlayerNames] = useState([selfName || '', '']);
  const [nameError, setNameError] = useState('');
  // Chest and logbook — smart random defaults the user can change, same
  // spirit as the meeple picker's defaults. Chosen once here and fixed
  // forever on the realm from this point (see handleCreateRealm below).
  // Guests don't get a choice — customizing cosmetics requires an account,
  // so they're locked to the first chest/logbook (see the picker below).
  const [chestIndex, setChestIndex] = useState(() => (isGuest ? 0 : Math.floor(Math.random() * CHESTS.length)));
  const [spineIndex, setSpineIndex] = useState(() => (isGuest ? 0 : Math.floor(Math.random() * PICKABLE_SPINES.length)));

  // Export Group (step 0) — invite another account to this realm
  const [showExport,   setShowExport]   = useState(false);
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [invitePlayer, setInvitePlayer] = useState(null);
  const [inviteBusy,   setInviteBusy]   = useState(false);
  const [inviteSent,   setInviteSent]   = useState(false);
  const [inviteError,  setInviteError]  = useState('');
  // Players invited during this mount — overlays their status as 'pending'
  // until the realms refetch on next load catches up. (The component remounts
  // when the selected realm changes, so this never leaks across groups.)
  const [sentInvites,  setSentInvites]  = useState([]);

  // Membership now rides on currentRealm.players ({ name, userId, status }),
  // so no separate members fetch is needed.
  const playerStatus = (p) =>
    p.status === 'uninvited' && sentInvites.includes(p.name) ? 'pending' : p.status;

  // Emails of the linked accounts, shown as hover tooltips on the status
  // labels. Looked up at read time — emails aren't stored on the realm.
  const [memberEmails, setMemberEmails] = useState({});
  useEffect(() => {
    if (isGuest || !currentRealm?.id) { setMemberEmails({}); return; }
    let stale = false;
    getRealmMemberEmails(currentRealm.id).then(m => { if (!stale) setMemberEmails(m); });
    return () => { stale = true; };
  }, [isGuest, currentRealm?.id]);

  const openExport = (playerName) => {
    setInviteEmail('');
    setInvitePlayer(playerName);
    setInviteSent(false);
    setInviteError('');
    setShowExport(true);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!invitePlayer) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      await onExportGroup(currentRealm.id, inviteEmail.trim(), invitePlayer);
      setInviteSent(true);
      // Reflect the newly reserved player immediately
      setSentInvites(prev => [...prev, invitePlayer]);
    } catch (err) {
      setInviteError(err?.message || 'Failed to send invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  // Limit active players to game maximum and ensure they exist
  const activePlayers = (realm?.players ? realm.players.map(p => p.name) : playerNames.filter(n => n.trim())).slice(0, MAX_GAME_PLAYERS);

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
    // Shared groups don't count toward the cap — only groups the user owns.
    if (!isGuest && realms.filter(r => r.isOwner !== false).length >= MAX_REALMS) {
      setNameError(`Realm limit reached. Delete an existing realm to create a new one.`);
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

    if (!isGuest && realms.some(r => r.name.toLowerCase() === finalRealmName.toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return;
    }

    setNameError('');
    if (onRealmCreate) {
      await onRealmCreate({
        name: finalRealmName,
        players: names,
        // Player 1 is always the creator for signed-in users
        selfPlayer: isGuest ? null : names[0],
        spine: spineIndex,
        chest: chestIndex,
      });
      // Don't automatically navigate - let the parent component handle the flow
    } else {
      setStep(3); // Move to mode selection
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
    setStep(5); // Proceed to expansion selection
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
   * COLLECTION EDITING (absorbed from the old Collection tab)
   *
   * Edit mode swaps the owned-expansion chips for the full catalog so
   * ownership can be toggled in place. Removing an owned expansion also
   * deselects it from the upcoming game.
   */
  const [editCollection, setEditCollection] = useState(false);
  const toggleOwned = (name) => {
    if (ownedExpansions.includes(name)) {
      setSelectedExp(prev => prev.filter(n => n !== name));
    }
    onToggleOwned?.(name);
  };

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
    onStart({
      players: activePlayers,
      meeples: mode === 'party' ? {} : meeples,
      expansions: selectedExp,
      mode,
    });
  };

  // Ref to step 2's realm-creation form, so a keyboard-triggered advance can
  // submit it the same way clicking its button would (validation included).
  const createFormRef = useRef(null);

  // Arrow-key / Enter step navigation, mirroring the Library logbook's
  // page-turn shortcut — mapped onto whichever Back/Next/Begin action is
  // currently on screen. Skipped while focus is in a text field (so typing
  // and native cursor movement/Enter-to-submit aren't hijacked) or on a
  // focused button (which already handles its own Enter/Space natively).
  // Step 0 (Bookshelf) gets no arrow/Enter handling — picking a realm means
  // clicking a book.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;

      if (e.key === 'ArrowLeft') {
        if (step === 1) setStep(0);
        else if (step === 2 && realms.length > 0) setStep(0);
        else if (step === 3) setStep(1);
        else if (step === 4) setStep(3);
        else if (step === 5) setStep(mode === 'party' ? 3 : 4);
        return;
      }
      // Steps 1–4 page forward the same way for either key; step 5's Begin
      // (which actually starts the game) is Enter-only — ArrowRight there is a no-op.
      const advance = () => {
        if (step === 1) { if (currentRealm) setStep(3); }
        else if (step === 2) createFormRef.current?.requestSubmit();
        else if (step === 3) setStep(mode === 'table' ? 4 : 5);
        else if (step === 4) { if (activePlayers.length > 0) handleNextStep(); }
      };
      if (e.key === 'ArrowRight') { if (step !== 5) advance(); return; }
      if (e.key === 'Enter') { if (step === 5) handleStart(); else advance(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, currentRealm, realms.length, activePlayers.length]);


  // ── Step 0: Chest row — pick which realm to play, or start a new one ──
  if (step === 0) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Choose Realm</h2>
            <button
              type="button"
              title="Getting started"
              onClick={() => setShowHowTo(true)}
              style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '50%', width: '1.15rem', height: '1.15rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, color: 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
            >
              ?
            </button>
          </div>
          <div className="section-title-line" />
        </div>

        {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}

        {realms.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: '1.2rem' }}>
            No realms yet — create one to get started.
          </div>
        ) : (
          <div className="chest-row">
            {realms.map(realm => (
              <button
                key={realm.id}
                type="button"
                className="chest-pick"
                onClick={() => { onRealmChange(realm); setStep(1); }}
              >
                <img src={chestFor(realm)} alt="" draggable={false} />
                <span className="chest-pick-name">{realm.name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>+ New</button>
        </div>
      </div>
    );
  }

  // ── Step 1: Players ──
  if (step === 1) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Players</h2>
          <div className="section-title-line" />
          {currentRealm && <span className="game-count">{currentRealm.name}</span>}
        </div>

        {currentRealm && (
          <div className="tile-card" style={{ marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(currentRealm.players || []).map((p, i) => {
                const status = playerStatus(p);
                return (
                  <div key={p.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.55rem 0',
                    borderBottom: i < (currentRealm.players.length - 1) ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '0.7rem',
                      color: 'var(--stone-gray)',
                      opacity: 0.5,
                      minWidth: '1rem',
                      textAlign: 'right',
                    }}>{i + 1}</span>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--earth-brown)',
                      letterSpacing: '0.02em',
                    }}>{p.name}</span>
                    {/* Right side: the player's link status — or an Invite
                        action while the slot is unclaimed (any member) */}
                    {!isGuest && (
                      status === 'uninvited' && onExportGroup ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ marginLeft: 'auto' }}
                          title="Share this realm with another account as this player"
                          onClick={() => openExport(p.name)}
                        >
                          ↑ Invite
                        </button>
                      ) : (
                        <span
                          title={p.userId ? memberEmails[p.userId] : undefined}
                          style={{
                            fontFamily: 'Crimson Text, serif',
                            fontStyle: 'italic',
                            fontSize: '0.78rem',
                            color: 'var(--stone-gray)',
                            marginLeft: 'auto',
                          }}
                        >
                          {{ owner: 'Owner', member: 'Member', pending: 'Pending', uninvited: 'Uninvited' }[status] || 'Uninvited'}
                        </span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
          <button
            type="button"
            className="btn"
            disabled={!currentRealm}
            onClick={() => setStep(3)}
          >
            Next →
          </button>
        </div>

        {/* Invite modal — share the group with another account, linked to the
            player whose row the Invite button was clicked on */}
        {showExport && currentRealm && (
          <div className="realm-modal-overlay" onClick={() => setShowExport(false)}>
            <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>
                {inviteSent ? 'Invite sent!' : <>Invite {invitePlayer} to join {currentRealm.name}?</>}
              </h3>
              {inviteSent ? (
                <>
                  <p style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--charcoal)', margin: '0 0 1.2rem' }}>
                    They'll be asked to join <strong>{currentRealm.name}</strong> as{' '}
                    <strong>{invitePlayer}</strong> next time they open the app.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setShowExport(false)}>Done</button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSendInvite}>
                  <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--stone-gray)', margin: '0 0 1rem' }}>
                    Their account will be linked to the player and realm.
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="export-email">Account email</label>
                    <input
                      id="export-email"
                      className="form-input"
                      type="email"
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }}
                      required
                      autoFocus
                    />
                  </div>
                  {inviteError && (
                    <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.88rem', margin: '0 0 0.6rem' }}>
                      {inviteError}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={inviteBusy} onClick={() => setShowExport(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm" disabled={inviteBusy}>
                      {inviteBusy ? 'Please wait...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step 2: Create Realm ──
  if (step === 2) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Create New Realm</h2>
            <button
              type="button"
              title="Getting started"
              onClick={() => setShowHowTo(true)}
              style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '50%', width: '1.15rem', height: '1.15rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, color: 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
            >
              ?
            </button>
          </div>
          <div className="section-title-line" />
        </div>

        {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}

        <form ref={createFormRef} onSubmit={handleCreateRealm}>
          <div className="realm-create-grid" style={{ marginBottom: '0.9rem' }}>
          <div className="tile-card" style={{ marginBottom: 0 }}>
            {!isGuest && (
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
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.9rem, 2.5vw, 1.2rem)', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center', color: 'var(--earth-brown)' }}>
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
                {playerNames.map((name, i) => {
                  // Player 1 is always the creator's own slot for signed-in
                  // users; the name stays editable (per-group nickname). The
                  // hint floats inside the input so all boxes stay full width.
                  const isSelf = !isGuest && i === 0;
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        style={{ width: '100%', ...(isSelf ? { paddingRight: '3rem' } : {}) }}
                        value={name}
                        onChange={e => {
                          const u = [...playerNames];
                          u[i] = e.target.value;
                          setPlayerNames(u);
                          setNameError('');
                        }}
                        placeholder={`Player ${i + 1}`}
                      />
                      {isSelf && (
                        <span style={{
                          position: 'absolute',
                          right: '0.65rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontFamily: 'Crimson Text, serif',
                          fontStyle: 'italic',
                          fontSize: '0.78rem',
                          color: 'var(--stone-gray)',
                          pointerEvents: 'none',
                        }}>
                          (you)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="tile-card" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.6rem' }}>Choose Your Chest</label>
            <div className="meeple-options">
              {CHESTS.map((img, i) => {
                const btn = (
                  <button
                    key={i}
                    type="button"
                    className={`meeple-option chest-option${chestIndex === i ? ' selected' : ''}`}
                    onClick={isGuest ? undefined : () => setChestIndex(i)}
                    style={isGuest ? { cursor: 'var(--cursor-arrow)' } : undefined}
                  >
                    <img src={img} alt={`Chest ${i + 1}`} />
                  </button>
                );
                return isGuest ? (
                  <ValInfo key={i} tip="Sign in to customize your realm's chest and logbook.">{btn}</ValInfo>
                ) : btn;
              })}
            </div>
            <label className="form-label" style={{ display: 'block', margin: '1rem 0 0.6rem' }}>Choose Your Logbook</label>
            <div className="logbook-picker-row">
              {PICKABLE_SPINES.map((img, i) => {
                const btn = (
                  <button
                    key={i}
                    type="button"
                    className={`logbook-pick${spineIndex === i ? ' selected' : ''}`}
                    onClick={isGuest ? undefined : () => setSpineIndex(i)}
                    style={isGuest ? { cursor: 'var(--cursor-arrow)' } : undefined}
                  >
                    <img src={img} alt={`Logbook ${i + 1}`} draggable={false} />
                  </button>
                );
                return isGuest ? (
                  <ValInfo key={i} tip="Sign in to customize your realm's chest and logbook.">{btn}</ValInfo>
                ) : btn;
              })}
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
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
            )}
            <button type="submit" className="btn">Next →</button>
          </div>
        </form>
      </div>
    );
  }

  // ── Step 3: Mode Selection ──
  if (step === 3) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Choose Play Mode</h2>
          <div className="section-title-line" />
          {currentRealm && <span className="game-count">{currentRealm.name}</span>}
        </div>

        <div className="mode-selection-grid">
          <button
            ref={tableInfo.triggerRef}
            type="button"
            className={`mode-card${mode === 'table' ? ' selected' : ''}`}
            onClick={() => setMode('table')}
          >
            <div className="mode-card-icon"><img src={tableModeImg} alt="Table Mode" style={{ transform: 'scale(1.18)' }} /></div>
            <div className="mode-card-title">
              Table Mode
              <span
                className="mode-card-info-icon"
                onClick={e => { e.stopPropagation(); tableInfo.open(); }}
                onMouseEnter={tableInfo.onMouseEnter}
                onMouseLeave={tableInfo.onMouseLeave}
              >ⓘ</span>
            </div>
            {tableInfo.visible && (
              <div ref={tableDescRef} className="mode-card-desc" style={tableDescStyle}>
                One player records scores and manages the game from a single device.
              </div>
            )}
          </button>

          <div style={{ position: 'relative', width: '100%' }}>
            <div
              ref={partyInfo.triggerRef}
              className="mode-card"
              aria-disabled="true"
              style={{ opacity: 0.45, width: '100%', cursor: 'var(--cursor-arrow)' }}
            >
              <div
                className="mode-card-icon"
                onClick={e => { e.stopPropagation(); partyInfo.open(); }}
                onMouseEnter={partyInfo.onMouseEnter}
                onMouseLeave={partyInfo.onMouseLeave}
              >
                <img src={partyModeImg} alt="Party Mode" />
              </div>
              <div className="mode-card-title">
                <span
                  onClick={e => { e.stopPropagation(); partyInfo.open(); }}
                  onMouseEnter={partyInfo.onMouseEnter}
                  onMouseLeave={partyInfo.onMouseLeave}
                >
                  Party Mode
                </span>
                <span
                  className="mode-card-info-icon"
                  onClick={e => { e.stopPropagation(); partyInfo.open(); }}
                  onMouseEnter={partyInfo.onMouseEnter}
                  onMouseLeave={partyInfo.onMouseLeave}
                >ⓘ</span>
              </div>
            </div>
            {partyInfo.visible && (
              <div ref={partyDescRef} style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) translateX(var(--tt-shift, 0px))',
                background: 'var(--earth-brown)', color: 'var(--parchment)',
                padding: '0.4rem 0.7rem', borderRadius: '8px',
                zIndex: 9999, pointerEvents: 'none',
                maxWidth: 'min(200px, 85%)', textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                fontFamily: 'Crimson Text, serif', fontSize: '0.85rem', fontStyle: 'italic',
                lineHeight: 1.4,
                ...partyDescStyle,
              }}>
                Under development. <br /> Please check back later!
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.4rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (mode === 'table') {
                setStep(4); // Table → meeples
              } else {
                setStep(5); // Party → skip meeples, go to expansions
              }
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 4: Meeples (table mode only) ──
  if (step === 4) {
    return (
      <div className="pregame-screen">
        <div className="section-title">
          <h2>Choose Your Meeples</h2>
          <div className="section-title-line" />
          {currentRealm && <span className="game-count">{currentRealm.name}</span>}
        </div>

        {activePlayers.length === 0 ? (
          <div className="tile-card" style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>
              Create a realm first to configure players and meeples.
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
            className="btn btn-ghost"
            onClick={() => setStep(3)}
          >
            ← Back
          </button>
          {activePlayers.length > 0 && (
            <button type="button" className="btn" onClick={handleNextStep}>Next: Expansions →</button>
          )}
        </div>
      </div>
    );
  }

  // ── Step 5: Expansions + Start ──
  return (
    <div className="pregame-screen">
      <div className="section-title">
        <h2>Expansions in Play</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{currentRealm.name}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.4rem', marginBottom: '1.4rem' }}>
        {/* Expansions Selection — Edit swaps in the full catalog to manage ownership */}
        <div className="tile-card" style={{ display: 'flex', flexDirection: 'column' }}>

          {editCollection ? (() => {
            const itemState = (exp) => {
              if (isGuest && !(exp.type === 'mini' && GUEST_ALLOWED_MINIS.has(exp.name))) {
                return { editable: false, tip: 'Sign in to use expansions.' };
              }
              if (!exp.complete) return { editable: false, tip: 'Under development. Please check back later.' };
              return { editable: true };
            };
            const renderEditGroup = (label, exps) => exps.length === 0 ? null : (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--earth-brown)', marginBottom: '0.6rem' }}>
                  {label}
                </div>
                <div className="expansion-chips">
                  {exps.map(exp => {
                    const { editable, tip } = itemState(exp);
                    return (
                      <button
                        key={exp.name}
                        type="button"
                        className={`expansion-chip ${ownedExpansions.includes(exp.name) ? 'selected' : ''}${editable ? '' : ' settings-dev'}`}
                        data-tooltip={editable ? undefined : tip}
                        onClick={editable ? () => toggleOwned(exp.name) : undefined}
                        style={editable ? undefined : { opacity: 0.55, cursor: 'var(--cursor-arrow)' }}
                      >
                        {exp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
            return (
              <>
                <p className="section-intro" style={{ fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                  Tap an expansion to add or remove it from your collection.
                </p>
                {renderEditGroup('Full Expansions', DEFAULT_EXPANSIONS.filter(e => e.type === 'full'))}
                {renderEditGroup('Mini Expansions', DEFAULT_EXPANSIONS.filter(e => e.type === 'mini'))}
              </>
            );
          })() : ownedExpansions.length === 0 ? (
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
                {renderGroup('Full Expansions', full)}
                {renderGroup('Mini Expansions', mini)}
              </>
            );
          })()}

          {/* margin-top auto pins the button to the very bottom of the card */}
          {onToggleOwned && (
            <div style={{ marginTop: 'auto', paddingTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="settings-edit-btn" onClick={() => setEditCollection(v => !v)}>
                {editCollection ? 'Done' : 'Edit'}
              </button>
            </div>
          )}
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
        <button type="button" className="btn btn-ghost" onClick={() => setStep(mode === 'party' ? 3 : 4)}>← Back</button>
        <button type="button" className="btn" onClick={handleStart}>
          {mode === 'party' ? 'Begin' : 'Begin'}
        </button>
      </div>
    </div>
  );
}
