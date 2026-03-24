import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend, ResponsiveContainer } from 'recharts';
import crownImg from '../../images/icons/crown.png';
import pigImg   from '../../images/icons/pig.png';
import cImg     from '../../images/icons/C.png';

// Dynamically load all meeple PNGs (root + fun/)
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const MEEPLE_COLOR_MAP = {
  blue:   '#2563EB',
  red:    '#DC2626',
  yellow: '#B8860B',
  green:  '#16A34A',
  black:  '#111827',
  pink:   '#EC4899',
};
const FALLBACK_COLOR = '#8B5E3C';

function getMeepleColor(filename) {
  if (!filename) return FALLBACK_COLOR;
  const match = filename.match(/blue|red|yellow|green|black|pink/i);
  return match ? (MEEPLE_COLOR_MAP[match[0].toLowerCase()] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

// Custom label for bar segments
function BarLabel(props) {
  const { x, y, width, height, value, dataKey } = props;
  if (value === undefined || value === null || value === 0) return null;

  const label = dataKey.replace(/_/g, ' ').charAt(0).toUpperCase() + dataKey.slice(1).replace(/_/g, ' ');
  const fontSize = 9;
  const textWidth = label.length * 3.5;

  // If bar is wide enough for horizontal text (need comfortable space)
  if (width > 40) {
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

const today = () => new Date().toISOString().split('T')[0];

// Scoring types in consistent order (matches Statistics component)
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

export default function GameLogForm({ session, ownedExpansions, onSubmit, onCancel, onPlayAgain, isGuest = false }) {
  const { players = [], meeples = {}, expansions: prefillExp = [], finalScores = {}, scoreBreakdown = {}, farmWin: autoFarmWin = false, gameDuration = 0 } = session || {};

  const [date, setDate] = useState(today);
  const [submitted, setSubmitted] = useState(false);
  const hasAutoSubmitted = useRef(false);

  // Auto-submit for logged-in users
  useEffect(() => {
    if (!isGuest && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      // Trigger form submission
      const form = document.querySelector('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    }
  }, [isGuest]);

  const scoreNums    = players.map(p => Number(finalScores[p]) || 0);
  const maxScore     = scoreNums.length > 0 ? Math.max(...scoreNums) : 0;
  const winners      = maxScore > 0 ? players.filter(p => (Number(finalScores[p]) || 0) === maxScore) : [];
  const sortedPlayers = [...players].sort((a, b) => (Number(finalScores[b]) || 0) - (Number(finalScores[a]) || 0));

  const sortedScores = [...scoreNums].sort((a, b) => b - a);
  const s1 = sortedScores[0] ?? 0, s2 = sortedScores[1] ?? 0;
  const combined = s1 + s2;
  const isClutch = winners.length === 1 && combined > 0 && (s1 - s2) / combined < 0.10;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      date,
      winners: [...winners],
      maxScore: maxScore,
      players: players.map(name => ({
        name,
        score:     parseInt(finalScores[name], 10) || 0,
        meeple:    meeples[name] || Object.keys(MEEPLE_IMGS)[0],
        breakdown: scoreBreakdown[name] || {},
      })),
      expansions: [...prefillExp].sort(),
      farmWin:   autoFarmWin,
      clutchWin: isClutch,
      gameDuration: session.gameDuration, // Game duration in milliseconds
    });
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">
        <h2>Final Scores</h2>
        <div className="section-title-line" />
      </div>

      {/* Player scores */}
      <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {Math.floor(gameDuration / 60000)}m {Math.floor((gameDuration % 60000) / 1000)}s
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {prefillExp.length === 0 ? 'Base Game' : prefillExp.join(' · ')}
        </div>
      </div>

      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        {/* Player cards with final scores and ranking */}
        <div className="postgame-scores-grid">
          {sortedPlayers.map((name) => {
            const color    = getMeepleColor(meeples[name]);
            const isWinner = winners.includes(name);
            const bd = scoreBreakdown[name] || {};
            const bdEntries = SCORE_TYPE_ORDER.filter(t => (bd[t] ?? 0) > 0);
            return (
              <div key={name} className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto' }} />
                  <span style={{ fontFamily: 'Cinzel, serif', color, fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    {name}
                  </span>
                  {isWinner && (
                    <img src={crownImg} alt="winner" className="postgame-crown" />
                  )}
                  {isWinner && isClutch && (
                    <span className="val-info-wrap">
                      <img src={cImg} alt="clutch" className="postgame-crown" />
                      <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Clutch win</span>
                    </span>
                  )}
                  {isWinner && autoFarmWin && (
                    <span className="val-info-wrap">
                      <img src={pigImg} alt="farm win" className="postgame-pig" />
                      <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Farm win</span>
                    </span>
                  )}
                  <div className="postgame-score-display">
                    {finalScores[name] ?? 0}
                  </div>
                </div>
                {bdEntries.length > 0 && (
                  <p style={{
                    fontFamily: 'Crimson Text, serif',
                    fontStyle: 'italic',
                    fontSize: '0.82rem',
                    color: 'var(--stone-gray)',
                    margin: '0.4rem 0 0',
                    letterSpacing: '0.01em',
                  }}>
                    {bdEntries.map(t => `${bd[t]} ${t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')}`).join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Points distribution chart */}
      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.8rem' }}>
            POINTS BREAKDOWN
          </div>
          {(() => {
            // Find which scoring types were actually used in the game
            const usedTypes = new Set();
            sortedPlayers.forEach(name => {
              const breakdown = scoreBreakdown[name] || {};
              Object.keys(breakdown).forEach(type => {
                if (breakdown[type] > 0) usedTypes.add(type);
              });
            });
            const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));

            return (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={sortedPlayers.map(name => ({
                    name,
                    ...scoreBreakdown[name] || {},
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,163,74,0.2)" />
                  <XAxis type="number" stroke="var(--stone-gray)" />
                  <YAxis dataKey="name" type="category" stroke="var(--stone-gray)" width={95} />
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
            );
          })()}
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1rem' }}>
        {!submitted && onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>← Back</button>
        )}
        {!submitted && isGuest && (
          <button type="submit" className="btn">Sign In to Save Game</button>
        )}
        {submitted && !isGuest && (
          <button type="button" className="btn" onClick={onPlayAgain} style={{ marginLeft: 'auto' }}>Play Again</button>
        )}
      </div>
    </form>
  );
}
