import { useEffect, useRef, useState } from 'react';
import BOARD_PATH from '../data/boardCoords';
import { getBoard, saveBoard, resetBoard } from '../data/boardStorage';
import boardImg from '../../images/score-board.jpg';

// Dynamically load all meeple PNGs
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = Object.fromEntries(
  Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])
);
// Fallback to first available meeple
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const PLAYER_COLORS = [
  'var(--deep-red)',
  'var(--royal-blue)',
  'var(--forest-green)',
  'var(--mustard)',
  '#7B2D8B',
  '#1A8080',
];

// Offsets to spread stacked meeples apart
const STACK_OFFSETS = [
  { x: 0,  y:  0 },
  { x: 3,  y: -3 },
  { x: -3, y: -3 },
  { x: 3,  y:  3 },
  { x: -3, y:  3 },
  { x: 0,  y: -5 },
];

export default function Board({ session, onFinish }) {
  const players   = session?.players  || [];
  const meepleMap = session?.meeples  || {};

  const [board,   setBoard]   = useState(() => getBoard(players));
  const [input,   setInput]   = useState(() => Object.fromEntries(players.map(p => [p, 0])));
  const [history, setHistory] = useState([]);
  const [log,     setLog]     = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => { saveBoard(board); }, [board]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  const track = board.trackLength || 50;

  function appendLog(msg, player = null) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLog(prev => [...prev, { msg, player, time, id: Date.now() + Math.random() }].slice(-100));
  }

  function pushHistory() {
    setHistory(h => [...h, JSON.parse(JSON.stringify(board))].slice(-100));
  }

  function undoLastMove() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    for (const p of players) {
      const cur  = (board.laps[p] || 0) * track + (board.positions[p] || 0);
      const prev = (last.laps[p]  || 0) * track + (last.positions[p]  || 0);
      const diff = cur - prev;
      if (diff !== 0) appendLog(`Undo: ${p} ${diff > 0 ? '-' : '+'}${Math.abs(diff)} pts → ${prev} pts`, p);
    }
    setBoard(last);
    setHistory(h => h.slice(0, -1));
  }

  function addPoints(player, delta) {
    delta = Number(delta) || 0;
    if (delta === 0) return;
    pushHistory();
    const curPos  = board.positions[player] || 0;
    const curLaps = board.laps[player] || 0;
    const sum     = curPos + delta;
    const lapInc  = Math.floor(sum / track);
    const newPos  = ((sum % track) + track) % track;
    const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);
    const newTotal = newLaps * track + newPos;
    setBoard(b => ({
      ...b,
      positions: { ...b.positions, [player]: newPos  },
      laps:      { ...b.laps,      [player]: newLaps },
    }));
    appendLog(`${player} +${delta} pts → ${newTotal} pts`, player);
  }

  function handleReset() {
    if (!window.confirm('Reset the board? All current scores will be cleared.')) return;
    setHistory([]);
    setLog([]);
    setBoard(resetBoard(players));
    appendLog('Board reset');
  }

  function handleFinish() {
    if (!window.confirm('Finish the game? This will take you to the record page.')) return;
    const finalScores = Object.fromEntries(
      players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)])
    );
    onFinish(finalScores);
  }

  // Lead text
  const totals  = Object.fromEntries(players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)]));
  const maxTotal = Math.max(...Object.values(totals), 0);
  const leaders  = maxTotal > 0 ? players.filter(p => totals[p] === maxTotal) : [];
  const leadText  = leaders.length === 0
    ? 'No scores yet'
    : leaders.length === 1
    ? `${leaders[0]} leads`
    : `${leaders.join(' & ')} tied`;
  const leadColorIdx = leaders.length === 1 ? players.indexOf(leaders[0]) : -1;
  const leadColor    = leadColorIdx >= 0 ? PLAYER_COLORS[leadColorIdx] : 'var(--stone-gray)';

  // Group players by position for collision offsets
  const posGroups = {};
  players.forEach(p => {
    const pos = board.positions[p] || 0;
    if (!posGroups[pos]) posGroups[pos] = [];
    posGroups[pos].push(p);
  });

  return (
    <div>
      <div className="section-title">
        <h2>Game Board</h2>
        <div className="section-title-line" />
        <span className="game-count" style={{ color: leadColor }}>{leadText}</span>
      </div>

      <div className={`board-ui ${players.length > 3 ? 'board-ui-many' : ''}`}>
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
                const idx   = players.indexOf(entry.player);
                const color = idx >= 0 ? PLAYER_COLORS[idx] : 'var(--stone-gray)';
                return (
                  <div key={entry.id} className="board-log-entry" style={{ color }}>
                    <span className="board-log-msg">{entry.msg}</span>
                    <span className="board-log-time">{entry.time}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
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
          <div
            className="board-player-grid"
            style={players.length > 3 ? {
              display: 'grid',
              gridTemplateColumns: `repeat(${players.length}, 1fr)`,
              gap: '0.5rem',
              marginBottom: '0.7rem',
            } : undefined}
          >
          {players.map((name, pi) => {
            const color = PLAYER_COLORS[pi] || PLAYER_COLORS[0];
            const many  = players.length > 3;
            return (
              <div key={name} className={`board-player-card tile-card${many ? ' board-player-card-compact' : ''}`} style={{ marginBottom: many ? 0 : '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                  <img src={MEEPLE_IMGS[meepleMap[name]] || FALLBACK_MEEPLE} alt="meeple" style={{ height: 26, width: 'auto' }} />
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', fontWeight: 500, color, flex: 1 }}>{name}</div>
                  <div style={{ fontStyle: 'italic', color, fontSize: '1rem', fontWeight: 600 }}>{totals[name]}</div>
                </div>
                <div className="board-btn-group">
                  <input
                    type="number"
                    className="form-input board-score-input"
                    value={input[name] || 0}
                    onChange={e => setInput(v => ({ ...v, [name]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = Number(input[name] || 0);
                        if (!Number.isNaN(val) && val !== 0) {
                          addPoints(name, val);
                          setInput(v => ({ ...v, [name]: 0 }));
                        }
                      }
                    }}
                  />
                  <div className="board-btn-row">
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 1) }))}>+1</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 2) }))}>+2</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 5) }))}>+5</button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const val = Number(input[name] || 0);
                      if (!Number.isNaN(val) && val !== 0) {
                        addPoints(name, val);
                        setInput(v => ({ ...v, [name]: 0 }));
                      }
                    }}
                  >Add</button>
                </div>
              </div>
            );
          })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: players.length > 3 ? 'flex-end' : 'stretch', flexDirection: players.length > 3 ? 'row' : 'column' }}>
            <button
              type="button"
              className="btn"
              style={{ flex: players.length > 3 ? '0 0 auto' : 1, justifyContent: 'center' }}
              onClick={handleFinish}
            >
              Finish Game
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: players.length > 3 ? '0 0 auto' : 1, justifyContent: 'center' }}
              onClick={undoLastMove}
              disabled={history.length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: players.length > 3 ? '0 0 auto' : 1, justifyContent: 'center' }}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
