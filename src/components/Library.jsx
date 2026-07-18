import { useMemo, useState, useEffect } from 'react';
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import { calcGroupStats, calcPlayerRecords, calcRealmStandings } from '../utils/stats';
import PlayerCard, { PLAYER_COLOR_CLASSES } from './PlayerCard';
import PointBreakdownChart from './PointBreakdownChart';
import Lightbox from './Lightbox';
import StatInfo from './StatInfo';
import ValInfo from './ValInfo';
import { TrashIcon } from './icons';
import crownImg from '../../images/icons/crown.png';
import { formatDate } from '../utils/formatters';

const GAMES_PER_PAGE = 25;
const FIRST_LOG_PAGE = 3; // 0 cover, 1 overview, 2 fellowship, 3.. game log

// Book spine art, one per realm — numerically sorted so spine N stays stable
const SPINE_MODULES = import.meta.glob('../../images/logbook/*.png', { eager: true, import: 'default' });
const SPINES = Object.entries(SPINE_MODULES)
  .sort((a, b) => parseInt(a[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10) - parseInt(b[0].match(/(\d+)\.png$/)?.[1] ?? 0, 10))
  .map(([, img]) => img);

// Stable id hash so a realm keeps its binding when other realms are deleted
function spineFor(realm) {
  const hash = [...String(realm.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return SPINES[hash % SPINES.length];
}

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

function Bookshelf({ realms, games, onOpenBook }) {
  return (
    <div className="library-shelf">
      {realms.map(realm => (
        <button key={realm.id} type="button" className="book-spine" onClick={() => onOpenBook(realm)}>
          <div className="book-spine-art">
            <img src={spineFor(realm)} alt="" draggable={false} />
            <span className="book-spine-title">{realm.name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function CoverPage({ realm, realmGames, standings }) {
  const championNames = realmGames.length > 0 && standings.sorted[0] ? [...standings.leaders].join(' & ') : null;
  return (
    <div className="book-cover">
      <div className="book-cover-ornament">❦</div>
      <h3 className="book-cover-name">{realm.name}</h3>
      <div className="book-cover-ornament">❦</div>

      <div className="book-cover-rows">
        <div className="stat-row">
          <span className="stat-label">Games Played</span>
          <span className="stat-value">{realmGames.length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Players</span>
          <span className="stat-value">{(realm.players || []).length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Established</span>
          <span className="stat-value">{formatEstablished(realm)}</span>
        </div>
        <div className="stat-row">
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
      </div>
    </div>
  );
}

function OverviewPage({ realm, realmGames, standings, onOpenGame }) {
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
        ? <button type="button" onClick={() => onOpenGame(gameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline dotted' }}>{val}</button>
        : <span className="stat-value">{val}</span>
      }
    </div>
  );
  const durationVal = (text, gameObj) => gameObj
    ? <button type="button" onClick={() => onOpenGame(gameObj)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'var(--cursor-pointer)', fontFamily: 'Cinzel, serif', fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline dotted', fontSize: 'inherit' }}>{text}</button>
    : text;

  return (
    <PointBreakdownChart
      players={[...standings.sorted].sort((a, b) => (records[b.name.toLowerCase()]?.w || 0) - (records[a.name.toLowerCase()]?.w || 0))}
      title={null}
      bare
      winsByPlayer={Object.fromEntries(standings.sorted.map(ps => [ps.name, records[ps.name.toLowerCase()]?.w || 0]))}
      footerAlways
      footer={(
        <>
          <div className="milestones-subtitle">Realm Highlights</div>
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
            ['Average Game Length', formatDuration(gs.avgDuration), null, null],
            ['Farm Wins', gs.farmWins, null, 'Games won in final scoring stage.'],
            ['Clutch Games', gs.clutchGames, null, 'Games where winning margin was less than 7%.'],
          ].map(statRow)}
          <div className="stat-row" style={{ margin: 0 }}>
            <span className="stat-label">Most Active Day</span>
            <ValInfo tip={gs.mostActiveDay ? `${gs.mostActiveDayCount} ${gs.mostActiveDayCount === 1 ? 'game' : 'games'} played` : null}>
              <span className="stat-value">{gs.mostActiveDay ? formatDate(gs.mostActiveDay) : '—'}</span>
            </ValInfo>
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <span className="stat-label">Favorite Expansion</span>
            <div style={{ paddingLeft: '0.8rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {[['Full', favFull, favFullCount], ['Mini', favMini, favMiniCount]].map(([label, val, count]) => (
                <div key={label} className="stat-row" style={{ margin: 0 }}>
                  <span className="stat-label" style={{ color: 'var(--stone-gray)' }}>{label}</span>
                  <ValInfo tip={count !== null ? `Played in ${count} ${count === 1 ? 'game' : 'games'}` : null}>
                    <span className="stat-value" style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.78rem)', fontWeight: 500 }}>{val}</span>
                  </ValInfo>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    />
  );
}

function FellowshipPage({ standings, onOpenGame }) {
  const { sorted, leaders } = standings;
  return (
    <div>
      <div className={`stats-grid${(sorted.length === 2 || sorted.length === 4) ? ' stats-grid-2col' : ''}`} style={{ alignItems: 'start' }}>
        {sorted.map((ps, i) => (
          <PlayerCard
            key={ps.name}
            name={ps.name}
            stats={ps}
            breakdown={ps.breakdown}
            favMeeple={ps.favMeeple}
            favMeepleCount={ps.favMeepleCount}
            colorClass={PLAYER_COLOR_CLASSES[i % PLAYER_COLOR_CLASSES.length]}
            isLeader={leaders.has(ps.name)}
            onNavigateToGame={onOpenGame}
          />
        ))}
      </div>
    </div>
  );
}

function GameLogPage({ pageGames, onSelectGame }) {
  if (pageGames.length === 0) {
    return <div className="empty-state">No games recorded for this realm yet.</div>;
  }
  return (
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
            return (
              <tr key={game.id} onClick={() => onSelectGame(game)} style={{ cursor: 'var(--cursor-pointer)' }}>
                <td className="cell-date">{formatDate(game.date)}</td>

                <td style={{
                  fontWeight: 600,
                  color:      'var(--forest-green)',
                  fontStyle:  'normal',
                  whiteSpace: 'nowrap',
                }}>
                  {topPlayers.length > 1 ? topPlayers.join(' & ') : winner?.name}
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
  );
}

export default function Library({ games, realms = [], currentRealm = null, onRealmChange, onDeleteGame, onDeleteRealm, onLeaveRealm, isGuest = false, showDemoData = false, onToggleDemoData = null, openGame = null, onOpenGameClear }) {
  const [openBookId,        setOpenBookId]        = useState(null); // null = shelf
  const [page,              setPage]              = useState(0);
  const [selectedGame,      setSelectedGame]      = useState(null);
  const [confirmDeleteId,   setConfirmDeleteId]   = useState(null); // game delete
  const [confirmDeleteRealm, setConfirmDeleteRealm] = useState(false);
  const [confirmLeave,      setConfirmLeave]      = useState(false);

  const openRealm  = realms.find(r => r.id === openBookId) || null;
  const realmGames = useMemo(
    () => (openRealm ? games.filter(g => g.realmId === openRealm.id) : []),
    [games, openRealm]
  );
  const standings  = useMemo(() => calcRealmStandings(realmGames, openRealm), [realmGames, openRealm]);

  const logPages   = Math.max(1, Math.ceil(realmGames.length / GAMES_PER_PAGE));
  const totalPages = FIRST_LOG_PAGE + logPages;

  const openBook = (realm) => {
    setOpenBookId(realm.id);
    setPage(0);
    onRealmChange?.(realm); // keep the app-wide realm selection in sync
  };
  const closeBook = () => {
    setOpenBookId(null);
    setPage(0);
  };

  // Cross-nav from other pages: land on the right book, the right log page,
  // and open the game's lightbox
  useEffect(() => {
    if (!openGame) return;
    const realm = realms.find(r => r.id === openGame.realmId);
    if (realm) {
      setOpenBookId(realm.id);
      onRealmChange?.(realm);
      const idx = games.filter(g => g.realmId === realm.id).findIndex(g => g.id === openGame.id);
      setPage(idx >= 0 ? FIRST_LOG_PAGE + Math.floor(idx / GAMES_PER_PAGE) : 0);
      setSelectedGame(openGame);
    }
    onOpenGameClear?.();
  }, [openGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to the shelf if the open realm disappears (deleted / left / demo off)
  useEffect(() => {
    if (openBookId && !realms.some(r => r.id === openBookId)) closeBook();
  }, [openBookId, realms]);

  // Land at the top of each new page — after render, so the shorter page
  // can't restore the old scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Deleting games can shrink the log — keep the page in range
  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  useEffect(() => {
    const isOpen = !!confirmDeleteId || confirmDeleteRealm || confirmLeave || !!selectedGame;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDeleteId, confirmDeleteRealm, confirmLeave, selectedGame]);

  const handleConfirmDelete = async () => {
    await onDeleteGame(confirmDeleteId);
    setConfirmDeleteId(null);
    setSelectedGame(null);
  };

  const pageLabel = page === 0 ? 'Cover'
    : page === 1 ? 'Overview'
    : page === 2 ? 'Roster'
    : 'Game Log';

  return (
    <div>
      {/* Game delete confirmation modal */}
      {confirmDeleteId && (
        <div className="realm-modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Remove this game?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently remove the game from the logbook. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Realm delete confirmation modal */}
      {confirmDeleteRealm && openRealm && (
        <div className="realm-modal-overlay" onClick={() => setConfirmDeleteRealm(false)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will permanently delete <strong>{openRealm.name}</strong> and all its recorded games. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteRealm(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setConfirmDeleteRealm(false); onDeleteRealm?.(openRealm.id); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave-realm confirmation modal (shared realms only) */}
      {confirmLeave && openRealm && (
        <div className="realm-modal-overlay" onClick={() => setConfirmLeave(false)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.5rem' }}>Leave this realm?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              <strong>{openRealm.name}</strong> and its games will disappear from your account.
              The owner's data is unaffected, and they can invite you again later.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setConfirmLeave(false); onLeaveRealm?.(openRealm.id); }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — shared by log rows and stat game-links */}
      {selectedGame && (
        <Lightbox
          game={selectedGame}
          games={realmGames}
          onNavigate={setSelectedGame}
          onClose={() => setSelectedGame(null)}
          onDeleteRequest={(isGuest && showDemoData) || openRealm?.isOwner === false ? null : () => setConfirmDeleteId(selectedGame.id)}
        />
      )}

      <div className="section-title">
        {openRealm ? (
          <button type="button" className="section-title-back" onClick={closeBook} title="Back to the library">‹ Library</button>
        ) : (
          <h2>Library</h2>
        )}
        <div className="section-title-line" />
        {openRealm && <span className="game-count">{openRealm.name}</span>}
        {onToggleDemoData && (
          <button type="button" className={`expansion-chip${showDemoData ? ' selected' : ''}`} onClick={onToggleDemoData} style={{ fontSize: 'clamp(0.72rem, 2.2vw, 0.9rem)', padding: '0.5rem 1.1rem', marginLeft: '0.5rem' }}>
            {showDemoData ? 'Click to exit' : 'See how it works!'}
          </button>
        )}
      </div>

      {isGuest && !showDemoData ? (
        <div className="empty-state">
          Sign in to access the library.
        </div>
      ) : !openRealm ? (
        realms.length === 0 ? (
          <div className="empty-state">
            No realms yet. Create one from the Play tab to start your library.
          </div>
        ) : (
          <Bookshelf realms={realms} games={games} onOpenBook={openBook} />
        )
      ) : (
        <div className="realm-book">
          <div className="book-header">
            <span className="book-nav-label" style={{ flex: 1 }}>{pageLabel}</span>
          </div>

          <div className="book-page" key={page}>
            {page === 0 && (
              <CoverPage
                realm={openRealm}
                realmGames={realmGames}
                standings={standings}
              />
            )}
            {page === 1 && (
              <OverviewPage
                realm={openRealm}
                realmGames={realmGames}
                standings={standings}
                onOpenGame={setSelectedGame}
              />
            )}
            {page === 2 && (
              <FellowshipPage standings={standings} onOpenGame={setSelectedGame} />
            )}
            {page >= FIRST_LOG_PAGE && (
              <GameLogPage
                pageGames={realmGames.slice((page - FIRST_LOG_PAGE) * GAMES_PER_PAGE, (page - FIRST_LOG_PAGE + 1) * GAMES_PER_PAGE)}
                onSelectGame={setSelectedGame}
              />
            )}
          </div>

          <div className="book-nav">
            {/* On the cover, the dead Back slot hosts delete (owner) / leave (member) instead */}
            {page === 0 && !showDemoData ? (
              openRealm.isOwner !== false ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteRealm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrashIcon />
                </button>
              ) : (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmLeave(true)}>Leave Realm</button>
              )
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹ Back</button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
