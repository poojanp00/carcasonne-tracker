// Presentational stat widgets shared by the per-realm Library book pages and
// the account-wide Profile page.

import { createPortal } from 'react-dom';
import { usePortalTooltip } from '../hooks/usePortalTooltip';
import { useTapTooltip } from '../hooks/useTapTooltip';
import { MILESTONE_CATEGORIES, badgeProgress, progressForTypes } from '../data/milestones';
import ValInfo from './ValInfo';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
export const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};

export const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  inn: 'Inn', cathedral: 'Cathedral',
  princess: 'Princess', fairy: 'Fairy',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  largest_city: 'Largest City', largest_road: 'Largest Road',
  abbey: 'Abbey', barn: 'Barn', abbot: 'Abbot', wagon: 'Wagon',
};

export function WinRateBadge({ rate }) {
  const cls = rate >= 60 ? 'badge-high' : rate >= 40 ? 'badge-mid' : 'badge-low';
  return <span className={`win-rate-badge ${cls}`}>{rate}%</span>;
}

export function MilestoneBadge({ badge, unit, unlocked }) {
  const { visible, open, onMouseEnter, onMouseLeave, triggerRef } = useTapTooltip();
  const { tooltipRef, portalStyle } = usePortalTooltip(visible, triggerRef, 'above');

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={open}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`milestone-badge${unlocked ? '' : ' milestone-locked'}`}
    >
      <img src={badge.img} alt={badge.name} draggable={false} />
      <span className="milestone-badge-name">{badge.name}</span>
      {visible && portalStyle && createPortal(
        <div ref={tooltipRef} className="milestone-tooltip" style={portalStyle}>
          <div className="milestone-tooltip-req">Earn {badge.threshold.toLocaleString()} {unit}</div>
        </div>,
        document.body
      )}
    </button>
  );
}

export function MilestonesBack({ name, breakdown }) {
  return (
    <>
      <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
      <div className="milestones-subtitle">Milestones</div>
      {MILESTONE_CATEGORIES.map(cat => (
        <div key={cat.id} className="milestone-section">
          <div className="milestone-section-header">
            <span>{cat.label}</span>
            <ValInfo tip={`${cat.types.map(t => TYPE_LABELS[t] ?? t).join(' + ')} points`}>
              <span className="milestone-section-total">{progressForTypes(cat.types, breakdown).toLocaleString()}</span>
            </ValInfo>
          </div>
          <div className="milestone-grid">
            {cat.badges.map(b => {
              const unlocked = badgeProgress(cat, b, breakdown) >= b.threshold;
              const unit = b.unit ?? cat.unit;
              return (
                <MilestoneBadge
                  key={b.name}
                  badge={b}
                  unit={unit}
                  unlocked={unlocked}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
