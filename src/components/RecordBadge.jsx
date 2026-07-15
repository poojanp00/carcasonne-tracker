import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';
import { formatAchievementName } from '../utils/achievements';
import { usePortalTooltip } from '../hooks/usePortalTooltip';

/**
 * Inline medal chip for a headline game record, with a hover/tap tooltip.
 * The tooltip renders through a portal with fixed positioning so it isn't
 * clipped by the horizontally-scrolling badge strip it sits in.
 */
export default function RecordBadge({ badgeKey, amount, size = 40 }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const { tooltipRef, portalStyle } = usePortalTooltip(open, triggerRef, 'above');
  const label = ACHIEVEMENT_LABEL_OVERRIDE[badgeKey] || formatAchievementName(badgeKey);

  return (
    <>
      <img
        ref={triggerRef}
        src={ACHIEVEMENT_BADGE[badgeKey]}
        alt={label}
        style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        onTouchEnd={() => setOpen(false)}
        onTouchCancel={() => setOpen(false)}
      />
      {open && portalStyle && createPortal(
        // Same look as .val-info-tooltip. z-index bumped above .lightbox-overlay (10000) —
        // this badge is used inside the game-details lightbox.
        <div ref={tooltipRef} style={{
          ...portalStyle,
          zIndex: 10001,
          background: 'var(--earth-brown)',
          color: 'var(--parchment)',
          padding: '0.3rem 0.55rem',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          fontFamily: 'Crimson Text, serif',
          fontStyle: 'italic',
          fontSize: '0.78rem',
        }}>
          {label} · {amount}
        </div>,
        document.body
      )}
    </>
  );
}
