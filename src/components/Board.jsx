/**
 * CARCASSONNE score board COMPONENT
 * 
 * Manages the scoring track visualization and point tracking for active games.
 * Features 50-point circular track with lap counting for scores above 50.
 * 
 * Key systems:
 * - Dynamic meeple loading from file system
 * - Position tracking with lap-based overflow
 * - Visual meeple stacking when players share positions
 * - Score breakdown by category (road, city, monastery, field, expansions)
 * - Undo/redo history for move corrections
 * - Real-time score logging and persistence
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import BOARD_PATH from '../data/boardCoords';
import { getBoard, saveBoard, resetBoard } from '../data/boardStorage';
import { computeWinners } from '../utils/scoring';
import { MONASTERY_LIKE_TYPES, MONASTERY_LIKE_MAX, LIVE_PLAY_ONLY_RECORD_TYPES, MONASTERY_RECORD_TYPES, MAX_GAME_PLAYERS, EXPANSION_TYPES } from '../constants';
import { BoardTourModal, BOARD_TOUR_STEPS } from './HowToGuide';
import BoardSettingsModal from './BoardSettingsModal';
import { TrashIcon, GearIcon } from './icons';
import { chestFor } from '../data/chests';
import boardImg from '../../images/score-board.jpg';
import leaderIcon from '../../images/icons/leader.png';

/**
 * MEEPLE IMAGE LOADING SYSTEM
 * 
 * Dynamically imports all meeple images using Vite's glob import feature.
 * Supports both standard meeples (/meeples/*.png) and custom fun meeples (/meeples/fun/*.png).
 * This allows adding new meeples without code changes - just add image files.
 * Images are bundled at build time for optimal performance.
 */
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  // Extract filename from path: '../../images/meeples/red.png' → 'red.png'
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  // Fun meeples get 'fun/' prefix: '../../images/meeples/fun/naruto.png' → 'fun/naruto.png'
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
// Safety fallback if specific meeple file is missing
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const GOODS_MODULES = import.meta.glob('../../images/goods_tokens/*.png', { eager: true, import: 'default' });
const GOODS_IMGS = Object.fromEntries(
  Object.entries(GOODS_MODULES).map(([path, img]) => [path.split('/').pop().replace('.png', ''), img])
);

/**
 * SCORE SOUND EFFECTS
 *
 * One clip per score type (road/city/monastery/field/inn/cathedral/...),
 * dropped into /audio as they're recorded — mp3 or wav, either works. Only
 * monastery.mp3 exists so far; every other type just stays silent until its
 * file shows up, no code change needed to add one later. Goods tokens (wine/
 * grain/cloth) aren't a `type` string match — all three share one 'goods'
 * key/goods.mp3 rather than one clip each.
 */
// Lazy (not eager): each entry is a loader function, only actually resolved
// the first time that type scores. That matters because this folder is a
// living drop target — an odd filename Vite can't turn into a static import
// (spaces are fine; something like a stray '#' isn't) would otherwise fail
// the whole glob at build time and 500 the entire app. Lazy means a bad file
// only fails its own dynamic import() call, caught below, the moment (if
// ever) something actually tries to play it — every other sound, and the
// app itself, keeps working regardless.
const SOUND_LOADERS = import.meta.glob('../../audio/*.{mp3,wav}');
const SCORE_SOUND_LOADERS = Object.fromEntries(
  Object.entries(SOUND_LOADERS).map(([path, load]) => [path.split('/').pop().replace(/\.(mp3|wav)$/, ''), load])
);
// A fresh Audio instance per play (rather than one reused element) so the
// same sound can overlap itself if two scores land in quick succession.
function playScoreSound(type) {
  const load = SCORE_SOUND_LOADERS[type];
  if (!load) return;
  load()
    .then(mod => new Audio(mod.default).play())
    .catch(() => {}); // bad/unresolvable file, or autoplay blocked — stay silent
}

// Physical token supply counts for Traders & Builders
const GOODS_SUPPLY = { wine: 9, grain: 6, cloth: 5 };
const GOODS_LABELS = { wine: 'Wine', grain: 'Grain', cloth: 'Cloth' };

// Applied to a score type/goods button while it's the pending selection,
// so it looks pressed in rather than glowing/highlighted.
const PRESSED_STYLE = { transform: 'scale(0.93)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' };

/**
 * MEEPLE COLOR EXTRACTION SYSTEM
 * 
 * Maps standard Carcassonne player colors to hex values for UI consistency.
 * Extracts color from filename (e.g., '1red.png' → red → '#DC2626').
 * Used for score buttons, player indicators, and theme coordination.
 */
const MEEPLE_COLOR_MAP = {
  blue:   '#2563EB', // Classic Carcassonne blue player
  red:    '#DC2626', // Classic Carcassonne red player
  yellow: '#B8860B', // Classic Carcassonne yellow player
  green:  '#16A34A', // Classic Carcassonne green player
  black:  '#111827', // Classic Carcassonne black player
  pink:   '#EC4899', // Classic Carcassonne pink player
};
const FALLBACK_COLOR = '#8B5E3C'; // Earth brown for unrecognized colors

// Which board move `type`s belong to each expansion — used by the in-game
// settings modal to warn before hiding an expansion that already has
// recorded points this game (see expansionHasPoints/removeExpansion below).
const EXPANSION_MOVE_TYPES = {
  'Traders & Builders':         ['wine', 'grain', 'cloth', 'pig', 'goods_wine', 'goods_grain', 'goods_cloth'],
  'Inns & Cathedrals':          ['inn', 'cathedral'],
  'Bridges, Castles & Bazaars': ['inn', 'cathedral'],
  'Abbey & Mayor':              ['abbey', 'barn'],
  'The Abbot':                  ['abbot'],
};

/**
 * Extract player color from meeple filename for UI theming.
 * Examples: '1red.png' → '#DC2626', 'fun/naruto.png' → FALLBACK_COLOR
 */
