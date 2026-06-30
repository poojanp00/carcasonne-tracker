import { useMemo, useState, useEffect, useRef } from 'react';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};
import { STATISTICS_CONFIG, SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import ChipGroup from './ChipGroup';
import { TrashIcon } from './icons';
import crownImg from '../../images/icons/crown.png';
import PointBreakdownChart from './PointBreakdownChart';
import Lightbox from './Lightbox';

function calcFavMeeple(games, name) {
  const low = name.toLowerCase();
  const counts = {};
  for (const g of games) {
    const me = g.players.find(p => p.name.toLowerCase() === low);
    if (!me?.meeple) continue;
    counts[me.meeple] = (counts[me.meeple] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { meeple: top[0], count: top[1] } : { meeple: null, count: 0 };
}

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
  let wins = 0, losses = 0, highScore = 0, highScoreDate = null, highScoreGame = null, farmWins = 0, netPtDiff = 0, totalPoints = 0;
  let biggestBlowout = 0, biggestBlowoutDate = null, biggestBlowoutMyScore = 0, biggestBlowoutTheirScore = 0, biggestBlowoutGame = null;
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
        biggestBlowoutGame      = g;
      }
    } else {
      losses++;
    }

    // HIGH SCORE TRACKING
    // Personal best regardless of game outcome
    if (my > highScore) { highScore = my; highScoreDate = g.date; highScoreGame = g; }
    
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
    highScore, highScoreDate, highScoreGame, totalPoints, netPtDiff,
    
    // Streak tracking
    winStreak, lossStreak,
    
    // Advanced metrics
    farmWins, farm,                    // Farm-based victory analysis
    clutchFactor, clutchGames, clutchWins, // Performance under pressure
    biggestBlowout, biggestBlowoutDate, biggestBlowoutGame, // Most dominant victory
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
function ValInfo({ tip, children, style }) {
  return (
    <span className="val-info-wrap" style={style}>
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


function calcGroupStats(games) {
  let totalPoints = 0, farmWins = 0, clutchGames = 0, longestGame = 0, longestGameObj = null;
  const typePoints = {};
  for (const g of games) {
    totalPoints += g.players.reduce((s, p) => s + p.score, 0);
    if (g.farmWin) farmWins++;
    if (g.clutchWin) clutchGames++;
    if ((g.gameDuration || 0) > longestGame) { longestGame = g.gameDuration || 0; longestGameObj = g; }
    for (const p of g.players)
      for (const [type, pts] of Object.entries(p.breakdown || {}))
        typePoints[type] = (typePoints[type] || 0) + pts;
  }
  return { totalPoints, farmWins, clutchGames, longestGame, longestGameObj, typePoints };
}

function calcPlayerRecords(games, players) {
  const records = Object.fromEntries(players.map(p => [p.toLowerCase(), { w: 0, l: 0 }]));
  for (const g of games)
    for (const p of g.players) {
      const key = p.name.toLowerCase();
      if (!records[key]) continue;
      if (g.winners?.includes(p.name)) records[key].w++;
      else records[key].l++;
    }
  return records;
}

const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  inn: 'Inn', cathedral: 'Cathedral',
  princess: 'Princess', fairy: 'Fairy',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  largest_city: 'Largest City', largest_road: 'Largest Road',
  abbey: 'Abbey', barn: 'Barn', abbot: 'Abbot', wagon: 'Wagon',
};

const SCORE_GROUPS = [
  { label: 'Road + Inn',           types: ['road', 'inn'] },
  { label: 'City + Cath.',         types: ['city', 'cathedral'] },
  { label: 'Mon. + Abbot + Abbey', types: ['monastery', 'abbot', 'abbey'] },
  { label: 'Field + Pig + Barn',   types: ['field', 'pig', 'barn'] },
  { label: 'Goods',                types: ['wine', 'grain', 'cloth'] },
];
const TYPE_TO_GROUP = {};
SCORE_GROUPS.forEach(g => g.types.forEach(t => { TYPE_TO_GROUP[t] = g; }));

function PlayerCard({ name, stats, favMeeple, favMeepleCount, colorClass, isLeader, onNavigateToGame }) {
  const meepleImg = favMeeple ? (MEEPLE_IMGS[favMeeple] ?? null) : null;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`player-card ${colorClass}`}>
      {isLeader && <img src={crownImg} alt="Leader" className="card-crown" />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {meepleImg && (
          <ValInfo tip={favMeepleCount ? `Used in ${favMeepleCount} ${favMeepleCount === 1 ? 'game' : 'games'}` : null}>
            <img src={meepleImg} alt="Favorite meeple" style={{ height: '24px', width: 'auto', opacity: 0.85, position: 'relative', top: '-3px' }} />
          </ValInfo>
        )}
        <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
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
        <span className="stat-label">Win rate <StatInfo>Share of games won.</StatInfo></span>
        <ValInfo tip={`${stats.wins} won / ${stats.total} total`}><WinRateBadge rate={stats.winRate} /></ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">High score <StatInfo>Highest single-game score achieved.</StatInfo></span>
        {stats.highScoreGame && onNavigateToGame ? (
          <button
            type="button"
            onClick={() => onNavigateToGame(stats.highScoreGame)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}
          >
            <span className="stat-value" style={{ color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{stats.highScore}</span>
          </button>
        ) : (
          <span className="stat-value">{stats.highScore}</span>
        )}
      </div>
      <div className="stat-row">
        <span className="stat-label">Streak <StatInfo>Consecutive wins or losses.</StatInfo></span>
        <span className="stat-value" style={{
          color: stats.winStreak > 0 ? 'var(--forest-green)' : stats.lossStreak > 0 ? 'var(--deep-red)' : 'inherit',
        }}>
          {stats.winStreak > 0 ? `W${stats.winStreak}` : stats.lossStreak > 0 ? `L${stats.lossStreak}` : '—'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', opacity: 0.6, marginTop: '0.3rem' }}
      >
        {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <>
          {stats.total > 0 && (
            <div className="stat-row">
              <span className="stat-label">Point differential <StatInfo>Net point difference across all games.</StatInfo></span>
              <span className="stat-value" style={{ color: stats.netPtDiff > 0 ? 'var(--forest-green)' : stats.netPtDiff < 0 ? 'var(--deep-red)' : 'inherit' }}>
                {stats.netPtDiff > 0 ? `+${stats.netPtDiff}` : stats.netPtDiff}
              </span>
            </div>
          )}
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
            {stats.biggestBlowout > 0 && stats.biggestBlowoutGame && onNavigateToGame ? (
              <button
                type="button"
                onClick={() => onNavigateToGame(stats.biggestBlowoutGame)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}
              >
                <span className="stat-value" style={{ color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>+{stats.biggestBlowout}</span>
              </button>
            ) : (
              <span className="stat-value">{stats.biggestBlowout > 0 ? `+${stats.biggestBlowout}` : '—'}</span>
            )}
          </div>
        </>
      )}

    </div>
  );
}

export default function Stats({ games, realms = [], currentRealm = null, onRealmChange, onDelete, isGuest = false }) {
  const realmGames = currentRealm ? games.filter(g => g.realmId === currentRealm.id) : [];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [barTooltip, setBarTooltip] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const barRef = useRef(null);

  const openGameLightbox = (game) => setSelectedGame(game);

  useEffect(() => { setCardExpanded(false); }, [currentRealm?.id]);

  useEffect(() => {
    const isOpen = confirmDelete || !!selectedGame;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDelete, selectedGame]);

  const BASE_BREAKDOWN = { road: 0, city: 0, monastery: 0, field: 0 };

  const { sorted, leaders } = useMemo(() => {
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

    // Collect all scoring types used in any game in the realm
    const allTypesInRealm = new Set();
    realmGames.forEach(g => {
      g.players.forEach(p => {
        if (p.breakdown) Object.keys(p.breakdown).forEach(t => allTypesInRealm.add(t));
      });
    });

    const allStats = names.map(name => ({
      name,
      ...calcStats(realmGames, name),
      breakdown: realmGames.length > 0
        ? { ...Object.fromEntries([...allTypesInRealm].map(t => [t, 0])), ...calcBreakdown(realmGames, name) }
        : { ...BASE_BREAKDOWN },
      ...(() => { const { meeple, count } = calcFavMeeple(realmGames, name); return { favMeeple: meeple, favMeepleCount: count }; })(),
    }));

    // Crown leader: best win rate — only meaningful with games
    const byWinRate = [...allStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.netPtDiff - a.netPtDiff || b.winStreak - a.winStreak);

    // Display order: same ranking as crown so leader always appears first
    const s = [...allStats].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.netPtDiff - a.netPtDiff || b.winStreak - a.winStreak);

    let leaders = new Set();
    if (realmGames.length > 0 && byWinRate[0]) {
      const top = byWinRate[0];
      byWinRate.forEach(p => {
        if (p.winRate === top.winRate && p.wins === top.wins && p.netPtDiff === top.netPtDiff && p.winStreak === top.winStreak)
          leaders.add(p.name);
      });
    }
    return { sorted: s, leaders };
  }, [realmGames, currentRealm]);

  return (
    <div>
      <div className="section-title">
        <h2>Statistics</h2>
        <div className="section-title-line" />
        {currentRealm && <span className="game-count">{realmGames.length} {realmGames.length === 1 ? 'game' : 'games'}</span>}
      </div>

      {/* Group chips */}
      {realms.length > 0 && (
        <div style={{ marginBottom: '1.3rem' }}>
          <ChipGroup items={realms} selectedId={currentRealm?.id} onSelect={onRealmChange} carousel />
        </div>
      )}

      {/* Guest mode */}
      {isGuest ? (
        <div className="empty-state">Sign in to view statistics and track game history.</div>
      ) : !currentRealm ? (
        <div className="empty-state">Select a group to view statistics.</div>
      ) : (
        <>
          {/* Lightbox overlay for game links clicked from stats */}
          {selectedGame && (
            <Lightbox
              game={selectedGame}
              games={realmGames}
              onNavigate={setSelectedGame}
              onClose={() => setSelectedGame(null)}
            />
          )}

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div className="realm-modal-overlay" onClick={() => setConfirmDelete(false)}>
              <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
                <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
                <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
                  This will permanently delete <strong>{currentRealm.name}</strong> and all its recorded games. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { setConfirmDelete(false); onDelete?.(currentRealm.id); }}>Delete</button>
                </div>
              </div>
            </div>
          )}

          {/* Active group card */}
          {(() => {
            const gs = calcGroupStats(realmGames);
            const records = calcPlayerRecords(realmGames, currentRealm.players);
            const activeTypes = SCORE_TYPE_ORDER.filter(t => gs.typePoints[t] > 0);
            const orderedBarTypes = [
              ...SCORE_GROUPS.flatMap(g => g.types.filter(t => activeTypes.includes(t))),
              ...activeTypes.filter(t => !TYPE_TO_GROUP[t]),
            ];
            const totalBreakdown = activeTypes.reduce((s, t) => s + gs.typePoints[t], 0);
            const EXP_TYPE = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.type]));
            const { favFull, favFullCount, favMini, favMiniCount } = (() => {
              const full = {}, mini = {};
              for (const g of realmGames)
                for (const exp of g.expansions || []) {
                  if (EXP_TYPE[exp] === 'full') full[exp] = (full[exp] || 0) + 1;
                  else if (EXP_TYPE[exp] === 'mini') mini[exp] = (mini[exp] || 0) + 1;
                }
              const fullSorted = Object.entries(full).sort((a, b) => b[1] - a[1]);
              const miniSorted = Object.entries(mini).sort((a, b) => b[1] - a[1]);
              return {
                favFull: fullSorted[0]?.[0] ?? '—',
                favFullCount: fullSorted[0]?.[1] ?? null,
                favMini: miniSorted[0]?.[0] ?? '—',
                favMiniCount: miniSorted[0]?.[1] ?? null,
              };
            })();

            const longestText = gs.longestGame > 0 ? (() => {
              const s = Math.floor(gs.longestGame / 1000);
              const h = Math.floor(s / 3600);
              const m = Math.floor((s % 3600) / 60);
              return h > 0 ? `${h}h ${m}m` : `${m}m`;
            })() : '—';
            return (
              <div className="stats-grid" style={{ gridTemplateColumns: sorted.length === 4 ? 'repeat(2, 1fr)' : sorted.length >= 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', alignItems: 'start' }}>

                {/* Wide combined card: group stats left, point totals right */}
                <div className="tile-card" style={{ borderTop: '4px solid var(--warm-gold)', gridColumn: `span ${sorted.length >= 3 && sorted.length !== 4 ? 3 : 2}` }}>

                  {/* Always-visible: name/records + point totals bar */}
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--earth-brown)' }}>
                            {currentRealm.name}
                          </span>
                          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                            {[...currentRealm.players]
                              .sort((a, b) => (records[b.toLowerCase()]?.w || 0) - (records[a.toLowerCase()]?.w || 0))
                              .map((name, i) => (
                                <span key={name}>
                                  {i > 0 && <span style={{ color: 'var(--stone-gray)' }}> · </span>}
                                  <span style={{ color: 'var(--charcoal)' }}>{name}</span>
                                  {' '}
                                  <span style={{ color: 'var(--forest-green)', fontWeight: 600 }}>{records[name.toLowerCase()]?.w || 0}</span>
                                </span>
                              ))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ width: '1px', background: 'var(--warm-gold)', opacity: 0.3, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--stone-gray)' }}>POINT TOTALS</span>
                        <span className="stat-value">{gs.totalPoints}</span>
                      </div>
                      <div
                        ref={barRef}
                        style={{ position: 'relative', margin: '0.5rem 0 0' }}
                        onMouseLeave={() => setBarTooltip(null)}
                      >
                        <div style={{ display: 'flex', width: '100%', height: '16px', borderRadius: '6px', overflow: 'hidden' }}>
                          {orderedBarTypes.length === 0
                            ? <div style={{ flex: 1, backgroundColor: 'var(--stone-gray)', opacity: 0.25 }} />
                            : orderedBarTypes.map(t => (
                                <div
                                  key={t}
                                  style={{ flex: gs.typePoints[t] / totalBreakdown, backgroundColor: SCORE_TYPE_COLORS[t], cursor: 'default' }}
                                  onMouseEnter={(e) => {
                                    if (!barRef.current) return;
                                    const segRect = e.currentTarget.getBoundingClientRect();
                                    const containerRect = barRef.current.getBoundingClientRect();
                                    setBarTooltip({
                                      type: t,
                                      value: gs.typePoints[t],
                                      x: segRect.left + segRect.width / 2 - containerRect.left,
                                      y: segRect.bottom - containerRect.top,
                                    });
                                  }}
                                />
                              ))
                          }
                        </div>
                        {barTooltip && (
                          <div style={{
                            position: 'absolute',
                            left: barTooltip.x,
                            top: barTooltip.y,
                            transform: 'translate(-50%, 6px)',
                            background: 'var(--earth-brown)',
                            color: 'var(--parchment)',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '6px',
                            zIndex: 100,
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
                            textAlign: 'center',
                          }}>
                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.65rem', color: 'rgba(240,230,210,0.7)', marginBottom: '0.1rem' }}>
                              {TYPE_LABELS[barTooltip.type] ?? barTooltip.type}
                            </div>
                            <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.85rem' }}>
                              {barTooltip.value}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Arrow stays here — between fixed and expanding content */}
                  <button
                    type="button"
                    onClick={() => setCardExpanded(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', opacity: 0.6, marginTop: '0.4rem' }}
                  >
                    {cardExpanded ? '▲' : '▼'}
                  </button>

                  {/* Expanded content — below arrow, same two-column layout */}
                  {cardExpanded && (
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.2rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {[
                          ['Games', realmGames.length, null, null],
                          ['Farm Wins', gs.farmWins, null, 'Games won in final scoring stage.'],
                          ['Clutch Games', gs.clutchGames, null, 'Games where winning margin was less than 10%.'],
                          ['Longest Game', longestText, gs.longestGameObj, null],
                        ].map(([label, val, gameObj, info]) => (
                          <div key={label} className="stat-row" style={{ margin: 0 }}>
                            <span className="stat-label">
                              {label}
                              {info && <StatInfo>{info}</StatInfo>}
                            </span>
                            {gameObj
                              ? <button type="button" onClick={() => openGameLightbox(gameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{val}</button>
                              : <span className="stat-value">{val}</span>
                            }
                          </div>
                        ))}
                        <div style={{ marginTop: '0.1rem' }}>
                          <span className="stat-label">Favorite Expansion</span>
                          <div style={{ paddingLeft: '0.8rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            {[['Full', favFull, favFullCount], ['Mini', favMini, favMiniCount]].map(([label, val, count]) => (
                              <div key={label} className="stat-row" style={{ margin: 0 }}>
                                <span className="stat-label" style={{ color: 'var(--stone-gray)' }}>{label}</span>
                                <ValInfo tip={count !== null ? `Played in ${count} ${count === 1 ? 'game' : 'games'}` : null}>
                                  <span className="stat-value">{val}</span>
                                </ValInfo>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ width: '1px', background: 'var(--warm-gold)', opacity: 0.3, flexShrink: 0 }} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {activeTypes.length > 0 && activeTypes.map(t => (
                          <div key={t} className="stat-row" style={{ margin: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], flexShrink: 0, display: 'inline-block' }} />
                              <span className="stat-label">{TYPE_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1)}</span>
                            </span>
                            <span className="stat-value">{gs.typePoints[t]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Player cards */}
                {sorted.map((ps, i) => (
                  <PlayerCard
                    key={ps.name}
                    name={ps.name}
                    stats={ps}
                    favMeeple={ps.favMeeple}
                    favMeepleCount={ps.favMeepleCount}
                    colorClass={PLAYER_COLOR_CLASSES[i % PLAYER_COLOR_CLASSES.length]}
                    isLeader={leaders.has(ps.name)}
                    onNavigateToGame={openGameLightbox}
                  />
                ))}
              </div>
            );
          })()}

          {sorted.some(p => Object.values(p.breakdown).some(v => v > 0)) && (
            <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              <PointBreakdownChart players={sorted} />
            </div>
          )}

          <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
            <button
              className="realm-trash-btn"
              onClick={() => setConfirmDelete(true)}
              title="Delete group"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--stone-gray)', fontSize: '0.82rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.06em' }}
            >
              <TrashIcon /> Delete Group
            </button>
          </div>
        </>
      )}
    </div>
  );
}
