import { useMemo } from 'react';
import crownImg from '../../images/icons/crown.png';

// ─── Statistics ────────────────────────────────────────────────────────

function calcStats(games, name) {
  const low  = name.toLowerCase();
  const mine = games.filter(g => g.players.some(p => p.name.toLowerCase() === low));

  let wins = 0, losses = 0, ties = 0, highScore = 0, highScoreDate = null, farmWins = 0, netPtDiff = 0;
  let biggestBlowout = 0, biggestBlowoutDate = null, biggestBlowoutMyScore = 0, biggestBlowoutTheirScore = 0;
  let clutchWins = 0, clutchLosses = 0, clutchGames = 0;

  for (const g of mine) {
    const me        = g.players.find(p => p.name.toLowerCase() === low);
    const opponents = g.players.filter(p => p.name.toLowerCase() !== low);
    const my        = me.score;
    const maxOpp    = opponents.length > 0 ? Math.max(...opponents.map(p => p.score)) : 0;

    if (my > maxOpp) {
      wins++;
      const margin = my - maxOpp;
      if (margin > biggestBlowout) {
        biggestBlowout          = margin;
        biggestBlowoutDate      = g.date;
        biggestBlowoutMyScore   = my;
        biggestBlowoutTheirScore = maxOpp;
      }
    } else if (my < maxOpp) {
      losses++;
    } else {
      ties++;
    }

    if (my > highScore) { highScore = my; highScoreDate = g.date; }
    netPtDiff += (my - maxOpp);

    if (g.farmWin && my > maxOpp) farmWins++;

    // Close game: margin < 5% of combined totals (use top two scores)
    const total_pts = my + maxOpp;
    if (total_pts > 0 && Math.abs(my - maxOpp) / total_pts < 0.05) {
      clutchGames++;
      if (my > maxOpp)      clutchWins++;
      else if (my < maxOpp) clutchLosses++;
    }
  }

  const total       = mine.length;
  const winRate     = total > 0 ? Math.round((wins / total) * 100) : 0;
  const farmDominance = wins > 0 ? Math.round((farmWins / wins) * 100) : null;
  const clutchFactor  = clutchGames > 0 ? Math.round((clutchWins / clutchGames) * 100) / 100 : null;

  // Current streak (games stored newest-first)
  let winStreak = 0, lossStreak = 0;
  for (let i = 0; i < mine.length; i++) {
    const g   = mine[i];
    const me2 = g.players.find(p => p.name.toLowerCase() === low);
    const opp = g.players.filter(p => p.name.toLowerCase() !== low);
    const my2 = me2.score;
    const mx  = opp.length > 0 ? Math.max(...opp.map(p => p.score)) : 0;

    if (winStreak === 0 && lossStreak === 0) {
      if (my2 > mx)       winStreak  = 1;
      else if (my2 < mx)  lossStreak = 1;
      else break;
    } else if (winStreak > 0) {
      if (my2 > mx) winStreak++;
      else break;
    } else {
      if (my2 < mx) lossStreak++;
      else break;
    }
  }

  return {
    wins, losses, ties, winRate, highScore, highScoreDate, total,
    winStreak, lossStreak, farmWins, farmDominance,
    biggestBlowout, biggestBlowoutDate, biggestBlowoutMyScore, biggestBlowoutTheirScore,
    clutchFactor, clutchGames, clutchWins, netPtDiff,
  };
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

const PLAYER_COLOR_CLASSES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function PlayerCard({ name, stats, colorClass, isLeader }) {
  return (
    <div className={`player-card ${colorClass}`}>
      {isLeader && <img src={crownImg} alt="Leader" title="Current leader" className="card-crown" />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
        {stats.total > 0 && (
          <span style={{
            fontFamily: 'Crimson Text, serif', fontSize: '0.85rem', fontStyle: 'italic',
            color: stats.netPtDiff > 0 ? 'var(--forest-green)' : stats.netPtDiff < 0 ? 'var(--deep-red)' : 'var(--stone-gray)',
            opacity: 0.85,
          }}>
            {stats.netPtDiff > 0 ? `+${stats.netPtDiff}` : stats.netPtDiff} pts
          </span>
        )}
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
        <ValInfo tip={`${stats.wins} won / ${stats.total} total`}><WinRateBadge rate={stats.winRate} /></ValInfo>
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
          color: stats.winStreak > 0 ? 'var(--forest-green)' : stats.lossStreak > 0 ? 'var(--deep-red)' : 'inherit',
        }}>
          {stats.winStreak > 0 ? `W${stats.winStreak}` : stats.lossStreak > 0 ? `L${stats.lossStreak}` : '—'}
        </span>
      </div>

      <div className="stat-divider" />

      <div className="stat-row">
        <span className="stat-label">Farm dominance <StatInfo>How often your wins came via farm.</StatInfo></span>
        <ValInfo tip={stats.farmDominance !== null ? `${stats.farmWins} farm win / ${stats.wins} total wins` : null}>
          <span className="stat-value">{stats.farmDominance !== null ? `${stats.farmDominance}%` : '—'}</span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Clutch factor <StatInfo>Win rate in close games (margin &lt; 5% of total points).</StatInfo></span>
        <ValInfo tip={stats.clutchFactor !== null ? `${stats.clutchWins} wins / ${stats.clutchGames} clutch games` : null}>
          <span className="stat-value" style={{
            color: stats.clutchFactor !== null && stats.clutchFactor >= 0.6
              ? 'var(--forest-green)'
              : stats.clutchFactor !== null && stats.clutchFactor <= 0.4
              ? 'var(--deep-red)'
              : 'inherit',
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

export default function Stats({ games, noRealm = false }) {
  const { sorted, leader } = useMemo(() => {
    if (games.length === 0) return { sorted: [], leader: null };

    // Deduplicate case-insensitively, keeping first-seen capitalization
    const seenLower = new Map();
    games.flatMap(g => g.players.map(p => p.name)).forEach(n => {
      if (!seenLower.has(n.toLowerCase())) seenLower.set(n.toLowerCase(), n);
    });
    const names    = [...seenLower.values()];
    const allStats = names.map(name => ({ name, ...calcStats(games, name) }));

    // Primary: win rate (highest first); tiebreaker: total wins
    const s = [...allStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
    return { sorted: s, leader: s[0]?.name };
  }, [games]);

  if (games.length === 0) {
    return (
      <div>
        <div className="section-title">
          <h2>Statistics</h2>
          <div className="section-title-line" />
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">🏰</span>
          {noRealm ? 'Load a realm to view statistics.' : 'No games recorded yet. Log your first game to see statistics.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">
        <h2>Statistics</h2>
        <div className="section-title-line" />
        <span className="game-count">{games.length} {games.length === 1 ? 'game' : 'games'}</span>
      </div>

      <div className="stats-grid">
        {sorted.map((ps, i) => (
          <PlayerCard
            key={ps.name}
            name={ps.name}
            stats={ps}
            colorClass={PLAYER_COLOR_CLASSES[i % PLAYER_COLOR_CLASSES.length]}
            isLeader={ps.name === leader}
          />
        ))}
      </div>
    </div>
  );
}
