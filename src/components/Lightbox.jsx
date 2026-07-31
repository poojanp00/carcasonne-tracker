import { useEffect, useRef, useState } from 'react';
import ScoreTimelineChart from './ScoreTimelineChart';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS, STATISTICS_CONFIG } from '../constants';
import { getMeepleColor, formatDurationHMS, formatDateDigital } from '../utils/formatters';
import scrollCapTop    from '../../images/icons/scroll-cap-top.png';
import scrollCapBottom from '../../images/icons/scroll-cap-bottom.png';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const SCORE_GROUPS = [
  { label: 'Road + Inn',              types: ['road', 'inn'] },
  { label: 'City + Cath.',            types: ['city', 'cathedral'] },
  { label: 'Mon. + Abbot + Abbey',    types: ['monastery', 'abbot', 'abbey'] },
  { label: 'Field + Pig + Barn',      types: ['field', 'pig', 'barn'] },
  { label: 'Goods',                   types: ['wine', 'grain', 'cloth'] },
];
const TYPE_TO_GROUP = {};
SCORE_GROUPS.forEach(g => g.types.forEach(t => { TYPE_TO_GROUP[t] = g; }));

// Longer player names get a smaller font instead of being truncated with an ellipsis.
// Takes a character count (the longest name in the list) so every row can share one size.
function nameFontSize(len) {
  if (len <= 7)  return 'clamp(0.8rem, 2.2vw, 0.95rem)';
  if (len <= 10) return 'clamp(0.7rem, 1.9vw, 0.85rem)';
  if (len <= 13) return 'clamp(0.62rem, 1.7vw, 0.75rem)';
  if (len <= 17) return 'clamp(0.55rem, 1.5vw, 0.66rem)';
  return 'clamp(0.48rem, 1.3vw, 0.58rem)';
}


