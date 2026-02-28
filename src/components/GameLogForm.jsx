import { useState } from 'react';
import baseImage from '../../images/baseimage.png';
import crownImg  from '../../images/crown/shasta.png';

// Dynamically load all meeple PNGs
const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png', { eager: true, import: 'default' });
const MEEPLE_IMGS = Object.fromEntries(
  Object.entries(MEEPLE_MODULES).map(([path, img]) => [path.split('/').pop(), img])
);
const FALLBACK_MEEPLE = Object.values(MEEPLE_IMGS)[0];

const PLAYER_COLORS = [
  'var(--deep-red)',
  'var(--royal-blue)',
  'var(--forest-green)',
  'var(--mustard)',
  '#7B2D8B',
  '#1A8080',
];

const today = () => new Date().toISOString().split('T')[0];

export default function GameLogForm({ session, ownedExpansions, onSubmit, onCancel }) {
  const { players = [], meeples = {}, expansions: prefillExp = [], finalScores = {} } = session || {};

  const [date,         setDate]         = useState(today);
  const [photo,        setPhoto]        = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [farmWin,      setFarmWin]      = useState(false);

  const scoreNums = players.map(p => Number(finalScores[p]) || 0);
  const maxScore  = scoreNums.length > 0 ? Math.max(...scoreNums) : 0;
  const winners   = maxScore > 0 ? players.filter(p => (Number(finalScores[p]) || 0) === maxScore) : [];

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target.result); setPhotoPreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

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
      photo:      photo || baseImage,
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
      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        {/* Date + farm win in the header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            id="game-date"
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={farmWin}
              onChange={e => setFarmWin(e.target.checked)}
              style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--gold-accent)', cursor: 'pointer' }}
            />
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Won via Farm</span>
          </label>
        </div>

        <div
          className="postgame-scores-grid"
          style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}
        >
          {players.map((name, pi) => {
            const color    = PLAYER_COLORS[pi] || PLAYER_COLORS[0];
            const isWinner = winners.includes(name);
            return (
              <div key={name} className="postgame-player-card" style={{ borderTop: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
                  <img src={MEEPLE_IMGS[meeples[name]] || FALLBACK_MEEPLE} alt={name} style={{ height: 26, width: 'auto' }} />
                  <span style={{ fontFamily: 'Cinzel, serif', color, fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    {name}
                  </span>
                  {isWinner && (
                    <img src={crownImg} alt="winner" className="postgame-crown" />
                  )}
                </div>
                <div className="postgame-score-display">
                  {finalScores[name] ?? 0}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo */}
      <div className="tile-card" style={{ marginBottom: '1.6rem' }}>
        <div className="tile-card-header">Momento</div>
        <div className="photo-upload-area">
          <label className="btn" htmlFor="photo-file" style={{ cursor: 'pointer' }}>
            Attach Photo
          </label>
          <input id="photo-file" type="file" accept="image/*" onChange={handlePhoto} />
          {photoPreview && (
            <>
              <img src={photoPreview} alt="Preview" className="photo-preview" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>
                Remove
              </button>
            </>
          )}
          {!photoPreview && (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>Optional</span>
          )}
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn">Record in Logbook</button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        )}
        <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
          {prefillExp.length === 0 ? 'Base game' : prefillExp.join(' · ')}
        </span>
      </div>
    </form>
  );
}
