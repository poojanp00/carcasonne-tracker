/**
 * SHARED APPLICATION CONSTANTS
 *
 * Centralized location for all app-wide constants to avoid duplication
 * and maintain consistency across components.
 */

// ── Navigation ──
export const TABS = [
  { id: 'home',       label: 'About'       },
  { id: 'board',      label: 'Play'        },
  { id: 'history',    label: 'Logbook'     },
  { id: 'statistics', label: 'Statistics'  },
  { id: 'collection', label: 'Collection'  },
];

// ── Configuration ──
export const APP_CONFIG = {
  TOAST_DURATION: 3100, // milliseconds before toast message disappears
};

// ── Carcassonne Game Rules ──
export const MAX_GAME_PLAYERS = 6;
export const MAX_REALMS = 12;

// Monastery, Abbot, and Abbey all score a max of 9 points per completed feature
// (1 point for the tile itself + up to 8 surrounding neighbors).
export const MONASTERY_LIKE_TYPES = ['monastery', 'abbot', 'abbey'];
export const MONASTERY_LIKE_MAX = 9;

// City/Cathedral, Road/Inn, and Monastery/Abbot/Abbey "game record" badges only
// count features completed before final scoring — those features must be
// finished to score at all, so anything closed out during final scoring was
// left unfinished mid-game and scored via the leftover-points rules.
// Field/Pig/Barn are exempt since they're intentionally always scored during
// final scoring.
export const LIVE_PLAY_ONLY_RECORD_TYPES = ['road', 'city', 'inn', 'cathedral', 'monastery', 'abbot', 'abbey'];

// Types whose full (9-point) completions count toward the "Most Monasteries" record.
export const MONASTERY_RECORD_TYPES = ['monastery', 'abbot', 'abbey'];

// ── Expansion Type Mapping ──
// Maps expansion names to the score types they introduce beyond the base four
// Base game types: road, city, monastery, field
export const EXPANSION_TYPES = {
  'Inns & Cathedrals':          ['inn', 'cathedral'],
  'Bridges, Castles & Bazaars': ['inn', 'cathedral'],
  'The Princess & the Dragon':  ['princess', 'fairy'],
  'Traders & Builders':         ['wine', 'grain', 'cloth', 'pig'],
  'Count, King & Robber':       ['largest_city', 'largest_road'],
  'Abbey & Mayor':              ['abbey', 'barn'],
  'The Abbot':                  ['abbot'],
};

// ── Expansion Priority ──
// Always show River and Abbot first since they're commonly used foundational expansions
export const PINNED_EXPANSIONS = ['The River', 'The Abbot'];

// ── Scoring Types ──
// Consistent order matching UI display across Statistics and PostGameForm
export const SCORE_TYPE_ORDER = [
  'road', 'city', 'monastery', 'field',           // Base game
  'abbot',                                         // The Abbot
  'inn', 'cathedral',                              // Inns & Cathedrals
  'wine', 'grain', 'cloth', 'pig',                 // Traders & Builders
  'abbey', 'barn',                                 // Abbey & Mayor
  'princess', 'fairy',                             // The Princess & the Dragon
  'largest_city', 'largest_road',                  // Count, King & Robber
  'wagon',                                         // Other/wagon
];

// ── Scoring Color Palette ──
// Medieval/earthy colors for each scoring type - used in charts and displays
export const SCORE_TYPE_COLORS = {
  road: '#6B4423',       // Saddle brown
  city: '#a9a5a5ff',     // White gray
  monastery: '#C17A2B',  // Orange
  field: '#6B8E23',      // Olive green
  abbot: '#E8973A',      // Orange (near monastery)
  inn: '#7A5535',        // Mid brown (near road)
  cathedral: '#787474',  // Gray (near city)
  wine: '#7B2355',       // Purple red
  grain: '#DAA520',      // Goldenrod
  cloth: '#8B7355',      // Burlywood
  pig: '#4A7A1E',        // Olive green (near field/barn)
  abbey: '#C44A1A',      // Red orange
  barn: '#1A3D2B',       // Deep dark green
  princess: '#C41E3A',   // Carmine
  fairy: '#D4418E',      // Pink/mauve
  largest_city: '#1F4788',    // Deep blue
  largest_road: '#2D5A2D',    // Deep forest green
  wagon: '#996633',      // Brown
};

// ── Meeple Color Mapping ──
// Maps meeple filenames to game colors
export const MEEPLE_COLOR_MAP = {
  blue:   '#2563EB',
  red:    '#DC2626',
  yellow: '#B8860B',
  green:  '#16A34A',
  black:  '#111827',
  pink:   '#EC4899',
};

// ── Statistics Configuration ──
export const STATISTICS_CONFIG = {
  CLUTCH_THRESHOLD: 0.10, // 10% - margin threshold for "clutch" (close) games
};
