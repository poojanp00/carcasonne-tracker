/**
 * SCORE CATEGORY BUTTONS (Phone / Party Mode)
 *
 * Shared scoring controls for phone players in party mode.
 * Mirrors the category buttons in Board.jsx but calls onSubmit(category, delta)
 * instead of modifying local state.
 *
 * Props:
 *  expansions  - array of active expansion names
 *  value       - current numeric input value (string)
 *  onChange    - called with new string value when input changes
 *  onSubmit    - called with (category, delta) when a category button is tapped
 */

export default function ScoreCategoryButtons({ expansions = [], value, onChange, onSubmit }) {
  const hasTB    = expansions.includes('Traders & Builders');
  const hasIC    = expansions.some(e => e === 'Inns & Cathedrals' || e === 'Bridges, Castles & Bazaars');
  const hasAM    = expansions.includes('Abbey & Mayor');
  const hasAbbot = expansions.includes('The Abbot');

  const delta = Number(value) || 0;

  const bump = (n) => onChange(String(delta + n));

  return (
    <div className="score-cat-buttons">
      {/* Point input */}
      <div style={{ marginBottom: '0.9rem' }}>
        <div className="score-cat-label">POINTS TO ADD</div>
        <input
          type="number"
          className="form-input board-score-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          style={{ marginBottom: '0.6rem', textAlign: 'right', fontSize: '1.3rem' }}
        />
        <div className="board-btn-row">
          <button type="button" className="btn btn-sm board-btn-equal" onClick={() => bump(1)}>+1</button>
          <button type="button" className="btn btn-sm board-btn-equal" onClick={() => bump(2)}>+2</button>
          <button type="button" className="btn btn-sm board-btn-equal" onClick={() => bump(3)}>+3</button>
          {(hasTB || hasAM) && (
            <button type="button" className="btn btn-sm board-btn-equal" onClick={() => bump(4)}>+4</button>
          )}
        </div>
      </div>

      {/* Base categories */}
      <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
        {['road', 'city', 'monastery'].map(type => (
          <button
            key={type}
            type="button"
            className="btn btn-sm board-btn-equal"
            style={{ justifyContent: 'center' }}
            onClick={() => onSubmit(type, delta)}
            disabled={delta === 0}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Abbot */}
      {hasAbbot && (
        <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => onSubmit('abbot', delta)}
            disabled={delta === 0}
          >
            Abbot
          </button>
        </div>
      )}

      {/* Inns & Cathedrals */}
      {hasIC && (
        <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
          {[['inn', 'Inn'], ['cathedral', 'Cathedral']].map(([type, label]) => (
            <button
              key={type}
              type="button"
              className="btn btn-sm board-btn-equal"
              style={{ justifyContent: 'center' }}
              onClick={() => onSubmit(type, delta)}
              disabled={delta === 0}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Abbey & Mayor */}
      {hasAM && (
        <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
          {(hasTB
            ? [['abbey', 'Abbey'], ['field', 'Field'], ['pig', 'Pig']]
            : [['abbey', 'Abbey'], ['field', 'Field']]
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              className="btn btn-sm board-btn-equal"
              style={{ justifyContent: 'center' }}
              onClick={() => onSubmit(type, delta)}
              disabled={delta === 0}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Field / Pig (no Abbey & Mayor) */}
      {!hasAM && (
        <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
          {hasTB ? (
            [['field', 'Field'], ['pig', 'Pig']].map(([type, label]) => (
              <button
                key={type}
                type="button"
                className="btn btn-sm board-btn-equal"
                style={{ justifyContent: 'center' }}
                onClick={() => onSubmit(type, delta)}
                disabled={delta === 0}
              >
                {label}
              </button>
            ))
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onSubmit('field', delta)}
              disabled={delta === 0}
            >
              Field
            </button>
          )}
        </div>
      )}
    </div>
  );
}
