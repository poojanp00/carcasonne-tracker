import { useEffect, useRef, useState } from 'react';
import { rankTitle, tiersRequiredForRank, getCurrentRank, getMaxRank } from '../utils/metaRank';
import { METRIC_UNITS, tierStateForProgress } from '../data/accountMilestones';
import { chestArt, logbookArt } from '../utils/artUnlocks';
import QuarterTierBar from './QuarterTierBar';
import RankQuarterBar from './RankQuarterBar';

// Fixed count/positions computed once per module load (not per render) so the
// embers don't re-randomize and restart on every re-render of the modal.
// Every 3rd ember is flagged "front" so it renders in its own layer ABOVE
// the card content instead of only ever drifting behind it — see the two
// EmberField calls at the bottom of the file (z-index can't be won from
// inside .rankup-embers itself, since that container's own z-index already
// boxes in everything inside it, so the front ones need to be a wholly
// separate sibling layer, not just a higher z-index on the same span).
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: Math.round((i / 16) * 100 + (Math.sin(i * 7.3) * 6)),
  delay: (i * 0.14) % 2.2,
  duration: 1.0 + (i % 5) * 0.15,
  front: i % 3 === 0,
}));

function EmberField({ front = false }) {
  const embers = EMBERS.filter(e => e.front === front);
  return (
    <div className={`rankup-embers rankup-embers--${front ? 'front' : 'back'}`} aria-hidden="true">
      {embers.map((e, i) => (
        <span
          key={i}
          className="rankup-ember"
          style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }}
        />
      ))}
    </div>
  );
}

