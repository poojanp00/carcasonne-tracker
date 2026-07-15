import { useClampTooltip } from '../hooks/useClampTooltip';
import { useTapTooltip } from '../hooks/useTapTooltip';

/**
 * "i" info icon with a tooltip. Opens on hover (desktop) or tap (mobile) — both funnel
 * into the same "visible" state so the on-screen clamp correction applies identically
 * either way, instead of the tooltip jumping to a different spot only once clicked.
 */
export default function StatInfo({ children, className }) {
  const { visible, open, onMouseEnter, onMouseLeave } = useTapTooltip();
  const { tooltipRef, tooltipStyle } = useClampTooltip(visible);

  return (
    <span
      className={`stat-info-wrap${className ? ` ${className}` : ''}`}
      onClick={e => { e.stopPropagation(); open(); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="stat-info-icon">ⓘ</span>
      {visible && (
        <span ref={tooltipRef} className="stat-info-tooltip" style={tooltipStyle}>{children}</span>
      )}
    </span>
  );
}
