import { useEffect, useRef, useState } from 'react';
import { useClampTooltip } from '../hooks/useClampTooltip';

/**
 * "i" info icon with a tooltip. Opens on hover (desktop) or tap (mobile) — both funnel
 * into the same "visible" state so the on-screen clamp correction applies identically
 * either way, instead of the tooltip jumping to a different spot only once clicked.
 * Tap-opened tooltips auto-close after 3s since there's no hover-out event on touch.
 */
export default function StatInfo({ children, className }) {
  const [tapped, setTapped] = useState(false);
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const visible = tapped || hover;
  const { tooltipRef, tooltipStyle } = useClampTooltip(visible);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = (e) => {
    e.stopPropagation();
    clearTimeout(timerRef.current);
    setTapped(true);
    timerRef.current = setTimeout(() => setTapped(false), 3000);
  };

  return (
    <span
      className={`stat-info-wrap${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="stat-info-icon">ⓘ</span>
      {visible && (
        <span ref={tooltipRef} className="stat-info-tooltip" style={tooltipStyle}>{children}</span>
      )}
    </span>
  );
}
