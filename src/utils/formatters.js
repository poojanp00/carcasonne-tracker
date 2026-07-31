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
 * Format date string for the LED/neon stadium-clock display (.game-clock-digits) —
 * paired with formatDurationHMS in the post-game form / logbook lightbox info bars.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} MM/DD/YY (e.g., "03/05/26")
 */
export function formatDateDigital(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
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

/**
 * Format a finished game's duration as a fixed HH:MM:SS record — all six
 * digits always shown (unlike the board's live MM:SS/H:MM clock, which
 * drops the hour digit while it's still ticking) since this is a frozen
 * record being read back, not a timer counting up.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} e.g. "01:23:45"
 */
export function formatDurationHMS(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}
