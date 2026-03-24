import { formatAchievementName } from '../utils/achievements';

const ACHIEVEMENT_DISPLAY_ORDER = [
  'longestRoad',
  'largestCity',
  'largestField',
  'longestInn',
  'largestCathedral',
  'biggestPig',
  'largestBarn',
];

const ACHIEVEMENT_COLORS = {
  longestRoad: '#6B4423',       // Saddle brown (road color)
  largestCity: '#A67C52',       // Medium tan (city color)
  largestField: '#6B8E23',      // Olive green (field color)
  longestInn: '#CD853F',        // Peru (inn color)
  largestCathedral: '#5A6C7D',  // Steel blue (cathedral color)
  biggestPig: '#B8860B',        // Dark goldenrod (pig color)
  largestBarn: '#8B4513',       // Saddle brown (barn color)
};

/**
 * Displays game achievements (longest road, largest city, etc.)
 * Only renders non-null achievements. Styled with medieval aesthetic.
 */
export default function GameHighlights({ achievements = {} }) {
  if (!achievements) return null;

  // Filter and order achievements
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
        marginBottom: '0.8rem',
      }}>
        GAME HIGHLIGHTS
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.2rem',
      }}>
        {displayAchievements.map(({ key, amount, player }) => (
          <div
            key={key}
            style={{
              background: 'var(--aged-paper)',
              border: '1px solid var(--stone-gray-light)',
              borderLeft: `4px solid ${ACHIEVEMENT_COLORS[key]}`,
              borderRadius: 'var(--radius-tile)',
              padding: '1rem 1.1rem',
              fontFamily: 'Crimson Text, serif',
            }}
          >
            <div style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: ACHIEVEMENT_COLORS[key],
              marginBottom: '0.4rem',
            }}>
              {formatAchievementName(key)}
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--stone-gray)',
            }}>
              <span style={{ fontWeight: 600 }}>{player}</span> · {amount} pt{amount !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
