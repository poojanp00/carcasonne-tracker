import { useEffect } from 'react';

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function Lightbox({ game, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p1Wins = game.player1.score > game.player2.score;
  const p2Wins = game.player2.score > game.player1.score;
  const isTie  = !p1Wins && !p2Wins;
  const winner = isTie ? 'Tied' : `${(p1Wins ? game.player1 : game.player2).name} victorious`;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>

        {game.photo && (
          <img src={game.photo} alt="Game photo" className="lightbox-photo" />
        )}

        <div className="lightbox-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--earth-brown)', marginBottom: '0.2rem' }}>
                {game.player1.name} vs {game.player2.name}
              </h3>
              <p style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
                {formatDate(game.date)}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="lb-scores">
                <span style={{ color: p1Wins ? 'var(--forest-green)' : p2Wins ? 'var(--deep-red)' : 'var(--charcoal)' }}>
                  {game.player1.score}
                </span>
                <span style={{ color: 'var(--stone-gray)', fontSize: '1.3rem', margin: '0 0.25rem' }}>—</span>
                <span style={{ color: p2Wins ? 'var(--forest-green)' : p1Wins ? 'var(--deep-red)' : 'var(--charcoal)' }}>
                  {game.player2.score}
                </span>
              </div>
              <div className="lb-winner-tag">{winner}</div>
            </div>
          </div>

          {game.expansions.length > 0 ? (
            <div className="expansion-chips">
              {game.expansions.map((exp) => (
                <span key={exp} className="expansion-chip display-only">{exp}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem' }}>
              Base game — no expansions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
