import { useMemo, useState, useEffect } from 'react';
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import { calcGroupStats, calcPlayerRecords, calcRealmStandings, calcPlayerTrophyTallies } from '../utils/stats';
import { getRealmMemberProgress } from '../data/storage';
import PlayerCard, { PLAYER_COLOR_CLASSES } from './PlayerCard';
import PointBreakdownChart from './PointBreakdownChart';
import Lightbox from './Lightbox';
import ValInfo from './ValInfo';
import crownImg from '../../images/icons/crown.png';
import { formatDate } from '../utils/formatters';

const GAMES_PER_PAGE = 25;
const FIRST_LOG_PAGE = 2; // 0 overview, 1 fellowship, 2.. game log

function formatDuration(ms) {
  if (!(ms > 0)) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// "March 2026" from the realm's created timestamp (full ISO from the DB,
// snake_case created_at on guest/demo realms — never run through formatDate,
// which expects a bare YYYY-MM-DD)
function formatEstablished(realm) {
  const iso = realm.createdAt || realm.created_at;
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function OverviewPage({ realm, realmGames, standings, onOpenGame, progressByName, statusByPlayer, onInvite }) {
  const gs = useMemo(() => calcGroupStats(realmGames), [realmGames]);
  const records = useMemo(
    () => calcPlayerRecords(realmGames, (realm.players || []).map(p => p.name)),
    [realmGames, realm]
  );

  const { favFull, favFullCount } = useMemo(() => {
    const EXP_TYPE = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.type]));
    const full = {};
    for (const g of realmGames)
      for (const exp of g.expansions || []) {
        if (EXP_TYPE[exp] === 'full') full[exp] = (full[exp] || 0) + 1;
      }
    const fullSorted = Object.entries(full).sort((a, b) => b[1] - a[1]);
    return {
      favFull: fullSorted[0]?.[0] ?? '—',
      favFullCount: fullSorted[0]?.[1] ?? null,
    };
  }, [realmGames]);

  // One "character card" stat box — same .profile-stat/.profile-stat-value/
  // .profile-stat-label look ProfileHero's own stat grid uses (Profile.jsx),
  // reused here so the two read as one consistent visual language rather
  // than this page inventing its own. A stat tied to a specific game
  // (gameObj) renders its value as a button that opens that game, same
  // click-to-navigate behavior the old list-row version had.
  const statBox = (label, value, gameObj, tip, valueStyle) => {
    const valueEl = gameObj ? (
      <button
        type="button"
        className="profile-stat-value"
        onClick={() => onOpenGame(gameObj)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', textDecoration: 'underline dotted', fontFamily: 'inherit', ...valueStyle }}
      >
        {value}
      </button>
    ) : (
      <span className="profile-stat-value" style={valueStyle}>{value}</span>
    );
    return (
      <div key={label} className="profile-stat">
        {tip ? <ValInfo tip={tip}>{valueEl}</ValInfo> : valueEl}
        <span className="profile-stat-label">{label}</span>
      </div>
    );
  };

  const championNames = realmGames.length > 0 && standings.sorted[0] ? [...standings.leaders].join(' & ') : null;

  return (
    <div>
      {/* The "OVERVIEW" label above this (in .book-header, RealmBook.jsx)
          is part of this same tour spotlight — see the wrapper there. */}
      <h3 className="book-overview-title">
        <span className="book-title-ornament">❦</span>
        {realm.name}
        <span className="book-title-ornament">❦</span>
      </h3>
      <PointBreakdownChart
      players={[...standings.sorted].sort((a, b) => (records[b.name.toLowerCase()]?.w || 0) - (records[a.name.toLowerCase()]?.w || 0))}
      title={null}
      bare
      winsByPlayer={Object.fromEntries(standings.sorted.map(ps => [ps.name, records[ps.name.toLowerCase()]?.w || 0]))}
      rankByPlayer={Object.fromEntries(standings.sorted.map(ps => [ps.name, progressByName[ps.name.toLowerCase()]?.rank ?? null]))}
      statusByPlayer={statusByPlayer}
      onInvite={onInvite}
      />
      {/* Realm Chronicle + Realm Highlights, merged into one 12-box grid —
          same .profile-stat "character card" look ProfileHero's own stat
          grid uses (Profile.jsx), rather than this page's old two separate
          label/value list cards. */}
      <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(201,163,74,0.35)', paddingTop: '1.2rem' }}>
        <div className="profile-hero-stats realm-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {statBox('Games Played', realmGames.length)}
          {statBox('Established', formatEstablished(realm))}
          {statBox(
            'Current Champion',
            championNames ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <img src={crownImg} alt="" style={{ height: '18px', width: 'auto' }} draggable={false} />
                {championNames}
              </span>
            ) : '—'
          )}
          {statBox('Highest Combined Score', gs.highestPoints > 0 ? gs.highestPoints : '—', gs.highestPointsObj)}
          {statBox('Closest Finish', gs.closestFinishObj ? `+${gs.closestFinishMargin}` : '—', gs.closestFinishObj, 'Smallest winning margin in the realm.')}
          <div className="profile-stat">
            <span className="profile-stat-value" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', fontSize: 'clamp(0.85rem, 2.2vw, 1.1rem)' }}>
              {gs.longestGameObj ? (
                <button type="button" onClick={() => onOpenGame(gs.longestGameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', font: 'inherit', color: 'inherit', textDecoration: 'underline dotted' }}>
                  {formatDuration(gs.longestGame)}
                </button>
              ) : formatDuration(gs.longestGame)}
              /
              {gs.shortestGameObj ? (
                <button type="button" onClick={() => onOpenGame(gs.shortestGameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', font: 'inherit', color: 'inherit', textDecoration: 'underline dotted' }}>
                  {formatDuration(gs.shortestGame)}
                </button>
              ) : formatDuration(gs.shortestGame)}
            </span>
            <span className="profile-stat-label">Longest / Shortest</span>
          </div>
          {statBox('Most Active Day', gs.mostActiveDay ? formatDate(gs.mostActiveDay) : '—', null, gs.mostActiveDay ? `${gs.mostActiveDayCount} ${gs.mostActiveDayCount === 1 ? 'game' : 'games'} played` : null)}
          {statBox('Favorite Expansion', favFull, null, favFullCount !== null ? `Played in ${favFullCount} ${favFullCount === 1 ? 'game' : 'games'}` : null, { fontSize: 'clamp(0.72rem, 1.8vw, 0.92rem)' })}
        </div>
      </div>
    </div>
  );
}

function FellowshipPage({ standings, realmGames, onOpenGame, rosterRef }) {
  const { sorted } = standings;
  return (
    <div>
      {/* rosterRef is only a docking target for the tour card's position
          now — the spotlight itself lives on the outer chartRef wrapper in
          RealmBook (see below) so it covers the page title too. */}
      <div ref={rosterRef} className={`stats-grid${(sorted.length === 2 || sorted.length === 4) ? ' stats-grid-2col' : ''}`} style={{ alignItems: 'start' }}>
        {sorted.map((ps, i) => (
          <PlayerCard
            key={ps.name}
            name={ps.name}
            stats={ps}
            tallies={calcPlayerTrophyTallies(realmGames, ps.name)}
            favMeeple={ps.favMeeple}
            favMeepleCount={ps.favMeepleCount}
            colorClass={PLAYER_COLOR_CLASSES[i % PLAYER_COLOR_CLASSES.length]}
            onNavigateToGame={onOpenGame}
          />
        ))}
      </div>
    </div>
  );
}

function GameLogPage({ pageGames, onSelectGame, gamelogRef }) {
  if (pageGames.length === 0) {
    return <div className="empty-state">No games recorded for this realm yet.</div>;
  }
  // gamelogRef is only a docking target for the tour card's position now —
  // the spotlight itself lives on the outer chartRef wrapper in RealmBook
  // (see below) so it covers the page title too, not just this table.
  return (
    <div ref={gamelogRef}>
      <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Winner</th>
            <th>Score</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {pageGames.map(game => {
            const scores     = game.players.map(p => p.score).sort((a, b) => b - a);
            const maxScore   = scores[0] ?? 0;
            const topPlayers = game.winners || [];  // Use precomputed winners from database
            const winner     = topPlayers.length === 1 ? game.players.find(p => topPlayers.includes(p.name)) : null;
            const margin     = topPlayers.length === 1 ? maxScore - (scores[1] ?? 0) : 0;
            const winnerNames = topPlayers.length > 1 ? topPlayers : (winner ? [winner.name] : []);
            return (
              <tr key={game.id} onClick={() => onSelectGame(game)} style={{ cursor: 'var(--cursor-pointer)' }}>
                <td className="cell-date">{formatDate(game.date)}</td>

                <td style={{
                  fontWeight: 600,
                  color:      'var(--forest-green)',
                  fontStyle:  'normal',
                  whiteSpace: 'nowrap',
                }}>
                  {winnerNames.map((n, i) => (
                    <span key={n}>
                      {i > 0 && ' & '}
                      {n}
                    </span>
                  ))}
                </td>

                <td style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>
                  {topPlayers.length > 0 ? maxScore : '—'}
                </td>

                <td className="cell-margin">{topPlayers.length === 1 ? `+${margin}` : '—'}</td>

              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// The open realm book — Overview / Fellowship / Game Log pages for one
// realm. Chrome above it (the "‹ Realms" back button, realm name) is owned
// by RealmsTab, since that same chrome also fronts the hub grid. Settings
// (rename/chest/logbook/delete/leave) live in RealmSettingsModal, opened
// from the realm's hub card — this component has no edit affordance of its
// own, so every page's Back button behaves identically.
export default function RealmBook({ realm, games, page, onPageChange, selectedGame, onSelectGame, onDeleteGame, onExportGroup = null, isGuest = false, tourActive = false, chartRef, rosterRef, gamelogRef, tourHighlight = null, onExitToRealms = null }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Invite an account to link to an uninvited player — surfaced from the
  // Overview page's standings box (see PointBreakdownChart's Invite button,
  // shown in the rank-badge slot for anyone not yet joined; that box
  // already shows every player's rank at once, defaulting an unlinked one
  // to Wanderer, so it's the natural home for this rather than the
  // per-game meeple picker it used to live on — see PreGameSetup.jsx).
  const [showExport,   setShowExport]   = useState(false);
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [invitePlayer, setInvitePlayer] = useState(null);
  const [inviteBusy,   setInviteBusy]   = useState(false);
  const [inviteSent,   setInviteSent]   = useState(false);
  const [inviteError,  setInviteError]  = useState('');
  // Players invited during this mount — overlays their status as 'pending'
  // until the realms refetch on next load catches up. (This component
  // remounts when the selected realm changes, so this never leaks across
  // realms.)
  const [sentInvites,  setSentInvites]  = useState([]);

  const statusByPlayer = useMemo(() => {
    const map = {};
    for (const p of (realm.players || [])) {
      map[p.name] = p.status === 'uninvited' && sentInvites.includes(p.name) ? 'pending' : p.status;
    }
    return map;
  }, [realm.players, sentInvites]);

  const openExport = (playerName) => {
    setInviteEmail('');
    setInvitePlayer(playerName);
    setInviteSent(false);
    setInviteError('');
    setShowExport(true);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!invitePlayer) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      await onExportGroup(realm.id, inviteEmail.trim(), invitePlayer);
      setInviteSent(true);
      // Reflect the newly reserved player immediately
      setSentInvites(prev => [...prev, invitePlayer]);
    } catch (err) {
      setInviteError(err?.message || 'Failed to send invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  const realmGames = useMemo(
    () => games.filter(g => g.realmId === realm.id),
    [games, realm]
  );
  const standings  = useMemo(() => calcRealmStandings(realmGames, realm), [realmGames, realm]);

  // Co-members' rank + current milestone standing (Fellowship page) —
  // fetched via a SECURITY DEFINER RPC since another account's progress
  // can't be computed from this client (no access to the rest of their
  // realms/games). Current state only, not a history of past rank-up/
  // milestone events. Skipped entirely for guest/demo realms, whose players
  // never have a linked userId.
  const [memberProgress, setMemberProgress] = useState({}); // user_id -> { rank, tierCount, categoryProgress }
  useEffect(() => {
    let stale = false;
    const hasLinked = (realm.players || []).some(p => p.userId);
    if (!hasLinked) { setMemberProgress({}); return; }
    getRealmMemberProgress(realm.id).then(map => { if (!stale) setMemberProgress(map); });
    return () => { stale = true; };
  }, [realm.id, realm.players]);

  const progressByName = useMemo(() => {
    const map = {};
    for (const p of (realm.players || [])) {
      if (p.userId && memberProgress[p.userId]) map[p.name.toLowerCase()] = memberProgress[p.userId];
    }
    return map;
  }, [realm.players, memberProgress]);

  const logPages   = Math.max(1, Math.ceil(realmGames.length / GAMES_PER_PAGE));
  const totalPages = FIRST_LOG_PAGE + logPages;

  // Deleting games can shrink the log — keep the page in range
  useEffect(() => {
    if (page >= totalPages) onPageChange(totalPages - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages]);

  // Land at the top of each new page — after render, so the shorter page
  // can't restore the old scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const isOpen = !!confirmDeleteId || !!selectedGame || showExport;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDeleteId, selectedGame, showExport]);

  // Arrow-key page turning while the book is open — suppressed under any
  // modal (the Lightbox has its own Up/Down key handling for game-to-game
  // nav) and, like every other keyboard shortcut, while a tour is open (the
  // tour drives its own stage transitions; letting arrow keys page-turn
  // underneath it would desync the two). Left from Overview (page 0 — the
  // book's first page, nothing before it to turn back to) exits the book
  // entirely back to the realms hub instead of being a no-op, same as the
  // ‹ Realms chrome above it.
  useEffect(() => {
    const onKey = (e) => {
      if (confirmDeleteId || selectedGame || showExport || tourActive) return;
      if (e.key === 'ArrowLeft') {
        if (page > 0) onPageChange(page - 1);
        else onExitToRealms?.();
      }
      if (e.key === 'ArrowRight' && page < totalPages - 1) onPageChange(Math.min(totalPages - 1, page + 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, totalPages, confirmDeleteId, selectedGame, showExport, onPageChange, tourActive, onExitToRealms]);

  const handleConfirmDelete = async () => {
    await onDeleteGame(confirmDeleteId);
    setConfirmDeleteId(null);
    onSelectGame(null);
  };

  // Shared by both Back buttons (header + bottom nav) and the ArrowLeft
  // handler above: from Overview (page 0) there's no earlier page to turn
  // back to, so Back exits the book instead of doing nothing.
  const handleBack = () => {
    if (page > 0) onPageChange(page - 1);
    else onExitToRealms?.();
  };

  return (
    <>
      {/* Invite modal — share the realm with another account, linked to the
          player whose row the Invite button was clicked on (see
          OverviewPage's standings box). */}
      {showExport && (
        <div className="realm-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.8rem' }}>
              {inviteSent ? 'Invite sent!' : <>Invite {invitePlayer} to join {realm.name}?</>}
            </h3>
            {inviteSent ? (
              <>
                <p style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--charcoal)', margin: '0 0 1.2rem' }}>
                  They'll be asked to join <strong>{realm.name}</strong> as{' '}
                  <strong>{invitePlayer}</strong> next time they open the app.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-sm" onClick={() => setShowExport(false)}>Done</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSendInvite}>
                <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', fontSize: '0.88rem', color: 'var(--stone-gray)', margin: '0 0 1rem' }}>
                  Their account will be linked to the player and realm.
                </p>
                <div className="form-group">
                  <label className="form-label" htmlFor="export-email">Account email</label>
                  <input
                    id="export-email"
                    className="form-input"
                    type="email"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }}
                    required
                    autoFocus
                  />
                </div>
                {inviteError && (
                  <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.88rem', margin: '0 0 0.6rem' }}>
                    {inviteError}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={inviteBusy} onClick={() => setShowExport(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm" disabled={inviteBusy}>
                    {inviteBusy ? 'Please wait...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Game delete confirmation modal */}
      {confirmDeleteId && (
        <div className="realm-modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Remove this game?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently remove the game from the logbook.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — shared by log rows and stat game-links */}
      {selectedGame && (
        <Lightbox
          game={selectedGame}
          games={realmGames}
          onNavigate={onSelectGame}
          onClose={() => onSelectGame(null)}
          onDeleteRequest={tourActive || realm?.isDemo || realm?.isOwner === false ? null : () => setConfirmDeleteId(selectedGame.id)}
          realmName={realm?.name}
        />
      )}

      {/* The tour spotlight (chartRef/tourHighlight) is applied to the whole
          book — header through the bottom Back/Next — so the cutout fills
          the entire yellow box on all three stages (Overview/Roster/Game
          Log), rather than a smaller box floating inside it. rosterRef/
          gamelogRef (on the page content itself) stay in play purely as
          docking targets for the tour card's position — see FellowshipPage /
          GameLogPage. Since .book-nav's Back/Next are now inside the
          highlighted element (which stays clickable via `.tour-highlight`'s
          own pointer-events: auto, unlike everything else under the
          ancestor .tour-inert in RealmsTab.jsx), they're explicitly
          disabled during a tour too, matching .book-header's pair, so
          neither route can page away from whatever stage is being
          demonstrated. */}
      <div ref={chartRef} className={`realm-book${tourHighlight ? ' tour-highlight' : ''}`}>
        <div className="book-header">
          {/* Same Back/Next as .book-nav below, so paging doesn't require
              scrolling to the bottom. */}
          <button type="button" className="btn btn-ghost btn-sm" disabled={tourActive} onClick={handleBack}>‹ Back</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1 || tourActive} onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}>Next ›</button>
        </div>

        <div className="book-page" key={page}>
          {page === 0 && (
            <OverviewPage
              realm={realm}
              realmGames={realmGames}
              standings={standings}
              onOpenGame={onSelectGame}
              progressByName={progressByName}
              statusByPlayer={statusByPlayer}
              onInvite={!isGuest && onExportGroup ? openExport : null}
            />
          )}
          {page === 1 && (
            <FellowshipPage standings={standings} realmGames={realmGames} onOpenGame={onSelectGame} rosterRef={rosterRef} />
          )}
          {page >= FIRST_LOG_PAGE && (
            <GameLogPage
              pageGames={realmGames.slice((page - FIRST_LOG_PAGE) * GAMES_PER_PAGE, (page - FIRST_LOG_PAGE + 1) * GAMES_PER_PAGE)}
              onSelectGame={onSelectGame}
              gamelogRef={gamelogRef}
            />
          )}
        </div>

        <div className="book-nav">
          <button type="button" className="btn btn-ghost btn-sm" disabled={tourActive} onClick={handleBack}>‹ Back</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1 || tourActive} onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}>Next ›</button>
        </div>
      </div>
    </>
  );
}
