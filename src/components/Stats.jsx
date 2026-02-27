// ─── Stats / Standings ────────────────────────────────────────────────────────

function calcStats(games, name) {
  const low = name.toLowerCase();
  const mine = games.filter(
    (g) => g.player1.name.toLowerCase() === low || g.player2.name.toLowerCase() === low
  );

  let wins = 0, losses = 0, ties = 0, highScore = 0;

  for (const g of mine) {
    const isP1   = g.player1.name.toLowerCase() === low;
    const my     = isP1 ? g.player1.score : g.player2.score;
    const their  = isP1 ? g.player2.score : g.player1.score;

    if (my > their)       wins++;
    else if (my < their)  losses++;
    else                  ties++;

    if (my > highScore) highScore = my;
  }

  const total   = mine.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return { wins, losses, ties, winRate, highScore, total };
}

function WinRateBadge({ rate }) {
  const cls = rate >= 60 ? 'badge-high' : rate >= 40 ? 'badge-mid' : 'badge-low';
  return <span className={`win-rate-badge ${cls}`}>{rate}%</span>;
}

function PlayerCard({ name, stats, colorClass, isLeader }) {
  return (
    <div className={`player-card ${colorClass}`}>
      {isLeader && <span className="card-crown" title="Current leader">👑</span>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
        {isLeader && <div className="leader-banner" style={{ margin: 0 }}>Leading the realm</div>}
      </div>

      <div className="stat-row">
        <span className="stat-label">Victories</span>
        <span className="stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Defeats</span>
        <span className="stat-value" style={{ color: 'var(--deep-red)' }}>{stats.losses}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Stalemates</span>
        <span className="stat-value">{stats.ties}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Games played</span>
        <span className="stat-value">{stats.total}</span>
      </div>

      <div className="stat-divider" />

      <div className="stat-row">
        <span className="stat-label">Win rate</span>
        <WinRateBadge rate={stats.winRate} />
      </div>
      <div className="stat-row">
        <span className="stat-label">High score</span>
        <span className="stat-value">{stats.highScore}</span>
      </div>

    </div>
  );
}

export default function Stats({ games }) {
  if (games.length === 0) {
    return (
      <div>
        <div className="section-title">
          <h2>Standings</h2>
          <div className="section-title-line" />
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">🏰</span>
          No battles recorded yet. Log your first game to see standings.
        </div>
      </div>
    );
  }

  // Deduplicate case-insensitively, keeping first-seen capitalization
  const seenLower = new Map();
  games.flatMap((g) => [g.player1.name, g.player2.name]).forEach((n) => {
    if (!seenLower.has(n.toLowerCase())) seenLower.set(n.toLowerCase(), n);
  });
  const names = [...seenLower.values()];
  const allStats = names.map((name) => ({ name, ...calcStats(games, name) }));

  // Leader = most wins; tie-break on fewest losses
  const sorted = [...allStats].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const leader = sorted[0]?.name;

  const colors = ['p1', 'p2', 'p1', 'p2'];

  return (
    <div>
      <div className="section-title">
        <h2>Standings</h2>
        <div className="section-title-line" />
        <span className="game-count">{games.length} {games.length === 1 ? 'game' : 'games'}</span>
      </div>

      <div className="stats-grid">
        {allStats.map((ps, i) => (
          <PlayerCard
            key={ps.name}
            name={ps.name}
            stats={ps}
            colorClass={colors[i % colors.length]}
            isLeader={ps.name === leader}
          />
        ))}
      </div>
    </div>
  );
}
