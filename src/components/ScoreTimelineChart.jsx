import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Customized, ReferenceLine, ResponsiveContainer } from 'recharts';
import { ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';
import { formatAchievementName } from '../utils/achievements';
import { usePortalTooltip } from '../hooks/usePortalTooltip';
import { LIVE_PLAY_ONLY_RECORD_TYPES, MONASTERY_RECORD_TYPES, MONASTERY_LIKE_MAX } from '../constants';

// Player palette validated for CVD separation and contrast on --aged-paper.
// Same hue order as the player-card colors; mustard and teal darkened for legibility.
const PLAYER_COLORS = ['#9E2A2B', '#2C5AA0', '#3A7D44', '#9C6500', '#7B2D8B', '#0E8A78'];

// Which score type each headline record is drawn from — used to find the
// timeline event that earned it, so its badge can sit right on the line at
// the moment it happened. mostMonastery and bestTrader have no entry here:
// both are anchored separately below — mostMonastery is a count across
// three types (monastery/abbot/abbey) rather than one event's amount,
// bestTrader a synthesis across three goods types.
const ACHIEVEMENT_TYPE = {
  longestRoad:      'road',
  largestCity:      'city',
  largestField:     'field',
  longestInn:       'inn',
  largestCathedral: 'cathedral',
  biggestPig:       'pig',
  largestBarn:      'barn',
};
const GOODS_TYPES = ['wine', 'grain', 'cloth'];

const BADGE_SIZE = 52;

// Achievement marker rendered in place of the removed line-hover tooltip —
// the record badge sits directly on the line at the point it was earned, and
// carries its own hover/tap tooltip (player · label · amount) so the info is
// still reachable without cluttering the chart. Plain icon, no backdrop
// shape and no hover lift — just the badge itself.
function AchievementMarker({ cx, cy, img, badgeKey, player, amount }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const { tooltipRef, portalStyle } = usePortalTooltip(open, triggerRef, 'above');
  if (cx == null || cy == null || !img) return null;
  const r = BADGE_SIZE / 2;
  const label = ACHIEVEMENT_LABEL_OVERRIDE[badgeKey] || formatAchievementName(badgeKey);
  return (
    <>
      <image
        ref={triggerRef}
        href={img}
        x={cx - r}
        y={cy - r}
        width={BADGE_SIZE}
        height={BADGE_SIZE}
        style={{ cursor: 'var(--cursor-pointer)' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        onTouchEnd={() => setOpen(false)}
        onTouchCancel={() => setOpen(false)}
      />
      {open && portalStyle && createPortal(
        // Same look as .val-info-tooltip/RecordBadge's own tooltip. z-index
        // bumped above .tour-overlay (10001) for the same reason RecordBadge's is.
        <div ref={tooltipRef} style={{
          ...portalStyle,
          zIndex: 10501,
          background: 'var(--earth-brown)',
          color: 'var(--parchment)',
          padding: '0.3rem 0.55rem',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          fontFamily: 'Crimson Text, serif',
          fontStyle: 'italic',
          fontSize: '0.78rem',
        }}>
          {player} · {label} · {amount}
        </div>,
        document.body
      )}
    </>
  );
}

// How close two badges' centers are allowed to land (in px) before they're
// pushed apart — smaller than BADGE_SIZE so edges can still overlap a
// little, just not the whole icon.
const MIN_BADGE_GAP = BADGE_SIZE - 14;

// Simple left-to-right sweep: badges close together in time can land at
// (almost) the same x, which without this would stack them fully on top of
// each other. Sorted by pixel x, then each one only ever gets pushed later
// (never earlier) just far enough to clear the one before it — stable, and
// keeps every badge as close as possible to its real, chronologically
// correct position.
function spreadBadges(positioned) {
  const sorted = [...positioned].sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < sorted.length; i++) {
    const minCx = sorted[i - 1].cx + MIN_BADGE_GAP;
    if (sorted[i].cx < minCx) sorted[i] = { ...sorted[i], cx: minCx };
  }
  return sorted;
}

// Renders every badge at once, via recharts' Customized render props
// (xAxisMap/yAxisMap) — needed (rather than one ReferenceDot per badge) so
// their real pixel x positions are all known together, up front, for
// spreadBadges to de-overlap before anything paints.
function AchievementBadgeLayer({ badges, xAxisMap, yAxisMap }) {
  const xScale = Object.values(xAxisMap || {})[0]?.scale;
  const yScale = Object.values(yAxisMap || {})[0]?.scale;
  if (!xScale || !yScale) return null;
  const positioned = spreadBadges(badges.map(b => ({ ...b, cx: xScale(b.t), cy: yScale(b.value) })));
  return (
    <g>
      {positioned.map(b => (
        <AchievementMarker key={b.key} cx={b.cx} cy={b.cy} img={b.img} badgeKey={b.key} player={b.player} amount={b.amount} />
      ))}
    </g>
  );
}

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
 * @param {Array}   timeline     - Scoring events: {player, type, amount, t, inFinalScoring} where t is ms
 *                                 since game start; inFinalScoring (see Board.jsx) is used to keep record
 *                                 badges off events scored after Final Scoring — older saved games just
 *                                 won't have it, so every event on them reads as inFinalScoring: false
 * @param {Array}   players      - Player names in seating order (fixes each player's color)
 * @param {number}  duration     - Total game duration in ms (extends lines to game end)
 * @param {Object}  achievements - This game's headline records ({ [key]: { amount, player } }, see
 *                                 GameHighlights.jsx) — plotted as static badges on the line, replacing
 *                                 the old hover tooltip (see AchievementMarker above).
 * @param {boolean} boxed        - Wrap in the gold-ribbon chart-container card (off inside the lightbox)
 */
export default function ScoreTimelineChart({ timeline, players, duration = 0, achievements = null, boxed = true }) {
  if (!timeline || timeline.length === 0 || !players || players.length === 0) return null;

  // Build cumulative rows: every event produces a row carrying all players' running totals.
  // Also buckets every (player, type) pair's events (t, midpoint value, amount,
  // inFinalScoring), in chronological order, so a badge can later be anchored to the
  // SPECIFIC event that actually earned a record — not just "the last one of that type",
  // which breaks the moment a player scores a second, bigger (but incomplete, since it
  // happened after Final Scoring) feature of the same type later in the same game.
  const cum = Object.fromEntries(players.map(p => [p, 0]));
  const rows = [{ t: 0, ...cum }];
  const eventsByPlayerType = {};
  [...timeline].sort((a, b) => a.t - b.t).forEach(ev => {
    if (!(ev.player in cum)) return;
    const before = cum[ev.player];
    cum[ev.player] += ev.amount;
    rows.push({ t: ev.t, ...cum });
    // stepAfter draws this event's jump as a vertical segment at x = ev.t, from the
    // player's PRE-event total up to their post-event total — value here is the
    // midpoint of that segment, so the badge sits centered on the jump instead of
    // pinned to its top.
    (eventsByPlayerType[`${ev.player}:${ev.type}`] ||= []).push({ t: ev.t, value: (before + cum[ev.player]) / 2, amount: ev.amount, inFinalScoring: !!ev.inFinalScoring });
  });
  const lastT = rows[rows.length - 1].t;
  const endT = Math.max(duration, lastT);
  if (endT > lastT) rows.push({ t: endT, ...cum });
  if (rows.length < 2) return null;

  // Player-less 'final-scoring' marker (see Board.jsx) — when Final Scoring
  // was pressed, drawn as a vertical reference line. Absent on games
  // recorded before this marker existed, so the line just doesn't render.
  const finalScoringT = timeline.find(ev => ev.type === 'final-scoring')?.t;

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

  // Headline records that map to a plotted score type — each becomes a badge
  // on its holder's own line, at the SPECIFIC event that earned it (matched
  // by exact amount, not just "whichever event of that type happened last" —
  // a player can score a second, later event of the same type, e.g. a bigger
  // but incomplete city forced closed by Final Scoring, which must not steal
  // the badge from the actual record-setting completion). For the road/city/
  // inn/cathedral types that can only earn a record while complete (see
  // LIVE_PLAY_ONLY_RECORD_TYPES/skipRecord in Board.jsx), final-scoring
  // events are excluded from the search too, as a second guard against ever
  // landing on one even if amounts happened to coincide.
  const badges = Object.entries(ACHIEVEMENT_TYPE)
    .map(([key, type]) => {
      const record = achievements?.[key];
      if (!record?.player) return null;
      const bucket = eventsByPlayerType[`${record.player}:${type}`] || [];
      const candidates = LIVE_PLAY_ONLY_RECORD_TYPES.includes(type) ? bucket.filter(e => !e.inFinalScoring) : bucket;
      const hit = candidates.find(e => e.amount === record.amount);
      if (!hit) return null;
      return { key, ...hit, img: ACHIEVEMENT_BADGE[key], player: record.player, amount: record.amount };
    })
    .filter(Boolean);

  // mostMonastery — not one event's amount but a COUNT of completed 9-point
  // monastery/abbot/abbey features, so it's anchored to the Nth (final)
  // qualifying completion that actually reached that count, ignoring any
  // scored after Final Scoring (same rule as the other LIVE_PLAY_ONLY types).
  const monasteryRecord = achievements?.mostMonastery;
  if (monasteryRecord?.player) {
    const completions = MONASTERY_RECORD_TYPES
      .flatMap(type => eventsByPlayerType[`${monasteryRecord.player}:${type}`] || [])
      .filter(e => e.amount === MONASTERY_LIKE_MAX && !e.inFinalScoring)
      .sort((a, b) => a.t - b.t);
    const hit = completions[monasteryRecord.amount - 1];
    if (hit) {
      badges.push({ key: 'mostMonastery', ...hit, img: ACHIEVEMENT_BADGE.mostMonastery, player: monasteryRecord.player, amount: monasteryRecord.amount });
    }
  }

  // bestTrader (Master Merchant) — anchored to the latest of the holder's
  // wine/grain/cloth events, whichever of the three happened last.
  const bestTraderRecord = achievements?.bestTrader;
  if (bestTraderRecord?.player) {
    const hit = GOODS_TYPES
      .map(type => eventsByPlayerType[`${bestTraderRecord.player}:${type}`]?.at(-1))
      .filter(Boolean)
      .reduce((latest, cur) => (!latest || cur.t > latest.t ? cur : latest), null);
    if (hit) {
      badges.push({ key: 'bestTrader', ...hit, img: ACHIEVEMENT_BADGE.bestTrader, player: bestTraderRecord.player, amount: bestTraderRecord.amount });
    }
  }

  const chart = (
    <>
      <div className="chart-header" style={{ margin: '0 0 1.2rem', textAlign: 'left' }}>Score Timeline</div>
      <ResponsiveContainer width="100%" height={260}>
        {/* overflow: visible — a badge earned right at the very end of the
            game lands close enough to endT that half its width can fall
            past the plot's right edge (the margin there is only sized for
            player-name labels, not a 52px icon). Badges already paint last
            (Customized is the final LineChart child below), so this just
            lets that top icon spill past the box instead of getting
            clipped by the chart's own SVG viewport. */}
        <LineChart data={rows} margin={{ top: 18, right: labelWidth, bottom: 0, left: -18 }} style={{ cursor: 'var(--cursor-arrow)', overflow: 'visible' }}>
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
          {finalScoringT != null && (
            <ReferenceLine
              x={finalScoringT}
              stroke="var(--stone-gray)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'Final Scoring', position: 'top', fill: 'var(--stone-gray)', fontSize: 9, fontFamily: 'Cinzel, serif' }}
            />
          )}
          {players.map((name, i) => (
            <Line
              key={name}
              dataKey={name}
              type="stepAfter"
              stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              label={<EndLabel lastIndex={rows.length - 1} name={name} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} dy={labelDy[name] || 0} />}
            />
          ))}
          {badges.length > 0 && <Customized component={(props) => <AchievementBadgeLayer {...props} badges={badges} />} />}
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
