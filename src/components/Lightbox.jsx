import { useEffect, useState } from 'react';
import pigImg from '../../images/icons/pig.png';
import cImg   from '../../images/icons/C.png';

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function Lightbox({ game, games = [], onNavigate, onClose }) {
  const idx = games.findIndex(g => g.id === game.id);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ') { onClose(); return; }
      if (e.key === 'ArrowDown' && idx < games.length - 1) {
        setAnimDir('down'); setAnimKey(k => k + 1); onNavigate(games[idx + 1]);
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        setAnimDir('up'); setAnimKey(k => k + 1); onNavigate(games[idx - 1]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, idx, games]);

  const topPlayers = game.winners || [];  // Use precomputed winners from database
  const winnerText = topPlayers.length === 0 
    ? 'No winner' 
    : topPlayers.length > 1 
    ? `${topPlayers.join(' & ')} win` 
    : `${topPlayers[0]} wins`;

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const TYPE_ORDER = ['road', 'city', 'monastery', 'field'];
  const margin = topPlayers.length === 1 && sorted.length > 1 ? sorted[0].score - sorted[1].score : null;
  const s1 = sorted[0]?.score ?? 0, s2 = sorted[1]?.score ?? 0;
  const isClutch = topPlayers.length === 1 && (s1 + s2) > 0 && (s1 - s2) / (s1 + s2) < 0.10;

  const slideClass = animDir === 'down' ? 'lb-slide-down' : animDir === 'up' ? 'lb-slide-up' : '';

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <div key={animKey} className={`lightbox-meta ${slideClass}`}>
          <p style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
            {formatDate(game.date)}
          </p>

          <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--earth-brown)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {winnerText}
            {isClutch && (
              <span className="val-info-wrap">
                <img src={cImg} alt="clutch" style={{ height: 20, width: 'auto', opacity: 0.85 }} />
                <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Clutch win</span>
              </span>
            )}
            {game.farmWin && topPlayers.length === 1 && (
              <span className="val-info-wrap">
                <img src={pigImg} alt="farm win" style={{ height: 14, width: 'auto', opacity: 0.85 }} />
                <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Farm win</span>
              </span>
            )}
          </h3>

          {margin !== null && (
            <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--stone-gray)', marginBottom: '1rem' }}>
              +{margin} point margin
            </p>
          )}

          {/* Player scores */}
          <div style={{ marginBottom: '1.2rem' }}>
            {sorted.map((p, i) => {
              const bd = p.breakdown || {};
              const bdEntries = [
                ...TYPE_ORDER.filter(t => (bd[t] ?? 0) > 0),
                ...Object.keys(bd).filter(t => !TYPE_ORDER.includes(t) && (bd[t] ?? 0) > 0),
              ].sort((a, b) => (bd[b] || 0) - (bd[a] || 0));
              const isWinner = topPlayers.includes(p.name);
              return (
                <div
                  key={p.name}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: i < sorted.length - 1 ? '1px solid rgba(201,163,74,0.25)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '0.95rem',
                      fontWeight: isWinner ? 700 : 400,
                      color: isWinner ? 'var(--forest-green)' : 'var(--charcoal)',
                    }}>
                      {p.name}
                    </span>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '1.05rem',
                      fontWeight: isWinner ? 700 : 400,
                      color: isWinner ? 'var(--forest-green)' : 'var(--stone-gray)',
                    }}>
                      {p.score}
                    </span>
                  </div>
                  {bdEntries.length > 0 && (
                    <p style={{
                      fontFamily: 'Crimson Text, serif',
                      fontStyle: 'italic',
                      fontSize: '0.82rem',
                      color: 'var(--stone-gray)',
                      margin: '0.15rem 0 0',
                      letterSpacing: '0.01em',
                    }}>
                      {bdEntries.map(t => `${bd[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`).join(' · ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expansions */}
          {game.expansions.length > 0 ? (
            <div className="expansion-chips" style={{ marginBottom: '1.2rem' }}>
              {game.expansions.map(exp => (
                <span key={exp} className="expansion-chip display-only">{exp}</span>
              ))}
            </div>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.9rem', display: 'block', marginBottom: '1.2rem' }}>
              Base game — no expansions
            </span>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ color: 'var(--deep-red)', borderColor: 'var(--deep-red)' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
