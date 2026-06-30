import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  getSessionById,
  subscribeSession,
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

export default function Lobby({ session, onStart, onCancel, onClaimUpdate }) {
  const { partySessionId, partyCode, players = [] } = session;
  const [roster, setRoster] = useState([]);

  const playUrl = `${window.location.origin}/play`;

  // ── Load roster + subscribe to roster changes ─────────────────────────────

  useEffect(() => {
    if (!partySessionId) return;

    let active = true;

    async function init() {
      const s = await getSessionById(partySessionId);
      if (!active || !s) return;
      const r = s.roster || [];
      setRoster(r);
      onClaimUpdate?.(r);
    }

    init();

    const sub = subscribeSession(partySessionId, (updated) => {
      if (!active) return;
      const r = updated.roster || [];
      setRoster(r);
      onClaimUpdate?.(r);
    });

    return () => {
      active = false;
      unsubscribe(sub);
    };
  }, [partySessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive join state ─────────────────────────────────────────────────────

  const joinedMap = {};
  roster.forEach(r => { joinedMap[r.name_lower || r.name.toLowerCase()] = r; });

  const allJoined = players.length > 0 && players.every(p => joinedMap[p.toLowerCase()]?.claimed);

  // ── Start game ────────────────────────────────────────────────────────────

  async function handleStart() {
    await setPhase(partySessionId, 'active');
    onStart();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal">
        {/* Header */}
        <div className="lobby-header">
          <h2 className="lobby-title">Carcasscore Party Mode!</h2>
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
                const slot = joinedMap[name.toLowerCase()];
                const joined = slot?.claimed;
                return (
                  <div key={name} className={`lobby-roster-row${joined ? ' joined' : ''}`}>
                    <span className="lobby-roster-status">
                      {joined ? '✓' : '⏳'}
                    </span>
                    {slot?.meeple && (
                      <img
                        src={MEEPLE_IMGS[slot.meeple] || FALLBACK}
                        alt={slot.meeple}
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
              : `Waiting for ${players.filter(p => !joinedMap[p.toLowerCase()]?.claimed).length} more player(s)…`}
          </p>
          <div style={{ display: 'flex', gap: '0.7rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ justifyContent: 'center' }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: '1.05rem', padding: '0.75rem 1rem' }}
              onClick={handleStart}
              disabled={!allJoined}
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
