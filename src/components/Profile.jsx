import { useMemo, useState, useEffect, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { calcAccountStats } from '../utils/stats';
import { visibleAccountMilestones } from '../data/accountMilestones';
import { getCurrentRank, countUnlockedTiers, rankTitle, tiersRequiredForRank, MAX_RANK, TOTAL_TIERS } from '../utils/metaRank';
import CategoryMilestoneCard from './CategoryMilestoneCard';
import MilestoneCarousel from './MilestoneCarousel';
import { MEEPLE_IMGS, TYPE_LABELS } from './StatWidgets';
import { ACHIEVEMENT_DISPLAY_ORDER, ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';

import { formatAchievementName } from '../utils/achievements';
import { getExpansions } from '../data/storage';
import ValInfo from './ValInfo';
import Lightbox from './Lightbox';
import { GearIcon, TrashIcon } from './icons';
import { ProfileHowToModal } from './HowToGuide';

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

// Trophy cabinet: one medal per time each best-in-game record was held —
// 7 Longest Roads shows 7 medals in the row. Renders in its own card beside
// Career Highlights, stacking below it on narrow screens.
function TrophyCabinet({ account }) {
  const { recordTallies } = account;
  const tallied = ACHIEVEMENT_DISPLAY_ORDER.filter(key => recordTallies[key] > 0);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={ACHIEVEMENT_BADGE[key]} alt={ACHIEVEMENT_LABEL_OVERRIDE[key] ?? formatAchievementName(key)} style={{ height: '44px', width: 'auto' }} draggable={false} />
                <span className="stat-value" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>×{recordTallies[key]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The strategy-game hero card: large meeple, name, rank title, and the
// primary career numbers at a glance.
function ProfileHero({ account, userId, displayName, title, titleTip, onOpenSettings, heroRef, highlighted = false }) {
  const { stats, favMeeple, favMeepleCount, playingSince, totalPlaytime } = account;
  // No games played yet means no real favorite meeple — assigned one
  // (see pickDefaultMeeple) instead of showing an empty hero card.
  const isDefaultMeeple = !favMeeple;
  const meepleImg = MEEPLE_IMGS[favMeeple || pickDefaultMeeple(userId)] ?? null;

  const primaryStats = [
    ['Games Played', <span className="profile-stat-value">{account.gamesCount}</span>],
    ['Victories', <ValInfo tip={`${stats.winRate}% win rate`}><span className="profile-stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span></ValInfo>],
    ['Realms', <span className="profile-stat-value">{account.realmsCount}</span>],
    ['Career Points', <span className="profile-stat-value">{stats.totalPoints.toLocaleString()}</span>],
    ['Time Played', <span className="profile-stat-value">{formatDuration(totalPlaytime)}</span>],
    ['Playing Since', <span className="profile-stat-value">{formatMonthYear(playingSince)}</span>],
  ];

  return (
    <div ref={heroRef} className={`player-card p2 profile-hero${highlighted ? ' tour-highlight' : ''}`} style={{ marginBottom: '1.2rem' }}>
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
          <ValInfo tip={titleTip}>
            <span className="profile-hero-title" style={{ display: 'block' }}>{title}</span>
          </ValInfo>
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

// Career-defining records — its own card beside the Trophy Cabinet
function CareerHighlights({ account, onNavigateToGame }) {
  const { stats, rival, biggestPlay, fastestWin, highestCombined, sweeps, favExpansions } = account;

  return (
      <div className="stat-rows-narrow" style={{ margin: 0 }}>
          <div className="tile-card-header" style={sectionHeaderStyle}>Career Highlights</div>
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

export default function Profile({ games, realms, expansions = [], userId, displayName, isGuest = false, tourShown = false, onTourShown = null, storedMetaRank = 0, onMetaRankAchieved = null, onChangeDisplayName, onDeleteAccount, onSignOut }) {
  const account = useMemo(() => calcAccountStats(games, realms, userId, expansions), [games, realms, userId, expansions]);
  const [selectedGame, setSelectedGame] = useState(null);

  // Guided tour opened from the "?" button: null = closed, 0-3 = which
  // PROFILE_STEPS entry is showing. Next/Back scroll to the matching
  // section; closing (or finishing) returns to the top of the page.
  const [tourStep, setTourStep] = useState(null);
  const heroRef = useRef(null);
  const milestonesRef = useRef(null);
  const careerHighlightsRef = useRef(null);
  const trophyCabinetRef = useRef(null);
  const tourRefs = [heroRef, milestonesRef, careerHighlightsRef, trophyCabinetRef];
  // The popup docks beside whichever section the current step spotlights.
  const tourTargetRef = tourStep !== null ? tourRefs[tourStep] : null;
  // No demo toggle to flip anymore — a guest's `games`/`realms`/`userId`/
  // `displayName` props are already the demo persona's, permanently (see
  // App.jsx), and a signed-in account just tours its own real (if sparse)
  // stats — calcAccountStats returns sane zeroed-out values for 0 games
  // (no wins, no records, "—" placeholders throughout), so there's always
  // something real to render either way.
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
        milestonesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 1;
      }
      if (prev === 1) {
        careerHighlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 2;
      }
      if (prev === 2) {
        trophyCabinetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      if (prev === 2) { milestonesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 1; }
      if (prev === 3) { careerHighlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 2; }
      return prev;
    });
  };
  const closeTour = () => {
    setSelectedGame(null);
    setTourStep(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tierCount     = useMemo(() => countUnlockedTiers(account), [account]);
  const computedRank  = getCurrentRank(tierCount);
  const displayedRank = computedRank; // always the live rank — no never-regress floor
  const visibleCats   = useMemo(() => visibleAccountMilestones(account), [account]);

  // Why-am-I-this-rank tooltip: a vertical dot-and-line ladder — the next
  // (unearned) rank on top, the current rank highlighted, and every earned
  // rank below it in order — echoing the milestone progress bars' notch-and-
  // line visual language. Each row's number is the tier count required for
  // that rank, not the rank's own ordinal.
  const ladderRanks = [];
  if (displayedRank < MAX_RANK) ladderRanks.push({ rank: displayedRank + 1, state: 'next' });
  for (let r = displayedRank; r >= 1; r--) ladderRanks.push({ rank: r, state: r === displayedRank ? 'current' : 'earned' });

  const rankTip = (
    <div style={{ textAlign: 'left', maxWidth: 250, whiteSpace: 'normal' }}>
      <div style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '0.3rem' }}>
        Rank Ladder
      </div>
      <div className="rank-ladder-header">
        <span className="rank-ladder-col-num">#</span>
        <span className="rank-ladder-col-name">Rank</span>
        <span className="rank-ladder-col-tiers">Tiers</span>
      </div>
      <div className="rank-ladder">
        {ladderRanks.map(({ rank, state }) => (
          <div key={rank} className="rank-ladder-row">
            <span className={`rank-ladder-dot ${state}`} />
            <span className="rank-ladder-col-num">{rank}</span>
            <span className={`rank-ladder-name ${state}`}>{rankTitle(rank)}</span>
            <span className="rank-ladder-col-tiers">{tiersRequiredForRank(rank)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Persist a new personal-best rank upward; the computed > stored guard is
  // the loop-breaker once the refreshed user_metadata flows back in as a prop
  useEffect(() => {
    if (isGuest) return; // never persist a rank computed from demo data
    if (computedRank > (storedMetaRank || 0)) onMetaRankAchieved?.(computedRank);
  }, [computedRank, storedMetaRank, isGuest, onMetaRankAchieved]);

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
        <ProfileHero heroRef={heroRef} highlighted={tourStep === 0} account={account} userId={userId} displayName={displayName} title={`Rank ${displayedRank} ${rankTitle(displayedRank)}`} titleTip={rankTip} onOpenSettings={isGuest ? null : openSettings} />
        <div ref={milestonesRef} className={`milestone-carousel-section${tourStep === 1 ? ' tour-highlight' : ''}`} style={{ marginBottom: '1.2rem' }}>
          <div className="tile-card-header" style={{ ...sectionHeaderStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Milestones</span>
            <span className="game-count">{tierCount}/{TOTAL_TIERS}</span>
          </div>
          <MilestoneCarousel pauseKeyboard={!!selectedGame || !!settingsView || deleteStep > 0 || (tourStep !== null && tourStep !== 1)}>
            {visibleCats.map((cat) => (
              <CategoryMilestoneCard key={cat.id} category={cat} account={account} />
            ))}
          </MilestoneCarousel>
        </div>
        <div className="me-hero-grid" style={{ marginBottom: '1.2rem' }}>
          <div ref={careerHighlightsRef} className={`tile-card${tourStep === 2 ? ' tour-highlight' : ''}`}>
            <CareerHighlights account={account} onNavigateToGame={openGameLightbox} />
          </div>
          <div ref={trophyCabinetRef} className={`tile-card${tourStep === 3 ? ' tour-highlight' : ''}`}>
            <TrophyCabinet account={account} />
          </div>
        </div>
      </div>
    </div>
  );
}
