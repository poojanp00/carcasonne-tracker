import { useRef } from 'react';
import { useTourCardPosition } from '../hooks/useTourCardPosition';

const STEPS = [
  '**Set up the game** at your table.',
  '**Play Carcassonne** as usual.',
  '**Record scores** here as features are completed.',
  '**Enter Final Scoring** after the last tile is placed.',
  'Complete scoring and **click Finish Game**.',
];

// Realm creation is its own short, linear (non-forking) tour — separate from
// the Realms hub's loop above since it only ever runs on the two
// create-realm sub-steps in PreGameSetup.jsx.
const CREATE_REALM_TOUR_STAGES = [
  { title: 'Create New Realm', text: 'Name your realm and the players.' },
  { title: 'Chest & Logbook', text: 'Chests store game pieces while logbooks record game history.' },
];

// The hub itself isn't part of this linear stage list at all — it's a fork
// (chest → play flow, logbook → history book), shown as two independent
// popups at once rather than a stage in a sequence (see RealmHubTourCards
// below). Mode Selection isn't a stage here either, and Meeples is no
// longer its own stage — it's merged into Players (see PreGameSetup.jsx).
const PLAY_PATH_STAGES = [
  { key: 'players',    title: 'Players',    text: 'Each player picks their game piece. ' },
  { key: 'expansions', title: 'Expansions', text: 'Choose expansions that are in play.' },
  { key: 'begin',      title: 'Begin',      text: 'Click Begin when you\'re ready to start the game.' },
];
const BOOK_PATH_STAGES = [
  { key: 'overview', title: 'Overview', text: 'The logbook contains the realm\'s overall statistics.' },
  { key: 'roster',   title: 'Roster',   text: 'Player stats are stored here. Tap a player\'s card to view their trophies.' },
  { key: 'gamelog',  title: 'Game log', text: 'Explore match history. Click an entry to inspect its data.' },
];
const REALM_TOUR_STAGES = [...PLAY_PATH_STAGES, ...BOOK_PATH_STAGES];

const PROFILE_STEPS = [
  { title: 'Character Card', text: 'View your profile, rank, and overall progress. Ranking up unlocks new in-game content.' },
  { title: 'Milestones', text: 'Complete milestone tiers to increase your rank and unlock rewards.' },
  { title: 'Career Highlights', text: 'Browse your achievements, records, and memorable victories.' },
  { title: 'Trophy Cabinet', text: 'View the hardware you\'ve earned throughout your journey.' },
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
 * name/roster blocks the tour there instead of waving it through. "Got it!"
 * on the last stage just closes the tour and leaves the user right there on
 * chest/logbook to pick for real. `targetRef` docks the card beside the
 * matching form section, same as the Realms tour (see useTourCardPosition). */
export function CreateRealmTourModal({ stage, onNext, onBack, onClose, targetRef = null }) {
  const isLast = stage === CREATE_REALM_TOUR_STAGES.length - 1;
  const current = CREATE_REALM_TOUR_STAGES[stage];
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        onClick={onNext}
        style={{
          maxWidth: '340px',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={e => { e.stopPropagation(); onClose(); }} title="Close tour" aria-label="Close tour" />
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>{current.title}</h3>
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(current.text)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: stage === 0 ? 'flex-end' : 'space-between', gap: '0.8rem', marginTop: '1.2rem' }}>
          {stage > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onBack(); }}>‹ Back</button>}
          {isLast
            ? <button type="button" className="btn btn-sm">Got it!</button>
            : <button type="button" className="btn btn-sm">Next ›</button>}
        </div>
        <div className="tour-dots" style={{ justifyContent: 'center', marginTop: '0.7rem' }}>
          {CREATE_REALM_TOUR_STAGES.map((s, i) => (
            <span key={s.title} className={`tour-dot${i === stage ? ' active' : ''}`} />
          ))}
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
 * wherever the user is, Back/Next on one row with centered dots below, and
 * the card docked beside whatever's spotlighted via `targetRef` (see
 * useTourCardPosition) rather than a fixed screen position. Everything
 * outside the spotlighted section is inert while this is open (see the
 * `.tour-inert` wrapper in Profile.jsx) — only the highlighted content
 * itself (milestone carousel arrows, career-highlight game links, etc.)
 * stays live. */
