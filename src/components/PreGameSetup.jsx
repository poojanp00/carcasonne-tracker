/**
 * PRE-GAME SETUP COMPONENT
 * 
 * Guides players through multi-step game configuration before starting a Carcassonne session.
 * Remembers previous game settings for continuity and convenience.
 * Always mounted with a realm already chosen (via the Realms hub's chest
 * click) or a creation flow already requested — see App.jsx.
 *
 * Setup Flow:
 * Step 1: Players - Roster, invite status, and each player's meeple
 * Step 2: Realm Creation - Name, players, chest, and logbook
 * Step 5: Expansion Selection - Choose which expansions to include, then Begin
 * (Step numbers skip 3 and 4 — an old Mode Selection step and the since-
 * merged-into-Players Meeple Selection step, neither of which exist anymore.)
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
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import { getRealmMemberEmails, getRealmMemberProgress } from '../data/storage';
import { rankTitle } from '../utils/metaRank';
import { CreateRealmTourModal, RealmTourModal } from './HowToGuide';
import { CHESTS, chestFor } from '../data/chests';
import { SPINES } from '../data/spines';
import ArtPickerGrid from './ArtPickerGrid';

// Picks a random index from an unlocked-index Set (see utils/artUnlocks.js)
// — not a dense 0..N-1 prefix, so a plain Math.random()*count doesn't work.
function randomUnlockedIndex(unlockedIdx) {
  const arr = [...unlockedIdx];
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : 0;
}

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

// Replaces the plain <h2> on steps 1 and 5 (Players/Expansions) with the
// full sequence at a glance. Step numbers skip 3 and 4 (an old Mode
// Selection step, and the since-merged-into-Players Meeples step).
function PregameStepper({ step, onJump }) {
  const items = [{ s: 1, label: 'Players' }, { s: 5, label: 'Expansions' }];
  return (
    <div className="pregame-stepper">
      {items.map((item, i) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem' }}>
          {i > 0 && <span className="pregame-step-sep">›</span>}
          <button
            type="button"
            className={`pregame-step${item.s === step ? ' active' : ''}`}
            onClick={() => onJump(item.s)}
            // Only resetting button chrome here — `.pregame-step`/`.active`
            // already carry the real font-family/weight/clamp-size/letter-
            // spacing, but inline styles always beat a class, so a stray
            // `font`/`letterSpacing: 'inherit'` here previously wiped all of
            // that (including the responsive clamp) rather than just the
            // button-specific bits.
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)' }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export default function PreGame({ realm, ownedExpansions, onStart, defaultMeeples, defaultExpansions, realms = [], currentRealm = null, onExitToHub, onRealmCreate, onExportGroup = null, startAtRealmCreation = false, isGuest = false, selfName = '', unlockedChestIndices = null, unlockedLogbookIndices = null, tourActive = false }) {
  // Which CHESTS/SPINES index is actually claimed via each independent
  // art-unlock track (see utils/artUnlocks.js) — defaults to just index 0
  // (item 1's guaranteed rank-1 grant) if the caller hasn't loaded real
  // state yet.
  const unlockedChestIdx = unlockedChestIndices || new Set([0]);
  const unlockedLogbookIdx = unlockedLogbookIndices || new Set([0]);
  // Steps: 1=Players (roster, invite status, and meeples), 2=Realm creation,
  // 5=Expansions. Step 3 was an old Mode Selection step (Table vs. Party)
  // and step 4 was a standalone Meeples step later folded into Players —
  // neither exists anymore, so the numbering skips both.
  // Every fresh mount arrives with either `currentRealm` already populated
  // (chosen via a chest click on the Realms hub) or `startAtRealmCreation`
  // set (see App.jsx) — the `2` fallback below only guards against a mount
  // with neither, which shouldn't happen.
  const initialStep = startAtRealmCreation ? 2 : currentRealm ? 1 : 2;
  const [step, setStep] = useState(initialStep);

  // Continuation of the Realms guided tour (started from the hub's "?") —
  // stage is derived from `step` the same way RealmsTab derives its own
  // stages from openBookRealmId/page, so real clicks (a meeple, an
  // expansion chip) keep it in sync without the tour driving navigation
  // itself. Step 2 (realm creation) isn't part of this tour — it has its
  // own separate, linear CreateRealmTourModal instead (see below). The
  // highlight sits on each stage's Back/Next (or Begin) button row, not the
  // page content.
  // Expansions and Begin share step 5 (Begin is a button on that page, not
  // a page of its own), so a local sub-stage distinguishes them.
  const [expansionsSubStage, setExpansionsSubStage] = useState('expansions'); // 'expansions' | 'begin'
  useEffect(() => { if (step !== 5) setExpansionsSubStage('expansions'); }, [step]);
  const tourStage = !tourActive ? null
    : step === 1 ? 'players'
    : step === 5 ? (expansionsSubStage === 'begin' ? 'begin' : 'expansions')
    : null;
  // Covers the whole Players page now — roster/invite status and meeples
  // together — since the two got merged into one step.
  const playersRef = useRef(null);
  const expansionsLeftRef = useRef(null); // Expansions stage: highlight + popup anchor, left box only
  const requiredPiecesRef = useRef(null); // Begin stage: highlight + popup anchor, right box only
  const beginRef = useRef(null);
  const tourRefs = { players: playersRef, expansions: expansionsLeftRef, begin: requiredPiecesRef };
  useEffect(() => {
    if (tourStage) tourRefs[tourStage]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStage]);
  // Each popup docks beside its own specific target — Expansions spotlights
  // just the left (expansion-picking) box, Begin spotlights just the right
  // (required-pieces) box, so the card visibly points at the one thing it's
  // describing instead of the whole two-column row.
  const tourTargetRef = tourStage === 'players' ? playersRef
    : tourStage === 'expansions' ? expansionsLeftRef
    : tourStage === 'begin' ? requiredPiecesRef
    : null;
  const advancePlayTour = () => {
    if (step === 1) { if (activePlayers.length > 0) handleNextStep(); }
    else if (step === 5 && expansionsSubStage === 'expansions') { setExpansionsSubStage('begin'); }
    else if (step === 5) onExitToHub(); // begin sub-stage: loops back to the hub; tourActive (lifted to App.jsx) stays on
  };
  // Mirrors advancePlayTour in reverse — Players (the first stage of this
  // path) backs out to the hub the same way Close from here always did,
  // but leaves tourActive on since it's a step back, not an exit.
  const backPlayTour = () => {
    if (step === 1) { onExitToHub(); }
    else if (step === 5 && expansionsSubStage === 'begin') { setExpansionsSubStage('expansions'); }
    else if (step === 5) { setStep(1); }
  };

  // Realm creation state (step 2) — split across two sub-forms: 1) name +
  // players, 2) chest/logbook customization, which is what actually creates
  // the realm.
  const [createSubStep, setCreateSubStep] = useState(1);
  useEffect(() => { if (step !== 2) setCreateSubStep(1); }, [step]);
  // Create-Realm's own short, linear tour — derived from createSubStep the
  // same way the bigger tour derives from step/page, so the real "Next →"
  // (with its own validation) keeps it in sync too. Guests get it fresh
  // every time they land here (this component remounts each time via
  // key="realm-creation" in App.jsx); signed-in users open it manually via
  // the "?".
  const [createTourOn, setCreateTourOn] = useState(isGuest);
  // Guards against a stale-true createTourOn stranding this guest on every
  // step AFTER realm creation, not just step 2: creating the realm swaps
  // `session.realm` in App.jsx, which mounts a BRAND NEW PreGameSetup
  // instance (different `key`) landing straight on step 1 (Players) —
  // createTourOn's own initial value is still `isGuest` on that fresh
  // mount, so without this it stays stuck true forever even though the
  // create-realm tour itself never renders again (gated on step === 2
  // below). That stuck-true state was silently blocking the arrow-key/
  // Enter step navigation effect further down, which bails out whenever
  // createTourOn is true regardless of which step it's actually checking.
  useEffect(() => { if (step !== 2) setCreateTourOn(false); }, [step]);
  const createTourStage = createTourOn ? createSubStep - 1 : null; // 0 or 1
  const createNameRef = useRef(null);
  const createChestRef = useRef(null);
  // Re-triggers the tour on the chest/logbook page every time a guest
  // arrives there — even if they dismissed it (X) on the name page first
  // (closing stage 0 shouldn't suppress stage 1 too), and even if they'd
  // already dismissed stage 1 itself on an earlier visit this same mount
  // (← Back to the name page, then Next → forward again still re-opens it —
  // guaranteed every arrival, not just the first). Only fires on an actual
  // transition into sub-step 2 (the dependency array), not continuously
  // while already there, so it doesn't fight a guest who closes it mid-visit.
  useEffect(() => {
    if (isGuest && createSubStep === 2) setCreateTourOn(true);
  }, [isGuest, createSubStep]);
  useEffect(() => {
    if (createTourStage === 0) createNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (createTourStage === 1) createChestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [createTourStage]);
  const advanceCreateTour = () => {
    // Same validation the real "Next →" runs — the tour can't wave the
    // user through onto chest/logbook without a valid name/roster behind
    // it. The last step's "Create" IS the real create action now — closes
    // the tour and submits in one click instead of leaving the user to
    // close it and hunt for the (until now disabled) real Create button.
    if (createSubStep === 1) { if (validateNamesSubStep()) setCreateSubStep(2); }
    else {
      setCreateTourOn(false);
      handleCreateRealm({ preventDefault: () => {} });
    }
  };
  const backCreateTour = () => setCreateSubStep(1);
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
  const [chestIndex, setChestIndex] = useState(() => (isGuest ? 0 : randomUnlockedIndex(unlockedChestIdx)));
  const [spineIndex, setSpineIndex] = useState(() => (isGuest ? 0 : randomUnlockedIndex(unlockedLogbookIdx)));

  // Re-picks if the current selection ever isn't actually unlocked —
  // covers both the initial random pick racing ahead of App.jsx's
  // art-unlock fetch (this component can mount before that resolves, so
  // the very first render's "random unlocked" pick may have been computed
  // against a stale/fallback set) and a genuine regression (e.g. deleting a
  // realm lowers rank, revoking a chest/logbook this session had already
  // landed on) while this screen stays mounted. No-op once the selection
  // is actually valid.
  useEffect(() => {
    if (isGuest) return;
    if (!unlockedChestIdx.has(chestIndex)) setChestIndex(randomUnlockedIndex(unlockedChestIdx));
  }, [isGuest, unlockedChestIdx, chestIndex]);
  useEffect(() => {
    if (isGuest) return;
    if (!unlockedLogbookIdx.has(spineIndex)) setSpineIndex(randomUnlockedIndex(unlockedLogbookIdx));
  }, [isGuest, unlockedLogbookIdx, spineIndex]);

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

  // Linked co-members' current rank, shown as a title (e.g. "Steward") next
  // to their name on the meeple-selection step — same fetch shape as
  // RealmBook's Fellowship page, just keyed by name here since that's what
  // the meeple picker iterates over.
  const [memberRanks, setMemberRanks] = useState({});
  useEffect(() => {
    if (isGuest || !currentRealm?.id) { setMemberRanks({}); return; }
    let stale = false;
    getRealmMemberProgress(currentRealm.id).then(map => {
      if (stale) return;
      const byName = {};
      for (const p of currentRealm.players || []) {
        if (p.userId && map[p.userId]) byName[p.name] = map[p.userId].rank;
      }
      setMemberRanks(byName);
    });
    return () => { stale = true; };
  }, [isGuest, currentRealm?.id, currentRealm?.players]);

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

    // Guests can name their realm too, but aren't required to — falls back
    // to "Guest" if left blank. Signed-in users must provide one.
    const finalRealmName = isGuest ? (realmName.trim() || 'Guest') : realmName.trim();

    if (!isGuest && !finalRealmName) {
      setNameError('Please enter a realm name.');
      return;
    }
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
      setStep(1); // Move to players/meeples
    }
  };

  // Gate on the same checks handleCreateRealm makes, so a broken name/roster
  // is caught before the user moves on to customization instead of at the end.
  const validateNamesSubStep = () => {
    if (!isGuest && realms.filter(r => r.isOwner !== false).length >= MAX_REALMS) {
      setNameError(`Realm limit reached. Delete an existing realm to create a new one.`);
      return false;
    }
    const names = playerNames.map((name, i) => name.trim() || `Player ${i + 1}`);
    const finalRealmName = isGuest ? (realmName.trim() || 'Guest') : realmName.trim();
    if (!isGuest && !finalRealmName) {
      setNameError('Please enter a realm name.');
      return false;
    }
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      setNameError('Player names must be unique.');
      return false;
    }
    if (!isGuest && realms.some(r => r.name.toLowerCase() === finalRealmName.toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleCreateFormSubmit = (e) => {
    if (createSubStep === 1) {
      e.preventDefault();
      if (validateNamesSubStep()) setCreateSubStep(2);
      return;
    }
    handleCreateRealm(e);
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
    // Meeple uniqueness doesn't matter during the guided tour — it's not a
    // real game, so a duplicate pick there (the tour's own default
    // assignment, or just clicking through) shouldn't strand the tour on an
    // error a real player would actually have to go fix.
    if (!tourActive) {
      // Extract all meeple selections (no exclusions needed)
      const chosen = activePlayers.map(p => meeples[p]);

      // Check for duplicates using Set size comparison
      if (new Set(chosen).size < chosen.length) {
        setMeepleError('Meeples must be unique.');
        return;
      }
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
      meeples,
      expansions: selectedExp,
    });
  };

  // Ref to step 2's realm-creation form, so a keyboard-triggered advance can
  // submit it the same way clicking its button would (validation included).
  const createFormRef = useRef(null);

  // Arrow-key / Enter step navigation, mirroring the Library logbook's
  // page-turn shortcut — mapped onto whichever Back/Next/Begin action is
  // currently on screen. Skipped while focus is in a text field (so typing
  // and native cursor movement/Enter-to-submit aren't hijacked), on a
  // focused button (which already handles its own Enter/Space natively),
  // or while either tour is open — the tour drives its own stage
  // transitions via its own Back/Next, and letting these shortcuts also
  // fire underneath it would desync the two (or submit/start a real game
  // the tour is supposed to be blocking).
  useEffect(() => {
    const onKey = (e) => {
      if (tourActive || createTourOn) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;

      if (e.key === 'ArrowLeft') {
        if (step === 1) onExitToHub();
        // Step 2 has its own two sub-steps (name/players, then chest/
        // logbook) — mirrors the real "‹ Back" button's own branch (see
        // its onClick above): back from sub-step 2 means sub-step 1, not
        // all the way out to the Realms hub.
        else if (step === 2 && createSubStep === 2) setCreateSubStep(1);
        else if (step === 2 && createSubStep === 1 && realms.length > 0) onExitToHub();
        else if (step === 5) setStep(1);
        return;
      }
      // Steps 1 and step 2's FIRST sub-step page forward the same way for
      // either key; the actual create/start action — step 2's sub-step 2
      // "Create", and step 5's "Begin" — is Enter-only, same reasoning as
      // step 5 already had: ArrowRight shouldn't silently submit/start
      // something from a page that's still just picking cosmetics.
      const advance = () => {
        if (step === 1) { if (activePlayers.length > 0) handleNextStep(); }
        else if (step === 2 && createSubStep === 1) createFormRef.current?.requestSubmit();
      };
      if (e.key === 'ArrowRight') { advance(); return; }
      if (e.key === 'Enter') {
        if (step === 5) handleStart();
        else if (step === 2 && createSubStep === 2) createFormRef.current?.requestSubmit();
        else advance();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // meeples/selectedExp must be deps, not just activePlayers.length — Enter
    // on step 5 calls handleStart(), which closes over both; without them
    // here the listener kept whatever stale closure was bound when the
    // effect last ran (e.g. right as step became 5), so pressing Enter
    // silently started the game with default/empty meeples and expansions
    // no matter what was actually picked afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, createSubStep, realms.length, activePlayers.length, tourActive, createTourOn, meeples, selectedExp]);

  // ── Step 1: Players (roster/invite status + meeples, merged) ──
  if (step === 1) {
    return (
      <div className={`pregame-screen${tourStage ? ' tour-inert' : ''}`}>
        {tourStage && <RealmTourModal stage={tourStage} onNext={advancePlayTour} onBack={backPlayTour} onClose={onExitToHub} targetRef={tourTargetRef} />}

        <div className="section-title">
          {currentRealm && (
            <button type="button" className="section-title-back" onClick={onExitToHub} title="Back to the realms hub">
              <span aria-hidden="true">‹</span>
              <img className="realm-chest-icon" src={chestFor(currentRealm)} alt="" />
            </button>
          )}
          <PregameStepper step={step} onJump={setStep} />
          <div className="section-title-line" />
          {currentRealm && <span className="game-count">{currentRealm.name}</span>}
        </div>

        {!currentRealm ? (
          <div className="tile-card" style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>
              Create a realm first to configure players and meeples.
            </p>
          </div>
        ) : (
          <div ref={playersRef} className={`tile-card${tourStage === 'players' ? ' tour-highlight' : ''}`} style={{ marginBottom: '1.4rem' }}>
            <div className="meeple-picker-grid">
              {activePlayers.map((name, i) => {
                const playerObj = currentRealm.players?.find(p => p.name === name);
                const status = playerObj ? playerStatus(playerObj) : null;
                return (
                  <div key={name} className="meeple-picker-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                    {/* width: 100% so this row's right edge — where the
                        status/Invite badge lands via marginLeft: auto —
                        lines up with the meeple chips row below rather than
                        just hugging its own (narrower) content width. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                      <span className="meeple-picker-name" style={{ minWidth: 0, flex: '0 1 auto' }}>
                        {name}
                      </span>
                      {/* Right side: the player's link status — or an Invite
                          action while the slot is unclaimed (any member) —
                          sits right after the name, pushed flush to the
                          row's right edge via marginLeft: auto. */}
                      {!isGuest && playerObj && (
                        status === 'uninvited' && onExportGroup ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 'auto' }}
                            title="Share this realm with another account as this player"
                            onClick={() => openExport(name)}
                          >
                            ↑ Invite
                          </button>
                        ) : (
                          <span
                            title={playerObj.userId ? memberEmails[playerObj.userId] : undefined}
                            style={{
                              fontFamily: 'Crimson Text, serif',
                              fontStyle: 'italic',
                              fontSize: '0.78rem',
                              color: 'var(--stone-gray)',
                              marginLeft: 'auto',
                            }}
                          >
                            {/* An actual member (owner/member) shows their rank
                                instead of that role word, once it's loaded —
                                pending/uninvited slots have no rank to show,
                                so those keep the plain status text. */}
                            {(status === 'owner' || status === 'member') && memberRanks[name]
                              ? rankTitle(memberRanks[name])
                              : { owner: 'Owner', member: 'Member', pending: 'Pending', uninvited: 'Uninvited' }[status] || 'Uninvited'}
                          </span>
                        )
                      )}
                    </div>
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
                );
              })}
            </div>
          </div>
        )}

        {meepleError && (
          <p style={{ fontStyle: 'italic', color: 'var(--red, #DC2626)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
            {meepleError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', justifyContent: !currentRealm ? 'center' : 'space-between' }}>
          <button type="button" className="btn btn-ghost" onClick={onExitToHub}>← Back</button>
          {currentRealm && (
            <button type="button" className="btn" onClick={handleNextStep}>Next: Expansions →</button>
          )}
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
      <div className={`pregame-screen${createTourOn ? ' tour-inert' : ''}`}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Create New Realm</h2>
            <button
              type="button"
              title="Getting started"
              onClick={() => setCreateTourOn(true)}
              style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '50%', width: 'clamp(1.15rem, 4vw, 1.5rem)', height: 'clamp(1.15rem, 4vw, 1.5rem)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 2vw, 0.8rem)', fontWeight: 700, color: 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
            >
              ?
            </button>
          </div>
          <div className="section-title-line" />
        </div>

        {createTourStage !== null && (
          <CreateRealmTourModal stage={createTourStage} onNext={advanceCreateTour} onBack={backCreateTour} onClose={() => { setCreateTourOn(false); if (createTourStage === 0) setCreateSubStep(1); }} targetRef={createTourStage === 0 ? createNameRef : createChestRef} />
        )}

        <form ref={createFormRef} onSubmit={handleCreateFormSubmit} noValidate>
          {createSubStep === 1 ? (
            <div ref={createNameRef} className={`tile-card${createTourOn ? ' tour-highlight' : ''}`} style={{ marginBottom: '0.9rem' }}>
              <div className="form-group" style={{ maxWidth: '360px' }}>
                <label className="form-label">Realm Name</label>
                <input
                  className="form-input"
                  value={realmName}
                  onChange={e => { setRealmName(e.target.value); setNameError(''); }}
                  placeholder={isGuest ? "e.g. Club Thursday's (optional)" : "e.g. Club Thursday's"}
                  maxLength={20}
                  // Not for guests: the name's optional for them, and the
                  // create-realm tour auto-opens right on top of this step
                  // (see createTourOn's default) — stealing focus into the
                  // field (and popping the mobile keyboard) would fight
                  // with actually seeing that tour popup.
                  autoFocus={!isGuest}
                />
                {nameError && (
                  // position+zIndex above .tour-highlight's 9500 — otherwise the
                  // spotlighted tile-card's own dimming shadow (a box-shadow with
                  // a 9999px spread, painted in front of any z-index:auto sibling
                  // regardless of DOM order) buries this text when the tour's
                  // "Next" fails validation on stage 0.
                  <p style={{ position: 'relative', zIndex: 9600, fontSize: '0.88rem', color: 'var(--deep-red)', fontStyle: 'italic', margin: '0.4rem 0 0' }}>
                    {nameError}
                  </p>
                )}
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
                          maxLength={20}
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
          ) : (
            <div ref={createChestRef} className={`tile-card${createTourOn ? ' tour-highlight' : ''}`} style={{ marginBottom: '0.9rem' }}>
              {/* Side by side on wide screens, stacked on narrow ones — both
                  rows use a fixed column count (see .chest-picker-row /
                  .logbook-picker-row) so a row of N chests lines up with a
                  row of N logbooks regardless of how much narrower a
                  logbook is than a chest. */}
              <div className="chest-logbook-columns">
                <div className="chest-logbook-col">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.6rem' }}>
                    Select a Chest
                  </label>
                  <ArtPickerGrid
                    items={CHESTS}
                    rowClassName="chest-picker-row"
                    pickClassName="chest-pick"
                    altPrefix="Chest"
                    selectedIndex={chestIndex}
                    onSelect={setChestIndex}
                    // Chests 002–006 (indices 1-5) don't even render a
                    // locked silhouette for guests — signing in reveals
                    // them, rather than teasing that art up front.
                    hideIndex={i => isGuest && i >= 1 && i <= 5}
                    isGuestBlocked={i => isGuest && i !== 0}
                    isLocked={i => !isGuest && !unlockedChestIdx.has(i)}
                    guestTip="Sign in to customize your realm's chest."
                  />
                </div>
                <div className="chest-logbook-col">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.6rem' }}>
                    Select a Logbook
                  </label>
                  <ArtPickerGrid
                    items={SPINES}
                    rowClassName="logbook-picker-row"
                    pickClassName="logbook-pick"
                    altPrefix="Logbook"
                    selectedIndex={spineIndex}
                    onSelect={setSpineIndex}
                    hideIndex={i => isGuest && i >= 1 && i <= 5}
                    isGuestBlocked={i => isGuest && i !== 0}
                    isLocked={i => !isGuest && !unlockedLogbookIdx.has(i)}
                    guestTip="Sign in to customize your realm's logbook."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-step 1's errors (missing/duplicate name, non-unique players)
              show right under the Realm Name box above — this spot only
              covers the rare case a re-check at final creation (sub-step 2
              has no name field to anchor near) fails, e.g. the realm cap
              being hit between sub-steps. */}
          {nameError && createSubStep === 2 && (
            <p style={{ fontSize: '0.88rem', color: 'var(--deep-red)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
              {nameError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: (createSubStep === 2 || realms.length > 0) ? 'space-between' : 'flex-end' }}>
            {createSubStep === 2 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setCreateSubStep(1)}>← Back</button>
            ) : realms.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={onExitToHub}>← Back</button>
            )}
            <button type="submit" className="btn" disabled={createTourOn} title={createTourOn ? 'Close the tour to continue for real' : undefined}>{createSubStep === 2 ? 'Create' : 'Next →'}</button>
          </div>
        </form>
      </div>
    );
  }


  // ── Step 5: Expansions + Start ──
  return (
    <div className={`pregame-screen${tourStage ? ' tour-inert' : ''}`}>
      {tourStage && <RealmTourModal stage={tourStage} onNext={advancePlayTour} onBack={backPlayTour} onClose={onExitToHub} targetRef={tourTargetRef} />}

      <div className="section-title">
        {currentRealm && (
          <button type="button" className="section-title-back" onClick={onExitToHub} title="Back to the realms hub">
            <span aria-hidden="true">‹</span>
            <img className="realm-chest-icon" src={chestFor(currentRealm)} alt="" />
          </button>
        )}
        <PregameStepper step={step} onJump={setStep} />
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{currentRealm.name}</span>}
      </div>

      <div className="pregame-expansions-grid" style={{ marginBottom: '1.4rem' }}>
        {/* Expansions Selection — which of your owned expansions are in play
            this game. Ownership itself is no longer editable from here (see
            Collection on the Profile page instead) — this box only ever
            picks from what's already owned. */}
        <div ref={expansionsLeftRef} className={`tile-card${tourStage === 'expansions' ? ' tour-highlight' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
          {ownedExpansions.length === 0 ? (
            <p className="section-intro">No expansions owned — base game only.</p>
          ) : (() => {
            const categoryOf = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.category]));
            const full = ownedExpansions.filter(n => categoryOf[n] === 'major');
            const mini = ownedExpansions.filter(n => categoryOf[n] === 'mini' || categoryOf[n] === 'base_mini');
            const renderGroup = (label, names) => names.length === 0 ? null : (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 'clamp(0.55rem, 2vw, 0.8rem)', fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--earth-brown)', marginBottom: '0.6rem' }}>
                  {label}
                </div>
                <div className="expansion-chips">
                  {names.map(name => (
                    <button
                      key={name}
                      type="button"
                      className={`expansion-chip ${selectedExp.includes(name) ? 'selected' : ''}`}
                      onClick={(e) => { toggleExpansion(name); e.currentTarget.blur(); }}
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
        </div>

        {/* Required Pieces Checklist */}
        <div ref={requiredPiecesRef} className={`tile-card${tourStage === 'begin' ? ' tour-highlight' : ''}`}>
          <div style={{ fontSize: 'clamp(0.5rem, 1.8vw, 0.7rem)', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.8rem' }}>
            REQUIRED PIECES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Tiles section */}
              <div>
                <div style={{ fontSize: 'clamp(0.55rem, 1.8vw, 0.75rem)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  TILES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {requiredPieces.tiles.map(({ source, qty }) => (
                    <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'clamp(0.65rem, 2vw, 0.88rem)', fontFamily: 'Crimson Text, serif' }}>
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
                <div style={{ fontSize: 'clamp(0.55rem, 1.8vw, 0.75rem)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  Meeples Per Player
                </div>
                {Object.keys(requiredPieces.perPlayer).length === 0 ? (
                  <p style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.82rem)', fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', margin: 0 }}>None</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {Object.entries(requiredPieces.perPlayer)
                      .map(([piece, qty]) => (
                        <div key={piece} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'clamp(0.65rem, 2vw, 0.88rem)', fontFamily: 'Crimson Text, serif' }}>
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
                    <div style={{ fontSize: 'clamp(0.55rem, 1.8vw, 0.75rem)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--stone-gray)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                      OTHER
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {Array.from(requiredPieces.fixed)
                        .map(piece => {
                          const breakdown = componentBreakdown[piece];
                          return (
                            <div key={piece} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'clamp(0.65rem, 2vw, 0.88rem)', fontFamily: 'Crimson Text, serif' }}>
                                <span>{formatPieceName(piece)}</span>
                                {!breakdown && <span style={{ fontWeight: 600, color: 'var(--earth-brown)' }}>×1</span>}
                              </div>
                              {breakdown && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginLeft: '1rem', borderLeft: '2px solid rgba(201,163,74,0.3)', paddingLeft: '0.6rem' }}>
                                  {breakdown.map(comp => (
                                    <div key={comp.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'clamp(0.6rem, 1.8vw, 0.82rem)', fontFamily: 'Crimson Text, serif', color: 'var(--stone-gray)' }}>
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
        <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
        <button
          ref={beginRef}
          type="button"
          className="btn pregame-begin-btn"
          onClick={tourActive ? onExitToHub : handleStart}
          disabled={tourActive && tourStage !== 'begin'}
          title={tourActive && tourStage !== 'begin' ? 'Close the tour to start a real game' : undefined}
        >
          Begin
        </button>
      </div>
    </div>
  );
}
