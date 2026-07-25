import { useEffect, useMemo, useRef, useState } from 'react';
import { chestFor } from '../data/chests';
import { spineFor } from '../data/spines';
import { GearIcon } from './icons';
import ValInfo from './ValInfo';
import RealmSettingsModal from './RealmSettingsModal';

function RealmCard({
  realm, isGuest, tourActive, highlighted = false,
  isNew = false, cardRef = null, onPlayRealm, onOpenBook, onOpenSettings,
}) {
  // The demo card's chest/book are always clickable — no lock, no tooltip
  // nudge. Clicking either one just engages the guided tour on that
  // specific path (see handlePlayRealm/handleOpenBook in RealmsTab.jsx),
  // starting it first if it isn't already running, instead of requiring
  // the tour to already be active or a separate "?" click first. A guest's
  // *own* realm has a separate, unrelated book lock (sign-in required for
  // the library) that's untouched by any of this.
  const bookLocked = isGuest && !realm.isDemo;
  // No settings/delete for the demo card (nothing real to configure) or a
  // guest's own realm (no dedicated delete flow), and not mid-tour, when
  // only the tour's own actions should be live.
  const showSettings = !realm.isDemo && !tourActive && !isGuest;

  const chestBtn = (
    <button
      type="button"
      className="realm-card-chest"
      onClick={() => onPlayRealm(realm)}
    >
      <img src={chestFor(realm)} alt="" draggable={false} />
    </button>
  );
  const bookBtn = (
    <button
      type="button"
      className={`realm-card-book${bookLocked ? ' locked-tile' : ''}`}
      disabled={bookLocked}
      onClick={bookLocked ? undefined : () => onOpenBook(realm)}
    >
      <img src={spineFor(realm)} alt="" draggable={false} />
    </button>
  );

  return (
    <div ref={cardRef} className={`realm-card${highlighted ? ' tour-highlight' : ''}${isNew ? ' realm-card-just-created' : ''}`}>
      <div className="realm-card-art-row">
        {chestBtn}
        {bookLocked ? <ValInfo tip="Sign in to access the logbook">{bookBtn}</ValInfo> : bookBtn}
      </div>
      <span className="realm-card-name">{realm.name}</span>
      {showSettings && (
        <button
          type="button"
          className="realm-card-settings-btn"
          title="Realm settings"
          onClick={() => onOpenSettings(realm)}
        >
          <GearIcon />
        </button>
      )}
    </div>
  );
}

// The Realms hub grid — a paired Chest+Logbook card per realm. Chest click
// starts the play flow; logbook click opens that realm's history book; the
// gear icon (signed-in users only — guests get no settings/delete
// affordance) is the sole settings entry point.
export default function RealmsHub({
  realms = [], onPlayRealm, onOpenBook, onCreateRealm,
  onDeleteRealm, onLeaveRealm, onUpdateRealm, selfRank = 1, isGuest = false,
  tourActive = false, highlightRealmId = null,
  onStartTour = null, hubRef = null,
  scrollToRealmId = null, onScrollToRealmConsumed = null,
}) {
  const [settingsRealm,     setSettingsRealm]     = useState(null);
  const newRealmRef = useRef(null);

  // Demo realms (guests only, see App.jsx) sort first regardless of date —
  // their fixed `created_at` isn't meaningful against a real realm's
  // actual creation time, and the demo card belongs at the front of the
  // shelf either way.
  const shelfRealms = useMemo(
    () => [...realms].sort((a, b) =>
      (a.isDemo ? 0 : 1) - (b.isDemo ? 0 : 1)
      || new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
    ),
    [realms]
  );

  // Scrolls to (and briefly spotlights, see .realm-card-just-created) the
  // realm `scrollToRealmId` points at — one just created, or one just
  // returned from (App.jsx's `hubSpotlightRealmId`, or RealmsTab's own
  // `localSpotlightId` for the book's back button; App.jsx skips setting
  // either while the tour is what's driving the exit, since the tour's own
  // steady highlight already provides focus) — so the chest/logbook combo
  // doesn't just vanish back into the grid unseen. Guarded on the realm
  // actually being in `realms`, re-checking whenever it changes.
  // Consumption (clearing `scrollToRealmId`, which drops the spotlight
  // class) is delayed rather than immediate so the CSS fade — driven by
  // that class's presence, not a timer of its own — actually gets to play
  // instead of being cut off the instant the class is removed.
  useEffect(() => {
    if (!scrollToRealmId || !realms.some(r => r.id === scrollToRealmId)) return;
    newRealmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => onScrollToRealmConsumed?.(), 2200);
    return () => clearTimeout(t);
  }, [scrollToRealmId, realms, onScrollToRealmConsumed]);

  return (
    <div>
      {settingsRealm && (
        <RealmSettingsModal
          // Re-resolved against the live realms array on every render, not
          // just the snapshot captured when the gear icon was clicked —
          // otherwise a chest/logbook/name change saved from inside the
          // modal never shows up back on the menu view, since onUpdateRealm
          // updates `realms` but settingsRealm itself never gets refreshed.
          realm={realms.find(r => r.id === settingsRealm.id) || settingsRealm}
          realms={realms}
          selfRank={selfRank}
          onUpdateRealm={onUpdateRealm}
          onDeleteRealm={onDeleteRealm}
          onLeaveRealm={onLeaveRealm}
          onClose={() => setSettingsRealm(null)}
        />
      )}

      {/* tour-inert: while a tour is open, only the one spotlighted realm
          card should be clickable — not "+ New", the "?" itself, or any
          other realm's card. */}
      <div className={tourActive ? 'tour-inert' : ''}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2>Realms</h2>
            {/* The sole manual tour entry point — the demo realm the tour's
                logbook leg leans on (see RealmsTab.jsx's DEMO_REALM) never
                actually shows up on the shelf, no separate "See how it
                works!" chip or toggle needed. Green while the tour's
                actually running is the only state that matters here — the
                button itself goes inert (see tour-inert above) the moment
                it starts, so this is purely "you're in it right now." */}
            {onStartTour && (
              <button
                type="button"
                title={tourActive ? 'Tour in progress' : 'How the Realms hub works'}
                onClick={onStartTour}
                style={{ background: 'none', border: `1px solid ${tourActive ? 'var(--forest-green)' : 'var(--warm-gold)'}`, borderRadius: '50%', width: 'clamp(1.15rem, 4vw, 1.5rem)', height: 'clamp(1.15rem, 4vw, 1.5rem)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 2vw, 0.8rem)', fontWeight: 700, color: tourActive ? 'var(--forest-green)' : 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
              >
                ?
              </button>
            )}
          </div>
          <div className="section-title-line" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCreateRealm}>+ New</button>
        </div>

        {realms.length === 0 ? (
          <div className="empty-state">No realms yet. Create one to get started.</div>
        ) : (
          <div className="realms-hub-grid">
            {shelfRealms.map(realm => {
              const isTourTarget = realm.id === highlightRealmId;
              return (
                <RealmCard
                  key={realm.id}
                  realm={realm}
                  isGuest={isGuest}
                  tourActive={tourActive}
                  highlighted={isTourTarget}
                  cardRef={isTourTarget ? hubRef : realm.id === scrollToRealmId ? newRealmRef : null}
                  isNew={realm.id === scrollToRealmId}
                  onPlayRealm={onPlayRealm}
                  onOpenBook={onOpenBook}
                  onOpenSettings={setSettingsRealm}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
