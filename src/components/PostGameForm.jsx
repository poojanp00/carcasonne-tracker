import { useState, useEffect, useRef } from 'react';
import { ACHIEVEMENT_DISPLAY_ORDER } from './GameHighlights';
import RecordBadge from './RecordBadge';
import ValInfo from './ValInfo';
import MemberProgressModal from './MemberProgressModal';
import PointBreakdownChart from './PointBreakdownChart';
import ScoreTimelineChart from './ScoreTimelineChart';
import { transformMaxFeaturesToUI } from '../utils/achievements';
import { getMeepleColor, getToday, formatDurationHMS } from '../utils/formatters';
import { computeWinners } from '../utils/scoring';
import { chestFor } from '../data/chests';
import { rankTitle } from '../utils/metaRank';
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

// Longer player names get a smaller font instead of being truncated with an ellipsis.
// Takes a character count (the longest name in the list) so every row can share one size.
function nameFontSize(len) {
  if (len <= 7)  return 'clamp(0.8rem, 2.2vw, 0.95rem)';
  if (len <= 10) return 'clamp(0.7rem, 1.9vw, 0.85rem)';
  if (len <= 13) return 'clamp(0.62rem, 1.7vw, 0.75rem)';
  if (len <= 17) return 'clamp(0.55rem, 1.5vw, 0.66rem)';
  return 'clamp(0.48rem, 1.3vw, 0.58rem)';
}

