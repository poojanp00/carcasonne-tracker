import { useState } from 'react';

const MeepleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="3" />
    <path d="M6 21v-2a4 4 0 0 1 2-3.46V13a4 4 0 0 1 8 0v2.54A4 4 0 0 1 18 19v2H6z" />
  </svg>
);

const ChartIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6"  y1="20" x2="6"  y2="14" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14" />
    <path d="M3.05 11a9 9 0 1 1 .5 4M3 16v-5h5" />
  </svg>
);

const BookIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="13" y2="11" />
  </svg>
);

const StatsPageIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="8" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6"  y1="20" x2="6"  y2="13" />
    <line x1="2"  y1="20" x2="22" y2="20" />
  </svg>
);

const PlayIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8"  y1="12" x2="16" y2="12" />
  </svg>
);

const CollectionIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3"  y="3"  width="7" height="7" rx="1" />
    <rect x="14" y="3"  width="7" height="7" rx="1" />
    <rect x="3"  y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const howToSteps = [
  {
    title: 'Gather players',
    body: 'Create a group and add each player under the Carcasscore Play tab.',
  },
  {
    title: 'Set up the game',
    body: 'While you set up an actual game, select your meeples and expansions on Carcasscore.',
  },
  {
    title: 'Play the game',
    body: 'Track all scoring events live on Carcasscore as features are completed.',
  },
  {
    title: 'Final Scoring',
    body: 'Complete end-game scoring on Carcasscore once the final tile is placed.',
  },
  {
    title: 'Crown a winner',
    body: 'View the final standings, score breakdowns, and game statistics on Carcasscore.',
  },
  {
    title: 'Build your legacy',
    body: 'Sign in to save games to your logbook. Access your complete game history, group leaderboards, player stats, and long-term analytics.',
  },
];

const features = [
  {
    icon: <MeepleIcon />,
    title: 'No More "Wait, What Was My Score?"',
    body: 'One bumped table shouldn\'t erase an hour of strategy. Keep every point recorded from start to finish.',
    color: 'var(--earth-brown)',
  },
  {
    icon: <ChartIcon />,
    title: 'Stats Worth Bragging About',
    body: 'Win rates, scoring trends, biggest blowouts, and more. Finally settle who\'s actually the best player.',
    color: 'var(--forest-green)',
  },
  {
    icon: <HistoryIcon />,
    title: 'A History of Every Battle',
    body: 'Every game is saved automatically, so rivalries, streaks, and comebacks never disappear.',
    color: 'var(--royal-blue)',
  },
  {
    icon: <ShieldIcon />,
    title: 'Built for Game Night',
    body: 'Create groups for friends, family, and competitive leagues. Keep each group\'s history separate and organized.',
    color: 'var(--deep-red)',
  },
];

const pages = [
  {
    icon: <StatsPageIcon />,
    name: 'Statistics',
    description: 'Analyze win rates, streaks, scoring trends, point breakdowns.',
    color: 'var(--forest-green)',
  },
  {
    icon: <BookIcon />,
    name: 'Logbook',
    description: 'Browse recorded games.',
    color: 'var(--royal-blue)',
  },
  {
    icon: <PlayIcon />,
    name: 'Play',
    description: 'Set up a live game and use Carcasscore as the scoreboard.',
    color: 'var(--earth-brown)',
  },
  {
    icon: <CollectionIcon />,
    name: 'Collection',
    description: 'Mark the expansions you own to unlock their scoring types.',
    color: 'var(--deep-red)',
  },
];

function PageTile({ icon, name, description, color, hovered, onHover, onLeave }) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', flex: 1, cursor: 'default', padding: '0 0.5rem' }}
    >
      <div style={{ color: hovered ? 'var(--stone-gray)' : color, opacity: hovered ? 0.2 : 1, transition: 'color 0.2s ease, opacity 0.2s ease' }}>
        {icon}
      </div>
      <span style={{
        fontFamily: 'Cinzel, serif',
        fontSize: '0.7rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: hovered ? 'var(--stone-gray)' : color,
        opacity: hovered ? 0.2 : 1,
        transition: 'color 0.2s ease, opacity 0.2s ease',
      }}>
        {name}
      </span>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: 'none',
      }}>
        <p style={{
          fontFamily: "'Crimson Text', Georgia, serif",
          fontSize: '1.1rem',
          lineHeight: 1.65,
          textAlign: 'center',
          color: 'var(--charcoal)',
          margin: 0,
        }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [hoveredPage, setHoveredPage] = useState(null);

  return (
    <div className="landing-page">

      {/* Hero */}
      <section className="landing-hero">
        <h2 className="landing-welcome">Carcasscore is the ultimate Carcassonne companion.</h2>
      </section>

      {/* Divider */}
      <div className="landing-divider" />

      {/* Page navigator icons */}
      <section style={{ display: 'flex', justifyContent: 'center', gap: '0', margin: '2rem auto 4rem', maxWidth: '760px' }}>
        {pages.map((p, i) => (
          <PageTile
            key={p.name}
            {...p}
            hovered={hoveredPage === i}
            onHover={() => setHoveredPage(i)}
            onLeave={() => setHoveredPage(null)}
          />
        ))}
      </section>

      {/* Features */}
      <section className="landing-features">
        {features.map(f => (
          <div key={f.title} className="landing-feature-card">
            <div className="landing-feature-icon" style={{ color: f.color }}>
              {f.icon}
            </div>
            <h3 className="landing-feature-title">{f.title}</h3>
            <p className="landing-feature-body">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How To */}
      <section className="landing-howto">
        <h3 className="landing-howto-heading">How It Works</h3>
        <ol className="landing-howto-steps">
          {howToSteps.map((s, i) => (
            <li key={s.title} className="landing-howto-step">
              <span className="landing-howto-number">{i + 1}</span>
              <div className="landing-howto-content">
                <h4 className="landing-howto-title">{s.title}</h4>
                <p className="landing-howto-body">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Disclaimer */}
      <p className="landing-disclaimer">
        Unofficial fan-made app. Not affiliated with Hans im Glück or Asmodee. Carcassonne is a registered trademark of its respective owners.
      </p>

    </div>
  );
}
