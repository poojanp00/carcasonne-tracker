import { useEffect, useRef, useState } from 'react';

// Module-level singleton: only one tooltip should be visible across the whole page at a
// time, whether it's open via tap or hover. Each hook instance registers its own close
// function + trigger node here whenever it becomes visible; a newly-visible tooltip evicts
// whichever one was previously registered — instantly, not after that one's auto-close
// timer runs out.
let active = null; // { close, node } | null

function claim(entry) {
  if (active && active.close !== entry.close) active.close();
  active = entry;
}

function release(close) {
  if (active && active.close === close) active = null;
}

// One global capture-phase listener (attached lazily, once) that closes the active tooltip
// the instant the user taps/clicks anywhere outside its trigger — including the first touch
// of a scroll gesture — rather than waiting out the 3s auto-close timer. Capture phase means
// this runs before the click that *opens* a different tooltip reaches its onClick handler,
// so it can't immediately close a tooltip that's only just being opened.
let listening = false;
function ensureOutsideCloseListener() {
  if (listening) return;
  listening = true;
  document.addEventListener('pointerdown', (e) => {
    if (active && active.node && !active.node.contains(e.target)) active.close();
  }, true);
}

/**
 * Hover (desktop) or tap (mobile) visibility for a tooltip trigger.
 * - Tap-opened tooltips auto-close after 3s, since touch has no hover-out event to
 *   dismiss them otherwise.
 * - Becoming visible (by tap or by hover) closes any other tooltip left open elsewhere on
 *   the page, so tapping or hovering around doesn't leave a stack of tooltips cluttering
 *   the screen.
 * - Tapping/clicking anywhere outside the trigger closes it immediately (doesn't wait for
 *   the 3s timer) — attach the returned `triggerRef` to the trigger element.
 */
export function useTapTooltip() {
  const [tapped, setTapped] = useState(false);
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const triggerRef = useRef(null);
  const visible = tapped || hover;
  const closeRef = useRef(() => { setTapped(false); setHover(false); });

  useEffect(() => {
    ensureOutsideCloseListener();
    if (visible) claim({ close: closeRef.current, node: triggerRef.current });
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

  return { visible, open, onMouseEnter, onMouseLeave, triggerRef };
}
