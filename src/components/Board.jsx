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
  const [input,       setInput]       = useState(() => Object.fromEntries(players.map(p => [p, 0])));
  const [history,     setHistory]     = useState([]);
  const [log,         setLog]         = useState([]);
  const [finishStep,       setFinishStep]       = useState(0); // 0 = normal, 1 = awaiting field confirm
  const [leadersAtFinish,  setLeadersAtFinish]  = useState([]);
  const [showTraders,      setShowTraders]      = useState(false);
  const [traderSelections, setTraderSelections] = useState({ wine: [], grain: [], cloth: [] });
  const logEndRef = useRef(null);

  useEffect(() => { getBoard(userId, players, isGuest).then(b => setBoard(b)); }, [userId, isGuest]);
  useEffect(() => { if (board) saveBoard(board, userId, isGuest); }, [board, userId, isGuest]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  if (!board) return null;

  const track = board.trackLength || 50;
  const hasTB  = (session?.expansions || []).includes('Traders & Builders');
  const hasIC  = (session?.expansions || []).some(e => e === 'Inns & Cathedrals' || e === 'Bridges, Castles & Bazaars');
  const hasAM  = (session?.expansions || []).includes('Abbey & Mayor');
  const hasAbbot = (session?.expansions || []).includes('The Abbot');

  function appendLog(msg, player = null) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLog(prev => [...prev, { msg, player, time, id: Date.now() + Math.random() }].slice(-100));
  }

  /**
   * GAME HISTORY SYSTEM
   * 
   * Maintains a stack of board states for undo functionality.
   * Critical for correcting scoring mistakes during gameplay.
   * Limited to last 100 moves to prevent memory bloat in long games.
   */
  function pushHistory() {
    // Deep clone current board state before making changes
    setHistory(h => [...h, JSON.parse(JSON.stringify(board))].slice(-100));
  }

  /**
   * UNDO SYSTEM
   * 
   * Reverts to previous board state and logs the changes.
   * Special handling for finish game step to prevent data loss.
   * Calculates point differences to show what was undone.
   */
  function undoLastMove() {
    if (finishStep === 1) { setFinishStep(0); return; } // Exit finish mode
    if (history.length === 0) return; // No moves to undo
    
    const last = history[history.length - 1];
    // Log what's being undone for each player who changed
    for (const p of players) {
      const cur  = (board.laps[p] || 0) * track + (board.positions[p] || 0);
      const prev = (last.laps[p]  || 0) * track + (last.positions[p]  || 0);
      if (cur !== prev) appendLog(`Undo: ${p} → ${prev} pts`, p);
    }
    setBoard(last);
    setHistory(h => h.slice(0, -1));
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

    pushHistory(); // Save state for undo

    // Current position calculation
    const curPos  = board.positions[player] || 0;
    const curLaps = board.laps[player] || 0;

    // New position with track wrapping
    const sum     = curPos + delta;
    const lapInc  = Math.floor(sum / track); // How many complete laps to add
    const newPos  = ((sum % track) + track) % track; // Modulo with negative handling
    const newLaps = curLaps + (lapInc > 0 ? lapInc : 0); // Prevent negative laps
    const newTotal = newLaps * track + newPos; // Final score for logging

    // Update score breakdown by category
    setBoard(b => {
      const prevBreakdown = b.scoreTotals?.[player] || { road: 0, city: 0, monastery: 0, field: 0 };
      return {
        ...b,
        positions:   { ...b.positions, [player]: newPos  },
        laps:        { ...b.laps,      [player]: newLaps },
        scoreTotals: {
          ...b.scoreTotals,
          [player]: { ...prevBreakdown, [type]: (prevBreakdown[type] || 0) + delta },
        },
      };
    });
    
    // Generate human-readable category names for logging
    const label = type === 'pig' ? 'Field (Pig)' : 
                  type === 'inn' ? 'Road (Inn)' : 
                  type === 'cathedral' ? 'City (Cathedral)' : 
                  type.charAt(0).toUpperCase() + type.slice(1);
    appendLog(`${player} scored +${delta} ${label} → ${newTotal} pts`, player);
  }

  function handleReset() {
    resetBoard(userId, players, [], isGuest);
    onReset();
  }

  function handleFinish() {
    const finalScores    = Object.fromEntries(
      players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)])
    );
    const scoreBreakdown = board.scoreTotals || {};
    const maxFinal       = Math.max(...Object.values(finalScores), 0);
    const finalWinners   = players.filter(p => finalScores[p] === maxFinal);
    // Farm win: a single winner who was NOT leading when Final Scoring was first pressed
    const autoFarmWin    = finalWinners.length === 1 && !leadersAtFinish.includes(finalWinners[0]);

    // Set endTime and calculate duration
    const endTime = Date.now();
    const gameDuration = endTime - board.startTime;

    // Update board with endTime and save it BEFORE resetting
    const updatedBoard = { ...board, endTime };
    saveBoard(updatedBoard, userId, isGuest);

    // Then reset for next game
    resetBoard(userId, players, [], isGuest);
    onFinish(finalScores, scoreBreakdown, autoFarmWin, gameDuration);
  }

  function applyTraderBonuses() {
    pushHistory();
    const nb = JSON.parse(JSON.stringify(board));
    for (const good of ['wine', 'grain', 'cloth']) {
      for (const p of traderSelections[good]) {
        const curPos  = nb.positions[p] || 0;
        const curLaps = nb.laps[p] || 0;
        const sum     = curPos + 10;
        const lapInc  = Math.floor(sum / track);
        const newPos  = ((sum % track) + track) % track;
        const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);
        nb.positions[p] = newPos;
        nb.laps[p] = newLaps;
        if (!nb.scoreTotals[p]) nb.scoreTotals[p] = {};
        nb.scoreTotals[p][good] = (nb.scoreTotals[p][good] || 0) + 10;
        appendLog(`${p} scored +10 ${good.charAt(0).toUpperCase() + good.slice(1)} → ${newLaps * track + newPos} pts`, p);
      }
    }
    setBoard(nb);
    setTraderSelections({ wine: [], grain: [], cloth: [] });
    setShowTraders(false);
    setFinishStep(1);
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

  return (
    <div>
      {/* Traders & Builders modal */}
      {showTraders && (
        <div className="lightbox-overlay" onClick={() => setShowTraders(false)}>
          <div className="lightbox-inner" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
            <div className="lightbox-meta">
              <div className="tile-card-header" style={{ marginBottom: '0.5rem' }}>Traders & Builders</div>
              <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--stone-gray)', marginBottom: '1rem' }}>
                Select who won the most of each good. Each winner receives 10 pts.
              </p>
              {['wine', 'grain', 'cloth'].map(good => (
                <div key={good} style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.35rem' }}>
                    {good.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {players.map(p => {
                      const selected = traderSelections[good].includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`btn btn-sm${selected ? '' : ' btn-ghost'}`}
                          style={{ justifyContent: 'center' }}
                          onClick={() => setTraderSelections(prev => ({
                            ...prev,
                            [good]: selected ? prev[good].filter(x => x !== p) : [...prev[good], p],
                          }))}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn" onClick={applyTraderBonuses}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section-title">
        <h2>score board</h2>
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
          <div className="tile-card-header" style={{ marginBottom: '0.6rem' }}>Score Log</div>
          {log.length === 0 ? (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', margin: 0 }}>
              No moves yet.
            </p>
          ) : (
            <div className="board-log-entries">
              {log.map((entry) => {
                const color = entry.player ? getMeepleColor(meepleMap[entry.player]) : 'var(--stone-gray)';
                return (
                  <div key={entry.id} className="board-log-entry" style={{ color }}>
                    <span className="board-log-msg">
                      {entry.player && (
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
              <div ref={logEndRef} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.9rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: '1 1 0', justifyContent: 'center' }}
              onClick={undoLastMove}
              disabled={history.length === 0 && finishStep === 0}
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
                  setLeadersAtFinish(leaders);
                  if (hasTB) setShowTraders(true);
                  else setFinishStep(1);
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
          <div className="board-player-grid">
          {players.map((name, pi) => {
            const color = getMeepleColor(meepleMap[name]);
            return (
              <div key={name} className="board-player-card tile-card">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  {/* Name top, meeple anchored to bottom */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', fontWeight: 700, color, textAlign: 'center' }}>{name}</span>
                    <img src={MEEPLE_IMGS[meepleMap[name]] || FALLBACK_MEEPLE} alt="meeple" style={{ height: 50, width: 'auto' }} />
                  </div>
                  {/* Controls on the right */}
                <div className="board-btn-group" style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="number"
                    className="form-input board-score-input"
                    value={input[name] || 0}
                    onChange={e => setInput(v => ({ ...v, [name]: e.target.value }))}
                  />
                  <div className="board-btn-row">
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 1) }))}>+1</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 2) }))}>+2</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 3) }))}>+3</button>
                    {((finishStep === 1 && (hasTB || hasAM)) || (finishStep === 0 && hasTB && hasAM)) && <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 4) }))}>+4</button>}
                  </div>
                  <div className="board-btn-row">
                    {['road', 'city', 'monastery'].map(type => (
                      <button
                        key={type}
                        type="button"
                        className="btn btn-sm board-btn-equal"
                        style={{ justifyContent: 'center' }}
                        onClick={() => {
                          const val = Number(input[name] || 0);
                          if (!Number.isNaN(val) && val !== 0) {
                            addPoints(name, val, type);
                            setInput(v => ({ ...v, [name]: 0 }));
                          }
                        }}
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
                        onClick={() => {
                          const val = Number(input[name] || 0);
                          if (!Number.isNaN(val) && val !== 0) {
                            addPoints(name, val, 'abbot');
                            setInput(v => ({ ...v, [name]: 0 }));
                          }
                        }}
                      >
                        Abbot
                      </button>
                    </div>
                  )}
                  {hasIC && (
                    <div className="board-btn-row">
                      {[['inn', 'Inn'], ['cathedral', 'Cathedral']].map(([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          className="btn btn-sm board-btn-equal"
                          style={{ justifyContent: 'center' }}
                          onClick={() => {
                            const val = Number(input[name] || 0);
                            if (!Number.isNaN(val) && val !== 0) {
                              addPoints(name, val, type);
                              setInput(v => ({ ...v, [name]: 0 }));
                            }
                          }}
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
                          onClick={() => {
                            const val = Number(input[name] || 0);
                            if (!Number.isNaN(val) && val !== 0) {
                              addPoints(name, val, type);
                              setInput(v => ({ ...v, [name]: 0 }));
                            }
                          }}
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
                        onClick={() => {
                          const val = Number(input[name] || 0);
                          if (!Number.isNaN(val) && val !== 0) {
                            addPoints(name, val, 'barn');
                            setInput(v => ({ ...v, [name]: 0 }));
                          }
                        }}
                      >
                        Barn
                      </button>
                    </div>
                  )}
                  {finishStep === 1 && !hasAM && (
                    hasTB ? (
                      <>
                        <div className="board-btn-row">
                          {[['field', 'Field'], ['pig', 'Pig']].map(([type, label]) => (
                            <button
                              key={type}
                              type="button"
                              className="btn btn-sm board-btn-equal"
                              style={{ justifyContent: 'center' }}
                              onClick={() => {
                                const val = Number(input[name] || 0);
                                if (!Number.isNaN(val) && val !== 0) {
                                  addPoints(name, val, type);
                                  setInput(v => ({ ...v, [name]: 0 }));
                                }
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          const val = Number(input[name] || 0);
                          if (!Number.isNaN(val) && val !== 0) {
                            addPoints(name, val, 'field');
                            setInput(v => ({ ...v, [name]: 0 }));
                          }
                        }}
                      >
                        Field
                      </button>
                    )
                  )}
                </div>
                </div>{/* end meeple+controls row */}
              </div>
            );
          })}
          </div>

        </div>
      </div>
    </div>
  );
}
