
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

const howToSteps = [
  {
    title: 'Gather players',
    body: 'Create a group and add everyone at the table.',
  },
  {
    title: 'Set up the game',
    body: 'Select meeples, expansions, and game modes.',
  },
  {
    title: 'Play the game',
    body: 'Track scoring events live as cities, roads, monasteries, and other features are completed.',
  },
  {
    title: 'Final Scoring',
    body: 'Complete end-game scoring once the final tile is placed.',
  },
  {
    title: 'Crown a winner',
    body: 'View the final standings, score breakdowns, and game statistics.',
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
    body: 'Create groups for friends, family, and competitive leagues. Keep each table\'s history separate and organized.',
    color: 'var(--deep-red)',
  },
];

export default function Landing() {
  return (
    <div className="landing-page">

      {/* Hero */}
      <section className="landing-hero">
        <h2 className="landing-welcome">Welcome to Carcasscore</h2>
        <p className="landing-tagline">The Ultimate Carcassonne Tracker</p>
      </section>

      {/* Divider */}
      <div className="landing-divider" />

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
