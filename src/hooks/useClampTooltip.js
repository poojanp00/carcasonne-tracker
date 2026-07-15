import { useLayoutEffect, useRef, useState } from 'react';

const MARGIN = 10;

/**
 * Keeps a tap-opened tooltip from spilling off the edge of the screen (common on
 * narrow phones where the trigger sits near the left/right edge). Measures the
 * tooltip's rendered position once it opens and returns a horizontal correction
 * in px to feed into a `translateX(var(--tt-shift))` on top of the tooltip's own
 * CSS positioning — leaves desktop hover (pure CSS, no JS involved) untouched.
 */
export function useClampTooltip(open) {
  const ref = useRef(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    if (!open) { setShift(0); return; }
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let delta = 0;
    if (rect.left < MARGIN) delta = MARGIN - rect.left;
    else if (rect.right > window.innerWidth - MARGIN) delta = (window.innerWidth - MARGIN) - rect.right;
    setShift(delta);
  }, [open]);

  return { tooltipRef: ref, tooltipStyle: { '--tt-shift': `${shift}px` } };
}
