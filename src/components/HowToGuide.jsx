import { useRef } from 'react';
import { useTourCardPosition } from '../hooks/useTourCardPosition';
import { useTourCardKeys } from '../hooks/useTourCardKeys';

const STEPS = [
  '**Set up the game** at your table.',
  '**Play Carcassonne** as usual.',
  '**Record scores** here as features are completed.',
  '**Enter Final Scoring** after the last tile is placed.',
  'Complete scoring and **click Finish Game**.',
];

// Realm creation is its own short, linear (non-forking) tour — separate from
// the Realms hub's loop above since it only ever runs on the two
// create-realm sub-steps in PreGameSetup.jsx. No titles — see BOARD_TOUR_STEPS'
// comment below for why every tour in this file dropped them.
const CREATE_REALM_TOUR_STAGES = [
  'Name your realm and add the players.',
  'Choose a chest to store game pieces and a book to write history in.',
];

// The hub itself isn't part of this linear stage list at all — it's a fork
// (chest → play flow, logbook → history book), shown as two independent
// popups at once rather than a stage in a sequence (see RealmHubTourCards
// below). Mode Selection isn't a stage here either, and Meeples is no
// longer its own stage — it's merged into Players (see PreGameSetup.jsx).
const PLAY_PATH_STAGES = [
  { key: 'players',    text: 'Each player picks their game piece. ' },
  { key: 'expansions', text: 'Choose expansions that are in play.' },
  { key: 'begin',      text: 'Gather the pieces and click Begin!' },
];
const BOOK_PATH_STAGES = [
  { key: 'overview', text: 'The Overview contains general realm statistics.' },
  { key: 'roster',   text: 'The Roster shows all player cards. Tap one to flip it.' },
  { key: 'gamelog',  text: 'Use the Game Log to explore match history. Click an entry to view more.' },
];
const REALM_TOUR_STAGES = [...PLAY_PATH_STAGES, ...BOOK_PATH_STAGES];

const PROFILE_STEPS = [
  'Your Character Card displays your rank and overall progress. Click to flip it. ',
  'Completing milestones increases your rank and unlock rewards.',
  'This card shows your records, and memorable victories. Click to flip.',
  'The Trophy Cabinet displays the hardware you have earned along the way.',
  'The Gallery showcases your unlocked chests and logbooks.',
  'Your Collection tracks which expansions you own. Tap Edit to update it.',
];

// Opened from the score board's "?" — a plain Next/Back walkthrough like
// every other tour in this file (see ProfileHowToModal), purely
// informational: while it's open, Board.jsx blocks every scoring
// interaction (player pick, type/goods buttons, Final Scoring, Finish
// Game — see the tourStep guards on those handlers) rather than reacting to
// real clicks, so nothing about the actual game can change mid-tour.
export const BOARD_TOUR_STEPS = [
  'This is your score board.',
  'Select a player to record their score.',
  'Enter amount and tap the type of score to add it.',
  'View the score log here and control game settings below.',
  'Once the final tile is placed, tap Final Scoring and score the rest of the features.',
];

/** Renders **markers** in a step as bold text. */
function renderStep(step) {
  return step.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

function StepList({ steps, ordered = true }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: 0, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      {steps.map(step => (
        <li key={step} style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)' }}>
          {renderStep(step)}
        </li>
      ))}
    </Tag>
  );
}

/** Opened from the create-realm "?" (signed-in users) or auto-shown to
 * guests on every visit (see PreGameSetup.jsx). A short, linear 2-stage
 * tour tied to `createSubStep`, not a fork like the Realms hub's — "Next"
 * on stage 0 validates the name/roster (same check the real "Next →" runs)
 * before advancing the real form to the chest/logbook sub-step, so a bad
 * name/roster blocks the tour there instead of waving it through. "Create"
 * on the last stage IS the real create action (see advanceCreateTour in
 * PreGameSetup.jsx) — closes the tour and submits the realm in one click,
 * rather than leaving the user to close the tour and hunt for the (until
 * now disabled) real Create button underneath it. `targetRef` docks the
 * card beside the matching form section, same as the Realms tour (see
 * useTourCardPosition). */
