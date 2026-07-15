import { useEffect, useRef, useState } from 'react';

// Module-level singleton: only one tooltip should be visible across the whole page at a
// time, whether it's open via tap or hover. Each hook instance registers its own close
// function here whenever it becomes visible; a newly-visible tooltip evicts whichever one
// was previously registered — instantly, not after that one's auto-close timer runs out.
let activeClose = null;

function claim(close) {
  if (activeClose && activeClose !== close) activeClose();
  activeClose = close;
}

function release(close) {
  if (activeClose === close) activeClose = null;
}

/**
 * Hover (desktop) or tap (mobile) visibility for a tooltip trigger.
 * - Tap-opened tooltips auto-close after 3s, since touch has no hover-out event to
 *   dismiss them otherwise.
 * - Becoming visible (by tap or by hover) closes any other tooltip left open elsewhere on
 *   the page, so tapping or hovering around doesn't leave a stack of tooltips cluttering
 *   the screen.
 */
export function useTapTooltip() {
  const [tapped, setTapped] = useState(false);
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const visible = tapped || hover;
  const closeRef = useRef(() => { setTapped(false); setHover(false); });

  useEffect(() => {
    if (visible) claim(closeRef.current);
    else release(closeRef.current);
  }, [visible]);

  useEffect(() => () => { clearTimeout(timerRef.current); release(closeRef.current); }, []);

  const open = () => {
    clearTimeout(timerRef.current);
    setTapped(true);
    timerRef.current = setTimeout(() => setTapped(false), 3000);
  };

  const onMouseEnter = () => setHover(true);
  const onMouseLeave = () => setHover(false);

  return { visible, open, onMouseEnter, onMouseLeave };
}
