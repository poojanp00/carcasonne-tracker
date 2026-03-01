import { useState } from 'react';
import crownImg from '../../images/icons/crown.png';
import pigImg   from '../../images/icons/pig.png';

// Dynamically load all meeple PNGs (root + fun/)
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([path, img]) => [`fun/${path.split('/').pop()}`, img])),
};
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const MEEPLE_COLOR_MAP = {
  blue:   '#2563EB',
  red:    '#DC2626',
  yellow: '#B8860B',
  green:  '#16A34A',
  black:  '#111827',
  pink:   '#EC4899',
};
const FALLBACK_COLOR = '#8B5E3C';

function getMeepleColor(filename) {
  if (!filename) return FALLBACK_COLOR;
  const match = filename.match(/blue|red|yellow|green|black|pink/i);
  return match ? (MEEPLE_COLOR_MAP[match[0].toLowerCase()] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

const today = () => new Date().toISOString().split('T')[0];

export default function GameLogForm({ session, ownedExpansions, onSubmit, onCancel }) {
  const { players = [], meeples = {}, expansions: prefillExp = [], finalScores = {} } = session || {};

  const [date,   setDate]   = useState(today);
  const [farmWin, setFarmWin] = useState(false);

  const scoreNums    = players.map(p => Number(finalScores[p]) || 0);
  const maxScore     = scoreNums.length > 0 ? Math.max(...scoreNums) : 0;
  const winners      = maxScore > 0 ? players.filter(p => (Number(finalScores[p]) || 0) === maxScore) : [];
  const sortedPlayers = [...players].sort((a, b) => (Number(finalScores[b]) || 0) - (Number(finalScores[a]) || 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      date,
      players: players.map(name => ({
        name,
        score:  parseInt(finalScores[name], 10) || 0,
        meeple: meeples[name] || Object.keys(MEEPLE_IMGS)[0],
      })),
      expansions: [...prefillExp].sort(),
      farmWin,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">
        <h2>Final Scores</h2>
        <div className="section-title-line" />
      </div>

      {/* Player scores */}
      <div className="tile-card" style={{ marginBottom: '1.4rem', maxWidth: '360px', margin: '0 auto 1.4rem' }}>
        {/* Date row */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            id="game-date"
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
        </div>

        <div className="postgame-scores-grid">
          {sortedPlayers.map((name) => {
            const color    = getMeepleColor(meeples[name]);
            const isWinner = winners.includes(name);
            return (
              <div key={name} className="postgame-player-card" style={{ borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto' }} />
                  <span style={{ fontFamily: 'Cinzel, serif', color, fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    {name}
                  </span>
                  {isWinner && (
                    <img src={crownImg} alt="winner" className="postgame-crown" />
                  )}
                  {isWinner && farmWin && (
                    <img src={pigImg} alt="farm win" className="postgame-pig" />
                  )}
                  <div className="postgame-score-display">
                    {finalScores[name] ?? 0}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Farm win — below all scores */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
          <input
            type="checkbox"
            checked={farmWin}
            onChange={e => setFarmWin(e.target.checked)}
            style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--gold-accent)', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Won via Farm</span>
        </label>
      </div>

      {/* Expansions */}
      <div style={{ maxWidth: '360px', margin: '0 auto 1.6rem', background: 'var(--aged-paper)', border: 'var(--border-tile)', borderRadius: 'var(--radius-tile)', padding: '0.6rem 1rem', textAlign: 'center' }}>
        <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
          {prefillExp.length === 0 ? 'Base game' : prefillExp.join(' · ')}
        </span>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>← Back</button>
        )}
        <button type="submit" className="btn">Record in Logbook</button>
      </div>
    </form>
  );
}
