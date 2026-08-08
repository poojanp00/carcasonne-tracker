import { useEffect } from 'react';
import { ACCOUNT_MILESTONES, tierStateForProgress } from '../data/accountMilestones';
import MilestonesCardBody from './MilestonesCardBody';

// A realm co-member's rank + milestone standing — same "back of the
// Profile hero card" layout as Profile.jsx's own ProfileHero back face
// (both render via the shared MilestonesCardBody, so the two can never
// visually drift apart). Opened from the Final Scores screen for any
// player linked to an account. When before-state is supplied
// (beforeRank/beforeTierCount/beforeCategoryProgress — the account's
// standing right before whatever just happened: a finished game, or a
// newly accepted realm invite that suddenly brought more games under this
// account), every bar fills from that starting point up to the current one
// instead of snapping straight there. Re-mounted fresh every time a card is
// clicked (see PostGameForm's `key`), so the fill replays each time rather
// than reusing an already-settled instance.
export default function MemberProgressModal({
  name, rank, tierCount = 0, categoryProgress,
  beforeRank, beforeTierCount, beforeCategoryProgress,
  onClose,
}) {
  // Locks the page underneath from scrolling while this is open — always
  // mounted "open" (the caller conditionally renders it, not an internal
  // toggle), so this runs for the component's whole lifetime.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const animate = beforeRank != null && beforeTierCount != null && beforeCategoryProgress != null;

  const rows = ACCOUNT_MILESTONES
    .map(category => {
      const afterProgress = categoryProgress?.[category.id]?.progress ?? 0;
      if (afterProgress <= 0) return null;
      const afterBar = tierStateForProgress(category, afterProgress);
      const beforeBar = animate
        ? tierStateForProgress(category, beforeCategoryProgress?.[category.id]?.progress ?? 0)
        : afterBar;
      return { category, beforeBar, afterBar };
    })
    .filter(Boolean);

  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div
        className="realm-modal tile-card rankup-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <MilestonesCardBody
          displayName={name}
          rank={rank}
          tierCount={tierCount}
          beforeRank={beforeRank}
          beforeTierCount={beforeTierCount}
          rows={rows}
          animate={animate}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
