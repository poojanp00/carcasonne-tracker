import { categoryTierState } from '../data/accountMilestones';

// A thin engraved line at an already-unlocked tier's threshold, with its
// name always shown beneath, centered on the line — no hover required, no
// icon/badge on the bar itself.
function MilestoneNotch({ tier, leftPct }) {
  return (
    <>
      <div className="milestone-notch-line" style={{ left: `${leftPct}%` }} />
      <span className="milestone-notch-label" style={{ left: `${leftPct}%` }}>
        {tier.name}
      </span>
    </>
  );
}

// One carousel slide: progress toward a single milestone category's tiers.
// Reads tierNumber/tiers.length from config — works for any tier count.
export default function CategoryMilestoneCard({ category, account }) {
  const { progress, currentTier, currentTierNumber, nextTier, reached, maxed, pct, remaining } =
    categoryTierState(category, account);
  const METRIC_UNITS = { games: 'games', wins: 'wins', expansions: 'owned' };
  const unit = METRIC_UNITS[category.metric] ?? 'pts';

  // The bar's 0–100% axis always ends at a threshold: the next tier's while
  // climbing, or the final tier's once maxed — so earned tiers below that
  // line place their notch proportionally along the same scale as the fill.
  const axisMax = maxed ? category.tiers[category.tiers.length - 1].threshold : nextTier.threshold;

  return (
    <div className="player-card p2 milestone-card">
      <div className="milestone-card-header">
        <span className="milestone-card-name">{category.label}</span>
      </div>
      <div className="milestone-card-tier">
        {maxed
          ? `Tier ${currentTierNumber} — ${currentTier.name} (MAXED)`
          : currentTier
            ? `Tier ${currentTierNumber} — ${currentTier.name}`
            : `Tier ${currentTierNumber} — Not yet started`}
      </div>
      <div className="milestone-card-progress-label">
        {maxed
          ? `${progress.toLocaleString()} ${unit}`
          : `${progress.toLocaleString()} / ${nextTier.threshold.toLocaleString()} ${unit}`}
      </div>
      <div className="milestone-progress-wrap">
        <div className="milestone-progress-track">
          <div className="milestone-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {reached.map(tier => (
          <MilestoneNotch
            key={tier.tierNumber}
            tier={tier}
            leftPct={Math.min(100, (tier.threshold / axisMax) * 100)}
          />
        ))}
      </div>
      {!maxed && (
        <div className="milestone-card-remaining">
          {remaining.toLocaleString()} {unit} to {nextTier.name}
        </div>
      )}
    </div>
  );
}
