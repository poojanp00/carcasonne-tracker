// SCRATCH — temporary visual harness for RankUpModal, not part of the app.
// Delete this file (and its wiring in main.jsx) once the star/pip/bar-fill
// rework is visually verified; RankUpModal has no other dev trigger.
import { useState } from 'react';
import RankUpModal from './components/RankUpModal';
import { buildRankUpDiff, getCurrentRank } from './utils/metaRank';
import { ACCOUNT_MILESTONES } from './data/accountMilestones';

function progressFor(id, tierNumber) {
  const cat = ACCOUNT_MILESTONES.find(c => c.id === id);
  const tier = cat.tiers.find(t => t.tierNumber === tierNumber);
  return tier ? tier.threshold : 0;
}

function cp(entries) {
  const out = {};
  for (const [id, tierNumber] of entries) {
    out[id] = { progress: progressFor(id, tierNumber), tierNumber };
  }
  return out;
}

function scenario(beforeTierCount, tierCount, before, after) {
  return {
    beforeRank: getCurrentRank(beforeTierCount),
    afterRank: getCurrentRank(tierCount),
    beforeTierCount, tierCount, before: cp(before), after: cp(after),
  };
}

const SCENARIOS = {
  // No rank crossing — just progress within the current rank (1 star).
  progress: scenario(0, 1, [], [['games', 1]]),
  // Genuine rank crossing, multiple tiers earned this round.
  rankup: scenario(0, 3, [], [['games', 1], ['wins', 1], ['city', 1]]),
  // Multi-rank jump — lots of tiers at once.
  multirank: scenario(0, 8, [], [['games', 2], ['wins', 2], ['city', 2], ['road', 2]]),
  // Multi-rank jump PLUS art grants (one per rank crossed) — repro for
  // clicking "Reveal!" before the rank-fill stars finish landing.
  multirankArt: {
    ...scenario(0, 8, [], [['games', 2], ['wins', 2], ['city', 2], ['road', 2]]),
    newArtGrants: [
      { chest: { itemId: 2, candidates: [2, 3, 4] }, logbook: { itemId: 2, candidates: [2, 3, 4] } },
      { chest: { itemId: 5, candidates: [5, 6, 7] }, logbook: { itemId: 5, candidates: [5, 6, 7] } },
    ],
  },
  // DEBUG — repro of a real stuck test-account's exact user_progress row
  // (rank 2->3, tier_count 2->4). afterCategoryProgress is deliberately
  // missing the 'expansions' key entirely (as pulled from the live DB) to
  // reproduce whatever config-drift condition is happening in production.
  stuckRepro: {
    beforeRank: 2,
    afterRank: 3,
    beforeTierCount: 2,
    tierCount: 4,
    before: {
      inn: { progress: 0, tierNumber: 0 },
      pig: { progress: 0, tierNumber: 0 },
      barn: { progress: 0, tierNumber: 0 },
      city: { progress: 102, tierNumber: 1 },
      road: { progress: 78, tierNumber: 1 },
      wins: { progress: 3, tierNumber: 0 },
      abbot: { progress: 39, tierNumber: 0 },
      field: { progress: 39, tierNumber: 0 },
      games: { progress: 3, tierNumber: 0 },
      goods: { progress: 0, tierNumber: 0 },
      cathedral: { progress: 0, tierNumber: 0 },
      monastery: { progress: 69, tierNumber: 0 },
      expansions: { progress: 0, tierNumber: 0 },
    },
    after: {
      inn: { progress: 0, tierNumber: 0 },
      pig: { progress: 0, tierNumber: 0 },
      barn: { progress: 0, tierNumber: 0 },
      city: { progress: 256, tierNumber: 1 },
      road: { progress: 209, tierNumber: 1 },
      wins: { progress: 5, tierNumber: 1 },
      abbot: { progress: 47, tierNumber: 0 },
      field: { progress: 159, tierNumber: 1 },
      games: { progress: 5, tierNumber: 0 },
      goods: { progress: 0, tierNumber: 0 },
      cathedral: { progress: 0, tierNumber: 0 },
      monastery: { progress: 78, tierNumber: 0 },
    },
  },
};

export default function RankUpPreview() {
  const [scenario, setScenario] = useState(null);
  if (!scenario) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        {Object.keys(SCENARIOS).map(key => (
          <button key={key} style={{ display: 'block', margin: '8px 0', fontSize: 18 }} onClick={() => setScenario(key)}>
            {key}
          </button>
        ))}
      </div>
    );
  }
  const s = SCENARIOS[scenario];
  const { categoryDiffs } = buildRankUpDiff({ beforeCategoryProgress: s.before, afterCategoryProgress: s.after });
  return (
    <RankUpModal
      playerName="Tester"
      beforeRank={s.beforeRank}
      afterRank={s.afterRank}
      beforeTierCount={s.beforeTierCount}
      tierCount={s.tierCount}
      categoryDiffs={categoryDiffs}
      newArtGrants={s.newArtGrants ?? []}
      onClose={() => setScenario(null)}
    />
  );
}
