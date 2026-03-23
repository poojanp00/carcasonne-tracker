import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateEnhancementsMetrics } from '../utils/chartCalculations';

const PLAYER_COLORS = [
  '#9E2A2B', '#2C5AA0', '#3A7D44', '#D4A017', '#7B2D8B', '#1A8080',
];

export default function EnhancementsChart({ players }) {
  if (!players || players.length === 0) return null;

  // Collect all enhancement types not in Chart 1
  const allTypes = [
    { key: 'wine', label: 'Wine' },
    { key: 'cloth', label: 'Cloth' },
    { key: 'grain', label: 'Grain' },
    { key: 'largest_city', label: 'Largest City' },
    { key: 'largest_road', label: 'Largest Road' },
    { key: 'fairy', label: 'Fairy' },
    { key: 'princess', label: 'Princess' },
    { key: 'wagon', label: 'Wagon' },
  ];

  // Check if there's any meaningful data
  const hasData = players.some(p =>
    allTypes.some(type => (p.breakdown?.[type.key] || 0) > 0)
  );
  if (!hasData) return null;

  // Transform to bar chart format
  const chartData = allTypes.map(type => {
    const row = { name: type.label };
    players.forEach(p => {
      row[p.name] = p.breakdown?.[type.key] || 0;
    });
    return row;
  }).filter(row => players.some(p => row[p.name] > 0));

  if (chartData.length === 0) return null;

  return (
    <div className="chart-wrapper">
      <div className="chart-container">
        <div className="chart-header">THE ENHANCEMENTS & SPECIALS — Finer Points</div>
        <div className="chart-description">
          Trade goods, monarchical control, and supernatural bonuses. Points won through expansion mechanics, not tile placement.
        </div>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 30, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,94,60,0.2)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#7D7D7D', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              tick={{ fill: '#7D7D7D', fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--earth-brown)',
                border: '1px solid var(--warm-gold)',
                borderRadius: '4px',
                color: 'var(--parchment)',
                fontFamily: 'Crimson Text, serif',
                fontSize: '0.85rem',
              }}
            />
            {players.map((player, i) => (
              <Bar
                key={player.name}
                dataKey={player.name}
                fill={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              />
            ))}
            <Legend
              verticalAlign="bottom"
              height={50}
              wrapperStyle={{
                paddingTop: '1.5rem',
                fontFamily: 'Crimson Text, serif',
                fontSize: '0.9rem',
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
