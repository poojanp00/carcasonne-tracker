const STEPS = [
  'Set up the game at your table.',
  'Start playing!',
  'Track all scoring events live on Carcasscore.',
  'Enter Final Scoring once the final tile is placed.',
  'Complete scoring and end the game to see results.',
];

/** Inner how-to content shared by the guest pre-game page and the board's "?" modal. */
export function HowToContent() {
  return (
    <>
      <ol style={{ margin: 0, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {STEPS.map(step => (
          <li key={step} style={{ fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.92rem, 2.2vw, 1.05rem)', lineHeight: 1.5, color: 'var(--charcoal)' }}>
            {step}
          </li>
        ))}
      </ol>
      <p style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 1.8vw, 0.75rem)', letterSpacing: '0.08em', color: 'var(--stone-gray)', marginTop: '1.2rem', marginBottom: 0 }}>
        BEST VIEWED ON LARGE SCREENS
      </p>
    </>
  );
}

/** Modal version, opened from the board's "?" button. */
export default function HowToModal({ onClose }) {
  return (
    <div className="realm-modal-overlay" onClick={onClose}>
      <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>How It Works</h3>
        <HowToContent />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button className="btn btn-sm" onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
}
