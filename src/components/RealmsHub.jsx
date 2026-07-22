import { useEffect, useMemo, useRef, useState } from 'react';
import { chestFor } from '../data/chests';
import { spineFor } from '../data/spines';
import { GearIcon } from './icons';
import ValInfo from './ValInfo';
import RealmSettingsModal from './RealmSettingsModal';

function RealmCard({
  realm, isGuest, showDemoData, tourActive, highlighted = false,
  isNew = false, cardRef = null, onPlayRealm, onOpenBook, onOpenSettings,
}) {
  // Demo data normally locks the chest (starting a real game from fake data
  // makes no sense), but two things prop it back open: the guided tour,
  // which walks the chest/play path as a no-commitment practice run (Begin
  // is disabled/repurposed throughout); and guests generally, mirroring
  // bookLocked below — a guest's only way to preview what the chest/play
  // flow even looks like is through demo data (their own real chest is
  // never blocked by demo, since demo replaces the whole realm list while
  // it's on), so it stays open for them any time demo is up, tour or not.
  const chestLocked  = showDemoData && !tourActive && !isGuest;
  const bookLocked   = isGuest && !showDemoData;
  // Guests get no settings/delete affordance at all — their one realm has
  // nothing to configure and nothing worth a dedicated delete flow.
  const showSettings = !showDemoData && !tourActive && !isGuest;

  const chestBtn = (
    <button
      type="button"
      className={`realm-card-chest${chestLocked ? ' locked-tile' : ''}`}
      disabled={chestLocked}
      onClick={chestLocked ? undefined : () => onPlayRealm(realm)}
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
        {chestLocked ? <ValInfo tip="Exit demo mode to play">{chestBtn}</ValInfo> : chestBtn}
        {bookLocked ? <ValInfo tip="Sign in to access the library">{bookBtn}</ValInfo> : bookBtn}
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
  realms = [], gamesLength = 0, onPlayRealm, onOpenBook, onCreateRealm,
  onDeleteRealm, onLeaveRealm, onUpdateRealm, selfRank = 1, isGuest = false,
  showDemoData = false, onToggleDemoData = null, onSeeHowItWorks = null,
  tourActive = false, highlightRealmId = null, onStartTour = null, hubRef = null,
  scrollToRealmId = null, onScrollToRealmConsumed = null,
}) {
  const [settingsRealm,     setSettingsRealm]     = useState(null);
  const newRealmRef = useRef(null);

  const shelfRealms = useMemo(
    () => [...realms].sort((a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)),
    [realms]
  );

  // Scrolls to (and briefly spotlights, see .realm-card-just-created) the
  // realm `scrollToRealmId` points at — one just created, or one just
  // returned from (App.jsx's `hubSpotlightRealmId`, or RealmsTab's own
  // `localSpotlightId` for the book's back button) — so the chest/logbook
  // combo doesn't just vanish back into the grid unseen. Guarded on the
  // realm actually being in `realms`: a guest's fresh realm isn't there yet
  // while its post-creation tour has demo data swapped in — this just
  // waits, re-checking whenever `realms` changes, and fires for real the
  // moment demo clears and the real realm reappears. Consumption (clearing
  // `scrollToRealmId`, which drops the spotlight class) is delayed rather
  // than immediate so the CSS fade — driven by that class's presence, not a
  // timer of its own — actually gets to play instead of being cut off the
  // instant the class is removed.
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
          card should be clickable — not "+ New", the demo toggle, the "?"
          itself, or any other realm's card. */}
      <div className={tourActive ? 'tour-inert' : ''}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2>Realms</h2>
            {onStartTour && (
              <button
                type="button"
                title="How the Realms hub works"
                onClick={onStartTour}
                style={{ background: 'none', border: '1px solid var(--warm-gold)', borderRadius: '50%', width: 'clamp(1.15rem, 4vw, 1.5rem)', height: 'clamp(1.15rem, 4vw, 1.5rem)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 2vw, 0.8rem)', fontWeight: 700, color: 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
              >
                ?
              </button>
            )}
          </div>
          <div className="section-title-line" />
          {!showDemoData && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCreateRealm}>+ New</button>
          )}
          {(isGuest || showDemoData || gamesLength === 0) && onToggleDemoData && !(showDemoData && tourActive) && (
            <button type="button" className={`expansion-chip${showDemoData ? ' selected' : ''}`} onClick={showDemoData ? onToggleDemoData : onSeeHowItWorks} style={{ fontSize: 'clamp(0.72rem, 2.4vw, 1rem)', padding: 'clamp(0.5rem, 1.6vw, 0.6rem) clamp(1.1rem, 3.4vw, 1.3rem)', marginLeft: '0.5rem' }}>
              {showDemoData ? 'Click to exit' : 'See how it works!'}
            </button>
          )}
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
                  showDemoData={showDemoData}
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
