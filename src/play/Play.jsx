/**
 * PLAY — Phone-side party mode UI
 *
 * Manages the full phone player flow:
 *   entry  → player enters game code + their name
 *   meeple → player picks their meeple (taken ones are greyed out)
 *   joined → score controller (category buttons)
 *
 * Rendered at /play by main.jsx when party mode is active.
 */

import { useState, useEffect, useRef } from 'react';
import { SCORE_TYPE_ORDER, SCORE_TYPE_COLORS, MONASTERY_LIKE_TYPES, MONASTERY_LIKE_MAX } from '../constants';
import {
  getSessionByCode,
  getSessionById,
  claimRosterSlot,
  unclaimRosterSlot,
  submitEvent,
  fetchNewEvents,
  subscribeSession,
  subscribeEvents,
  getDeviceId,
  unsubscribe,
} from '../data/partySession';

const GOODS_SUPPLY = { wine: 9, grain: 6, cloth: 5 };
import ScoreCategoryButtons from '../components/ScoreCategoryButtons';
import GameHighlights from '../components/GameHighlights';
import PointBreakdownChart from '../components/PointBreakdownChart';
import { transformMaxFeaturesToUI } from '../utils/achievements';
import { getMeepleColor } from '../utils/formatters';
import { computeWinners } from '../utils/scoring';
import crownImg from '../../images/icons/crown.png';
import pigImg   from '../../images/icons/pig.png';

const GOODS_MODULES = import.meta.glob('../../images/goods_tokens/*.png', { eager: true, import: 'default' });
const GOODS_IMGS = Object.fromEntries(
  Object.entries(GOODS_MODULES).map(([p, img]) => [p.split('/').pop().replace('.png', ''), img])
);

// ── Meeple image loading ──────────────────────────────────────────────────────

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};


const FUN_MEEPLES = Object.entries(FUN_MODULES)
  .map(([p, img]) => ({ key: `fun/${p.split('/').pop()}`, img }));

// Regular color meeples (not fun/) shown in the picker grid
const REGULAR_MEEPLES = Object.entries(MEEPLE_MODULES)
  .map(([p, img]) => ({ key: p.split('/').pop(), img }))
  .filter(m => m.key !== 'mystery.png')
  .sort((a, b) => a.key.localeCompare(b.key));

const MYSTERY_IMG = MEEPLE_IMGS['mystery.png'] || Object.values(MEEPLE_IMGS)[0];
const FALLBACK = Object.values(MEEPLE_IMGS)[0];

// ── Play component ────────────────────────────────────────────────────────────

