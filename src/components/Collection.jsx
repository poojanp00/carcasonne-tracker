import { useState } from 'react';

export default function Collection({ expansions, onToggle }) {
  const [open, setOpen] = useState(true);

  const owned   = expansions.filter((e) => e.owned);
  const unowned = expansions.filter((e) => !e.owned);

  return (
    <div>
      <div className="section-title">
        <h2>My Collection</h2>
        <div className="section-title-line" />
        <span className="game-count">{owned.length} / {expansions.length}</span>
      </div>

      <p className="section-intro">
        Click an expansion to toggle ownership. Owned expansions appear as options when logging a game.
      </p>

      <div className="tile-card">
        <div
          className="collapsible-toggle tile-card-header"
          onClick={() => setOpen((o) => !o)}
          style={{ borderBottom: open ? '1px solid var(--warm-gold)' : 'none', paddingBottom: open ? '0.5rem' : 0, cursor: 'pointer' }}
        >
          <span>Expansion Inventory</span>
          <span className={`collapsible-arrow ${open ? 'open' : ''}`}>▶</span>
        </div>

        {open && (
          <div style={{ marginTop: '1rem' }}>
            {owned.length > 0 && (
              <>
                <div className="collection-group-label owned-label">In Your Possession</div>
                <div className="collection-grid" style={{ marginBottom: '1.5rem' }}>
                  {owned.map((exp) => (
                    <div
                      key={exp.name}
                      className="expansion-item owned"
                      onClick={() => onToggle(exp.name)}
                      title="Click to mark as not owned"
                    >
                      <div className="status-dot" />
                      <span>{exp.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {unowned.length > 0 && (
              <>
                <div className="collection-group-label unowned-label">Not Yet Acquired</div>
                <div className="collection-grid">
                  {unowned.map((exp) => (
                    <div
                      key={exp.name}
                      className="expansion-item unowned"
                      onClick={() => onToggle(exp.name)}
                      title="Click to mark as owned"
                    >
                      <div className="status-dot" />
                      <span>{exp.name}</span>
                      <span className="unowned-tag">not yet acquired</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
