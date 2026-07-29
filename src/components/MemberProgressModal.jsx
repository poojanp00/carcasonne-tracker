import { useEffect } from 'react';
import { ACCOUNT_MILESTONES, METRIC_UNITS, tierStateForProgress } from '../data/accountMilestones';
import { rankTitle } from '../utils/metaRank';
import QuarterTierBar from './QuarterTierBar';

// A realm co-member's CURRENT rank + milestone standing — read-only, no
// reel/before-after animation (unlike RankUpModal, this isn't "something
// just happened", just a snapshot of where they stand right now). Same
// "All Milestones" row visual as the Profile carousel's own card (label +
// progress + tier pips, then the quarter-chunked bar with tier names
// underneath) — only categories actually started (progress > 0) get a row,
// same as that card. Opened from the Final Scores screen and the Logbook,
// for any player linked to an account; current state only, not a history of
// past rank-up/milestone events (no such log exists server-side).
export default function MemberProgressModal({ name, rank, categoryProgress, onClose }) {
  // Locks the page underneath from scrolling while this is open — always
  // mounted "open" (the caller conditionally renders it, not an internal
  // toggle), so this runs for the component's whole lifetime.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const rows = ACCOUNT_MILESTONES
    .map(category => {
      const progress = categoryProgress?.[category.id]?.progress ?? 0;
      if (progress <= 0) return null;
      return { category, bar: tierStateForProgress(category, progress) };
    })
    .filter(Boolean);

  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div
        className="realm-modal tile-card rankup-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--earth-brown)', margin: 0 }}>{name}</h3>
          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.05rem', color: 'var(--earth-brown)' }}>{rankTitle(rank)}</span>
        </div>
        <div className="milestones-subtitle" style={{ marginBottom: '0.6rem' }}>Milestones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {rows.map(({ category, bar }) => {
            const unit = METRIC_UNITS[category.metric] ?? 'pts';
            const pips = '★'.repeat(bar.reached.length) + '☆'.repeat(Math.max(0, category.tiers.length - bar.reached.length));
            return (
              <div key={category.id}>
                <div style={{ marginBottom: '0.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <span className="rankup-category-label">
                    {category.label}
                    <span className="rankup-category-progress">
                      ({bar.progress.toLocaleString()} {unit})
                    </span>
                  </span>
                  <span className="rankup-tier-stars" aria-label={`${bar.reached.length} of ${category.tiers.length} tiers unlocked`}>
                    {pips}
                  </span>
                </div>
                <QuarterTierBar tiers={category.tiers} progress={bar.progress} unit={unit} currentTier={bar.currentTier} nextTier={bar.nextTier} remaining={bar.remaining} maxed={bar.maxed} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
