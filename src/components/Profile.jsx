import { useMemo, useState, useEffect, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS } from '../constants';
import { calcAccountStats, getPlayerTitle } from '../utils/stats';
import { ACCOUNT_MILESTONES, accountMilestoneProgress } from '../data/accountMilestones';
import { MEEPLE_IMGS, TYPE_LABELS } from './StatWidgets';
import { ACHIEVEMENT_DISPLAY_ORDER, ACHIEVEMENT_BADGE, ACHIEVEMENT_LABEL_OVERRIDE } from './GameHighlights';

import { formatAchievementName } from '../utils/achievements';
import ValInfo from './ValInfo';
import Lightbox from './Lightbox';
import { GearIcon, TrashIcon } from './icons';

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

const DEV_TOOLTIP = 'Under development. Please check back later.';

// Brass-bead switch for the settings rows
function SettingsToggle({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`settings-toggle${on ? ' on' : ''}`}
      onClick={onToggle}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}

// Trophy cabinet + milestones, side by side. Trophies: one medal per time each
// best-in-game record was held — 7 Longest Roads shows 7 medals in the row.
// Currently unrendered (hidden for a later design pass) — see the Profile return.
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
function ProfileHero({ account, displayName, onOpenSettings }) {
  const { stats, favMeeple, favMeepleCount, playingSince, totalPlaytime } = account;
  const meepleImg = favMeeple ? (MEEPLE_IMGS[favMeeple] ?? null) : null;

  const primaryStats = [
    ['Games Played', <span className="profile-stat-value">{account.gamesCount}</span>],
    ['Victories', <ValInfo tip={`${stats.winRate}% win rate`}><span className="profile-stat-value" style={{ color: 'var(--forest-green)' }}>{stats.wins}</span></ValInfo>],
    ['Realms', <span className="profile-stat-value">{account.realmsCount}</span>],
    ['Career Points', <span className="profile-stat-value">{stats.totalPoints.toLocaleString()}</span>],
    ['Time Played', <span className="profile-stat-value">{formatDuration(totalPlaytime)}</span>],
    ['Playing Since', <span className="profile-stat-value">{formatMonthYear(playingSince)}</span>],
  ];

  return (
    <div className="player-card p2 profile-hero" style={{ marginBottom: '1.2rem' }}>
      {onOpenSettings && (
        <button type="button" className="profile-settings-btn" onClick={onOpenSettings} title="Account settings" aria-label="Account settings">
          <GearIcon />
        </button>
      )}
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
      <div className="stat-rows-narrow">
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
    </div>
  );
}

export default function Profile({ games, realms, userId, displayName, isGuest = false, showDemoData = false, onToggleDemoData = null, onChangeDisplayName, onDeleteAccount, onSignOut }) {
  const account = useMemo(() => calcAccountStats(games, realms, userId), [games, realms, userId]);
  const [selectedGame, setSelectedGame] = useState(null);

  const [settingsView, setSettingsView] = useState(null); // null | 'menu' | 'rename'
  const [nameInput,    setNameInput]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [renameError,  setRenameError]  = useState('');
  const [deleteStep,   setDeleteStep]   = useState(0); // 0=hidden, 1=first confirm, 2=final confirm
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  // Display-only for now — these toggles aren't persisted anywhere yet
  const [prefs, setPrefs] = useState({ publicStats: true, friendRequests: false });
  const togglePref = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

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

      <div className="section-title">
        <h2>Profile</h2>
        <div className="section-title-line" />
        {onToggleDemoData && (
          <button type="button" className={`expansion-chip${showDemoData ? ' selected' : ''}`} onClick={onToggleDemoData} style={{ fontSize: 'clamp(0.72rem, 2.2vw, 0.9rem)', padding: '0.5rem 1.1rem', marginLeft: '0.5rem' }}>
            {showDemoData ? 'Click to exit' : 'See how it works!'}
          </button>
        )}
      </div>

      {/* Settings page — only Display Name and Delete Account are functional;
          the rest is frontend-only scaffolding awaiting backend support */}
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
              <div className="settings-row">
                <span className="settings-row-label">Avatar Icon</span>
                <span className="settings-row-control">
                  <span className="settings-row-value">Classic Meeple</span>
                  <button type="button" className="settings-edit-btn settings-dev" data-tooltip={DEV_TOOLTIP}>Change</button>
                </span>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-header">Privacy &amp; Visibility</div>
              <div className="settings-row">
                <span className="settings-row-label">Public Leaderboard Stats</span>
                <SettingsToggle on={prefs.publicStats} onToggle={() => togglePref('publicStats')} label="Public leaderboard stats" />
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Allow Friend Requests</span>
                <SettingsToggle on={prefs.friendRequests} onToggle={() => togglePref('friendRequests')} label="Allow friend requests" />
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-header">Account &amp; Data</div>
              <div className="settings-row">
                <span className="settings-row-label">Backup Data</span>
                <button type="button" className="settings-edit-btn settings-dev" data-tooltip={DEV_TOOLTIP}>Export JSON</button>
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

      {isGuest && !showDemoData ? (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>Sign in to view your stats.</div>
      ) : account.gamesCount === 0 ? (
        <>
          <div className="empty-state" style={{ marginBottom: '1.5rem' }}>Play some games to see your stats.</div>
          {/* No hero card yet — keep account settings reachable */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="realm-trash-btn"
              onClick={openSettings}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--stone-gray)', fontSize: 'clamp(0.68rem, 2vw, 0.82rem)', fontFamily: 'Cinzel, serif', letterSpacing: '0.06em' }}
            >
              <GearIcon /> Account Settings
            </button>
          </div>
        </>
      ) : (
        <>
          <ProfileHero account={account} displayName={displayName} onOpenSettings={isGuest ? null : openSettings} />
          <CareerHighlights account={account} onNavigateToGame={openGameLightbox} />
          {/* TrophyCase (Trophy Cabinet + Milestones) hidden for now — needs another design pass */}
        </>
      )}
    </div>
  );
}
