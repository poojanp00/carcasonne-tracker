import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';

// Custom label for bar segments
function BarLabel(props) {
  const { x, y, width, height, value, dataKey } = props;
  if (value === undefined || value === null || value === 0) return null;

  const label = dataKey.replace(/_/g, ' ').charAt(0).toUpperCase() + dataKey.slice(1).replace(/_/g, ' ');
  const fontSize = 9;

  // If bar is wide enough for horizontal text
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

const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  abbot: 'Abbot', inn: 'Inn', cathedral: 'Cathedral',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  abbey: 'Abbey', barn: 'Barn',
  princess: 'Princess', fairy: 'Fairy',
  largest_city: 'Largest City', largest_road: 'Largest Road',
  wagon: 'Wagon',
};

export default function PointBreakdownChart({ players }) {
  if (!players || players.length === 0) return null;

  // Find which scoring types were actually used across all players
  const usedTypes = new Set();
  players.forEach(player => {
    const breakdown = player.breakdown || {};
    Object.keys(breakdown).forEach(type => {
      if (breakdown[type] > 0) usedTypes.add(type);
    });
  });

  // If no scoring data, don't render
  if (usedTypes.size === 0) return null;

  const displayTypes = SCORE_TYPE_ORDER.filter(t => usedTypes.has(t));

  // Transform data for horizontal bar chart
  const chartData = players.map(player => ({
    name: player.name,
    ...player.breakdown || {},
  }));

  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  const CustomYAxisTick = (props) => {
    const { x, y, payload } = props;
    const playerName = payload.value;
    const player = players.find(p => p.name === playerName);
    const playerBreakdown = player?.breakdown || {};
    const playerTypes = SCORE_TYPE_ORDER.filter(t => playerBreakdown[t] > 0);

    return (
      <g
        transform={`translate(${x},${y})`}
        onMouseEnter={() => setHoveredPlayer(playerName)}
        onMouseLeave={() => setHoveredPlayer(null)}
      >
        <text
          x={-5}
          y={0}
          textAnchor="end"
          fill="var(--stone-gray)"
          fontSize="0.9rem"
          fontFamily="Crimson Text, serif"
          style={{ cursor: playerTypes.length > 0 ? 'pointer' : 'default', pointerEvents: 'auto' }}
        >
          {playerName}
          {playerTypes.length > 0 && ' ⓘ'}
        </text>
      </g>
    );
  };

  return (
    <div className="chart-wrapper">
      <div className="chart-container">
        <div className="chart-header">Complete Points Breakdown</div>
        <div style={{ position: 'relative' }}>
          {hoveredPlayer && (() => {
            const player = players.find(p => p.name === hoveredPlayer);
            const playerBreakdown = player?.breakdown || {};
            const playerTypes = SCORE_TYPE_ORDER.filter(t => playerBreakdown[t] > 0);
            return playerTypes.length > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: '0px',
                  top: '30px',
                  backgroundColor: 'var(--earth-brown)',
                  border: '1px solid var(--warm-gold)',
                  borderRadius: '4px',
                  color: 'var(--parchment)',
                  fontFamily: 'Crimson Text, serif',
                  fontSize: '0.85rem',
                  padding: '0.5rem',
                  width: '160px',
                  zIndex: 9999,
                  lineHeight: '1.4',
                }}
                onMouseEnter={() => setHoveredPlayer(hoveredPlayer)}
                onMouseLeave={() => setHoveredPlayer(null)}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(244,230,200,0.3)' }}>
                  {hoveredPlayer}
                </div>
                {playerTypes.map(type => (
                  <div key={type} style={{ marginBottom: '0.2rem' }}>
                    {TYPE_LABELS[type]}: {playerBreakdown[type]}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,163,74,0.2)" />
            <XAxis type="number" stroke="var(--stone-gray)" />
            <YAxis dataKey="name" type="category" stroke="var(--stone-gray)" width={95} tick={<CustomYAxisTick />} />
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
      </div>
    </div>
  );
}
