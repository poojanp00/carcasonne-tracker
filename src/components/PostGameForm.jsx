import { useState, useEffect, useRef } from 'react';
import MemberProgressModal from './MemberProgressModal';
import PointBreakdownChart from './PointBreakdownChart';
import ScoreTimelineChart from './ScoreTimelineChart';
import { transformMaxFeaturesToUI } from '../utils/achievements';
import { getMeepleColor, getToday, formatDurationHMS, formatDateDigital } from '../utils/formatters';
import { computeWinners } from '../utils/scoring';
import { chestFor } from '../data/chests';
import { STATISTICS_CONFIG } from '../constants';
import scrollCapTop    from '../../images/icons/scroll-cap-top.png';
import scrollCapBottom from '../../images/icons/scroll-cap-bottom.png';

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

  // App.jsx's handleFinishGame already calls window.scrollTo(0, 0) when it
  // swaps Board out for this form, but that fires in the same synchronous
  // handler that flips session.finalScores — before this component actually
  // exists in the DOM. A signed-in account never notices: the auto-submit
  // effect right below fires almost immediately and navigates away again.
  // A guest skips that auto-submit and actually sits on this page, which is
  // where a pre-mount scroll reset is most likely to not stick on mobile.
  // Scrolling again here, after mount, is what actually guarantees it.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Headline records (Longest Road, Largest City, …) — passed to
  // ScoreTimelineChart below, which plots them as badges on the timeline.
  const uiAchievements = transformMaxFeaturesToUI(maxFeatures);

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

      {/* Info bar: date (left) · realm name (centered) · duration (right) —
          mirrors the logbook lightbox's info bar (see Lightbox.jsx);
          expansions live in their own box near the bottom, below the score
          timeline, instead of crowding this line. Date and duration share
          the same LED stadium-clock look (.game-clock-digits--record) and
          the same fixed width, so the middle segment's flex: 1 auto-centers
          the realm name in the true middle of the bar. The clutch/farm win
          stickers that used to live in this middle segment now sit next to
          the "Score Timeline" title instead (see ScoreTimelineChart.jsx). */}
      <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', flexWrap: 'nowrap', gap: '1rem', alignItems: 'center' }}>
        <div className="game-clock">
          <div className="game-clock-housing">
            <span className="game-clock-digits game-clock-digits--record">{formatDateDigital(date)}</span>
          </div>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {realm && <h2 style={{ margin: 0, color: 'var(--earth-brown)', textAlign: 'center', fontSize: 'clamp(0.4rem, 3.4vw, 1.3rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{realm.name}</h2>}
        </div>
        <div className="game-clock">
          <div className="game-clock-housing">
            <span className="game-clock-digits game-clock-digits--record">{formatDurationHMS(gameDuration)}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto 0.5rem' }}>
        <div className="standings-scroll-top">
          <img src={scrollCapTop} alt="" className="standings-scroll-cap" />
          <div className="chart-header standings-scroll-title">Standings</div>
        </div>
        <div className="standings-scroll-body">
        {/* Player cards with final scores and ranking */}
        <div className="postgame-scores-grid">
          {sortedPlayers.map((name) => {
            const color    = getMeepleColor(meeples[name]);
            const progress = progressByName[name.toLowerCase()] ?? null;
            return (
              <div
                key={name}
                className={`postgame-player-card${progress != null ? ' postgame-player-card--clickable' : ''}`}
                style={{ borderLeft: `3px solid ${color}`, cursor: progress != null ? 'var(--cursor-pointer)' : 'var(--cursor-arrow)' }}
                onClick={progress != null ? () => setShowProgressFor(name) : undefined}
              >
                <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 'clamp(18px, 5vw, 26px)', width: 'auto', flexShrink: 0 }} />
                  {/* Name — every row shares one font size and width (both set by
                      the longest name) so scores line up directly to the right of
                      the longest name across every row */}
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
                  {/* Score — a bit of breathing room after the name, now that the
                      box is content-sized rather than stretched edge-to-edge (see
                      .postgame-scores-grid). Headline-record medal chips now live
                      on the score timeline instead of here (see ScoreTimelineChart.jsx).
                      The rank badge that used to sit to the right of this card is
                      gone — the whole card is the click target now (see onClick
                      above), only when this player actually has a rank to show. */}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    marginLeft: '1.5rem',
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
        <img src={scrollCapBottom} alt="" className="standings-scroll-cap" />
      </div>

      {showProgressFor != null && progressByName[showProgressFor.toLowerCase()] != null && (
        <MemberProgressModal
          // Forces a fresh mount every time a card is clicked — including
          // clicking the SAME player again after closing — so the before→
          // after fill animation actually replays each time rather than
          // reusing an already-settled instance.
          key={showProgressFor}
          name={showProgressFor}
          rank={progressByName[showProgressFor.toLowerCase()].rank}
          tierCount={progressByName[showProgressFor.toLowerCase()].tierCount}
          categoryProgress={progressByName[showProgressFor.toLowerCase()].categoryProgress}
          beforeRank={progressByName[showProgressFor.toLowerCase()].beforeRank}
          beforeTierCount={progressByName[showProgressFor.toLowerCase()].beforeTierCount}
          beforeCategoryProgress={progressByName[showProgressFor.toLowerCase()].beforeCategoryProgress}
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
          <ScoreTimelineChart timeline={scoreTimeline} players={players} duration={gameDuration} achievements={uiAchievements} isClutch={isClutch} farmWin={autoFarmWin} />
        </div>
      )}

      {/* Expansions — own box near the bottom, below the score timeline (see Lightbox.jsx) */}
      <div style={{ marginTop: '1.4rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem' }}>
        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 'clamp(0.8rem, 2.2vw, 0.95rem)', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
          {prefillExp.length === 0 ? 'Base Game' : prefillExp.join(' · ')}
        </div>
      </div>

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
