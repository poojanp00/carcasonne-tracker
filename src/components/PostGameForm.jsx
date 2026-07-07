import { useState, useEffect, useRef } from 'react';
import { ACHIEVEMENT_DISPLAY_ORDER } from './GameHighlights';
import RecordBadge from './RecordBadge';
import PointBreakdownChart from './PointBreakdownChart';
import ScoreTimelineChart from './ScoreTimelineChart';
import { transformMaxFeaturesToUI } from '../utils/achievements';
import { getMeepleColor, getToday } from '../utils/formatters';
import { computeWinners } from '../utils/scoring';
import { STATISTICS_CONFIG } from '../constants';
import pigImg   from '../../images/icons/pig.png';
import cImg     from '../../images/icons/C.png';

// Dynamically load all meeple PNGs (root + fun/)
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];


export default function GameLogForm({ session, ownedExpansions, onSubmit, onCancel, onPlayAgain, isGuest = false }) {
  const { players = [], meeples = {}, expansions: prefillExp = [], finalScores = {}, scoreBreakdown = {}, farmWin: autoFarmWin = false, gameDuration = 0, maxFeatures = {}, scoreTimeline = [] } = session || {};

  const [date, setDate] = useState(getToday);
  const [submitted, setSubmitted] = useState(false);
  const hasAutoSubmitted = useRef(false);

  // Auto-submit for logged-in users
  useEffect(() => {
    if (!isGuest && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      // Trigger form submission
      const form = document.querySelector('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    }
  }, [isGuest]);

  const scoreNums    = players.map(p => Number(finalScores[p]) || 0);
  const { winners, maxScore } = computeWinners(Object.fromEntries(players.map(p => [p, finalScores[p]])));
  const sortedPlayers = [...players].sort((a, b) => (Number(finalScores[b]) || 0) - (Number(finalScores[a]) || 0));

  const sortedScores = [...scoreNums].sort((a, b) => b - a);
  const s1 = sortedScores[0] ?? 0, s2 = sortedScores[1] ?? 0;
  const combined = s1 + s2;
  const isClutch = winners.length === 1 && combined > 0 && (s1 - s2) / combined < STATISTICS_CONFIG.CLUTCH_THRESHOLD;

  // Group headline records (Longest Road, Largest City, …) by their holder,
  // so they render as medal chips beside each player's name
  const badgesByPlayer = {};
  const uiAchievements = transformMaxFeaturesToUI(maxFeatures);
  ACHIEVEMENT_DISPLAY_ORDER.forEach(key => {
    const a = uiAchievements[key];
    if (!a?.player) return;
    (badgesByPlayer[a.player] = badgesByPlayer[a.player] || []).push({ key, amount: a.amount });
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      date,
      winners: [...winners],
      maxScore: maxScore,
      players: players.map(name => ({
        name,
        score:     parseInt(finalScores[name], 10) || 0,
        meeple:    meeples[name] || Object.keys(MEEPLE_IMGS)[0],
        breakdown: scoreBreakdown[name] || {},
      })),
      expansions: [...prefillExp].sort(),
      farmWin:   autoFarmWin,
      clutchWin: isClutch,
      gameDuration: session.gameDuration, // Game duration in milliseconds
      maxFeatures, // Live-tracked largest features per category
      scoreTimeline, // Scoring events with elapsed-time offsets for the swing chart
    });
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">
        <h2>Final Scores</h2>
        <div className="section-title-line" />
      </div>

      {/* Player scores */}
      <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {Math.floor(gameDuration / 60000)}m {Math.floor((gameDuration % 60000) / 1000)}s
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {prefillExp.length === 0 ? 'Base Game' : prefillExp.join(' · ')}
        </div>
        {(isClutch || autoFarmWin) && (
          <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        )}
        {isClutch && (
          <span className="val-info-wrap">
            <img src={cImg} alt="clutch" style={{ height: 20, width: 'auto', opacity: 0.85, display: 'block' }} />
            <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Clutch win</span>
          </span>
        )}
        {autoFarmWin && (
          <span className="val-info-wrap">
            <img src={pigImg} alt="farm win" style={{ height: 16, width: 'auto', opacity: 0.85, display: 'block' }} />
            <span className="val-info-tooltip" style={{ right: 'auto', left: '50%', top: 'auto', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>Farm win</span>
          </span>
        )}
      </div>

      <div className="tile-card" style={{ marginBottom: '1.4rem', borderTop: '4px solid var(--warm-gold)' }}>
        <div className="chart-header" style={{ margin: '0 0 1rem', textAlign: 'left' }}>Standings</div>
        {/* Player cards with final scores and ranking */}
        <div className="postgame-scores-grid">
          {sortedPlayers.map((name) => {
            const color    = getMeepleColor(meeples[name]);
            return (
              <div key={name} className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '0.5rem', rowGap: '0.4rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto', flexShrink: 0 }} />
                  {/* Col 1: name — hard-fixed width so every row's columns match and
                      badge strips wrap at the same screen width */}
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    color,
                    fontWeight: 600,
                    fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)',
                    flexShrink: 0,
                    width: 'clamp(72px, 24vw, 130px)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {name}
                  </span>
                  {/* Col 2: score — fixed width so every row's columns match */}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    width: 'calc(4ch + 2.5rem)',
                    borderLeft: '1px solid rgba(201,163,74,0.35)',
                    padding: '0 1rem 0 1.5rem',
                    alignSelf: 'stretch',
                  }}>
                    <div className="postgame-score-display">
                      {finalScores[name] ?? 0}
                    </div>
                  </span>
                  {/* Col 3: medal chips — right-aligned; wraps below name+score on thin screens
                      (where CSS drops the divider and left-aligns the strip) */}
                  {(badgesByPlayer[name] || []).length > 0 && (
                    <span className="lb-badge-col" style={{ flex: '1 1 52px', minWidth: 0, overflowX: 'auto', display: 'flex', alignSelf: 'stretch', alignItems: 'center' }}>
                      <span className="lb-badge-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {badgesByPlayer[name].map(({ key, amount }) => (
                          <RecordBadge key={key} badgeKey={key} amount={amount} size="clamp(32px, 9vw, 48px)" />
                        ))}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Points breakdown chart */}
      <PointBreakdownChart
        players={sortedPlayers.map(name => ({ name, breakdown: scoreBreakdown[name] || {} }))}
      />

      {/* Score swing timeline */}
      {scoreTimeline.length > 0 && (
        <div style={{ marginTop: '1.4rem' }}>
          <ScoreTimelineChart timeline={scoreTimeline} players={players} duration={gameDuration} />
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1rem', marginTop: '1.4rem' }}>
        {!submitted && onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>← Back</button>
        )}
        {!submitted && isGuest && (
          <button type="submit" className="btn">Sign In to Save Game</button>
        )}
        {submitted && !isGuest && (
          <button type="button" className="btn" onClick={onPlayAgain} style={{ marginLeft: 'auto' }}>Play Again</button>
        )}
      </div>
    </form>
  );
}
