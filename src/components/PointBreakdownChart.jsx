import { useState, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';

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

export default function PointBreakdownChart({ players, showLegend = false }) {
  const [tooltip, setTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [combined, setCombined] = useState(false);
  const barsRef = useRef(null);

  if (!players || players.length === 0) return null;

  const usedTypes = new Set();
  players.forEach(player => {
    Object.entries(player.breakdown || {}).forEach(([t, v]) => { if (v > 0) usedTypes.add(t); });
  });

  if (usedTypes.size === 0) return null;

  const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));

  const orderedTypes = [
    ...SCORE_GROUPS.flatMap(g => g.types.filter(t => displayTypes.includes(t))),
    ...displayTypes.filter(t => !TYPE_TO_GROUP[t]),
  ];

  const maxTotal = Math.max(1, ...players.map(player => {
    const bd = player.breakdown || {};
    return displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
  }));

  function handleMouseEnter(e, type, val, bd) {
    if (!barsRef.current) return;
    const segRect = e.currentTarget.getBoundingClientRect();
    const containerRect = barsRef.current.getBoundingClientRect();
    const group = combined ? TYPE_TO_GROUP[type] : null;
    const groupValue = group ? group.types.reduce((s, t) => s + (bd[t] || 0), 0) : null;
    setTooltip({
      type,
      value: val,
      groupLabel: group?.label ?? null,
      groupValue,
      x: segRect.left + segRect.width / 2 - containerRect.left,
      y: segRect.top - containerRect.top,
    });
  }

  return (
    <div className="chart-wrapper">
      <div className="chart-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
          <div className="chart-header" style={{ margin: 0 }}>Complete Points Breakdown</div>
          <button
            type="button"
            onClick={() => { setCombined(v => !v); setTooltip(null); }}
            style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '4px', cursor: 'pointer', padding: '0.15rem 0.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: combined ? 'var(--earth-brown)' : 'var(--stone-gray)', opacity: combined ? 1 : 0.7, letterSpacing: '0.05em' }}
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

        <div
          ref={barsRef}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem', position: 'relative' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {players.map(player => {
            const bd = player.breakdown || {};
            const total = displayTypes.reduce((s, t) => s + (bd[t] || 0), 0);
            return (
              <div key={player.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.6rem, 1.8vw, 0.78rem)', color: 'var(--stone-gray)', minWidth: 'clamp(48px, 12vw, 80px)', textAlign: 'right', flexShrink: 0 }}>
                  {player.name}
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
                              onMouseEnter={(e) => handleMouseEnter(e, t, val, bd)}
                            />
                          );
                        })
                    }
                  </div>
                </div>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.6rem, 1.8vw, 0.78rem)', color: 'var(--stone-gray)', minWidth: '28px', flexShrink: 0 }}>
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
                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem 0.3rem 0', fontFamily: 'Cinzel, serif', color: 'var(--stone-gray)', fontWeight: 400, fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)', whiteSpace: 'nowrap' }}>Player</th>
                {orderedTypes.map(t => (
                  <th key={t} style={{ padding: '0.25rem 0.4rem', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 'clamp(0.52rem, 1.4vw, 0.65rem)', textAlign: 'center', color: 'var(--stone-gray)', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], display: 'inline-block', flexShrink: 0 }} />
                      {TYPE_LABELS[t] ?? t}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map(player => {
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
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  );
}
