import { useEffect, useRef, useState } from 'react';
import BOARD_PATH from '../data/boardCoords';
import { getBoard, saveBoard, resetBoard } from '../data/boardStorage';
import boardImg from '../../images/score-board.jpg';
import diyaImg from '../../images/meeples/diya.png';
import poojanImg from '../../images/meeples/poojan.png';

export default function Board() {
  const [board, setBoard] = useState(() => getBoard());
  const [input, setInput] = useState({ Poojan: 0, Diya: 0 });
  const [history, setHistory] = useState([]);
  const [log, setLog] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => { saveBoard(board); }, [board]);

  // scroll log to bottom on new entry
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

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
    // compute what's being undone for the log
    for (const p of ['Poojan', 'Diya']) {
      const cur  = (board.laps[p] || 0) * track + (board.positions[p] || 0);
      const prev = (last.laps[p]  || 0) * track + (last.positions[p]  || 0);
      const diff = cur - prev;
      if (diff !== 0) appendLog(`Undo: ${p} ${diff > 0 ? '-' : '+'}${Math.abs(diff)} pts → ${prev} pts`, p);
    }
    if (['Poojan', 'Diya'].every(p => {
      const cur  = (board.laps[p] || 0) * track + (board.positions[p] || 0);
      const prev = (last.laps[p]  || 0) * track + (last.positions[p]  || 0);
      return cur === prev;
    })) {
      appendLog('Undo');
    }
    setBoard(last);
    setHistory(h => h.slice(0, -1));
  }

  function addPoints(player, delta) {
    delta = Number(delta) || 0;
    if (delta === 0) return;
    pushHistory();
    const cur = board.positions[player] || 0;
    const sum = cur + delta;
    const lapInc = Math.floor(sum / track);
    const newPos = ((sum % track) + track) % track;
    const newTotal = ((board.laps[player] || 0) + (lapInc > 0 ? lapInc : 0)) * track + newPos;
    setBoard({
      ...board,
      positions: { ...board.positions, [player]: newPos },
      laps: { ...board.laps, [player]: (board.laps[player] || 0) + (lapInc > 0 ? lapInc : 0) },
    });
    appendLog(`${player} +${delta} pts → ${newTotal} pts`, player);
  }

  function handleReset() {
    if (!window.confirm('Reset the board? All scores and history will be cleared.')) return;
    setHistory([]);
    setLog([]);
    setBoard(resetBoard());
    appendLog('Board reset');
  }

  const p1Pos = board.positions.Poojan || 0;
  const p2Pos = board.positions.Diya   || 0;
  const p1Coord = BOARD_PATH[p1Pos] || { x: 0, y: 0 };
  const p2Coord = BOARD_PATH[p2Pos] || { x: 0, y: 0 };
  const collision = p1Pos === p2Pos;
  const collisionOffset = collision ? { x: 3, y: -2 } : { x: 0, y: 0 };

  const p1Total = (board.laps.Poojan || 0) * track + p1Pos;
  const p2Total = (board.laps.Diya   || 0) * track + p2Pos;
  const gap = p1Total - p2Total;
  const leadText  = gap === 0 ? 'Tied' : gap > 0 ? `Poojan leads by ${gap}` : `Diya leads by ${Math.abs(gap)}`;
  const leadColor = gap === 0 ? 'var(--stone-gray)' : gap > 0 ? 'var(--deep-red)' : 'var(--royal-blue)';

  return (
    <div>
      <div className="section-title">
        <h2>Game Board</h2>
        <div className="section-title-line" />
        <span className="game-count" style={{ color: leadColor }}>{leadText}</span>
      </div>

      <div className="board-ui">
        {/* Log stream — leftmost column */}
        <div className="tile-card board-log">
          <div className="tile-card-header" style={{ marginBottom: '0.6rem' }}>Score Log</div>
          {log.length === 0 ? (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', margin: 0 }}>
              No moves yet.
            </p>
          ) : (
            <div className="board-log-entries">
              {log.map((entry) => {
                const color = entry.player === 'Poojan'
                  ? 'var(--deep-red)'
                  : entry.player === 'Diya'
                  ? 'var(--royal-blue)'
                  : 'var(--stone-gray)';
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

        {/* Board — centre column */}
        <div className="board-canvas tile-card">
          <div className="board-image">
            <img src={boardImg} alt="Score board" className="board-image-bg" />
            <div
              className="meeple meeple-p1"
              style={{ left: `${p1Coord.x}%`, top: `${p1Coord.y}%` }}
              title={`Poojan: ${(board.laps.Poojan||0)*track + p1Pos} pts`}
            >
              <img src={poojanImg} alt="Poojan" />
            </div>
            <div
              className="meeple meeple-p2"
              style={{ left: `${p2Coord.x + collisionOffset.x}%`, top: `${p2Coord.y + collisionOffset.y}%` }}
              title={`Diya: ${(board.laps.Diya||0)*track + p2Pos} pts`}
            >
              <img src={diyaImg} alt="Diya" />
            </div>
          </div>
        </div>

        {/* Controls — rightmost column */}
        <div className="board-controls">
          {[['Poojan', poojanImg], ['Diya', diyaImg]].map(([name, img]) => {
            const color = name === 'Poojan' ? 'var(--deep-red)' : 'var(--royal-blue)';
            return (
              <div key={name} className="board-player-card tile-card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <img src={img} alt="meeple" style={{ height: 34, width: 'auto' }} />
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 500, color, paddingLeft: '0.4rem' }}>{name}</div>
                  <div style={{ marginLeft: 'auto', fontStyle: 'italic', color, fontSize: '1.1rem', fontWeight: 500 }}>
                    {(board.laps[name] || 0) * track + (board.positions[name] || 0)}
                  </div>
                </div>

                <div className="board-btn-group">
                  {/* Row 1: input spanning full width of the three buttons */}
                  <input
                    type="number"
                    className="form-input board-score-input"
                    value={input[name]}
                    onChange={(e) => setInput(v => ({ ...v, [name]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = Number(input[name] || 0);
                        if (!Number.isNaN(val) && val !== 0) {
                          addPoints(name, val);
                          setInput(v => ({ ...v, [name]: 0 }));
                        }
                      }
                    }}
                  />
                  {/* Row 2: quick-add buttons */}
                  <div className="board-btn-row">
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 1) }))}>+1</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 2) }))}>+2</button>
                    <button type="button" className="btn btn-sm board-btn-equal" onClick={() => setInput(v => ({ ...v, [name]: String(Number(v[name] || 0) + 5) }))}>+5</button>
                  </div>
                  {/* Row 3: Add button full width */}
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

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'stretch' }}>
            <button type="button" className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleReset}>Reset Board</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={undoLastMove}
              disabled={history.length === 0}
              title="Undo last move"
            >Undo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
