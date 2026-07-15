import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Player palette validated for CVD separation and contrast on --aged-paper.
// Same hue order as the player-card colors; mustard and teal darkened for legibility.
const PLAYER_COLORS = ['#9E2A2B', '#2C5AA0', '#3A7D44', '#9C6500', '#7B2D8B', '#0E8A78'];

// Player-name label pinned to the right end of its line (renders only at the last point)
const EndLabel = ({ x, y, index, lastIndex, name, color, dy = 0 }) =>
  index === lastIndex ? (
    <text
      x={x + 7}
      y={y + dy}
      fill={color}
      fontSize={11}
      fontWeight={600}
      fontFamily="Cinzel, serif"
      textAnchor="start"
      dominantBaseline="middle"
    >
      {name}
    </text>
  ) : null;

function formatElapsed(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Score swing timeline: cumulative score over elapsed game time, one line per player.
 *
 * @param {Array}   timeline - Scoring events: {player, type, amount, t} where t is ms since game start
 * @param {Array}   players  - Player names in seating order (fixes each player's color)
 * @param {number}  duration - Total game duration in ms (extends lines to game end)
 * @param {boolean} boxed    - Wrap in the gold-ribbon chart-container card (off inside the lightbox)
 */
export default function ScoreTimelineChart({ timeline, players, duration = 0, boxed = true }) {
  if (!timeline || timeline.length === 0 || !players || players.length === 0) return null;

  // Build cumulative rows: every event produces a row carrying all players' running totals
  const cum = Object.fromEntries(players.map(p => [p, 0]));
  const rows = [{ t: 0, ...cum }];
  [...timeline].sort((a, b) => a.t - b.t).forEach(ev => {
    if (!(ev.player in cum)) return;
    cum[ev.player] += ev.amount;
    rows.push({ t: ev.t, ...cum });
  });
  const lastT = rows[rows.length - 1].t;
  const endT = Math.max(duration, lastT);
  if (endT > lastT) rows.push({ t: endT, ...cum });
  if (rows.length < 2) return null;

  // Right margin sized to fit the longest player name next to its line
  const labelWidth = Math.round(Math.max(...players.map(n => n.length)) * 6.5) + 14;

  // Nudge labels apart when final scores land too close together: estimate each
  // label's pixel position from its share of the y-range, then walk top-down
  // enforcing a minimum gap and keep the offset from the original position.
  const finals = rows[rows.length - 1];
  const yMax = Math.max(...players.map(p => finals[p] || 0), 1);
  const plotH = 220; // approx plotted height inside the 260px chart
  const naturalY = (p) => plotH * (1 - (finals[p] || 0) / yMax);
  const labelDy = {};
  let prevY = -Infinity;
  [...players].sort((a, b) => (finals[b] || 0) - (finals[a] || 0)).forEach(p => {
    const y = Math.max(naturalY(p), prevY + 13);
    labelDy[p] = y - naturalY(p);
    prevY = y;
  });

  const chart = (
    <>
      <div className="chart-header" style={{ margin: '0 0 1.2rem', textAlign: 'left' }}>Score Timeline</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: labelWidth, bottom: 0, left: -18 }} style={{ cursor: 'var(--cursor-arrow)' }}>
          <CartesianGrid stroke="rgba(139,94,60,0.18)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, endT]}
            tickFormatter={formatElapsed}
            tickCount={6}
            tick={{ fill: '#7D7D7D', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
            stroke="rgba(125,125,125,0.4)"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#7D7D7D', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
            stroke="rgba(125,125,125,0.4)"
          />
          <Tooltip
            labelFormatter={formatElapsed}
            itemSorter={(item) => -item.value}
            contentStyle={{
              backgroundColor: 'var(--earth-brown)',
              border: '1px solid var(--warm-gold)',
              borderRadius: '6px',
              color: 'var(--parchment)',
              fontFamily: 'Crimson Text, serif',
              fontSize: '0.82rem',
            }}
            labelStyle={{ color: 'var(--parchment)', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}
            itemStyle={{ color: 'var(--parchment)' }}
          />
          {players.map((name, i) => (
            <Line
              key={name}
              dataKey={name}
              type="stepAfter"
              stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1, stroke: 'var(--aged-paper)' }}
              isAnimationActive={false}
              label={<EndLabel lastIndex={rows.length - 1} name={name} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} dy={labelDy[name] || 0} />}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );

  if (!boxed) return <div>{chart}</div>;

  return (
    <div className="chart-wrapper">
      <div className="chart-container" style={{ borderTop: '4px solid var(--warm-gold)', paddingTop: '1.25rem' }}>
        {chart}
      </div>
    </div>
  );
}
