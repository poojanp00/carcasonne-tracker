import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';
import { formatAchievementName } from '../utils/achievements';

/**
 * Inline medal chip for a headline game record, with a hover/tap tooltip.
 * The tooltip renders through a portal with fixed positioning so it isn't
 * clipped by the horizontally-scrolling badge strip it sits in.
 */
export default function RecordBadge({ badgeKey, amount, size = 40 }) {
  const [tip, setTip] = useState(null);
  const label = ACHIEVEMENT_LABEL_OVERRIDE[badgeKey] || formatAchievementName(badgeKey);

  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top });
  };
  const hide = () => setTip(null);

  return (
    <>
      <img
        src={ACHIEVEMENT_BADGE[badgeKey]}
        alt={label}
        style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onTouchStart={show}
        onTouchEnd={hide}
        onTouchCancel={hide}
      />
      {tip && createPortal(
        // Same look as .val-info-tooltip, but portal/fixed so the scrolling badge strip can't clip it
        <div style={{
          position: 'fixed',
          left: tip.x,
          top: tip.y - 8,
          transform: 'translate(-50%, -100%)',
          background: 'var(--earth-brown)',
          color: 'var(--parchment)',
          padding: '0.3rem 0.55rem',
          borderRadius: '4px',
          zIndex: 10001,
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
