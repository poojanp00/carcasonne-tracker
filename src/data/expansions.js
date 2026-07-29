// The only expansions guests can toggle without an account
export const GUEST_ALLOWED_MINIS = new Set(['The River', 'The Abbot']);

// complete: true = fully supported in the tracker; false = UI disabled with "under development" tooltip
export const DEFAULT_EXPANSIONS = [
  // Major expansions (numbered in official release order)
  { name: 'Inns & Cathedrals',           category: 'major', type: 'full', tiles: 18, perPlayer: ['large_meeple'], fixed: [], owned: false, complete: true },
  { name: 'Traders & Builders',          category: 'major', type: 'full', tiles: 24, perPlayer: ['builder', 'pig'], fixed: ['trade_goods_tokens'], owned: false, complete: true },
  { name: 'The Princess & the Dragon',   category: 'major', type: 'full', tiles: 30, perPlayer: [], fixed: ['dragon', 'fairy'], owned: false, complete: false },
  { name: 'The Tower',                   category: 'major', type: 'full', tiles: 18, perPlayer: [], fixed: ['tower_pieces'], owned: false, complete: false },
  { name: 'Abbey & Mayor',               category: 'major', type: 'full', tiles: 12, perPlayer: ['mayor', 'wagon', 'barn'], fixed: ['abbey_tiles'], owned: false, complete: true },
  { name: 'Count, King & Robber',        category: 'major', type: 'full', tiles: 12, perPlayer: [], fixed: ['count', 'king_token', 'robber_baron_token'], owned: false, complete: false },
  { name: 'The Catapult',                category: 'major', type: 'full', tiles: 12, perPlayer: [], fixed: ['catapult_device', 'catapult_tokens'], owned: false, complete: false },
  { name: 'Bridges, Castles & Bazaars',  category: 'major', type: 'full', tiles: 12, perPlayer: [], fixed: ['bridge_pieces', 'castle_tokens'], owned: false, complete: false },
  { name: 'Hills & Sheep',               category: 'major', type: 'full', tiles: 18, perPlayer: ['shepherd'], fixed: ['sheep_tokens', 'wolf_tokens'], owned: false, complete: false },
  { name: 'Under the Big Top',           category: 'major', type: 'full', tiles: 20, perPlayer: ['ringmaster'], fixed: ['animal_tokens'], owned: false, complete: false },
  { name: 'Ghosts, Castles & Cemeteries',category: 'mini', type: 'full', tiles: 18, perPlayer: [], fixed: ['ghost_meeples'], owned: false, complete: false },

  // Base mini expansions (foundational, integrate seamlessly)
  { name: 'The River',                   category: 'base_mini', type: 'mini', tiles: 12, perPlayer: [], fixed: [], owned: true, complete: true },
  { name: 'The Abbot',                   category: 'base_mini', type: 'mini', tiles: 0, perPlayer: ['abbot'], fixed: [], owned: true, complete: true },
  { name: 'The River II',                category: 'base_mini', type: 'mini', tiles: 12, perPlayer: [], fixed: [], owned: false, complete: false },
  { name: 'The Festival',                category: 'base_mini', type: 'mini', tiles: 10, perPlayer: [], fixed: [], owned: false, complete: false },

  // Mini expansions (smaller, specialized additions)
  { name: 'The Flying Machines',         category: 'mini', type: 'mini', tiles: 8, perPlayer: [], fixed: [], owned: false, complete: false },
  { name: 'The Ferries',                 category: 'mini', type: 'mini', tiles: 8, perPlayer: [], fixed: ['ferry_tokens'], owned: false, complete: false },
  { name: 'The Gold Mines',              category: 'mini', type: 'mini', tiles: 8, perPlayer: [], fixed: ['gold_tokens'], owned: false, complete: false },
  { name: 'Mage & Witch',                category: 'mini', type: 'mini', tiles: 8, perPlayer: [], fixed: ['mage', 'witch'], owned: false, complete: false },
  { name: 'Robbers',                     category: 'mini', type: 'mini', tiles: 8, perPlayer: ['robber'], fixed: [], owned: false, complete: false },
  { name: 'Crop Circles',                category: 'mini', type: 'mini', tiles: 6, perPlayer: [], fixed: [], owned: false, complete: false },
];
