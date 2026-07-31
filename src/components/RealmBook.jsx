import { useMemo, useState, useEffect } from 'react';
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import { calcGroupStats, calcPlayerRecords, calcRealmStandings, calcPlayerTrophyTallies } from '../utils/stats';
import { getRealmMemberProgress } from '../data/storage';
import PlayerCard, { PLAYER_COLOR_CLASSES } from './PlayerCard';
import PointBreakdownChart from './PointBreakdownChart';
import Lightbox from './Lightbox';
import StatInfo from './StatInfo';
import ValInfo from './ValInfo';
import crownImg from '../../images/icons/crown.png';
import { formatDate } from '../utils/formatters';

const GAMES_PER_PAGE = 25;
const FIRST_LOG_PAGE = 2; // 0 overview, 1 fellowship, 2.. game log

const sectionHeaderStyle = { borderBottom: '1px solid var(--warm-gold)', paddingBottom: '0.5rem', marginBottom: '1rem' };

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

function OverviewPage({ realm, realmGames, standings, onOpenGame, progressByName }) {
  const gs = useMemo(() => calcGroupStats(realmGames), [realmGames]);
  const records = useMemo(
    () => calcPlayerRecords(realmGames, (realm.players || []).map(p => p.name)),
    [realmGames, realm]
  );

  const { favFull, favFullCount, favMini, favMiniCount } = useMemo(() => {
    const EXP_TYPE = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e.type]));
    const full = {}, mini = {};
    for (const g of realmGames)
      for (const exp of g.expansions || []) {
        if (EXP_TYPE[exp] === 'full') full[exp] = (full[exp] || 0) + 1;
        else if (EXP_TYPE[exp] === 'mini') mini[exp] = (mini[exp] || 0) + 1;
      }
    const fullSorted = Object.entries(full).sort((a, b) => b[1] - a[1]);
    const miniSorted = Object.entries(mini).sort((a, b) => b[1] - a[1]);
    return {
      favFull: fullSorted[0]?.[0] ?? '—',
      favFullCount: fullSorted[0]?.[1] ?? null,
      favMini: miniSorted[0]?.[0] ?? '—',
      favMiniCount: miniSorted[0]?.[1] ?? null,
    };
  }, [realmGames]);

  const statRow = ([label, val, gameObj, info]) => (
    <div key={label} className="stat-row" style={{ margin: 0 }}>
      <span className="stat-label">
        {label}
        {info && <StatInfo>{info}</StatInfo>}
      </span>
      {gameObj
        ? <button type="button" className="stat-value" onClick={() => onOpenGame(gameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{val}</button>
        : <span className="stat-value">{val}</span>
      }
    </div>
  );
  const durationVal = (text, gameObj) => gameObj
    ? <button type="button" onClick={() => onOpenGame(gameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline dotted', fontSize: 'inherit' }}>{text}</button>
    : text;

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
      />
      <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(201,163,74,0.35)', paddingTop: '1.2rem' }}>
        <div className="book-overview-grid">
        <div className="tile-card stat-rows-narrow">
          <div className="tile-card-header" style={sectionHeaderStyle}>Realm Chronicle</div>
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Games Played</span>
            <span className="stat-value">{realmGames.length}</span>
          </div>
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Players</span>
            <span className="stat-value">{(realm.players || []).length}</span>
          </div>
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Established</span>
            <span className="stat-value">{formatEstablished(realm)}</span>
          </div>
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Current Champion</span>
            {championNames ? (
              <span className="stat-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <img src={crownImg} alt="" style={{ height: '18px', width: 'auto' }} draggable={false} />
                {championNames}
              </span>
            ) : (
              <span className="stat-value">—</span>
            )}
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <span className="stat-label">Favorite Expansion</span>
            <div style={{ paddingLeft: '0.8rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {[['Full', favFull, favFullCount], ['Mini', favMini, favMiniCount]].map(([label, val, count]) => (
                <div key={label} className="stat-row" style={{ margin: 0 }}>
                  <span className="stat-label" style={{ color: 'var(--stone-gray)' }}>{label}</span>
                  <ValInfo tip={count !== null ? `Played in ${count} ${count === 1 ? 'game' : 'games'}` : null}>
                    <span className="stat-value" style={{ fontSize: 'clamp(0.72rem, 1.8vw, 0.92rem)', fontWeight: 500 }}>{val}</span>
                  </ValInfo>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="tile-card stat-rows-narrow">
          <div className="tile-card-header" style={sectionHeaderStyle}>Realm Highlights</div>
          {[
            ['Highest Combined Score', gs.highestPoints > 0 ? gs.highestPoints : '—', gs.highestPointsObj, null],
            ['Closest Finish', gs.closestFinishObj ? `+${gs.closestFinishMargin}` : '—', gs.closestFinishObj, 'Smallest winning margin in the realm.'],
          ].map(statRow)}
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Longest / Shortest Game</span>
            <span className="stat-value">
              {durationVal(formatDuration(gs.longestGame), gs.longestGameObj)}
              {' / '}
              {durationVal(formatDuration(gs.shortestGame), gs.shortestGameObj)}
            </span>
          </div>
          {[
            ['Farm Wins', gs.farmWins, null, 'Games won in final scoring stage.'],
            ['Clutch Games', gs.clutchGames, null, 'Games where winning margin was less than 7%.'],
          ].map(statRow)}
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Most Active Day</span>
            <ValInfo tip={gs.mostActiveDay ? `${gs.mostActiveDayCount} ${gs.mostActiveDayCount === 1 ? 'game' : 'games'} played` : null}>
              <span className="stat-value">{gs.mostActiveDay ? formatDate(gs.mostActiveDay) : '—'}</span>
            </ValInfo>
          </div>
        </div>
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
export default function RealmBook({ realm, games, page, onPageChange, selectedGame, onSelectGame, onDeleteGame, tourActive = false, chartRef, rosterRef, gamelogRef, tourHighlight = null, onExitToRealms = null }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    const isOpen = !!confirmDeleteId || !!selectedGame;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDeleteId, selectedGame]);

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
      if (confirmDeleteId || selectedGame || tourActive) return;
      if (e.key === 'ArrowLeft') {
        if (page > 0) onPageChange(page - 1);
        else onExitToRealms?.();
      }
      if (e.key === 'ArrowRight' && page < totalPages - 1) onPageChange(Math.min(totalPages - 1, page + 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, totalPages, confirmDeleteId, selectedGame, onPageChange, tourActive, onExitToRealms]);

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
