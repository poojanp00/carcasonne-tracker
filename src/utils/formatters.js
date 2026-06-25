/**
 * SHARED UTILITY FUNCTIONS
 *
 * Common formatting and helper functions used across components.
 */

import { MEEPLE_COLOR_MAP } from '../constants';

/**
 * Format date string to readable format
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "Mar 5, 2026")
 */
export function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get meeple color from filename
 * @param {string} filename - Meeple filename (e.g., "1red.png")
 * @returns {string} Hex color code
 */
export function getMeepleColor(filename) {
  const FALLBACK_COLOR = '#8B5E3C';
  if (!filename) return FALLBACK_COLOR;
  const match = filename.match(/blue|red|yellow|green|black|pink/i);
  return match ? (MEEPLE_COLOR_MAP[match[0].toLowerCase()] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

/**
 * Normalize meeples for UI consistency
 * Converts 'fun/' prefix meeples to 'mystery.png' to maintain consistent interface
 * while preserving the original selection.
 *
 * @param {Object} meeples - Meeple selections map {playerName: meepleKey}
 * @returns {Object} Normalized meeples
 */
export function normalizeMeeples(meeples) {
  return meeples
    ? Object.fromEntries(
        Object.entries(meeples).map(([p, k]) => [p, k.startsWith('fun/') ? 'mystery.png' : k])
      )
    : meeples;
}

/**
 * Format score type name for display
 * Converts snake_case and camelCase to Title Case
 *
 * @param {string} name - Raw name (e.g., "trade_goods_tokens")
 * @returns {string} Formatted name (e.g., "Trade Goods Tokens")
 */
export function formatPieceName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export function getToday() {
  return new Date().toISOString().split('T')[0];
}
