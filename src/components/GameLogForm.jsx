import { useState } from 'react';
import baseImage from '../../images/baseimage.png';

const today = () => new Date().toISOString().split('T')[0];

export default function GameLogForm({ ownedExpansions, onSubmit }) {
  const player1 = 'Poojan';
  const player2 = 'Diya';
  const [score1,    setScore1]    = useState('');
  const [score2,    setScore2]    = useState('');
  const [date,      setDate]      = useState(today);
  const [selected,  setSelected]  = useState([]);
  const [photo,     setPhoto]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const toggleExpansion = (name) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto(ev.target.result);
      setPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (score1 === '' || score2 === '') return;

    onSubmit({
      date,
      player1: { name: player1, score: parseInt(score1, 10) },
      player2: { name: player2, score: parseInt(score2, 10) },
      expansions: [...selected].sort(),
      photo: photo || baseImage,
    });

    setScore1('');
    setScore2('');
    setSelected([]);
    setPhoto(null);
    setPhotoPreview(null);
    setDate(today());
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">
        <h2>Record a Battle</h2>
        <div className="section-title-line" />
      </div>

      {/* Players & Scores */}
      <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
        <div className="log-form-grid">
          {/* Player 1 */}
          <div>
            <div className="form-group">
              <div className="form-label">Player I</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.25rem', color: 'var(--deep-red)', padding: '0.3rem 0 0.5rem' }}>{player1}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="p1score">Final Score</label>
              <input
                id="p1score"
                className="form-input"
                type="number"
                min="0"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* VS divider */}
          <div className="vs-divider">
            <div className="vs-divider-line" />
            <span className="vs-text">vs</span>
            <div className="vs-divider-line" />
          </div>

          {/* Player 2 */}
          <div>
            <div className="form-group">
              <div className="form-label">Player II</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.25rem', color: 'var(--royal-blue)', padding: '0.3rem 0 0.5rem' }}>{player2}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="p2score">Final Score</label>
              <input
                id="p2score"
                className="form-input"
                type="number"
                min="0"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="form-group" style={{ marginTop: '0.6rem', maxWidth: '240px' }}>
          <label className="form-label" htmlFor="game-date">Date</label>
          <input
            id="game-date"
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Expansions */}
      {ownedExpansions.length > 0 && (
        <div className="tile-card" style={{ marginBottom: '1.4rem' }}>
          <div className="tile-card-header">Expansions in Play</div>
          <p className="section-intro">Select all expansions used in this game. None selected = base game.</p>
          <div className="expansion-chips">
            {ownedExpansions.map((name) => (
              <button
                key={name}
                type="button"
                className={`expansion-chip ${selected.includes(name) ? 'selected' : ''}`}
                onClick={() => toggleExpansion(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photo */}
      <div className="tile-card" style={{ marginBottom: '1.6rem' }}>
        <div className="tile-card-header">Momento</div>
        <div className="photo-upload-area">
          <label className="btn" htmlFor="photo-file" style={{ cursor: 'pointer' }}>
            📷 Attach Photo
          </label>
          <input id="photo-file" type="file" accept="image/*" onChange={handlePhoto} />

          {photoPreview && (
            <>
              <img src={photoPreview} alt="Preview" className="photo-preview" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearPhoto}>
                Remove
              </button>
            </>
          )}
          {!photoPreview && (
            <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
              Optional — capture the board at game's end
            </span>
          )}
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn">
          Inscribe in Chronicle
        </button>
        <span style={{ fontStyle: 'italic', color: 'var(--stone-gray)', fontSize: '0.92rem' }}>
          {selected.length === 0
            ? 'Base game'
            : selected.join(' · ')}
        </span>
      </div>
    </form>
  );
}
