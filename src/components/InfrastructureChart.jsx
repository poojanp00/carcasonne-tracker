import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateInfrastructureMetrics } from '../utils/chartCalculations';
import StatInfo from './StatInfo';

const PLAYER_COLORS = [
  '#9E2A2B', '#2C5AA0', '#3A7D44', '#D4A017', '#7B2D8B', '#1A8080',
];

export default function InfrastructureChart({ players }) {
  if (!players || players.length === 0) return null;

  const metrics = calculateInfrastructureMetrics(players);

  // Transform to radar chart format
  const chartData = [
    { axis: 'Road', ...Object.fromEntries(metrics.map(m => [m.name, m.roadScore])) },
    { axis: 'City', ...Object.fromEntries(metrics.map(m => [m.name, m.cityScore])) },
    { axis: 'Monastery', ...Object.fromEntries(metrics.map(m => [m.name, m.monasteryScore])) },
    { axis: 'Agriculture', ...Object.fromEntries(metrics.map(m => [m.name, m.agricultureScore])) },
  ];

  return (
    <div className="chart-wrapper">
      <div className="chart-container" style={{ paddingBottom: '1rem' }}>
        <div className="chart-header" style={{ marginBottom: '0.5rem' }}>
          Your Board Footprint <StatInfo className="infrastructure-info">
            Road = Road + Inn<br/>City = City + Cathedral<br/>Monastery = Monastery + Abbot + Abbey<br/>Agriculture = Field + Pig + Barn
          </StatInfo>
        </div>
        <ResponsiveContainer width="100%" height={700}>
          <RadarChart data={chartData} margin={{ top: 0, right: 10, bottom: 5, left: 10 }} style={{ cursor: 'var(--cursor-arrow)' }}>
            <PolarGrid stroke="rgba(139,94,60,0.3)" strokeWidth={2} />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#7D7D7D', fontSize: 13, fontWeight: 'bold' }}
            />
            <PolarRadiusAxis
              tick={{ fill: '#7D7D7D', fontSize: 14, fontWeight: 'bold' }}
              domain={[0, 'auto']}
              label={{ value: '', angle: 90, position: 'insideBottomLeft', offset: 10 }}
            />
            {players.map((player, i) => (
              <Radar
                key={player.name}
                name={player.name}
                dataKey={player.name}
                stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                fill={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={4}
                connectNulls
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--earth-brown)',
                border: '1px solid var(--warm-gold)',
                borderRadius: '4px',
                color: 'var(--parchment)',
                fontFamily: 'Crimson Text, serif',
                fontSize: '0.85rem',
              }}
              formatter={(value) => value > 0 ? Math.round(value) : 0}
            />
            <Legend
              verticalAlign="bottom"
              height={50}
              wrapperStyle={{
                paddingTop: '2rem',
                fontFamily: 'Crimson Text, serif',
                fontSize: '1rem',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
