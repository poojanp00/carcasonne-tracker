import { useState, useCallback } from 'react';
import GameLogForm  from './components/GameLogForm';
import GameHistory  from './components/GameHistory';
import Stats        from './components/Stats';
import Collection   from './components/Collection';
import Board        from './components/Board';
import { useGameData } from './hooks/useGameData';

const TABS = [
  { id: 'board',      label: 'Game Board'  },
  { id: 'log',        label: 'Record Game' },
  { id: 'history',    label: 'Logbook'     },
  { id: 'standings',  label: 'Standings'   },
  { id: 'collection', label: 'Collection'  },
];

// SVG parchment noise overlay
function NoiseOverlay() {
  return (
    <svg
      className="noise-overlay"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <filter id="parchmentNoise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.72"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#parchmentNoise)" />
    </svg>
  );
}

function Toast({ message }) {
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
}

export default function App() {
  const [tab,   setTab]   = useState('board');
  const [toast, setToast] = useState(null);

  const { games, expansions, addGame, deleteGame, toggleExpansion } = useGameData();

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3100);
  }, []);

  const handleAddGame = useCallback((data) => {
    addGame(data);
    showToast('Game recorded in the logbook.');
  }, [addGame, showToast]);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Remove this game from the logbook? This cannot be undone.')) return;
    deleteGame(id);
    showToast('Game removed.');
  }, [deleteGame, showToast]);

  const ownedExpansions = expansions.filter((e) => e.owned).map((e) => e.name);

  return (
    <div className="app-shell">
      <NoiseOverlay />

      {/* ── Header ── */}
      <header className="site-header">
        <div className="app-wrapper">
          <div className="header-ornament">
            <div className="ornament-line" />
            <span style={{ color: 'var(--warm-gold)', fontSize: '1.1rem' }}>⚜</span>
            <div className="ornament-line" />
          </div>
          <h1>Carcassonne</h1>
          <div className="header-ornament" style={{ marginTop: '0.45rem' }}>
            <div className="ornament-line" />
            <span style={{ color: 'var(--warm-gold)', fontSize: '0.75rem', letterSpacing: '0.3em' }}>
              ✦ ✦ ✦
            </span>
            <div className="ornament-line" />
          </div>
        </div>
      </header>

      {/* ── Navigation ── */}
      <div className="app-wrapper">
        <nav className="tab-nav" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
              role="tab"
              aria-selected={tab === id}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className="section-panel">
          {tab === 'log' && (
            <GameLogForm
              ownedExpansions={ownedExpansions}
              onSubmit={handleAddGame}
            />
          )}
          {tab === 'history' && (
            <GameHistory
              games={games}
              onDelete={handleDelete}
            />
          )}
          {tab === 'standings' && (
            <Stats games={games} />
          )}
          {tab === 'collection' && (
            <Collection
              expansions={expansions}
              onToggle={toggleExpansion}
            />
          )}
          {tab === 'board' && (
            <Board />
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast} />}
    </div>
  );
}
