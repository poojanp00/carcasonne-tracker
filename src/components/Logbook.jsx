import { useState } from 'react';
import Lightbox from './Lightbox';

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default function GameHistory({ games, realms = [], currentRealm = null, onRealmChange, onDelete, isGuest = false }) {
  const [selectedGame,    setSelectedGame]    = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const realmGames = currentRealm
    ? games.filter(g => g.realmId === currentRealm.id)
    : [];

  const handleConfirmDelete = () => {
    onDelete(confirmDeleteId);
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
        />
      )}

      <div className="section-title">
        <h2>Logbook</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{realmGames.length} {realmGames.length === 1 ? 'game' : 'games'}</span>}
      </div>

      {/* Guest mode - show blank state */}
      {isGuest ? (
        <div className="empty-state">
          <span className="empty-state-icon">📜</span>
          Sign in to access your game logbook and save your progress.
        </div>
      ) : (
        <>
          {/* Realm filter chips */}
      {realms.length > 0 && (
        <div style={{ marginBottom: '1.3rem' }}>
          <div className="expansion-chips">
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
          <span className="empty-state-icon">📜</span>
          Select a realm above to view its game history.
        </div>
      ) : realmGames.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📜</span>
          No games recorded for this realm yet.
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Winner</th>
                <th>Margin</th>
                <th />
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

                    <td className="cell-margin">{topPlayers.length === 1 ? `+${margin}` : '—'}</td>

                    <td>
                      <button
                        className="realm-trash-btn"
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(game.id); }}
                        title="Remove game"
                      >
                        <TrashIcon />
                      </button>
                    </td>
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
