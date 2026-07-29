import { Children, useEffect, useRef, useState } from 'react';

// Horizontal one-card-at-a-time carousel: CSS scroll-snap for native swipe
// on touch, arrow keys, or the dot pagination below — no on-screen arrow
// buttons. Slide count is derived from children on every render, so newly
// unlocked categories add their dot automatically.
//
// Looping is clone-based: a copy of the last slide is prepended and a copy of
// the first is appended, so paging past either end keeps scrolling in the
// same direction into a clone — then, once the scroll settles, we jump
// instantly (no animation) to the matching real slide at the same visual
// position. Because the clone is pixel-identical, that jump is invisible;
// without it, scrolling straight from index (count-1) back to 0 would rewind
// backwards through every slide instead of continuing forward.
export default function MilestoneCarousel({ children, pauseKeyboard = false }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const settleTimerRef = useRef(null);
  const slides = Children.toArray(children);
  const count = slides.length;
  const canLoop = count > 1;
  const looped = canLoop ? [slides[count - 1], ...slides, slides[0]] : slides;
  const domCount = looped.length;
  // Real slide i lives at DOM index i+1 when looping (index 0 is the cloned last slide).
  const toDom = (i) => (canLoop ? i + 1 : i);

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el || count === 0) return;
    el.scrollTo({ left: toDom(i) * el.clientWidth, behavior: 'smooth' });
  };

  // Land on the first real slide (no animation) on mount and whenever the
  // deck's size changes (e.g. demo data toggled, unlocking new categories).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || count === 0) return;
    el.scrollTo({ left: toDom(0) * el.clientWidth });
    setActive(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Debounced settle check: only correct a clone landing once scrolling has
  // actually stopped (smooth-scroll animation finished, or a touch swipe
  // released) — reacting mid-animation would fight the in-flight scroll.
  const onScroll = () => {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settle, 120);
  };

  const settle = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const domIdx = Math.round(el.scrollLeft / el.clientWidth);
    if (canLoop && domIdx === 0) { // landed on the cloned-last slide
      el.scrollTo({ left: toDom(count - 1) * el.clientWidth });
      setActive(count - 1);
      return;
    }
    if (canLoop && domIdx === domCount - 1) { // landed on the cloned-first slide
      el.scrollTo({ left: toDom(0) * el.clientWidth });
      setActive(0);
      return;
    }
    setActive(Math.max(0, Math.min(count - 1, domIdx - (canLoop ? 1 : 0))));
  };

  useEffect(() => () => clearTimeout(settleTimerRef.current), []);

  // Arrow-key paging, mirroring the Library logbook's page-turn shortcut —
  // suppressed while the parent has a modal open over the page (e.g. the
  // Lightbox or Account Settings), so keys don't leak through to the carousel.
  useEffect(() => {
    if (pauseKeyboard) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goTo(active - 1);
      if (e.key === 'ArrowRight') goTo(active + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseKeyboard, active, count]);

  return (
    <div className="milestone-carousel">
      <div className="milestone-carousel-track" ref={trackRef} onScroll={onScroll}>
        {looped.map((slide, i) => (
          <div className="milestone-carousel-slide" key={i}>
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="milestone-carousel-dots">
          {slides.map((slide, i) => (
            <button
              type="button"
              key={slide.key ?? i}
              className={`milestone-carousel-dot${i === active ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to card ${i + 1} of ${count}`}
              aria-current={i === active ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
