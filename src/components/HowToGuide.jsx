const STEPS = [
  '**Set up the game** at your table.',
  '**Play Carcassonne** as usual.',
  '**Record scores** here as features are completed.',
  '**Enter Final Scoring** after the last tile is placed.',
  'Complete scoring and **click Finish Game**.',
];

const PLAY_STEPS = [
  'Create a realm.',
  'Choose a play mode',
  'Select each player\'s meeple color.',
  'Choose your expansions.',
  'Click Begin!',
];

/** Renders **markers** in a step as bold text. */
function renderStep(step) {
  return step.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

function StepList({ steps }) {
  return (
    <ol style={{ margin: 0, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      {steps.map(step => (
        <li key={step} style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)' }}>
          {renderStep(step)}
        </li>
      ))}
    </ol>
  );
}

/** Guest-only modal shown each time a guest lands on the play tab: how to get a game started. */
export function HowToPlayModal({ onClose }) {
  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>Getting Started</h3>
        <StepList steps={PLAY_STEPS} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '1.2rem' }}>
          <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 1.8vw, 0.75rem)', letterSpacing: '0.08em', color: 'var(--stone-gray)', margin: 0 }}>
            PHYSICAL GAME NEEDED TO PLAY
          </p>
          <button className="btn btn-sm" onClick={onClose}>Got it!</button>
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
