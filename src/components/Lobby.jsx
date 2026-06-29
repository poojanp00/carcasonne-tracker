/**
 * LOBBY — Party mode popup overlay (runner side)
 *
 * Shown over the board immediately after a party game begins.
 * Players scan the QR or navigate to /play and enter the code.
 * Shows live join status per roster member.
 * "Start Game" opens the projector window and dismisses this overlay.
 */

import { useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import {
  getClaimsForSession,
  subscribeClaims,
  setPhase,
  unsubscribe,
} from '../data/partySession';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};

const FALLBACK = Object.values(MEEPLE_IMGS)[0];

export default function Lobby({ session, onStart, onClaimUpdate }) {
  const { partySessionId, partyCode, players = [] } = session;
  const [claims, setClaims] = useState([]);
  const projectorWinRef = useRef(null);

  const playUrl = `${window.location.origin}/play`;

  // ── Subscribe to claim changes ────────────────────────────────────────────

  useEffect(() => {
    if (!partySessionId) return;

    let active = true;

    async function refresh() {
      const fresh = await getClaimsForSession(partySessionId);
      if (!active) return;
      setClaims(fresh);
      onClaimUpdate?.(fresh);
    }

    refresh();
    const sub = subscribeClaims(partySessionId, refresh);

    return () => {
      active = false;
      unsubscribe(sub);
    };
  }, [partySessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive join state ─────────────────────────────────────────────────────

  const joinedMap = {};
  claims.forEach(c => { joinedMap[c.player_name.toLowerCase()] = c; });

  const allJoined = players.length > 0 && players.every(p => joinedMap[p.toLowerCase()]);

  // ── Start game ────────────────────────────────────────────────────────────

  async function handleStart() {
    await setPhase(partySessionId, 'active');

    // Open projector window
    const url = `${window.location.origin}${window.location.pathname}?projector=true`;
    if (!projectorWinRef.current || projectorWinRef.current.closed) {
      projectorWinRef.current = window.open(url, 'carcasonne-projector', 'width=1400,height=900,menubar=no,toolbar=no,location=no');
    } else {
      projectorWinRef.current.focus();
    }

    onStart();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal">
        {/* Header */}
        <div className="lobby-header">
          <h2 className="lobby-title">Carcasscore Party Mode!</h2>
          <p className="lobby-instruction">
            Display this screen where everyone can see it.
          </p>
          <p className="lobby-instruction" style={{ marginTop: '0.25rem' }}>
            Each player must scan the QR code or navigate to{' '}
            <strong>{playUrl}</strong> and enter the code below.
          </p>
        </div>

        <div className="lobby-body">
          {/* QR + Code */}
          <div className="lobby-code-block">
            <div className="lobby-qr">
              <QRCode
                value={playUrl}
                size={140}
                bgColor="var(--parchment)"
                fgColor="var(--charcoal)"
                style={{ borderRadius: 4 }}
              />
            </div>
            <div className="lobby-code-display">
              <div className="lobby-code-label">GAME CODE</div>
              <div className="lobby-code-value">{partyCode}</div>
              <div className="lobby-code-url">{playUrl}</div>
            </div>
          </div>

          {/* Player roster */}
          <div className="lobby-roster">
            <div className="lobby-roster-title">PLAYERS</div>
            <div className="lobby-roster-list">
              {players.map(name => {
                const claim = joinedMap[name.toLowerCase()];
                return (
                  <div key={name} className={`lobby-roster-row${claim ? ' joined' : ''}`}>
                    <span className="lobby-roster-status">
                      {claim ? '✓' : '⏳'}
                    </span>
                    {claim?.meeple && (
                      <img
                        src={MEEPLE_IMGS[claim.meeple] || FALLBACK}
                        alt={claim.meeple}
                        className="lobby-roster-meeple"
                      />
                    )}
                    <span className="lobby-roster-name">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="lobby-footer">
          <p className="lobby-footer-hint">
            {allJoined
              ? 'All players have joined — ready to start!'
              : `Waiting for ${players.filter(p => !joinedMap[p.toLowerCase()]).length} more player(s)…`}
          </p>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', padding: '0.75rem 1rem' }}
            onClick={handleStart}
            disabled={!allJoined}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
