import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { calculateExpansionLift } from '../utils/chartCalculations';

const PLAYER_COLORS = [
  '#9E2A2B', '#2C5AA0', '#3A7D44', '#D4A017', '#7B2D8B', '#1A8080',
];

// Create darker shades for expansion segments
function getDarkerShade(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = Math.floor(parseInt(hex.substring(0, 2), 16) * 0.65);
  const g = Math.floor(parseInt(hex.substring(2, 4), 16) * 0.65);
  const b = Math.floor(parseInt(hex.substring(4, 6), 16) * 0.65);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ExpansionLiftChart({ players }) {
  if (!players || players.length === 0) return null;

  const liftData = calculateExpansionLift(players);

  // Pillars in order
  const pillars = [
    { display: 'Road', key: 'Road' },
    { display: 'City', key: 'City' },
    { display: 'Monastery', key: 'Monastery' },
    { display: 'Agriculture', key: 'Field' },
  ];

  // Build chart data
  const chartData = pillars.map(pillarInfo => {
    const row = { pillar: pillarInfo.display };
    liftData.forEach(l => {
      const baseKey = `${pillarInfo.key} Base`;
      const expKey = `${pillarInfo.key} Expansion`;
      row[`${l.name} Base`] = l[baseKey] || 0;
      row[`${l.name} Exp`] = l[expKey] || 0;
    });
    return row;
  });

  return (
    <div className="chart-wrapper">
      <div className="chart-container">
        <div className="chart-header">THE EXPANSION LIFT — Strategy Impact</div>
        <div className="chart-description">
          How much of your score came from expansion mechanics? Darker shades represent expansion bonuses.
        </div>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 30, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,94,60,0.2)" />
            <XAxis
              dataKey="pillar"
              tick={{ fill: '#7D7D7D', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#7D7D7D', fontSize: 9 }}
            />
            {players.map((player, i) => (
              <Bar
                key={`${player.name}-base`}
                dataKey={`${player.name} Base`}
                stackId={player.name}
                fill={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              />
            ))}
            {players.map((player, i) => (
              <Bar
                key={`${player.name}-exp`}
                dataKey={`${player.name} Exp`}
                stackId={player.name}
                fill={getDarkerShade(PLAYER_COLORS[i % PLAYER_COLORS.length])}
              />
            ))}
            <Legend
              verticalAlign="bottom"
              height={50}
              wrapperStyle={{
                paddingTop: '1.5rem',
                fontFamily: 'Crimson Text, serif',
                fontSize: '0.85rem',
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
