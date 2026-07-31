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
  fill = false, paginate = true,
}) {
  const visible = items
    .map((img, i) => ({ img, i }))
    .filter(({ i }) => !hideIndex?.(i));

  // Profile.jsx's Gallery (paginate=false) is a showcase of everything
  // unlocked so far, not a picker mid-flow — the whole point is seeing it
  // all at once, so it skips paging (and the padding-to-full-page math
  // below) entirely and just renders every visible item.
  const pageCount = paginate ? Math.max(1, Math.ceil(visible.length / PAGE_SIZE)) : 1;
  // Lands on whichever page already holds the current selection (if any),
  // so switching art doesn't require first hunting for what's picked —
  // only computed once at mount, same as the picker's own selection.
  const [page, setPage] = useState(() => {
    if (!paginate) return 0;
    const pos = visible.findIndex(({ i }) => i === selectedIndex);
    return pos > 0 ? Math.floor(pos / PAGE_SIZE) : 0;
  });
  const clampedPage = Math.min(page, pageCount - 1);
  const paginated = paginate && pageCount > 1;
  const pageItems = paginate
    ? visible.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)
    : visible;
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
    //
    // `fill` inverts this (Profile.jsx's Gallery, a much narrower column
    // than PreGameSetup's full-width picker): the wrapper stretches to
    // 100%, and the row switches from a fixed 4-column grid to
    // auto-fill — tiles stay evenly spaced and stretch to fill whatever
    // width is actually available, and the column count itself grows or
    // shrinks with it, instead of a fixed 4-per-row squeezing down or
    // leaving dead space at odd container widths.
    <div style={fill ? { width: '100%' } : { width: 'fit-content' }}>
      <div className={rowClassName} style={fill ? { gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' } : undefined}>
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
