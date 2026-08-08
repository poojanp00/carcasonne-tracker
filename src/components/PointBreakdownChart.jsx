import { useState, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { rankTitle } from '../utils/metaRank';

const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  abbot: 'Abbot', inn: 'Inn', cathedral: 'Cathedral',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  abbey: 'Abbey', barn: 'Barn',
  princess: 'Princess', fairy: 'Fairy',
  largest_city: 'Largest City', largest_road: 'Largest Road',
  wagon: 'Wagon',
};

const SCORE_GROUPS = [
  { label: 'Road + Inn',           types: ['road', 'inn'] },
  { label: 'City + Cath.',         types: ['city', 'cathedral'] },
  { label: 'Mon. + Abbot + Abbey', types: ['monastery', 'abbot', 'abbey'] },
  { label: 'Field + Pig + Barn',   types: ['field', 'pig', 'barn'] },
  { label: 'Goods',                types: ['wine', 'grain', 'cloth'] },
];

const TYPE_TO_GROUP = {};
SCORE_GROUPS.forEach(g => g.types.forEach(t => { TYPE_TO_GROUP[t] = g; }));

/**
 * Proportional per-player point bars with a Combine toggle and expandable table.
 *
 * @param {string}    title        - Card header (e.g. a realm name when used as the standings box)
 * @param {Object}    winsByPlayer - Optional {name: wins}; renders a win count before each name
 * @param {ReactNode} footer       - Optional content rendered below the bars/table (e.g. realm stats)
 * @param {boolean}   footerAlways - Show the footer outright instead of tucking it behind the dropdown
 * @param {boolean}   bare         - Render without the card box, directly on the page background
 */
