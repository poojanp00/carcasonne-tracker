import { useMemo, useState, useEffect, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { calcAccountStats, getPlayerTitle } from '../utils/stats';
import { ACCOUNT_MILESTONES, accountMilestoneProgress } from '../data/accountMilestones';
import { MEEPLE_IMGS, WinRateBadge, TYPE_LABELS } from './StatWidgets';
import { ACHIEVEMENT_DISPLAY_ORDER, ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';

import { formatAchievementName } from '../utils/achievements';
import ValInfo from './ValInfo';
import Lightbox from './Lightbox';

function formatDuration(ms) {
  if (!(ms > 0)) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// "March 2026" from a YYYY-MM-DD game date
function formatMonthYear(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Dotted-underline value that jumps to a game in the Logbook, matching the
// game links on the Fellowship player cards
function GameLinkValue({ game, onNavigateToGame, children }) {
  if (!game || !onNavigateToGame) return <span className="stat-value">{children}</span>;
  return (
    <button
      type="button"
      onClick={() => onNavigateToGame(game)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', font: 'inherit' }}
    >
      <span className="stat-value" style={{ color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{children}</span>
    </button>
  );
}

// Proportional stacked bar of lifetime points by type — hover a segment for
// the type and amount, same tooltip as the realm point-breakdown chart.
function PointsBar({ breakdown }) {
  const [tooltip, setTooltip] = useState(null);
  const barsRef = useRef(null);
  const types = SCORE_TYPE_ORDER.filter(t => (breakdown[t] || 0) > 0);
  const total = types.reduce((s, t) => s + breakdown[t], 0);
  if (total === 0) return null;

  function handleMouseEnter(e, type, val) {
    if (!barsRef.current) return;
    const segRect = e.currentTarget.getBoundingClientRect();
    const containerRect = barsRef.current.getBoundingClientRect();
    setTooltip({
      type,
      value: val,
      x: segRect.left + segRect.width / 2 - containerRect.left,
      y: segRect.top - containerRect.top,
    });
  }

  return (
    <div ref={barsRef} style={{ position: 'relative', margin: '0.35rem 0 0.7rem' }} onMouseLeave={() => setTooltip(null)}>
      <div className="points-bar" style={{ display: 'flex', height: '18px', borderRadius: '6px', overflow: 'hidden' }}>
        {types.map(t => (
          <div
            key={t}
            style={{ flex: breakdown[t] / total, backgroundColor: SCORE_TYPE_COLORS[t], cursor: 'var(--cursor-arrow)' }}
            onMouseEnter={(e) => handleMouseEnter(e, t, breakdown[t])}
          />
        ))}
      </div>
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, calc(-100% - 6px))',
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
            {TYPE_LABELS[tooltip.type] ?? tooltip.type}
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.85rem' }}>
            {tooltip.value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionHeaderStyle = { borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.5rem', marginBottom: '1rem' };

// Trophy cabinet + milestones, side by side. Trophies: one medal per time each
// best-in-game record was held — 7 Longest Roads shows 7 medals in the row.
function TrophyCase({ account }) {
  const { recordTallies } = account;
  const tallied = ACHIEVEMENT_DISPLAY_ORDER.filter(key => recordTallies[key] > 0);
  return (
    <div className="tile-card" style={{ marginBottom: '1.2rem' }}>
      <div className="me-hero-grid">
        <div>
          <div className="tile-card-header" style={sectionHeaderStyle}>Trophy Cabinet</div>
          {tallied.length === 0 ? (
            <div className="stat-label">No records held yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {tallied.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="stat-label" style={{ fontStyle: 'normal', fontSize: 'clamp(0.9rem, 2.2vw, 1.1rem)', flex: 1, minWidth: 0 }}>
                    {ACHIEVEMENT_LABEL_OVERRIDE[key] ?? formatAchievementName(key)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={ACHIEVEMENT_BADGE[key]} alt={ACHIEVEMENT_LABEL_OVERRIDE[key] ?? formatAchievementName(key)} style={{ height: '44px', width: 'auto' }} draggable={false} />
                    <span className="stat-value" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>×{recordTallies[key]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="tile-card-header" style={sectionHeaderStyle}>Milestones</div>
          {ACCOUNT_MILESTONES.map(cat => {
            const progress = accountMilestoneProgress(cat, account);
            return (
              <div key={cat.id} className="milestone-section">
                <div className="milestone-section-header">
                  <span>{cat.label}</span>
                  <ValInfo tip={cat.unit}>
                    <span className="milestone-section-total">{progress.toLocaleString()}</span>
                  </ValInfo>
                </div>
                <div className="account-tier-grid">
                  {cat.tiers.map(tier => (
                    <div key={tier.name} className={`account-tier${progress >= tier.threshold ? ' achieved' : ''}`}>
                      <span className="account-tier-name">{tier.name}</span>
                      <span className="account-tier-threshold">{tier.threshold.toLocaleString()}{cat.metric === 'games' ? ' games' : ' pts'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// The strategy-game hero card: large meeple, name, rank title, and the
// primary career numbers at a glance.
function ProfileHero({ account, displayName }) {
  const { stats, favMeeple, favMeepleCount, playingSince, totalPlaytime } = account;
  const meepleImg = favMeeple ? (MEEPLE_IMGS[favMeeple] ?? null) : null;

  const primaryStats = [
    ['Games Played', <span className="profile-stat-value">{account.gamesCount}</span>],
    ['Victories', <span className="profile-stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span>],
    ['Win Rate', <ValInfo tip={`${stats.wins} won / ${stats.total} total`}><WinRateBadge rate={stats.winRate} /></ValInfo>],
    ['Career Points', <span className="profile-stat-value">{stats.totalPoints.toLocaleString()}</span>],
    ['Time Played', <span className="profile-stat-value">{formatDuration(totalPlaytime)}</span>],
    ['Playing Since', <span className="profile-stat-value">{formatMonthYear(playingSince)}</span>],
  ];

  return (
    <div className="player-card p2 profile-hero" style={{ marginBottom: '1.2rem' }}>
      <div className="profile-hero-top">
        {meepleImg && (
          <ValInfo tip={favMeepleCount ? `Used in ${favMeepleCount} ${favMeepleCount === 1 ? 'game' : 'games'}` : null}>
            <img src={meepleImg} alt="Favorite meeple" className="profile-hero-meeple" draggable={false} />
          </ValInfo>
        )}
        <div>
          <div className="profile-hero-name">{displayName || 'Adventurer'}</div>
          <div className="profile-hero-title">{getPlayerTitle(account.gamesCount)}</div>
        </div>
      </div>

      <PointsBar breakdown={account.breakdown} />

      <div className="profile-hero-stats">
        {primaryStats.map(([label, value]) => (
          <div key={label} className="profile-stat">
            {value}
            <span className="profile-stat-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Career-defining records, below the hero card
function CareerHighlights({ account, onNavigateToGame }) {
  const { stats, rival, biggestPlay, fastestWin, highestCombined, sweeps, favExpansions } = account;

  return (
    <div className="tile-card" style={{ marginBottom: '1.2rem' }}>
      <div className="tile-card-header" style={sectionHeaderStyle}>Career Highlights</div>

      <div>
          <div className="stat-row">
            <span className="stat-label">Personal Best</span>
            <GameLinkValue game={stats.highScoreGame} onNavigateToGame={onNavigateToGame}>
              {stats.highScore > 0 ? stats.highScore : '—'}
            </GameLinkValue>
          </div>
          <div className="stat-row">
            <span className="stat-label">Highest Scoring Game</span>
            <GameLinkValue game={highestCombined?.game} onNavigateToGame={onNavigateToGame}>
              {highestCombined ? highestCombined.points : '—'}
            </GameLinkValue>
          </div>
          <div className="stat-row">
            <span className="stat-label">Largest Single Feature</span>
            <GameLinkValue game={biggestPlay?.game} onNavigateToGame={onNavigateToGame}>
              {biggestPlay ? `${biggestPlay.amount} pts · ${TYPE_LABELS[biggestPlay.type] ?? biggestPlay.type}` : '—'}
            </GameLinkValue>
          </div>
          <div className="stat-row">
            <span className="stat-label">Fastest Victory</span>
            <GameLinkValue game={fastestWin?.game} onNavigateToGame={onNavigateToGame}>
              {formatDuration(fastestWin?.duration)}
            </GameLinkValue>
          </div>
          <div className="stat-row">
            <span className="stat-label">Longest Win Streak</span>
            <span className="stat-value" style={{ color: stats.bestWinStreak > 0 ? 'var(--forest-green)' : 'inherit' }}>
              {stats.bestWinStreak > 0 ? `W${stats.bestWinStreak}` : '—'}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Defeats</span>
            <span className="stat-value" style={{ color: 'var(--deep-red)' }}>{stats.losses}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Rival</span>
            <ValInfo tip={rival ? `Faced in ${rival.count} ${rival.count === 1 ? 'game' : 'games'}` : null}>
              <span className="stat-value">{rival ? rival.name : '—'}</span>
            </ValInfo>
          </div>
          <div className="stat-row">
            <span className="stat-label">Sweeps</span>
            <ValInfo tip="Games where you held every record">
              <span className="stat-value">{sweeps > 0 ? sweeps : '—'}</span>
            </ValInfo>
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            <span className="stat-label">Favorite Expansion</span>
            <div style={{ paddingLeft: '0.8rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {[['Full', favExpansions.full], ['Mini', favExpansions.mini]].map(([label, fav]) => (
                <div key={label} className="stat-row" style={{ margin: 0 }}>
                  <span className="stat-label" style={{ color: 'var(--stone-gray)' }}>{label}</span>
                  <ValInfo tip={fav ? `Played in ${fav.count} ${fav.count === 1 ? 'game' : 'games'}` : null}>
                    <span className="stat-value" style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.78rem)', fontWeight: 500 }}>{fav ? fav.name : '—'}</span>
                  </ValInfo>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
}

export default function Profile({ games, realms, userId, displayName, isGuest = false }) {
  const account = useMemo(() => calcAccountStats(games, realms, userId), [games, realms, userId]);
  const [selectedGame, setSelectedGame] = useState(null);

  const openGameLightbox = (game) => setSelectedGame(game);

  useEffect(() => {
    document.body.style.overflow = selectedGame ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedGame]);

  return (
    <div>
      {/* Lightbox overlay for game links clicked from the records — stays on the Profile page */}
      {selectedGame && (
        <Lightbox
          game={selectedGame}
          games={games}
          onNavigate={setSelectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}

      <div className="section-title">
        <h2>Profile</h2>
        <div className="section-title-line" />
        {!isGuest && <span className="game-count">{account.gamesCount} {account.gamesCount === 1 ? 'game' : 'games'} in {account.realmsCount} {account.realmsCount === 1 ? 'realm' : 'realms'}</span>}
      </div>

      {isGuest ? (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>Sign in to view your stats.</div>
      ) : account.gamesCount === 0 ? (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>Play some games to see your stats.</div>
      ) : (
        <>
          <ProfileHero account={account} displayName={displayName} />
          <CareerHighlights account={account} onNavigateToGame={openGameLightbox} />
          <TrophyCase account={account} />
        </>
      )}
    </div>
  );
}
