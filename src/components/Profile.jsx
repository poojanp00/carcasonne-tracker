import { useMemo, useState, useEffect, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { calcAccountStats } from '../utils/stats';
import { METRIC_UNITS, categoryTierState, visibleAccountMilestones } from '../data/accountMilestones';
import { getCurrentRank, countUnlockedTiers, rankTitle, getTotalTiers } from '../utils/metaRank';
import QuarterTierBar from './QuarterTierBar';
import RankQuarterBar from './RankQuarterBar';
import { MEEPLE_IMGS, TYPE_LABELS } from './StatWidgets';
import { ACHIEVEMENT_DISPLAY_ORDER, ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';

import { formatAchievementName } from '../utils/achievements';
import { getExpansions } from '../data/storage';
import { DEMO_GAMES, DEMO_REALMS, DEMO_USER_ID, DEMO_USER_NAME } from '../data/demoData';
import ValInfo from './ValInfo';
import Lightbox from './Lightbox';
import { GearIcon, TrashIcon } from './icons';
import { ProfileHowToModal } from './HowToGuide';
import { RankUpRankBar } from './RankUpModal';

// The 5 base color meeples, no fun/reskinned ones — a fresh account with
// no favorite meeple yet (nothing played) gets one of these assigned
// instead of showing no meeple at all on the hero card. Picked
// deterministically from `userId` (not truly random) so it's the same
// meeple on every visit until a real favorite meeple takes over, rather
// than reshuffling on every reload.
const DEFAULT_MEEPLE_POOL = ['1yellow.png', '2pink.png', '3blue.png', '4ered.png', '5green.png'];
function pickDefaultMeeple(userId) {
  if (!userId) return DEFAULT_MEEPLE_POOL[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return DEFAULT_MEEPLE_POOL[Math.abs(hash) % DEFAULT_MEEPLE_POOL.length];
}

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
// the type and amount, same tooltip as the realm point-breakdown chart. The
// ▼ below it reveals a one-row table (same column styling as the
// PostGameForm/Logbook breakdown tables) — just this account's own totals,
// so there's no per-player sort/combine toggle to speak of, only the table.
function PointsBar({ breakdown }) {
  const [tooltip, setTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
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
    <div style={{ margin: '0.35rem 0 0.7rem' }}>
      <div ref={barsRef} style={{ position: 'relative' }} onMouseLeave={() => setTooltip(null)}>
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

      <button
        type="button"
        onClick={() => setShowTable(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'var(--cursor-pointer)', padding: '0.3rem 0 0', color: 'var(--stone-gray)', fontSize: '0.65rem', fontFamily: 'Cinzel, serif', opacity: 0.6 }}
        aria-label={showTable ? 'Hide points breakdown table' : 'Show points breakdown table'}
      >
        {showTable ? '▲' : '▼'}
      </button>

      {showTable && (
        <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {types.map(t => (
                  <th key={t} style={{ padding: '0.25rem 0.4rem', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 'clamp(0.52rem, 1.4vw, 0.65rem)', textAlign: 'center', color: 'var(--stone-gray)', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '2px', backgroundColor: SCORE_TYPE_COLORS[t], display: 'inline-block', flexShrink: 0 }} />
                      {TYPE_LABELS[t] ?? t}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid rgba(201,163,74,0.2)' }}>
                {types.map(t => (
                  <td key={t} style={{ padding: '0.35rem 0.4rem', textAlign: 'center', fontFamily: 'Crimson Text, serif', fontSize: 'clamp(0.7rem, 1.8vw, 0.9rem)', color: 'var(--charcoal)' }}>
                    {breakdown[t].toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const sectionHeaderStyle = { borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.5rem', marginBottom: '1rem' };

// "All Milestones" carousel slide — every category has exactly 4 tiers, so
// instead of a bar scaled to real point thresholds (where an early tier's
// tiny gap next to a huge later one leaves no room for its own label), the
// bar is chopped into 4 EQUAL quarters, one per tier, each independently
// filled by how far progress has gotten through THAT tier's own point range
// (0%, a partial fraction, or fully chunked off once earned). Every quarter
// is a fixed 25% of the width no matter the category, so there's always
// guaranteed room to print that tier's full name underneath it — labels can
// wrap onto a second line rather than needing to fit on one, unlike every
// other page here.
// Renders bare (no outer card wrapper) — the caller (ProfileHero's flip-card
// back face) already supplies its own card chrome.
function AllMilestonesQuarterCard({ account }) {
  const started = visibleAccountMilestones(account);
  return (
    <>
      <div className="milestone-card-header">
        <span className="milestone-card-name">Milestones</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.3rem' }}>
        {started.map(cat => {
          const { progress, currentTier, nextTier, remaining, reached, maxed } = categoryTierState(cat, account);
          const unit = METRIC_UNITS[cat.metric] ?? 'pts';
          const pips = '★'.repeat(reached.length) + '☆'.repeat(Math.max(0, cat.tiers.length - reached.length));
          return (
            <div key={cat.id}>
              <div style={{ marginBottom: '0.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                <span className="rankup-category-label">
                  {cat.label}
                  <span className="rankup-category-progress">
                    ({progress.toLocaleString()} {unit})
                  </span>
                </span>
                <span className="rankup-tier-stars" aria-label={`${reached.length} of ${cat.tiers.length} tiers unlocked`}>
                  {pips}
                </span>
              </div>
              <QuarterTierBar tiers={cat.tiers} progress={progress} unit={unit} currentTier={currentTier} nextTier={nextTier} remaining={remaining} maxed={maxed} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// Trophy cabinet: one medal per time each best-in-game record was held —
// 7 Longest Roads shows 7 medals in the row. Renders in its own card beside
// Career Highlights, stacking below it on narrow screens.
function TrophyCabinet({ account }) {
  const { recordTallies } = account;
  const tallied = ACHIEVEMENT_DISPLAY_ORDER.filter(key => recordTallies[key]?.count > 0);
  return (
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
              {/* Best actual amount (e.g. the real longest-road length) on
                  hover — same treatment as the Logbook roster page's own
                  Trophy Cabinet (PlayerCard.jsx's TrophyBack/ValInfo tip),
                  rather than printing it inline. Anchored to the left
                  (same line as the badge) rather than above it. */}
              <ValInfo
                tip={`Best: ${recordTallies[key].best}`}
                placement="left"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'var(--cursor-pointer)' }}
              >
                <img src={ACHIEVEMENT_BADGE[key]} alt={ACHIEVEMENT_LABEL_OVERRIDE[key] ?? formatAchievementName(key)} style={{ height: '44px', width: 'auto' }} draggable={false} />
                <span className="stat-value" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>×{recordTallies[key].count}</span>
              </ValInfo>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The strategy-game hero card: large meeple, name, rank title, and the
// primary career numbers at a glance. Flips (click anywhere but a button)
// to reveal the account's full milestones breakdown on the back — same
// flip mechanic/hover-lift affordance as a Fellowship PlayerCard. Flip state
// is owned by the parent (see Profile's heroFlipped/handleHeroFlip) rather
// than locally, so the guided tour can drive it in lockstep with its own
// step — this component just renders whatever `flipped` it's given.
function ProfileHero({ account, userId, displayName, title, tierCount, totalTiers, onOpenSettings, heroRef, highlighted = false, flipped, rotation = 0, onFlip, demoActive = false, realTierCount = 0 }) {
  const { stats, favMeeple, favMeepleCount, playingSince, totalPlaytime } = account;
  // No games played yet means no real favorite meeple — assigned one
  // (see pickDefaultMeeple) instead of showing an empty hero card.
  const isDefaultMeeple = !favMeeple;
  const meepleImg = MEEPLE_IMGS[favMeeple || pickDefaultMeeple(userId)] ?? null;
  const currentRank = getCurrentRank(tierCount);

  const primaryStats = [
    ['Victories', <ValInfo tip={`${stats.winRate}% win rate`}><span className="profile-stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span></ValInfo>],
    ['Milestones', <ValInfo tip={`${tierCount} of ${totalTiers} milestone tiers unlocked`}><span className="profile-stat-value">{tierCount}</span></ValInfo>],
    ['Realms', <span className="profile-stat-value">{account.realmsCount}</span>],
    ['Career Points', <span className="profile-stat-value">{stats.totalPoints.toLocaleString()}</span>],
    ['Time Played', <span className="profile-stat-value">{formatDuration(totalPlaytime)}</span>],
    ['Playing Since', <span className="profile-stat-value">{formatMonthYear(playingSince)}</span>],
  ];

  return (
    <div ref={heroRef} className={`player-card-flip${flipped ? ' flipped' : ''}${highlighted ? ' tour-highlight' : ''}`} style={{ marginBottom: '1.2rem' }}>
      {/* rotation (not just the flipped on/off class) drives the actual
          transform here — repeated ArrowRight/ArrowLeft/Enter presses (see
          Profile's keyboard shortcut) keep accumulating past a single
          180deg turn, so mashing one direction spins the card through full
          360deg turns instead of just snapping between the two faces. A
          plain click still only moves it one half-turn at a time. */}
      <div className="player-card-flip-inner" style={{ transform: `rotateY(${rotation * 180}deg)` }}>
        <div className="player-card p2 profile-hero player-card-front" onClick={onFlip}>
          {onOpenSettings && (
            <button type="button" className="profile-settings-btn" onClick={onOpenSettings} title="Account settings" aria-label="Account settings">
              <GearIcon />
            </button>
          )}
          <div className="profile-hero-top">
            {meepleImg && (
              <ValInfo tip={isDefaultMeeple ? null : (favMeepleCount ? `Used in ${favMeepleCount} ${favMeepleCount === 1 ? 'game' : 'games'}` : null)}>
                <img src={meepleImg} alt={isDefaultMeeple ? 'Meeple' : 'Favorite meeple'} className="profile-hero-meeple" draggable={false} />
              </ValInfo>
            )}
            <div>
              <div className="profile-hero-name">{displayName || 'Adventurer'}</div>
              <span className="profile-hero-title" style={{ display: 'block' }}>{title}</span>
            </div>
          </div>

          {/* While the guided tour's demo data is active, replay the same
              rank-up celebration reveal RankUpModal uses for a real rank-up
              — mounting fresh (see the demoActive branch swap) each time the
              tour (re)starts, so the ladder climbs from the guest's real
              rank up through the demo's, one rank at a time, instead of
              jumping straight to the end. */}
          {demoActive ? (
            <RankUpRankBar
              beforeRank={getCurrentRank(realTierCount)}
              afterRank={currentRank}
              beforeTierCount={realTierCount}
              tierCount={tierCount}
            />
          ) : (
            <RankQuarterBar tierCount={tierCount} currentRank={currentRank} />
          )}

          <div className="profile-hero-stats">
            {primaryStats.map(([label, value]) => (
              <div key={label} className="profile-stat">
                {value}
                <span className="profile-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="player-card p2 profile-hero player-card-back" onClick={onFlip}>
          <AllMilestonesQuarterCard account={account} />
        </div>
      </div>
    </div>
  );
}

// Career-defining records — its own card beside the Trophy Cabinet
function CareerHighlights({ account, onNavigateToGame }) {
  const { stats, rival, biggestPlay, fastestWin, highestCombined, sweeps, favExpansions } = account;

  return (
      <div className="stat-rows-narrow" style={{ margin: 0 }}>
          <div className="tile-card-header" style={sectionHeaderStyle}>Career Highlights</div>
          <PointsBar breakdown={account.breakdown} />
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
                    <span className="stat-value" style={{ fontSize: 'clamp(0.72rem, 1.8vw, 0.92rem)', fontWeight: 500 }}>{fav ? fav.name : '—'}</span>
                  </ValInfo>
                </div>
              ))}
            </div>
          </div>
      </div>
  );
}

export default function Profile({ games: realGames, realms: realRealms, userId: realUserId, displayName: realDisplayName, isGuest = false, tourShown = false, onTourShown = null, autoStartTour = false, onAutoStartTourConsumed = null, onTourComplete = null, storedMetaRank = 0, onGuestMetaRankAchieved = null, onChangeDisplayName, onDeleteAccount, onSignOut }) {
  const [selectedGame, setSelectedGame] = useState(null);

  // Guided tour opened from the "?" button: null = closed, 0-3 = which
  // PROFILE_STEPS entry is showing. Next/Back scroll to the matching
  // section; closing (or finishing) returns to the top of the page.
  const [tourStep, setTourStep] = useState(null);
  // True while the currently-open tour was auto-started by chaining in
  // from the Realms tour completing (see App.jsx's handleRealmsTourComplete/
  // profileTourAutoStart), as opposed to a normal manual "?" open — only
  // that chained case should send the user back to Realms once this tour
  // itself finishes (see the tourStep effect below).
  const [chainedFromRealms, setChainedFromRealms] = useState(false);
  const heroRef = useRef(null);
  const careerHighlightsRef = useRef(null);
  // Hero/Career Highlights flip-cards — same click-to-flip as a Fellowship
  // PlayerCard when browsed freely, but *driven* by the tour (below) rather
  // than independently toggled while the tour is open, so each step can show
  // exactly the face it's describing. A rotation COUNT rather than a plain
  // on/off boolean — a click (or one keyboard step, see the shortcut effect
  // below) only ever moves it a single half-turn, but repeated ArrowRight/
  // ArrowLeft/Enter presses keep accumulating past that, so mashing one
  // direction spins the card through full 360deg turns rather than just
  // snapping between the two faces. Which face is actually showing is just
  // this count's parity (odd = back) — see heroFlipped/careerFlipped below.
  const [heroRotation, setHeroRotation] = useState(0);
  const [careerRotation, setCareerRotation] = useState(0);
  const heroFlipped = Math.abs(heroRotation % 2) === 1;
  const careerFlipped = Math.abs(careerRotation % 2) === 1;
  // Milestones/Trophy Cabinet now live on the BACK of the hero/career-
  // highlights flip-cards (see ProfileHero/the CareerHighlights flip below),
  // so those tour steps just re-spotlight the same physical card as the
  // step before them rather than a separate element.
  const tourRefs = [heroRef, heroRef, careerHighlightsRef, careerHighlightsRef];
  // The popup docks beside whichever section the current step spotlights.
  const tourTargetRef = tourStep !== null ? tourRefs[tourStep] : null;
  // Demo data only stands in for a guest's own account while their tour is
  // actually up — otherwise (including a guest who hasn't toured yet, or is
  // done touring) they see their own real, if sparse or empty, stats, same
  // as a signed-in account. calcAccountStats returns sane zeroed-out values
  // for 0 games (no wins, no records, "—" placeholders throughout), so
  // there's always something real to render either way; the demo persona
  // just gives the guided tour a populated account to point at.
  const demoActive = isGuest && tourStep !== null;
  const games = demoActive ? DEMO_GAMES : realGames;
  const realms = demoActive ? DEMO_REALMS : realRealms;
  const userId = demoActive ? DEMO_USER_ID : realUserId;
  const displayName = demoActive ? DEMO_USER_NAME : realDisplayName;
  const account = useMemo(() => calcAccountStats(games, realms, userId), [games, realms, userId]);
  const startTour = () => setTourStep(0);
  // Auto-opens the tour the *first* time a guest reaches this tab this
  // session (see App.jsx's guestProfileTourShown/onTourShown — lifted, not
  // local state, since this component unmounts/remounts on every tab
  // switch) — not a signed-in account, even with 0 games (that one has to
  // click "?" itself), and not a guest who's already seen it once.
  useEffect(() => {
    if (tourStep === null && isGuest && !tourShown) {
      startTour();
      onTourShown?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Chained in from the Realms tour finishing (App.jsx sets autoStartTour
  // once and expects it consumed) — fires regardless of isGuest/tourShown,
  // since the point is to continue the walkthrough the user's already in,
  // not gate on the usual first-visit-only rules.
  useEffect(() => {
    if (autoStartTour) {
      setChainedFromRealms(true);
      startTour();
      onAutoStartTourConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartTour]);
  // Mirrors RealmsTab's own completion chain: once this tour closes (either
  // by finishing all steps or being dismissed early), and it was the one
  // chained in from Realms, send the user back there to land where they
  // started.
  useEffect(() => {
    if (tourStep === null && chainedFromRealms) {
      setChainedFromRealms(false);
      onTourComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);
  useEffect(() => {
    if (tourStep === 0) {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [tourStep]);
  // Closing a game link opened mid-tour (see CareerHighlights) is owned up
  // here, not inside the Lightbox — without clearing it on every tour
  // transition, it'd visually disappear (Lightbox unmounts when the tour
  // moves on) but silently pop back open the instant any other game link
  // is clicked later, showing the same stale game.
  const advanceTour = () => {
    setSelectedGame(null);
    setTourStep(prev => {
      if (prev === 0) {
        heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 1;
      }
      if (prev === 1) {
        careerHighlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 2;
      }
      if (prev === 2) {
        careerHighlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 3;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    });
  };
  const backTour = () => {
    setSelectedGame(null);
    setTourStep(prev => {
      if (prev === 1) { heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 0; }
      if (prev === 2) { heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 1; }
      if (prev === 3) { careerHighlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 2; }
      return prev;
    });
  };
  const closeTour = () => {
    setSelectedGame(null);
    setTourStep(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Tour-driven flip: step 1 shows the hero card's back (Milestones), step 3
  // shows Career Highlights' back (Trophy Cabinet) — every other step, and
  // the tour being closed entirely (tourStep back to null, via closeTour or
  // advanceTour finishing), resets both cards to their fronts rather than
  // leaving one stuck flipped once the tour's no longer pointing at it.
  useEffect(() => {
    setHeroRotation(tourStep === 1 ? 1 : 0);
    setCareerRotation(tourStep === 3 ? 1 : 0);
  }, [tourStep]);

  // Clicking the spotlighted card itself acts exactly like clicking the
  // tour's own "Next" (advancing/finishing the tour) while a tour is open —
  // the flip itself is driven by the effect above, not toggled here — and
  // falls back to a normal independent flip (one half-turn, same as one
  // keyboard step — see the shortcut effect below) once there's no tour to
  // advance. Both still ignore clicks on a real button inside the card (the
  // hero's settings gear, CareerHighlights' game-link buttons).
  const handleHeroFlip = (e) => {
    if (e.target.closest('button')) return;
    if (tourStep !== null) { advanceTour(); return; }
    setHeroRotation(r => r + 1);
  };
  const handleCareerFlip = (e) => {
    if (e.target.closest('button')) return;
    if (tourStep !== null) { advanceTour(); return; }
    setCareerRotation(r => r + 1);
  };

  const tierCount     = useMemo(() => countUnlockedTiers(account), [account]);
  const computedRank  = getCurrentRank(tierCount);
  const displayedRank = computedRank; // always the live rank — no never-regress floor

  // Real (never demo-swapped) tier count — the guided tour's rank reveal
  // (see ProfileHero below) animates up FROM this, so a guest who's really
  // at rank 1 watches the bar climb through every rank the demo data jumps
  // them to, instead of the whole ladder just appearing already-filled.
  const realAccount   = useMemo(() => calcAccountStats(realGames, realRealms, realUserId), [realGames, realRealms, realUserId]);
  const realTierCount = useMemo(() => countUnlockedTiers(realAccount), [realAccount]);

  // Guest-only rank persistence (localStorage) — real accounts are handled
  // entirely server-side now (migrations/server_side_progress.sql), but a
  // guest has no auth user_id/user_progress row for any trigger to update,
  // so this is the only place a guest's highest-ever rank ever gets saved.
  useEffect(() => {
    if (!isGuest) return;
    if (computedRank > (storedMetaRank || 0)) onGuestMetaRankAchieved?.(computedRank);
  }, [computedRank, storedMetaRank, isGuest, onGuestMetaRankAchieved]);

  const [settingsView, setSettingsView] = useState(null); // null | 'menu' | 'rename'
  const [nameInput,    setNameInput]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [renameError,  setRenameError]  = useState('');
  const [deleteStep,   setDeleteStep]   = useState(0); // 0=hidden, 1=first confirm, 2=final confirm
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  const openGameLightbox = (game) => setSelectedGame(game);

  const openSettings  = () => setSettingsView('menu');
  const closeSettings = () => { setSettingsView(null); setRenameError(''); };
  const startRename   = () => { setNameInput(displayName || ''); setRenameError(''); setSettingsView('rename'); };

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { setRenameError('Name cannot be empty.'); return; }
    if (trimmed === displayName) { closeSettings(); return; }
    setSaving(true);
    setRenameError('');
    try {
      await onChangeDisplayName?.(trimmed);
      closeSettings();
    } catch (err) {
      setRenameError(err.message || 'Something went wrong. Please try again.');
    }
    setSaving(false);
  };

  const handleExportJson = async () => {
    // Expansions aren't passed down as props; fetch them, but never let a
    // failed fetch block the backup itself.
    let expansions = [];
    try {
      expansions = (await getExpansions(userId)).filter(e => e.owned).map(e => e.name);
    } catch { /* export without expansions */ }

    const payload = {
      app: 'carcasscore',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { userId, displayName, highestMetaRank: storedMetaRank },
      realms,
      games,
      expansions,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carcasscore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAccount?.();
    } catch (err) {
      setDeleteError(err.message || 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    const isOpen = !!selectedGame || !!settingsView || deleteStep > 0;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedGame, settingsView, deleteStep]);

  // Keyboard flip shortcut for whichever of the two flip-cards (hero,
  // Career Highlights) is most relevant right now — Enter and ArrowRight
  // both spin it one half-turn forward, ArrowLeft one half-turn backward;
  // holding/mashing the same key keeps accumulating in that direction
  // (see heroRotation/careerRotation above), so repeated presses spin the
  // card through full 360deg turns rather than just snapping between the
  // two faces. On a desktop with a real mouse, "most relevant" is whichever
  // card's center is physically closest to the last-known cursor position;
  // on a touch device (no mousemove ever observed this page load), it falls
  // back to whichever card currently has more of its own area actually
  // visible in the viewport. Skipped during the guided tour (which drives
  // both cards' flips itself) and while any modal is open on top (same
  // isOpen check the scroll-lock effect above uses).
  useEffect(() => {
    if (tourStep !== null) return;
    let lastMouse = null;
    const onMouseMove = (e) => { lastMouse = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouseMove);

    const visibleArea = (rect) => {
      const w = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const h = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return w * h;
    };

    const pickTarget = () => {
      const heroEl = heroRef.current;
      const careerEl = careerHighlightsRef.current;
      if (!heroEl || !careerEl) return heroEl ? 'hero' : careerEl ? 'career' : null;
      const heroRect = heroEl.getBoundingClientRect();
      const careerRect = careerEl.getBoundingClientRect();
      if (lastMouse) {
        const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        const dist = (r) => Math.hypot(centerOf(r).x - lastMouse.x, centerOf(r).y - lastMouse.y);
        return dist(heroRect) <= dist(careerRect) ? 'hero' : 'career';
      }
      return visibleArea(heroRect) >= visibleArea(careerRect) ? 'hero' : 'career';
    };

    const onKey = (e) => {
      if (tourStep !== null || selectedGame || settingsView || deleteStep > 0) return;
      if (e.key !== 'Enter' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;
      const target = pickTarget();
      if (!target) return;
      const setRotation = target === 'hero' ? setHeroRotation : setCareerRotation;
      if (e.key === 'ArrowLeft') setRotation(r => r - 1);
      else setRotation(r => r + 1); // Enter or ArrowRight
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKey);
    };
  }, [tourStep, selectedGame, settingsView, deleteStep]);

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

      {tourStep !== null && (
        <ProfileHowToModal step={tourStep} onNext={advanceTour} onBack={backTour} onClose={closeTour} targetRef={tourTargetRef} />
      )}

      {/* tour-inert: while the tour is open, only the one spotlighted
          section below should be clickable — not the "?" or the demo
          toggle. Kept separate from the main-content wrapper further down
          so the settings/rename/delete modals in between (reachable via
          the gear icon inside the hero card, which does stay clickable
          during the tour's own hero step) never end up locked down too. */}
      <div className={tourStep !== null ? 'tour-inert' : ''}>
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2>Profile</h2>
          {/* The sole tour/demo entry point — "See how it works!" used to be
              a separate chip, but starting the tour already turns demo data
              on for whoever needs it (see startTour above), so a second
              affordance for the same thing was redundant. Green while the
              tour's actually running is the only state that matters here —
              the button itself goes inert (see tour-inert above) the moment
              it starts, so this is purely "you're in it right now," not a
              toggle. */}
          <button
            type="button"
            title={tourStep !== null ? 'Tour in progress' : 'About your Profile'}
            onClick={startTour}
            style={{ background: 'none', border: `1px solid ${tourStep !== null ? 'var(--forest-green)' : 'var(--warm-gold)'}`, borderRadius: '50%', width: 'clamp(1.15rem, 4vw, 1.5rem)', height: 'clamp(1.15rem, 4vw, 1.5rem)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 2vw, 0.8rem)', fontWeight: 700, color: tourStep !== null ? 'var(--forest-green)' : 'var(--earth-brown)', padding: 0, flexShrink: 0 }}
          >
            ?
          </button>
        </div>
        <div className="section-title-line" />
      </div>
      </div>

      {/* Settings page */}
      {settingsView === 'menu' && (
        <div className="realm-modal-overlay" onClick={closeSettings}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <GearIcon /> Account Settings
            </h3>

            <div className="settings-section">
              <div className="settings-section-header">Profile Identity</div>
              <div className="settings-row">
                <span className="settings-row-label">Display Name</span>
                <span className="settings-row-control">
                  <span className="settings-row-value">{displayName || 'Adventurer'}</span>
                  <button type="button" className="settings-edit-btn" onClick={startRename}>Edit</button>
                </span>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-header">Account &amp; Data</div>
              <div className="settings-row">
                <span className="settings-row-label">Backup Data</span>
                <button type="button" className="settings-edit-btn" onClick={handleExportJson}>Export JSON</button>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Log out of your account</span>
                <button type="button" className="settings-edit-btn" onClick={onSignOut}>Log Out</button>
              </div>
            </div>

            <div className="settings-section settings-danger">
              <div className="settings-section-header">Danger Zone</div>
              <div className="settings-row">
                <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                  Permanently delete your account and all data
                </span>
                <button
                  type="button"
                  className="settings-delete-btn"
                  onClick={() => { setSettingsView(null); setDeleteStep(1); setDeleteError(''); }}
                >
                  <TrashIcon /> Delete Account
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.4rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={closeSettings}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Change display name */}
      {settingsView === 'rename' && (
        <div className="realm-modal-overlay" onClick={() => !saving && closeSettings()}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem' }}>Change Display Name</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5, color: 'var(--stone-gray)' }}>
              Your display name prefills your player slot in new realms. Existing realms keep their player names.
            </p>
            <form onSubmit={handleSaveName}>
              <input
                type="text"
                className="form-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={30}
                autoFocus
                placeholder="Display name"
                style={{ width: '100%', marginBottom: '1rem' }}
              />
              {renameError && (
                <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{renameError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeSettings} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete account — step 1 confirmation */}
      {deleteStep === 1 && (
        <div className="realm-modal-overlay" onClick={() => setDeleteStep(0)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Delete Account?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will delete your account and all associated realms, games, and player data.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteStep(2)}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account — step 2 final confirmation */}
      {deleteStep === 2 && (
        <div className="realm-modal-overlay" onClick={() => !deleting && setDeleteStep(0)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              Your data will be permanently deleted.
            </p>
            {deleteError && (
              <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* tour-inert: only the one spotlighted section below is clickable
          while the tour is open — see the matching wrapper above
          section-title for why this is a second, separate wrapper rather
          than one spanning the whole return. Always renders the real
          hero/milestones/highlights/trophy structure now, 0 games or not —
          calcAccountStats already returns sane zeroed values (no wins, no
          records, "—" placeholders throughout) rather than needing a demo
          or empty-state stand-in, and it's what gives the guided tour
          something real to point at for a brand new account too. */}
      <div className={tourStep !== null ? 'tour-inert' : ''}>
        <div className="me-hero-grid" style={{ marginBottom: '1.2rem' }}>
          <ProfileHero heroRef={heroRef} highlighted={tourStep === 0 || tourStep === 1} account={account} userId={userId} displayName={displayName} title={`Rank ${displayedRank} ${rankTitle(displayedRank)}`} tierCount={tierCount} totalTiers={getTotalTiers()} onOpenSettings={isGuest ? null : openSettings} flipped={heroFlipped} rotation={heroRotation} onFlip={handleHeroFlip} demoActive={demoActive} realTierCount={realTierCount} />
          <div ref={careerHighlightsRef} className={`player-card-flip${careerFlipped ? ' flipped' : ''}${(tourStep === 2 || tourStep === 3) ? ' tour-highlight' : ''}`}>
            {/* rotation drives the transform directly (see ProfileHero's
                matching comment) so repeated keyboard presses spin the card
                through full turns instead of snapping between faces. */}
            <div className="player-card-flip-inner" style={{ transform: `rotateY(${careerRotation * 180}deg)` }}>
              <div className="player-card player-card-front" style={{ padding: '1.5rem' }} onClick={handleCareerFlip}>
                <CareerHighlights account={account} onNavigateToGame={openGameLightbox} />
              </div>
              <div className="player-card player-card-back" style={{ padding: '1.5rem' }} onClick={handleCareerFlip}>
                <TrophyCabinet account={account} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
