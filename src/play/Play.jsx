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

import { useState, useEffect } from 'react';
import {
  getSessionByCode,
  getClaimsForSession,
  claimName,
  submitEvent,
  subscribeSession,
  subscribeClaims,
  getDeviceId,
  unsubscribe,
} from '../data/partySession';
import ScoreCategoryButtons from '../components/ScoreCategoryButtons';

// ── Meeple image loading ──────────────────────────────────────────────────────

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};

const ALL_MEEPLES = [
  ...Object.entries(MEEPLE_MODULES)
    .map(([p, img]) => ({ key: p.split('/').pop(), img }))
    .filter(m => m.key !== 'mystery.png')
    .sort((a, b) => a.key.localeCompare(b.key)),
  ...Object.entries(FUN_MODULES)
    .map(([p, img]) => ({ key: `fun/${p.split('/').pop()}`, img })),
];

const FALLBACK = Object.values(MEEPLE_IMGS)[0];

// ── Play component ────────────────────────────────────────────────────────────

export default function Play() {
  const [phase, setPhase] = useState('entry'); // 'entry' | 'meeple' | 'joined' | 'ended'
  const [sessionData, setSessionData] = useState(null);
  const [claims, setClaims] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [selectedMeeple, setSelectedMeeple] = useState(null);
  const [scoreInput, setScoreInput] = useState('0');
  const [myScore, setMyScore] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSubmit, setLastSubmit] = useState(null); // { category, delta }

  // ── Subscribe to session phase & claim changes after joining ──────────────

  useEffect(() => {
    if (!sessionData?.id) return;

    const sessionSub = subscribeSession(sessionData.id, (updated) => {
      setSessionData(updated);
      if (updated.phase === 'ended') setPhase('ended');
    });

    const claimSub = subscribeClaims(sessionData.id, async () => {
      const fresh = await getClaimsForSession(sessionData.id);
      setClaims(fresh);
    });

    return () => {
      unsubscribe(sessionSub);
      unsubscribe(claimSub);
    };
  }, [sessionData?.id]);

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

    const roster = (session.roster || []).map(r => r.name.toLowerCase());
    if (!roster.includes(name.toLowerCase())) {
      setError(`"${name}" is not in this game's player list. Check your spelling.`);
      setLoading(false);
      return;
    }

    // Load current claims to know which meeples are taken
    const currentClaims = await getClaimsForSession(session.id);
    setSessionData(session);
    setClaims(currentClaims);
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
    const result = await claimName(sessionData.id, playerName, deviceId, selectedMeeple);

    if (!result.ok) {
      if (result.reason === 'taken') {
        setError(`"${playerName}" has already been claimed by another device.`);
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
    if (!delta || delta === 0) return;
    try {
      await submitEvent({ sessionId: sessionData.id, playerName, category, delta });
      setLastSubmit({ category, delta });
      setScoreInput('0');
      // Clear last submit indicator after 2s
      setTimeout(() => setLastSubmit(null), 2000);
    } catch {
      setError('Failed to submit score. Check your connection.');
    }
  }

  const takenMeeples = new Set(
    claims
      .filter(c => c.player_name.toLowerCase() !== playerName.toLowerCase())
      .map(c => c.meeple)
      .filter(Boolean)
  );

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (phase === 'ended') {
    return (
      <div className="play-shell">
        <div className="play-card">
          <div className="play-title">Game Over</div>
          <p className="play-subtitle">This game has ended. Thanks for playing!</p>
        </div>
      </div>
    );
  }

  // Final scoring lock
  if (phase === 'joined' && sessionData?.phase === 'final_scoring') {
    return (
      <div className="play-shell">
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
        <div className="play-card">
          <h1 className="play-title">Carcasscore</h1>
          <p className="play-subtitle">Join a party game</p>

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
              <label className="form-label">Your Name</label>
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
        <div className="play-card" style={{ maxWidth: 480 }}>
          <h2 className="play-title" style={{ fontSize: '1.2rem' }}>Choose Your Meeple</h2>
          <p className="play-subtitle" style={{ marginBottom: '1.2rem' }}>
            Hi <strong>{playerName}</strong>! Pick your meeple for this game.
          </p>

          <div className="play-meeple-grid">
            {ALL_MEEPLES.map(({ key, img }) => {
              const taken = takenMeeples.has(key);
              const chosen = selectedMeeple === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`play-meeple-option${chosen ? ' selected' : ''}${taken ? ' taken' : ''}`}
                  onClick={() => { if (!taken) { setSelectedMeeple(key); setError(null); } }}
                  disabled={taken}
                  title={taken ? 'Already chosen by another player' : key.replace('.png', '').replace('fun/', '')}
                >
                  <img src={img} alt={key} />
                </button>
              );
            })}
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

  // ── Score controller ──
  return (
    <div className="play-shell">
      {/* Player header */}
      <div className="play-player-header">
        <img
          src={MEEPLE_IMGS[selectedMeeple] || FALLBACK}
          alt="Your meeple"
          className="play-player-meeple"
        />
        <span className="play-player-name">{playerName}</span>
      </div>

      {/* Score input area */}
      <div className="play-card play-controller-card">
        <div className="score-cat-label" style={{ marginBottom: '0.5rem' }}>
          {sessionData?.phase === 'active' ? 'ADD POINTS' : "You're all set!"}
        </div>

        {lastSubmit && (
          <div className="play-submit-confirm">
            +{lastSubmit.delta} {lastSubmit.category} submitted!
          </div>
        )}

        {sessionData?.phase === 'lobby' ? (
          <p style={{ fontFamily: 'Crimson Text, serif', fontStyle: 'italic', color: 'var(--stone-gray)', textAlign: 'center', marginTop: '1rem' }}>
            Waiting for the host to start the game…
          </p>
        ) : (
          <ScoreCategoryButtons
            expansions={sessionData?.expansions || []}
            value={scoreInput}
            onChange={setScoreInput}
            onSubmit={handleScoreSubmit}
          />
        )}

        {error && (
          <p style={{ color: 'var(--deep-red)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.8rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
