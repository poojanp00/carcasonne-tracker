import { useState } from 'react';
import { MEEPLE_IMGS, WinRateBadge } from './StatWidgets';
import { ACHIEVEMENT_DISPLAY_ORDER, ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';
import { formatAchievementName } from '../utils/achievements';
import { rankTitle } from '../utils/metaRank';
import MemberProgressModal from './MemberProgressModal';
import crownImg from '../../images/icons/crown.png';
import ValInfo from './ValInfo';

export const PLAYER_COLOR_CLASSES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

// Card back: this player's own trophy tallies within the realm.
function TrophyBack({ name, tallies }) {
  const present = ACHIEVEMENT_DISPLAY_ORDER.filter(key => tallies[key]?.count > 0);
  return (
    <>
      <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
      <div className="milestones-subtitle">Trophy Cabinet</div>
      {present.length === 0 ? (
        <div className="stat-label">No records held yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {present.map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="stat-label" style={{ fontStyle: 'normal', flex: 1, minWidth: 0, fontSize: 'clamp(0.68rem, 1.8vw, 0.85rem)' }}>
                {ACHIEVEMENT_LABEL_OVERRIDE[key] ?? formatAchievementName(key)}
              </span>
              <ValInfo
                tip={`Best: ${tallies[key].best}`}
                placement="above"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'var(--cursor-pointer)' }}
              >
                <img src={ACHIEVEMENT_BADGE[key]} alt="" style={{ height: '32px', width: 'auto' }} draggable={false} />
                <span className="stat-value" style={{ fontSize: '0.85rem' }}>×{tallies[key].count}</span>
              </ValInfo>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function PlayerCard({ name, stats, tallies, favMeeple, favMeepleCount, colorClass, isLeader, onNavigateToGame, progress = null }) {
  const meepleImg = favMeeple ? (MEEPLE_IMGS[favMeeple] ?? null) : null;
  const [flipped, setFlipped] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  // Flip on card click, but let the expand arrow and game-link buttons work normally
  const handleFlip = (e) => {
    if (e.target.closest('button')) return;
    setFlipped(v => !v);
  };
  return (
    <div className={`player-card-flip${flipped ? ' flipped' : ''}`}>
      <div className="player-card-flip-inner">
        <div className={`player-card player-card-front ${colorClass}`} onClick={handleFlip}>
      {isLeader && <img src={crownImg} alt="Leader" className="card-crown" />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', paddingRight: isLeader ? '60px' : 0 }}>
        {meepleImg && (
          <ValInfo tip={favMeepleCount ? `Used in ${favMeepleCount} ${favMeepleCount === 1 ? 'game' : 'games'}` : null}>
            <img src={meepleImg} alt="Favorite meeple" style={{ height: '24px', width: 'auto', opacity: 0.85, position: 'relative', top: '-3px' }} />
          </ValInfo>
        )}
        <div className="player-card-name" style={{ margin: 0 }}>{name}</div>
        {progress != null && (
          <ValInfo tip={`${rankTitle(progress.rank)} — view milestones`} placement="above">
            <button type="button" className="player-card-rank-badge" onClick={() => setShowProgress(true)}>Rank {progress.rank}</button>
          </ValInfo>
        )}
      </div>

      {showProgress && progress != null && (
        <MemberProgressModal
          name={name}
          rank={progress.rank}
          categoryProgress={progress.categoryProgress}
          onClose={() => setShowProgress(false)}
        />
      )}

      <div className="milestones-subtitle">Player Stats</div>

      <div className="stat-row">
        <span className="stat-label">Victories</span>
        <span className="stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Defeats</span>
        <span className="stat-value" style={{ color: 'var(--deep-red)' }}>{stats.losses}</span>
      </div>

      <div className="stat-row">
        <span className="stat-label">Win rate</span>
        <ValInfo tip={`${stats.wins} won / ${stats.total} total`}><WinRateBadge rate={stats.winRate} /></ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">High score</span>
        {stats.highScoreGame && onNavigateToGame ? (
          <button
            type="button"
            onClick={() => onNavigateToGame(stats.highScoreGame)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}
          >
            <span className="stat-value" style={{ color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{stats.highScore}</span>
          </button>
        ) : (
          <span className="stat-value">{stats.highScore}</span>
        )}
      </div>
      <div className="stat-row">
        <span className="stat-label">Streak</span>
        <span className="stat-value" style={{
          color: stats.winStreak > 0 ? 'var(--forest-green)' : stats.lossStreak > 0 ? 'var(--deep-red)' : 'inherit',
        }}>
          {stats.winStreak > 0 ? `W${stats.winStreak}` : stats.lossStreak > 0 ? `L${stats.lossStreak}` : '—'}
        </span>
      </div>

      {stats.total > 0 && (
        <div className="stat-row">
          <span className="stat-label">Point differential</span>
          <span className="stat-value" style={{ color: stats.netPtDiff > 0 ? 'var(--forest-green)' : stats.netPtDiff < 0 ? 'var(--deep-red)' : 'inherit' }}>
            {stats.netPtDiff > 0 ? `+${stats.netPtDiff}` : stats.netPtDiff}
          </span>
        </div>
      )}
      <div className="stat-row">
        <span className="stat-label">Farm</span>
        <ValInfo tip={stats.farm !== null ? `${stats.farmWins} farm win / ${stats.wins} total wins` : null}>
          <span className="stat-value">{stats.farm !== null ? `${stats.farm}%` : '—'}</span>
        </ValInfo>
      </div>
      <div className="stat-row">
        <span className="stat-label">Clutch factor</span>
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
        <span className="stat-label">Biggest blowout</span>
        {stats.biggestBlowout > 0 && stats.biggestBlowoutGame && onNavigateToGame ? (
          <button
            type="button"
            onClick={() => onNavigateToGame(stats.biggestBlowoutGame)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}
          >
            <span className="stat-value" style={{ color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>+{stats.biggestBlowout}</span>
          </button>
        ) : (
          <span className="stat-value">{stats.biggestBlowout > 0 ? `+${stats.biggestBlowout}` : '—'}</span>
        )}
      </div>

        </div>

        <div className={`player-card player-card-back ${colorClass}`} onClick={handleFlip}>
          <TrophyBack name={name} tallies={tallies} />
        </div>
      </div>
    </div>
  );
}
