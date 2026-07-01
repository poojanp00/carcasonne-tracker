/**
 * GAME ACHIEVEMENT TRACKING
 *
 * Tracks "Best-in-Game" achievements by monitoring the largest individual feature
 * for each scoring category. Live-tracked during gameplay and stored when game finishes.
 *
 * Achievement Mapping (from category type to database column):
 * - road → longest_road
 * - city → largest_city
 * - field → largest_field
 * - inn → longest_inn
 * - cathedral → largest_cathedral
 * - pig → biggest_pig
 * - barn → largest_barn
 *
 * UI Mapping (from category type to display format):
 * - road → longestRoad
 * - city → largestCity
 * - field → largestField
 * - inn → longestInn
 * - cathedral → largestCathedral
 * - pig → biggestPig
 * - barn → largestBarn
 */

const ACHIEVEMENT_MAP = {
  road:      'longest_road',
  city:      'largest_city',
  field:     'largest_field',
  inn:       'longest_inn',
  cathedral: 'largest_cathedral',
  pig:       'biggest_pig',
  barn:      'largest_barn',
  monastery: 'most_monastery',
};

const UI_ACHIEVEMENT_MAP = {
  road:       'longestRoad',
  city:       'largestCity',
  field:      'largestField',
  inn:        'longestInn',
  cathedral:  'largestCathedral',
  pig:        'biggestPig',
  barn:       'largestBarn',
  monastery:  'mostMonastery',
  bestTrader: 'bestTrader',
};

/**
 * LEGACY: Calculate achievements from final game scores.
 *
 * DEPRECATED: New games use live-tracking via maxFeatures in board_state.
 * This function is kept for backwards compatibility with legacy data analysis.
 *
 * Takes the score breakdown ({player: {type: amount}}) and finds the player
 * with the highest total points in each category (not the largest single feature).
 * This is different from live-tracked achievements which track individual features.
 *
 * @param {Object} scoreBreakdown - Score distribution {player: {type: amount}}
 * @returns {Object} Achievement records {category: {amount, player}} or null
 */
export function calculateAchievements(scoreBreakdown) {
  const achievements = {};

  // For each score type, find the player with the highest TOTAL amount
  Object.keys(ACHIEVEMENT_MAP).forEach(scoreType => {
    let maxAmount = -1;
    let maxPlayer = null;

    // Check all players for this score type
    Object.entries(scoreBreakdown).forEach(([playerName, breakdown]) => {
      const amount = breakdown[scoreType] || 0;
      if (amount > maxAmount) {
        maxAmount = amount;
        maxPlayer = playerName;
      }
    });

    // Only record achievement if it was actually scored (maxAmount > 0)
    if (maxAmount > 0 && maxPlayer) {
      const achievementKey = ACHIEVEMENT_MAP[scoreType];
      achievements[achievementKey] = {
        amount: maxAmount,
        player: maxPlayer,
      };
    }
  });

  return achievements;
}

/**
 * Transform maxFeatures from storage format to UI format.
 * Converts {road: {amount, player}} to {longestRoad: {amount, player}, ...}
 *
 * @param {Object} maxFeatures - Raw max features {type: {amount, player}}
 * @returns {Object} UI-formatted achievements {uiKey: {amount, player}}
 */
export function transformMaxFeaturesToUI(maxFeatures) {
  if (!maxFeatures) return {};

  const transformed = {};
  Object.entries(maxFeatures).forEach(([type, data]) => {
    const uiKey = UI_ACHIEVEMENT_MAP[type];
    if (uiKey && data) {
      transformed[uiKey] = data;
    }
  });

  return transformed;
}

/**
 * Format achievement display string.
 * Converts camelCase to "Title Case" (e.g., longestRoad → "Longest Road").
 */
export function formatAchievementName(key) {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
