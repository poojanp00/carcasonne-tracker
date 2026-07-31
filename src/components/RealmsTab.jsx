import { useEffect, useRef, useState } from 'react';
import RealmsHub from './RealmsHub';
import RealmBook from './RealmBook';
import { RealmTourModal, RealmHubTourCards } from './HowToGuide';
import { spineFor } from '../data/spines';
import { DEMO_REALMS, makeTourLogbookGames } from '../data/demoData';

// The demo realm never appears as a card on the shelf — not on a guest's
// first visit, not after creating a realm, not even from the "?" button.
// Its only remaining job is as a defensive fallback for `highlightRealm`
// below, for the (likely unreachable in practice) case of a guest reaching
// the hub tour with zero real realms yet — the logbook leg itself now opens
// the guest's own real realm instead (see openRealm/bookGames below), with
// its logbook unlocked and populated with a personalized stand-in game set
// (see makeTourLogbookGames) rather than routing through this demo realm.
const DEMO_REALM = DEMO_REALMS[0];
const FIRST_LOG_PAGE = 2; // 0 overview, 1 roster, 2.. game log — matches RealmBook.jsx

// Book progress (Overview/Roster/Game Log) — same grow-and-darken chip
// treatment as PreGameSetup's PregameStepper (Players/Expansions), reusing
// its `.pregame-stepper`/`.pregame-step` styling so both guided walks read
// as the same UI pattern. Replaces the plain page-name label that used to
// live inside RealmBook's own header (see RealmBook.jsx).
function BookStepper({ page, onJump }) {
  const items = [{ p: 0, label: 'Cover' }, { p: 1, label: 'Roster' }, { p: FIRST_LOG_PAGE, label: 'Log' }];
  const activeIndex = page === 0 ? 0 : page === 1 ? 1 : 2;
  return (
    <div className="pregame-stepper">
      {items.map((item, i) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5rem' }}>
          {i > 0 && <span className="pregame-step-sep">›</span>}
          <button
            type="button"
            className={`pregame-step${i === activeIndex ? ' active' : ''}`}
            onClick={() => onJump(item.p)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)' }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// Container for the "browsing" state of the Realms tab: switches between
// the hub grid (RealmsHub) and an open realm's history book (RealmBook).
// Nothing here touches `session` — that's the play-flow's concern, owned by
// App.jsx and only ever entered via a chest click (onPlayRealm).
//
// `tourActive` is lifted to App.jsx rather than owned locally — this
// component unmounts whenever a chest click starts a play session (App.jsx
// swaps in PreGameSetup instead), and remounts fresh once that session ends,
// so a tour that's mid-loop needs its "on/off" to survive that boundary.
export default function RealmsTab({
  realms = [], games = [], onPlayRealm, onCreateRealm, onDeleteGame,
  onDeleteRealm, onLeaveRealm, onUpdateRealm, unlockedChestIndices = null, unlockedLogbookIndices = null, isGuest = false,
  openGame = null,
  onOpenGameClear, resetSignal = 0, tourActive = false, onTourActiveChange = null,
  tourVisitedChest = false, tourVisitedBook = false, tourVisitedProfile = false,
  onTourVisitChest = null, onTourVisitBook = null,
  tourShown = false, onTourShown = null,
  scrollToRealmId = null, onScrollToRealmConsumed = null,
  onHubStageChange = null,
}) {
  const [openBookRealmId, setOpenBookRealmId] = useState(null); // null = hub
  const [page,            setPage]            = useState(0);
  const [selectedGame,    setSelectedGame]    = useState(null);
  // Closing the book (see handleBackFromBook) is entirely local to this
  // component — it never touches `session` up in App.jsx, so it needs its
  // own version of the same scroll-to-and-spotlight state `scrollToRealmId`
  // carries down from there for the creation/pregame/postgame paths. The
  // two are merged below into whichever one's actually set.
  const [localSpotlightId, setLocalSpotlightId] = useState(null);

  // Guided tour — one stage for the hub (rendered as two simultaneous
  // side-by-side popups, see RealmHubTourCards), three for the open book.
  // hubRef spotlights the whole card (both icons stay clickable throughout
  // — see RealmsHub.jsx/RealmCard's `.tour-highlight`).
  const hubRef = useRef(null);
  const overviewChartRef = useRef(null);
  const rosterRef = useRef(null);
  const gamelogRef = useRef(null);

  const openRealm = realms.find(r => r.id === openBookRealmId) || null;
  // A guest walking the tour's logbook leg opens their own real realm —
  // freshly created, so it has no real games yet (see RealmsHub.jsx's
  // tour-only unlock). Substitutes a personalized stand-in set (see
  // makeTourLogbookGames) so there's something real to page through, rather
  // than an empty book. Never applies outside the tour, or once real games
  // actually exist for this realm.
  const bookGames = (isGuest && tourActive && openRealm && !games.some(g => g.realmId === openRealm.id))
    ? makeTourLogbookGames(openRealm)
    : games;

  const tourStage = !openRealm ? 'hub' : page === 0 ? 'overview' : page === 1 ? 'roster' : 'gamelog';
  // Lets App.jsx know whether the book is open — its own ProfileTabTourCard
  // (the Realms tour's third leg) is only meant to show at the hub itself,
  // not while inside the logbook (App.jsx already knows separately whether
  // the chest path is open, via `session`). Reported via effect rather than
  // just a prop the parent reads off a ref, since App.jsx needs to re-render
  // when this changes to show/hide that card.
  useEffect(() => { onHubStageChange?.(tourStage === 'hub'); }, [tourStage, onHubStageChange]);
  // Ends the Realms tour once all three legs — chest, logbook, and Profile —
  // have been visited, regardless of the order taken. Checked locally here
  // (against this component's OWN `tourStage`) rather than from a
  // flags-only effect in App.jsx: tourVisitedChest/Book flip true the
  // instant their icon is CLICKED, not once that path's own walkthrough
  // finishes (see handlePlayRealm/handleOpenBook below) — so if the last
  // remaining leg is chest or logbook, all three flags go true in the very
  // same batch that opens it, before its own tour has shown a single step.
  // Gating on `tourStage === 'hub'` is what keeps that from reading as
  // "done" prematurely: tourStage only returns to 'hub' after that leg's
  // own walkthrough actually finishes (or is closed), so this only ever
  // fires once every leg has genuinely been completed, not just entered.
  useEffect(() => {
    if (tourActive && tourStage === 'hub' && tourVisitedChest && tourVisitedBook && tourVisitedProfile) {
      onTourActiveChange?.(false);
    }
  }, [tourActive, tourStage, tourVisitedChest, tourVisitedBook, tourVisitedProfile, onTourActiveChange]);
  // Which sub-section of the book gets the spotlight — passed to RealmBook
  // so it (not this component) decides which of its own elements gets the
  // `tour-highlight` class.
  const tourHighlight = tourStage === 'overview' ? 'chart'
    : tourStage === 'roster' ? 'roster'
    : tourStage === 'gamelog' ? 'gamelog'
    : null;
  // Each stage's popup docks beside its own specific target instead of a
  // generic fixed spot.
  const tourTargetRef = tourStage === 'hub' ? hubRef
    : tourStage === 'overview' ? overviewChartRef
    : tourStage === 'roster' ? rosterRef
    : tourStage === 'gamelog' ? gamelogRef
    : null;

  // The hub stage only ever spotlights one realm's card at a time. For a
  // signed-in account that's preferably the first (by creation order,
  // matching the hub's own shelf order) that actually has recorded games, so
  // the book/roster/gamelog stages have something real to show; falling back
  // to any real realm (even a brand new, gameless one) covers every
  // signed-in case. For a guest, though, it's specifically their own real
  // realm once they have one — the tour should walk through the chest/realm
  // they just created, not the demo one — falling back to the
  // (never-rendered, see DEMO_REALM above) demo realm before that.
  const sortedRealms = [...realms].sort((a, b) =>
    new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
  );
  const realmsWithGames = sortedRealms.filter(r => games.some(g => g.realmId === r.id));
  const ownRealm = isGuest ? sortedRealms[0] || null : null;
  const highlightRealm = ownRealm || realmsWithGames[0] || sortedRealms[0] || (isGuest ? DEMO_REALM : null);

  const startTour = () => onTourActiveChange?.(true);
  // Auto-opens the tour the *first* time a guest reaches this tab this
  // session (see App.jsx's guestRealmsTourShown/onTourShown — lifted, not
  // local state, since this component unmounts/remounts on every tab
  // switch) — not a signed-in account, even with 0 games (that one has to
  // click "?" itself), and not a guest who's already seen it once.
  useEffect(() => {
    if (!tourActive && isGuest && !tourShown) {
      startTour();
      onTourShown?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // X on the hub's own chest/logbook fork card (see RealmHubTourCards
  // below) dismisses just that offer — marks BOTH chest and logbook
  // visited (so it won't reappear) without ending tourActive itself, so a
  // still-unvisited Profile leg (see App.jsx's ProfileTabTourCard) keeps
  // showing. The completion effect further down is what actually ends the
  // tour, once every leg — this dismissal included — has been accounted for.
  const dismissHubForkTour = () => {
    onTourVisitChest?.();
    onTourVisitBook?.();
  };
  // X on the book path's OWN tour card (see RealmTourModal below) only
  // backs out of the book, same as its Back button at the Overview stage
  // already does — tourActive is left on, so a chest/Profile leg still
  // unvisited keeps showing once the user's back at the hub, instead of the
  // whole tour ending just because they dismissed this one leg.
  const closeBookLegTour = () => closeBook();
  // The hub is a fork, not a fixed step — the user picks a side by clicking
  // the real chest or logbook icon on the spotlighted card (both live
  // throughout via `.tour-highlight`'s `pointer-events: auto`, and the
  // logbook one is unlocked for a guest here specifically — see
  // RealmsHub.jsx). These wrap the real onPlayRealm/openBook handlers just
  // to also mark that path visited; once both have been, the effect below
  // closes the tour instead of leaving the hub's fork card up indefinitely.
  // The `realm.isDemo` checks are defensive leftovers from when the demo
  // realm could still be reached this way — harmless no-ops now, since
  // nothing passes a demo realm into these handlers anymore.
  const handlePlayRealm = (realm) => {
    if (realm.isDemo && !tourActive) startTour();
    if (tourActive || realm.isDemo) onTourVisitChest?.();
    onPlayRealm(realm);
  };
  const handleOpenBook = (realm) => {
    if (realm.isDemo && !tourActive) startTour();
    if (tourActive || realm.isDemo) onTourVisitBook?.();
    openBook(realm);
  };
  // A game opened from the Overview/Roster stats (Realm Highlights, a
  // player's trophy case) stays open across a tour transition otherwise —
  // the Lightbox is keyed off selectedGame, not the current page, so
  // moving to a different stage while it's up would leave it stuck open
  // on top of whatever's spotlighted next.
  const advanceTour = () => {
    setSelectedGame(null);
    if (tourStage === 'gamelog') closeBook();
    else if (tourStage !== 'hub') setPage(p => p + 1);
  };
  // Mirrors advanceTour in reverse — the book path's first stage (Overview)
  // backs out to the hub, same as the play path's Players does in
  // PreGameSetup.jsx.
  const backTour = () => {
    setSelectedGame(null);
    if (tourStage === 'overview') closeBook();
    else if (tourStage !== 'hub') setPage(p => p - 1);
  };

  useEffect(() => {
    // Roster and Game log land on already-visible content (the page-turn
    // itself put them in view), so scrolling on top of that just adds
    // motion without helping — only hub/overview need a scroll assist.
    if (!tourActive || !tourTargetRef.current) return;
    if (tourStage === 'roster' || tourStage === 'gamelog') return;
    // 'start' (not 'center') for overview so the title stays in view above
    // the content instead of scrolling past it.
    const block = tourStage === 'overview' ? 'start' : 'center';
    tourTargetRef.current.scrollIntoView({ behavior: 'smooth', block });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStage]);

  const openBook = (realm) => {
    setOpenBookRealmId(realm.id);
    setPage(0);
    setSelectedGame(null);
  };
  // Clearing selectedGame here (not just letting RealmBook/Lightbox
  // unmount) matters because it's state owned up here in RealmsTab, not
  // inside RealmBook — without this, the Lightbox visually disappears when
  // the book closes but silently pops back open showing the same stale
  // game the instant any book (this one or another) is opened again.
  const closeBook = () => {
    setOpenBookRealmId(null);
    setPage(0);
    setSelectedGame(null);
  };
  // The book's own "‹" back button specifically (not closeBook's other
  // callers below — the tour closing, tour navigation stepping back off
  // Overview, or the realm disappearing out from under an open book — none
  // of those are "the user just finished looking at this realm" moments):
  // mirrors the same scroll-to-and-briefly-spotlight treatment a freshly
  // created realm gets (see localSpotlightId below / RealmsHub.jsx), just
  // for a realm the user is stepping away from instead of one they just
  // picked.
  const handleBackFromBook = () => {
    setLocalSpotlightId(openBookRealmId);
    closeBook();
  };

  // Re-clicking the Realms tab while already here backs out to the hub.
  useEffect(() => {
    if (resetSignal) closeBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Cross-nav from other pages: land on the right book, the right log page,
  // and open the game's lightbox
  useEffect(() => {
    if (!openGame) return;
    const realm = realms.find(r => r.id === openGame.realmId);
    if (realm) {
      setOpenBookRealmId(realm.id);
      const GAMES_PER_PAGE = 25;
      const idx = games.filter(g => g.realmId === realm.id).findIndex(g => g.id === openGame.id);
      setPage(idx >= 0 ? FIRST_LOG_PAGE + Math.floor(idx / GAMES_PER_PAGE) : 0);
      setSelectedGame(openGame);
    }
    onOpenGameClear?.();
  }, [openGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to the hub if the open realm disappears (deleted / left).
  useEffect(() => {
    if (openBookRealmId && !realms.some(r => r.id === openBookRealmId)) closeBook();
  }, [openBookRealmId, realms]);

  return (
    <div>
      {/* Hidden while a game's Lightbox is open on top (selectedGame) — the
          card has nothing useful to point at behind a full-screen modal, and
          leaving it mounted keeps its position-tracking rAF loop (see
          useTourCardPosition) running the whole time the Lightbox is up for
          no visible benefit, competing for the same main thread a touch
          scroll gesture inside the Lightbox needs on a phone. It reappears
          automatically once the Lightbox closes and `tourStage` is still
          whatever stage it was (gamelog, most often). */}
      {tourActive && !selectedGame && (
        tourStage === 'hub' ? (
          // Nothing to show once both forks are visited — leaves the
          // Profile leg's own card (see App.jsx's ProfileTabTourCard) as
          // the only thing pointing the user anywhere, instead of an empty
          // popup-less box sitting here too.
          (!tourVisitedChest || !tourVisitedBook) && (
            <RealmHubTourCards
              showChest={!tourVisitedChest}
              showBook={!tourVisitedBook}
              onClose={dismissHubForkTour}
              targetRef={hubRef}
            />
          )
        ) : (
          <RealmTourModal
            stage={tourStage}
            onNext={advanceTour}
            onBack={backTour}
            onClose={closeBookLegTour}
            targetRef={tourTargetRef}
          />
        )
      )}

      {!openRealm ? (
        <RealmsHub
          realms={realms}
          onPlayRealm={handlePlayRealm}
          onOpenBook={handleOpenBook}
          onCreateRealm={onCreateRealm}
          onDeleteRealm={onDeleteRealm}
          onLeaveRealm={onLeaveRealm}
          onUpdateRealm={onUpdateRealm}
          unlockedChestIndices={unlockedChestIndices}
          unlockedLogbookIndices={unlockedLogbookIndices}
          isGuest={isGuest}
          tourActive={tourActive}
          highlightRealmId={tourActive && tourStage === 'hub' ? highlightRealm?.id : null}
          onStartTour={startTour}
          hubRef={hubRef}
          scrollToRealmId={scrollToRealmId || localSpotlightId}
          onScrollToRealmConsumed={() => {
            if (scrollToRealmId) onScrollToRealmConsumed?.();
            if (localSpotlightId) setLocalSpotlightId(null);
          }}
        />
      ) : (
        <div className={tourActive ? 'tour-inert' : ''}>
          <div className="section-title">
            <button type="button" className="section-title-back" onClick={handleBackFromBook} title="Back to the realms hub">
              <span aria-hidden="true">‹</span>
              <span className="section-title-back-spine-wrap">
                <img className="section-title-back-spine" src={spineFor(openRealm)} alt="" draggable={false} />
              </span>
            </button>
            <BookStepper page={page} onJump={setPage} />
            <div className="section-title-line" />
            <span className="game-count">{openRealm.name}</span>
          </div>
          <RealmBook
            realm={openRealm}
            games={bookGames}
            page={page}
            onPageChange={setPage}
            selectedGame={selectedGame}
            onSelectGame={setSelectedGame}
            onDeleteGame={onDeleteGame}
            tourActive={tourActive}
            chartRef={overviewChartRef}
            rosterRef={rosterRef}
            gamelogRef={gamelogRef}
            tourHighlight={tourActive ? tourHighlight : null}
            onExitToRealms={handleBackFromBook}
          />
        </div>
      )}
    </div>
  );
}