export default function GameLogForm({ session, ownedExpansions, onSubmit, onCancel, onPlayAgain, onExitToHub, isGuest = false, progressByName = {}, isRecording = false }) {
  const { players = [], meeples = {}, expansions: prefillExp = [], finalScores = {}, scoreBreakdown = {}, farmWin: autoFarmWin = false, gameDuration = 0, maxFeatures = {}, scoreTimeline = [], realm } = session || {};

  const [date, setDate] = useState(getToday);
  const [submitted, setSubmitted] = useState(false);
  const [showProgressFor, setShowProgressFor] = useState(null); // player name, or null
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

  // ArrowLeft mirrors the chest icon / "← Back" button — same shortcut
  // PreGameSetup and the scoreboard use for their own "back" action. Only
  // live pre-submit, same as the Back button itself (see its render below).
  useEffect(() => {
    if (submitted || !onCancel) return;
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;
      onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitted, onCancel]);

  const scoreNums    = players.map(p => Number(finalScores[p]) || 0);
  const { winners, maxScore } = computeWinners(Object.fromEntries(players.map(p => [p, finalScores[p]])));
  const sortedPlayers = [...players].sort((a, b) => (Number(finalScores[b]) || 0) - (Number(finalScores[a]) || 0));
  // Every name renders at the same size/width — set by the longest name — so
  // the score column lines up in the same spot across every player row
  const maxNameLen = Math.max(...sortedPlayers.map(n => n.length));

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
  // Every player's badge column reserves the same width — the widest badge
  // holder's count — so rows stay aligned even when some players have none
  const maxBadgeCount = Math.max(0, ...Object.values(badgesByPlayer).map(list => list.length));

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

  // Full-page gate: while the save + celebration fetch are in flight, show
  // nothing but a loading message rather than letting Final Scores render
  // immediately and then have rank badges/celebration modals pop in once the
  // network round-trip resolves a moment later. The <form> itself must stay
  // mounted regardless (the auto-submit effect above dispatches a synthetic
  // submit event via document.querySelector('form')).
  const showLoadingGate = !isGuest && isRecording;

  return (
    <form onSubmit={handleSubmit}>
      {showLoadingGate ? (
        <div className="loading-state">Recording game…</div>
      ) : (
      <>
      <div className="section-title">
        {realm && (
          !submitted && onCancel ? (
            <button type="button" className="section-title-back" onClick={onCancel} title="Back to the board">
              <span aria-hidden="true">‹</span>
              <img className="realm-chest-icon" src={chestFor(realm)} alt="" />
            </button>
          ) : submitted && onExitToHub ? (
            <button type="button" className="section-title-back" onClick={onExitToHub} title="Back to the realms hub">
              <span aria-hidden="true">‹</span>
              <img className="realm-chest-icon" src={chestFor(realm)} alt="" />
            </button>
          ) : (
            <img className="realm-chest-icon" src={chestFor(realm)} alt="" />
          )
        )}
        <h2>Final Scores</h2>
        <div className="section-title-line" />
        {realm && <span className="game-count">{realm.name}</span>}
      </div>

      {/* Player scores */}
      <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div className="game-clock">
          <div className="game-clock-housing">
            <span className="game-clock-digits game-clock-digits--record">{formatDurationHMS(gameDuration)}</span>
          </div>
        </div>
        <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {prefillExp.length === 0 ? 'Base Game' : prefillExp.join(' · ')}
        </div>
        {(isClutch || autoFarmWin) && (
          <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
        )}
        {isClutch && (
          <ValInfo tip="Clutch win" placement="above">
            <img src={cImg} alt="clutch" style={{ height: 20, width: 'auto', opacity: 0.85, display: 'block' }} />
          </ValInfo>
        )}
        {autoFarmWin && (
          <ValInfo tip="Farm win" placement="above">
            <img src={pigImg} alt="farm win" style={{ height: 16, width: 'auto', opacity: 0.85, display: 'block' }} />
          </ValInfo>
        )}
      </div>

      <div className="tile-card" style={{ marginBottom: '1.4rem', borderTop: '4px solid var(--warm-gold)' }}>
        <div className="chart-header" style={{ margin: '0 0 1rem', textAlign: 'left' }}>Standings</div>
        {/* Player cards with final scores and ranking */}
        <div className="postgame-scores-grid">
          {sortedPlayers.map((name) => {
            const color    = getMeepleColor(meeples[name]);
            const progress = progressByName[name.toLowerCase()] ?? null;
            return (
              <div key={name} className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                {/* Name/score/badges stay three columns at every width — badges
                    wrap and shrink internally instead of dropping to a new row */}
                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto', flexShrink: 0 }} />
                  {/* Col 1: name — every row shares one font size and width (both
                      set by the longest name) so scores line up directly to the
                      right of the longest name across every row */}
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    color,
                    fontWeight: 600,
                    fontSize: nameFontSize(maxNameLen),
                    flex: '0 0 auto',
                    width: `${maxNameLen}ch`,
                    whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                  {progress != null && (
                    <button
                      type="button"
                      className="player-card-rank-badge"
                      style={{ flexShrink: 0 }}
                      onClick={() => setShowProgressFor(name)}
                    >
                      {rankTitle(progress.rank)}
                    </button>
                  )}
                  {/* Col 2: medal chips — reserved at the widest badge holder's count so
                      every row matches, even players with none; badges left-align, wrap,
                      and shrink with the viewport */}
                  {maxBadgeCount > 0 && (
                    <span className="lb-badge-col" style={{ flex: `0 1 calc(${maxBadgeCount} * clamp(32px, 9vw, 48px) + ${maxBadgeCount - 1} * 0.75rem)`, minWidth: 0, display: 'flex', alignSelf: 'stretch', alignItems: 'center' }}>
                      {(badgesByPlayer[name] || []).length > 0 && (
                        <span className="lb-badge-strip" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem' }}>
                          {badgesByPlayer[name].map(({ key, amount }) => (
                            <RecordBadge key={key} badgeKey={key} amount={amount} size="clamp(32px, 9vw, 48px)" />
                          ))}
                        </span>
                      )}
                    </span>
                  )}
                  {/* Col 3: score — pushed flush to the row's right edge (marginLeft:
                      auto) regardless of whether badges are present */}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    marginLeft: 'auto',
                    padding: '0 0 0 0.5rem',
                    alignSelf: 'stretch',
                  }}>
                    <div className="game-clock">
                      <div className="game-clock-housing">
                        <span className="game-clock-digits game-clock-digits--score">{finalScores[name] ?? 0}</span>
                      </div>
                    </div>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {showProgressFor != null && progressByName[showProgressFor.toLowerCase()] != null && (
        <MemberProgressModal
          name={showProgressFor}
          rank={progressByName[showProgressFor.toLowerCase()].rank}
          categoryProgress={progressByName[showProgressFor.toLowerCase()].categoryProgress}
          onClose={() => setShowProgressFor(null)}
        />
      )}

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
      </>
      )}
    </form>
  );
}
