import { useState, useEffect } from 'react';
import Lightbox from './Lightbox';
import { formatDate } from '../utils/formatters';

export default function GameHistory({ games, realms = [], currentRealm = null, onRealmChange, onDelete, isGuest = false, showDemoData = false, onToggleDemoData = null, openGame = null, onOpenGameClear }) {
  const [selectedGame,    setSelectedGame]    = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (openGame) {
      setSelectedGame(openGame);
      onOpenGameClear?.();
    }
  }, [openGame]);

  useEffect(() => {
    const isOpen = !!confirmDeleteId || !!selectedGame;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDeleteId, selectedGame]);

  const realmGames = currentRealm
    ? games.filter(g => g.realmId === currentRealm.id)
    : [];

  const handleConfirmDelete = async () => {
    await onDelete(confirmDeleteId);
    setConfirmDeleteId(null);
    setSelectedGame(null);
  };

  return (
    <div>
      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="realm-modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Remove this game?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently remove the game from the logbook. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedGame && (
        <Lightbox
          game={selectedGame}
          games={realmGames}
          onNavigate={setSelectedGame}
          onClose={() => setSelectedGame(null)}
          onDeleteRequest={isGuest && showDemoData ? null : () => setConfirmDeleteId(selectedGame.id)}
        />
      )}

      <div className="section-title">
        <h2>Logbook</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{realmGames.length} {realmGames.length === 1 ? 'game' : 'games'}</span>}
        {onToggleDemoData && (
          <button type="button" className={`expansion-chip${showDemoData ? ' selected' : ''}`} onClick={onToggleDemoData} style={{ fontSize: 'clamp(0.55rem, 1.8vw, 0.72rem)', marginLeft: '0.5rem' }}>
            {showDemoData ? '✦ Demo · click to exit' : 'Demo'}
          </button>
        )}
      </div>

      {isGuest && !showDemoData ? (
        <div className="empty-state">
          Sign in to access logbook and save your progress.
        </div>
      ) : (
        <>
          {/* Realm filter chips */}
      {realms.length > 0 && (
        <div style={{ marginBottom: '1.3rem' }}>
          <div className="expansion-chips-carousel">
            {realms.map(r => (
              <button
                key={r.id}
                type="button"
                className={`expansion-chip ${currentRealm?.id === r.id ? 'selected' : ''}`}
                onClick={() => onRealmChange(r)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!currentRealm ? (
        <div className="empty-state">
          Select a group to view its game history.
        </div>
      ) : realmGames.length === 0 ? (
        <div className="empty-state">
          No games recorded for this group yet.
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Winner</th>
                <th>Score</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {realmGames.map(game => {
                const scores     = game.players.map(p => p.score).sort((a, b) => b - a);
                const maxScore   = scores[0] ?? 0;
                const topPlayers = game.winners || [];  // Use precomputed winners from database
                const winner     = topPlayers.length === 1 ? game.players.find(p => topPlayers.includes(p.name)) : null;
                const margin     = topPlayers.length === 1 ? maxScore - (scores[1] ?? 0) : 0;
                return (
                  <tr key={game.id} onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <td className="cell-date">{formatDate(game.date)}</td>

                    <td style={{
                      fontWeight: 600,
                      color:      'var(--forest-green)',
                      fontStyle:  'normal',
                      whiteSpace: 'nowrap',
                    }}>
                      {topPlayers.length > 1 ? topPlayers.join(' & ') : winner?.name}
                    </td>

                    <td style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>
                      {topPlayers.length > 0 ? maxScore : '—'}
                    </td>

                    <td className="cell-margin">{topPlayers.length === 1 ? `+${margin}` : '—'}</td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}
