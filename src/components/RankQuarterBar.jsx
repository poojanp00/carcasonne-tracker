import { useEffect, useState } from 'react';
import { getMaxRank, tiersRequiredForRank, rankTitle } from '../utils/metaRank';

// Hard cap on visible chunks — past this, each piece gets too narrow for
// "X milestones to Name" to print on one line without wrapping across
// several rows (the whole problem this window exists to avoid).
const WINDOW_SIZE = 7;
// Reserved width for each arrow slot — used for the real ‹/› buttons AND an
// invisible spacer of the same width in the label row below, so the labels
// always line up under their own bar chunk regardless of which arrows (if
// any) are actually showing.
const ARROW_WIDTH = '1rem';

function ScrollArrow({ dir, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active}
      aria-hidden={!active}
      aria-label={dir === 'left' ? 'Show earlier rank' : 'Show later rank'}
      style={{
        background: 'none', border: 'none', padding: 0, flexShrink: 0,
        width: ARROW_WIDTH, height: '18px', lineHeight: '18px', textAlign: 'center',
        fontSize: '1rem', color: 'var(--earth-brown)',
        visibility: active ? 'visible' : 'hidden',
        cursor: active ? 'var(--cursor-pointer)' : 'default',
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
}

// Rank-ladder counterpart to QuarterTierBar's chunked bar — but sized
// dynamically (currentRank + 1 pieces, not a fixed 4) and only ever
// rendering up through the very NEXT rank, never further-future ones (there's
// no "locked" chunk here the way a milestone category always shows all 4).
// Rank 5 splits the bar into 6 equal pieces (~17% each): the first 5 are
// fully earned, the 6th fills partway toward rank 6. Rank 9 splits into 10
// (10% each), and so on — but never more than WINDOW_SIZE pieces are ever
// on screen at once (rank 7+ would otherwise squeeze every piece too
// narrow): a ‹ arrow appears on the left, vertically centered against the
// bar itself, whenever earlier ranks are hidden off-window — each click
// slides the window back one rank, dropping the most recent piece from view
// to hold the total at WINDOW_SIZE. Once scrolled left, a › arrow appears on
// the right to slide back forward, up to the default (most-recent) position.
// Resets to that default whenever the rank actually changes — e.g. a real
// rank-up, or the celebration animation stepping through several at once —
// so a stale scroll position never survives past the moment that earned it.
//
// Every already-earned rank's piece is unconditionally full — rank 1 itself
// requires no real tier count (getCurrentRank floors there regardless), so
// there's no meaningful "how much of rank 1 is filled" to compute; the same
// goes for every rank below the current one, since reaching the current rank
// already implies all of those. Only the final (next-rank) piece uses real
// tierCount math, since that's the only one still in progress — its name
// prints in red as "X milestones to Name" instead of just its name, same
// idea as QuarterTierBar's active tier. The current (just-reached) rank's
// own name is bolded, same as QuarterTierBar's current tier.
export default function RankQuarterBar({ tierCount, currentRank }) {
  const maxRank = getMaxRank();
  const maxed = currentRank >= maxRank;
  const nextRank = currentRank + 1;
  const totalPieces = maxed ? maxRank : nextRank;
  const nextLower = currentRank <= 1 ? 0 : tiersRequiredForRank(currentRank);
  const nextUpper = maxed ? nextLower : tiersRequiredForRank(nextRank);
  const remaining = maxed ? 0 : nextUpper - tierCount;

  const defaultStart = Math.max(1, totalPieces - WINDOW_SIZE + 1);
  const [windowStart, setWindowStart] = useState(defaultStart);
  useEffect(() => { setWindowStart(defaultStart); }, [defaultStart]);

  const visibleCount = Math.min(WINDOW_SIZE, totalPieces);
  // Arrow slots (both rows) are only reserved at all once scrolling is
  // ever POSSIBLE (totalPieces > WINDOW_SIZE) — most accounts are well
  // under rank 7 and never need this, so their bar stays full-width rather
  // than always leaving two empty gutters "just in case."
  const isScrollable = totalPieces > WINDOW_SIZE;
  const canGoLeft = isScrollable && windowStart > 1;
  const canGoRight = isScrollable && windowStart < defaultStart;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {isScrollable && <ScrollArrow dir="left" active={canGoLeft} onClick={() => setWindowStart(s => Math.max(1, s - 1))} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '3px', height: '18px' }}>
          {Array.from({ length: visibleCount }, (_, i) => {
            const rank = windowStart + i;
            const isNext = !maxed && rank === nextRank;
            const frac = isNext
              ? Math.max(0, Math.min(1, (tierCount - nextLower) / (nextUpper - nextLower)))
              : 1;
            return (
              <div
                key={rank}
                style={{ flex: '1 1 0%', height: '100%', border: '2px solid var(--earth-brown)', borderRadius: '2px', background: 'rgba(139,94,60,0.18)', boxShadow: 'inset 2px 2px 0 rgba(43,27,10,0.25)', overflow: 'hidden' }}
              >
                <div style={{
                  width: `${frac * 100}%`,
                  height: '100%',
                  background: 'repeating-linear-gradient(90deg, var(--warm-gold) 0 8px, rgba(43,27,10,0.30) 8px 10px)',
                  transition: 'width 0.4s steps(8, end)',
                }} />
              </div>
            );
          })}
        </div>
        {isScrollable && <ScrollArrow dir="right" active={canGoRight} onClick={() => setWindowStart(s => Math.min(defaultStart, s + 1))} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
        {isScrollable && <div style={{ flexShrink: 0, width: ARROW_WIDTH }} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          {Array.from({ length: visibleCount }, (_, i) => {
            const rank = windowStart + i;
            const isNext = !maxed && rank === nextRank;
            const isCurrent = rank === currentRank;
            return (
              <div
                key={rank}
                style={{
                  flex: '1 1 0%', textAlign: 'center', padding: '0 0.15rem',
                  fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: '0.62rem', lineHeight: 1.15,
                  color: isNext ? 'var(--deep-red)' : isCurrent ? 'var(--earth-brown)' : 'var(--stone-gray)',
                  fontWeight: isCurrent ? 700 : 400,
                }}
              >
                {isNext ? (
                  <>
                    {remaining.toLocaleString()} milestone{remaining === 1 ? '' : 's'} to {rankTitle(nextRank)}
                    <span style={{ opacity: 0.65, fontSize: '0.52rem' }}> · {nextUpper}</span>
                  </>
                ) : (
                  <>
                    {rankTitle(rank)}
                    <span style={{ opacity: 0.65, fontSize: '0.52rem' }}> · {tiersRequiredForRank(rank)}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {isScrollable && <div style={{ flexShrink: 0, width: ARROW_WIDTH }} />}
      </div>
    </div>
  );
}
