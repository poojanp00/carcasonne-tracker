import { useState } from 'react';
import { METRIC_UNITS } from '../data/accountMilestones';
import { rankTitle } from '../utils/metaRank';
import QuarterTierBar from './QuarterTierBar';
import RankQuarterBar from './RankQuarterBar';
import { RankUpCategoryBar, RankUpRankBar } from './RankUpModal';

// One category row — label/progress-count left, tier-pip stars right, the
// quarter-chunked bar underneath. Animated (before -> after, one tier
// quarter at a time, same as the rank-up celebration) when `animate` is
// true; otherwise a plain static snapshot of `afterBar`.
function MilestoneCategoryRow({ category, beforeBar, afterBar, animate }) {
  const unit = METRIC_UNITS[category.metric] ?? 'pts';
  const [progress, setProgress] = useState(animate ? beforeBar.progress : afterBar.progress);
  const [tiersReached, setTiersReached] = useState(animate ? beforeBar.reached.length : afterBar.reached.length);
  const pips = '★'.repeat(tiersReached) + '☆'.repeat(Math.max(0, category.tiers.length - tiersReached));
  return (
    <div>
      <div style={{ marginBottom: '0.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
        <span className="rankup-category-label">
          {category.label}
          <span className="rankup-category-progress">
            ({progress.toLocaleString()} {unit})
          </span>
        </span>
        <span className="rankup-tier-stars" aria-label={`${tiersReached} of ${category.tiers.length} tiers unlocked`}>
          {pips}
        </span>
      </div>
      {animate ? (
        <RankUpCategoryBar
          diff={{ category, beforeBar, afterBar }}
          onProgressChange={setProgress}
          onTiersReachedChange={setTiersReached}
        />
      ) : (
        <QuarterTierBar tiers={category.tiers} progress={afterBar.progress} unit={unit} currentTier={afterBar.currentTier} nextTier={afterBar.nextTier} remaining={afterBar.remaining} maxed={afterBar.maxed} />
      )}
    </div>
  );
}

// Shared "milestones card" body — the back-face layout used by both
// Profile.jsx's ProfileHero (the Me page's own hero card) and
// MemberProgressModal (a realm co-member's on-demand standing): name left /
// rank title right (both .milestone-card-header/.milestone-card-name, the
// same near-black charcoal), a rank-ladder quarter bar underneath, then
// "Milestones" with the tier count right-aligned, then one row per category
// in `rows` — label+count left, tier-pip stars right, its own quarter bar
// beneath. Pulled out into its own file (rather than duplicated in both
// places) specifically so the two can never visually drift apart — one
// definition, two callers each just supplying their own `rows` (built from
// whatever data shape they have on hand: a live account aggregate for
// Profile, a server categoryProgress snapshot for MemberProgressModal).
//
// `animate`, when true, fills every bar from beforeRank/beforeTierCount and
// each row's own beforeBar up to the current afterBar/tierCount/rank, one
// tier quarter at a time (reusing RankUpModal's own RankUpRankBar/
// RankUpCategoryBar rather than reimplementing that fill) instead of
// snapping straight to the current values. Callers that want this to
// replay on demand (a modal reopening, a card flipping back over) need to
// force a fresh mount themselves — e.g. a `key` tied to however many times
// it's been opened/flipped — since this component's own animation only
// ever runs once, right as it mounts.
export default function MilestonesCardBody({ displayName, rank, tierCount, beforeRank, beforeTierCount, rows, animate = false }) {
  const [milestoneCount, setMilestoneCount] = useState(animate ? beforeTierCount : tierCount);

  return (
    <>
      <div className="milestone-card-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
        <span className="milestone-card-name">{displayName}</span>
        {/* "Rank N · Title" — same phrasing as the rank-up celebration's own
            rank line (RankUpModal.jsx), not just the bare title, so a
            player's numeric rank is always visible alongside its name
            everywhere this header appears (Profile's hero card back, and
            MemberProgressModal from Standings). */}
        <span className="milestone-card-name">Rank {rank} · {rankTitle(rank)}</span>
      </div>
      {animate ? (
        <RankUpRankBar beforeRank={beforeRank} afterRank={rank} beforeTierCount={beforeTierCount} tierCount={tierCount} onProgressChange={setMilestoneCount} />
      ) : (
        <RankQuarterBar tierCount={tierCount} currentRank={rank} />
      )}
      <div className="milestone-card-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.4rem', marginTop: '0.8rem' }}>
        <span className="milestone-card-name">Milestones</span>
        <span className="milestone-card-name" style={{ color: 'var(--warm-gold)' }}>
          {milestoneCount} ★
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.3rem' }}>
        {rows.map(({ category, beforeBar, afterBar }) => (
          <MilestoneCategoryRow key={category.id} category={category} beforeBar={beforeBar} afterBar={afterBar} animate={animate} />
        ))}
      </div>
    </>
  );
}
