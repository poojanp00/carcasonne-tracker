/**
 * SCORE CATEGORY BUTTONS (Phone / Party Mode)
 *
 * Shared scoring controls for phone players in party mode.
 * Mirrors the category buttons in Board.jsx but calls onSubmit(category, delta)
 * instead of modifying local state.
 *
 * Props:
 *  expansions     - array of active expansion names
 *  value          - current numeric input value (string)
 *  onChange       - called with new string value when input changes
 *  onSubmit       - called with (category, delta) when a category button is tapped
 *  goodsRemaining - { wine, grain, cloth } remaining supply counts (optional)
 */

const GOODS_MODULES = import.meta.glob('../../images/goods_tokens/*.png', { eager: true, import: 'default' });
const GOODS_IMGS = Object.fromEntries(
  Object.entries(GOODS_MODULES).map(([p, img]) => [p.split('/').pop().replace('.png', ''), img])
);

export default function ScoreCategoryButtons({ expansions = [], value, onChange, onSubmit, goodsRemaining }) {
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

      {/* Abbey & Mayor — Abbey/Field always available; Pig also available when T&B active */}
      {hasAM && (
        <div className="board-btn-row" style={{ marginBottom: '0.5rem' }}>
          {[
            ['abbey', 'Abbey'],
            ['field', 'Field'],
            ...(hasTB ? [['pig', 'Pig']] : []),
          ].map(([type, label]) => (
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

      {/* Goods Tokens (Traders & Builders) */}
      {hasTB && (
        <div style={{ marginTop: '0.8rem' }}>
          <div className="score-cat-label" style={{ marginBottom: '0.4rem' }}>GOODS TOKENS</div>
          <div className="board-btn-row" style={{ justifyContent: 'center' }}>
            {['wine', 'grain', 'cloth'].map(good => {
              const remaining = goodsRemaining ? goodsRemaining[good] : undefined;
              const exhausted = remaining !== undefined && remaining <= 0;
              return (
                <button
                  key={good}
                  type="button"
                  className="goods-token-btn"
                  onClick={() => onSubmit(`goods_${good}`, 0)}
                  disabled={exhausted}
                  title={remaining !== undefined ? `${remaining} remaining` : good}
                >
                  {GOODS_IMGS[good]
                    ? <img src={GOODS_IMGS[good]} alt={good} className="goods-token-btn-img" />
                    : good.charAt(0).toUpperCase() + good.slice(1)
                  }
                  {remaining !== undefined && (
                    <span className="goods-token-btn-count">{remaining}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