export function ProfileHowToModal({ step, onNext, onBack, onClose, targetRef = null }) {
  const isLastStep = step === PROFILE_STEPS.length - 1;
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        onClick={onNext}
        style={{
          maxWidth: '340px',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={e => { e.stopPropagation(); onClose(); }} title="Close tour" aria-label="Close tour" />
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>{PROFILE_STEPS[step].title}</h3>
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(PROFILE_STEPS[step].text)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: step === 0 ? 'flex-end' : 'space-between', gap: '0.8rem', marginTop: '1.2rem' }}>
          {step > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onBack(); }}>‹ Back</button>}
          {isLastStep
            ? <button type="button" className="btn btn-sm">Got it!</button>
            : <button type="button" className="btn btn-sm">Next ›</button>}
        </div>
        <div className="tour-dots" style={{ justifyContent: 'center', marginTop: '0.7rem' }}>
          {PROFILE_STEPS.map((s, i) => (
            <span key={s.title} className={`tour-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Opened from the Realms hub's "?" button, for every stage *except* the hub
 * itself (see RealmHubTourCards below for that one) — Players/Expansions/
 * Begin on the play path, Overview/Roster/Game log on the book path. Each
 * path loops back to the hub afterward, but within a path it's a straight
 * line: "Next" (or clicking the card) drives it one step at a time, "Back"
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
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        onClick={onNext}
        style={{
          maxWidth: '340px',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={e => { e.stopPropagation(); onClose(); }} title="Close tour" aria-label="Close tour" />
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>{current.title}</h3>
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)', margin: 0 }}>
          {renderStep(current.text)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onBack(); }}>‹ Back</button>
          <button type="button" className="btn btn-sm">Next ›</button>
        </div>
        {path && (
          <div className="tour-dots" style={{ justifyContent: 'center', marginTop: '0.7rem' }}>
            {path.map((s, i) => (
              <span key={s.key} className={`tour-dot${i === pathIndex ? ' active' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One row within RealmHubTourCards below: a heading, then its
 * description and action button side by side on one line (rather than
 * text-above-button like every other tour card in this file — with two of
 * these stacked in one popup, a full extra line per section for the button
 * made the whole thing needlessly tall). */
function HubSection({ title, text, actionLabel, onAction, divider = false }) {
  return (
    <div className={divider ? 'tour-hub-section tour-hub-section-divider' : 'tour-hub-section'}>
      <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.5rem' }}>{title}</h3>
      <div className="tour-hub-row">
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.88rem, 2.1vw, 1rem)', lineHeight: 1.4, color: 'var(--charcoal)', margin: 0 }}>
          {text}
        </p>
        <button type="button" className="btn btn-sm" onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  );
}

/** Opened from the Realms hub's "?" button, for the hub itself — a fork, not
 * a step, so both paths are shown at once, but as two sections
 * (HubSection) inside one ordinary tour card rather than as separate
 * popups — chest section first, logbook section under it, each with its
 * own action button that picks that path the same way a real click on the
 * chest/logbook icon does (both stay live throughout via
 * `.tour-highlight`'s `pointer-events: auto` on the whole spotlighted
 * card, see RealmsHub.jsx). Docked directly under the spotlighted realm
 * card via `targetRef`, same useTourCardPosition docking every other tour
 * card in this file uses — no custom positioning of its own, so it can't
 * spill off-screen any differently than any other tour card already
 * doesn't. A section disappears the moment that path's been visited
 * (`showChest`/`showBook`, driven by tourVisited* in RealmsTab.jsx); once
 * both are gone the tour closes itself entirely. */
export function RealmHubTourCards({ showChest, showBook, onChestAction, onBookAction, onClose, targetRef }) {
  const cardRef = useRef(null);
  const { style: posStyle, arrowLeft } = useTourCardPosition(targetRef, cardRef, true);
  return (
    <div className="tour-overlay">
      <div
        ref={cardRef}
        className="realm-modal tile-card tour-card"
        style={{
          maxWidth: '360px',
          ...(posStyle || {}),
          ...(arrowLeft != null ? { '--tour-arrow-left': `${arrowLeft}px` } : {}),
        }}
      >
        <button type="button" className="tour-close-btn" onClick={onClose} title="Close tour" aria-label="Close tour" />
        {showChest && (
          <HubSection title="Chest" text="Click the chest to set up a game." actionLabel="Chest" onAction={onChestAction} />
        )}
        {showBook && (
          <HubSection title="Logbook" text="Click the logbook to view its history." actionLabel="Logbook" onAction={onBookAction} divider={showChest} />
        )}
      </div>
    </div>
  );
}
