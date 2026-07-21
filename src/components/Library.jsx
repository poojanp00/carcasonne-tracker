import { useMemo, useState, useEffect } from 'react';
import { DEFAULT_EXPANSIONS } from '../data/expansions';
import { calcGroupStats, calcPlayerRecords, calcRealmStandings, calcPlayerTrophyTallies } from '../utils/stats';
import PlayerCard, { PLAYER_COLOR_CLASSES } from './PlayerCard';
import PointBreakdownChart from './PointBreakdownChart';
import Lightbox from './Lightbox';
import StatInfo from './StatInfo';
import ValInfo from './ValInfo';
import { TrashIcon, GearIcon } from './icons';
import crownImg from '../../images/icons/crown.png';
import { formatDate } from '../utils/formatters';
import Bookshelf from './Bookshelf';
import { chestFor, unlockedChests } from '../data/chests';
import { spineFor, unlockedSpines } from '../data/spines';

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
      footerAlways
      footer={(
        <div className="book-overview-grid">
        <div className="stat-rows-narrow">
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
        <div className="stat-rows-narrow">
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
      )}
      />
    </div>
  );
}

function FellowshipPage({ standings, realmGames, onOpenGame }) {
  const { sorted, leaders } = standings;
  return (
    <div>
      <div className={`stats-grid${(sorted.length === 2 || sorted.length === 4) ? ' stats-grid-2col' : ''}`} style={{ alignItems: 'start' }}>
        {sorted.map((ps, i) => (
          <PlayerCard
            key={ps.name}
            name={ps.name}
            stats={ps}
            tallies={calcPlayerTrophyTallies(realmGames, ps.name)}
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

export default function Library({ games, realms = [], currentRealm = null, onRealmChange, onDeleteGame, onDeleteRealm, onLeaveRealm, onUpdateRealm, selfRank = 1, isGuest = false, showDemoData = false, onToggleDemoData = null, openGame = null, onOpenGameClear }) {
  const [openBookId,        setOpenBookId]        = useState(null); // null = shelf
  const [page,              setPage]              = useState(0);
  const [selectedGame,      setSelectedGame]      = useState(null);
  const [confirmDeleteId,   setConfirmDeleteId]   = useState(null); // game delete
  const [confirmDeleteRealm, setConfirmDeleteRealm] = useState(false);
  const [confirmLeave,      setConfirmLeave]      = useState(false);

  // Realm Settings popup — null | 'menu' | 'rename' | 'chest' | 'logbook'
  const [realmSettingsView, setRealmSettingsView] = useState(null);
  const [realmNameInput,    setRealmNameInput]    = useState('');
  const [realmNameError,    setRealmNameError]    = useState('');
  const [chestPick,         setChestPick]         = useState(0);
  const [spinePick,         setSpinePick]         = useState(0);

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

  const openRealmSettings  = () => setRealmSettingsView('menu');
  const closeRealmSettings = () => { setRealmSettingsView(null); setRealmNameError(''); };
  const startRenameRealm   = () => { setRealmNameInput(openRealm?.name || ''); setRealmNameError(''); setRealmSettingsView('rename'); };

  const handleSaveRealmName = (e) => {
    e.preventDefault();
    const trimmed = realmNameInput.trim();
    if (!trimmed) { setRealmNameError('Realm name cannot be empty.'); return; }
    if (realms.some(r => r.id !== openRealm.id && r.name.toLowerCase() === trimmed.toLowerCase())) {
      setRealmNameError('A realm with this name already exists.');
      return;
    }
    onUpdateRealm?.(openRealm.id, { name: trimmed });
    setRealmSettingsView('menu');
  };

  const openChestPicker = () => { setChestPick(openRealm?.chest ?? 0); setRealmSettingsView('chest'); };
  const handleSaveChest = () => { onUpdateRealm?.(openRealm.id, { chest: chestPick }); setRealmSettingsView('menu'); };

  const openLogbookPicker = () => { setSpinePick(openRealm?.spine ?? 0); setRealmSettingsView('logbook'); };
  const handleSaveLogbook = () => { onUpdateRealm?.(openRealm.id, { spine: spinePick }); setRealmSettingsView('menu'); };

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
    const isOpen = !!confirmDeleteId || confirmDeleteRealm || confirmLeave || !!selectedGame || !!realmSettingsView;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmDeleteId, confirmDeleteRealm, confirmLeave, selectedGame, realmSettingsView]);

  // Arrow-key page turning while a book is open — suppressed under any modal
  // (the Lightbox has its own Up/Down key handling for game-to-game nav)
  useEffect(() => {
    if (!openRealm) return;
    const onKey = (e) => {
      if (confirmDeleteId || confirmDeleteRealm || confirmLeave || selectedGame || realmSettingsView) return;
      if (e.key === 'ArrowLeft' && page > 0) setPage(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight' && page < totalPages - 1) setPage(p => Math.min(totalPages - 1, p + 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openRealm, page, totalPages, confirmDeleteId, confirmDeleteRealm, confirmLeave, selectedGame, realmSettingsView]);

  const handleConfirmDelete = async () => {
    await onDeleteGame(confirmDeleteId);
    setConfirmDeleteId(null);
    setSelectedGame(null);
  };

  const pageLabel = page === 0 ? 'Overview'
    : page === 1 ? 'Roster'
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

      {/* Realm Settings — rename/chest/logbook (owner only) plus the Danger Zone
          (Delete for the owner, Leave for a member), mirroring Profile's Account Settings */}
      {realmSettingsView === 'menu' && openRealm && (
        <div className="realm-modal-overlay" onClick={closeRealmSettings}>
          <div className="realm-modal tile-card settings-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <GearIcon /> Realm Settings
            </h3>

            {openRealm.isOwner !== false && (
              <div className="settings-section">
                <div className="settings-section-header">Realm Identity</div>
                <div className="settings-row">
                  <span className="settings-row-label">Realm Name</span>
                  <span className="settings-row-control">
                    <span className="settings-row-value">{openRealm.name}</span>
                    <button type="button" className="settings-edit-btn" onClick={startRenameRealm}>Edit</button>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">Chest</span>
                  <span className="settings-row-control">
                    <img src={chestFor(openRealm)} alt="" style={{ height: '36px', width: 'auto' }} draggable={false} />
                    <button type="button" className="settings-edit-btn" onClick={openChestPicker}>Change</button>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">Logbook</span>
                  <span className="settings-row-control">
                    <img src={spineFor(openRealm)} alt="" style={{ height: '44px', width: 'auto' }} draggable={false} />
                    <button type="button" className="settings-edit-btn" onClick={openLogbookPicker}>Change</button>
                  </span>
                </div>
              </div>
            )}

            <div className="settings-section settings-danger">
              <div className="settings-section-header">Danger Zone</div>
              {openRealm.isOwner !== false ? (
                <div className="settings-row">
                  <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                    Permanently delete this realm and all its games
                  </span>
                  <button
                    type="button"
                    className="settings-delete-btn"
                    onClick={() => { setRealmSettingsView(null); setConfirmDeleteRealm(true); }}
                  >
                    <TrashIcon /> Delete Realm
                  </button>
                </div>
              ) : (
                <div className="settings-row">
                  <span className="settings-row-label" style={{ color: 'var(--stone-gray)', fontSize: '0.85rem' }}>
                    Leave this shared realm
                  </span>
                  <button
                    type="button"
                    className="settings-delete-btn"
                    onClick={() => { setRealmSettingsView(null); setConfirmLeave(true); }}
                  >
                    Leave Realm
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.4rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={closeRealmSettings}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename realm */}
      {realmSettingsView === 'rename' && openRealm && (
        <div className="realm-modal-overlay" onClick={closeRealmSettings}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem' }}>Rename Realm</h3>
            <form onSubmit={handleSaveRealmName}>
              <input
                type="text"
                className="form-input"
                value={realmNameInput}
                onChange={e => setRealmNameInput(e.target.value)}
                maxLength={40}
                autoFocus
                placeholder="Realm name"
                style={{ width: '100%', marginBottom: '1rem' }}
              />
              {realmNameError && (
                <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{realmNameError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRealmSettingsView('menu')}>Cancel</button>
                <button type="submit" className="btn btn-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change chest */}
      {realmSettingsView === 'chest' && openRealm && (
        <div className="realm-modal-overlay" onClick={closeRealmSettings}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '0.8rem' }}>Change Chest</h3>
            <div className="meeple-options">
              {unlockedChests(selfRank).map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`meeple-option chest-option${chestPick === i ? ' selected' : ''}`}
                  onClick={() => setChestPick(i)}
                >
                  <img src={img} alt={`Chest ${i + 1}`} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRealmSettingsView('menu')}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={handleSaveChest}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Change logbook */}
      {realmSettingsView === 'logbook' && openRealm && (
        <div className="realm-modal-overlay" onClick={closeRealmSettings}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '0.8rem' }}>Change Logbook</h3>
            <div className="logbook-picker-row">
              {unlockedSpines(selfRank).map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`logbook-pick${spinePick === i ? ' selected' : ''}`}
                  onClick={() => setSpinePick(i)}
                >
                  <img src={img} alt={`Logbook ${i + 1}`} draggable={false} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRealmSettingsView('menu')}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={handleSaveLogbook}>Save</button>
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
              <OverviewPage
                realm={openRealm}
                realmGames={realmGames}
                standings={standings}
                onOpenGame={setSelectedGame}
              />
            )}
            {page === 1 && (
              <FellowshipPage standings={standings} realmGames={realmGames} onOpenGame={setSelectedGame} />
            )}
            {page >= FIRST_LOG_PAGE && (
              <GameLogPage
                pageGames={realmGames.slice((page - FIRST_LOG_PAGE) * GAMES_PER_PAGE, (page - FIRST_LOG_PAGE + 1) * GAMES_PER_PAGE)}
                onSelectGame={setSelectedGame}
              />
            )}
          </div>

          <div className="book-nav">
            {/* On the first page, the dead Back slot hosts realm settings (owner/member)
                instead — guests keep the plain delete button, since their single ephemeral
                realm has nothing to rename or customize. */}
            {page === 0 && !showDemoData ? (
              isGuest ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteRealm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrashIcon />
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={openRealmSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <GearIcon /> Edit
                </button>
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
