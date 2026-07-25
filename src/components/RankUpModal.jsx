import { useEffect, useState } from 'react';
import { rankTitle, tiersRequiredForRank, getMaxRank } from '../utils/metaRank';

// Fixed count/positions computed once per module load (not per render) so the
// embers don't re-randomize and restart on every re-render of the modal.
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: Math.round((i / 16) * 100 + (Math.sin(i * 7.3) * 6)),
  delay: (i * 0.14) % 2.2,
  duration: 1.8 + (i % 5) * 0.25,
}));

function EmberField() {
  return (
    <div className="rankup-embers" aria-hidden="true">
      {EMBERS.map((e, i) => (
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

// Post-game celebration — shown alongside PostGameForm when the account just
// crossed one or more milestone tiers (and possibly ranked up). Same
// .realm-modal/.tile-card visual family as HowToModal (HowToGuide.jsx), not
// the docked .tour-card variant — nothing here needs to anchor to a target
// element.
// Staggered so the celebration reads as one thing happening after another,
// not everything scrolling at once: category tier names settle first, then
// the total-milestones count a beat later, then the rank line last (biggest
// news, saved for last).
const TIER_HOLD_MS  = 380;
const COUNT_HOLD_MS = TIER_HOLD_MS + 500;
const RANK_HOLD_MS  = COUNT_HOLD_MS + 750;

export default function RankUpModal({ playerName, beforeRank, afterRank, beforeTierCount, tierCount, categoryDiffs, newChests, newSpines, onClose }) {
  const rankedUp = afterRank > beforeRank;
  const hasArt = newChests.length > 0 || newSpines.length > 0;
  const name = playerName || 'Adventurer';
  // Every rank crossed, not just the endpoints — skipping straight from 2 to
  // 4 in one game still scrolls through "Rank 2 · … · Rank 3 · … · Rank 4".
  // A milestone-only reach (no rank change) still shows the current rank —
  // just as a single-item "chain", so there's nothing to scroll to.
  const rankChain = rankedUp
    ? Array.from({ length: afterRank - beforeRank + 1 }, (_, i) => beforeRank + i)
    : [afterRank];
  // Same idea for the total-milestones count — 15 climbing to 17 scrolls
  // through 16 on the way, not just the endpoints.
  const tierCountChain = Array.from({ length: tierCount - beforeTierCount + 1 }, (_, i) => beforeTierCount + i);

  // Fine print: how many more milestone tiers until the NEXT rank past
  // wherever they landed — omitted at the top of the ladder (MAX_RANK).
  const nextRank = afterRank + 1;
  const tiersUntilNext = nextRank <= getMaxRank() ? Math.max(0, tiersRequiredForRank(nextRank) - tierCount) : null;

  return (
    <div className="realm-modal-overlay rankup-modal-overlay" onClick={onClose}>
      <div className="realm-modal tile-card rankup-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <EmberField />
        <div className="rankup-burst" aria-hidden="true" />

        {/* Everything real content-wise lives in one positioned wrapper —
            without it, these static (non-positioned) elements would paint
            *underneath* the absolutely-positioned, z-indexed ember/burst
            layers per normal CSS stacking order, even though they appear
            later in the DOM. */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>
            {rankedUp ? 'Rank Up!' : 'Milestone Reached!'}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
            <span className="rankup-player-name">{name}</span>
            <Reel
              className="rankup-reel-rank"
              rowHeight={46}
              holdMs={RANK_HOLD_MS}
              rowStyle={{ justifyContent: 'center' }}
              items={rankChain.map(r => <span className="rankup-rank-text">Rank {r} · {rankTitle(r)}</span>)}
            />
          </div>

          {tiersUntilNext !== null && (
            <p style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--earth-brown)', textAlign: 'right', margin: '0.4rem 0 0' }}>
              {tiersUntilNext} milestone{tiersUntilNext === 1 ? '' : 's'} until next rank.
            </p>
          )}

          {categoryDiffs.length > 0 && (
            <div style={{ marginTop: '1.1rem', marginBottom: hasArt ? '0.9rem' : 0 }}>
              <div className="milestones-subtitle" style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span>Milestones Achieved</span>
                <Reel
                  className="rankup-milestone-count"
                  rowHeight={32}
                  holdMs={COUNT_HOLD_MS}
                  rowStyle={{ justifyContent: 'center' }}
                  items={tierCountChain.map(n => <span>{n}</span>)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {categoryDiffs.map(({ category, beforeTierName, afterTierName }) => (
                  <div key={category.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                    <span style={{ fontFamily: "'Crimson Text', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--charcoal)' }}>{category.label}</span>
                    <Reel
                      className="rankup-reel-tier"
                      rowHeight={36}
                      holdMs={TIER_HOLD_MS}
                      rowStyle={{ justifyContent: 'center' }}
                      items={[
                        <span>{beforeTierName ?? 'Not yet started'}</span>,
                        <span>{afterTierName}</span>,
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasArt && (
            <div>
              <span className="milestones-subtitle">New art unlocked</span>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                {newChests.map((c, i) => (
                  <div key={`chest-${i}`} className="rankup-art-frame">
                    <img src={c.img} alt="New chest unlocked" style={{ height: 64, width: 'auto', display: 'block' }} draggable={false} />
                  </div>
                ))}
                {newSpines.map((s, i) => (
                  <div key={`spine-${i}`} className="rankup-art-frame">
                    <img src={s.img} alt="New logbook unlocked" style={{ height: 64, width: 'auto', display: 'block' }} draggable={false} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>Nice!</button>
          </div>
        </div>
      </div>
    </div>
  );
}
