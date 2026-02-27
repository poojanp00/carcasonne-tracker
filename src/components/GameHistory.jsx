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
  const [lightbox, setLightbox] = useState(null);

  // Individual expansions that appear in at least one game
  const usedExpansions = [...new Set(games.flatMap((g) => g.expansions))].sort();

  const toggleFilter = (exp) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(exp) ? next.delete(exp) : next.add(exp);
      return next;
    });
  };

  // Games must include ALL selected expansions
  const filtered = activeFilters.size === 0
    ? games
    : games.filter((g) => [...activeFilters].every((exp) => g.expansions.includes(exp)));

  // Summary for current filtered set
  const summary = (() => {
    if (filtered.length === 0) return null;
    const wins = {};
    let netDiff = 0; // cumulative (player1.score - player2.score) across all games
    for (const g of filtered) {
      const p1w = g.player1.score > g.player2.score;
      const p2w = g.player2.score > g.player1.score;
      if (p1w) wins[g.player1.name] = (wins[g.player1.name] || 0) + 1;
      if (p2w) wins[g.player2.name] = (wins[g.player2.name] || 0) + 1;
      netDiff += g.player1.score - g.player2.score;
    }
    const entries = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    const [name1, w1] = entries[0] || [];
    const [, w2]      = entries[1] || [];
    const winsAreTied = !name1 || (w2 && w1 === w2);
    const leadText = !name1
      ? 'No decisive victories yet'
      : !w2 || w1 > w2
        ? `${name1} leads ${w1}–${w2 ?? 0}`
        : `Tied ${w1}–${w2}`;
    // Point diff: positive favours player1, negative favours player2
    const diffLeader = netDiff > 0 ? filtered[0].player1.name : filtered[0].player2.name;
    const diffText = netDiff === 0
      ? 'even pt diff'
      : winsAreTied
        ? `${diffLeader} +${Math.abs(netDiff)} pt diff`
        : `+${Math.abs(netDiff)} pt diff`;
    return { leadText, diffText };
  })();

  return (
    <div>
      <div className="section-title">
        <h2>Chronicle</h2>
        <div className="section-title-line" />
        <span className="game-count">{filtered.length} {filtered.length === 1 ? 'game' : 'games'}</span>
      </div>

      {usedExpansions.length > 0 && (
        <div style={{ marginBottom: '1.3rem' }}>
          <div className="filter-label" style={{ marginBottom: '0.5rem' }}>
            Filter by expansion{activeFilters.size > 0 ? ` — showing games with all ${activeFilters.size} selected` : ':'}
          </div>
          <div className="expansion-chips">
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
            {activeFilters.size > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setActiveFilters(new Set())}
                style={{ marginLeft: '0.25rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {summary && (
        <div style={{
          fontFamily: 'Crimson Text, serif',
          fontStyle: 'italic',
          fontSize: '1rem',
          color: 'var(--earth-brown)',
          marginBottom: '0.9rem',
          paddingLeft: '0.2rem',
          display: 'flex',
          gap: '1.2rem',
          flexWrap: 'wrap',
        }}>
          <span>{summary.leadText}</span>
          <span style={{ color: 'var(--stone-gray)' }}>·</span>
          <span>{summary.diffText}</span>
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
                <th>Player I</th>
                <th className="cell-score" style={{ textAlign: 'center' }}>Score</th>
                <th className="cell-vs" style={{ textAlign: 'center' }}>—</th>
                <th className="cell-score" style={{ textAlign: 'center' }}>Score</th>
                <th>Player II</th>
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

                    {/* Player 1 */}
                    <td className={p1Wins ? 'cell-winner' : isTie ? 'cell-tie' : 'cell-loser'}>
                      {game.player1.name}
                    </td>

                    {/* Score 1 */}
                    <td className="cell-score">{game.player1.score}</td>

                    {/* vs */}
                    <td className="cell-vs">vs</td>

                    {/* Score 2 */}
                    <td className="cell-score">{game.player2.score}</td>

                    {/* Player 2 */}
                    <td className={p2Wins ? 'cell-winner' : isTie ? 'cell-tie' : 'cell-loser'}>
                      {game.player2.name}
                    </td>

                    {/* Winner */}
                    <td style={{
                      fontWeight: 600,
                      color: isTie ? 'var(--mustard)' : 'var(--forest-green)',
                      fontStyle: isTie ? 'italic' : 'normal',
                      whiteSpace: 'nowrap',
                    }}>
                      {isTie ? 'Tie' : p1Wins ? game.player1.name : game.player2.name}
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
