import { useEffect, useRef, useState } from 'react';
import RealmsHub from './RealmsHub';
import RealmBook from './RealmBook';
import { RealmTourModal, RealmHubTourCards } from './HowToGuide';
import { spineFor } from '../data/spines';
import { DEMO_REALMS, DEMO_GAMES } from '../data/demoData';

// The demo realm never appears as a card on the shelf — not on a guest's
// first visit, not after creating a realm, not even from the "?" button —
// it's purely a stand-in the guided tour's logbook leg reaches for behind
// the scenes, since a guest's own real logbook stays locked either way
// (see RealmsHub.jsx) and so has nothing real to show. See bookHighlightRealm/
// openRealm/bookGames below for the three places that stand-in is threaded in.
const DEMO_REALM = DEMO_REALMS[0];

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
  onDeleteRealm, onLeaveRealm, onUpdateRealm, selfRank = 1, isGuest = false,
  openGame = null,
  onOpenGameClear, resetSignal = 0, tourActive = false, onTourActiveChange = null,
  tourVisitedChest = false, tourVisitedBook = false,
  onTourVisitChest = null, onTourVisitBook = null,
  tourShown = false, onTourShown = null,
  scrollToRealmId = null, onScrollToRealmConsumed = null,
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

  // The demo realm is never in `realms` (see DEMO_REALM above), so its own
  // id has to be checked for separately here.
  const openRealm = realms.find(r => r.id === openBookRealmId)
    || (isGuest && openBookRealmId === DEMO_REALM.id ? DEMO_REALM : null);
  // The book needs demo games specifically when it's the demo realm open —
  // the real `games` array never contains them (see DEMO_REALM above).
  const bookGames = openRealm?.isDemo ? DEMO_GAMES : games;

  const tourStage = !openRealm ? 'hub' : page === 0 ? 'overview' : page === 1 ? 'roster' : 'gamelog';
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

  // The hub-stage popup only ever spotlights (and its "Play Now" prompt
  // only ever targets) one realm at a time. For a signed-in account that's
  // preferably the first (by creation order, matching the hub's own shelf
  // order) that actually has recorded games, so the book/roster/gamelog
  // stages have something real to show; falling back to any real realm
  // (even a brand new, gameless one) covers every signed-in case. For a
  // guest, though, it's specifically their own real realm once they have
  // one — the tour should walk through the chest/realm they just created,
  // not the demo one — falling back to the (never-rendered, see DEMO_REALM
  // above) demo realm before that. Either way, the logbook leg is a fixed
  // exception: a guest's own real logbook stays locked no matter what (see
  // RealmsHub.jsx), so `bookHighlightRealm` always prefers the demo realm
  // for guests specifically, regardless of what the chest leg is pointing at.
  const sortedRealms = [...realms].sort((a, b) =>
    new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
  );
  const realmsWithGames = sortedRealms.filter(r => games.some(g => g.realmId === r.id));
  const ownRealm = isGuest ? sortedRealms[0] || null : null;
  const highlightRealm = ownRealm || realmsWithGames[0] || sortedRealms[0] || (isGuest ? DEMO_REALM : null);
  const bookHighlightRealm = isGuest ? DEMO_REALM : highlightRealm;

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
  // Close always resets to where this tour started — the hub — regardless
  // of whether the user wandered into the book path first.
  const closeTour = () => {
    closeBook();
    onTourActiveChange?.(false);
  };
  // The hub is a fork, not a fixed step — the user picks a side by clicking
  // a real chest/logbook icon (both live throughout via `.tour-highlight`'s
  // `pointer-events: auto` on the whole spotlighted card) or by the matching
  // popup's own action button (see RealmHubTourCards, whose actions target
  // highlightRealm/bookHighlightRealm — including the never-rendered demo
  // realm for the book leg, see DEMO_REALM above). These wrap the real
  // onPlayRealm/openBook handlers just to also mark that path visited; once
  // both have been, the effect below closes the tour instead of leaving the
  // popups up indefinitely. The `realm.isDemo` checks are defensive — the
  // demo realm can only ever reach these handlers via the tour's own
  // buttons, which don't render until the tour (and so `tourActive`) already
  // is, but they keep this correct even if that ever changes.
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

  // Once both forks have been visited, the tour's done — no need to make
  // the user hunt for the X (or leave an empty popup-less hub sitting
  // there once RealmHubTourCards has nothing left to show). Checked on
  // every hub arrival, including the one right after this component
  // remounts post-chest-path (App.jsx swaps PreGameSetup back out), since
  // `tourVisitedChest` is lifted state that survives that unmount.
  useEffect(() => {
    if (tourActive && tourStage === 'hub' && tourVisitedChest && tourVisitedBook) {
      onTourActiveChange?.(false);
    }
  }, [tourActive, tourStage, tourVisitedChest, tourVisitedBook, onTourActiveChange]);

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
      const FIRST_LOG_PAGE = 2;
      const idx = games.filter(g => g.realmId === realm.id).findIndex(g => g.id === openGame.id);
      setPage(idx >= 0 ? FIRST_LOG_PAGE + Math.floor(idx / GAMES_PER_PAGE) : 0);
      setSelectedGame(openGame);
    }
    onOpenGameClear?.();
  }, [openGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to the hub if the open realm disappears (deleted / left) — the
  // demo realm is exempt, since it's never actually in `realms` (see
  // DEMO_REALM above) but is still a valid thing to have open.
  useEffect(() => {
    if (openBookRealmId && openBookRealmId !== DEMO_REALM.id && !realms.some(r => r.id === openBookRealmId)) closeBook();
  }, [openBookRealmId, realms]);

  return (
    <div>
      {tourActive && (
        tourStage === 'hub' ? (
          <RealmHubTourCards
            showChest={!tourVisitedChest}
            showBook={!tourVisitedBook}
            onChestAction={() => highlightRealm && handlePlayRealm(highlightRealm)}
            onBookAction={() => bookHighlightRealm && handleOpenBook(bookHighlightRealm)}
            onClose={closeTour}
            targetRef={hubRef}
          />
        ) : (
          <RealmTourModal
            stage={tourStage}
            onNext={advanceTour}
            onBack={backTour}
            onClose={closeTour}
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
          selfRank={selfRank}
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
          />
        </div>
      )}
    </div>
  );
}
