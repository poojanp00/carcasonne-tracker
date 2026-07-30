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
    body: 'Win rates, scoring records, streaks, and more. Finally settle who\'s actually the best player.',
    color: 'var(--forest-green)',
  },
  {
    icon: <HistoryIcon />,
    title: 'A History of Every Battle',
    body: 'Save each game automatically. Rivalries never disappear.',
    color: 'var(--royal-blue)',
  },
  {
    icon: <ShieldIcon />,
    title: 'Built for Game Night',
    body: 'Create different realms for friends, family, and leagues, keeping each realm\'s history separate.',
    color: 'var(--deep-red)',
  },
];

export default function Landing() {
  return (
    <div className="landing-page">

      {/* Hero */}
      <section className="landing-hero">
        <h2 className="landing-welcome">The ultimate board game companion.</h2>
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

      {/* Disclaimer */}
      <p className="landing-disclaimer">
        Unofficial fan-made app. Not affiliated with Hans im Glück or Asmodee. Carcassonne is a registered trademark of its respective owners.
      </p>

    </div>
  );
}
