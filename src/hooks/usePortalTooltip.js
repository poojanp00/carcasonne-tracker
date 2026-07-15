import { useLayoutEffect, useRef, useState } from 'react';

const MARGIN = 10;
const GAP = 6;

/**
 * Computes viewport-fixed coordinates for a tooltip anchored under a trigger element, for
 * rendering through a portal (`createPortal(..., document.body)`). Needed wherever the
 * trigger sits inside an ancestor that creates its own stacking context — e.g. a
 * `transform`ed flip card — where a normally absolute-positioned tooltip would be trapped
 * underneath sibling elements (like the next card in a grid) no matter its z-index.
 *
 * Two-pass: first place the tooltip under (or above) the trigger's midpoint, then measure
 * the tooltip's own rendered size and nudge it back on-screen if it overflows an edge.
 *
 * `placement`: 'below' (default) anchors under the trigger; 'above' anchors above it —
 * using the viewport's bottom edge so no second pass is needed to know the tooltip's height.
 */
export function usePortalTooltip(open, triggerRef, placement = 'below') {
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    const vertical = placement === 'above'
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP };
    setPos({ ...vertical, left: rect.left + rect.width / 2, shift: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement]);

  useLayoutEffect(() => {
    if (!open || !pos || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    let shift = 0;
    if (rect.left < MARGIN) shift = MARGIN - rect.left;
    else if (rect.right > window.innerWidth - MARGIN) shift = (window.innerWidth - MARGIN) - rect.right;
    if (shift !== pos.shift) setPos(p => ({ ...p, shift }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos?.top, pos?.bottom, pos?.left]);

  const portalStyle = pos ? {
    position: 'fixed',
    top: pos.top,
    bottom: pos.bottom,
    left: pos.left,
    transform: `translateX(-50%) translateX(${pos.shift}px)`,
    zIndex: 3000,
  } : null;

  return { tooltipRef, portalStyle };
}
