import { formatAchievementName } from '../utils/achievements';

const RECORD_MODULES = import.meta.glob('../../images/game records/*.png', { eager: true, import: 'default' });
const RECORD_IMGS = Object.fromEntries(
  Object.entries(RECORD_MODULES).map(([path, img]) => [path.split('/').pop().replace('.png', ''), img])
);

const ACHIEVEMENT_DISPLAY_ORDER = [
  'longestRoad',
  'largestCity',
  'largestField',
  'mostMonastery',
  'longestInn',
  'largestCathedral',
  'biggestPig',
  'largestBarn',
  'bestTrader',
];

const ACHIEVEMENT_COLORS = {
  longestRoad:      '#6B4423',
  largestCity:      '#A67C52',
  largestField:     '#6B8E23',
  mostMonastery:    '#5A6C7D',
  longestInn:       '#CD853F',
  largestCathedral: '#7D5A8A',
  biggestPig:       '#B8860B',
  largestBarn:      '#8B4513',
  bestTrader:       '#C9A34A',
};

const ACHIEVEMENT_BADGE = {
  longestRoad:      RECORD_IMGS['largestroad'],
  largestCity:      RECORD_IMGS['largestcity'],
  largestField:     RECORD_IMGS['largestfield'],
  mostMonastery:    RECORD_IMGS['mostmonastery'],
  longestInn:       RECORD_IMGS['longestinn'],
  largestCathedral: RECORD_IMGS['largestcathedral'],
  biggestPig:       RECORD_IMGS['biggestpig'],
  largestBarn:      RECORD_IMGS['largestbarn'],
  bestTrader:       RECORD_IMGS['mastermerchant'],
};

const ACHIEVEMENT_LABEL_OVERRIDE = {
  mostMonastery: 'Most Complete Monasteries',
  bestTrader:    'Master Merchant',
};

const ACHIEVEMENT_AMOUNT_SUFFIX = {
  bestTrader: ' Total Goods',
};

const ACHIEVEMENT_TOOLTIP = {
  bestTrader: 'Awarded to the player who dominated all goods.',
};

export default function GameHighlights({ achievements = {} }) {
  if (!achievements) return null;

  const displayAchievements = ACHIEVEMENT_DISPLAY_ORDER
    .filter(key => achievements[key])
    .map(key => ({ key, ...achievements[key] }));

  if (displayAchievements.length === 0) return null;

  return (
    <div>
      <div style={{
        fontSize: '0.7rem',
        fontFamily: 'Cinzel, serif',
        letterSpacing: '0.1em',
        color: 'var(--stone-gray)',
        marginBottom: '1rem',
      }}>
        GAME RECORDS
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
      }}>
        {displayAchievements.map(({ key, amount, player }, i) => {
          const color    = ACHIEVEMENT_COLORS[key];
          const badgeImg = ACHIEVEMENT_BADGE[key];

          return (
            <div
              key={key}
              className="hl-card"
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '0.35rem',
                animationDelay: `${i * 55}ms`,
              }}
            >
              {/* Player name */}
              <span style={{
                fontFamily:    'Cinzel, serif',
                fontSize:      '0.7rem',
                fontWeight:    700,
                letterSpacing: '0.05em',
                color:         'var(--charcoal)',
                textTransform: 'uppercase',
                textAlign:     'center',
              }}>
                {player}
              </span>

              {/* Badge image */}
              {badgeImg && (
                <img src={badgeImg} alt={key} style={{ height: 90, width: 'auto', flexShrink: 0 }} />
              )}

              {/* Achievement label */}
              <div style={{
                fontFamily:    'Cinzel, serif',
                fontSize:      '0.57rem',
                fontWeight:    700,
                letterSpacing: '0.05em',
                color:         'var(--stone-gray)',
                textAlign:     'center',
                lineHeight:    1.2,
                display:       'flex',
                alignItems:    'center',
                gap:           '0.25rem',
              }}>
                {(ACHIEVEMENT_LABEL_OVERRIDE[key] || formatAchievementName(key)).toUpperCase()}
                {ACHIEVEMENT_TOOLTIP[key] && (
                  <span className="stat-info-wrap">
                    <span className="stat-info-icon">ⓘ</span>
                    <span className="stat-info-tooltip">{ACHIEVEMENT_TOOLTIP[key]}</span>
                  </span>
                )}
              </div>

              {/* Amount */}
              <span style={{
                fontFamily: 'Cinzel, serif',
                fontSize:   '0.82rem',
                fontWeight: 700,
                color,
                textAlign:  'center',
              }}>
                {amount}{ACHIEVEMENT_AMOUNT_SUFFIX[key] ? (
                  <span style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.75 }}>
                    {' '}{ACHIEVEMENT_AMOUNT_SUFFIX[key].trim().toUpperCase()}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
