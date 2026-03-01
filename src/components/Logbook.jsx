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

export default function GameHistory({ games, onDelete, noRealm = false }) {
  const [activeFilters,   setActiveFilters]   = useState(new Set());
  const [baseFilter,      setBaseFilter]      = useState(false);
  const [selectedGame,    setSelectedGame]    = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const usedExpansions = [...new Set(games.flatMap(g => g.expansions))].sort();
  const hasBaseGames   = games.some(g => g.expansions.length === 0);

  const toggleFilter = (exp) => {
    setBaseFilter(false);
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(exp) ? next.delete(exp) : next.add(exp);
      return next;
    });
  };

  const toggleBaseFilter = () => {
    setActiveFilters(new Set());
    setBaseFilter(v => !v);
  };

  const clearAll = () => { setActiveFilters(new Set()); setBaseFilter(false); };

  const filtered = baseFilter
    ? games.filter(g => g.expansions.length === 0)
    : activeFilters.size === 0
      ? games
      : games.filter(g => [...activeFilters].every(exp => g.expansions.includes(exp)));

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
          games={filtered}
          onNavigate={setSelectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}

      <div className="section-title">
        <h2>Logbook</h2>
        <div className="section-title-line" />
        {!noRealm && <span className="game-count">{filtered.length} {filtered.length === 1 ? 'game' : 'games'}</span>}
      </div>

      {(usedExpansions.length > 0 || hasBaseGames) && (
        <div style={{ marginBottom: '1.3rem' }}>
          <div className="filter-label" style={{ marginBottom: '0.5rem' }}>
            {baseFilter
              ? 'Showing base game only'
              : activeFilters.size > 0
                ? `Showing games with all ${activeFilters.size} selected`
                : 'Filter:'}
          </div>
          <div className="expansion-chips">
            {hasBaseGames && (
              <button
                type="button"
                className={`expansion-chip ${baseFilter ? 'selected' : ''}`}
                onClick={toggleBaseFilter}
              >
                Base game
              </button>
            )}
            {usedExpansions.map(exp => (
              <button
                key={exp}
                type="button"
                className={`expansion-chip ${activeFilters.has(exp) ? 'selected' : ''}`}
                onClick={() => toggleFilter(exp)}
              >
                {exp}
              </button>
            ))}
            {(activeFilters.size > 0 || baseFilter) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={clearAll}
                style={{ marginLeft: '0.25rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📜</span>
          {noRealm ? 'Load a realm to view game history.' : games.length === 0 ? 'No games have been recorded yet.' : 'No games match this filter.'}
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
              {filtered.map(game => {
                const scores     = game.players.map(p => p.score).sort((a, b) => b - a);
                const maxScore   = scores[0] ?? 0;
                const topPlayers = game.players.filter(p => p.score === maxScore);
                const isTie      = topPlayers.length > 1;
                const winner     = isTie ? null : topPlayers[0];
                const margin     = isTie ? 0 : maxScore - (scores[1] ?? 0);

                return (
                  <tr key={game.id} onClick={() => setSelectedGame(game)} style={{ cursor: 'pointer' }}>
                    <td className="cell-date">{formatDate(game.date)}</td>

                    <td style={{
                      fontWeight: 600,
                      color:      isTie ? 'var(--mustard)' : 'var(--forest-green)',
                      fontStyle:  isTie ? 'italic' : 'normal',
                      whiteSpace: 'nowrap',
                    }}>
                      {isTie ? 'Tie' : winner?.name}
                    </td>

                    <td className="cell-margin">{isTie ? '—' : `+${margin}`}</td>

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
    </div>
  );
}