export default function PointBreakdownChart({ players, showLegend = false, title = 'Complete Points Breakdown', winsByPlayer = null, rankByPlayer = null, statusByPlayer = null, onInvite = null, footer = null, footerAlways = false, bare = false }) {
  const [tooltip, setTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [combined, setCombined] = useState(false);
  const [sortType, setSortType] = useState(null);
  const barsRef = useRef(null);

  if (!players || players.length === 0) return null;

  const usedTypes = new Set();
  players.forEach(player => {
    Object.entries(player.breakdown || {}).forEach(([t, v]) => { if (v > 0) usedTypes.add(t); });
  });

  // Standings mode (winsByPlayer set) still renders with no scored points yet
  if (usedTypes.size === 0 && !winsByPlayer) return null;

  const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));

  const orderedTypes = [
    ...SCORE_GROUPS.flatMap(g => g.types.filter(t => displayTypes.includes(t))),
    ...displayTypes.filter(t => !TYPE_TO_GROUP[t]),
  ];

  const totalBreakdown = {};
  players.forEach(player => {
    Object.entries(player.breakdown || {}).forEach(([t, v]) => {
      totalBreakdown[t] = (totalBreakdown[t] || 0) + (v || 0);
    });
  });

  const displayPlayers = combined
    ? [{ name: 'All Players', breakdown: totalBreakdown }]
    : players;

  // Combined bar fills the same vertical space as the per-player rows (24px rows, 8px gaps)
  const barHeight = combined ? `${24 * players.length + 8 * (players.length - 1)}px` : '24px';

  const maxTotal = Math.max(1, ...displayPlayers.map(player => {
    const bd = player.breakdown || {};
    return displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
  }));

  function handleMouseEnter(e, type, val) {
    if (!barsRef.current) return;
    const segRect = e.currentTarget.getBoundingClientRect();
    const containerRect = barsRef.current.getBoundingClientRect();
    setTooltip({
      type,
      value: val,
      x: segRect.left + segRect.width / 2 - containerRect.left,
      y: segRect.top - containerRect.top,
    });
  }

  return (
    <div className="chart-wrapper">
      <div className={`chart-container${bare ? ' chart-container-bare' : ''}`} style={bare ? undefined : { borderTop: '4px solid var(--warm-gold)', paddingTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
          <div className="chart-header" style={{ margin: 0, textAlign: 'left' }}>{title}</div>
          <button
            type="button"
            onClick={() => { setCombined(v => !v); setTooltip(null); }}
            style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '4px', cursor: 'var(--cursor-pointer)', padding: '0.15rem 0.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: combined ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: combined ? 1 : 0.7, letterSpacing: '0.05em' }}
          >
            {combined ? 'Split' : 'Combine'}
          </button>
        </div>

        {showLegend && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem', marginBottom: '0.9rem' }}>
            {orderedTypes.map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--stone-gray)' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], flexShrink: 0, display: 'inline-block' }} />
                {TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}

        {/* Column titles for the standings box (RealmBook's Cover page,
            winsByPlayer set). Widths below are `rem`/px, never `em`/`ch` —
            those are relative to each ELEMENT's own font-size, and the
            title row's font-size doesn't match the value row's (e.g. Wins'
            number is much larger, the rank badge much smaller), so an
            em/ch width shared between the two came out a different pixel
            width in each row and the columns drifted out of alignment.
            Rank/Wins/Player titles are centered within that same
            fixed-width box the value row uses, so they sit over the column
            as a whole regardless of how the value itself is aligned inside
            it. Points centers over the bar only — the trailing empty span
            below reserves the same minWidth as the row's own total-number
            column (see the row's flex:1 bar + minWidth:'28px' number), so
            Points' own flex:1 box lines up with just the bar instead of
            also swallowing that number's width. */}
        {winsByPlayer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--stone-gray)', minWidth: '2.2rem', textAlign: 'left', flexShrink: 0 }}>Wins</span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--stone-gray)', width: 'clamp(64px, 18vw, 150px)', minWidth: 0, textAlign: 'left', flexShrink: 0 }}>Player</span>
            {rankByPlayer && (
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--stone-gray)', flexShrink: 0, width: '4.5rem', textAlign: 'center' }}>Rank</span>
            )}
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--stone-gray)', flex: 1, textAlign: 'center' }}>Points</span>
            <span style={{ minWidth: '28px', flexShrink: 0 }} />
          </div>
        )}

        <div
          ref={barsRef}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem', position: 'relative' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {displayPlayers.map(player => {
            const bd = player.breakdown || {};
            const total = displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
            return (
              <div key={player.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {winsByPlayer && (
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1rem, 3vw, 1.3rem)', color: 'var(--forest-green)', fontWeight: 600, minWidth: '2.2rem', textAlign: 'left', flexShrink: 0 }}>
                    {winsByPlayer[player.name] ?? ''}
                  </span>
                )}
                {/* Narrower on tight phone widths than the old fixed
                    100-180px range — that reserved more room than most
                    names need and left too little for the bar itself on a
                    narrow screen; a long name now just ellipsizes instead. */}
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: winsByPlayer ? 'clamp(1rem, 3vw, 1.3rem)' : 'clamp(0.6rem, 1.8vw, 0.78rem)', color: winsByPlayer ? 'var(--charcoal)' : 'var(--stone-gray)', width: winsByPlayer ? 'clamp(64px, 18vw, 150px)' : 'clamp(48px, 12vw, 80px)', minWidth: 0, textAlign: winsByPlayer ? 'left' : 'right', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {player.name}
                </span>
                {/* Fixed-width slot — moved here from the Roster/Fellowship
                    page's PlayerCard, only ever set (rankByPlayer) when this
                    chart is used as Overview's standings box. rankByPlayer
                    is only populated for a linked member (see RealmBook's
                    progressByName) — an unlinked/guest player, or one whose
                    progress hasn't loaded yet, falls back to rank 1
                    (Wanderer) instead of leaving the slot blank. A player
                    who hasn't joined at all (statusByPlayer, also
                    RealmBook-only) gets an Invite button in this same slot
                    instead of the Wanderer badge — this standings box is
                    the one place that shows every player's rank at once, so
                    it's the natural home for inviting whoever's missing. */}
                {rankByPlayer && (
                  onInvite && statusByPlayer?.[player.name] === 'uninvited' ? (
                    // Same .player-card-rank-badge look as every other
                    // player's rank pill in this row — just a <button>
                    // instead of a <span> so it's clickable, reading as "an
                    // empty rank slot you can fill" rather than a
                    // differently-styled control dropped into the row.
                    <button
                      type="button"
                      className="player-card-rank-badge"
                      style={{ flexShrink: 0, width: '4.5rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'var(--cursor-pointer)' }}
                      title="Invite an account to link to this player"
                      onClick={() => onInvite(player.name)}
                    >
                      Invite
                    </button>
                  ) : (
                    <span
                      className="player-card-rank-badge"
                      style={{ flexShrink: 0, width: '4.5rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {rankTitle(rankByPlayer[player.name] ?? 1)}
                    </span>
                  )
                )}
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
                              onMouseEnter={(e) => handleMouseEnter(e, t, val)}
                            />
                          );
                        })
                    }
                  </div>
                </div>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.6rem, 1.8vw, 0.78rem)', color: 'var(--stone-gray)', minWidth: '28px', textAlign: 'right', flexShrink: 0 }}>
                  {total}
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

        {displayTypes.length > 0 && <button
          type="button"
          onClick={() => setShowTable(v => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'var(--cursor-pointer)', padding: '0.25rem 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', gap: '0.4rem', opacity: 0.6 }}
        >
          {showTable ? '▲' : '▼'}
        </button>}

        {showTable && displayTypes.length > 0 && <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem 0.3rem 0', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', fontWeight: 400, fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)', whiteSpace: 'nowrap' }}>Player</th>
                {orderedTypes.map(t => (
                  <th
                    key={t}
                    onClick={() => setSortType(s => s === t ? null : t)}
                    style={{ padding: '0.25rem 0.4rem', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 'clamp(0.52rem, 1.4vw, 0.65rem)', textAlign: 'center', color: sortType === t ? 'var(--earth-brown)' : 'var(--stone-gray)', whiteSpace: 'nowrap', cursor: 'var(--cursor-pointer)', userSelect: 'none', textDecoration: sortType === t ? 'underline' : 'none' }}
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
                ? [...players].sort((a, b) => ((b.breakdown || {})[sortType] || 0) - ((a.breakdown || {})[sortType] || 0))
                : players
              ).map(player => {
                const bd = player.breakdown || {};
                return (
                  <tr key={player.name} style={{ borderTop: '1px solid rgba(201,163,74,0.2)' }}>
                    <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.6rem, 1.8vw, 0.82rem)', color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </td>
                    {orderedTypes.map(t => {
                      const val = bd[t] || 0;
                      return (
                        <td key={t} style={{ padding: '0.35rem 0.4rem', textAlign: 'center', fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.7rem, 1.8vw, 0.9rem)', color: val > 0 ? 'var(--charcoal)' : 'var(--stone-gray)', opacity: val > 0 ? 1 : 0.35 }}>
                          {val > 0 ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {combined && <tr style={{ borderTop: '2px solid rgba(201,163,74,0.45)' }}>
                <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: 'clamp(0.6rem, 1.8vw, 0.82rem)', color: 'var(--earth-brown)', whiteSpace: 'nowrap' }}>
                  Total
                </td>
                {orderedTypes.map(t => {
                  const val = totalBreakdown[t] || 0;
                  return (
                    <td key={t} style={{ padding: '0.35rem 0.4rem', textAlign: 'center', fontFamily: 'Crimson Text, serif', fontWeight: 700, fontSize: 'clamp(0.7rem, 1.8vw, 0.9rem)', color: val > 0 ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: val > 0 ? 1 : 0.35 }}>
                      {val > 0 ? val : '—'}
                    </td>
                  );
                })}
              </tr>}
            </tbody>
          </table>
        </div>}

        {/* Footer tucks behind the dropdown; shown outright when requested or when there's no dropdown to expand */}
        {footer && (footerAlways || showTable || displayTypes.length === 0) && (
          <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(201,163,74,0.35)', paddingTop: '1.2rem' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
