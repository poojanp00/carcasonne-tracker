import { useMemo } from 'react';
import crownImg from '../../images/icons/crown.png';

// ─── Statistics ────────────────────────────────────────────────────────

// Game analysis constants
const STATISTICS_CONFIG = {
  CLUTCH_THRESHOLD: 0.10, // 10% - margin threshold for "clutch" (close) games
};

// Aggregate per-type score totals across all games for a player
function calcBreakdown(games, name) {
  const low    = name.toLowerCase();
  const totals = {};
  for (const g of games) {
    const me = g.players.find(p => p.name.toLowerCase() === low);
    if (!me?.breakdown) continue;
    for (const [type, pts] of Object.entries(me.breakdown)) {
      totals[type] = (totals[type] || 0) + pts;
    }
  }
  return totals;
}

/**
 * COMPREHENSIVE CARCASSONNE GAME STATISTICS CALCULATOR
 * 
 * Analyzes a player's complete game history to extract meaningful performance metrics.
 * All calculations are opponent-relative (comparing against other players in each game).
 * 
 * Key Metrics Calculated:
 * 
 * BASIC STATS:
 * - Win/Loss record and percentages
 * - High score achievements and dates
 * - Point differentials and averages
 * 
 * ADVANCED ANALYSIS:
 * - Clutch factor: Performance in close games (margin < 10% of combined scores)
 * - Farm win percentage: How often victories come from field scoring dominance  
 * - Biggest blowouts: Largest victory margins with game details
 * - Current streaks: Consecutive wins/losses from most recent games
 * 
 * SCORING BREAKDOWNS:
 * - Per-category point totals across all games
 * - Expansion-specific scoring analysis
 * 
 * @param {Array} games - Complete game history array
 * @param {string} name - Player name to analyze (case-insensitive)
 * @returns {Object} Comprehensive stats object with all calculated metrics
 */
function calcStats(games, name) {
  const low  = name.toLowerCase();
  // Filter to only games where this player participated
  const mine = games.filter(g => g.players.some(p => p.name.toLowerCase() === low));

  // Initialize all tracking variables
  let wins = 0, losses = 0, highScore = 0, highScoreDate = null, farmWins = 0, netPtDiff = 0, totalPoints = 0;
  let biggestBlowout = 0, biggestBlowoutDate = null, biggestBlowoutMyScore = 0, biggestBlowoutTheirScore = 0;
  let clutchWins = 0, clutchLosses = 0, clutchGames = 0;

  // Process each game to extract statistics
  for (const g of mine) {
    // Find this player's performance in this game
    const me = g.players.find(p => p.name.toLowerCase() === low);
    const my = me.score;
    const isWinner = g.winners?.includes(me.name) || false;
    const opponents = g.players.filter(p => p.name.toLowerCase() !== low);
    const maxOpp = opponents.length > 0 ? Math.max(...opponents.map(p => p.score)) : 0;

    // WIN/LOSS ANALYSIS
    // Use precomputed winners from database instead of calculating
    if (isWinner) {
      wins++;
      
      // BLOWOUT TRACKING
      // Track the largest victory margin for bragging rights
      const margin = my - maxOpp;
      if (margin > biggestBlowout) {
        biggestBlowout          = margin;
        biggestBlowoutDate      = g.date;
        biggestBlowoutMyScore   = my;
        biggestBlowoutTheirScore = maxOpp;
      }
    } else {
      losses++;
    }

    // HIGH SCORE TRACKING
    // Personal best regardless of game outcome
    if (my > highScore) { highScore = my; highScoreDate = g.date; }
    
    // POINT DIFFERENTIAL ANALYSIS
    // Cumulative margin tracking for average dominance calculation
    netPtDiff   += (my - maxOpp);
    totalPoints += my;

    // FARM WIN ANALYSIS
    // Track when victories come primarily from field scoring
    // Game must be marked as farmWin AND player must have won
    if (g.farmWin && isWinner) farmWins++;

    // CLUTCH GAME ANALYSIS
    // "Clutch" games are close contests where margin < 10% of combined score
    // Tests performance under pressure in competitive games
    const total_pts = my + maxOpp;
    if (total_pts > 0 && Math.abs(my - maxOpp) / total_pts < STATISTICS_CONFIG.CLUTCH_THRESHOLD) {
      clutchGames++;
      if (isWinner)     clutchWins++;
      else              clutchLosses++;
    }
  }

  // CALCULATE DERIVED STATISTICS
  const total       = mine.length;
  const winRate     = total > 0 ? Math.round((wins / total) * 100) : 0;
  const farm = wins > 0 ? Math.round((farmWins / wins) * 100) : null; // % of wins via farming
  const clutchFactor  = clutchGames > 0 ? Math.round((clutchWins / clutchGames) * 100) / 100 : null;

  /**
   * CURRENT STREAK CALCULATION
   * 
   * Calculates consecutive wins or losses starting from most recent game.
   * Games are stored newest-first, so we iterate from index 0.
   * Streak breaks on first non-matching result (win breaks loss streak, etc.).
   * Equal scores now count as wins and continue win streaks.
   */
  let winStreak = 0, lossStreak = 0;
  for (let i = 0; i < mine.length; i++) {
    const g   = mine[i]; // Current game (newest first)
    const me2 = g.players.find(p => p.name.toLowerCase() === low);
    const opp = g.players.filter(p => p.name.toLowerCase() !== low);
    const my2 = me2.score;
    const mx  = opp.length > 0 ? Math.max(...opp.map(p => p.score)) : 0;

    // Initialize streak on first game
    if (winStreak === 0 && lossStreak === 0) {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (isWinner2)  winStreak  = 1;   // Start win streak
      else            lossStreak = 1;   // Start loss streak  
    } 
    // Continue existing win streak
    else if (winStreak > 0) {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (isWinner2) winStreak++;
      else break;                           // Streak broken by loss
    } 
    // Continue existing loss streak  
    else {
      const isWinner2 = g.winners?.includes(me2.name) || false;
      if (!isWinner2) lossStreak++;
      else break;                           // Streak broken by win
    }
  }

  
  // Return comprehensive statistics object
  return {
    // Basic game record
    wins, losses, winRate, total,
    
    // Scoring achievements  
    highScore, highScoreDate, totalPoints, netPtDiff,
    
    // Streak tracking
    winStreak, lossStreak,
    
    // Advanced metrics
    farmWins, farm,                    // Farm-based victory analysis
    clutchFactor, clutchGames, clutchWins, // Performance under pressure
    biggestBlowout, biggestBlowoutDate,     // Most dominant victory
    biggestBlowoutMyScore, biggestBlowoutTheirScore,
  };
}