export default function Play() {
  const [phase, setPhase] = useState('entry'); // 'entry' | 'meeple' | 'joined' | 'ended'
  const [sessionData, setSessionData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [selectedMeeple, setSelectedMeeple] = useState(null);
  const [scoreInput, setScoreInput] = useState('0');
  const [myTokens, setMyTokens] = useState({ wine: 0, grain: 0, cloth: 0 });
  const [goodsUsed, setGoodsUsed] = useState({ wine: 0, grain: 0, cloth: 0 });
  const [finalData, setFinalData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSubmit, setLastSubmit] = useState(null); // { label, delta | null }
  const [myBreakdown, setMyBreakdown] = useState({});
  const [barTooltip, setBarTooltip] = useState(null);
  const barRef = useRef(null);
  const playerNameRef = useRef('');
  const sessionDataRef = useRef(null);

  // ── Track total goods tokens used across all players ─────────────────────
  // Fetches all past goods events on join then subscribes to new ones.
  // goodsUsed drives the supply remaining count and disables buttons at 0.

  useEffect(() => {
    if (!sessionData?.id || phase !== 'joined') return;

    let sub = null;

    async function init() {
      const past = await fetchNewEvents(sessionData.id, 0);
      const used = { wine: 0, grain: 0, cloth: 0 };
      const breakdown = {};
      for (const ev of past) {
        if (ev.category.startsWith('goods_')) {
          const good = ev.category.replace('goods_', '');
          used[good] = (used[good] || 0) + 1;
        } else if (ev.player_name?.toLowerCase() === playerName.toLowerCase() && ev.delta > 0) {
          breakdown[ev.category] = (breakdown[ev.category] || 0) + ev.delta;
        }
      }
      setGoodsUsed(used);
      setMyBreakdown(breakdown);

      sub = subscribeEvents(sessionData.id, (ev) => {
        if (ev.category.startsWith('goods_')) {
          const good = ev.category.replace('goods_', '');
          setGoodsUsed(prev => ({ ...prev, [good]: prev[good] + 1 }));
        } else if (ev.player_name?.toLowerCase() === playerName.toLowerCase() && ev.delta > 0) {
          setMyBreakdown(prev => ({ ...prev, [ev.category]: (prev[ev.category] || 0) + ev.delta }));
        }
      });
    }

    init();
    return () => { unsubscribe(sub); };
  }, [sessionData?.id, phase]);

  // Keep refs in sync so beforeunload can read current values without stale closure
  useEffect(() => { playerNameRef.current  = playerName;  }, [playerName]);
  useEffect(() => { sessionDataRef.current = sessionData; }, [sessionData]);

  // ── Subscribe to session updates (phase changes + roster changes) ──────────

  useEffect(() => {
    if (!sessionData?.id) return;

    const sessionSub = subscribeSession(sessionData.id, async (updated) => {
      setSessionData(updated);
      if (updated.phase === 'ended') {
        // Fetch directly — Realtime doesn't reliably send large JSONB in payload.new
        const full = await getSessionById(updated.id);
        if (full?.final_data) setFinalData(full.final_data);
        setPhase('ended');
      }
    });

    return () => { unsubscribe(sessionSub); };
  }, [sessionData?.id]);

  // ── Unclaim on disconnect ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'joined') return;

    function handleUnload() {
      const sd = sessionDataRef.current;
      const pn = playerNameRef.current;
      if (sd?.id && pn) unclaimRosterSlot(sd.id, pn.toLowerCase());
    }

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      // Also unclaim on React unmount (tab navigates away within the SPA)
      handleUnload();
    };
  }, [phase]);

  // ── ENTRY: validate code + name ───────────────────────────────────────────

  async function handleEntry(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const code = form.code.value.trim().toUpperCase();
    const name = form.name.value.trim();

    if (!code || !name) { setError('Please enter both a code and your name.'); return; }

    setLoading(true);
    setError(null);

    const session = await getSessionByCode(code);
    if (!session) {
      setError('No active game found for that code. Check the code and try again.');
      setLoading(false);
      return;
    }

    const roster = session.roster || [];
    const slot = roster.find(r => (r.name_lower || r.name.toLowerCase()) === name.toLowerCase());
    if (!slot) {
      setError(`"${name}" is not in this game's player list. Check your spelling.`);
      setLoading(false);
      return;
    }

    // Block if actively claimed by a different device
    const deviceId = getDeviceId();
    if (slot.claimed && slot.device_id !== deviceId) {
      setError(`"${name}" is already connected to this game. Ask them to leave first.`);
      setLoading(false);
      return;
    }

    setSessionData(session);
    setPlayerName(name);
    setPhase('meeple');
    setLoading(false);
  }

  // ── MEEPLE: claim name with chosen meeple ─────────────────────────────────

  async function handleJoin() {
    if (!selectedMeeple) { setError('Pick a meeple first.'); return; }

    setLoading(true);
    setError(null);

    const deviceId = getDeviceId();
    const result = await claimRosterSlot(sessionData.id, playerName.toLowerCase(), deviceId, selectedMeeple);

    if (!result?.ok) {
      if (result?.reason === 'taken') {
        setError(`"${playerName}" was just claimed by another device.`);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    setPhase('joined');
    setLoading(false);
  }

  // ── JOINED: submit score event ────────────────────────────────────────────

  async function handleScoreSubmit(category, delta) {
    const isGoods = category.startsWith('goods_');
    if (!isGoods && (!delta || delta === 0)) return;

    if (isGoods) {
      const good = category.replace('goods_', '');
      if (goodsUsed[good] >= GOODS_SUPPLY[good]) {
        setError(`No ${good} tokens left in supply.`);
        return;
      }
    }

    if (MONASTERY_LIKE_TYPES.includes(category) && Math.abs(Number(delta)) > MONASTERY_LIKE_MAX) {
      setError(`${category.charAt(0).toUpperCase() + category.slice(1)} can only score up to ${MONASTERY_LIKE_MAX} points.`);
      return;
    }

    try {
      await submitEvent({ sessionId: sessionData.id, playerName, category, delta: isGoods ? 0 : delta });
      if (isGoods) {
        const good = category.replace('goods_', '');
        setMyTokens(prev => ({ ...prev, [good]: prev[good] + 1 }));
        setLastSubmit({ label: good.charAt(0).toUpperCase() + good.slice(1) + ' token', delta: null });
      } else {
        setLastSubmit({ label: category, delta });
      }
      setScoreInput('0');
      setTimeout(() => setLastSubmit(null), 2000);
    } catch {
      setError('Failed to submit. Check your connection.');
    }
  }


  // ── RENDER ────────────────────────────────────────────────────────────────

  const roster = sessionData?.roster || [];
  const takenMeeples = new Set(
    roster
      .filter(r => r.claimed && (r.name_lower || r.name.toLowerCase()) !== playerName.toLowerCase())
      .map(r => r.meeple)
      .filter(Boolean)
  );

  if (phase === 'ended') {
    const fd = finalData;
    const fdPlayers = fd?.players || [];
    const fdScores  = fd?.finalScores || {};
    const fdBreakdown = fd?.scoreBreakdown || {};
    const fdMeeples = fd?.meeples || {};
    const sorted = [...fdPlayers].sort((a, b) => (fdScores[b] || 0) - (fdScores[a] || 0));
    const { winners } = computeWinners(fdScores);
    const achievements = fd?.maxFeatures ? transformMaxFeaturesToUI(fd.maxFeatures) : {};
    const hasHighlights = Object.keys(achievements).length > 0;
    const fdFarmWin = fd?.farmWin || false;

    const fdDuration   = fd?.gameDuration || 0;
    const fdExpansions = fd?.expansions || [];

    return (
      <div className="pregame-screen" style={{ maxWidth: 520, margin: '0 auto', padding: '0 1rem 3rem' }}>
        <header className="site-header" style={{ margin: '0 -1rem', flexShrink: 0 }}>
          <h1 className="header-title" style={{ fontSize: '1.35rem' }}>Carcasscore</h1>
        </header>

        {/* Title */}
        <div className="section-title">
          <h2>{fd ? 'Final Scores' : 'Oops!'}</h2>
          <div className="section-title-line" />
        </div>

        {fd ? (
          <>
            {/* Info bar */}
            <div style={{ marginBottom: '1.2rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.45rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
              {fdDuration > 0 && <>
                <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
                <div style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
                  {Math.floor(fdDuration / 60000)}m {Math.floor((fdDuration % 60000) / 1000)}s
                </div>
              </>}
              {fdExpansions.length > 0 && <>
                <div style={{ width: '1px', height: '20px', background: 'var(--stone-gray)', opacity: 0.3 }} />
                <div style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--stone-gray)', fontStyle: 'italic' }}>
                  {fdExpansions.join(' · ')}
                </div>
              </>}
            </div>

            {/* Leaderboard */}
            <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
              <div className="postgame-scores-grid">
                {sorted.map(name => {
                  const color    = getMeepleColor(fdMeeples[name]);
                  const isWinner = winners.includes(name);
                  return (
                    <div key={name} className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={MEEPLE_IMGS[fdMeeples[name]] || FALLBACK} alt={name} style={{ height: 26, width: 'auto' }} />
                        <span style={{ fontFamily: 'Cinzel, serif', color, fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>{name}</span>
                        {isWinner && <img src={crownImg} alt="winner" className="postgame-crown" />}
                        {isWinner && fdFarmWin && <img src={pigImg} alt="farm win" className="postgame-pig" />}
                        <div className="postgame-score-display">{fdScores[name] ?? 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Score breakdown */}
            <PointBreakdownChart
              players={sorted.map(name => ({ name, breakdown: fdBreakdown[name] || {} }))}
            />

            {/* Highlights */}
            {hasHighlights && (
              <div className="tile-card" style={{ marginTop: '1.4rem' }}>
                <GameHighlights achievements={achievements} />
              </div>
            )}
          </>
        ) : (
          <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '1rem' }}>
            The host has reset the board.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.6rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.href = '/play'}
          >
            Play Again →
          </button>
        </div>
      </div>
    );
  }

  // Final scoring lock
  if (phase === 'joined' && sessionData?.phase === 'final_scoring') {
    return (
      <div className="play-shell">
        <header className="site-header" style={{ alignSelf: 'stretch', margin: '0 -1rem', flexShrink: 0 }}>
          <h1 className="header-title" style={{ fontSize: '1.35rem' }}>Carcasscore</h1>
        </header>
        <div className="play-card">
          <img
            src={MEEPLE_IMGS[selectedMeeple] || FALLBACK}
            alt="Your meeple"
            style={{ height: 64, marginBottom: '0.8rem' }}
          />
          <div className="play-title" style={{ fontSize: '1.1rem' }}>{playerName}</div>
          <div style={{ marginTop: '1.5rem', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'var(--stone-gray)', textAlign: 'center', lineHeight: 1.5 }}>
            Final scoring in progress.<br /><br />Please refer to the host screen.
          </div>
        </div>
      </div>
    );
  }

  // ── Entry screen ──
  if (phase === 'entry') {
    return (
      <div className="play-shell">
        <header className="site-header" style={{ alignSelf: 'stretch', margin: '0 -1rem', flexShrink: 0 }}>
          <h1 className="header-title" style={{ fontSize: '1.35rem' }}>Carcasscore</h1>
        </header>
        <div className="play-card">
          <p className="play-subtitle" style={{ textAlign: 'left' }}>Join a party</p>

          <form onSubmit={handleEntry} style={{ width: '100%' }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Game Code</label>
              <input
                name="code"
                className="form-input"
                placeholder="e.g. WOLF"
                autoCapitalize="characters"
                autoComplete="off"
                style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '1.25rem', textAlign: 'center' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label className="form-label">Player Name</label>
              <input
                name="name"
                className="form-input"
                placeholder="Enter your player name"
                autoComplete="off"
                style={{ fontSize: '1.1rem' }}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.88rem', marginBottom: '0.8rem' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Checking…' : 'Continue →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Meeple picker ──
  if (phase === 'meeple') {
    return (
      <div className="play-shell">
        <header className="site-header" style={{ alignSelf: 'stretch', margin: '0 -1rem', flexShrink: 0 }}>
          <h1 className="header-title" style={{ fontSize: '1.35rem' }}>Carcasscore</h1>
        </header>
        <div className="play-card" style={{ maxWidth: 480 }}>
          <h2 className="play-title" style={{ fontSize: '1.2rem', textAlign: 'left' }}>Choose Your Meeple</h2>

          <div className="play-meeple-grid">
            {REGULAR_MEEPLES.map(({ key, img }) => {
              const taken = takenMeeples.has(key);
              const chosen = selectedMeeple === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`play-meeple-option${chosen ? ' selected' : ''}${taken ? ' taken' : ''}`}
                  onClick={() => { if (!taken) { setSelectedMeeple(key); setError(null); } }}
                  disabled={taken}
                >
                  <img src={img} alt={key.replace('.png', '')} />
                </button>
              );
            })}
            {/* Mystery = roll a random fun meeple; re-click to re-roll */}
            {(() => {
              const isFunSelected = selectedMeeple?.startsWith('fun/');
              const funImg = isFunSelected ? MEEPLE_IMGS[selectedMeeple] : null;
              return (
                <button
                  type="button"
                  className={`play-meeple-option${isFunSelected ? ' selected' : ''}`}
                  onClick={() => {
                    const available = FUN_MEEPLES.filter(m => !takenMeeples.has(m.key) && m.key !== selectedMeeple);
                    const pool = available.length > 0 ? available : FUN_MEEPLES.filter(m => m.key !== selectedMeeple) || FUN_MEEPLES;
                    const picked = pool[Math.floor(Math.random() * pool.length)];
                    setSelectedMeeple(picked.key);
                    setError(null);
                  }}
                  title={isFunSelected ? 'Click to re-roll' : 'Surprise me!'}
                >
                  <img src={funImg || MYSTERY_IMG} alt="mystery" />
                </button>
              );
            })()}
          </div>

          {error && (
            <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.88rem', margin: '0.8rem 0 0' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1.4rem', width: '100%' }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setPhase('entry'); setError(null); }}>
              ← Back
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleJoin}
              disabled={!selectedMeeple || loading}
            >
              {loading ? 'Joining…' : 'Join Game'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasTB = (sessionData?.expansions || []).includes('Traders & Builders');
  const hasTokens = hasTB && (myTokens.wine > 0 || myTokens.grain > 0 || myTokens.cloth > 0);
  const allPlayersJoined = roster.length > 0 && roster.every(r => r.claimed);
  const goodsRemaining = hasTB
    ? { wine: GOODS_SUPPLY.wine - goodsUsed.wine, grain: GOODS_SUPPLY.grain - goodsUsed.grain, cloth: GOODS_SUPPLY.cloth - goodsUsed.cloth }
    : undefined;

  // ── Score controller ──
  return (
    <div className="play-shell">
      <header className="site-header" style={{ alignSelf: 'stretch', margin: '0 -1rem', flexShrink: 0 }}>
        <h1 className="header-title" style={{ fontSize: '1.35rem' }}>Carcasscore</h1>
      </header>
      {/* Player header */}
      <div className="play-player-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src={MEEPLE_IMGS[selectedMeeple] || FALLBACK}
            alt="Your meeple"
            className="play-player-meeple"
          />
          <div className="play-player-info">
            <span className="play-player-name">{playerName}</span>
            {hasTokens && (
              <div className="play-player-tokens">
                {['wine', 'grain', 'cloth'].filter(g => myTokens[g] > 0).map(g => (
                  <span key={g} className="play-token-chip">
                    {GOODS_IMGS[g]
                      ? <img src={GOODS_IMGS[g]} alt={g} className="play-token-img" />
                      : g.charAt(0).toUpperCase() + g.slice(1)
                    }
                    ×{myTokens[g]}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Score total */}
          {Object.keys(myBreakdown).length > 0 && (
            <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.5rem', color: 'var(--earth-brown)', marginLeft: 'auto' }}>
              {Object.values(myBreakdown).reduce((s, v) => s + v, 0)}
            </span>

          )}
        </div>

        {/* Breakdown bar — always visible once scores exist */}
        {Object.keys(myBreakdown).length > 0 && (() => {
          const orderedTypes = SCORE_TYPE_ORDER.filter(t => (myBreakdown[t] || 0) > 0);
          const total = orderedTypes.reduce((s, t) => s + myBreakdown[t], 0);
          return (
            <div style={{ marginTop: '1.6rem', position: 'relative' }}
              onMouseLeave={() => setBarTooltip(null)}>
              <div ref={barRef} style={{ display: 'flex', height: '16px', borderRadius: '6px', overflow: 'hidden' }}>
                {orderedTypes.map(t => (
                  <div
                    key={t}
                    style={{ flex: myBreakdown[t] / total, backgroundColor: SCORE_TYPE_COLORS[t], cursor: 'default' }}
                    onMouseEnter={(e) => {
                      if (!barRef.current) return;
                      const sr = e.currentTarget.getBoundingClientRect();
                      const cr = barRef.current.getBoundingClientRect();
                      setBarTooltip({ type: t, value: myBreakdown[t], x: sr.left + sr.width / 2 - cr.left, y: sr.bottom - cr.top });
                    }}
                  />
                ))}
              </div>
              {barTooltip && (
                <div style={{ position: 'absolute', left: barTooltip.x, top: barTooltip.y + 6, transform: 'translateX(-50%)', background: 'var(--earth-brown)', color: 'var(--parchment)', padding: '0.25rem 0.5rem', borderRadius: '6px', zIndex: 100, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 3px 12px rgba(0,0,0,0.35)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'rgba(240,230,210,0.7)', marginBottom: '0.1rem' }}>{barTooltip.type}</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.85rem' }}>{barTooltip.value}</div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Score input area */}
      <div className="play-card play-controller-card">
        {sessionData?.phase !== 'active' && (
          <div className="score-cat-label" style={{ marginBottom: '0.5rem' }}>You're all set!</div>
        )}

        {sessionData?.phase === 'lobby' ? (
          <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', textAlign: 'center', fontSize: '0.95rem', marginTop: '0.4rem' }}>
            {allPlayersJoined
              ? 'Waiting for the host to start the game…'
              : 'Waiting for more players to join…'}
          </p>
        ) : (
          <ScoreCategoryButtons
            expansions={sessionData?.expansions || []}
            value={scoreInput}
            onChange={setScoreInput}
            onSubmit={handleScoreSubmit}
            goodsRemaining={goodsRemaining}
          />
        )}

        <div className="play-submit-confirm-slot">
          {lastSubmit && (
            <div className="play-submit-confirm">
              {lastSubmit.delta != null ? `+${lastSubmit.delta} ` : ''}{lastSubmit.label} submitted!
            </div>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
