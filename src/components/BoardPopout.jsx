import { useEffect, useState } from 'react';
import boardImg from '../../images/score-board.jpg';
import BOARD_PATH from '../data/boardCoords';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
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

export default function BoardPopout() {
  const [state, setState] = useState(null);

  useEffect(() => {
    document.title = 'Board — Carcasscore';
    document.body.style.background = '#120d06';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const ch = new BroadcastChannel('carcasonne-board');
    ch.onmessage = (e) => {
      if (e.data.type === 'BOARD_UPDATE') setState(e.data.payload);
      if (e.data.type === 'GAME_OVER')    window.close();
    };
    ch.postMessage({ type: 'REQUEST_STATE' });
    return () => ch.close();
  }, []);

  if (!state) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#120d06', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: '#555', fontSize: '1rem' }}>
          Waiting for board data…
        </p>
      </div>
    );
  }

  const { board, players, meepleMap } = state;

  const posGroups = {};
  players.forEach(p => {
    const pos = board.positions[p] || 0;
    if (!posGroups[pos]) posGroups[pos] = [];
    posGroups[pos].push(p);
  });

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#120d06', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <img
          src={boardImg}
          alt="Score board"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
                zIndex: 10 + pi,
                transition: 'left 380ms ease, top 380ms ease',
              }}
            >
              <img
                src={MEEPLE_IMGS[meepleMap[p]] || FALLBACK_MEEPLE}
                alt={p}
                style={{ width: 'clamp(32px, 4vw, 60px)', height: 'auto' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