function getMeepleColor(filename) {
  if (!filename) return FALLBACK_COLOR;
  const match = filename.match(/blue|red|yellow|green|black|pink/i);
  return match ? (MEEPLE_COLOR_MAP[match[0].toLowerCase()] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

/**
 * MEEPLE VISUAL STACKING SYSTEM
 * 
 * When multiple players occupy the same board position, meeples are visually
 * offset to prevent complete overlap. Offsets are applied in order of player list.
 * 
 * Position 0: No offset (primary position)
 * Positions 1-5: Small pixel offsets in different directions
 * Creates readable stacking pattern for up to 6 players on same space
 */
const STACK_OFFSETS = [
  { x: 0,  y:  0 }, // Player 1: exact position
  { x: 3,  y: -3 }, // Player 2: slightly up-right
  { x: -3, y: -3 }, // Player 3: slightly up-left  
  { x: 3,  y:  3 }, // Player 4: slightly down-right
  { x: -3, y:  3 }, // Player 5: slightly down-left
  { x: 0,  y: -5 }, // Player 6: more upward
];

export default function Board({ userId, isGuest, session, onFinish, onReset, onExitToHub, autoShowHowTo, onHowToShown, onSessionUpdate, ownedExpansions = [] }) {
  const players   = session?.players  || [];
  const meepleMap = session?.meeples  || {};

  const [board,       setBoard]       = useState(null);
  const [now,         setNow]         = useState(Date.now());
  const [input,       setInput]       = useState(() => Object.fromEntries(players.map(p => [p, 0])));
  const [selectedType, setSelectedType] = useState(null); // Score type highlighted, awaiting a player click to commit
  const [selectedGoods, setSelectedGoods] = useState(new Set()); // Goods tokens highlighted (can pick several), awaiting a player click to commit
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Player highlighted first, awaiting a type/good click to commit
  const [finishStep,       setFinishStep]       = useState(0); // 0 = normal, 1 = awaiting field confirm
  const [leadersAtFinish,  setLeadersAtFinish]  = useState([]);
  const [showTraders,   setShowTraders]   = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false); // Finish game confirmation
  // "?" guided tour — null = closed, 0-4 = current BOARD_TOUR_STEPS entry.
  // Guests see it once per game on arrival (mirrors the old static
  // how-to-guide's autoShowHowTo/onHowToShown wiring in App.jsx); suppressed
  // on later remounts of the same game (e.g. switching tabs away and back).
  // Purely a walkthrough — every scoring interaction is guarded below to
  // no-op while this is non-null, so nothing about the real game can change
  // mid-tour (see commitToPlayer/selectType/selectGood/updatePoints/
  // confirmInitialScoring/handleFinish).
  const [tourStep, setTourStep] = useState(() => (isGuest && autoShowHowTo) ? 0 : null);
  const [confirmReset,         setConfirmReset]         = useState(false); // Reset board confirmation
  const [confirmExit,          setConfirmExit]          = useState(false); // Back-to-hub confirmation
  const [showSettings,          setShowSettings]          = useState(false); // In-game settings modal (players/meeples/expansions)
  const [pendingPlayerRemoval,  setPendingPlayerRemoval]  = useState(null); // player name awaiting removal confirm (has recorded points)
  // Expansion names awaiting a keep/remove-points choice, queued one at a
  // time — the settings modal's Save button can turn off several
  // point-having expansions in one go (see handleSaveExpansions), so this
  // holds all of them and the confirm modal below works through it in order
  // rather than only ever handling a single name.
  const [expansionRemovalQueue, setExpansionRemovalQueue] = useState([]);
  const [warning,             setWarning]             = useState(null); // Warning toast (e.g. monastery/abbot/abbey point cap)
  const [warningColor,        setWarningColor]        = useState('#C44040'); // Accent color for the toast above — red by default, green for neutral confirmations (e.g. "Game paused.")
  const [editMode, setEditMode] = useState(false); // Score log edit mode — reveals a delete icon on each entry
  const [pendingDeleteMoveIdx, setPendingDeleteMoveIdx] = useState(null); // moves[] index, or 'final-scoring', awaiting delete confirmation
  const logContainerRef  = useRef(null);
  const boardPopoutChRef = useRef(null);
  // Guided tour targets — index-matched to BOARD_TOUR_STEPS, see the
  // tour-target effect below. Step 0 spotlights .board-canvas (the image's
  // own tile-card, padding: 0 so its box is flush with the image) rather
  // than the <img> itself — .board-canvas is `overflow: hidden` (see
  // index.css), and overflow:hidden only clips a box's DESCENDANT content
  // that spills past it, not the box's own box-shadow, so putting
  // .tour-highlight on the img (a descendant) got clipped while putting it
  // on .board-canvas itself doesn't. This also means step 0 can just be a
  // plain conditional class like every other step, instead of the
  // rAF-tracked floating-overlay workaround a previous version of this used
  // (useTourHighlightRect) — that overlay's position came from React state
  // one frame behind the actual scroll position, reading as the spotlight
  // visibly lagging/jellying while scrolling; a real box-shadow on a real
  // element moves in the same paint as the scroll, with no lag at all.
  const boardImageRef      = useRef(null);
  const playersBoxRef      = useRef(null);
  const scoringControlsRef = useRef(null);
  const scoreLogRef        = useRef(null);
  const finishBtnRef       = useRef(null);

  // Edit mode auto-closes after 6s of inactivity, so a stray tap doesn't leave trash icons
  // exposed on the score log indefinitely.
  useEffect(() => {
    if (!editMode) return;
    const timer = setTimeout(() => setEditMode(false), 6000);
    return () => clearTimeout(timer);
  }, [editMode]);

  // Tell the parent this game's tour has been shown, so it isn't auto-shown again on
  // remount (tab switch) — but a genuinely new game gets a fresh auto-show.
  useEffect(() => {
    if (isGuest && autoShowHowTo) onHowToShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Docks the tour card beside whatever the current step is describing —
  // index-matched 1:1 to BOARD_TOUR_STEPS.
  useEffect(() => {
    if (tourStep === null) return;
    const targets = [boardImageRef, playersBoxRef, scoringControlsRef, scoreLogRef, finishBtnRef];
    targets[tourStep]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tourStep]);

  // Generate log from moves and undo events merged chronologically.
  // Memoized so its identity is stable across unrelated renders (e.g. the 1s `now` timer
  // tick below) — the log auto-scroll effect depends on this array, and without memoizing
  // it would force-scroll to the bottom every second, fighting manual scrolling in edit mode.
  const log = useMemo(() => (board && board.moves
    ? (() => {
        const entries = [];

        const track = board.trackLength || 50;
        const playerPositions = Object.fromEntries(players.map(p => [p, 0])); // Track positions as we replay
        const playerLaps = Object.fromEntries(players.map(p => [p, 0])); // Track laps as we replay

        // Replay moves to detect lap completions and add log entries
        for (let i = 0; i <= board.moveIndex; i++) {
          const move = board.moves[i];
          if (move) {
            // Add move entry
            const isGoodsMove = move.type?.startsWith('goods_');
            entries.push({
              type: isGoodsMove ? 'goods' : 'move',
              msg: isGoodsMove
                ? `${move.player} received ${move.label}`
                : `${move.player} scored +${move.amount} ${move.label}`,
              player: move.player,
              time: new Date(move.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              timestamp: move.timestamp,
              id: `move-${i}`,
              moveIdx: i, // back-reference into board.moves, used by the edit-mode delete button
            });

            // Check if this move completed a lap (skip for goods token moves)
            if (isGoodsMove) continue;
            const curPos = playerPositions[move.player] || 0;
            const curLaps = playerLaps[move.player] || 0;
            const sum = curPos + move.amount;
            const lapInc = Math.floor(sum / track);
            const newPos = ((sum % track) + track) % track;
            const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);

            playerPositions[move.player] = newPos;
            playerLaps[move.player] = newLaps;

            if (newLaps > curLaps) {
              entries.push({
                type: 'lap',
                msg: `${move.player} completed Lap ${newLaps}`,
                player: move.player,
                time: new Date(move.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                timestamp: move.timestamp + 1, // Slightly after move for ordering
                id: `lap-${i}-${newLaps}`,
              });
            }

            // Check if final scoring starts at this move
            if (board.finalScoringIndex === i + 1 && board.finalScoringTime) {
              entries.push({
                type: 'final-scoring',
                msg: 'Final scoring started',
                player: null,
                time: new Date(board.finalScoringTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                timestamp: board.finalScoringTime,
                id: `final-scoring-${i}`,
              });
            }
          }
        }

        // Add undo events
        if (board.undoLog && board.undoLog.length > 0) {
          board.undoLog.forEach((undo, idx) => {
            entries.push({
              type: 'undo',
              msg: `Undo: ${undo.player} → ${undo.amount} ${undo.label}`,
              player: undo.player,
              time: new Date(undo.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              timestamp: undo.timestamp,
              id: `undo-${idx}`,
            });
          });
        }

        // Sort by timestamp
        return entries.sort((a, b) => a.timestamp - b.timestamp);
      })()
    : []), [board, players]);


  // Deliberately NOT keyed on `players` — a genuinely new game gets a fresh
  // Board mount (key={gameKey} in App.jsx), so this only needs to run once
  // per mount. Re-running it whenever the in-game settings modal edits
  // session.players would re-fetch against the OLD persisted player list,
  // which (since it no longer matches) wipes the board back to a blank
  // state — see getBoard's player-list validation in boardStorage.js.
  useEffect(() => {
    setBoard(null); // Clear old board before loading new one
    getBoard(userId, players, isGuest).then(b => {
      setBoard(b);
      // Restore finishStep from persisted board state so navigating away and back
      // doesn't require clicking Final Scoring again
      if (b?.finalScoringIndex !== null && b?.finalScoringIndex !== undefined) {
        setFinishStep(1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isGuest]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (board) saveBoard(board, userId, isGuest); }, [board, userId, isGuest]);

  // Board pop-out channel
  useEffect(() => {
    const ch = new BroadcastChannel('carcasonne-board');
    boardPopoutChRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data.type === 'REQUEST_STATE') broadcastBoard(ch);
    };
    return () => { ch.close(); boardPopoutChRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (board && boardPopoutChRef.current) broadcastBoard(boardPopoutChRef.current);
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // Clear any highlighted score type/goods token/player when the scoring phase changes,
  // since the buttons available (e.g. Inn/Cathedral) differ between phases.
  useEffect(() => {
    setSelectedType(null);
    setSelectedGoods(new Set());
    setSelectedPlayer(null);
  }, [finishStep]);

  // Recalculate board state from moves when moveIndex changes (for undo/redo/delete).
  // No `moves.length === 0` short-circuit — deleting every move must still rebuild down
  // to an all-zero state instead of leaving stale totals behind.
  useEffect(() => {
    if (!board) return;

    // Rebuild board state from moves[0..moveIndex]
    const rebuilt = {
      ...board,
      positions:   Object.fromEntries(players.map(p => [p, 0])),
      laps:        Object.fromEntries(players.map(p => [p, 0])),
      scoreTotals: Object.fromEntries(players.map(p => [p, { road: 0, city: 0, monastery: 0, field: 0 }])),
      goodsTokens: Object.fromEntries(players.map(p => [p, { wine: 0, grain: 0, cloth: 0 }])),
      maxFeatures: {},
    };

    for (let i = 0; i <= board.moveIndex; i++) {
      const move = board.moves[i];
      if (!move) continue;

      // Goods token moves carry no score — just update the token tally
      if (move.type === 'goods_wine' || move.type === 'goods_grain' || move.type === 'goods_cloth') {
        const good = move.type.replace('goods_', '');
        rebuilt.goodsTokens[move.player][good] = (rebuilt.goodsTokens[move.player][good] || 0) + 1;
        continue;
      }

      const curPos  = rebuilt.positions[move.player] || 0;
      const curLaps = rebuilt.laps[move.player] || 0;
      const sum     = curPos + move.amount;
      const lapInc  = Math.floor(sum / track);
      const newPos  = ((sum % track) + track) % track;
      const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);

      rebuilt.positions[move.player]                     = newPos;
      rebuilt.laps[move.player]                          = newLaps;
      rebuilt.scoreTotals[move.player][move.type]        = (rebuilt.scoreTotals[move.player][move.type] || 0) + move.amount;

      // Rebuild maxFeatures: skip monastery/abbot/abbey from generic path
      const skipRecord = LIVE_PLAY_ONLY_RECORD_TYPES.includes(move.type) && move.inFinalScoring;
      if (move.amount > 0 && !MONASTERY_RECORD_TYPES.includes(move.type) && !skipRecord) {
        const cur = rebuilt.maxFeatures[move.type] || { amount: 0, player: null };
        if (move.amount > cur.amount) rebuilt.maxFeatures[move.type] = { amount: move.amount, player: move.player };
      }
      // Rebuild monastery completion count
      if (MONASTERY_RECORD_TYPES.includes(move.type) && move.amount === 9 && !move.inFinalScoring) {
        const counts = rebuilt.maxFeatures._monasteryCounts || {};
        counts[move.player] = (counts[move.player] || 0) + 1;
        rebuilt.maxFeatures._monasteryCounts = counts;
        let topCount = 0, topPlayer = null;
        Object.entries(counts).forEach(([p, c]) => { if (c > topCount) { topCount = c; topPlayer = p; } });
        rebuilt.maxFeatures.monastery = { amount: topCount, player: topPlayer };
      }
    }

    setBoard(rebuilt);
  }, [board?.moveIndex, board?.moves.length]);

  // ArrowLeft mirrors the "back" shortcut PreGameSetup uses (see its own
  // keydown effect) and now the chest icon's own click too — despite board
  // state being saved as it goes (see boardStorage), there's no way back
  // into THIS game once you leave (reopening the chest always re-runs
  // PreGameSetup, which resets the board), so leaving mid-game is
  // effectively as destructive as Reset and gets the same confirmation.
  // Skipped while any modal is already open (so it doesn't fight whichever
  // one's up) or focus is in a field/button (typing, native Enter/Space
  // handling).
  //
  // Declared up here with the rest of the hooks — not further down, where
  // it used to sit next to handleReset — because everything below this
  // point is behind an early `if (!board) return null`, and a hook
  // declared past an early return gets skipped on whatever render hits
  // that return, then called again once `board` loads and the return no
  // longer fires. That's a straight-up Rules-of-Hooks violation (hook
  // count changes between renders of the same instance) and crashes the
  // whole board the moment `board` finishes loading.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;
      if (confirmFinish || confirmReset || confirmExit || pendingDeleteMoveIdx !== null || showTraders || tourStep !== null) return;
      setConfirmExit(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmFinish, confirmReset, confirmExit, pendingDeleteMoveIdx, showTraders, tourStep]);

  if (!board) return null;

  // Fixed-width display for the stadium-clock (.game-clock below): MM:SS
  // under an hour; once a game runs that long, seconds aren't interesting
  // anymore, so it switches to H:MM instead of growing to H:MM:SS.
  function formatElapsed(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  // Frozen at whatever it read the instant Pause was hit (board.pausedAt),
  // rather than continuing to tick with `now`, while paused — resuming
  // folds the paused span into board.startTime (see handleTogglePause)
  // instead of tracking pause duration separately, so this same formula,
  // and every other `X - board.startTime` computation in this file
  // (gameDuration at finish, score-timeline offsets), stays correct with no
  // other changes needed once that fold-in happens.
  const elapsed = formatElapsed((board.paused ? board.pausedAt : now) - (board.startTime || now));

  const track = board.trackLength || 50;
  const hasTB    = (session?.expansions || []).includes('Traders & Builders');
  const hasIC    = (session?.expansions || []).some(e => e === 'Inns & Cathedrals' || e === 'Bridges, Castles & Bazaars');
  const hasAM    = (session?.expansions || []).includes('Abbey & Mayor');
  const hasAbbot = (session?.expansions || []).includes('The Abbot');

  const goodsRemaining = hasTB
    ? Object.fromEntries(['wine', 'grain', 'cloth'].map(good => [
        good,
        GOODS_SUPPLY[good] - players.reduce((sum, p) => sum + (board.goodsTokens?.[p]?.[good] || 0), 0),
      ]))
    : {};

  /**
   * ADD MOVE TO HISTORY
   *
   * Records a move (score adjustment) in the moves array.
   * Truncates future moves if undo happened before this new move.
   */
  function addMove(player, type, amount, label) {
    setBoard(prev => {
      const newMoves = prev.moves.slice(0, prev.moveIndex + 1); // Truncate redo stack
      newMoves.push({
        player,
        type,
        amount,
        label,
        timestamp: Date.now(),
        inFinalScoring: prev.finalScoringIndex !== null,
      });
      return {
        ...prev,
        moves: newMoves,
        moveIndex: newMoves.length - 1,
      };
    });
  }

  /**
   * EDIT / DELETE SYSTEM
   *
   * Permanently removes an arbitrary historical entry from board.moves (not just the most
   * recent one), then lets moveIndex/finalScoringIndex point at the same logical position
   * they did before — the replay effect below recomputes positions/laps/scoreTotals/
   * goodsTokens/maxFeatures from scratch from the shortened moves array.
   */
  function deleteMoveAt(i) {
    setBoard(prev => {
      const moves = prev.moves.filter((_, idx) => idx !== i);
      const moveIndex = i <= prev.moveIndex ? prev.moveIndex - 1 : prev.moveIndex;
      const finalScoringIndex = prev.finalScoringIndex !== null && i < prev.finalScoringIndex
        ? prev.finalScoringIndex - 1
        : prev.finalScoringIndex;
      return { ...prev, moves, moveIndex, finalScoringIndex };
    });
  }

  /**
   * CARCASSONNE SCORING SYSTEM
   * 
   * Manages the 50-point circular track with lap-based overflow.
   * 
   * Track mechanics:
   * - 50 positions (0-49) representing score values
   * - When score exceeds 49, increment lap counter and wrap position
   * - Total score = (laps × 50) + position
   * - Negative scores handled gracefully (stay at 0)
   * 
   * Score categories:
   * - Base: road, city, monastery, field  
   * - Expansions: inn, cathedral, pig, wine, grain, cloth, barn, wagon
   * 
   * @param {string} player - Player name to award points to
   * @param {number} delta - Points to add (can be negative)
   * @param {string} type - Scoring category for breakdown tracking
   */
  function addPoints(player, delta, type = 'road') {
    delta = Number(delta) || 0;
    if (delta === 0) return; // Ignore zero-point changes

    // Current position calculation
    const curPos  = board.positions[player] || 0;
    const curLaps = board.laps[player] || 0;

    // New position with track wrapping
    const sum     = curPos + delta;
    const lapInc  = Math.floor(sum / track); // How many complete laps to add
    const newPos  = ((sum % track) + track) % track; // Modulo with negative handling
    const newLaps = curLaps + (lapInc > 0 ? lapInc : 0); // Prevent negative laps

    // Generate human-readable category names for logging
    const label = type === 'pig' ? 'Field (Pig)' :
                  type === 'inn' ? 'Road (Inn)' :
                  type === 'cathedral' ? 'City (Cathedral)' :
                  type.charAt(0).toUpperCase() + type.slice(1);

    // Add move to history
    addMove(player, type, delta, label);

    // Update score breakdown by category and track max features
    setBoard(b => {
      const prevBreakdown = b.scoreTotals?.[player] || { road: 0, city: 0, monastery: 0, field: 0 };
      const maxFeatures = { ...b.maxFeatures };
      const inFinalScoring = b.finalScoringIndex !== null;
      const skipRecord = LIVE_PLAY_ONLY_RECORD_TYPES.includes(type) && inFinalScoring;

      // Check if this feature is the largest of its type (monastery/abbot/abbey tracked separately by count)
      if (delta > 0 && !MONASTERY_RECORD_TYPES.includes(type) && !skipRecord) {
        const currentMaxFeature = maxFeatures[type] || { amount: 0, player: null };
        if (delta > currentMaxFeature.amount) {
          maxFeatures[type] = { amount: delta, player };
        }
      }

      // Count full monastery completions (monastery, abbot, or abbey scoring exactly 9)
      if (MONASTERY_RECORD_TYPES.includes(type) && delta === 9 && !inFinalScoring) {
        const counts = { ...(maxFeatures._monasteryCounts || {}) };
        counts[player] = (counts[player] || 0) + 1;
        maxFeatures._monasteryCounts = counts;
        let topCount = 0, topPlayer = null;
        Object.entries(counts).forEach(([p, c]) => { if (c > topCount) { topCount = c; topPlayer = p; } });
        maxFeatures.monastery = { amount: topCount, player: topPlayer };
      }

      return {
        ...b,
        positions:   { ...b.positions, [player]: newPos  },
        laps:        { ...b.laps,      [player]: newLaps },
        scoreTotals: {
          ...b.scoreTotals,
          [player]: { ...prevBreakdown, [type]: (prevBreakdown[type] || 0) + delta },
        },
        maxFeatures,
      };
    });
  }

  function showWarning(msg, color = '#C44040') {
    setWarning(msg);
    setWarningColor(color);
    setTimeout(() => setWarning(null), 2500);
  }

  function zeroInput() {
    setInput(Object.fromEntries(players.map(p => [p, 0])));
  }

  function exceedsMonasteryCap(type, delta) {
    return MONASTERY_LIKE_TYPES.includes(type) && Math.abs(Number(delta)) > MONASTERY_LIKE_MAX;
  }

  // Reset the points input and warn that `type` is capped, since it just got blocked.
  function warnCapExceeded(type) {
    zeroInput();
    showWarning(`${type.charAt(0).toUpperCase() + type.slice(1)} can only score up to ${MONASTERY_LIKE_MAX} points`);
  }

  // Update the points input; if a monastery-like type is currently highlighted
  // and the new value exceeds its cap, un-highlight it and warn.
  function updatePoints(newVal) {
    if (tourStep !== null) return; // Guided tour is purely a walkthrough — nothing scores while it's open.
    if (selectedType && exceedsMonasteryCap(selectedType, newVal)) {
      setSelectedType(null);
      warnCapExceeded(selectedType);
      return;
    }
    setInput(Object.fromEntries(players.map(p => [p, String(newVal)])));
  }

  // Award points of `type` to `player` using the current input value, respecting the
  // monastery/abbot/abbey cap.
  function commitScore(player, type) {
    const delta = Object.values(input)[0] || 0;
    if (!delta || Number(delta) === 0) return; // nothing to commit; leave the current selection as-is

    if (exceedsMonasteryCap(type, delta)) {
      warnCapExceeded(type);
      return;
    }

    addPoints(player, delta, type);
    if (Number(delta) > 0) playScoreSound(type); // no sound on a negative correction
    zeroInput();
    setSelectedType(null);
    setSelectedPlayer(null);
  }

  // Highlight a score type; clicking a player next commits the current points to them.
  // If a player is already highlighted (clicked first), commit to them immediately instead.
  function selectType(type) {
    if (tourStep !== null) return; // Guided tour is purely a walkthrough — nothing scores while it's open.
    if (selectedPlayer) {
      const delta = Object.values(input)[0] || 0;
      if (!delta || Number(delta) === 0) {
        // No points yet — swap the highlight to this type instead of doing nothing
        setSelectedPlayer(null);
        setSelectedGoods(new Set());
        setSelectedType(type);
        return;
      }
      commitScore(selectedPlayer, type);
      return;
    }

    const delta = Object.values(input)[0] || 0;
    const turningOn = selectedType !== type;
    if (turningOn && exceedsMonasteryCap(type, delta)) {
      warnCapExceeded(type);
      return;
    }
    setSelectedGoods(new Set());
    setSelectedType(prev => (prev === type ? null : type));
  }

  // Highlight a goods token; several can be picked at once (e.g. one of each good).
  // If a player is already highlighted (clicked first), award just this one token immediately instead.
  function selectGood(good) {
    if (tourStep !== null) return; // Guided tour is purely a walkthrough — nothing scores while it's open.
    if (selectedPlayer) {
      const player = selectedPlayer;
      setSelectedPlayer(null);
      addMove(player, `goods_${good}`, 0, `${GOODS_LABELS[good]} Token`);
      playScoreSound('goods');
      return;
    }
    setSelectedType(null);
    setSelectedGoods(prev => {
      const next = new Set(prev);
      next.has(good) ? next.delete(good) : next.add(good);
      return next;
    });
  }

  // Commit the currently-highlighted score type or goods token(s) to a single player.
  // If nothing is highlighted yet, highlight this player instead, awaiting a type/good click.
  function commitToPlayer(player) {
    if (tourStep !== null) return; // Guided tour is purely a walkthrough — nothing scores while it's open.
    if (selectedGoods.size > 0) {
      selectedGoods.forEach(good => {
        addMove(player, `goods_${good}`, 0, `${GOODS_LABELS[good]} Token`);
        playScoreSound('goods');
      });
      setSelectedGoods(new Set());
      return;
    }

    if (selectedType) {
      const delta = Object.values(input)[0] || 0;
      if (!delta || Number(delta) === 0) {
        // No points yet — swap the highlight to this player instead of doing nothing
        setSelectedType(null);
        setSelectedPlayer(player);
        return;
      }
      commitScore(player, selectedType);
      return;
    }

    setSelectedPlayer(prev => (prev === player ? null : player));
  }

  function handleReset() {
    setConfirmReset(true); // Show confirmation modal
  }

  // Guided tour ("?" button, see BOARD_TOUR_STEPS/BoardTourModal in
  // HowToGuide.jsx) — a plain step counter, purely a walkthrough (every
  // scoring interaction below no-ops while this is open). "Next" on the
  // last step still calls advanceTour, same as ProfileHowToModal's "Got
  // it!" — stepping past the last index just closes the tour.
  const startTour = () => setTourStep(0);
  const advanceTour = () => setTourStep(prev => {
    if (prev === null) return null;
    const next = prev + 1;
    return next >= BOARD_TOUR_STEPS.length ? null : next;
  });
  const backTour = () => setTourStep(prev => (prev && prev > 0 ? prev - 1 : prev));
  const closeTour = () => setTourStep(null);

  async function confirmResetBoard() {
    setConfirmReset(false);
    // Keeps the same expansions' scoring categories (goods tokens, extra
    // track types, etc.) — same players/meeples/expansions as the game
    // being reset, only scores/moves go back to zero. Awaited so onReset's
    // remount (see App.jsx's handleBoardReset) always re-fetches the
    // freshly-reset board_state, not whatever was there a moment before.
    const extraTypes = (session?.expansions || []).flatMap(e => EXPANSION_TYPES[e] || []);
    await resetBoard(userId, players, extraTypes, isGuest);
    onReset();
  }

  // Pause only stops the CLOCK — scoring/undo/everything else keeps
  // working normally while paused, this just stops that time from
  // counting. Resuming folds the just-finished pause's duration straight
  // into board.startTime (pushing it later by however long the pause
  // lasted) rather than tracking accumulated pause time as its own field —
  // every place that already computes elapsed/duration as `X -
  // board.startTime` (the live clock above, gameDuration and the score
  // timeline's per-event offsets in confirmFinishGame below) stays correct
  // for free once startTime absorbs the gap, with nothing else to update.
  // `silent` skips the toast — used by handleCloseSettings below, which
  // shows its own (red, this-is-a-side-effect) toast for its implicit
  // resume instead of this plain green pause/resume one.
  function handleTogglePause(silent = false) {
    if (!silent) showWarning(board.paused ? 'Game resumed.' : 'Game paused.', 'var(--forest-green)');
    setBoard(prev => {
      if (prev.paused) {
        const pausedMs = Date.now() - prev.pausedAt;
        return { ...prev, paused: false, pausedAt: null, startTime: prev.startTime + pausedMs };
      }
      return { ...prev, paused: true, pausedAt: Date.now() };
    });
  }

  // Settings is the only place Pause is reachable, so leaving it paused —
  // whichever way that happens, the Close button or clicking the overlay
  // (BoardSettingsModal calls this same onClose for both) — would leave the
  // clock silently frozen on the board with no way back in except opening
  // Settings again. Auto-resuming on close means that state can never
  // actually happen: the only way to have the game paused is to currently
  // be looking at Settings. Surfaced as a heads-up toast (same showWarning
  // used elsewhere in this file) rather than a blocking confirmation, since
  // it's not something worth an extra click to approve — just worth
  // knowing happened.
  function handleCloseSettings() {
    if (board.paused) {
      handleTogglePause(true);
      showWarning('Game resumed.');
    }
    setShowSettings(false);
  }

  function handleExitToHub() {
    setConfirmExit(true); // Show confirmation modal
  }

  /**
   * IN-GAME SETTINGS — players / meeples / expansions
   *
   * Reached from the Settings button (BoardSettingsModal). Every edit here
   * applies immediately, no separate Save step, so the scoring buttons
   * below (hasTB/hasIC/hasAM/hasAbbot) react live as the user toggles
   * things. session.players/meeples/expansions are pushed up via
   * onSessionUpdate; `board`'s own per-player tracking (positions/laps/
   * scoreTotals/goodsTokens/moves) is patched here directly.
   */

  function playerHasPoints(name) {
    return (board.moves || []).some(m => m.player === name);
  }

  function expansionHasPoints(name) {
    const types = EXPANSION_MOVE_TYPES[name];
    return !!types && (board.moves || []).some(m => types.includes(m.type));
  }

  // Bulk-remove every move matching `predicate`, then re-derive moveIndex/
  // finalScoringIndex against the shorter array — same approach as
  // deleteMoveAt, generalized to more than one entry. The positions/laps/
  // scoreTotals/goodsTokens/maxFeatures rebuild effect (keyed on
  // moveIndex/moves.length, above) picks up the recompute automatically.
  function removeMovesWhere(predicate) {
    setBoard(prev => {
      const keep = prev.moves.map(m => !predicate(m));
      const moves = prev.moves.filter((_, i) => keep[i]);
      let moveIndex = -1;
      for (let i = 0; i <= prev.moveIndex && i < prev.moves.length; i++) if (keep[i]) moveIndex++;
      let finalScoringIndex = prev.finalScoringIndex;
      if (finalScoringIndex !== null) {
        let count = 0;
        for (let i = 0; i < finalScoringIndex && i < prev.moves.length; i++) if (keep[i]) count++;
        finalScoringIndex = count;
      }
      return { ...prev, moves, moveIndex, finalScoringIndex };
    });
  }

  function addPlayerToGame(name) {
    const newPlayers = [...players, name];
    // Re-added player keeps whatever meeple they had before; a genuinely new
    // one gets the first standard color nobody currently active is using.
    const standardKeys = Object.keys(MEEPLE_IMGS).filter(k => !k.startsWith('fun/'));
    const usedMeeples = new Set(players.map(p => meepleMap[p]).filter(Boolean));
    const assignedMeeple = meepleMap[name] || standardKeys.find(k => !usedMeeples.has(k)) || standardKeys[0];
    setBoard(prev => ({
      ...prev,
      players: newPlayers,
      positions:   { ...prev.positions,   [name]: 0 },
      laps:        { ...prev.laps,        [name]: 0 },
      scoreTotals: { ...prev.scoreTotals, [name]: { road: 0, city: 0, monastery: 0, field: 0 } },
      goodsTokens: { ...prev.goodsTokens, [name]: { wine: 0, grain: 0, cloth: 0 } },
    }));
    onSessionUpdate({ players: newPlayers, meeples: { ...meepleMap, [name]: assignedMeeple } });
  }

  function removePlayerFromGame(name) {
    const newPlayers = players.filter(p => p !== name);
    removeMovesWhere(m => m.player === name);
    setBoard(prev => {
      const positions   = { ...prev.positions };   delete positions[name];
      const laps        = { ...prev.laps };        delete laps[name];
      const scoreTotals = { ...prev.scoreTotals }; delete scoreTotals[name];
      const goodsTokens = { ...prev.goodsTokens }; delete goodsTokens[name];
      return { ...prev, players: newPlayers, positions, laps, scoreTotals, goodsTokens };
    });
    onSessionUpdate({ players: newPlayers });
    if (selectedPlayer === name) setSelectedPlayer(null);
  }

  // Toggle roster membership for THIS game. Min 2 / max MAX_GAME_PLAYERS
  // enforced here (the modal also disables the chip, this is the real gate).
  // Removing someone with recorded points routes through a confirm modal
  // instead of acting immediately (see pendingPlayerRemoval).
  function handleTogglePlayer(name) {
    if (players.includes(name)) {
      if (players.length <= 2) return;
      if (playerHasPoints(name)) { setPendingPlayerRemoval(name); return; }
      removePlayerFromGame(name);
    } else {
      if (players.length >= MAX_GAME_PLAYERS) return;
      addPlayerToGame(name);
    }
  }

  // Commits the settings modal's Meeples Save in one go — conflict
  // validation happens locally in the modal as each tile is picked (see
  // BoardSettingsModal's handlePickMeeple), so by the time this runs
  // `newMap` is already a validated, complete replacement.
  function handleSaveMeeples(newMap) {
    onSessionUpdate({ meeples: newMap });
  }

  function removeExpansion(name, alsoRemovePoints) {
    const newExpansions = (session?.expansions || []).filter(e => e !== name);
    if (alsoRemovePoints) {
      const types = EXPANSION_MOVE_TYPES[name] || [];
      removeMovesWhere(m => types.includes(m.type));
      if (selectedType && types.includes(selectedType)) setSelectedType(null);
    }
    onSessionUpdate({ expansions: newExpansions });
  }

  // Applies the settings modal's Expansions Save in one go: additions and
  // removals with no recorded points land immediately in a single session
  // update; any removal that DOES have recorded points instead routes
  // through the keep/remove-points confirm modal (queued — see
  // expansionRemovalQueue) rather than acting immediately, same as before,
  // just batched across everything toggled in that view instead of one
  // click at a time.
  function handleSaveExpansions(newSet) {
    const current = session?.expansions || [];
    const added = newSet.filter(n => !current.includes(n));
    const removed = current.filter(n => !newSet.includes(n));
    const removedWithPoints = removed.filter(expansionHasPoints);
    const removedClean = removed.filter(n => !expansionHasPoints(n));
    onSessionUpdate({ expansions: current.filter(n => !removedClean.includes(n)).concat(added) });
    if (removedWithPoints.length > 0) setExpansionRemovalQueue(removedWithPoints);
  }
  // Keep Points / Remove Points — resolves the front of the queue and moves
  // to the next pending expansion, if any.
  function resolveExpansionRemoval(alsoRemovePoints) {
    removeExpansion(expansionRemovalQueue[0], alsoRemovePoints);
    setExpansionRemovalQueue(q => q.slice(1));
  }
  // Cancel (or dismiss) — leaves this one expansion active/untouched and
  // moves on to the next queued one, rather than aborting the whole batch.
  function cancelExpansionRemoval() {
    setExpansionRemovalQueue(q => q.slice(1));
  }

  function confirmExitToHub() {
    setConfirmExit(false);
    onExitToHub?.();
  }

  function handleFinish() {
    setConfirmFinish(true); // Show confirmation modal
  }

  function confirmInitialScoring() {
    setLeadersAtFinish(leaders);
    setBoard(prev => ({ ...prev, finalScoringIndex: prev.moveIndex + 1, finalScoringTime: Date.now() }));
    if (hasTB) setShowTraders(true);
    else setFinishStep(1);
  }

  function confirmFinishGame() {
    setConfirmFinish(false);

    const finalScores    = Object.fromEntries(
      players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)])
    );
    const scoreBreakdown = board.scoreTotals || {};
    const { winners: finalWinners } = computeWinners(finalScores);
    // Farm win: a single winner who was NOT leading when Final Scoring was first pressed
    const autoFarmWin    = finalWinners.length === 1 && !leadersAtFinish.includes(finalWinners[0]);

    // Set endTime and calculate duration — resuming normally folds a
    // pause's duration into board.startTime already (see
    // handleTogglePause), so this is only ever non-zero for the edge case
    // of finishing the game while still mid-pause (never resumed).
    const endTime = Date.now();
    const stillPausedMs = board.paused ? (endTime - board.pausedAt) : 0;
    const gameDuration = endTime - board.startTime - stillPausedMs;

    // Score timeline: every scoring move with its elapsed-time offset from game start,
    // truncated at moveIndex so undone moves are excluded. inFinalScoring rides along so
    // ScoreTimelineChart can anchor a record badge to the actual completed-feature event
    // that earned it, not a later, bigger-but-incomplete one scored after Final Scoring
    // (see LIVE_PLAY_ONLY_RECORD_TYPES/skipRecord above — same rule, same reason).
    const scoreTimeline = board.moves.slice(0, board.moveIndex + 1)
      .filter(m => m.amount !== 0 && m.timestamp)
      .map(m => ({ player: m.player, type: m.type, amount: m.amount, t: Math.max(0, m.timestamp - board.startTime), inFinalScoring: !!m.inFinalScoring }));
    // A player-less marker (no `player`/`amount`) for when Final Scoring was
    // pressed — ScoreTimelineChart draws a vertical reference line at it and
    // otherwise ignores it (it can't match any player's cumulative total).
    // Stored right alongside the real events since score_timeline is a plain
    // JSON column (see data/storage.js) — no schema change needed, and
    // older saved games simply have no marker, so no line renders for them.
    if (board.finalScoringTime) {
      scoreTimeline.push({ type: 'final-scoring', t: Math.max(0, board.finalScoringTime - board.startTime) });
    }

    // Update board with endTime and save it BEFORE resetting
    const updatedBoard = { ...board, endTime };
    saveBoard(updatedBoard, userId, isGuest);

    // Compute Master Merchant: player who earned points in all 3 goods (tied-for-first counts)
    const goodsTokens = board.goodsTokens || {};
    const goodsWinnerSets = ['wine', 'grain', 'cloth'].map(good => {
      const max = Math.max(...players.map(p => goodsTokens[p]?.[good] || 0));
      if (max === 0) return new Set();
      return new Set(players.filter(p => (goodsTokens[p]?.[good] || 0) >= max));
    });
    const merchantCandidates = players.filter(p => goodsWinnerSets.every(s => s.has(p)));
    const finalMaxFeatures = { ...board.maxFeatures };
    const goodsTotal = (p) => ['wine', 'grain', 'cloth'].reduce((s, g) => s + (goodsTokens[p]?.[g] || 0), 0);
    if (merchantCandidates.length > 0) {
      // Someone (or a tie) dominated all 3 goods types — award to whoever of them has the most total goods.
      const merchant = merchantCandidates.reduce((best, p) => goodsTotal(p) > goodsTotal(best) ? p : best);
      finalMaxFeatures.bestTrader = { amount: goodsTotal(merchant), player: merchant };
    } else {
      // No one led in all 3 — fall back to whoever collected the most goods overall.
      const merchant = players.reduce((best, p) => goodsTotal(p) > goodsTotal(best) ? p : best);
      if (goodsTotal(merchant) > 0) {
        finalMaxFeatures.bestTrader = { amount: goodsTotal(merchant), player: merchant };
      }
    }

    boardPopoutChRef.current?.postMessage({ type: 'GAME_OVER' });
    resetBoard(userId, players, [], isGuest);
    onFinish(finalScores, scoreBreakdown, autoFarmWin, gameDuration, finalMaxFeatures, scoreTimeline);
  }

  function applyHarvestBonuses() {
    for (const good of ['wine', 'grain', 'cloth']) {
      const counts = players.map(p => ({ p, count: board.goodsTokens?.[p]?.[good] || 0 }));
      const maxCount = Math.max(...counts.map(c => c.count));
      if (maxCount === 0) continue;
      const winners = counts.filter(c => c.count === maxCount).map(c => c.p);
      for (const p of winners) {
        addMove(p, good, 10, GOODS_LABELS[good]);
      }
    }
    setShowTraders(false);
    setFinishStep(1);
  }

  function broadcastBoard(ch) {
    if (!board) return;
    ch.postMessage({ type: 'BOARD_UPDATE', payload: { board, players, meepleMap } });
  }

  // Current leader(s) by total score — badges the leading player's meeple
  // in the Players panel below (see leaderIcon) instead of a "X leads" pill.
  const totals  = Object.fromEntries(players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)]));
  const maxTotal = Math.max(...Object.values(totals), 0);
  const leaders  = maxTotal > 0 ? players.filter(p => totals[p] === maxTotal) : [];

  // Group players by position for collision offsets
  const posGroups = {};
  players.forEach(p => {
    const pos = board.positions[p] || 0;
    if (!posGroups[pos]) posGroups[pos] = [];
    posGroups[pos].push(p);
  });

  // Finish game confirmation modal
  const finishModal = confirmFinish && (
    <div className="realm-modal-overlay" onClick={() => setConfirmFinish(false)}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.5rem' }}>Are you sure?</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          You're about to end the game and save final scores.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmFinish(false)}>Cancel</button>
          <button className="btn btn-sm" onClick={confirmFinishGame}>Finish Game</button>
        </div>
      </div>
    </div>
  );

  // Reset board confirmation modal
  const resetModal = confirmReset && (
    <div className="realm-modal-overlay" onClick={() => setConfirmReset(false)}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Reset the board?</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          This will clear all scores and start a new game.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={confirmResetBoard}>Reset</button>
        </div>
      </div>
    </div>
  );

  // Back-to-hub confirmation modal — reopening the chest always re-runs
  // PreGameSetup, which resets the board, so leaving mid-game is as
  // destructive as the Reset button and gets the same treatment.
  const exitModal = confirmExit && (
    <div className="realm-modal-overlay" onClick={() => setConfirmExit(false)}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          Leaving will reset current game.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmExit(false)}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={confirmExitToHub}>Back to realms</button>
        </div>
      </div>
    </div>
  );

  // Confirm removing a player who already has points recorded this game
  const playerRemovalModal = pendingPlayerRemoval && (
    <div className="realm-modal-overlay" onClick={() => setPendingPlayerRemoval(null)}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Remove {pendingPlayerRemoval}?</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          {pendingPlayerRemoval} has points recorded this game. Removing them will delete their score history for this game.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPendingPlayerRemoval(null)}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={() => { removePlayerFromGame(pendingPlayerRemoval); setPendingPlayerRemoval(null); }}>Remove</button>
        </div>
      </div>
    </div>
  );

  // Confirm turning off an expansion that already has points recorded this
  // game — shown after the settings modal's Save (see handleSaveExpansions),
  // working through expansionRemovalQueue one name at a time.
  const expansionRemovalModal = expansionRemovalQueue.length > 0 && (
    <div className="realm-modal-overlay" onClick={cancelExpansionRemoval}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.5rem' }}>{expansionRemovalQueue[0]} has recorded points</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          Points from this expansion have already been scored this game. Keep them in the score log, or remove them along with the expansion?
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={cancelExpansionRemoval}>Cancel</button>
          <button className="btn btn-sm" onClick={() => resolveExpansionRemoval(false)}>Keep Points</button>
          <button className="btn btn-danger btn-sm" onClick={() => resolveExpansionRemoval(true)}>Remove Points</button>
        </div>
      </div>
    </div>
  );

  // Confirms whatever entry is pending deletion — either a regular moves[] index, or the
  // special 'final-scoring' sentinel (trashing the divider undoes Final Scoring and returns
  // to live play, same as the old undo system's "exit final scoring" branch).
  function confirmDeleteEntry() {
    if (pendingDeleteMoveIdx === 'final-scoring') {
      setFinishStep(0);
      setBoard(prev => ({ ...prev, finalScoringIndex: null, finalScoringTime: null }));
    } else {
      deleteMoveAt(pendingDeleteMoveIdx);
    }
    setPendingDeleteMoveIdx(null);
    setEditMode(false); // one deletion at a time — back to the normal log view
  }

  // Dismisses the confirm modal without deleting anything — also exits edit mode, so
  // cancelling always lands back on the normal (non-editing) log view.
  function cancelDeleteEntry() {
    setPendingDeleteMoveIdx(null);
    setEditMode(false);
  }

  // Delete score-log entry confirmation modal (edit mode)
  const deleteMoveModal = pendingDeleteMoveIdx !== null && (
    <div className="realm-modal-overlay" onClick={cancelDeleteEntry}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
        <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
          {pendingDeleteMoveIdx === 'final-scoring'
            ? 'This will undo Final Scoring and return to live play.'
            : 'Are you sure you want to delete the points?'}
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={cancelDeleteEntry}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={confirmDeleteEntry}>Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Finish game confirmation modal */}
      {finishModal}

      {/* Reset board confirmation modal */}
      {resetModal}

      {/* Back-to-hub confirmation modal */}
      {exitModal}

      {/* Delete score-log entry confirmation modal */}
      {deleteMoveModal}

      {/* In-game settings — players / meeples / expansions / reset */}
      {showSettings && (
        <BoardSettingsModal
          realm={session?.realm}
          players={players}
          meepleMap={meepleMap}
          expansions={session?.expansions || []}
          ownedExpansions={ownedExpansions}
          onTogglePlayer={handleTogglePlayer}
          onSaveMeeples={handleSaveMeeples}
          onSaveExpansions={handleSaveExpansions}
          onResetGame={handleReset}
          paused={board.paused}
          onTogglePause={handleTogglePause}
          onClose={handleCloseSettings}
        />
      )}
      {playerRemovalModal}
      {expansionRemovalModal}

      {/* Traders & Builders — Harvest dialog */}
      {showTraders && (
        <div className="lightbox-overlay">
          <div className="lightbox-inner" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="lightbox-meta">
              <div className="tile-card-header" style={{ marginBottom: '0.25rem' }}>Traders &amp; Builders</div>
              <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--stone-gray)', marginBottom: '1rem' }}>
                The top trader of each good earns 10 pts.
              </p>
              {['wine', 'grain', 'cloth'].map(good => {
                const counts  = players.map(p => ({ p, count: board.goodsTokens?.[p]?.[good] || 0 }));
                const maxCount = Math.max(...counts.map(c => c.count));
                const winners  = maxCount > 0 ? counts.filter(c => c.count === maxCount).map(c => c.p) : [];
                return (
                  <div key={good} style={{ marginBottom: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      {GOODS_IMGS[good] && (
                        <img src={GOODS_IMGS[good]} alt={good} style={{ height: 18, width: 'auto' }} />
                      )}
                      <span style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)' }}>
                        {good.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {players.map(p => {
                        const count     = board.goodsTokens?.[p]?.[good] || 0;
                        const isWinner  = winners.includes(p);
                        return (
                          <div
                            key={p}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-tile)',
                              fontSize: '0.8rem',
                              fontFamily: 'Cinzel, serif',
                              fontWeight: 600,
                              userSelect: 'none',
                              opacity: count === 0 ? 0.45 : 1,
                              background: isWinner ? 'var(--warm-gold)' : 'transparent',
                              border: isWinner ? '1.5px solid var(--warm-gold)' : 'var(--border-tile)',
                              color: isWinner ? 'var(--earth-brown)' : 'var(--stone-gray)',
                            }}
                          >
                            {p}
                            {count > 0 && (
                              <span style={{ marginLeft: '0.3rem', opacity: 0.75, fontSize: '0.75em' }}>×{count}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn" onClick={applyHarvestBonuses}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tourStep !== null && (
        <BoardTourModal
          step={tourStep}
          onNext={advanceTour}
          onBack={backTour}
          onClose={closeTour}
          targetRef={[boardImageRef, playersBoxRef, scoringControlsRef, scoreLogRef, finishBtnRef][tourStep]}
        />
      )}

      {/* tour-inert: while the tour is open, only the one spotlighted
          section below should be clickable — kept as its own wrapper,
          separate from board-ui's just below, so the "?"/back-to-hub
          buttons up here go inert without needing board-ui to know about
          them (mirrors Profile.jsx's two-separate-wrapper approach). */}
      <div className={tourStep !== null ? 'tour-inert' : ''}>
      <div className="section-title" style={{ flexWrap: 'wrap', rowGap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {session?.realm && onExitToHub && (
            // Same "‹" + chest = back-to-hub pattern PreGameSetup uses —
            // reopening the chest always re-runs PreGameSetup, which resets
            // the board, so leaving mid-game is as destructive as the
            // dedicated Reset button below and gets the same confirmation
            // (see exitModal / confirmExit).
            <button type="button" className="section-title-back" onClick={handleExitToHub} title="Back to the realms hub">
              <span aria-hidden="true">‹</span>
              <img src={chestFor(session.realm)} alt="" className="realm-chest-icon" />
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 'clamp(0.85rem, 3vw, 1.55rem)' }}>score board</h2>
          <button
              type="button"
              title={tourStep !== null ? 'Tour in progress' : 'About your score board'}
              onClick={startTour}
              style={{ background: 'none', border: `1px solid ${tourStep !== null ? 'var(--forest-green)' : 'var(--warm-gold)'}`, borderRadius: '50%', width: 'clamp(1.15rem, 4vw, 1.5rem)', height: 'clamp(1.15rem, 4vw, 1.5rem)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 2vw, 0.8rem)', fontWeight: 700, color: tourStep !== null ? 'var(--forest-green)' : 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
            >
              ?
            </button>
        </div>
        <div className="section-title-line" />
        <span className="game-count" style={{ fontSize: 'clamp(0.55rem, 2vw, 0.72rem)' }}>{session?.realm?.name}</span>
      </div>
      </div>

      {/* tour-inert: only the one spotlighted section below is clickable
          while the tour is open — see the matching wrapper above
          section-title for why this is a second, separate wrapper. */}
      <div className={tourStep !== null ? 'tour-inert' : ''}>
      <div className="board-ui">
        {/* Score log */}
        <div className={`tile-card board-log${tourStep === 3 ? ' tour-highlight' : ''}`} ref={scoreLogRef}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem', borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.5rem', marginBottom: '0.6rem' }}>
            {/* cqw, not vw — .board-log (see index.css) is the container this
                sizes off of. Its own narrow grid column is what actually
                squeezes this row; the viewport barely moves within that
                column's realistic width range, so a vw-based clamp would
                stay pinned at its ceiling the whole time. */}
            <div className="tile-card-header" style={{ border: 'none', padding: 0, margin: 0, whiteSpace: 'nowrap', fontSize: 'clamp(0.44rem, 8cqw, 0.78rem)' }}>Score Log</div>
            {/* Stadium-style game clock — a black recessed LED housing in a
                brass bezel (echoing the app's warm-gold tile borders), sized
                small to sit inline with the Score Log title. `elapsed`
                itself already just stops advancing while paused (see its
                own computation above) — no separate paused styling here,
                since Settings auto-resumes on close (see onClose below),
                so the board is never actually visible with a paused,
                silently-frozen clock in the first place. */}
            <div className="game-clock">
              <div className="game-clock-housing">
                <span className="game-clock-digits">{elapsed}</span>
              </div>
            </div>
          </div>
          {log.length === 0 ? (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', margin: 0 }}>
              No moves yet.
            </p>
          ) : (
            <div className="board-log-entries" ref={logContainerRef}>
              {log.map((entry) => {
                const color = entry.player ? getMeepleColor(meepleMap[entry.player]) : 'var(--stone-gray)';
                const isUndo = entry.type === 'undo';
                const isLap = entry.type === 'lap';
                const isFinalScoring = entry.type === 'final-scoring';
                return (
                  <div key={entry.id} className="board-log-entry" style={{ color, opacity: isUndo ? 0.65 : 1, fontWeight: isLap || isFinalScoring ? 600 : 400 }}>
                    <span className="board-log-msg" style={{ textDecoration: isUndo ? 'line-through' : 'none' }}>
                      {entry.player && !isUndo && (
                        <img
                          src={MEEPLE_IMGS[meepleMap[entry.player]] || FALLBACK_MEEPLE}
                          alt=""
                          style={{ height: 16, width: 'auto', verticalAlign: 'middle', marginRight: '0.3rem' }}
                        />
                      )}
                      {entry.msg}
                    </span>
                    <div className="board-log-meta">
                      <span className="board-log-time">{entry.time}</span>
                      {editMode && (entry.type === 'move' || entry.type === 'goods' || isFinalScoring) && (
                        <button
                          type="button"
                          className="realm-trash-btn"
                          onClick={() => setPendingDeleteMoveIdx(isFinalScoring ? 'final-scoring' : entry.moveIdx)}
                          aria-label={isFinalScoring ? 'Undo Final Scoring' : 'Delete this entry'}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.9rem', flexWrap: 'wrap' }}>
            {/* minWidth: 0 overrides the flex-item default of `auto`, which
                otherwise floors each button at its own content width (esp.
                "Settings" + the gear icon) — wider than half this sidebar,
                so despite flex: 1 1 0 they'd wrap onto separate rows instead
                of actually splitting the row evenly. */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: '1 1 0', minWidth: 0, justifyContent: 'center' }}
              onClick={() => setEditMode(e => !e)}
              disabled={board.moveIndex < 0}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: '1 1 0', minWidth: 0, justifyContent: 'center' }}
              onClick={() => setShowSettings(true)}
              title="Players, meeples, expansions, and reset"
              aria-label="Settings"
            >
              <GearIcon />
            </button>
            <button
              type="button"
              ref={finishBtnRef}
              // board-tour-finish-btn: strips box-shadow out of .btn's own
              // transition (see index.css, same fix as .pregame-begin-btn)
              // — without it, closing the tour on this exact step reverts
              // the class list straight from tour-highlight's huge spotlight
              // shadow back to this button's normal one, and .btn's own
              // transition animates that change, reading as a stray glow/
              // flash on Final Scoring right as "Got it!" is clicked.
              className={`btn btn-sm board-tour-finish-btn${tourStep === 4 ? ' tour-highlight' : ''}`}
              style={{ flex: '1 1 100%', justifyContent: 'center' }}
              onClick={() => {
                if (tourStep !== null) return; // Guided tour is purely a walkthrough — nothing scores while it's open.
                if (finishStep === 0) {
                  confirmInitialScoring();
                } else {
                  handleFinish();
                }
              }}
            >
              {finishStep === 1 ? 'Finish Game' : 'Final Scoring'}
            </button>
          </div>
        </div>

        {/* Board image */}
        <div className={`board-canvas tile-card${tourStep === 0 ? ' tour-highlight' : ''}`} ref={boardImageRef}>
          <div className="board-image">
            <img
              src={boardImg}
              alt="Score board"
              className="board-image-bg"
            />
            {players.map((p, pi) => {
              const pos    = board.positions[p] || 0;
              const coord  = BOARD_PATH[pos] || { x: 0, y: 0 };
              const group  = posGroups[pos] || [];
              const stackI = group.indexOf(p);
              const off    = STACK_OFFSETS[stackI] || { x: 0, y: 0 };
              return (
                <div
                  key={p}
                  className="meeple"
                  style={{ left: `${coord.x + off.x}%`, top: `${coord.y + off.y}%`, zIndex: 30 + pi }}
                  title={`${p}: ${totals[p]} pts`}
                >
                  <img
                    src={MEEPLE_IMGS[meepleMap[p]] || FALLBACK_MEEPLE}
                    alt={p}
                    style={{ width: 'clamp(32px, 5vw, 48px)', height: 'auto' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Player controls */}
        <div className="board-controls">
          {/* Meeple Selector */}
          <div className={`tile-card${tourStep === 1 ? ' tour-highlight' : ''}`} ref={playersBoxRef} style={{ marginBottom: '1rem', padding: '0.8rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.6rem' }}>
              PLAYERS
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${players.length <= 3 ? players.length : players.length === 4 ? 2 : 3}, 1fr)`,
              gap: '1rem 0.6rem',
            }}>
              {players.map((name) => {
                const color = getMeepleColor(meepleMap[name]);
                const isSelected = selectedPlayer === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => commitToPlayer(name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.4rem 0.3rem',
                      border: isSelected ? `2px solid ${color}` : '2px solid transparent',
                      borderRadius: '12px',
                      background: isSelected ? `${color}15` : 'transparent',
                      cursor: 'var(--cursor-pointer)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <img src={MEEPLE_IMGS[meepleMap[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 50, width: 'auto', display: 'block' }} />
                      {leaders.includes(name) && (
                        <img
                          src={leaderIcon}
                          alt="Leading"
                          title="Leading"
                          style={{ position: 'absolute', top: '-3px', right: '-7px', height: '16px', width: 'auto' }}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', color, fontWeight: 600 }}>{name}</span>
                    {hasTB && (() => {
                      const pg = board.goodsTokens?.[name] || {};
                      const held = ['wine', 'grain', 'cloth'].filter(g => (pg[g] || 0) > 0);
                      if (held.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {held.map(g => (
                            <span key={g} style={{ display: 'flex', alignItems: 'flex-start', gap: '1px' }}>
                              {GOODS_IMGS[g]
                                ? <img src={GOODS_IMGS[g]} alt={g} style={{ height: 13, width: 'auto' }} />
                                : <span style={{ fontSize: '0.55rem' }}>{g[0].toUpperCase()}</span>
                              }
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#000', lineHeight: 1 }}>{pg[g]}</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared Scoring Controls */}
          <div className={`tile-card${tourStep === 2 ? ' tour-highlight' : ''}`} ref={scoringControlsRef}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.4rem' }}>
              POINTS TO ADD
            </div>
            <input
              type="number"
              className="form-input board-score-input"
              value={Object.values(input)[0] || 0}
              onChange={e => updatePoints(e.target.value)}
              placeholder="Enter points"
              style={{ marginBottom: '1rem', textAlign: 'right' }}
            />
            <div className="board-btn-row">
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                updatePoints(Number(val) + 1);
              }}>+1</button>
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                updatePoints(Number(val) + 2);
              }}>+2</button>
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                updatePoints(Number(val) + 3);
              }}>+3</button>
              {((finishStep === 1 && (hasTB || hasAM)) || (finishStep === 0 && hasTB && hasAM)) && <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                updatePoints(Number(val) + 4);
              }}>+4</button>}
            </div>

            <div className="board-btn-row">
              {['road', 'city', 'monastery'].map(type => (
                <button
                  key={type}
                  type="button"
                  className="btn btn-sm board-btn-equal"
                  style={{ justifyContent: 'center', ...(selectedType === type ? PRESSED_STYLE : {}) }}
                  onClick={() => selectType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {hasAbbot && (
              <div className="board-btn-row">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', justifyContent: 'center', ...(selectedType === 'abbot' ? PRESSED_STYLE : {}) }}
                  onClick={() => selectType('abbot')}
                >
                  Abbot
                </button>
              </div>
            )}

            {hasIC && finishStep === 0 && (
              <div className="board-btn-row">
                {[['inn', 'Inn'], ['cathedral', 'Cathedral']].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className="btn btn-sm board-btn-equal"
                    style={{ justifyContent: 'center', ...(selectedType === type ? PRESSED_STYLE : {}) }}
                    onClick={() => selectType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {hasAM && (
              <div className="board-btn-row">
                {(hasTB ? [['abbey', 'Abbey'], ['field', 'Field'], ['pig', 'Pig']] : [['abbey', 'Abbey'], ['field', 'Field']]).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className="btn btn-sm board-btn-equal"
                    style={{ justifyContent: 'center', ...(selectedType === type ? PRESSED_STYLE : {}) }}
                    onClick={() => selectType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {finishStep === 1 && hasAM && (
              <div className="board-btn-row">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', justifyContent: 'center', ...(selectedType === 'barn' ? PRESSED_STYLE : {}) }}
                  onClick={() => selectType('barn')}
                >
                  Barn
                </button>
              </div>
            )}

            {finishStep === 1 && !hasAM && (
              hasTB ? (
                <div className="board-btn-row">
                  {[['field', 'Field'], ['pig', 'Pig']].map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      className="btn btn-sm board-btn-equal"
                      style={{ justifyContent: 'center', ...(selectedType === type ? PRESSED_STYLE : {}) }}
                      onClick={() => selectType(type)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', justifyContent: 'center', ...(selectedType === 'field' ? PRESSED_STYLE : {}) }}
                  onClick={() => selectType('field')}
                >
                  Field
                </button>
              )
            )}

            {hasTB && finishStep === 0 && (
              <div style={{ marginTop: '1.2rem' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.35rem' }}>
                  GOODS TOKENS
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', padding: '0.25rem 0' }}>
                  {['wine', 'grain', 'cloth'].map(good => {
                    const remaining = goodsRemaining[good] ?? 0;
                    return (
                      <button
                        key={good}
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0.2rem',
                          borderRadius: '10px',
                          cursor: 'var(--cursor-pointer)',
                          opacity: remaining <= 0 ? 0.35 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          outline: selectedGoods.has(good) ? '2px solid var(--stone-gray)' : 'none',
                          outlineOffset: '2px',
                          transform: selectedGoods.has(good) ? 'scale(0.9)' : 'none',
                        }}
                        onClick={() => selectGood(good)}
                        disabled={remaining <= 0}
                      >
                        {GOODS_IMGS[good]
                          ? <img src={GOODS_IMGS[good]} alt={good} style={{ height: 44, width: 'auto', display: 'block' }} />
                          : <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem' }}>{GOODS_LABELS[good]}</span>
                        }
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'Cinzel, serif', color: '#000' }}>×{remaining}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Ready-to-award hint: shown once a type/good or a player is highlighted, or once points are
          entered, prompting the next click. Only for the first 10 scores — after that, players know the flow.
          Hidden entirely during the guided tour — see the tourStep guards on commitToPlayer/selectType/
          selectGood/updatePoints just above, which is what keeps this state from ever actually changing
          mid-tour in the first place; this is just belt-and-suspenders for whatever was already showing
          the moment the tour was opened. */}
      {tourStep === null && !warning && board.moveIndex < 9 && (selectedType || selectedGoods.size > 0 || selectedPlayer || (Number(Object.values(input)[0]) || 0) > 0) && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--charcoal)',
          color: 'var(--parchment)',
          padding: 'clamp(0.5rem, 2.4vw, 0.75rem) clamp(0.8rem, 3.5vw, 1.3rem)',
          borderRadius: 'var(--radius-tile)',
          borderLeft: '4px solid var(--forest-green)',
          fontFamily: "'Crimson Text', serif",
          fontSize: 'clamp(0.8rem, 2.6vw, 1rem)',
          maxWidth: 'calc(100vw - 2rem)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
          zIndex: 20001,
          animation: 'toastIn 0.3s ease',
        }}>
          {selectedGoods.size > 0
            ? `Select a player to award ${[...selectedGoods].map(g => GOODS_LABELS[g]).join(', ')} token${selectedGoods.size > 1 ? 's' : ''}`
            : (Number(Object.values(input)[0]) || 0) === 0
            ? 'Add points.'
            : selectedType
            ? 'Select a player.'
            : selectedPlayer
            ? 'Select a score type.'
            : 'Select a player or a score type.'}
        </div>
      )}

      {/* Warning Toast — also hidden during the guided tour (see the ready-to-award hint's comment above). */}
      {tourStep === null && warning && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--charcoal)',
          color: 'var(--parchment)',
          padding: 'clamp(0.5rem, 2.4vw, 0.75rem) clamp(0.8rem, 3.5vw, 1.3rem)',
          borderRadius: 'var(--radius-tile)',
          borderLeft: `4px solid ${warningColor}`,
          fontFamily: "'Crimson Text', serif",
          fontSize: 'clamp(0.8rem, 2.6vw, 1rem)',
          maxWidth: 'calc(100vw - 2rem)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
          zIndex: 20001,
          animation: 'toastIn 0.3s ease, toastOut 0.3s ease 2.2s forwards',
        }}>
          {warning}
        </div>
      )}
    </div>
  );
}
