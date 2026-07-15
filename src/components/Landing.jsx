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
    body: 'Create different groups for friends, family, and leagues, keeping each group\'s history separate.',
    color: 'var(--deep-red)',
  },
];

const pages = [
  {
    icon: <PlayIcon />,
    name: 'Play',
    tab: 'board',
    color: 'var(--earth-brown)',
  },
  {
    icon: <BookIcon />,
    name: 'Logbook',
    tab: 'history',
    color: 'var(--royal-blue)',
  },
  {
    icon: <StatsPageIcon />,
    name: 'Statistics',
    tab: 'statistics',
    color: 'var(--forest-green)',
  },
  {
    icon: <CollectionIcon />,
    name: 'Collection',
    tab: 'collection',
    color: 'var(--deep-red)',
  },
];

function PageTile({ icon, name, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', flex: 1, cursor: 'var(--cursor-pointer)', padding: '0 0.5rem', background: 'none', border: 'none', color }}
    >
      {icon}
      <span style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
      }}>
        {name}
      </span>
    </button>
  );
}

export default function Landing({ onNavigate }) {
  return (
    <div className="landing-page">

      {/* Hero */}
      <section className="landing-hero">
        <h2 className="landing-welcome">Carcasscore is the ultimate Carcassonne companion.</h2>
      </section>

      {/* Page navigator icons */}
      <section style={{ display: 'flex', justifyContent: 'center', gap: '0', margin: '2rem auto 4rem', maxWidth: '760px' }}>
        {pages.map(p => (
          <PageTile
            key={p.name}
            icon={p.icon}
            name={p.name}
            color={p.color}
            onClick={() => onNavigate?.(p.tab)}
          />
        ))}
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
