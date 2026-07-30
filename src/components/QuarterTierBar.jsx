// Every milestone category has exactly 4 tiers, so instead of a single bar
// scaled to real point thresholds (where an early tier's tiny gap next to a
// huge later one leaves no room for its own label — see the old notch-
// crowding problem this replaced), the bar is split into 4 fixed-width
// quarters, one per tier, each independently filled by how far progress has
// gotten through THAT tier's own point range (0%, a partial fraction, or
// fully chunked off once earned). Every quarter is a fixed 25% of the width
// no matter the category, so there's always guaranteed room to print that
// tier's name underneath it. Reached tiers show their name; the tier
// currently being worked toward shows "X to Name" in red instead; anything
// further out still shows its name, just faded, so it's never a mystery
// what's coming — only how it's not there yet.
//
// Originated in Profile.jsx's "All Milestones" carousel card; reused as-is
// by MemberProgressModal (on-demand co-member progress) and RankUpModal
// (the rank-up celebration's per-category bars).
export default function QuarterTierBar({ tiers, progress, unit, currentTier, nextTier, remaining, maxed }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '3px', height: '18px' }}>
        {tiers.map((tier, i) => {
          const lower = i === 0 ? 0 : tiers[i - 1].threshold;
          const frac = Math.max(0, Math.min(1, (progress - lower) / (tier.threshold - lower)));
          return (
            <div
              key={tier.tierNumber}
              style={{ flex: '1 1 25%', height: '100%', border: '2px solid var(--earth-brown)', borderRadius: '2px', background: 'rgba(139,94,60,0.18)', boxShadow: 'inset 2px 2px 0 rgba(43,27,10,0.25)', overflow: 'hidden' }}
            >
              <div style={{
                width: `${frac * 100}%`,
                height: '100%',
                background: 'repeating-linear-gradient(90deg, var(--warm-gold) 0 8px, rgba(43,27,10,0.30) 8px 10px)',
                transition: 'width 0.4s steps(8, end)',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', marginTop: '0.1rem' }}>
        {tiers.map(tier => {
          const isReached = progress >= tier.threshold;
          const isCurrent = currentTier?.tierNumber === tier.tierNumber;
          // The tier currently being worked toward (not yet reached, but the
          // very next one) shows how much is left right under its own
          // quarter instead of sitting blank.
          const isActive = !maxed && nextTier?.tierNumber === tier.tierNumber;
          // Locked tiers (not reached, not active) still show their name —
          // just faded, so it reads as "not earned yet" rather than "unknown".
          const isLocked = !isReached && !isActive;
          return (
            <div
              key={tier.tierNumber}
              style={{
                flex: '1 1 25%', textAlign: 'center', padding: '0 0.15rem',
                fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: '0.58rem', lineHeight: 1.15,
                color: isActive ? 'var(--deep-red)' : isCurrent ? 'var(--earth-brown)' : 'var(--stone-gray)',
                fontWeight: isCurrent ? 700 : 400,
                opacity: isLocked ? 0.45 : 1,
              }}
            >
              {isReached ? tier.name : isActive ? `${remaining.toLocaleString()} ${unit} to ${tier.name}` : tier.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
