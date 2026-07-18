// Account-wide milestone tiers for the Me page — aggregated across every realm
// the account belongs to. Separate from the per-realm badge system in
// milestones.js. Text-only for now; each tier has an `img` slot for future
// badge artwork.

import { progressForTypes } from './milestones';

export const ACCOUNT_MILESTONES = [
  {
    id: 'games',
    label: 'Games Played',
    metric: 'games', // counts games, not breakdown points
    unit: 'Games',
    tiers: [
      { threshold: 100,  name: 'Game Night',        img: null },
      { threshold: 500,  name: 'Neighborhood Host', img: null },
      { threshold: 1000, name: 'Community Staple',  img: null },
    ],
  },
  {
    id: 'city',
    label: 'City Points',
    types: ['city'],
    unit: 'City Points',
    tiers: [
      { threshold: 5000,  name: 'Walled Town',  img: null },
      { threshold: 25000, name: 'Metropolis',   img: null },
      { threshold: 50000, name: 'Iron Kingdom', img: null },
    ],
  },
  {
    id: 'road',
    label: 'Road Points',
    types: ['road'],
    unit: 'Road Points',
    tiers: [
      { threshold: 1000,  name: "Pilgrim's Path", img: null },
      { threshold: 5000,  name: "King's Highway", img: null },
      { threshold: 10000, name: 'Silk Road',      img: null },
    ],
  },
  {
    id: 'field',
    label: 'Field Points',
    types: ['field'],
    unit: 'Field Points',
    tiers: [
      { threshold: 1000,  name: 'Green Pasture',     img: null },
      { threshold: 5000,  name: 'Bountiful Harvest', img: null },
      { threshold: 10000, name: 'Breadbasket',       img: null },
    ],
  },
  {
    id: 'cathedral',
    label: 'Cathedral Points',
    types: ['cathedral'],
    unit: 'Cathedral Points',
    tiers: [
      { threshold: 1000,  name: 'Village Chapel',  img: null },
      { threshold: 5000,  name: 'Sacred Landmark', img: null },
      { threshold: 10000, name: 'Grand Basilica',  img: null },
    ],
  },
  {
    id: 'inn',
    label: 'Inn Points',
    types: ['inn'],
    unit: 'Inn Points',
    tiers: [
      { threshold: 750,  name: 'Roadside Tavern',  img: null },
      { threshold: 3500, name: "Traveler's Haven", img: null },
      { threshold: 7000, name: "King's Rest",      img: null },
    ],
  },
  {
    id: 'pig',
    label: 'Pig Points',
    types: ['pig'],
    unit: 'Pig Points',
    tiers: [
      { threshold: 500,  name: 'Prized Hog',      img: null },
      { threshold: 2500, name: 'Prosperous Herd', img: null },
      { threshold: 5000, name: 'Golden Boar',     img: null },
    ],
  },
  {
    id: 'barn',
    label: 'Barn Points',
    types: ['barn'],
    unit: 'Barn Points',
    tiers: [
      { threshold: 500,  name: 'Farmstead',        img: null },
      { threshold: 2500, name: 'Noble Estate',     img: null },
      { threshold: 5000, name: 'Fields of Plenty', img: null },
    ],
  },
  {
    id: 'monastery',
    label: 'Monastery Points',
    types: ['monastery'],
    unit: 'Monastery Points',
    tiers: [
      { threshold: 2000,  name: 'Hermitage',     img: null },
      { threshold: 10000, name: 'Abbey',         img: null },
      { threshold: 25000, name: 'Holy Dominion', img: null },
    ],
  },
  {
    // Provisional names/thresholds — final tiers TBD
    id: 'abbot',
    label: 'Abbot Points',
    types: ['abbot'],
    unit: 'Abbot Points',
    tiers: [
      { threshold: 750,  name: 'Wandering Friar', img: null },
      { threshold: 3500, name: 'Devoted Abbot',   img: null },
      { threshold: 7000, name: 'High Abbot',      img: null },
    ],
  },
  {
    id: 'goods',
    label: 'Merchant Coins',
    types: ['wine', 'grain', 'cloth'],
    unit: 'Goods Points',
    tiers: [
      { threshold: 500,  name: 'Market Stall',      img: null },
      { threshold: 2500, name: 'Trade Guild',       img: null },
      { threshold: 5000, name: 'Merchant Republic', img: null },
    ],
  },
];

// Current progress toward a category's tiers from the account aggregate
// ({ gamesCount, breakdown } as returned by calcAccountStats)
export function accountMilestoneProgress(category, account) {
  if (category.metric === 'games') return account.gamesCount;
  return progressForTypes(category.types, account.breakdown);
}
