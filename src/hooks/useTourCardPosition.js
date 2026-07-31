import { useEffect, useRef, useState } from 'react';

const MARGIN = 16; // keep the card off the viewport edges
const GAP = 18;    // clearance between the card and the target's edge

// Docks a fixed-position tour card directly under whatever `targetRef`
// currently points at, arrow always pointing up at it — instead of a
// generic fixed screen position, or flipping above the target when it's
// low on screen (that read as floating free of the container it was
// supposed to belong to, as a general behavior — see `placement` below for
// the one deliberate exception). Returns `{ style, arrowLeft }`, both
// `null` when there's no target to track so the caller can fall back to
// its own default docking.
//
// The card's top is clamped to the visible viewport (vh - card height -
// MARGIN) rather than always sitting exactly at the target's bottom edge
// — at high browser zoom, or for a target taller than the viewport, an
// unclamped `target.bottom + GAP` can land well below the visible page,
// spilling the card off-screen entirely. Clamping means the card can end
// up overlapping the lower part of a very tall target instead of sitting
// flush beneath it; that's an acceptable trade — the arrow still points
// up at the target's own horizontal position, it just doesn't necessarily
// start exactly where the box ends.
//
// Polls via requestAnimationFrame while active rather than wiring up
// scroll/resize listeners — the target moves during the page's own
// smooth-scroll-into-view, and a rAF loop tracks that (and window resizes)
// for free at negligible cost while a single modal is on screen.
//
// `placement: 'above'` is an explicit per-caller opt-in, not a general
// low-on-screen flip (see above) — the Board tour's last stop targets the
// Final Scoring button, and docking below it (the default) meant the card
// could cover the very button it's describing on a short viewport. The
// caller is expected to also flip its arrow to point down in this case
// (see BoardTourModal's tour-card-arrow-down class) since the card is now
// above its target instead of below it.
export function useTourCardPosition(targetRef, cardRef, active, placement = 'below') {
  const [state, setState] = useState({ style: null, arrowLeft: null });
  const frameRef = useRef(null);

  useEffect(() => {
    if (!active || !targetRef?.current) {
      setState({ style: null, arrowLeft: null });
      return;
    }

    const tick = () => {
      const targetEl = targetRef.current;
      const cardEl = cardRef.current;
      if (!targetEl || !cardEl) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = targetEl.getBoundingClientRect();
      const c = cardEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const top = placement === 'above'
        ? Math.max(MARGIN, t.top - GAP - c.height)
        : Math.min(t.bottom + GAP, Math.max(MARGIN, vh - c.height - MARGIN));

      const idealLeft = t.left + t.width / 2 - c.width / 2;
      const maxLeft = Math.max(MARGIN, vw - c.width - MARGIN);
      const left = Math.min(Math.max(idealLeft, MARGIN), maxLeft);

      const arrowLeft = Math.min(Math.max(t.left + t.width / 2 - left, 24), Math.max(24, c.width - 24));

      setState({ style: { position: 'fixed', top, left, margin: 0 }, arrowLeft });

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, targetRef, cardRef, placement]);

  return state;
}
