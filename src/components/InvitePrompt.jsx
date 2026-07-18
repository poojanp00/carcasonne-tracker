import { useState } from 'react';

/**
 * GROUP INVITATION PROMPT
 *
 * Shown to a signed-in user who has a pending realm invite. Lists the group's
 * name, its players (highlighting the one this account will be linked to),
 * and who sent the invite. The user must explicitly Accept or Decline —
 * clicking the overlay does not dismiss it.
 */
export default function InvitePrompt({ invite, onAccept, onDecline }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const respond = async (accept) => {
    setBusy(true);
    setError('');
    try {
      await (accept ? onAccept(invite.realmId) : onDecline(invite.realmId));
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="realm-modal-overlay">
      <div className="realm-modal tile-card" style={{ maxWidth: '440px' }}>
        <h3 style={{ color: 'var(--earth-brown)', marginBottom: '0.4rem' }}>Realm Invitation</h3>
        <p style={{ fontFamily: 'Crimson Text, serif', fontSize: '0.95rem', color: 'var(--charcoal)', margin: '0 0 1rem' }}>
          {invite.inviterName
            ? <>
                <strong>{invite.inviterName}</strong>
                {invite.inviterEmail && <span style={{ color: 'var(--stone-gray)' }}> ({invite.inviterEmail})</span>}
                {' '}has invited you to join <strong>{invite.realmName}</strong>.
              </>
            : invite.inviterEmail
              ? <><strong>{invite.inviterEmail}</strong> has invited you to join <strong>{invite.realmName}</strong>.</>
              : <>You have been invited to join <strong>{invite.realmName}</strong>.</>}
        </p>

        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(0.62rem, 1.8vw, 0.78rem)', fontWeight: 600, color: 'var(--stone-gray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
          Players
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
          {(invite.players || []).map((p, i) => {
            const isYou = p.name === invite.playerName;
            return (
              <div key={p.name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.45rem 0',
                borderBottom: i < invite.players.length - 1 ? '1px solid var(--border-light)' : 'none',
              }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--stone-gray)', opacity: 0.5, minWidth: '1rem', textAlign: 'right' }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', fontWeight: 600, color: 'var(--earth-brown)', letterSpacing: '0.02em' }}>
                  {p.name}
                </span>
                {isYou && (
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--parchment)', background: 'var(--earth-brown)', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>
                    YOU
                  </span>
                )}
              </div>
            );
          })}
        </div>


        {error && (
          <p style={{ color: 'var(--deep-red, #DC2626)', fontStyle: 'italic', fontSize: '0.88rem', margin: '0 0 0.6rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => respond(false)}>
            Decline
          </button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => respond(true)}>
            {busy ? 'Please wait...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