/**
 * TOOLTIP INFORMATION COMPONENT
 * 
 * Provides contextual help for statistics that may not be immediately clear.
 * Shows info icon with hover tooltip containing detailed explanations.
 */
function StatInfo({ children }) {
  return (
    <span className="stat-info-wrap">
      <span className="stat-info-icon">ⓘ</span>
      <span className="stat-info-tooltip">{children}</span>
    </span>
  );
}

/**
 * VALUE WITH CONTEXTUAL TOOLTIP
 * 
 * Displays a clickable value with additional context in a tooltip.
 * Used for showing details like game dates, margin breakdowns, etc.
 */
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

const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  inn: 'Inn', cathedral: 'Cathedral',
  princess: 'Princess', fairy: 'Fairy',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  largest_city: 'Largest City', largest_road: 'Largest Road',
};

function PlayerCard({ name, stats, breakdown, colorClass, isLeader, typeLeaders }) {
  const canonicalOrder = ['road', 'city', 'monastery', 'field'];
  // Show canonical types if they exist in breakdown (even at 0), extras only when > 0
  // Show canonical types if present in breakdown (even at 0), extras if key exists (expansion was played)
  const allTypes = [
    ...canonicalOrder.filter(t => t in breakdown),
    ...Object.keys(breakdown).filter(t => !canonicalOrder.includes(t)),
  ];
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
        <span className="stat-label">Farm <StatInfo>How often your wins came via farm.</StatInfo></span>
        <ValInfo tip={stats.farm !== null ? `${stats.farmWins} farm win / ${stats.wins} total wins` : null}>
          <span className="stat-value">{stats.farm !== null ? `${stats.farm}%` : '—'}</span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Clutch factor <StatInfo>Win rate in close games (margin &lt; 10% of total points).</StatInfo></span>
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

      {allTypes.length > 0 && (
        <>
          <div className="stat-divider" />
          <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', color: 'var(--stone-gray)', marginBottom: '0.35rem' }}>
            POINT TOTALS
          </div>
          {allTypes.map(type => (
            <div key={type} className="stat-row">
              <span className="stat-label">{TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1)}</span>
              <span className="stat-value">
                {typeLeaders?.[type] === name && <span style={{ color: 'var(--forest-green)', fontWeight: 700, marginRight: '0.25rem' }}>*</span>}
                {breakdown[type]}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function Stats({ games, realms = [], currentRealm = null, onRealmChange }) {
  const realmGames = currentRealm ? games.filter(g => g.realmId === currentRealm.id) : [];

  const BASE_BREAKDOWN = { road: 0, city: 0, monastery: 0, field: 0 };

  const { sorted, leader, typeLeaders } = useMemo(() => {
    // Derive player names: from games if available, else from realm roster
    let names;
    if (realmGames.length > 0) {
      const seenLower = new Map();
      realmGames.flatMap(g => g.players.map(p => p.name)).forEach(n => {
        if (!seenLower.has(n.toLowerCase())) seenLower.set(n.toLowerCase(), n);
      });
      names = [...seenLower.values()];
    } else {
      names = currentRealm?.players || [];
    }

    const allStats = names.map(name => ({
      name,
      ...calcStats(realmGames, name),
      breakdown: realmGames.length > 0 ? calcBreakdown(realmGames, name) : { ...BASE_BREAKDOWN },
    }));

    // Crown leader: best win rate — only meaningful with games
    const byWinRate = [...allStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

    // Display order: most wins first; tiebreaker by win rate
    const s = [...allStats].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

    // Per-type leaders: only when there are actual points
    const typeLeaders = {};
    for (const ps of allStats) {
      for (const [type, pts] of Object.entries(ps.breakdown)) {
        if (pts > 0 && (typeLeaders[type] === undefined || pts > allStats.find(p => p.name === typeLeaders[type])?.breakdown[type])) {
          typeLeaders[type] = ps.name;
        }
      }
    }
    return { sorted: s, leader: realmGames.length > 0 ? byWinRate[0]?.name : null, typeLeaders };
  }, [realmGames, currentRealm]);

  return (
    <div>
      <div className="section-title">
        <h2>Statistics</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{realmGames.length} {realmGames.length === 1 ? 'game' : 'games'}</span>}
      </div>

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
          <span className="empty-state-icon">🏰</span>
          Select a realm above to view statistics.
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: sorted.length === 4 ? 'repeat(2, 1fr)' : sorted.length >= 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
          {sorted.map((ps, i) => (
            <PlayerCard
              key={ps.name}
              name={ps.name}
              stats={ps}
              breakdown={ps.breakdown}
              colorClass={PLAYER_COLOR_CLASSES[i % PLAYER_COLOR_CLASSES.length]}
              isLeader={ps.name === leader}
              typeLeaders={typeLeaders}
            />
          ))}
        </div>
      )}
    </div>
  );
}
