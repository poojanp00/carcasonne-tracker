import { useEffect, useState } from 'react';
import { rankTitle, tiersRequiredForRank, getCurrentRank } from '../utils/metaRank';
import { METRIC_UNITS, tierStateForProgress } from '../data/accountMilestones';
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
function Reel({ items, rowHeight = 46, holdMs = 380, className = '', rowStyle }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), holdMs);
    return () => clearTimeout(t);
  }, []);
  const targetIndex = items.length - 1;
  return (
    <div className={`rankup-reel ${className}`} style={{ height: rowHeight }}>
      <div
        className="rankup-reel-track"
        style={{
          transform: `translateY(-${(revealed ? targetIndex : 0) * rowHeight}px)`,
          transitionDuration: `${0.5 + targetIndex * 0.35}s`,
        }}
      >
        {items.map((item, i) => (
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

// Same quarter-chunked bar as Profile's "All Milestones" card and
// MemberProgressModal — one look for "how close to a tier" everywhere. Each
// quarter fills from its BEFORE fraction to its AFTER one, one quarter at a
// time (see buildProgressSteps) — QuarterTierBar's own per-quarter width
// transition (steps(8, end), same as every other bar here) animates each
// swap, so a crossed tier's quarter visibly fills up rather than just
// appearing done.
function RankUpCategoryBar({ diff }) {
  const steps = buildProgressSteps(diff.beforeBar, diff.afterBar, diff.category.tiers);
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const timers = steps.slice(1).map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), TIER_HOLD_MS + i * STEP_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unit = METRIC_UNITS[diff.category.metric] ?? 'pts';
  const bar = tierStateForProgress(diff.category, steps[stepIndex]);
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
// the category bars above.
function RankUpRankBar({ beforeRank, afterRank, beforeTierCount, tierCount }) {
  const steps = buildRankSteps(beforeRank, afterRank, beforeTierCount, tierCount);
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const timers = steps.slice(1).map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), TIER_HOLD_MS + i * STEP_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stepTierCount = steps[stepIndex];
  const stepRank = getCurrentRank(stepTierCount);
  return <RankQuarterBar tierCount={stepTierCount} currentRank={stepRank} />;
}

// Newly-unlocked chest/logbook art shows as a silhouette first — click to
// reveal the actual artwork, so unlocking new art keeps a little surprise
// instead of just appearing outright. onReveal fires once, the moment this
// particular piece flips — the parent uses that to know when EVERY piece
// across every rank pair has been tapped (see revealedCount in
// RankUpModal), since the "Nice!" button stays gated until then.
function RevealableArt({ src, alt, onReveal }) {
  const [revealed, setRevealed] = useState(false);
  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    onReveal?.();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
      <div className="rankup-art-frame">
        <button
          type="button"
          onClick={reveal}
          disabled={revealed}
          aria-label={revealed ? alt : `${alt} — click to reveal`}
          style={{ background: 'none', border: 'none', padding: 0, cursor: revealed ? 'var(--cursor-arrow)' : 'var(--cursor-pointer)' }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              height: 64, width: 'auto', display: 'block',
              filter: revealed ? 'none' : 'brightness(0)',
              transition: 'filter 0.5s ease',
            }}
            draggable={false}
          />
        </button>
      </div>
      {!revealed && (
        <span style={{ fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: '0.62rem', color: 'var(--stone-gray)' }}>
          Tap to reveal
        </span>
      )}
    </div>
  );
}

// Post-game celebration — shown alongside PostGameForm whenever the account's
// milestone progress moved at all this game, not just on a tier crossing, so
// players can watch their bars fill up over time. Two stages sharing one
// overlay/card: "Milestones Achieved" always shows first (every category
// with any progress, crossed tiers animated, others shown at their current
// state); "Rank Up!" only follows if the game also crossed a rank, reached
// by clicking "Nice!" on the milestones stage. Same .realm-modal/.tile-card
// visual family as HowToModal (HowToGuide.jsx).
export default function RankUpModal({ playerName, beforeRank, afterRank, beforeTierCount, tierCount, categoryDiffs, newArtPairs, onClose }) {
  // Locks the page underneath from scrolling while the celebration is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const [stage, setStage] = useState('milestones'); // 'milestones' | 'rankup'
  const rankedUp = afterRank > beforeRank;
  const totalArtCount = newArtPairs.reduce((sum, p) => sum + p.chests.length + p.spines.length, 0);
  const hasArt = totalArtCount > 0;
  const name = playerName || 'Adventurer';
  // Every gift stays a silhouette (and "Nice!" stays gone, not just disabled)
  // until every single one has been tapped — a peek at the ladder shouldn't
  // let someone skip past gifts they haven't opened yet.
  const [revealedArtCount, setRevealedArtCount] = useState(0);
  const allArtRevealed = revealedArtCount >= totalArtCount;
  const artGateActive = stage === 'rankup' && hasArt && !allArtRevealed;
  // Every rank crossed, not just the endpoints — skipping straight from 2 to
  // 4 in one game still scrolls through "Rank 2 · … · Rank 3 · … · Rank 4".
  const rankChain = rankedUp
    ? Array.from({ length: afterRank - beforeRank + 1 }, (_, i) => beforeRank + i)
    : [afterRank];

  // "Nice!" (and clicking outside the card) advances to the rank-up stage
  // when there is one still to show; otherwise it's the real close, which
  // advances the outer celebration queue and acknowledges this progress.
  const advance = (stage === 'milestones' && rankedUp) ? () => setStage('rankup') : onClose;
  // While gifts are still sitting unrevealed, neither the button nor a
  // click-outside should advance/close — same gate, both triggers.
  const guardedAdvance = artGateActive ? undefined : advance;

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
        <div style={{ position: 'relative', zIndex: 1 }}>
          {stage === 'milestones' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--earth-brown)', margin: 0 }}>Milestones</h3>
                <span className="rankup-player-name">{name}</span>
              </div>

              {categoryDiffs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {categoryDiffs.map(diff => {
                    const pips = '★'.repeat(diff.afterBar.reached.length) + '☆'.repeat(Math.max(0, diff.category.tiers.length - diff.afterBar.reached.length));
                    return (
                      <div key={diff.category.id} className="rankup-category-row">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                          <span className="rankup-category-label">
                            {diff.category.label}
                            <span className="rankup-category-progress">
                              ({diff.afterBar.progress.toLocaleString()} {METRIC_UNITS[diff.category.metric] ?? 'pts'})
                            </span>
                            <span className="rankup-tier-stars" aria-label={`${diff.afterBar.reached.length} of ${diff.category.tiers.length} tiers unlocked`}>
                              {pips}
                            </span>
                          </span>
                          <Reel
                            className="rankup-reel-tier"
                            rowHeight={36}
                            holdMs={TIER_HOLD_MS}
                            rowStyle={{ justifyContent: 'center' }}
                            items={diff.tierNameChain.map(n => <span>{n ?? '-'}</span>)}
                          />
                        </div>
                        <RankUpCategoryBar diff={diff} />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>Rank Up!</h3>

              <div className="rankup-category-row">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
                  <span className="rankup-player-name">
                    {name}
                    <span className="rankup-category-progress">({tierCount.toLocaleString()} milestones)</span>
                  </span>
                  <Reel
                    className="rankup-reel-rank"
                    rowHeight={46}
                    holdMs={TIER_HOLD_MS}
                    rowStyle={{ justifyContent: 'center' }}
                    items={rankChain.map(r => <span className="rankup-rank-text">Rank {r} · {rankTitle(r)}</span>)}
                  />
                </div>
                <RankUpRankBar
                  beforeRank={beforeRank}
                  afterRank={afterRank}
                  beforeTierCount={beforeTierCount}
                  tierCount={tierCount}
                />
              </div>

              {hasArt && (
                <div style={{ marginTop: '0.9rem' }}>
                  <span className="milestones-subtitle">New art unlocked</span>
                  {/* Chest+logbook from the same rank sit next to each other
                      (pair order preserved, oldest rank first) — no box or
                      per-rank label since almost every celebration is a
                      single rank crossing one pair. */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                    {newArtPairs.flatMap(pair => [
                      ...pair.chests.map((c, i) => ({ key: `chest-${pair.rank}-${i}`, img: c.img, alt: 'New chest unlocked' })),
                      ...pair.spines.map((s, i) => ({ key: `spine-${pair.rank}-${i}`, img: s.img, alt: 'New logbook unlocked' })),
                    ]).map(item => (
                      <RevealableArt
                        key={item.key}
                        src={item.img}
                        alt={item.alt}
                        onReveal={() => setRevealedArtCount(n => n + 1)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Gated, not just disabled: stays gone entirely until every gift
              above has been tapped open — see artGateActive. */}
          {!artGateActive && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-sm" onClick={guardedAdvance}>Nice!</button>
            </div>
          )}
        </div>
        <EmberField front />
      </div>
    </div>
  );
}
