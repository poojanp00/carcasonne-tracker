// ─── Stats / Standings ────────────────────────────────────────────────────────

function calcStats(games, name) {
  const low = name.toLowerCase();
  const mine = games.filter(
    (g) => g.player1.name.toLowerCase() === low || g.player2.name.toLowerCase() === low
  );

  let wins = 0, losses = 0, ties = 0, highScore = 0, highScoreDate = null, farmWins = 0, netPtDiff = 0;
  let biggestBlowout = 0, biggestBlowoutDate = null, biggestBlowoutMyScore = 0, biggestBlowoutTheirScore = 0;
  let clutchWins = 0, clutchLosses = 0, clutchGames = 0;

  for (const g of mine) {
    const isP1   = g.player1.name.toLowerCase() === low;
    const my     = isP1 ? g.player1.score : g.player2.score;
    const their  = isP1 ? g.player2.score : g.player1.score;

    if (my > their) {
      wins++;
      const margin = my - their;
      if (margin > biggestBlowout) { biggestBlowout = margin; biggestBlowoutDate = g.date; biggestBlowoutMyScore = my; biggestBlowoutTheirScore = their; }
    } else if (my < their) {
      losses++;
    } else {
      ties++;
    }

    if (my > highScore) { highScore = my; highScoreDate = g.date; }
    netPtDiff += (my - their);

    if (g.farmWin && my > their) farmWins++;

    // Close game: margin < 5% of total points
    const total_pts = my + their;
    if (total_pts > 0 && Math.abs(my - their) / total_pts < 0.05) {
      clutchGames++;
      if (my > their)      clutchWins++;
      else if (my < their) clutchLosses++;
    }
  }

  const total        = mine.length;
  const winRate      = total > 0 ? Math.round((wins / total) * 100) : 0;
  const farmDominance  = wins > 0 ? Math.round((farmWins / wins) * 100) : null;
  const clutchFactor   = clutchGames > 0
    ? Math.round((clutchWins / clutchGames) * 100) / 100
    : null;

  // Current streak: walk forwards — games stored newest-first (index 0 = most recent)
  let winStreak = 0, lossStreak = 0;
  for (let i = 0; i < mine.length; i++) {
    const g    = mine[i];
    const isP1 = g.player1.name.toLowerCase() === low;
    const my   = isP1 ? g.player1.score : g.player2.score;
    const opp  = isP1 ? g.player2.score : g.player1.score;
    if (winStreak === 0 && lossStreak === 0) {
      if (my > opp)       winStreak = 1;
      else if (my < opp)  lossStreak = 1;
      else break; // tie breaks streak
    } else if (winStreak > 0) {
      if (my > opp) winStreak++;
      else break;
    } else {
      if (my < opp) lossStreak++;
      else break;
    }
  }

  return { wins, losses, ties, winRate, highScore, highScoreDate, total, winStreak, lossStreak, farmWins, farmDominance, biggestBlowout, biggestBlowoutDate, biggestBlowoutMyScore, biggestBlowoutTheirScore, clutchFactor, clutchGames, clutchWins, netPtDiff };
}

function StatInfo({ children }) {
  return (
    <span className="stat-info-wrap">
      <span className="stat-info-icon">ⓘ</span>
      <span className="stat-info-tooltip">{children}</span>
    </span>
  );
}

function ValInfo({ tip, children }) {
  return (
    <span className="val-info-wrap">
      {children}
      <span className="val-info-tooltip">{tip}</span>
    </span>
  );
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
        {stats.total > 0 && (
          <span style={{
            fontFamily: 'Crimson Text, serif',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            color: stats.netPtDiff > 0 ? 'var(--forest-green)' : stats.netPtDiff < 0 ? 'var(--deep-red)' : 'var(--stone-gray)',
            opacity: 0.85,
          }}>
            {stats.netPtDiff > 0 ? `+${stats.netPtDiff}` : stats.netPtDiff} pts
          </span>
        )}
        {isLeader && <div className="leader-banner" style={{ margin: 0 }}>Leading the realm</div>}
      </div>

      <div className="stat-row">
        <span className="stat-label">Victories <StatInfo>Total games won.</StatInfo></span>
        <span className="stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Defeats <StatInfo>Total games lost.</StatInfo></span>
        <span className="stat-value" style={{ color: 'var(--deep-red)' }}>{stats.losses}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Stalemates <StatInfo>Total games ending in a tie.</StatInfo></span>
        <span className="stat-value">{stats.ties}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Games played <StatInfo>Total games recorded.</StatInfo></span>
        <span className="stat-value">{stats.total}</span>
      </div>

      <div className="stat-divider" />

      <div className="stat-row">
        <span className="stat-label">Win rate <StatInfo>Share of games won.</StatInfo></span>
        <ValInfo tip={`${stats.wins} games won / ${stats.total} total games`}><WinRateBadge rate={stats.winRate} /></ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">High score <StatInfo>Highest single-game score achieved.</StatInfo></span>
        <ValInfo tip={stats.highScoreDate ? new Date(stats.highScoreDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null}>
          <span className="stat-value">{stats.highScore}</span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Streak <StatInfo>Consecutive wins or losses.</StatInfo></span>
        <span className="stat-value" style={{
          color: stats.winStreak > 0 ? 'var(--forest-green)' : stats.lossStreak > 0 ? 'var(--deep-red)' : 'inherit'
        }}>
          {stats.winStreak > 0 ? `W${stats.winStreak}` : stats.lossStreak > 0 ? `L${stats.lossStreak}` : '—'}
        </span>
      </div>
      <div className="stat-divider" />

      <div className="stat-row">
        <span className="stat-label">Farm dominance <StatInfo>How often your wins came via farm.</StatInfo></span>
        <ValInfo tip={stats.farmDominance !== null ? `${stats.farmWins} farm win / ${stats.wins} total wins` : null}>
          <span className="stat-value">
            {stats.farmDominance !== null ? `${stats.farmDominance}%` : '—'}
          </span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Clutch factor <StatInfo>Win rate in close games (margin &lt; 5% of total points).</StatInfo></span>
        <ValInfo tip={stats.clutchFactor !== null ? `${stats.clutchWins} wins / ${stats.clutchGames} clutch games` : null}>
          <span className="stat-value" style={{
            color: stats.clutchFactor !== null && stats.clutchFactor >= 0.6 ? 'var(--forest-green)' : stats.clutchFactor !== null && stats.clutchFactor <= 0.4 ? 'var(--deep-red)' : 'inherit'
          }}>
            {stats.clutchFactor !== null ? stats.clutchFactor.toFixed(2) : '—'}
          </span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Biggest blowout <StatInfo>Largest winning margin in a single game.</StatInfo></span>
        <ValInfo tip={stats.biggestBlowout > 0 ? `${stats.biggestBlowoutMyScore}–${stats.biggestBlowoutTheirScore}` : null}>
          <span className="stat-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
            {stats.biggestBlowout > 0 ? (
              <>
                <span>+{stats.biggestBlowout}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
                  {new Date(stats.biggestBlowoutDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </>
            ) : '—'}
          </span>
        </ValInfo>
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
