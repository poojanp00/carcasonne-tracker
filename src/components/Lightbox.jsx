import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import pigImg from '../../images/icons/pig.png';
import cImg   from '../../images/icons/C.png';

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// Scoring types in consistent order
const SCORE_TYPE_ORDER = [
  'road', 'city', 'monastery', 'field',           // Base game
  'abbot',                                         // The Abbot
  'inn', 'cathedral',                              // Inns & Cathedrals
  'wine', 'grain', 'cloth', 'pig',                 // Traders & Builders
  'abbey', 'barn',                                 // Abbey & Mayor
  'princess', 'fairy',                             // The Princess & the Dragon
  'largest_city', 'largest_road',                  // Count, King & Robber
  'wagon',                                         // Other/wagon
];

// Consistent color palette for each scoring type - Medieval/Earthy with more variation
const SCORE_TYPE_COLORS = {
  road: '#6B4423',       // Saddle brown
  city: '#A67C52',       // Medium tan
  monastery: '#3D2817',  // Very dark brown
  field: '#6B8E23',      // Olive green
  abbot: '#A52A2A',      // Crimson
  inn: '#CD853F',        // Peru
  cathedral: '#5A6C7D',  // Steel blue
  wine: '#8B1A1A',       // Dark red
  grain: '#DAA520',      // Goldenrod
  cloth: '#8B7355',      // Burlywood
  pig: '#B8860B',        // Dark goldenrod
  abbey: '#2F6B3F',      // Hunter green
  barn: '#8B4513',       // Saddle brown (lighter)
  princess: '#C41E3A',   // Carmine
  fairy: '#D4418E',      // Pink/mauve
  largest_city: '#1F4788',    // Deep blue
  largest_road: '#2D5A2D',    // Deep forest green
  wagon: '#996633',      // Brown
};

// Custom label for bar segments
function BarLabel(props) {
  const { x, y, width, height, value, dataKey } = props;
  if (value === undefined || value === null || value === 0) return null;

  const label = dataKey.replace(/_/g, ' ').charAt(0).toUpperCase() + dataKey.slice(1).replace(/_/g, ' ');
  const fontSize = 8;
  const textWidth = label.length * 3;

  // If bar is wide enough for horizontal text (need comfortable space)
  if (width > 35) {
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#f5f5f5"
        fontSize={fontSize}
        fontWeight="600"
        fontFamily="Cinzel, serif"
      >
        {label}
      </text>
    );
  }

  // If bar is at least 6px wide, write vertically
  if (width >= 6) {
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#f5f5f5"
        fontSize={fontSize}
        fontWeight="600"
        fontFamily="Cinzel, serif"
        transform={`rotate(-90 ${x + width / 2} ${y + height / 2})`}
      >
        {label}
      </text>
    );
  }

  return null;
}

export default function Lightbox({ game, games = [], onNavigate, onClose }) {
  const idx = games.findIndex(g => g.id === game.id);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState(null);

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
  const TYPE_ORDER = ['road', 'city', 'monastery', 'field'];
  const margin = topPlayers.length === 1 && sorted.length > 1 ? sorted[0].score - sorted[1].score : null;
  const s1 = sorted[0]?.score ?? 0, s2 = sorted[1]?.score ?? 0;
  const isClutch = topPlayers.length === 1 && (s1 + s2) > 0 && (s1 - s2) / (s1 + s2) < 0.10;

  const slideClass = animDir === 'down' ? 'lb-slide-down' : animDir === 'up' ? 'lb-slide-up' : '';

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <div key={animKey} className={`lightbox-meta ${slideClass}`}>
          <p style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
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
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--stone-gray)', marginBottom: '1rem' }}>
              +{margin} point margin
            </p>
          )}

          {/* Player scores */}
          <div style={{ marginBottom: '1.2rem' }}>
            {sorted.map((p, i) => {
              const bd = p.breakdown || {};
              const bdEntries = SCORE_TYPE_ORDER.filter(t => (bd[t] ?? 0) > 0);
              const isWinner = topPlayers.includes(p.name);
              return (
                <div
                  key={p.name}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: i < sorted.length - 1 ? '1px solid rgba(201,163,74,0.25)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '0.95rem',
                      fontWeight: isWinner ? 700 : 400,
                      color: isWinner ? 'var(--forest-green)' : 'var(--charcoal)',
                    }}>
                      {p.name}
                    </span>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '1.05rem',
                      fontWeight: isWinner ? 700 : 400,
                      color: isWinner ? 'var(--forest-green)' : 'var(--stone-gray)',
                    }}>
                      {p.score}
                    </span>
                  </div>
                  {bdEntries.length > 0 && (
                    <p style={{
                      fontFamily: 'Crimson Text, serif',
                      fontStyle: 'italic',
                      fontSize: '0.82rem',
                      color: 'var(--stone-gray)',
                      margin: '0.15rem 0 0',
                      letterSpacing: '0.01em',
                    }}>
                      {bdEntries.map(t => `${bd[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Points breakdown chart */}
          {(() => {
            // Find which scoring types were actually used in the game
            const usedTypes = new Set();
            game.players.forEach(p => {
              const breakdown = p.breakdown || {};
              Object.keys(breakdown).forEach(type => {
                if (breakdown[type] > 0) usedTypes.add(type);
              });
            });
            const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));

            return displayTypes.length > 0 ? (
              <div style={{ marginBottom: '1.5rem', marginTop: '1.2rem' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.6rem' }}>
                  POINTS BREAKDOWN
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={sorted.map(p => ({
                      name: p.name,
                      ...p.breakdown || {},
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,163,74,0.2)" />
                    <XAxis type="number" stroke="var(--stone-gray)" style={{ fontSize: '0.75rem' }} />
                    <YAxis dataKey="name" type="category" stroke="var(--stone-gray)" width={75} style={{ fontSize: '0.8rem' }} />
                    {displayTypes.map(type => (
                      <Bar
                        key={type}
                        dataKey={type}
                        stackId="a"
                        fill={SCORE_TYPE_COLORS[type]}
                        isAnimationActive={false}
                        label={(props) => <BarLabel {...props} dataKey={type} />}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null;
          })()}

          {/* Expansions */}
          {game.expansions.length > 0 ? (
            <div className="expansion-chips" style={{ marginBottom: '1.2rem' }}>
              {game.expansions.map(exp => (
                <span key={exp} className="expansion-chip display-only">{exp}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', display: 'block', marginBottom: '1.2rem' }}>
              Base game — no expansions
            </span>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ color: 'var(--deep-red)', borderColor: 'var(--deep-red)' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
