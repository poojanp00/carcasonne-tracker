import { useEffect, useRef, useState } from 'react';
import GameHighlights from './GameHighlights';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import pigImg from '../../images/icons/pig.png';
import cImg   from '../../images/icons/C.png';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};

const SCORE_GROUPS = [
  { label: 'Road + Inn',              types: ['road', 'inn'] },
  { label: 'City + Cath.',            types: ['city', 'cathedral'] },
  { label: 'Mon. + Abbot + Abbey',    types: ['monastery', 'abbot', 'abbey'] },
  { label: 'Field + Pig + Barn',      types: ['field', 'pig', 'barn'] },
  { label: 'Goods',                   types: ['wine', 'grain', 'cloth'] },
];
const TYPE_TO_GROUP = {};
SCORE_GROUPS.forEach(g => g.types.forEach(t => { TYPE_TO_GROUP[t] = g; }));

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}


export default function Lightbox({ game, games = [], onNavigate, onClose, onDeleteRequest }) {
  const idx = games.findIndex(g => g.id === game.id);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [combined, setCombined] = useState(false);
  const barsRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ') { onClose(); return; }
      if (e.key === 'ArrowDown' && idx < games.length - 1) {
        setAnimDir('down'); setAnimKey(k => k + 1); onNavigate(games[idx + 1]);
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        setAnimDir('up'); setAnimKey(k => k + 1); onNavigate(games[idx - 1]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, idx, games]);

  const topPlayers = game.winners || [];  // Use precomputed winners from database
  const winnerText = topPlayers.length === 0 
    ? 'No winner' 
    : topPlayers.length > 1 
    ? `${topPlayers.join(' & ')} win` 
    : `${topPlayers[0]} wins`;

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const margin = topPlayers.length === 1 && sorted.length > 1 ? sorted[0].score - sorted[1].score : null;
  const s1 = sorted[0]?.score ?? 0, s2 = sorted[1]?.score ?? 0;
  const isClutch = topPlayers.length === 1 && (s1 + s2) > 0 && (s1 - s2) / (s1 + s2) < 0.10;

  const slideClass = animDir === 'down' ? 'lb-slide-down' : animDir === 'up' ? 'lb-slide-up' : '';

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <div key={animKey} className={`lightbox-meta ${slideClass}`}>
          <p style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: 'clamp(0.75rem, 2vw, 0.88rem)', marginBottom: '0.5rem' }}>
            {formatDate(game.date)}
          </p>

          <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--earth-brown)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {winnerText}
            {isClutch && (
              <span className="val-info-wrap">
                <img src={cImg} alt="clutch" style={{ height: 20, width: 'auto', opacity: 0.85 }} />
                <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Clutch win</span>
              </span>
            )}
            {game.farmWin && topPlayers.length === 1 && (
              <span className="val-info-wrap">
                <img src={pigImg} alt="farm win" style={{ height: 14, width: 'auto', opacity: 0.85 }} />
                <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Farm win</span>
              </span>
            )}
          </h3>

          {margin !== null && (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: 'clamp(0.78rem, 2vw, 0.9rem)', color: 'var(--stone-gray)', marginBottom: '1rem' }}>
              +{margin} point margin
            </p>
          )}

          {/* Player scores */}
          <div style={{ marginBottom: '1.2rem' }}>
            {sorted.map((p, i) => {
              const isWinner = topPlayers.includes(p.name);
              return (
                <div
                  key={p.name}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: i < sorted.length - 1 ? '1px solid rgba(201,163,74,0.25)' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)',
                    fontWeight: isWinner ? 700 : 400,
                    color: isWinner ? 'var(--forest-green)' : 'var(--charcoal)',
                  }}>
                    {p.name}
                  </span>
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: 'clamp(0.88rem, 2.5vw, 1.05rem)',
                    fontWeight: isWinner ? 700 : 400,
                    color: isWinner ? 'var(--forest-green)' : 'var(--stone-gray)',
                  }}>
                    {p.score}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Points breakdown table */}
          {(() => {
            const usedTypes = new Set();
            game.players.forEach(p => {
              Object.entries(p.breakdown || {}).forEach(([t, v]) => { if (v > 0) usedTypes.add(t); });
            });
            const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));
            if (displayTypes.length === 0) return null;

            const TYPE_LABELS = {
              road: 'Road', city: 'City', monastery: 'Mon.', field: 'Field',
              abbot: 'Abbot', inn: 'Inn', cathedral: 'Cath.', wine: 'Wine',
              grain: 'Grain', cloth: 'Cloth', pig: 'Pig', abbey: 'Abbey',
              barn: 'Barn', princess: 'Prin.', fairy: 'Fairy',
              largest_city: 'L.City', largest_road: 'L.Road', wagon: 'Wagon',
            };

            const orderedTypes = [
              ...SCORE_GROUPS.flatMap(g => g.types.filter(t => displayTypes.includes(t))),
              ...displayTypes.filter(t => !TYPE_TO_GROUP[t]),
            ];

            const maxTotal = Math.max(1, ...sorted.map(p => {
              const bd = p.breakdown || {};
              return displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
            }));

            return (
              <div style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.75rem)', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)' }}>
                    POINTS BREAKDOWN
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCombined(v => !v); setTooltip(null); }}
                    style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '4px', cursor: 'pointer', padding: '0.15rem 0.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: combined ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: combined ? 1 : 0.7, letterSpacing: '0.05em' }}
                  >
                    {combined ? 'Split' : 'Combine'}
                  </button>
                </div>
                {/* Proportional bars — one per player */}
                <div
                  ref={barsRef}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem', position: 'relative' }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {sorted.map(p => {
                    const bd = p.breakdown || {};
                    const total = displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
                    return (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.58rem, 1.6vw, 0.72rem)', color: topPlayers.includes(p.name) ? 'var(--forest-green)' : 'var(--stone-gray)', fontWeight: topPlayers.includes(p.name) ? 700 : 400, minWidth: '64px', textAlign: 'right', flexShrink: 0 }}>
                          {p.name}
                        </span>
                        <div style={{ flex: 1, height: '16px' }}>
                          <div style={{ width: `${(total / maxTotal) * 100}%`, height: '16px', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                          {total === 0
                            ? <div style={{ flex: 1, backgroundColor: 'var(--stone-gray)', opacity: 0.2 }} />
                            : orderedTypes.map(t => {
                                const val = bd[t] || 0;
                                if (val === 0) return null;
                                return (
                                  <div
                                    key={t}
                                    style={{ flex: val / total, backgroundColor: SCORE_TYPE_COLORS[t], cursor: 'default' }}
                                    onMouseEnter={(e) => {
                                      if (!barsRef.current) return;
                                      const segRect = e.currentTarget.getBoundingClientRect();
                                      const containerRect = barsRef.current.getBoundingClientRect();
                                      const group = combined ? TYPE_TO_GROUP[t] : null;
                                      const groupValue = group ? group.types.reduce((s, gt) => s + (bd[gt] || 0), 0) : null;
                                      setTooltip({
                                        type: t,
                                        value: val,
                                        groupLabel: group?.label ?? null,
                                        groupValue,
                                        x: segRect.left + segRect.width / 2 - containerRect.left,
                                        y: segRect.top - containerRect.top,
                                      });
                                    }}
                                  />
                                );
                              })
                          }
                          </div>
                        </div>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'var(--stone-gray)', minWidth: '24px', flexShrink: 0 }}>
                          {p.score}
                        </span>
                      </div>
                    );
                  })}

                  {tooltip && (
                    <div style={{
                      position: 'absolute',
                      left: tooltip.x,
                      top: tooltip.y,
                      transform: 'translate(-50%, calc(-100% - 6px))',
                      background: 'var(--earth-brown)',
                      color: 'var(--parchment)',
                      padding: '0.3rem 0.55rem',
                      borderRadius: '6px',
                      zIndex: 100,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
                      textAlign: 'center',
                    }}>
                      {combined && tooltip.groupLabel ? (
                        <>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', color: 'rgba(240,230,210,0.7)', marginBottom: '0.1rem' }}>
                            {tooltip.groupLabel}
                          </div>
                          <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.85rem' }}>
                            {tooltip.groupValue}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', color: 'rgba(240,230,210,0.7)', marginBottom: '0.1rem' }}>
                            {TYPE_LABELS[tooltip.type] ?? tooltip.type}
                          </div>
                          <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.85rem' }}>
                            {tooltip.value}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', gap: '0.4rem', opacity: 0.6 }}
                >
                  {showTable ? '▲' : '▼'}
                </button>

                {showTable && <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem 0.3rem 0', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', fontWeight: 400, fontSize: 'clamp(0.55rem, 1.5vw, 0.68rem)', whiteSpace: 'nowrap' }}>Player</th>
                        {orderedTypes.map(t => (
                          <th key={t} style={{ padding: '0.25rem 0.3rem', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 'clamp(0.5rem, 1.4vw, 0.62rem)', textAlign: 'center', color: 'var(--stone-gray)', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], display: 'inline-block', flexShrink: 0 }} />
                              {TYPE_LABELS[t] ?? t}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((p) => (
                        <tr key={p.name} style={{ borderTop: '1px solid rgba(201,163,74,0.2)' }}>
                          <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 1.8vw, 0.78rem)', color: topPlayers.includes(p.name) ? 'var(--forest-green)' : 'var(--charcoal)', fontWeight: topPlayers.includes(p.name) ? 700 : 400, whiteSpace: 'nowrap' }}>
                            {p.name}
                          </td>
                          {orderedTypes.map(t => {
                            const val = (p.breakdown || {})[t] || 0;
                            return (
                              <td key={t} style={{ padding: '0.35rem 0.3rem', textAlign: 'center', fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.72rem, 1.8vw, 0.88rem)', color: val > 0 ? 'var(--charcoal)' : 'var(--stone-gray)', opacity: val > 0 ? 1 : 0.35 }}>
                                {val > 0 ? val : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
              </div>
            );
          })()}

          {/* Game Records */}
          {game.achievements && Object.keys(game.achievements).length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <GameHighlights achievements={game.achievements} />
            </div>
          )}

          {/* Expansions */}
          {game.expansions.length > 0 ? (
            <div className="expansion-chips" style={{ marginTop: '1.6rem', marginBottom: '1.2rem' }}>
              {game.expansions.map(exp => (
                <span key={exp} className="expansion-chip display-only">{exp}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', display: 'block', marginTop: '1.6rem', marginBottom: '1.2rem' }}>
              Base game — no expansions
            </span>
          )}

          <div style={{ display: 'flex', justifyContent: onDeleteRequest ? 'space-between' : 'flex-end' }}>
            {onDeleteRequest && (
              <button
                className="btn btn-sm"
                onClick={() => onDeleteRequest()}
                style={{ background: 'var(--deep-red)', borderColor: 'var(--deep-red)', color: '#fff' }}
              >
                Delete
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ color: 'var(--deep-red)', borderColor: 'var(--deep-red)' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
