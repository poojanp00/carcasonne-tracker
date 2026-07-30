import { useState, useEffect, useRef } from 'react';
import ValInfo from './ValInfo';
import MemberProgressModal from './MemberProgressModal';
import PointBreakdownChart from './PointBreakdownChart';
import ScoreTimelineChart from './ScoreTimelineChart';
import { transformMaxFeaturesToUI } from '../utils/achievements';
import { getMeepleColor, getToday, formatDurationHMS, formatDateDigital } from '../utils/formatters';
import { computeWinners } from '../utils/scoring';
import { chestFor } from '../data/chests';
import { rankTitle, RANK_TITLES } from '../utils/metaRank';
import { STATISTICS_CONFIG } from '../constants';
import pigImg    from '../../images/icons/pig.png';
import cImg      from '../../images/icons/C.png';
import goldImg   from '../../images/icons/gold.png';
import silverImg from '../../images/icons/silver.png';
import bronzeImg from '../../images/icons/bronze.png';

// Dynamically load all meeple PNGs (root + fun/)
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

// Fits the longest possible rank title ("Realmkeeper") so every standings
// row's rank badge — and so the whole row, alongside the name/score columns'
// own fixed widths — lands at the same width regardless of this game's
// actual (usually shorter) titles.
const RANK_BADGE_MIN_CH = Math.max(...RANK_TITLES.map(t => t.length));

// 1st/2nd/3rd place medals — indexed by row position (sortedPlayers is
// already in score order), shown to the left of the standings box. Fixed
// MEDAL_SIZE reserved for every row (even 4th place and below, via an empty
// placeholder) so every box's left edge still lines up in one column.
const PLACE_MEDALS = [goldImg, silverImg, bronzeImg];
const MEDAL_SIZE = 40;

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

      {/* Info bar: date (left) · clutch/farm stickers (centered) · duration
          (right) — mirrors the logbook lightbox's info bar (see Lightbox.jsx):
          expansions live in their own box near the bottom, below the score
          timeline, instead of crowding this line. Date and duration share
          the same LED stadium-clock look (.game-clock-digits--record) and
          the same fixed width, so the middle segment's flex: 1 auto-centers
          the stickers in the true middle of the bar, not just "whatever
          space is left" — no pipe divider needed between date/duration and
          the stickers now that they're in their own segment instead of
          crammed into one group. */}
      <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div className="game-clock">
          <div className="game-clock-housing">
            <span className="game-clock-digits game-clock-digits--record">{formatDateDigital(date)}</span>
          </div>
        </div>
        <div style={{ flex: '1 1 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
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
        <div className="game-clock">
          <div className="game-clock-housing">
            <span className="game-clock-digits game-clock-digits--record">{formatDurationHMS(gameDuration)}</span>
          </div>
        </div>
      </div>

      <div className="tile-card" style={{ marginBottom: '1.4rem', borderTop: '4px solid var(--warm-gold)' }}>
        <div className="chart-header" style={{ margin: '0 0 1rem', textAlign: 'left' }}>Standings</div>
        {/* Player cards with final scores and ranking */}
        <div className="postgame-scores-grid">
          {sortedPlayers.map((name, i) => {
            const color    = getMeepleColor(meeples[name]);
            const progress = progressByName[name.toLowerCase()] ?? null;
            return (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {PLACE_MEDALS[i] ? (
                  <img src={PLACE_MEDALS[i]} alt={`${i + 1} place`} style={{ height: MEDAL_SIZE, width: 'auto', flexShrink: 0 }} />
                ) : (
                  <span style={{ flexShrink: 0, width: MEDAL_SIZE }} />
                )}
                <div className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto', flexShrink: 0 }} />
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
                        on the score timeline instead of here (see ScoreTimelineChart.jsx). */}
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
                {/* Rank now sits outside the parchment box, to its right — same
                    box-button look used everywhere else (.player-card-rank-badge,
                    see PlayerCard.jsx) rather than crowded in between name and
                    score. Reserves the same slot whether or not this player has a
                    rank (minWidth fits the longest possible title) — so a row
                    without one doesn't shift its box out of line with the rest. */}
                {progress != null ? (
                  <button
                    type="button"
                    className="player-card-rank-badge"
                    style={{ flexShrink: 0, minWidth: `${RANK_BADGE_MIN_CH}ch`, textAlign: 'center' }}
                    onClick={() => setShowProgressFor(name)}
                  >
                    {rankTitle(progress.rank)}
                  </button>
                ) : (
                  // Same class (not just a bare span with a matching
                  // minWidth) plus an explicit display: inline-block — a
                  // plain <span> is display: inline by default, and
                  // min-width has NO effect on inline elements at all (it's
                  // not just a font-size/ch mismatch, the old placeholder
                  // was silently collapsing to its own zero-width empty
                  // content), while the real badge is a <button>
                  // (inline-block by default) where min-width genuinely
                  // applies. Forcing inline-block here is what actually
                  // reserves an identical box, independent of content.
                  // visibility: hidden (not display: none) keeps that box
                  // in flow while showing nothing.
                  <span
                    aria-hidden="true"
                    className="player-card-rank-badge"
                    style={{ display: 'inline-block', flexShrink: 0, minWidth: `${RANK_BADGE_MIN_CH}ch`, textAlign: 'center', visibility: 'hidden' }}
                  />
                )}
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
          <ScoreTimelineChart timeline={scoreTimeline} players={players} duration={gameDuration} achievements={uiAchievements} />
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
