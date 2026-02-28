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

  const maxScore   = Math.max(...game.players.map(p => p.score));
  const topPlayers = game.players.filter(p => p.score === maxScore);
  const isTie      = topPlayers.length > 1;
  const winnerText = isTie ? 'Tied' : `${topPlayers[0].name} victorious`;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>

        {game.photo && (
          <img src={game.photo} alt="Game photo" className="lightbox-photo" />
        )}

        <div className="lightbox-meta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--earth-brown)', marginBottom: '0.2rem' }}>
                {game.players.map(p => p.name).join(' vs ')}
              </h3>
              <p style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
                {formatDate(game.date)}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="lb-scores">
                {game.players.map((p, i) => (
                  <span key={p.name} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.2rem' }}>
                    {i > 0 && <span style={{ color: 'var(--stone-gray)', margin: '0 0.3rem', fontSize: '1.2rem' }}>—</span>}
                    <span style={{ color: p.score === maxScore ? 'var(--forest-green)' : 'var(--deep-red)' }}>
                      {p.score}
                    </span>
                  </span>
                ))}
              </div>
              <div className="lb-winner-tag">{winnerText}</div>
            </div>
          </div>

          {game.expansions.length > 0 ? (
            <div className="expansion-chips">
              {game.expansions.map(exp => (
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
