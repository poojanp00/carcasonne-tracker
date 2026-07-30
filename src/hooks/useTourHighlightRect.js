import { useEffect, useRef, useState } from 'react';

// Tracks a target element's live viewport rect while `active`, so a
// `.tour-highlight`-style spotlight can be rendered as a fixed-position
// overlay sized/positioned to match it exactly, instead of applying
// `.tour-highlight` directly to the target itself. Needed wherever the real
// target sits inside an `overflow: hidden`/`auto` ancestor — e.g. the
// horizontally-scrolling `.tab-nav` — since a descendant's box-shadow
// spotlight gets clipped at that ancestor's own edge instead of dimming the
// whole page, reading as a dark box over the whole strip rather than a
// clean cutout around just the one target. Polls via requestAnimationFrame,
// same approach as useTourCardPosition, for the same reason (tracks
// scroll-into-view animations and resizes for free).
export function useTourHighlightRect(targetRef, active) {
  const [rect, setRect] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!active || !targetRef?.current) {
      setRect(null);
      return;
    }

    const tick = () => {
      const el = targetRef.current;
      if (!el) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, targetRef]);

  return rect;
}