export default function Lightbox({ game, games = [], onNavigate, onClose, onDeleteRequest, realmName = null }) {
  const idx = games.findIndex(g => g.id === game.id);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [combined, setCombined] = useState(false);
  const [sortType, setSortType] = useState(null);
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

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  // Every name renders at the same size/width — set by the longest name — so
  // the score column lines up in the same spot across every player row
  const maxNameLen = Math.max(...sorted.map(p => p.name.length));

  const s1 = sorted[0]?.score ?? 0, s2 = sorted[1]?.score ?? 0;
  const isClutch = topPlayers.length === 1 && (s1 + s2) > 0 && (s1 - s2) / (s1 + s2) < STATISTICS_CONFIG.CLUTCH_THRESHOLD;

  const slideClass = animDir === 'down' ? 'lb-slide-down' : animDir === 'up' ? 'lb-slide-up' : '';

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <div key={animKey} className={`lightbox-meta ${slideClass}`}>
          <div className="section-title">
            <h2>Final Scores</h2>
            <div className="section-title-line" />
          </div>

          {/* Info bar: date (left) · realm name (centered) · duration
              (right) — expansions live in their own box near the bottom,
              below the score timeline. Date and duration share the same LED
              stadium-clock look (.game-clock-digits--record) and the same
              fixed width, so the middle segment's flex: 1 auto-centers the
              realm name in the true middle of the bar. The clutch/farm win
              stickers that used to live in this middle segment now sit next
              to the "Score Timeline" title instead (see ScoreTimelineChart.jsx). */}
          <div className="lb-info-bar" style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', flexWrap: 'nowrap', gap: '1rem', alignItems: 'center' }}>
            <div className="game-clock">
              <div className="game-clock-housing">
                <span className="game-clock-digits game-clock-digits--record">{formatDateDigital(game.date)}</span>
              </div>
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {realmName && <h2 style={{ margin: 0, color: 'var(--earth-brown)', textAlign: 'center', fontSize: 'clamp(0.4rem, 3.4vw, 1.3rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{realmName}</h2>}
            </div>
            {(game.gameDuration || 0) > 0 && (
              <div className="game-clock">
                <div className="game-clock-housing">
                  <span className="game-clock-digits game-clock-digits--record">{formatDurationHMS(game.gameDuration)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Standings: one bordered card per player, meeple-colored */}
          <div style={{ maxWidth: '560px', margin: '0 auto 0.5rem' }}>
            <div className="standings-scroll-top">
              <img src={scrollCapTop} alt="" className="standings-scroll-cap" />
              <div className="chart-header standings-scroll-title">Standings</div>
            </div>
            <div className="standings-scroll-body">
            <div className="postgame-scores-grid">
              {sorted.map((p) => {
                const color = getMeepleColor(p.meeple);
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                    {/* Headline-record medal chips now live on the score timeline
                        instead of here (see ScoreTimelineChart.jsx) — just name and
                        score in this row. */}
                    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={MEEPLE_IMGS[p.meeple] || FALLBACK_MEEPLE} alt={p.name} style={{ height: 'clamp(18px, 5vw, 26px)', width: 'auto', flexShrink: 0 }} />
                      {/* Name — every row shares one font size and width (both set by
                          the longest name) so scores line up directly to the right of
                          the longest name across every row */}
                      <span style={{
                        fontFamily: 'Cinzel, serif',
                        color,
                        fontWeight: 600,
                        fontSize: nameFontSize(maxNameLen),
                        flex: '0 0 auto',
                        width: `${maxNameLen}ch`,
                        whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </span>
                      {/* Score — a bit of breathing room after the name, now that
                          the row is content-sized rather than stretched
                          edge-to-edge (see .postgame-scores-grid). */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        marginLeft: '1.5rem',
                        alignSelf: 'stretch',
                      }}>
                        <div className="game-clock">
                          <div className="game-clock-housing">
                            <span className="game-clock-digits game-clock-digits--score">{p.score}</span>
                          </div>
                        </div>
                      </span>
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
            </div>
            <img src={scrollCapBottom} alt="" className="standings-scroll-cap" />
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

            const totalBreakdown = {};
            game.players.forEach(p => {
              Object.entries(p.breakdown || {}).forEach(([t, v]) => {
                totalBreakdown[t] = (totalBreakdown[t] || 0) + (v || 0);
              });
            });

            const displayPlayers = combined
              ? [{ name: 'All Players', breakdown: totalBreakdown, score: sorted.reduce((s, p) => s + p.score, 0) }]
              : sorted;

            // Combined bar fills the same vertical space as the per-player rows (16px rows, 0.45rem gaps)
            const barHeight = combined ? `calc(${sorted.length} * 16px + ${sorted.length - 1} * 0.45rem)` : '16px';

            const maxTotal = Math.max(1, ...displayPlayers.map(p => {
              const bd = p.breakdown || {};
              return displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
            }));

            return (
              <div className="chart-wrapper" style={{ marginBottom: '1.4rem' }}>
                <div className="chart-container" style={{ borderTop: '4px solid var(--warm-gold)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <div className="chart-header" style={{ margin: 0, textAlign: 'left' }}>
                    Points Breakdown
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCombined(v => !v); setTooltip(null); }}
                    style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '4px', cursor: 'var(--cursor-pointer)', padding: '0.15rem 0.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: combined ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: combined ? 1 : 0.7, letterSpacing: '0.05em' }}
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
                  {displayPlayers.map(p => {
                    const bd = p.breakdown || {};
                    const total = displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
                    return (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.58rem, 1.6vw, 0.72rem)', color: topPlayers.includes(p.name) ? 'var(--forest-green)' : 'var(--stone-gray)', fontWeight: topPlayers.includes(p.name) ? 700 : 400, minWidth: '64px', textAlign: 'right', flexShrink: 0 }}>
                          {p.name}
                        </span>
                        <div style={{ flex: 1, height: barHeight }}>
                          <div style={{ width: `${(total / maxTotal) * 100}%`, height: barHeight, borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                          {total === 0
                            ? <div style={{ flex: 1, backgroundColor: 'var(--stone-gray)', opacity: 0.2 }} />
                            : orderedTypes.map(t => {
                                const val = bd[t] || 0;
                                if (val === 0) return null;
                                return (
                                  <div
                                    key={t}
                                    style={{ flex: val / total, backgroundColor: SCORE_TYPE_COLORS[t], cursor: 'var(--cursor-arrow)' }}
                                    onMouseEnter={(e) => {
                                      if (!barsRef.current) return;
                                      const segRect = e.currentTarget.getBoundingClientRect();
                                      const containerRect = barsRef.current.getBoundingClientRect();
                                      setTooltip({
                                        type: t,
                                        value: val,
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
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', color: 'rgba(240,230,210,0.7)', marginBottom: '0.1rem' }}>
                        {TYPE_LABELS[tooltip.type] ?? tooltip.type}
                      </div>
                      <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.85rem' }}>
                        {tooltip.value}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'var(--cursor-pointer)', padding: '0.25rem 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', gap: '0.4rem', opacity: 0.6 }}
                >
                  {showTable ? '▲' : '▼'}
                </button>

                {showTable && <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem 0.3rem 0', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', fontWeight: 400, fontSize: 'clamp(0.55rem, 1.5vw, 0.68rem)', whiteSpace: 'nowrap' }}>Player</th>
                        {orderedTypes.map(t => (
                          <th
                            key={t}
                            onClick={() => setSortType(s => s === t ? null : t)}
                            style={{ padding: '0.25rem 0.3rem', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 'clamp(0.5rem, 1.4vw, 0.62rem)', textAlign: 'center', color: sortType === t ? 'var(--earth-brown)' : 'var(--stone-gray)', whiteSpace: 'nowrap', cursor: 'var(--cursor-pointer)', userSelect: 'none', textDecoration: sortType === t ? 'underline' : 'none' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], display: 'inline-block', flexShrink: 0 }} />
                              {TYPE_LABELS[t] ?? t}
                              {sortType === t && <span style={{ fontSize: '0.5rem' }}>▼</span>}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(sortType
                        ? [...sorted].sort((a, b) => ((b.breakdown || {})[sortType] || 0) - ((a.breakdown || {})[sortType] || 0))
                        : sorted
                      ).map((p) => (
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
                      {combined && <tr style={{ borderTop: '2px solid rgba(201,163,74,0.45)' }}>
                        <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: 'clamp(0.62rem, 1.8vw, 0.78rem)', color: 'var(--earth-brown)', whiteSpace: 'nowrap' }}>
                          Total
                        </td>
                        {orderedTypes.map(t => {
                          const val = totalBreakdown[t] || 0;
                          return (
                            <td key={t} style={{ padding: '0.35rem 0.3rem', textAlign: 'center', fontFamily: 'Crimson Text, serif', fontWeight: 700, fontSize: 'clamp(0.72rem, 1.8vw, 0.88rem)', color: val > 0 ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: val > 0 ? 1 : 0.35 }}>
                              {val > 0 ? val : '—'}
                            </td>
                          );
                        })}
                      </tr>}
                    </tbody>
                  </table>
                </div>}
                </div>
              </div>
            );
          })()}

          {/* Score swing timeline */}
          {game.scoreTimeline?.length > 0 && (
            <div style={{ marginBottom: '1.4rem' }}>
              <ScoreTimelineChart
                timeline={game.scoreTimeline}
                players={game.players.map(p => p.name)}
                duration={game.gameDuration}
                achievements={game.achievements}
                isClutch={isClutch}
                farmWin={game.farmWin && topPlayers.length === 1}
              />
            </div>
          )}

          {/* Expansions — own box near the bottom, below the score timeline */}
          <div style={{ marginBottom: '1.4rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem' }}>
            <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
              {game.expansions.length === 0 ? 'Base Game' : game.expansions.join(' · ')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: onDeleteRequest ? 'space-between' : 'flex-end', marginTop: '1.6rem' }}>
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