export function CreateRealmTourModal({ stage, onNext, onBack, onClose, targetRef = null }) {
  const isLast = stage === CREATE_REALM_TOUR_STAGES.length - 1;
  const current = CREATE_REALM_TOUR_STAGES[stage];
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  useTourCardKeys(onNext, onBack);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          // min(), not a flat px value — useTourCardPosition clamps the
          // card's fixed-position LEFT so it doesn't dock off-screen, but
          // it never shrinks the card's own WIDTH, so a flat 340px still
          // overflowed on any viewport narrower than ~300px (the card plus
          // its edge margin). This caps the card at the viewport's width
          // minus that same margin, whichever is smaller.
          maxWidth: 'min(300px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(current)}
        </p>
        {/* Grid, not flex — keeps the dots dead-centered between Back and
            Next regardless of whether Back is showing (an empty first
            column still reserves its space) instead of drifting whenever
            Back is hidden on stage 0. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
          <div style={{ justifySelf: 'start' }}>
            {stage > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>‹ Back</button>}
          </div>
          <div className="tour-dots" style={{ justifySelf: 'center' }}>
            {CREATE_REALM_TOUR_STAGES.map((_, i) => (
              <span key={i} className={`tour-dot${i === stage ? ' active' : ''}`} />
            ))}
          </div>
          <div style={{ justifySelf: 'end' }}>
            {isLast
              ? <button type="button" className="btn btn-sm" onClick={onNext}>Create</button>
              : <button type="button" className="btn btn-sm" onClick={onNext}>Next ›</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal version, opened from the board's "?" button. */
export default function HowToModal({ onClose }) {
  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>How To Play</h3>
        <StepList steps={STEPS} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '1.2rem' }}>
          <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 1.8vw, 0.75rem)', letterSpacing: '0.08em', color: 'var(--stone-gray)', margin: 0 }}>
            BEST VIEWED ON LARGE SCREENS
          </p>
          <button className="btn btn-sm" onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
}

/** Opened from the Profile's "?" button: a guided tour, one bullet per page
 * section — the parent advances/reverses `step` and scrolls to the
 * matching section on each Next/Back (see Profile.jsx's tour handlers).
 * Matches the Realms tour's chrome: a top-left "×" to end the tour from
 * wherever the user is, Back/dots/Next on one centered row, and the card
 * docked beside whatever's spotlighted via `targetRef` (see
 * useTourCardPosition) rather than a fixed screen position. Everything
 * outside the spotlighted section is inert while this is open (see the
 * `.tour-inert` wrapper in Profile.jsx) — only the highlighted content
 * itself (milestone carousel arrows, career-highlight game links, etc.)
 * stays live. */
