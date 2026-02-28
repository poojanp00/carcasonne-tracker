import { useState } from 'react';
import Lightbox from './Lightbox';

function comboLabel(expansions) {
  return expansions.length === 0 ? 'Base game' : [...expansions].sort().join(' + ');
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function GameHistory({ games, onDelete }) {
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [baseFilter, setBaseFilter] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Individual expansions that appear in at least one game
  const usedExpansions = [...new Set(games.flatMap((g) => g.expansions))].sort();
  const hasBaseGames   = games.some((g) => g.expansions.length === 0);

  const toggleFilter = (exp) => {
    setBaseFilter(false); // expansion filter clears base filter
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(exp) ? next.delete(exp) : next.add(exp);
      return next;
    });
  };

  const toggleBaseFilter = () => {
    setActiveFilters(new Set()); // base filter clears expansion filters
    setBaseFilter((v) => !v);
  };

  const clearAll = () => { setActiveFilters(new Set()); setBaseFilter(false); };

  // Filter logic: base-only OR must include ALL selected expansions
  const filtered = baseFilter
    ? games.filter((g) => g.expansions.length === 0)
    : activeFilters.size === 0
      ? games
      : games.filter((g) => [...activeFilters].every((exp) => g.expansions.includes(exp)));


  return (
    <div>
      <div className="section-title">
        <h2>Logbook</h2>
        <div className="section-title-line" />
        <span className="game-count">{filtered.length} {filtered.length === 1 ? 'game' : 'games'}</span>
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
            {usedExpansions.map((exp) => (
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
          {games.length === 0
            ? 'No battles have been recorded yet.'
            : 'No games match this filter.'}
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Date</th>
                <th className="cell-score" style={{ textAlign: 'center' }}>Poojan</th>
                <th className="cell-vs" style={{ textAlign: 'center' }}>—</th>
                <th className="cell-score" style={{ textAlign: 'center' }}>Diya</th>
                <th>Winner</th>
                <th>Margin</th>
                <th>Expansions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((game) => {
                const p1Wins = game.player1.score > game.player2.score;
                const p2Wins = game.player2.score > game.player1.score;
                const isTie  = !p1Wins && !p2Wins;
                const margin = Math.abs(game.player1.score - game.player2.score);

                return (
                  <tr key={game.id}>
                    {/* Photo */}
                    <td>
                      {game.photo ? (
                        <img
                          src={game.photo}
                          alt="Game"
                          className="photo-thumb"
                          onClick={() => setLightbox(game)}
                          title="Click to enlarge"
                        />
                      ) : (
                        <div className="no-photo" title="No photo">—</div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="cell-date">{formatDate(game.date)}</td>

                    {/* Score 1 */}
                    <td className="cell-score">{game.player1.score}</td>

                    {/* vs */}
                    <td className="cell-vs">vs</td>

                    {/* Score 2 */}
                    <td className="cell-score">{game.player2.score}</td>

                    {/* Winner */}
                    <td style={{
                      fontWeight: 600,
                      color: isTie ? 'var(--mustard)' : 'var(--forest-green)',
                      fontStyle: isTie ? 'italic' : 'normal',
                      whiteSpace: 'nowrap',
                    }}>
                      {isTie ? 'Tie' : p1Wins ? game.player1.name : game.player2.name}
                      {game.farmWin && !isTie && (
                        <span title="Won via farm" style={{ marginLeft: '0.35rem', fontSize: '0.75rem', opacity: 0.75 }}>🌾</span>
                      )}
                    </td>

                    {/* Margin */}
                    <td className="cell-margin">+{margin}</td>

                    {/* Expansions */}
                    <td>
                      {game.expansions.length === 0 ? (
                        <span style={{ fontSize: '0.82rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
                          Base
                        </span>
                      ) : (
                        <div className="expansion-chips" style={{ flexWrap: 'nowrap', gap: '0.25rem', minWidth: '120px' }}>
                          {game.expansions.map((exp) => (
                            <span key={exp} className="expansion-chip display-only">{exp}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Delete */}
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(game.id)}
                        title="Remove game"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lightbox && (
        <Lightbox game={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
