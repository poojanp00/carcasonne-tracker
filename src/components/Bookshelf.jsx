import { useEffect, useMemo, useRef, useState } from 'react';
import { spineFor } from '../data/spines';

// Shared shelf-of-books widget: used by the Library (open a realm's book)
// and the Play tab (pick which realm to play). onOpenBook fires with the
// clicked realm either way — what happens next is the caller's choice.
export default function Bookshelf({ realms, onOpenBook }) {
  const shelfRef = useRef(null);
  const [plankTops, setPlankTops] = useState([]);

  // Oldest realm first — the shelf fills left to right in creation order,
  // regardless of the order realms arrived in state (new realms and accepted
  // invites append mid-session)
  const shelfRealms = useMemo(
    () => [...realms].sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)),
    [realms]
  );

  // Books wrap naturally; a full-width plank is drawn under every wrapped row.
  // Rows are found by measuring the books' bottom edges (align-items: flex-end
  // lines them up), re-measured whenever the shelf resizes or art loads.
  useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => {
      const bottoms = new Set();
      for (const book of el.querySelectorAll('.book-spine')) {
        bottoms.add(book.offsetTop + book.offsetHeight);
      }
      setPlankTops(prev => {
        const next = [...bottoms].sort((a, b) => a - b);
        return prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [realms]);

  return (
    <div ref={shelfRef} className="library-shelf">
      {plankTops.map(top => (
        <div key={top} className="shelf-plank" style={{ top }} aria-hidden="true" />
      ))}
      {shelfRealms.map(realm => (
        <button key={realm.id} type="button" className="book-spine" onClick={() => onOpenBook(realm)}>
          <div className="book-spine-art">
            <img src={spineFor(realm)} alt="" draggable={false} />
            <span className="book-spine-title">{realm.name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