export function ProfileHowToModal({ step, onNext, onBack, onClose, targetRef = null }) {
  const isLastStep = step === PROFILE_STEPS.length - 1;
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  useTourCardKeys(onNext, onBack);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          // min(), not a flat px value — useTourCardPosition clamps the
          // card's fixed-position LEFT so it doesn't dock off-screen, but
          // it never shrinks the card's own WIDTH, so a flat 340px still
          // overflowed on any viewport narrower than ~300px (the card plus
          // its edge margin). This caps the card at the viewport's width
          // minus that same margin, whichever is smaller.
          maxWidth: 'min(300px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(PROFILE_STEPS[step])}
        </p>
        {/* Grid, not flex — keeps the dots dead-centered between Back and
            Next regardless of whether Back is showing (an empty first
            column still reserves its space) instead of drifting whenever
            Back is hidden on step 0. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
          <div style={{ justifySelf: 'start' }}>
            {step > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>‹ Back</button>}
          </div>
          <div className="tour-dots" style={{ justifySelf: 'center' }}>
            {PROFILE_STEPS.map((_, i) => (
              <span key={i} className={`tour-dot${i === step ? ' active' : ''}`} />
            ))}
          </div>
          <div style={{ justifySelf: 'end' }}>
            {isLastStep
              ? <button type="button" className="btn btn-sm" onClick={onNext}>Got it!</button>
              : <button type="button" className="btn btn-sm" onClick={onNext}>Next ›</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Opened from the score board's "?" button — same plain Next/Back/dots
 * chrome as ProfileHowToModal, docked beside whatever BOARD_TOUR_STEPS'
 * current stop is describing (see Board.jsx's tour-target lookup). No
 * heading — just the one line, see BOARD_TOUR_STEPS. The last stop docks
 * ABOVE its target (the Final Scoring button) instead of below — see
 * useTourCardPosition's `placement` param — so the button itself stays
 * visible under the card instead of getting covered by it. */
export function BoardTourModal({ step, onNext, onBack, onClose, targetRef = null }) {
  const current = BOARD_TOUR_STEPS[step];
  const isLastStep = step === BOARD_TOUR_STEPS.length - 1;
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true, isLastStep ? 'above' : 'below');
  useTourCardKeys(onNext, onBack);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className={`realm-modal tile-card tour-card${isLastStep ? ' tour-card-arrow-down' : ''}`}
        style={{
          // min(), not a flat px value — useTourCardPosition clamps the
          // card's fixed-position LEFT so it doesn't dock off-screen, but
          // it never shrinks the card's own WIDTH, so a flat 340px still
          // overflowed on any viewport narrower than ~300px (the card plus
          // its edge margin). This caps the card at the viewport's width
          // minus that same margin, whichever is smaller.
          maxWidth: 'min(300px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(current)}
        </p>
        {/* Grid, not flex — keeps the dots dead-centered between Back and
            Next regardless of whether Back is showing (an empty first
            column still reserves its space) instead of drifting whenever
            Back is hidden on step 0. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
          <div style={{ justifySelf: 'start' }}>
            {step > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>‹ Back</button>}
          </div>
          <div className="tour-dots" style={{ justifySelf: 'center' }}>
            {BOARD_TOUR_STEPS.map((_, i) => (
              <span key={i} className={`tour-dot${i === step ? ' active' : ''}`} />
            ))}
          </div>
          <div style={{ justifySelf: 'end' }}>
            {isLastStep
              ? <button type="button" className="btn btn-sm" onClick={onNext}>Got it!</button>
              : <button type="button" className="btn btn-sm" onClick={onNext}>Next ›</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Opened from the Realms hub's "?" button, for every stage *except* the hub
 * itself (see RealmHubTourCards below for that one) — Players/Expansions/
 * Begin on the play path, Overview/Roster/Game log on the book path. Each
 * path loops back to the hub afterward, but within a path it's a straight
 * line: "Next" drives it one step at a time (a click anywhere else on the
 * card no longer does — an accidental click shouldn't skip a step), "Back"
 * reverses it (down to the hub, at each path's first stage). The top-left
 * "×" ends the tour from wherever the user currently is, without navigating
 * them anywhere. Everything on the real page outside the spotlighted
 * element is inert while a tour is open (see the `.tour-inert`/
 * `.tour-nav-inert` lockdown in RealmsHub.jsx/PreGameSetup.jsx/
 * RealmBook.jsx) — only the highlighted content itself (a meeple pick, an
 * expansion chip) stays live, keeping `stage` in sync since it's derived
 * in RealmsTab.jsx/PreGameSetup.jsx from real app state either way.
 *
 * `targetRef`, when given, docks the card directly beside that element
 * (via useTourCardPosition) instead of the generic fixed bottom-center
 * spot — so the popup visibly points at what it's describing even when
 * that content isn't centered on screen. Stages without a good single
 * target to anchor to (the book's Overview/Roster/Game Log pages, where
 * the whole book is the spotlighted element) just pass `null` and keep
 * the old bottom-dock behavior. */
export function RealmTourModal({ stage, onNext, onBack, onClose, targetRef = null }) {
  const current = REALM_TOUR_STAGES.find(s => s.key === stage) || PLAY_PATH_STAGES[0];
  // Dots track position within whichever path the user is currently on.
  const path = PLAY_PATH_STAGES.some(s => s.key === stage) ? PLAY_PATH_STAGES
    : BOOK_PATH_STAGES.some(s => s.key === stage) ? BOOK_PATH_STAGES
    : null;
  const pathIndex = path ? path.findIndex(s => s.key === stage) : -1;
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  useTourCardKeys(onNext, onBack);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          // min(), not a flat px value — useTourCardPosition clamps the
          // card's fixed-position LEFT so it doesn't dock off-screen, but
          // it never shrinks the card's own WIDTH, so a flat 340px still
          // overflowed on any viewport narrower than ~300px (the card plus
          // its edge margin). This caps the card at the viewport's width
          // minus that same margin, whichever is smaller.
          maxWidth: 'min(300px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(current.text)}
        </p>
        {/* Grid, not flex — keeps the dots dead-centered between Back and
            Next (Back always shows here, unlike the other tours, but the
            empty middle column still needs reserving when a stage has no
            path — the book's Overview/Roster/Game Log pages). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
          <div style={{ justifySelf: 'start' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>‹ Back</button>
          </div>
          <div style={{ justifySelf: 'center' }}>
            {path && (
              <div className="tour-dots">
                {path.map((s, i) => (
                  <span key={s.key} className={`tour-dot${i === pathIndex ? ' active' : ''}`} />
                ))}
              </div>
            )}
          </div>
          <div style={{ justifySelf: 'end' }}>
            <button type="button" className="btn btn-sm" onClick={onNext}>Next ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row within RealmHubTourCards below: no heading, no action button (see
 * RealmHubTourCards) — the real chest/logbook icon on the spotlighted card
 * is what the user clicks; this section just tells them to, the same way
 * the rest of the app expects a click on the real thing rather than a
 * stand-in button. */
function HubSection({ text, divider = false }) {
  return (
    <div className={divider ? 'tour-hub-section tour-hub-section-divider' : 'tour-hub-section'}>
      <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.82rem, 1.9vw, 0.92rem)', lineHeight: 1.35, color: 'var(--charcoal)', margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

/** Opened from the Realms hub's "?" button, for the hub itself — a fork, not
 * a step, so both paths are shown at once, but as two sections
 * (HubSection) inside one ordinary tour card rather than as separate
 * popups — chest section first, logbook section under it. Neither has an
 * action button (past versions did): the real chest/logbook icon on the
 * spotlighted card is what the user is meant to click, staying live
 * throughout via `.tour-highlight`'s `pointer-events: auto` (and, for a
 * guest, the logbook icon is unlocked just for this tour — see
 * RealmsHub.jsx/RealmsTab.jsx). Docked directly under the spotlighted realm
 * card via `targetRef`, same useTourCardPosition docking every other tour
 * card in this file uses. A section disappears the moment that path's been
 * visited (`showChest`/`showBook`, driven by tourVisited* in
 * RealmsTab.jsx); once both are gone the tour closes itself entirely. A
 * third way into the same chained Profile tour exists too — a card docked
 * by the Profile tab itself (see ProfileTabTourCard below), not a section
 * in this one. */
export function RealmHubTourCards({ showChest, showBook, onClose, targetRef }) {
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          // Narrower than the other tour cards' 300px — this one lost its
          // action buttons (see HubSection). Same min() responsive cap as
          // every other tour card (see CreateRealmTourModal's comment).
          maxWidth: 'min(240px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        {showChest && (
          <HubSection text="Open the Chest to set up a game." />
        )}
        {showBook && (
          <HubSection text="Open the Logbook to view history." divider={showChest} />
        )}
      </div>
    </div>
  );
}

/** Opened during the Realms tour (any stage — hub, or forked into the chest
 * or book path) — points at the Profile tab itself, docked beside it with
 * the same arrow-and-card look every other tour card in this file uses
 * (`useTourCardPosition`), since the tab lives outside RealmsTab entirely
 * (see App.jsx). Purely informational, no action button: clicking the real
 * Profile tab is what ends the Realms tour and hands off into Profile's own
 * tour (see App.jsx's handleTabChange) — matching how the chest/logbook
 * icons themselves, not a button, drive those legs. */
export function ProfileTabTourCard({ onClose, targetRef }) {
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          maxWidth: 'min(240px, calc(100vw - 2rem))',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.85rem, 2vw, 0.95rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          Click this tab to view your profile.
        </p>
      </div>
    </div>
  );
}
