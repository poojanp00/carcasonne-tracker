/**
 * CHIP GROUP COMPONENT
 *
 * Reusable chip/button group for displaying selectable items
 * (realms, expansions, etc.) with a consistent UI pattern.
 */

export default function ChipGroup({ items, selectedId, onSelect, className = '', displayOnly = false, carousel = false }) {
  return (
    <div className={carousel ? 'expansion-chips-carousel' : 'expansion-chips'}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`expansion-chip${selectedId === item.id ? ' selected' : ''}${displayOnly ? ' display-only' : ''}${className}`}
          onClick={() => !displayOnly && onSelect?.(item)}
          disabled={displayOnly}
        >
          {item.name}
        </button>
      ))}
    </div>
  );
}
