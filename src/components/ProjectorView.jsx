import { useEffect, useRef, useState } from 'react';
import boardImg from '../../images/score-board.jpg';
import BOARD_PATH from '../data/boardCoords';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const STACK_OFFSETS = [
  { x: 0,  y:  0 },
  { x: 3,  y: -3 },
  { x: -3, y: -3 },
  { x: 3,  y:  3 },
  { x: -3, y:  3 },
  { x: 0,  y: -5 },
];

const MEEPLE_COLOR_MAP = {
  blue:   '#2563EB',
  red:    '#DC2626',
  yellow: '#B8860B',
  green:  '#16A34A',
  black:  '#111827',
  pink:   '#EC4899',
};
// Black meeple is near-invisible on dark projector background — use light gray instead
const MEEPLE_PROJECTOR_COLOR_MAP = {
  ...MEEPLE_COLOR_MAP,
  black: '#9CA3AF',
};
const FALLBACK_COLOR = '#8B5E3C';

function getMeepleColor(filename) {
  if (!filename) return FALLBACK_COLOR;
  const match = filename.match(/blue|red|yellow|green|black|pink/i);
  return match ? (MEEPLE_PROJECTOR_COLOR_MAP[match[0].toLowerCase()] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

function computeLog(board, players) {
  if (!board || !board.moves) return [];
  const entries = [];
  const track = board.trackLength || 50;
  const playerPositions = Object.fromEntries(players.map(p => [p, 0]));
  const playerLaps      = Object.fromEntries(players.map(p => [p, 0]));

  for (let i = 0; i <= board.moveIndex; i++) {
    const move = board.moves[i];
    if (!move) continue;
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
    if (isGoodsMove) continue;
    const curPos  = playerPositions[move.player] || 0;
    const curLaps = playerLaps[move.player] || 0;
    const sum     = curPos + move.amount;
    const lapInc  = Math.floor(sum / track);
    const newPos  = ((sum % track) + track) % track;
    const newLaps = curLaps + (lapInc > 0 ? lapInc : 0);
    playerPositions[move.player] = newPos;
    playerLaps[move.player]      = newLaps;
    if (newLaps > curLaps) {
      entries.push({
        type: 'lap',
        msg: `${move.player} completed Lap ${newLaps}`,
        player: move.player,
        time: new Date(move.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: move.timestamp + 1,
        id: `lap-${i}-${newLaps}`,
      });
    }
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
  if (board.undoLog?.length > 0) {
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
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

function formatElapsed(ms) {
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export default function ProjectorView() {
  const [state, setState] = useState(null);
  const [now,   setNow]   = useState(Date.now());

  useEffect(() => {
    document.title = 'Projector — Carcasscore';
    document.body.classList.add('projector-mode');
    return () => document.body.classList.remove('projector-mode');
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel('carcasonne-projector');
    channel.onmessage = (e) => {
      if (e.data.type === 'STATE_UPDATE') setState(e.data.payload);
      if (e.data.type === 'GAME_OVER') window.close();
    };
    channel.postMessage({ type: 'REQUEST_STATE' });
    return () => channel.close();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!state?.board) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#120d06',
        color: '#C9A34A',
        fontFamily: 'Cinzel, serif',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <h2 style={{ fontSize: '2rem', letterSpacing: '0.12em' }}>Projector Mode</h2>
        <p style={{ fontFamily: 'Crimson Text, serif', color: '#7D7D7D', fontSize: '1.1rem', fontStyle: 'italic' }}>
          Waiting for game data...
        </p>
        <p style={{ fontFamily: 'Crimson Text, serif', color: '#555', fontSize: '0.9rem' }}>
          Press{' '}
          <kbd style={{
            fontFamily: 'monospace',
            background: 'rgba(201,163,74,0.15)',
            padding: '0.1rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(201,163,74,0.4)',
            color: '#C9A34A',
          }}>P</kbd>
          {' '}on the scoreboard in the main window.
        </p>
      </div>
    );
  }

  const { board, players, meepleMap, realmName } = state;
  const track   = board.trackLength || 50;
  const elapsed = formatElapsed(now - (board.startTime || now));
  const log     = computeLog(board, players);

  const totals   = Object.fromEntries(players.map(p => [p, (board.laps[p] || 0) * track + (board.positions[p] || 0)]));
  const maxTotal = Math.max(...Object.values(totals), 0);
  const leaders  = maxTotal > 0 ? players.filter(p => totals[p] === maxTotal) : [];
  const leadText = leaders.length === 0
    ? 'No scores yet'
    : leaders.length === 1
    ? `${leaders[0]} leads`
    : `${leaders.join(' & ')} lead`;
  const leadColor = leaders.length === 1 ? getMeepleColor(meepleMap[leaders[0]]) : '#C9A34A';

  const posGroups = {};
  players.forEach(p => {
    const pos = board.positions[p] || 0;
    if (!posGroups[pos]) posGroups[pos] = [];
    posGroups[pos].push(p);
  });

  return (
    <div style={{
      height: '100vh',
      background: '#120d06',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Cinzel, serif',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1.2rem',
        borderBottom: '2px solid rgba(201,163,74,0.35)',
        background: 'rgba(201,163,74,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.8rem', color: '#C9A34A', letterSpacing: '0.18em', opacity: 0.65 }}>
          CARCASSCORE
        </span>
        {realmName && (
          <span style={{
            fontSize: '0.82rem',
            color: '#C9A34A',
            background: 'rgba(201,163,74,0.12)',
            padding: '0.18rem 0.75rem',
            borderRadius: '999px',
            border: '1px solid rgba(201,163,74,0.28)',
            letterSpacing: '0.06em',
          }}>
            {realmName}
          </span>
        )}
        <span style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: '#7D7D7D', fontSize: '0.9rem' }}>
          {elapsed}
        </span>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Left: player scores + board image */}
        <div style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* Player score chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
            {players.map(p => {
              const color    = getMeepleColor(meepleMap[p]);
              const isLeader = leaders.includes(p);
              return (
                <div key={p} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.3rem 0.8rem 0.3rem 0.4rem',
                  borderRadius: '10px',
                  background: isLeader ? `${color}20` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isLeader ? color : 'rgba(255,255,255,0.1)'}`,
                  transition: 'border-color 0.35s ease, background 0.35s ease',
                }}>
                  <img
                    src={MEEPLE_IMGS[meepleMap[p]] || FALLBACK_MEEPLE}
                    alt={p}
                    style={{ height: 28, width: 'auto' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.6rem', color, letterSpacing: '0.08em', opacity: 0.85 }}>{p.toUpperCase()}</div>
                    <div style={{
                      fontSize: '1.5rem',
                      color: isLeader ? color : '#D4C08A',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}>
                      {totals[p]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Board image — natural width so %-based meeple coords stay accurate */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            <div style={{
              position: 'relative',
              width: '100%',
              maxHeight: '100%',
            }}>
              <img
                src={boardImg}
                alt="Score board"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: '6px',
                  border: '1px solid rgba(201,163,74,0.2)',
                }}
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
                    style={{
                      position: 'absolute',
                      left: `${coord.x + off.x}%`,
                      top:  `${coord.y + off.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 30 + pi,
                      transition: 'left 380ms ease, top 380ms ease',
                    }}
                    title={`${p}: ${totals[p]} pts`}
                  >
                    <img
                      src={MEEPLE_IMGS[meepleMap[p]] || FALLBACK_MEEPLE}
                      alt={p}
                      style={{ width: 'clamp(28px, 3.5vw, 52px)', height: 'auto' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: score log */}
        <div style={{
          flex: '0 0 300px',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.025)',
          borderRadius: '8px',
          border: '1px solid rgba(201,163,74,0.15)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.55rem 0.9rem',
            borderBottom: '1px solid rgba(201,163,74,0.18)',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            color: 'rgba(201,163,74,0.75)',
            flexShrink: 0,
          }}>
            SCORE LOG
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.4rem 0.7rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.18rem',
            minHeight: 0,
          }}>
            {log.length === 0 && (
              <p style={{
                fontFamily: 'Crimson Text, serif',
                fontStyle: 'italic',
                color: '#555',
                fontSize: '0.9rem',
                margin: '0.5rem 0',
              }}>
                No moves yet.
              </p>
            )}
            {[...log].reverse().map(entry => {
              const color  = entry.player ? getMeepleColor(meepleMap[entry.player]) : '#7D7D7D';
              const isUndo = entry.type === 'undo';
              const isBold = entry.type === 'lap' || entry.type === 'final-scoring';
              return (
                <div key={entry.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '0.4rem',
                  color,
                  opacity: isUndo ? 0.5 : 1,
                  fontSize: '0.83rem',
                  fontFamily: 'Crimson Text, serif',
                  fontStyle: 'italic',
                  fontWeight: isBold ? 600 : 400,
                  borderBottom: '1px solid rgba(139,94,60,0.1)',
                  paddingBottom: '0.18rem',
                }}>
                  <span style={{ textDecoration: isUndo ? 'line-through' : 'none', flex: 1 }}>
                    {entry.player && !isUndo && (
                      <img
                        src={MEEPLE_IMGS[meepleMap[entry.player]] || FALLBACK_MEEPLE}
                        alt=""
                        style={{ height: 13, width: 'auto', verticalAlign: 'middle', marginRight: '0.2rem' }}
                      />
                    )}
                    {entry.msg}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#555', flexShrink: 0, fontStyle: 'normal' }}>
                    {entry.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer: lead status ── */}
      <div style={{
        padding: '0.38rem 1.2rem',
        borderTop: '1px solid rgba(201,163,74,0.12)',
        display: 'flex',
        justifyContent: 'center',
        background: 'rgba(201,163,74,0.04)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.82rem', color: leadColor, letterSpacing: '0.09em' }}>
          {leadText}
        </span>
      </div>
    </div>
  );
}
