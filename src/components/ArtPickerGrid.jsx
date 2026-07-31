import { useState } from 'react';
import ValInfo from './ValInfo';

// Shared chest/logbook picker grid — used by both PreGameSetup.jsx (realm
// creation) and RealmSettingsModal.jsx (changing an existing realm's art).
// Both used to map straight over the full CHESTS/SPINES array directly,
// which was fine at ~17 items but reads as one dense, uninterrupted wall of
// tiles once the catalog grows further — capped at one page of PAGE_SIZE
// (matches the grid's own fixed 4-column layout: 3 full rows) with paging
// once there's more than that.
const PAGE_SIZE = 12;

export default function ArtPickerGrid({
  items, rowClassName, pickClassName, altPrefix,
  selectedIndex, onSelect, isLocked, isGuestBlocked, guestTip, hideIndex,
}) {
  const visible = items
    .map((img, i) => ({ img, i }))
    .filter(({ i }) => !hideIndex?.(i));

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Lands on whichever page already holds the current selection (if any),
  // so switching art doesn't require first hunting for what's picked —
  // only computed once at mount, same as the picker's own selection.
  const [page, setPage] = useState(() => {
    const pos = visible.findIndex(({ i }) => i === selectedIndex);
    return pos > 0 ? Math.floor(pos / PAGE_SIZE) : 0;
  });
  const clampedPage = Math.min(page, pageCount - 1);
  const paginated = pageCount > 1;
  const pageItems = visible.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  // Padded out to a full PAGE_SIZE with invisible slots whenever there's
  // more than one page — a shorter final page (e.g. 18 items -> 12 + 6)
  // would otherwise only fill 2 rows instead of 3, pulling the pager
  // controls up right under wherever that page's last row happens to end
  // instead of sitting at a fixed spot every page.
  const slots = paginated
    ? [...pageItems, ...Array(PAGE_SIZE - pageItems.length).fill(null)]
    : pageItems;

  return (
    // width: fit-content — the grid's own columns are already max-content
    // sized (only as wide as the 4 tiles + gaps actually need), but this
    // wrapper would otherwise stretch to fill .chest-logbook-col's full
    // (wider, flex-grown) width, leaving the tiles left-aligned inside a
    // wider box. Shrinking the wrapper to match means the pager row below
    // — centered within THIS box — lands centered under the tiles
    // themselves (the 2nd/3rd column gap), not the middle of extra empty
    // space to their right.
    <div style={{ width: 'fit-content' }}>
      <div className={rowClassName}>
        {slots.map((entry, slotIndex) => {
          if (!entry) return <span key={`pad-${slotIndex}`} className={pickClassName} style={{ visibility: 'hidden', border: 'none', boxShadow: 'none' }} />;
          const { img, i } = entry;
          const guestBlocked = isGuestBlocked?.(i) ?? false;
          const locked = guestBlocked || (isLocked?.(i) ?? false);
          const btn = (
            <button
              key={i}
              type="button"
              className={`${pickClassName}${locked ? ' locked-tile' : ''}${selectedIndex === i ? ' selected' : ''}`}
              disabled={locked}
              onClick={locked ? undefined : (e) => { onSelect(i); e.currentTarget.blur(); }}
            >
              <img src={img} alt={`${altPrefix} ${i + 1}`} draggable={false} />
            </button>
          );
          // Below .tour-overlay (10001, see usePortalTooltip's default) —
          // unlike most tooltips, this one has to stay UNDER a tour popup
          // card rather than over it: the create-realm tour spotlights this
          // exact grid, and a guest hovering a locked chest/logbook while
          // that card is open shouldn't have this tooltip cover it.
          return guestBlocked ? <ValInfo key={i} tip={guestTip} zIndex={9600}>{btn}</ValInfo> : btn;
        })}
      </div>
      {paginated && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginTop: '0.6rem' }}>
          <button
            type="button"
            aria-label="Previous page"
            disabled={clampedPage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '1rem', lineHeight: 1, color: 'var(--earth-brown)',
              cursor: clampedPage === 0 ? 'var(--cursor-arrow)' : 'var(--cursor-pointer)',
              opacity: clampedPage === 0 ? 0.35 : 1,
            }}
          >
            ‹
          </button>
          <div className="tour-dots">
            {Array.from({ length: pageCount }, (_, p) => (
              <button
                key={p}
                type="button"
                aria-label={`Page ${p + 1}`}
                onClick={() => setPage(p)}
                className={`tour-dot${p === clampedPage ? ' active' : ''}`}
                style={{ padding: 0, cursor: 'var(--cursor-pointer)' }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next page"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '1rem', lineHeight: 1, color: 'var(--earth-brown)',
              cursor: clampedPage >= pageCount - 1 ? 'var(--cursor-arrow)' : 'var(--cursor-pointer)',
              opacity: clampedPage >= pageCount - 1 ? 0.35 : 1,
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
