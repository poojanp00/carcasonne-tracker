import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Customized, ReferenceLine, ResponsiveContainer } from 'recharts';
import { ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';
import { formatAchievementName } from '../utils/achievements';
import { LIVE_PLAY_ONLY_RECORD_TYPES, MONASTERY_RECORD_TYPES, MONASTERY_LIKE_MAX } from '../constants';
import ValInfo from './ValInfo';
import { useTapTooltip } from '../hooks/useTapTooltip';
import { EyeIcon, EyeOffIcon } from './icons';
import cImg   from '../../images/icons/C.png';
import pigImg from '../../images/icons/pig.png';

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

// Largest a badge is ever allowed to render at (the fixed size this always
// used to be), and the smallest it's allowed to shrink to before it'd stop
// reading as the actual badge art — scaled between the two based on the
// chart's own measured width (see useContainerWidth/badgeSize below), same
// "shrinks like everything else" clamp() spirit used all over this app for
// text, just computed in JS since these feed SVG width/height + position
// math rather than CSS. On a full-width desktop chart this lands right back
// at the original 52px (unchanged look); on a narrow phone-width chart it
// scales down instead of staying fixed and spilling off the right edge.
const BADGE_SIZE_MAX = 44;
const BADGE_SIZE_MIN = 18;
function badgeSizeFor(containerWidth) {
  if (!containerWidth) return BADGE_SIZE_MAX;
  return Math.max(BADGE_SIZE_MIN, Math.min(BADGE_SIZE_MAX, containerWidth * 0.075));
}

// Shared between layoutCallouts (sizing the box) and AchievementMarker
// (rendering into it) so the two can never drift apart — same label text,
// same font-size math either place.
function achievementLabelFor(key) {
  return ACHIEVEMENT_LABEL_OVERRIDE[key] || formatAchievementName(key);
}
function calloutFontSizes(size) {
  // Sized against BADGE_SIZE_MAX rather than the badge icon's own (now
  // smaller) size — badges shrank, but the callout text reads better
  // bigger, not smaller along with them.
  return {
    label: Math.max(11,   Math.min(14, size * (14 / BADGE_SIZE_MAX))),
    name:  Math.max(9.5,  Math.min(12, size * (12 / BADGE_SIZE_MAX))),
  };
}
// Rough average glyph width for these two fonts/weights at a given
// font-size — not exact per-character metrics, just enough to size a box
// that actually fits its own text instead of a single fixed width shared by
// every badge regardless of how long its label/player name is (a uniform
// box either clipped long labels like "Master Merchant" or left short ones
// like "Longest Road" swimming in empty space).
const LABEL_CHAR_W = 0.56; // Crimson Text italic
const NAME_CHAR_W  = 0.72; // Cinzel bold, all-caps — wider per letter
function calloutBoxSizeFor(b, size) {
  const { label: fLabel, name: fName } = calloutFontSizes(size);
  const line1 = `${achievementLabelFor(b.key)} · ${b.amount}`;
  const line2 = String(b.player);
  const textW = Math.max(line1.length * fLabel * LABEL_CHAR_W, line2.length * fName * NAME_CHAR_W);
  const boxW = Math.round(Math.max(78, Math.min(170, textW + 22)));
  const boxH = Math.round(Math.max(34, Math.min(46, size * (46 / BADGE_SIZE_MAX))));
  return { boxW, boxH };
}

// Achievement marker — the record badge sits directly on the line at the
// point it was earned; hovering (desktop) or tapping (mobile) it reveals a
// speech-bubble callout naming the record and its holder, via the same
// hover/tap/auto-close/one-at-a-time behavior ValInfo uses elsewhere in the
// app (see useTapTooltip) — badges stay quiet on the chart until asked
// about, rather than all their callouts permanently cluttering it at once.
// `leading` (computed by the caller, see ScoreTimelineChart's badges.map
// below) picks which way the bubble points: up-left when this badge's
// player is the highest-scoring line at that moment — there's nothing above
// the leader's own line, so a bubble going up-left almost never crosses
// another player's line — and down-right otherwise, since a trailing line
// more often has empty chart below it than above.
function AchievementMarker({ cx, cy, img, badgeKey, player, amount, size, leading, bx, by, boxW, boxH }) {
  const { visible, open, onMouseEnter, onMouseLeave, triggerRef } = useTapTooltip();
  if (cx == null || cy == null || !img) return null;
  const r = size / 2;
  const label = achievementLabelFor(badgeKey);
  const { label: labelFontSize, name: nameFontSize } = calloutFontSizes(size);

  // Tail: a smoothly curved sliver (two quadratic Béziers meeting at the
  // tip), not a straight-edged triangle — reads as one continuous line
  // flowing out of the bubble rather than a separate shape butted against
  // it. Its two base points sit well inside the bubble's own rounded-rect
  // edge (not just AT it), and the bubble <rect> below is drawn AFTER this
  // path in the same SVG coordinate space — so the rect's opaque fill
  // cleanly covers the tail's base with no cross-renderer seam (the old
  // version mixed an SVG polygon with a CSS-bordered HTML div, which is
  // exactly where that seam came from), leaving only the curved part
  // outside the bubble visible.
  const tailTip = leading
    ? [cx - r * 0.6, cy - r * 0.6]
    : [cx + r * 0.6, cy + r * 0.6];
  const inset = 14;
  const baseA = leading ? [bx + boxW - inset, by + boxH] : [bx, by + inset];
  const baseB = leading ? [bx + boxW, by + boxH - inset] : [bx + inset, by];
  const ctrlA = [(baseA[0] + tailTip[0]) / 2, (baseA[1] + tailTip[1]) / 2];
  const ctrlB = [(baseB[0] + tailTip[0]) / 2, (baseB[1] + tailTip[1]) / 2];
  const tailPath = `M ${baseA[0]} ${baseA[1]} Q ${ctrlA[0]} ${ctrlA[1]} ${tailTip[0]} ${tailTip[1]} Q ${ctrlB[0]} ${ctrlB[1]} ${baseB[0]} ${baseB[1]} Z`;

  return (
    <g
      ref={triggerRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={e => { e.stopPropagation(); open(); }}
      style={{ cursor: 'var(--cursor-pointer)' }}
    >
      {/* Invisible, larger-than-the-art hit target — the badge image
          itself can be as small as 18px on a shrunken chart, too small to
          reliably hover or tap otherwise. */}
      <circle cx={cx} cy={cy} r={Math.max(r, 18)} fill="transparent" />
      <image href={img} x={cx - r} y={cy - r} width={size} height={size} />
      {visible && (
        <g style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.28))' }}>
          <path d={tailPath} fill="var(--parchment)" stroke="var(--earth-brown)" strokeWidth="1" strokeLinejoin="round" />
          <rect x={bx} y={by} width={boxW} height={boxH} rx="6" ry="6" fill="var(--parchment)" stroke="var(--earth-brown)" strokeWidth="1" />
          <foreignObject x={bx} y={by} width={boxW} height={boxH} style={{ overflow: 'visible', pointerEvents: 'none' }}>
            <div style={{
              width: boxW,
              height: boxH,
              boxSizing: 'border-box',
              color: 'var(--charcoal)',
              padding: '0.2rem 0.4rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Crimson Text, serif',
              lineHeight: 1.2,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              <span style={{ fontStyle: 'italic', fontSize: labelFontSize }}>
                {label} · {amount}
              </span>
              <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: nameFontSize }}>
                {player}
              </span>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
}

// How close two badges' centers are allowed to land (in px) before they're
// pushed apart — smaller than the badge size so edges can still overlap a
// little, just not the whole icon. Scales down along with the badge itself
// (see badgeSizeFor above) so de-overlap spacing stays proportional on a
// shrunken chart instead of leaving oversized gaps between now-smaller icons.
function minBadgeGapFor(size) { return size - 14; }

// Badges close together in time can land at (almost) the same pixel spot,
// which without this would stack them fully on top of each other. Used to
// push the later one rightward in X to clear the earlier one — but that
// visibly detaches a badge from the moment it actually happened, landing it
// further along the timeline than the real event (worse the more crowded a
// game's ending is, which is exactly when this triggers most). Vertical
// spacing instead keeps every badge's true x/time position always — only cy
// moves, just far enough to clear the minimum gap, nudged toward whichever
// side it's already leaning (or down, if dead level) so a cluster fans out
// instead of collapsing. Checks every already-placed badge, not just the
// one immediately before it in sort order — a tight cluster of 3+ needs
// every pair kept apart, not just consecutive ones.
function spreadBadges(positioned, minGap) {
  const sorted = [...positioned].sort((a, b) => a.cx - b.cx);
  const placed = [];
  for (const b of sorted) {
    let cur = b;
    for (const p of placed) {
      const dx = cur.cx - p.cx;
      const dy = cur.cy - p.cy;
      if (Math.hypot(dx, dy) < minGap) {
        const needed = Math.sqrt(Math.max(0, minGap * minGap - dx * dx));
        const dir = dy >= 0 ? 1 : -1;
        cur = { ...cur, cy: p.cy + dir * needed };
      }
    }
    placed.push(cur);
  }
  return placed;
}

// Positions each badge's callout box relative to its own icon (up-left or
// down-right, per `leading` — see AchievementMarker) and pins it inside the
// chart's actual plotted-area bounds (`plot`, from recharts' `offset`) so
// it can't climb above the plot into the title/toggle-button row, or run
// off the left/right edge. Only ever one (rarely two, mid-hover-transition)
// of these is actually visible at a time now that callouts are hover/tap
// reveals rather than all shown permanently — so unlike the badge icons
// themselves (see spreadBadges, which DOES need to de-overlap a whole
// crowded row at once), a callout box has nothing else on screen it needs
// to dodge.
function layoutCallouts(positioned, size, plot) {
  const gap = 5;
  const r = size / 2;
  // Same small spill tolerance the rest of this file allows elsewhere —
  // a clamped box reads as "slightly past the edge", not flush-cut.
  const slack = 8;
  const minY = plot ? plot.top - slack : -Infinity;
  const minX = plot ? plot.left - slack : -Infinity;
  return positioned.map(b => {
    const { boxW, boxH } = calloutBoxSizeFor(b, size);
    let bx = b.leading ? b.cx - r - gap - boxW : b.cx + r + gap;
    let by = b.leading ? b.cy - r - gap - boxH : b.cy + r + gap;
    by = Math.max(by, minY);
    bx = Math.min(Math.max(bx, minX), plot ? plot.left + plot.width + slack - boxW : Infinity);
    return { ...b, bx, by, boxW, boxH };
  });
}

// Renders every badge at once, via recharts' Customized render props
// (xAxisMap/yAxisMap) — needed (rather than one ReferenceDot per badge) so
// their real pixel x positions are all known together, up front, for
// spreadBadges/layoutCallouts to de-overlap before anything paints.
function AchievementBadgeLayer({ badges, xAxisMap, yAxisMap, offset, size }) {
  const xScale = Object.values(xAxisMap || {})[0]?.scale;
  const yScale = Object.values(yAxisMap || {})[0]?.scale;
  if (!xScale || !yScale) return null;
  const positioned = spreadBadges(badges.map(b => ({ ...b, cx: xScale(b.t), cy: yScale(b.value) })), minBadgeGapFor(size));
  const withCallouts = layoutCallouts(positioned, size, offset);
  return (
    <g>
      {withCallouts.map(b => (
        <AchievementMarker key={b.key} cx={b.cx} cy={b.cy} img={b.img} badgeKey={b.key} player={b.player} amount={b.amount} size={size} leading={b.leading} bx={b.bx} by={b.by} boxW={b.boxW} boxH={b.boxH} />
      ))}
    </g>
  );
}

// Player-name label pinned to the right end of its line (renders only at the last point)
const EndLabel = ({ x, y, index, lastIndex, name, color, dy = 0, fontSize = 11 }) =>
  index === lastIndex ? (
    <text
      x={x + 7}
      y={y + dy}
      fill={color}
      fontSize={fontSize}
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
 * @param {boolean} isClutch     - Show the clutch-win sticker next to the title (moved here from the
 *                                 post-game/lightbox info bar, which now shows the realm name instead)
 * @param {boolean} farmWin      - Show the farm-win sticker next to the title, same as isClutch above
 */
export default function ScoreTimelineChart({ timeline, players, duration = 0, achievements = null, boxed = true, isClutch = false, farmWin = false }) {
  // Measures the chart's own rendered width so badgeSizeFor (above) can
  // shrink the achievement badges on a narrow/phone-width chart instead of
  // leaving them fixed-size and spilling past the edge — has to run before
  // the early-return below (rules of hooks), even though it's only actually
  // used once we know there's real content to measure.
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Record-badge icons can clutter a busy chart, so they start hidden —
  // this toggle just reveals/hides the badge layer as a whole (the lines/
  // scores underneath are unaffected); each individual badge's callout is
  // then its own hover/tap reveal on top of that (see AchievementMarker).
  // Local to this chart instance, not persisted: PostGameForm and Lightbox
  // both render this same component, so the control shows up in both
  // places for free, each starting fresh at "hidden".
  const [showBadges, setShowBadges] = useState(false);
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

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

  // Right margin sized to fit the longest player name next to its line —
  // also scales down on a narrow chart (see labelFontSize/EndLabel below),
  // same reasoning as the badge/axis sizing throughout this file.
  const finals = rows[rows.length - 1];
  const yMax = Math.max(...players.map(p => finals[p] || 0), 1);
  const labelFontSize = Math.max(8, Math.min(11, containerWidth ? containerWidth * 0.021 : 11));
  const labelWidth = Math.round(Math.max(...players.map(n => n.length)) * labelFontSize * 0.6) + 14;
  // Y-axis width sized to how many digits its own tick labels actually
  // need — recharts' own auto-width reserves more than these short
  // whole-number scores need, leaving a wasted gap between the ticks and
  // the chart's left edge (the old fixed margin.left: -18 below was only
  // ever a partial hack around that same over-wide default, most visible
  // now that the chart itself can be phone-narrow — see badgeSize above
  // for the same "shrinks like everything else" reasoning). *1.05 covers
  // recharts rounding the top tick up past yMax onto a "nicer" number that
  // can occasionally gain a digit (e.g. 95 -> 100). 6.5px/digit matches the
  // same char-width estimate used for labelWidth above; the flat +4 is only
  // tickSize (below, shortened from recharts' own default of 6) plus a
  // sliver of tickMargin — deliberately tight, not a guess-and-pad buffer,
  // since the whole point here is killing the leftover gap, not
  // re-introducing a smaller version of it.
  const yAxisWidth = Math.round(String(Math.ceil(yMax * 1.05)).length * 6.5) + 4;

  // Nudge labels apart when final scores land too close together: estimate each
  // label's pixel position from its share of the y-range, then walk top-down
  // enforcing a minimum gap and keep the offset from the original position.
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

  // Which line is on top at each badge's moment — decides the callout's
  // direction (see AchievementMarker): the leading player's line has
  // nothing above it, so pointing the callout up-left there clears every
  // other line almost for free; a trailing player's line more often has
  // clear space below it instead, so those point down-right.
  badges.forEach(b => {
    const row = [...rows].reverse().find(r => r.t <= b.t) || rows[0];
    const myScore = row[b.player] ?? 0;
    b.leading = players.every(p => (row[p] ?? 0) <= myScore);
  });

  const badgeSize = badgeSizeFor(containerWidth);

  const chart = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 1.2rem' }}>
        <div className="chart-header" style={{ margin: 0, textAlign: 'left' }}>Score Timeline</div>
        {isClutch && (
          <ValInfo tip="Clutch win" placement="above">
            <img src={cImg} alt="clutch" style={{ height: 18, width: 'auto', opacity: 0.85, display: 'block' }} />
          </ValInfo>
        )}
        {farmWin && (
          <ValInfo tip="Farm win" placement="above">
            <img src={pigImg} alt="farm win" style={{ height: 14, width: 'auto', opacity: 0.85, display: 'block' }} />
          </ValInfo>
        )}
        {badges.length > 0 && (
          <button
            type="button"
            className="settings-edit-btn"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            title={showBadges ? 'Hide record badges' : 'Show record badges'}
            onClick={() => setShowBadges(v => !v)}
          >
            {showBadges ? <EyeOffIcon /> : <EyeIcon />}
            {showBadges ? 'Hide Badges' : 'Show Badges'}
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {/* overflow: visible — a badge earned right at the very end of the
            game lands close enough to endT that half its width can fall
            past the plot's right edge (the margin there is only sized for
            player-name labels, not the badge icon itself — see badgeSize
            above, which shrinks that overhang along with the badge on a
            narrow chart instead of it staying fixed-size and spilling much
            further past the edge). Badges already paint last (Customized is
            the final LineChart child below), so this just lets that top
            icon spill past the box instead of getting clipped by the
            chart's own SVG viewport. */}
        <LineChart data={rows} margin={{ top: 18, right: labelWidth, bottom: 0, left: 0 }} style={{ cursor: 'var(--cursor-arrow)', overflow: 'visible' }}>
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
            width={yAxisWidth}
            tickSize={2}
            tickMargin={2}
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
              label={<EndLabel lastIndex={rows.length - 1} name={name} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} dy={labelDy[name] || 0} fontSize={labelFontSize} />}
            />
          ))}
          {showBadges && badges.length > 0 && <Customized component={(props) => <AchievementBadgeLayer {...props} badges={badges} size={badgeSize} />} />}
        </LineChart>
      </ResponsiveContainer>
    </>
  );

  if (!boxed) return <div ref={containerRef}>{chart}</div>;

  return (
    <div className="chart-wrapper" ref={containerRef}>
      <div className="chart-container" style={{ borderTop: '4px solid var(--warm-gold)', paddingTop: '1.25rem' }}>
        {chart}
      </div>
    </div>
  );
}
