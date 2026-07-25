import { ACCOUNT_MILESTONES } from '../data/accountMilestones';
import { rankTitle } from '../utils/metaRank';

// A realm co-member's CURRENT rank + milestone standing — read-only, no
// animation (unlike RankUpModal, this isn't "something just happened", just
// a snapshot of where they stand right now). Opened from PlayerCard's rank
// badge for any player linked to an account; current state only, not a
// history of past rank-up/milestone events (no such log exists server-side).
export default function MemberProgressModal({ name, rank, categoryProgress, onClose }) {
  const rows = ACCOUNT_MILESTONES
    .map(category => {
      const stored = categoryProgress?.[category.id];
      const tierNumber = stored?.tierNumber ?? 0;
      const progress = stored?.progress ?? 0;
      if (!category.alwaysVisible && progress <= 0) return null;
      const tier = category.tiers.find(t => t.tierNumber === tierNumber) ?? null;
      return { category, tierName: tier ? tier.name : 'Not yet started' };
    })
    .filter(Boolean);

  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.3rem' }}>{name}</h3>
        <p style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--earth-brown)', marginBottom: '1rem' }}>
          Rank {rank} · {rankTitle(rank)}
        </p>
        <div className="milestones-subtitle" style={{ marginBottom: '0.5rem' }}>Milestones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.map(({ category, tierName }) => (
            <div key={category.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Crimson Text', serif", fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--stone-gray)' }}>{category.label}</span>
              <span>{tierName}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
