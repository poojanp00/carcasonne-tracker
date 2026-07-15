import { createPortal } from 'react-dom';
import { usePortalTooltip } from '../hooks/usePortalTooltip';
import { useTapTooltip } from '../hooks/useTapTooltip';

/**
 * Displays a clickable value with additional context in a tooltip.
 * Used for showing details like game dates, margin breakdowns, etc.
 *
 * The card back (`.player-card-back`) is permanently `transform: rotateY(...)`'d for the
 * flip effect, which makes it a stacking context — a locally-positioned tooltip there can
 * never paint above a sibling player card. Rendered through a portal with viewport-fixed
 * coordinates instead, so it always sits on top regardless of which card it's opened from.
 */
export default function ValInfo({ tip, children, style, placement = 'below' }) {
  const { visible, open, onMouseEnter, onMouseLeave, triggerRef } = useTapTooltip();
  const { tooltipRef, portalStyle } = usePortalTooltip(visible, triggerRef, placement);

  if (!tip) return <span className="val-info-wrap" style={style}>{children}</span>;

  return (
    <span
      ref={triggerRef}
      className="val-info-wrap"
      style={style}
      // Stop the tap from bubbling up to the flip-card's click handler — otherwise tapping
      // the value (no hover-out on touch) flips the card instead of showing the tooltip.
      onClick={e => { e.stopPropagation(); open(); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {visible && portalStyle && createPortal(
        <div ref={tooltipRef} className="val-info-tooltip" style={portalStyle}>{tip}</div>,
        document.body
      )}
    </span>
  );
}
