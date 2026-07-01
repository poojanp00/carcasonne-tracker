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

import { useEffect, useRef, useState } from 'react';
import BOARD_PATH from '../data/boardCoords';
import { getBoard, saveBoard, resetBoard } from '../data/boardStorage';
import { computeWinners } from '../utils/scoring';
import { fetchNewEvents, subscribeEvents, setPhase, endSession, deleteSession, unsubscribe, submitEvent } from '../data/partySession';
import boardImg from '../../images/score-board.jpg';

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

// Physical token supply counts for Traders & Builders
const GOODS_SUPPLY = { wine: 9, grain: 6, cloth: 5 };
const GOODS_LABELS = { wine: 'Wine', grain: 'Grain', cloth: 'Cloth' };

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

export default function Board({ userId, isGuest, session, onFinish, onReset }) {
  const players   = session?.players  || [];
  const meepleMap = session?.meeples  || {};

  const [board,       setBoard]       = useState(null);
  const [now,         setNow]         = useState(Date.now());
  const [input,       setInput]       = useState(() => Object.fromEntries(players.map(p => [p, 0])));
  const [selectedPlayers, setSelectedPlayers] = useState(new Set()); // Track which players are selected for scoring
  const [finishStep,       setFinishStep]       = useState(0); // 0 = normal, 1 = awaiting field confirm
  const [leadersAtFinish,  setLeadersAtFinish]  = useState([]);
  const [showTraders,   setShowTraders]   = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false); // Finish game confirmation
  const [confirmReset,         setConfirmReset]         = useState(false); // Reset board confirmation
  const [warning,             setWarning]             = useState(null); // Warning toast for no players selected
  const logContainerRef  = useRef(null);
  const boardPopoutRef   = useRef(null);
  const boardPopoutChRef = useRef(null);

  // Generate log from moves and undo events merged chronologically
  const log = board && board.moves
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
    : [];


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
  }, [userId, players, isGuest]);

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

  // Recalculate board state from moves when moveIndex changes (for undo/redo)
  useEffect(() => {
    if (!board || board.moves.length === 0) return;

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

      // Rebuild maxFeatures: skip monastery/abbot from generic path
      if (move.amount > 0 && move.type !== 'monastery' && move.type !== 'abbot') {
        const cur = rebuilt.maxFeatures[move.type] || { amount: 0, player: null };
        if (move.amount > cur.amount) rebuilt.maxFeatures[move.type] = { amount: move.amount, player: move.player };
      }
      // Rebuild monastery completion count
      if ((move.type === 'monastery' || move.type === 'abbot') && move.amount === 9) {
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

  // ── Party mode: phone event consumer ─────────────────────────────────────
  // Must live before the early return so hook order is stable across renders.
  // Uses only functional setBoard so concurrent events compose correctly.

  function addPhonePoints(player, delta, type) {
    // Goods token events carry no score — update goodsTokens tally instead.
    if (type === 'goods_wine' || type === 'goods_grain' || type === 'goods_cloth') {
      const good = type.replace('goods_', '');
      setBoard(prev => {
        const newMoves = prev.moves.slice(0, prev.moveIndex + 1);
        newMoves.push({ player, type, amount: 0, label: GOODS_LABELS[good] + ' Token', timestamp: Date.now(), inFinalScoring: prev.finalScoringIndex !== null });
        return {
          ...prev,
          moves:       newMoves,
          moveIndex:   newMoves.length - 1,
          goodsTokens: {
            ...prev.goodsTokens,
            [player]: { ...(prev.goodsTokens?.[player] || {}), [good]: (prev.goodsTokens?.[player]?.[good] || 0) + 1 },
          },
        };
      });
      return;
    }
    delta = Number(delta) || 0;
    if (delta === 0) return;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    setBoard(prev => {
      const trackLen = prev.trackLength || 50;
      const newMoves = prev.moves.slice(0, prev.moveIndex + 1);
      newMoves.push({ player, type, amount: delta, label, timestamp: Date.now(), inFinalScoring: prev.finalScoringIndex !== null });
      const curPos  = prev.positions[player] || 0;
      const curLaps = prev.laps[player] || 0;
      const sum     = curPos + delta;
      const lapInc  = Math.floor(sum / trackLen);
      const newPos  = ((sum % trackLen) + trackLen) % trackLen;
      const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);
      const prevBreakdown = prev.scoreTotals?.[player] || {};
      const maxFeatures = { ...prev.maxFeatures };
      if (delta > 0 && type !== 'monastery' && type !== 'abbot') {
        const currentMax = maxFeatures[type] || { amount: 0, player: null };
        if (delta > currentMax.amount) maxFeatures[type] = { amount: delta, player };
      }
      if ((type === 'monastery' || type === 'abbot') && delta === 9) {
        const counts = { ...(maxFeatures._monasteryCounts || {}) };
        counts[player] = (counts[player] || 0) + 1;
        maxFeatures._monasteryCounts = counts;
        let topCount = 0, topPlayer = null;
        Object.entries(counts).forEach(([p, c]) => { if (c > topCount) { topCount = c; topPlayer = p; } });
        maxFeatures.monastery = { amount: topCount, player: topPlayer };
      }
      return {
        ...prev,
        moves:       newMoves,
        moveIndex:   newMoves.length - 1,
        positions:   { ...prev.positions, [player]: newPos },
        laps:        { ...prev.laps,      [player]: newLaps },
        scoreTotals: { ...prev.scoreTotals, [player]: { ...prevBreakdown, [type]: (prevBreakdown[type] || 0) + delta } },
        maxFeatures,
      };
    });
  }

  useEffect(() => {
    const sessionId = session?.partySessionId;
    if (!sessionId || session?.mode !== 'party') return;

    let eventSub = null;

    async function catchUp() {
      const lastSeq = board?.lastEventSeq || 0;
      const events = await fetchNewEvents(sessionId, lastSeq);
      for (const ev of events) {
        if (ev.source !== 'host') addPhonePoints(ev.player_name, ev.delta, ev.category);
      }
      if (events.length > 0) {
        const maxSeq = events[events.length - 1].seq;
        setBoard(prev => ({ ...prev, lastEventSeq: Math.max(prev.lastEventSeq || 0, maxSeq) }));
      }

      eventSub = subscribeEvents(sessionId, (ev) => {
        if (ev.source !== 'host') addPhonePoints(ev.player_name, ev.delta, ev.category);
        setBoard(prev => ({ ...prev, lastEventSeq: Math.max(prev.lastEventSeq || 0, ev.seq) }));
      });
    }

    if (board) catchUp();

    return () => { unsubscribe(eventSub); };
  }, [board !== null, session?.partySessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stamp the real startTime the moment the host clicks Start Game, not at lobby creation.
  useEffect(() => {
    if (session?.mode !== 'party' || !session.partyStarted || !board) return;
    setBoard(prev => ({ ...prev, startTime: Date.now() }));
  }, [session?.partyStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!board) return null;

  function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${String(sec).padStart(2, '0')}s`;
  }
  const elapsed = (session?.mode === 'party' && !session?.partyStarted)
    ? '0m 00s'
    : formatElapsed(now - (board.startTime || now));

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
   * UNDO SYSTEM
   *
   * Reverts to previous move considering final scoring context.
   * If in final scoring, undoes final scoring moves first.
   * Only exits final scoring after undoing all final scoring moves.
   */
  function undoLastMove() {
    if (!board) return;
    if (board.moveIndex < 0) return; // No moves to undo

    const currentMove = board.moves[board.moveIndex];
    const isInFinalScoring = board.finalScoringIndex !== null;
    const isCurrentMoveInFinalScoring = currentMove?.inFinalScoring;

    // If in final scoring and current move is in final scoring, just undo the move
    if (isInFinalScoring && isCurrentMoveInFinalScoring) {
      setBoard(prev => ({
        ...prev,
        moveIndex: prev.moveIndex - 1,
        undoLog: [
          ...prev.undoLog,
          {
            player: currentMove.player,
            amount: -currentMove.amount,
            label: currentMove.label,
            timestamp: Date.now(),
          },
        ],
      }));
      return;
    }

    // If in final scoring but current move is NOT in final scoring, exit final scoring
    if (isInFinalScoring && !isCurrentMoveInFinalScoring) {
      setFinishStep(0);
      setBoard(prev => ({ ...prev, finalScoringIndex: null }));
      return;
    }

    // Regular game undo - add to undoLog
    setBoard(prev => ({
      ...prev,
      moveIndex: prev.moveIndex - 1,
      undoLog: [
        ...prev.undoLog,
        {
          player: currentMove.player,
          amount: -currentMove.amount,
          label: currentMove.label,
          timestamp: Date.now(),
        },
      ],
    }));
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
    const newTotal = newLaps * track + newPos; // Final score for logging

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

      // Check if this feature is the largest of its type (monastery/abbot tracked separately by count)
      if (delta > 0 && type !== 'monastery' && type !== 'abbot') {
        const currentMaxFeature = maxFeatures[type] || { amount: 0, player: null };
        if (delta > currentMaxFeature.amount) {
          maxFeatures[type] = { amount: delta, player };
        }
      }

      // Count full monastery completions (monastery or abbot scoring exactly 9)
      if ((type === 'monastery' || type === 'abbot') && delta === 9) {
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

    // Mirror to score_events so phones can track live breakdown (tagged 'host' to avoid re-applying on subscription)
    if (session?.partySessionId && delta > 0) {
      submitEvent({ sessionId: session.partySessionId, playerName: player, category: type, delta, source: 'host' }).catch(() => {});
    }
  }

  // Apply points to all selected players and reset selection
  function addPointsToSelected(delta, type = 'road') {
    if (!delta || Number(delta) === 0) return;

    // Show warning if no players are selected
    if (selectedPlayers.size === 0) {
      setWarning('Select a player first');
      setTimeout(() => setWarning(null), 2500);
      return;
    }

    selectedPlayers.forEach(player => {
      addPoints(player, delta, type);
    });

    // Reset selected players and input field
    setSelectedPlayers(new Set());
    setInput(v => Object.fromEntries(players.map(p => [p, 0])));
  }

  function handleReset() {
    setConfirmReset(true); // Show confirmation modal
  }

  function confirmResetBoard() {
    setConfirmReset(false);
    if (session?.partySessionId) deleteSession(session.partySessionId);
    resetBoard(userId, players, [], isGuest);
    onReset();
  }

  function handleFinish() {
    setConfirmFinish(true); // Show confirmation modal
  }

  function confirmInitialScoring() {
    setLeadersAtFinish(leaders);
    setBoard(prev => ({ ...prev, finalScoringIndex: prev.moveIndex + 1, finalScoringTime: Date.now() }));
    if (session?.partySessionId) setPhase(session.partySessionId, 'final_scoring');
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

    // Set endTime and calculate duration
    const endTime = Date.now();
    const gameDuration = endTime - board.startTime;

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
    if (merchantCandidates.length > 0) {
      const merchant = merchantCandidates.reduce((best, p) => {
        const tot = ['wine', 'grain', 'cloth'].reduce((s, g) => s + (goodsTokens[p]?.[g] || 0), 0);
        const bestTot = ['wine', 'grain', 'cloth'].reduce((s, g) => s + (goodsTokens[best]?.[g] || 0), 0);
        return tot > bestTot ? p : best;
      });
      const total = ['wine', 'grain', 'cloth'].reduce((s, g) => s + (goodsTokens[merchant]?.[g] || 0), 0);
      finalMaxFeatures.bestTrader = { amount: total, player: merchant };
    }

    if (session?.partySessionId) endSession(session.partySessionId, {
      finalScores,
      scoreBreakdown,
      maxFeatures: finalMaxFeatures,
      players,
      meeples: session.meeples || {},
      expansions: session.expansions || [],
      farmWin: autoFarmWin,
      gameDuration,
    });
    boardPopoutChRef.current?.postMessage({ type: 'GAME_OVER' });
    resetBoard(userId, players, [], isGuest);
    onFinish(finalScores, scoreBreakdown, autoFarmWin, gameDuration, finalMaxFeatures);
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

  function addGoodsToken(good) {
    if (selectedPlayers.size === 0) {
      setWarning('Select a player first');
      setTimeout(() => setWarning(null), 2500);
      return;
    }
    if (selectedPlayers.size > 1) {
      setWarning('Select only one player');
      setTimeout(() => setWarning(null), 2500);
      return;
    }
    const [player] = selectedPlayers;
    addMove(player, `goods_${good}`, 0, `${GOODS_LABELS[good]} Token`);
    setSelectedPlayers(new Set());
  }

  function broadcastBoard(ch) {
    if (!board) return;
    ch.postMessage({ type: 'BOARD_UPDATE', payload: { board, players, meepleMap } });
  }

  // Lead text
  const totals  = Object.fromEntries(players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)]));
  const maxTotal = Math.max(...Object.values(totals), 0);
  const leaders  = maxTotal > 0 ? players.filter(p => totals[p] === maxTotal) : [];
  const leadText  = leaders.length === 0
    ? 'No scores yet'
    : leaders.length === 1
    ? `${leaders[0]} leads`
    : `${leaders.join(' & ')} lead`;
  const leadColor = leaders.length === 1 ? getMeepleColor(meepleMap[leaders[0]]) : 'var(--stone-gray)';

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
          This will clear all scores and start a new game. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={confirmResetBoard}>Reset</button>
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

      {session?.partyCode && (
        <div className="party-code-badge">
          CODE: <strong>{session.partyCode}</strong>
        </div>
      )}

      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>score board</h2>
          <button
              type="button"
              title="Pop out board view"
              onClick={() => {
                const base = `${window.location.origin}${window.location.pathname}`;
                if (!boardPopoutRef.current || boardPopoutRef.current.closed) {
                  boardPopoutRef.current = window.open(`${base}?view=board`, 'carcasonne-board', 'popup,width=1000,height=700');
                } else {
                  boardPopoutRef.current.focus();
                }
              }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--stone-gray)', opacity: 0.6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--warm-gold), transparent)' }} />
          <span style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'var(--earth-brown)',
            background: 'var(--warm-gold)',
            opacity: 0.85,
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
          }}>
            {session?.realm?.name}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--warm-gold))' }} />
        </div>
        <span className="game-count" style={{ color: leadColor }}>{leadText}</span>
      </div>

      <div className="board-ui">
        {/* Score log */}
        <div className="tile-card board-log">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.5rem', marginBottom: '0.6rem' }}>
            <div className="tile-card-header" style={{ border: 'none', padding: 0, margin: 0 }}>Score Log</div>
            <span style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--stone-gray)' }}>{elapsed}</span>
          </div>
          {log.length === 0 ? (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', margin: 0 }}>
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
                    <span className="board-log-time">{entry.time}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.9rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: '1 1 0', justifyContent: 'center' }}
              onClick={undoLastMove}
              disabled={board.moveIndex < 0}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: '1 1 0', justifyContent: 'center' }}
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: '1 1 100%', justifyContent: 'center' }}
              onClick={() => {
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
        <div className="board-canvas tile-card">
          <div className="board-image">
            <img src={boardImg} alt="Score board" className="board-image-bg" />
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
          <div className="tile-card" style={{ marginBottom: '1rem', padding: '0.8rem' }}>
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
                const isSelected = selectedPlayers.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      const newSelected = new Set(selectedPlayers);
                      if (newSelected.has(name)) {
                        newSelected.delete(name);
                      } else {
                        newSelected.add(name);
                      }
                      setSelectedPlayers(newSelected);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.4rem 0.3rem',
                      border: isSelected ? `2px solid ${color}` : '2px solid transparent',
                      borderRadius: '12px',
                      background: isSelected ? `${color}15` : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <img src={MEEPLE_IMGS[meepleMap[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 50, width: 'auto' }} />
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
                              <span style={{ fontSize: '0.5rem', color: 'var(--stone-gray)', lineHeight: 1 }}>{pg[g]}</span>
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
          <div className="tile-card">
            <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.4rem' }}>
              POINTS TO ADD
            </div>
            <input
              type="number"
              className="form-input board-score-input"
              value={Object.values(input)[0] || 0}
              onChange={e => {
                const val = e.target.value;
                const newInput = Object.fromEntries(players.map(p => [p, val]));
                setInput(newInput);
              }}
              placeholder="Enter points"
              style={{ marginBottom: '1rem', textAlign: 'right' }}
            />
            <div className="board-btn-row">
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                setInput(Object.fromEntries(players.map(p => [p, String(Number(val) + 1)])));
              }}>+1</button>
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                setInput(Object.fromEntries(players.map(p => [p, String(Number(val) + 2)])));
              }}>+2</button>
              <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                setInput(Object.fromEntries(players.map(p => [p, String(Number(val) + 3)])));
              }}>+3</button>
              {((finishStep === 1 && (hasTB || hasAM)) || (finishStep === 0 && hasTB && hasAM)) && <button type="button" className="btn btn-sm board-btn-equal" style={{}} onClick={() => {
                const val = Object.values(input)[0] || 0;
                setInput(Object.fromEntries(players.map(p => [p, String(Number(val) + 4)])));
              }}>+4</button>}
            </div>

            <div className="board-btn-row">
              {['road', 'city', 'monastery'].map(type => (
                <button
                  key={type}
                  type="button"
                  className="btn btn-sm board-btn-equal"
                  style={{ justifyContent: 'center' }}
                  onClick={() => addPointsToSelected(Object.values(input)[0], type)}
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
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => addPointsToSelected(Object.values(input)[0], 'abbot')}
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
                    style={{ justifyContent: 'center' }}
                    onClick={() => addPointsToSelected(Object.values(input)[0], type)}
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
                    style={{ justifyContent: 'center' }}
                    onClick={() => addPointsToSelected(Object.values(input)[0], type)}
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
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => addPointsToSelected(Object.values(input)[0], 'barn')}
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
                      style={{ justifyContent: 'center' }}
                      onClick={() => addPointsToSelected(Object.values(input)[0], type)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => addPointsToSelected(Object.values(input)[0], 'field')}
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
                          padding: '0',
                          cursor: 'pointer',
                          opacity: remaining <= 0 ? 0.35 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        onClick={() => addGoodsToken(good)}
                        disabled={remaining <= 0}
                      >
                        {GOODS_IMGS[good]
                          ? <img src={GOODS_IMGS[good]} alt={good} style={{ height: 44, width: 'auto', display: 'block' }} />
                          : <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem' }}>{GOODS_LABELS[good]}</span>
                        }
                        <span style={{ fontSize: '0.65rem', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)' }}>×{remaining}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Toast */}
      {warning && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--charcoal)',
          color: 'var(--parchment)',
          padding: '0.75rem 1.3rem',
          borderRadius: 'var(--radius-tile)',
          borderLeft: '4px solid #C44040',
          fontFamily: "'Crimson Text', serif",
          fontSize: '1rem',
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