// Generic slot-machine-style vertical reel: holds briefly on the first item,
// then scrolls through every item in order, landing on the last. One
// mechanism drives the rank line, each milestone category's tier-name
// transition, and the total-milestones count, so a rank-up reads as one
// consistent animated language rather than the rank being special-cased.
// `active` gates whether it's even allowed to start yet (sits on the first
// item, untouched, while false) — used to sequence multiple reels one after
// another instead of everything animating in parallel on mount (see
// MilestoneCategoryList). `onSettled` fires once the scroll has actually
// finished moving, not just started.
function Reel({ items, rowHeight = 46, holdMs = 380, className = '', rowStyle, active = true, reverse = false, onSettled }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setRevealed(true), holdMs);
    return () => clearTimeout(t);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps -- holdMs is fixed per call site
  const targetIndex = items.length - 1;
  // Bumped up from the original (0.5 + targetIndex*0.35) — the scroll read
  // as too quick, especially for a 2-item single-rank jump.
  const scrollDurationMs = (0.75 + targetIndex * 0.5) * 1000;
  // Always points at the LATEST onSettled, updated every render — the
  // settle timeout below is only ever (re-)scheduled once, the moment
  // `revealed` flips true, so closing over the plain `onSettled` prop
  // directly would freeze it at whatever it was at THAT render. For the
  // rank-up reel specifically, its onSettled checks sibling props
  // (displayedRank/rankFillAllDone) that keep changing for another second-
  // plus after `revealed` flips — e.g. the star-fill sequence generally
  // takes longer than this reel's own holdMs+scrollDuration to finish
  // landing every star — so the callback needs to read those values as they
  // are when the timeout actually FIRES, not as they were when it was
  // scheduled. Without this, it silently ran the stale, already-false
  // check and never called setRankReelDone, leaving "Nice!" permanently
  // disabled.
  const onSettledRef = useRef(onSettled);
  useEffect(() => { onSettledRef.current = onSettled; });
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => onSettledRef.current?.(), scrollDurationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);
  // `reverse` flips which way the track travels — the default (unrevealed
  // at 0, revealed at -targetIndex*rowHeight) always scrolls UPWARD,
  // exiting the top and entering from below. For the rank-up reel that read
  // as backwards ("ranking up" should feel like climbing, not sinking), so
  // it stacks the SAME items in reverse DOM order and swaps the two
  // offsets, making the track travel from -targetIndex*rowHeight down to 0
  // instead — the old value exits the bottom, the new one drops in from
  // the top, landing on the identical final item either way.
  const orderedItems = reverse ? [...items].reverse() : items;
  const restY = reverse ? -targetIndex * rowHeight : 0;
  const settledY = reverse ? 0 : -targetIndex * rowHeight;
  return (
    <div className={`rankup-reel ${className}`} style={{ height: rowHeight }}>
      <div
        className="rankup-reel-track"
        style={{
          transform: `translateY(${revealed ? settledY : restY}px)`,
          transitionDuration: `${scrollDurationMs / 1000}s`,
        }}
      >
        {orderedItems.map((item, i) => (
          <div key={i} className="rankup-reel-row" style={{ height: rowHeight, ...rowStyle }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

// Staggered so the milestones stage reads as one thing happening after
// another, not everything moving at once: the tier-name Reel (see call
// site) scrolls first, then the total-milestones count a beat later.
const TIER_HOLD_MS  = 380;
// Gap between each checkpoint in a multi-tier jump — long enough for the
// quarter bar's own 0.4s width transition to actually finish before the
// next quarter starts filling, so two quarters are never visibly animating
// at once.
const STEP_MS = 420;
// Breathing room between one milestone row fully settling and the next one
// starting — without this the cascade reads as one continuous blur instead
// of a series of distinct beats.
const ROW_PAUSE_MS = 400;

// How long a launched star takes to fly from its origin (a settled
// milestone row) to the star tray by the "Nice!" button, and the brief
// beats bookending that flight — a launch pop at the bar chunk it came
// from, a landing pop at the tray — so it reads as leaping OUT of the bar
// and landing WITH IMPACT, not just sliding across the card. Still an
// oversized, deliberate beat (not an instant blip), just a brisker one.
const STAR_LAUNCH_MS = 240;
const STAR_FLY_MS = 550;
const STAR_LAND_MS = 220;
// Rank-up page's own star sequence: how long after the page mounts before
// the rank-fill line (already fully assembled, see LineStar) starts
// draining into the bar — a brief pause so the player actually sees the
// whole line before anything moves.
const RANK_STAR_KICKOFF_DELAY_MS = 400;

// A brief expanding, fading glow — one at the origin bar chunk when a star
// launches, one at the tray when it lands. `.rankup-star-burst`'s keyframe
// lives in index.css (a static animation, since only ITS position varies
// per instance, not its motion).
function StarBurst({ x, y }) {
  return <span className="rankup-star-burst" aria-hidden="true" style={{ left: x, top: y }} />;
}

// A single ★ that materializes at (x0,y0) — the specific bar chunk that
// just completed — flies to (x1,y1) — the star tray by "Nice!", already
// aimed at wherever the NEXT star glyph will actually sit, not just the
// tray's fixed center — and lands with its own little burst, then calls
// onArrived. Both points are already relative to the same positioned
// ancestor (RankUpModal's own zIndex:1 wrapper). Four beats:
// 'prelaunch' (mounts tiny/transparent, no transition — the instant-snap
//   starting point every transition needs) →
// 'launch' (eases up to full oversized size/opacity right where it
//   started — this is the "appear" the star actually animates through,
//   fixing the old version's instant, ungraceful pop-in) →
// 'flying' (the translate to the tray, plus a full spin) →
// 'landed' (a second burst at the destination while the star shrinks away
//   — the tray's own ★ count ticks up right as this happens, so it reads
//   as the star becoming part of the count rather than just vanishing).
// `holdMs` (default 0) adds extra time in the grown-but-stationary 'launch'
// beat before it actually takes off — used by the rank-up page's stars to
// sit and be seen for a moment (and to stagger a whole group of them) before
// launching into the rank bar, where the milestones page's stars fly off
// right away.
function FlyingStar({ x0, y0, x1, y1, holdMs = 0, onArrived }) {
  const [phase, setPhase] = useState('prelaunch'); // 'prelaunch' | 'launch' | 'flying' | 'landed'
  useEffect(() => {
    // A SINGLE rAF here occasionally lands in the same paint as the
    // 'prelaunch' mount itself (more likely the busier the page is —
    // several stars launching close together, as with a big multi-tier
    // round) — the browser then never actually commits the tiny/
    // transparent starting style before flipping to 'launch', so the
    // transition has nothing to interpolate FROM and the star just snaps
    // straight to full size with no visible grow-in ("shows up added").
    // Nesting a second rAF guarantees a real painted frame at 'prelaunch'
    // happens first, so the transition always has something to animate
    // out of.
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('launch'));
    });
    const t1 = setTimeout(() => setPhase('flying'), STAR_LAUNCH_MS + holdMs);
    const t2 = setTimeout(() => setPhase('landed'), STAR_LAUNCH_MS + holdMs + STAR_FLY_MS);
    const t3 = setTimeout(() => onArrived?.(), STAR_LAUNCH_MS + holdMs + STAR_FLY_MS + STAR_LAND_MS);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atOrigin = phase === 'prelaunch' || phase === 'launch';
  const landed = phase === 'landed';
  const [x, y] = atOrigin ? [x0, y0] : [x1, y1];
  const scale = landed ? 0.3 : phase === 'prelaunch' ? 0.3 : phase === 'launch' ? 1.8 : 1;
  const opacity = phase === 'prelaunch' ? 0 : landed ? 0 : 1;
  const rotate = atOrigin ? 0 : 360;
  const transition =
    phase === 'prelaunch' ? 'none' :
    phase === 'launch'    ? `transform ${STAR_LAUNCH_MS}ms ease-out, opacity ${STAR_LAUNCH_MS}ms ease-out` :
    phase === 'flying'    ? `transform ${STAR_FLY_MS}ms cubic-bezier(0.3, 0, 0.2, 1)` :
                             `transform ${STAR_LAND_MS}ms ease-in, opacity ${STAR_LAND_MS}ms ease-in`;

  return (
    <>
      {atOrigin && <StarBurst x={x0} y={y0} />}
      {landed && <StarBurst x={x1} y={y1} />}
      <span
        aria-hidden="true"
        className="rankup-star-glyph"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
          transition,
          opacity,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        ★
      </span>
    </>
  );
}

// The rank-fill line's own stars (see RankUpModal's rank-progress header):
// all of them are visible immediately, full-size, the instant the line
// mounts — no grow-in choreography, so the line just reads as already
// assembled and waiting, not something the player has to watch appear.
// `spent` (set once this star's own FlyingStar has been spawned from the
// same spot — see launchLineStar in RankUpModal) fades it out rather than
// removing it outright, so the handoff from "resting in the line" to
// "flying into the bar" reads as one star departing, not two overlapping.
// `elRef` is a plain callback ref (not React.forwardRef, to match this
// file's existing style) so the parent can measure this star's position
// when it's time to launch.
function LineStar({ spent = false, elRef }) {
  return (
    <span
      ref={elRef}
      aria-hidden="true"
      className="rankup-star-glyph"
      style={{
        display: 'inline-block',
        opacity: spent ? 0 : 1,
        transition: 'opacity 150ms ease-out',
      }}
    >
      ★
    </span>
  );
}

// Checkpoint progress values to step through, one tier at a time: a rare
// multi-tier jump (a big score crossing two tier thresholds in one game)
// would otherwise animate every crossed quarter at once if it went straight
// from beforeBar to afterBar. Each checkpoint sits exactly at a crossed
// tier's threshold — completing only THAT tier's quarter, leaving the next
// one still at 0 until its own turn — finishing on the real final progress
// (which may sit partway into the tier after the last one crossed, not
// necessarily its own threshold).
function buildProgressSteps(beforeBar, afterBar, tiers) {
  const steps = [beforeBar.progress];
  for (let t = beforeBar.currentTierNumber + 1; t <= afterBar.currentTierNumber; t++) {
    steps.push(tiers.find(tt => tt.tierNumber === t).threshold);
  }
  if (steps[steps.length - 1] !== afterBar.progress) steps.push(afterBar.progress);
  return steps;
}

// QuarterTierBar/RankQuarterBar's own width transition (see those files) —
// how much longer after the LAST step fires before the bar has actually
// finished visually filling, used to time onSettled below.
const BAR_TRANSITION_MS = 400;

// Smoothly counts from `from` to `to` over durationMs, reporting every
// intermediate (rounded) value via onChange on each animation frame — an
// actual rolling counter (every number along the way, not just tier
// thresholds), landing on the exact final value right as the bar settles.
// Only runs while `active`; reports `from` immediately otherwise (the
// "hasn't started yet" resting value).
function useRollingCounter(from, to, durationMs, active, onChange) {
  useEffect(() => {
    if (!active) { onChange?.(from); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      onChange?.(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

// Same quarter-chunked bar as Profile's "All Milestones" card and
// MemberProgressModal — one look for "how close to a tier" everywhere. Each
// quarter fills from its BEFORE fraction to its AFTER one, one quarter at a
// time (see buildProgressSteps) — QuarterTierBar's own per-quarter width
// transition (steps(8, end), same as every other bar here) animates each
// swap, so a crossed tier's quarter visibly fills up rather than just
// appearing done. `active`/`onSettled` mirror Reel's — gates whether this
// has even started yet, and reports once it's actually finished animating.
// `onProgressChange` reports a smoothly rolling progress number (see
// useRollingCounter) spanning the SAME total duration as the bar's own
// tier-by-tier fill, so a caller can show a matching gray "current
// progress" figure that scrolls continuously up to the final total instead
// of just showing it immediately or jumping between tier thresholds.
function RankUpCategoryBar({ diff, active = true, onSettled, onProgressChange, onTiersReachedChange }) {
  const steps = buildProgressSteps(diff.beforeBar, diff.afterBar, diff.category.tiers);
  const [stepIndex, setStepIndex] = useState(0);
  const totalDurationMs = TIER_HOLD_MS + Math.max(0, steps.length - 2) * STEP_MS + BAR_TRANSITION_MS;
  useEffect(() => {
    if (!active) return;
    const timers = steps.slice(1).map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), TIER_HOLD_MS + i * STEP_MS)
    );
    const settleTimer = setTimeout(() => onSettled?.(), totalDurationMs);
    return () => { timers.forEach(clearTimeout); clearTimeout(settleTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useRollingCounter(diff.beforeBar.progress, diff.afterBar.progress, totalDurationMs, active, onProgressChange);

  const unit = METRIC_UNITS[diff.category.metric] ?? 'pts';
  const bar = tierStateForProgress(diff.category, steps[stepIndex]);
  // Reports how many tiers are reached AT THIS STEP, not the final count —
  // fires in step with the bar's own checkpoints (see steps/stepIndex
  // above), so a caller's star pips light up as each tier's quarter starts
  // filling toward its threshold, not all at once at the end.
  useEffect(() => {
    onTiersReachedChange?.(bar.reached.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar.reached.length]);
  return (
    <QuarterTierBar
      tiers={diff.category.tiers}
      progress={bar.progress}
      unit={unit}
      currentTier={bar.currentTier}
      nextTier={bar.nextTier}
      remaining={bar.remaining}
      maxed={bar.maxed}
    />
  );
}

// Checkpoint tierCount values to step through, one rank at a time — same
// idea as buildProgressSteps above, generalized to the rank ladder (rare,
// but a huge tierCount jump in one game could cross several ranks at once,
// same "skip rank" case as a multi-tier category jump).
function buildRankSteps(beforeRank, afterRank, beforeTierCount, tierCount) {
  const steps = [beforeTierCount];
  for (let r = beforeRank + 1; r <= afterRank; r++) {
    steps.push(tiersRequiredForRank(r));
  }
  if (steps[steps.length - 1] !== tierCount) steps.push(tierCount);
  return steps;
}

// Rank-ladder counterpart to RankUpCategoryBar — same RankQuarterBar visual
// Profile's hero card uses, stepping through one rank at a time so a
// multi-rank jump fills one piece before the next starts, same reasoning as
// the category bars above. `active`/`onSettled` mirror RankUpCategoryBar's,
// and so does `onProgressChange` — a smoothly rolling tierCount (see
// useRollingCounter) spanning the bar's total fill duration, so a caller
// can show a matching "N milestones" figure that scrolls continuously
// rather than jumping between rank thresholds.
export function RankUpRankBar({ beforeRank, afterRank, beforeTierCount, tierCount, active = true, onSettled, onProgressChange }) {
  const steps = buildRankSteps(beforeRank, afterRank, beforeTierCount, tierCount);
  const [stepIndex, setStepIndex] = useState(0);
  const totalDurationMs = TIER_HOLD_MS + Math.max(0, steps.length - 2) * STEP_MS + BAR_TRANSITION_MS;
  useEffect(() => {
    if (!active) return;
    const timers = steps.slice(1).map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), TIER_HOLD_MS + i * STEP_MS)
    );
    const settleTimer = setTimeout(() => onSettled?.(), totalDurationMs);
    return () => { timers.forEach(clearTimeout); clearTimeout(settleTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const stepTierCount = steps[stepIndex];

  // RankQuarterBar's box COUNT is driven by displayedRank, not the rank
  // implied by stepTierCount directly — bumping it the instant a box's fill
  // target hits 100% would pop the next (empty) box into view before that
  // fill transition has actually finished playing. Delaying the bump by the
  // bar's own transition duration lets the current box finish filling
  // first, THEN reveals the next one — matching how a real multi-rank jump
  // should read (fill, then add, not add-then-fill).
  const [displayedRank, setDisplayedRank] = useState(beforeRank);
  useEffect(() => {
    const targetRank = getCurrentRank(stepTierCount);
    if (targetRank <= displayedRank) return;
    const t = setTimeout(() => setDisplayedRank(targetRank), BAR_TRANSITION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepTierCount]);

  // Mirrors RankQuarterBar's own "remaining to next rank" calc (see that
  // file) — duplicated here, keyed off displayedRank (not stepRank), so the
  // red countdown always matches whichever "next rank" box is currently on
  // screen.
  const maxed = displayedRank >= getMaxRank();
  const nextUpper = maxed ? 0 : tiersRequiredForRank(displayedRank + 1);
  const rawRemaining = maxed ? 0 : Math.max(0, nextUpper - stepTierCount);
  // Only the TRUE final checkpoint has a real "remaining to next rank"
  // figure — every earlier one is mid multi-rank-jump, still counting up
  // toward some intermediate rank threshold, not the actual next-rank
  // target. Showing those briefly as a red countdown looked like a jump
  // from one big number straight to a much smaller one; suppressing it
  // until here means the box just shows the rank name until it's right.
  const showRemaining = stepTierCount === tierCount;

  useRollingCounter(beforeTierCount, tierCount, totalDurationMs, active, onProgressChange);
  return <RankQuarterBar tierCount={stepTierCount} currentRank={displayedRank} remaining={rawRemaining} showRemaining={showRemaining} />;
}

// Delays between each flicker frame while ArtFlipReveal cycles through
// candidates — starts slow, accelerates, then holds fast for an extended
// stretch (everything from RAMP_LENGTH on) so it doesn't feel like it lands
// the instant it speeds up, before finally revealing.
const RAMP_LENGTH = 16;
const FLIP_DELAYS_MS = [
  420, 380, 340, 300, 265, 230, 200, 175, 150, 130, 112, 97, 84, 73, 68, 65, // ramp: slow -> fast (starts quicker than before)
  65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,           // held fast, converging
];

// Deterministic pseudo-random in [0, 1) for an integer seed — used instead
// of Math.random() so the displayed candidate for a given step stays stable
// across re-renders that aren't themselves a step change (this component
// isn't memoized, so its parent re-rendering for unrelated reasons must not
// make the silhouette visibly jitter to a new candidate mid-frame).
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// One chest OR logbook grant's reveal (utils/artUnlocks.js: every rank
// resolves automatically, this is purely presentational). Flickers a
// silhouette back and forth through every candidate that was "in the draw"
// for this rank — slowing→speeding per FLIP_DELAYS_MS. Once the held-fast
// phase starts (step >= RAMP_LENGTH), the flicker increasingly lands on the
// real winner rather than cycling candidates evenly — still shown as a
// silhouette throughout, so it visibly "converges" on the answer before the
// actual (already-decided) full-color reveal. Chest and logbook each get
// their OWN instance of this (see ArtGrantRow below) — they draw
// independently now, not bundled as a pair — but both instances share the
// same FLIP_DELAYS_MS step schedule and start mounting in the same render,
// so they land on their reveals at the same moment. `scale` (fraction of
// the fixed .art-flip-single box) lets a caller size chest vs. logbook art
// differently — the two catalogs aren't drawn at the same real-world scale
// to begin with, so filling the box edge-to-edge for both made the logbook
// looked oversized next to the chest. `active` (default true) gates whether
// the flip is even allowed to start — while false, it sits at step 0
// (silhouette, static, showing the first candidate, untouched) instead of
// ticking — used so the whole reveal waits on a player click rather than
// starting the instant the stage mounts (see artStarted in RankUpModal).
function ArtFlipReveal({ candidates, winnerItemId, artFor, alt, scale = 1, active = true, onRevealed }) {
  const trivial = candidates.length <= 1;
  const [step, setStep] = useState(trivial ? FLIP_DELAYS_MS.length : 0);
  const revealed = step >= FLIP_DELAYS_MS.length;
  let displayItemId;
  if (revealed) {
    displayItemId = winnerItemId;
  } else if (step < RAMP_LENGTH) {
    displayItemId = candidates[step % candidates.length];
  } else {
    const holdLength = FLIP_DELAYS_MS.length - RAMP_LENGTH;
    const holdProgress = (step - RAMP_LENGTH) / Math.max(1, holdLength - 1);
    const winnerBias = 0.3 + holdProgress * 0.62; // 30% -> 92% chance of landing on the winner
    displayItemId = pseudoRandom(step * 7 + winnerItemId) < winnerBias
      ? winnerItemId
      : candidates[step % candidates.length];
  }

  useEffect(() => {
    if (revealed) { onRevealed?.(); return; }
    if (!active) return;
    const t = setTimeout(() => setStep(s => s + 1), FLIP_DELAYS_MS[step]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  return (
    <div className={`pairflip-card art-flip-single${revealed ? ' revealed' : ''}`}>
      <img
        src={artFor(displayItemId)}
        alt={revealed ? `${alt} unlocked` : alt}
        style={{ maxHeight: `${scale * 100}%`, maxWidth: `${scale * 100}%`, width: 'auto', height: 'auto', filter: revealed ? 'none' : 'brightness(0)', transition: 'filter 0.3s ease' }}
        draggable={false}
      />
    </div>
  );
}

// A single rank's chest + logbook grant, flipping simultaneously side by
// side. Both ArtFlipReveal instances mount in the same render and share the
// same step schedule, so they land on their reveals together — this only
// calls onRowRevealed once BOTH have actually landed, not as soon as
// either one does. `active` mirrors ArtFlipReveal's own — passed through
// to both, so the whole row waits on the same player-click gate.
function ArtGrantRow({ grant, active = true, onRowRevealed }) {
  const [chestDone, setChestDone] = useState(false);
  const [logbookDone, setLogbookDone] = useState(false);
  useEffect(() => {
    if (chestDone && logbookDone) onRowRevealed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chestDone, logbookDone]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <ArtFlipReveal
          candidates={grant.chest.candidates}
          winnerItemId={grant.chest.itemId}
          artFor={chestArt}
          alt="Chest"
          active={active}
          onRevealed={() => setChestDone(true)}
        />
        <ArtFlipReveal
          candidates={grant.logbook.candidates}
          winnerItemId={grant.logbook.itemId}
          artFor={logbookArt}
          alt="Logbook"
          scale={0.8}
          active={active}
          onRevealed={() => setLogbookDone(true)}
        />
      </div>
    </div>
  );
}

// One category's label/reel/bar — active only once its turn arrives (see
// MilestoneCategoryList), and reports "done" only once BOTH the tier-name
// reel and the progress bar have actually finished animating, not as soon
// as either one does (same two-part gate as ArtGrantRow's chest+logbook).
// onStarEarned fires once PER TIER actually crossed (not once per row) —
// exactly in step with onTiersReachedChange below, since that's the same
// moment a ☆ pip turns into a ★ — with that specific pip's own element, so
// a caller can launch a flying star from exactly the one that just filled.
function MilestoneRow({ diff, active, onSettled, onStarEarned }) {
  const pipsRef = useRef(null);
  const [barDone, setBarDone] = useState(false);
  // Mirrors whatever RankUpCategoryBar's bar is currently showing, starting
  // at the BEFORE value — so the gray "(N pts)" figure counts up alongside
  // the bar instead of just displaying the final total immediately.
  const [progress, setProgress] = useState(diff.beforeBar.progress);
  // Mirrors how many tiers the bar has reached AT ITS CURRENT STEP — drives
  // ONLY the reveal scheduling below, never the pips directly (see
  // revealedTiers), since the bar can be logically "at" a tier before that
  // tier's own quarter has actually finished its visual fill.
  const [tiersReached, setTiersReached] = useState(diff.beforeBar.reached.length);
  const prevTiersReachedRef = useRef(diff.beforeBar.reached.length);
  // Fixed at mount — how many tiers were ALREADY earned going into this
  // round, so the pip pop animation (below) can tell "already had this
  // star" apart from "just earned it," and only plays for the latter.
  const initialRevealedTiers = diff.beforeBar.reached.length;
  // How many tiers' pips have actually been revealed (☆→★) — lags
  // tiersReached by BAR_TRANSITION_MS per tier, so a pip only flips (and
  // its star launches toward "Nice!") once that tier's own bar quarter has
  // visibly finished filling, not the instant the bar logically crosses it.
  // A multi-tier jump in a single game (rare, but possible) fires one
  // independent timer per tier rather than chaining each on the previous
  // star's full flight — the bar's own steps are already STEP_MS apart, so
  // this naturally lands each reveal that same rhythm apart (several stars
  // can be mid-flight together), reading as a tight "boom boom boom" burst
  // instead of a long wait for each one to fully land before the next
  // even starts.
  const [revealedTiers, setRevealedTiers] = useState(diff.beforeBar.reached.length);
  const revealTimersRef = useRef([]);
  useEffect(() => () => revealTimersRef.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (barDone) onSettled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barDone]);
  // Schedules one delayed reveal per NEWLY crossed tier — never for the
  // initial mount value.
  useEffect(() => {
    for (let i = prevTiersReachedRef.current; i < tiersReached; i++) {
      const tierIndex = i;
      const t = setTimeout(() => {
        setRevealedTiers(r => Math.max(r, tierIndex + 1));
        const pipEl = pipsRef.current?.querySelector(`[data-pip-index="${tierIndex}"]`);
        onStarEarned?.(pipEl || pipsRef.current);
      }, BAR_TRANSITION_MS);
      revealTimersRef.current.push(t);
    }
    prevTiersReachedRef.current = tiersReached;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersReached]);

  return (
    <div className="rankup-category-row">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
        <span className="rankup-category-label">
          {diff.category.label}
          <span className="rankup-category-progress">
            ({progress.toLocaleString()} {METRIC_UNITS[diff.category.metric] ?? 'pts'})
          </span>
        </span>
        {/* Just the pips now — no more tier-name reel next to them (used to
            be here, removed per feedback: "just the star pips is enough").
            Each pip is its own span (data-pip-index) so launchStar can find
            exactly the one that just turned ★ — a plain repeated-character
            string couldn't be addressed like that. */}
        <span className="rankup-tier-stars" ref={pipsRef} aria-label={`${revealedTiers} of ${diff.category.tiers.length} tiers unlocked`}>
          {Array.from({ length: diff.category.tiers.length }, (_, i) => (
            <span
              key={i}
              data-pip-index={i}
              // The reveal pop (see .rankup-star-pop) only plays for a pip
              // newly earned THIS round (i >= the mount-time seed) — it's
              // added the instant revealedTiers passes this index and then
              // just stays, so a re-render for unrelated reasons never
              // restarts it. A pip already earned before this round (i <
              // the seed) renders ★ from the very first frame with NO
              // animation class — without this guard, browsers still play a
              // CSS animation on an element's very first paint if the class
              // is present at creation, so an already-earned pip would
              // incorrectly pop in on mount too.
              className={(i < revealedTiers && i >= initialRevealedTiers) ? 'rankup-star-pop' : undefined}
              style={(i < revealedTiers && i >= initialRevealedTiers) ? { display: 'inline-block', animationDuration: `${STAR_LAUNCH_MS}ms` } : undefined}
            >
              {i < revealedTiers ? '★' : '☆'}
            </span>
          ))}
        </span>
      </div>
      <RankUpCategoryBar
        diff={diff}
        active={active}
        onSettled={() => setBarDone(true)}
        onProgressChange={setProgress}
        onTiersReachedChange={setTiersReached}
      />
    </div>
  );
}

// The per-category progress rows on the 'milestones' stage (see below) —
// every category with any progress this round, crossed tiers animated,
// others shown at their current state. Rows appear and animate one at a
// time, in order — row N isn't even rendered until row N-1 has actually
// finished (both its reel and its bar), rather than every row sitting
// pre-mounted and animating in parallel the instant the stage mounts. Once
// the LAST row finishes, onAllSettled fires (used to gate this stage's own
// "Nice!" button — see RankUpModal below). A short pause (ROW_PAUSE_MS)
// separates one row settling from the next one starting, so the cascade
// reads as a series of distinct beats instead of one continuous blur.
// onStarEarned passes straight through to every row (see MilestoneRow) —
// it fires per tier crossed regardless of cascade position, so it isn't
// tied to activeIndex/handleRowSettled at all.
function MilestoneCategoryList({ categoryDiffs, onAllSettled, onStarEarned }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pauseTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(pauseTimerRef.current), []);
  const handleRowSettled = (i) => {
    if (i !== activeIndex) return; // stale callback from an already-settled row, ignore
    const next = i + 1;
    pauseTimerRef.current = setTimeout(() => {
      setActiveIndex(next);
      if (next >= categoryDiffs.length) onAllSettled?.();
    }, ROW_PAUSE_MS);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Every row is mounted from the start (so the card claims its full
          final height immediately and never grows as later rows arrive) —
          rows not yet at their turn stay visibility:hidden (which still
          reserves their layout space, unlike not rendering them at all),
          only becoming visible once activeIndex reaches them. */}
      {categoryDiffs.map((diff, i) => (
        <div key={diff.category.id} style={{ visibility: i <= activeIndex ? 'visible' : 'hidden' }}>
          <MilestoneRow
            diff={diff}
            active={i <= activeIndex}
            onSettled={() => handleRowSettled(i)}
            onStarEarned={onStarEarned}
          />
        </div>
      ))}
    </div>
  );
}

// Post-game celebration — shown alongside PostGameForm whenever the account's
// milestone progress moved at all this game, not just on a tier crossing, so
// players can watch their bars fill up over time. Two stages, each its own
// page, only ever shown if it has real content — 'milestones' (every
// category with any progress, crossed tiers animated) → 'rankup' (the
// rank-up reel/bar, if the game crossed a rank, PLUS any chest/logbook art
// grants below it, user-triggered — see artStarted below; art grants attach
// to this stage even on a round with no rank crossing at all, since there's
// nowhere else for them to live). The "Nice!" button always stays visible on
// every stage — just disabled, never hidden, while something's still
// animating/unrevealed. Same .realm-modal/.tile-card visual family as
// HowToModal (HowToGuide.jsx).
export default function RankUpModal({ playerName, beforeRank, afterRank, beforeTierCount, tierCount, categoryDiffs, newArtGrants = [], onClose }) {
  // Locks the page underneath from scrolling while the celebration is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const rankedUp = afterRank > beforeRank;
  const hasMilestoneContent = categoryDiffs.length > 0;
  const hasArtGrants = newArtGrants.length > 0;
  // Opens on 'milestones' if there's any, otherwise straight to 'rankup'
  // (which covers both a real rank crossing AND a pure art-grant catch-up
  // with no rank crossing this round). The empty fallback only happens if
  // somehow none of the three have anything at all, which shouldn't occur
  // in practice (this modal isn't rendered without SOME content).
  const [stage, setStage] = useState(
    hasMilestoneContent ? 'milestones' : ((rankedUp || hasArtGrants) ? 'rankup' : 'milestones')
  ); // 'milestones' | 'rankup'
  const name = playerName || 'Adventurer';

  // Whether the milestones stage's cascade has fully finished — gates its
  // OWN "Nice!" button.
  const [milestonesSettled, setMilestonesSettled] = useState(!hasMilestoneContent);
  // Coordinate origin for launchStar's math below — the positioned wrapper
  // div everything else lives in (see the JSX), so measured rects only need
  // converting to ONE shared coordinate space, not the viewport's.
  const modalBodyRef = useRef(null);
  // Stars disappear straight into the "Nice!" button itself on the
  // milestones stage (no separate visible tray/running total there
  // anymore) — this ref is shared by BOTH stages' buttons (only one is
  // ever mounted at a time), so it's always pointing at whichever one is
  // currently on screen.
  const niceButtonRef = useRef(null);
  const [flyingStars, setFlyingStars] = useState([]); // [{id, kind, x0, y0, x1, y1, holdMs}]
  // Fired once per tier crossed on the milestones stage (see MilestoneRow's
  // reveal timers) with that specific pip's own element — measures both it
  // and the button relative to modalBodyRef and launches a FlyingStar
  // between them. A multi-tier jump fires several of these independently
  // (see MilestoneRow), so more than one can be mid-flight at once —
  // that's intentional, a tight back-to-back burst rather than each
  // waiting on the previous one to fully land.
  const launchStar = (fromEl) => {
    const container = modalBodyRef.current;
    const target = niceButtonRef.current;
    if (!container || !target || !fromEl) return;
    const containerRect = container.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = target.getBoundingClientRect();
    const id = `${Date.now()}-${Math.random()}`;
    setFlyingStars(prev => [...prev, {
      id,
      kind: 'collect',
      x0: fromRect.left - containerRect.left + fromRect.width / 2,
      y0: fromRect.top - containerRect.top + fromRect.height / 2,
      x1: toRect.left - containerRect.left + toRect.width / 2,
      y1: toRect.top - containerRect.top + toRect.height / 2,
    }]);
  };
  const handleStarArrived = (id, kind) => {
    setFlyingStars(prev => prev.filter(s => s.id !== id));
    if (kind === 'rankFill') setStarsLandedTotal(c => c + 1);
  };

  // ── Rank-progress section's star-driven bar fill ──────────────────────────
  // Always runs whenever this round earned any milestone at all (not just a
  // genuine rank crossing) — see nextAfterMilestones below — so "Rank
  // Progress" is visible even without leveling up. starsThisRound is exact,
  // not a watched counter: every star = exactly one tier crossed somewhere
  // (buildRankUpDiff/metaRank.js only ever includes tier-CROSSING
  // categories), so it always equals tierCount - beforeTierCount.
  const starsThisRound = tierCount - beforeTierCount;
  const rankFillMaxed = beforeRank >= getMaxRank();
  const doRankFill = starsThisRound > 0 && !rankFillMaxed;

  // Where the rank-fill line's stars materialize (next to the header) and
  // the actual box they fly into — see the JSX below for both refs.
  const lineStarRefs = useRef([]);
  const rankBarWrapperRef = useRef(null);
  // How many rank-fill stars have actually landed (cumulative across every
  // box this round touches, not per-box) — the box math below derives
  // everything else live from this single counter plus beforeTierCount,
  // reusing getCurrentRank/tiersRequiredForRank instead of a precomputed
  // step list, so it automatically walks box-by-box for a multi-rank jump
  // the same way a single-rank one does.
  const [starsLandedTotal, setStarsLandedTotal] = useState(0);
  const rankFillPosition = beforeTierCount + Math.min(starsLandedTotal, starsThisRound);
  const rankFillAllDone = !doRankFill || starsLandedTotal >= starsThisRound;
  // The rank whose "next box" is CURRENTLY being filled at rankFillPosition
  // — the instant a box's threshold is met, getCurrentRank already reports
  // the bumped rank. Used ONLY to detect that a box has actually completed
  // (compared against displayedRank below) — never to compute the box being
  // SHOWN, since it jumps ahead the instant the last star lands, before
  // RankQuarterBar has actually revealed the new box.
  const activeRank = doRankFill ? getCurrentRank(rankFillPosition) : beforeRank;

  // displayedRank is what actually controls RankQuarterBar's rendered box
  // count, deliberately lagging activeRank by BAR_TRANSITION_MS so the next
  // box never pops in before the current one visibly finishes filling — see
  // the effect below.
  const [displayedRank, setDisplayedRank] = useState(beforeRank);
  // Box math (fraction + the star's landing target) is deliberately keyed
  // off displayedRank, not activeRank: activeRank can already be reporting
  // the NEXT rank the instant a box completes, before the delay above has
  // played out, and computing off it during that window would fill the
  // wrong (not-yet-revealed) box's math while the ALREADY-complete box is
  // still on screen — clamping rankFillFraction to 1 below instead
  // correctly holds the just-completed box at "full" for the whole wait,
  // rather than it briefly emptying out and re-filling once the next box
  // appears. This is also what launchLineStar aims each star at, so a star
  // always lands exactly where the visible fill edge actually is, not
  // wherever a not-yet-revealed box's math would put it.
  const displayBoxMaxed = displayedRank >= getMaxRank();
  const boxLower = displayedRank <= 1 ? 0 : tiersRequiredForRank(displayedRank);
  const boxUpper = displayBoxMaxed ? boxLower : tiersRequiredForRank(displayedRank + 1);
  const boxSize = Math.max(1, boxUpper - boxLower);
  const rankFillFraction = displayBoxMaxed ? 1 : Math.max(0, Math.min(1, (rankFillPosition - boxLower) / boxSize));

  useEffect(() => {
    if (activeRank <= displayedRank) return;
    const t = setTimeout(() => setDisplayedRank(activeRank), BAR_TRANSITION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRank]);
  // Safety net: activeRank is recomputed live from getCurrentRank/
  // tiersRequiredForRank, which SHOULD always land exactly on afterRank
  // once every star has landed (afterRank was computed with the same
  // formula upstream) — but if that ever drifts (e.g. the client's
  // milestone/max-rank config hasn't finished loading yet, or genuinely
  // disagrees with whatever computed afterRank in the first place),
  // displayedRank could get stuck short of afterRank forever, and with it
  // the "Nice!" button (rankSettled below requires displayedRank ===
  // afterRank — see the reel's onSettled in the JSX). Once every star is
  // accounted for, force displayedRank to the authoritative afterRank
  // prop regardless, so the celebration always closes.
  useEffect(() => {
    if (!rankFillAllDone || displayedRank === afterRank) return;
    const t = setTimeout(() => setDisplayedRank(afterRank), BAR_TRANSITION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankFillAllDone, afterRank]);

  // The rank-fill line: `starsThisRound` stars sit fully assembled next to
  // the header from the start (see LineStar — no grow-in), then launch one
  // at a time into whichever box is currently active. lineReady gates the
  // FIRST launch (a brief pause so the whole line is actually seen before
  // it starts draining); after that, each further launch waits for the
  // previous star to land AND (if it just completed a box) for
  // displayedRank to catch up to activeRank, so a star never flies toward
  // a box mid-transition.
  const [launchedCount, setLaunchedCount] = useState(0);
  // A brief pause after the stage mounts, letting the player actually see
  // the full line assembled before it starts draining into the bar — the
  // only "wait" left now that the line itself has no grow-in choreography
  // (see LineStar).
  const [lineReady, setLineReady] = useState(false);
  useEffect(() => {
    if (!doRankFill || stage !== 'rankup') return;
    const t = setTimeout(() => setLineReady(true), RANK_STAR_KICKOFF_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doRankFill, stage]);
  const launchLineStar = (index) => {
    setLaunchedCount(c => c + 1);
    const container = modalBodyRef.current;
    const fromEl = lineStarRefs.current[index];
    const toEl = rankBarWrapperRef.current?.querySelector('[data-next-box]');
    if (!container || !fromEl || !toEl) { setStarsLandedTotal(c => c + 1); return; }
    const containerRect = container.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    setFlyingStars(prev => [...prev, {
      id: `rankfill-${index}`,
      kind: 'rankFill',
      x0: fromRect.left - containerRect.left + fromRect.width / 2,
      y0: fromRect.top - containerRect.top + fromRect.height / 2,
      // Inserted at the START of the currently-active box, not a computed
      // fill-fraction edge — a fixed, predictable landing spot regardless
      // of how far the box has already filled, so the star's own arrival
      // can never drift out of sync with the box's own (separately
      // CSS-animated) fill-width transition.
      x1: toRect.left - containerRect.left,
      y1: toRect.top - containerRect.top + toRect.height / 2,
    }]);
  };
  useEffect(() => {
    if (!doRankFill || stage !== 'rankup' || launchedCount >= starsThisRound) return;
    if (launchedCount === 0) {
      if (!lineReady) return; // let the whole line be seen first
    } else {
      if (starsLandedTotal < launchedCount) return; // previous star still in flight
      // Only ever WAITS for a box-reveal delay in progress (activeRank has
      // moved ahead of displayedRank, mid-transition) — deliberately not a
      // strict equality check. activeRank can only grow as more stars
      // land, so if it ever started BELOW displayedRank (props/live-formula
      // disagreeing about beforeRank, e.g. after a realm deletion regressed
      // progress in a way this celebration's data didn't fully reconcile),
      // an equality check would block every further launch forever with no
      // way to recover — this still proceeds in that case instead of
      // deadlocking.
      if (activeRank > displayedRank) return;
    }
    launchLineStar(launchedCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doRankFill, stage, launchedCount, lineReady, starsLandedTotal, activeRank, displayedRank]);

  // The header's rank name scrolls IN STEP with the bar filling, one rank
  // at a time, right as each box completes — not one long scroll held back
  // until every box is done (see the per-step Reel in the JSX below, keyed
  // on displayedRank so it remounts and re-scrolls from the previous name
  // to the new one exactly when displayedRank bumps). prevDisplayedRank is
  // computed DURING render (React's own "adjusting state from a prop/state
  // change" pattern), not via a useRef mutated inside a useEffect — an
  // effect only commits AFTER paint, one render behind, which left a
  // window where a render could still see the OLD ref value while
  // displayedRank had already moved on (or vice versa depending on what
  // else re-rendered in between), occasionally showing the same name on
  // both ends of a scroll ("Steward to Steward") instead of the real
  // previous name. Setting state mid-render like this is explicitly
  // supported by React for exactly this "track the previous value of
  // something" case — it bails out and re-renders immediately with the
  // corrected value before anything paints, so there's no stale-render
  // window at all.
  const [reelRankTrack, setReelRankTrack] = useState({ prev: beforeRank, current: beforeRank });
  if (reelRankTrack.current !== displayedRank) {
    setReelRankTrack({ prev: reelRankTrack.current, current: displayedRank });
  }
  // False until the FIRST box actually completes and reelRankTrack records
  // a real prev->current change — on initial mount both sides of the pair
  // are still just beforeRank, which (before this flag existed) fed the
  // Reel a same-name-to-same-name pair and made it visibly "scroll" from
  // the current rank to the current rank the instant the page opened, for
  // nothing. The JSX below only renders the animated Reel once this is
  // true, showing a plain static rank name until then.
  const rankTransitionPending = reelRankTrack.prev !== reelRankTrack.current;
  // Whether the rank-up reel/bar have BOTH actually finished animating —
  // same two-part gate as MilestoneRow's reelDone/barDone. No reel exists
  // at all when !rankedUp (see the JSX below — a static rank name instead),
  // so rankReelDone just starts (and stays) true in that case.
  const [rankReelDone, setRankReelDone] = useState(!rankedUp);
  const rankSettled = rankReelDone && rankFillAllDone;

  // How many of newArtGrants have finished revealing — every grant (one per
  // rank crossed, if a multi-rank jump landed on more than one) shows and
  // starts spinning together, not one at a time, so this is just a
  // completion count, not a cascade position.
  const [revealedCount, setRevealedCount] = useState(0);
  // Whether the player has actually kicked off the reveal yet — every
  // grant sits static (silhouette, nothing flipping) until they click
  // "Reveal!", then ALL of them start spinning at once (same shared
  // FLIP_DELAYS_MS schedule, so they land together too) — one click for the
  // whole batch, not one per grant.
  const [artStarted, setArtStarted] = useState(false);
  const allGrantsRevealed = revealedCount >= newArtGrants.length;

  // "Nice!" on the milestones stage always continues into the rank-progress
  // page now — players see how close they are to the next rank even on a
  // round that didn't cross one, not just on an actual level-up (see the
  // rank-progress section's header below, which reads "Ranked Up!" vs
  // "Rank Progress" accordingly). Falling through to the real close
  // (advancing the outer celebration queue and acknowledging this
  // progress, plus clearing artGrants) once nothing's left. Only two
  // stages, so this is a single hop.
  const advance = stage === 'milestones' ? () => setStage('rankup') : onClose;

  // Whether each stage still has something actively animating/unrevealed —
  // the button stays visible either way, just disabled while true (and a
  // click-outside is blocked the same way, via guardedAdvance below).
  const milestonesStagePending = stage === 'milestones' && hasMilestoneContent && !milestonesSettled;
  const rankPending = stage === 'rankup' && !rankSettled;
  // Waiting on the player to click "Reveal!" counts as pending too (nothing
  // for "Nice!" to do yet), but renders its OWN button instead — see the
  // JSX below. Art grants only ever show alongside a genuine rank crossing
  // (see the JSX's rankedUp && hasArtGrants gate), so these stay gated the
  // same way.
  const artAwaitingStart = stage === 'rankup' && rankedUp && hasArtGrants && !artStarted;
  const artRevealing = stage === 'rankup' && rankedUp && hasArtGrants && artStarted && !allGrantsRevealed;
  const rankupStagePending = rankPending || artAwaitingStart || artRevealing;
  const stagePending = milestonesStagePending || rankupStagePending;
  const guardedAdvance = stagePending ? undefined : advance;

  return (
    <div className="realm-modal-overlay rankup-modal-overlay" onClick={guardedAdvance}>
      <div className="realm-modal tile-card rankup-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <EmberField />
        <div className="rankup-burst" key={stage} aria-hidden="true" />

        {/* Everything real content-wise lives in one positioned wrapper —
            without it, these static (non-positioned) elements would paint
            *underneath* the absolutely-positioned, z-indexed ember/burst
            layers per normal CSS stacking order, even though they appear
            later in the DOM. */}
        <div style={{ position: 'relative', zIndex: 1 }} ref={modalBodyRef}>
          {/* Every star currently mid-flight — either a milestones-stage
              star heading into "Nice!" (kind 'collect') or a rank-up-page
              star heading into the rank bar (kind 'rankFill') — positioned
              relative to modalBodyRef (see launchStar/the rank-star
              effect), so this can render regardless of which stage is
              active without any extra bookkeeping. */}
          {flyingStars.map(s => (
            <FlyingStar
              key={s.id}
              x0={s.x0} y0={s.y0} x1={s.x1} y1={s.y1}
              holdMs={s.holdMs}
              onArrived={() => handleStarArrived(s.id, s.kind)}
            />
          ))}
          {stage === 'milestones' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.8rem',
                marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(107, 79, 16, 0.25)',
                flexWrap: 'wrap',
              }}>
                <h3 style={{ color: 'var(--earth-brown)', fontSize: '1.3rem', margin: 0 }}>
                  Milestones Achieved!
                </h3>
                <span style={{ color: 'var(--charcoal)', fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: '1rem', textAlign: 'right' }}>
                  {name}
                </span>
              </div>
              {categoryDiffs.length > 0 && (
                // Extra bottom margin — the red "X to Name" countdown on
                // each row's bar can wrap to a second line on a narrow
                // card, and without this breathing room that wrapped line
                // butts right up against the "Nice!" button below.
                <div style={{ marginBottom: '0.6rem' }}>
                  <MilestoneCategoryList categoryDiffs={categoryDiffs} onAllSettled={() => setMilestonesSettled(true)} onStarEarned={launchStar} />
                </div>
              )}
            </>
          )}
          {stage === 'rankup' && (
            <>
              {/* Always shown once this stage has any milestone content
                  behind it (see the always-'rankup' advance above) — not
                  just on a genuine rank crossing, so players see how close
                  they are to the next rank either way. "Ranked Up!" + the
                  scrolling reel are reserved for a real crossing; otherwise
                  a plain "Rank Progress" heading with the current rank's
                  static name. */}
              <div className="rankup-category-row" style={{ marginBottom: (rankedUp && hasArtGrants) ? '1.4rem' : 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.8rem',
                  marginBottom: '0.6rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(107, 79, 16, 0.25)',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ color: 'var(--earth-brown)', fontSize: '1.3rem', margin: 0 }}>
                      {rankedUp ? 'Ranked Up!' : 'Rank Progress'}
                    </h3>
                    {/* The rank-fill line — starsThisRound stars, all
                        already lined up here from the start (see
                        lineReady's pause above), then launched one at a
                        time into the bar below (see launchLineStar/the
                        launch effect above). Landed pip stars from the
                        milestones stage and these share the same
                        .rankup-star-glyph look, so a star reads as the same
                        object throughout pip -> flight -> line -> flight ->
                        bar. */}
                    {doRankFill && (
                      <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
                        {Array.from({ length: starsThisRound }, (_, i) => (
                          <LineStar
                            key={i}
                            elRef={el => { lineStarRefs.current[i] = el; }}
                            spent={i < launchedCount}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--charcoal)', fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: '1rem', textAlign: 'right' }}>
                    {name}
                  </span>
                </div>
                {/* Rank identification — its own centered line, "Rank # ·
                    Name" (same "Rank N · Title" phrasing ArtGrantRow already
                    uses below), separate from the name/title row above it. */}
                {/* Fixed height matching the Reel's own rowHeight (46) —
                    the plain static span (no Reel wrapper, no fixed height
                    of its own) would otherwise sit shorter than the Reel
                    it's replaced by, so the moment a transition kicks in
                    and the Reel mounts, this row visibly grew taller and
                    pushed "New Art Unlocked!" down. Same height either way
                    keeps that gap constant regardless of which one's
                    showing. */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem', height: 46 }}>
                  {rankedUp && rankTransitionPending ? (
                    // Keyed on displayedRank — remounts (and re-scrolls)
                    // fresh every time a box completes and displayedRank
                    // bumps, from whatever name was showing before
                    // (reelRankTrack.prev) to the new one, so the reel
                    // scrolls ALONGSIDE the bar filling one box at a time
                    // rather than holding one long scroll until everything
                    // is done. onSettled only actually matters on the TRUE
                    // final step (displayedRank has reached afterRank AND
                    // every star has landed) — earlier steps' own settles
                    // are just each mini-scroll finishing, not the whole
                    // sequence. Only reached once rankTransitionPending is
                    // true (see its own comment above) — the very first
                    // box hasn't completed yet on initial mount, so this
                    // never fires a same-to-same "scroll" on page load.
                    <Reel
                      key={displayedRank}
                      className="rankup-reel-rank"
                      rowHeight={46}
                      holdMs={TIER_HOLD_MS}
                      rowStyle={{ justifyContent: 'center' }}
                      items={[reelRankTrack.prev, displayedRank].map(r => <span className="rankup-rank-text">Rank {r} · {rankTitle(r)}</span>)}
                      active
                      reverse
                      onSettled={() => { if (displayedRank === afterRank && rankFillAllDone) setRankReelDone(true); }}
                    />
                  ) : (
                    <span className="rankup-rank-text">Rank {displayedRank} · {rankTitle(displayedRank)}</span>
                  )}
                </div>
                {/* One bar, driven either by the star-fill sequence above
                    (currentRank bumps to the next box only once every star
                    for the current one has landed AND displayedRank has
                    caught up, walking box-by-box for a multi-rank jump the
                    same way a single-rank one does) or, when there's
                    nothing to animate (already maxed, or no milestone this
                    round), its own plain resting state. */}
                <div ref={rankBarWrapperRef}>
                  <RankQuarterBar
                    tierCount={tierCount}
                    currentRank={doRankFill ? displayedRank : afterRank}
                    fillOverride={doRankFill && !rankFillAllDone ? rankFillFraction : undefined}
                    showRemaining={!doRankFill || rankFillAllDone}
                  />
                </div>
              </div>
              {/* Shown from the very start, right alongside the rank
                  section (not waiting on it to settle) — every grant (one
                  per rank crossed, if a multi-rank jump landed on more than
                  one) sits static as a silhouette until "Reveal!" is
                  clicked, then they ALL spin and land together. Only ever
                  alongside a genuine rank crossing — see artAwaitingStart/
                  artRevealing above, which stay gated the same way. */}
              {rankedUp && hasArtGrants && (
                <>
                  {/* Extra top margin — the rank bar's own red "X ★ to
                      Name" countdown right above can wrap to a second line
                      on a narrow card, and without this breathing room a
                      wrapped line butts right up against this heading. */}
                  <h3 style={{ color: 'var(--earth-brown)', marginTop: '0.8rem', marginBottom: '0.8rem' }}>New Art Unlocked!</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {newArtGrants.map((grant, idx) => (
                      <ArtGrantRow
                        key={idx}
                        grant={grant}
                        active={artStarted}
                        onRowRevealed={() => setRevealedCount(c => c + 1)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* "Reveal!" replaces "Nice!" only for the moment the art section
              is showing but hasn't been started yet — every other pending
              state (milestones/rank still animating, art still spinning)
              just disables "Nice!" instead, it's never hidden. */}
          {artAwaitingStart ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.8rem' }}>
              <button type="button" className="btn btn-sm" onClick={() => setArtStarted(true)}>
                Reveal!
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.8rem' }}>
              <button
                ref={niceButtonRef}
                type="button"
                className="btn btn-sm"
                disabled={stagePending}
                onClick={guardedAdvance}
              >
                Nice!
              </button>
            </div>
          )}
        </div>
        <EmberField front />
      </div>
    </div>
  );
}
