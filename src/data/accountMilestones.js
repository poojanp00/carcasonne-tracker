// Account-wide milestone tiers for the Me page — aggregated across every realm
// the account belongs to. Text-only for now; each tier has an `img` slot for
// future badge artwork.
//
// Tier numbers are explicit (not index-derived) so a Tier 0 can be prepended
// or a Tier 4 appended with a data-only change — UI reads tierNumber and
// tiers.length, never assumes three tiers.
//
// Visibility: categories with `alwaysVisible` are base-game and always shown;
// the rest only appear once the account has scored points in them (gated on
// actual data, not on an expansion-owned flag).

// Sum of a breakdown's points across a set of score types (e.g. road + inn).
function progressForTypes(types, breakdown) {
  return types.reduce((sum, t) => sum + (breakdown?.[t] || 0), 0);
}

export const ACCOUNT_MILESTONES = [
  {
    id: 'games',
    label: 'Furniture',
    metric: 'games', // counts games, not breakdown points
    unit: 'Games',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 10,  name: 'Folding Table',        img: null },
      { tierNumber: 2, threshold: 100,  name: 'Dining Table', img: null },
      { tierNumber: 3, threshold: 500, name: 'Oak Table',  img: null },
      { tierNumber: 4, threshold: 1000, name: 'Banquet Table', img: null },
    ],
  },
  {
    id: 'city',
    label: 'City',
    types: ['city'],
    unit: 'City Points',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 100,  name: 'Camp',  img: null },
      { tierNumber: 2, threshold: 1000, name: 'Town',   img: null },
      { tierNumber: 3, threshold: 5000, name: 'Metropolis', img: null },
      { tierNumber: 4, threshold: 10000, name: 'Iron Kingdom', img: null },
    ],
  },
  {
    id: 'road',
    label: 'Road',
    types: ['road'],
    unit: 'Road Points',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 50,  name: "Footpath", img: null },
      { tierNumber: 2, threshold: 500,  name: "Cobblestone Road", img: null },
      { tierNumber: 3, threshold: 2500,  name: "King's Highway", img: null },
      { tierNumber: 4, threshold: 5000, name: 'The Silk Road', img: null },
    ],
  },
  {
    id: 'monastery',
    label: 'Monastery',
    types: ['monastery'],
    unit: 'Monastery Points',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 100,  name: 'Hermitage',     img: null },
      { tierNumber: 2, threshold: 1000, name: 'Sacred Brotherhood',img: null },
      { tierNumber: 3, threshold: 5000, name: 'Monastic Order', img: null },
      { tierNumber: 4, threshold: 10000, name: 'Holy Dominion', img: null },
    ],
  },
  {
    id: 'field',
    label: 'Field',
    types: ['field'],
    unit: 'Field Points',
    tiers: [
      { tierNumber: 1, threshold: 100,  name: 'Meadow',img: null },
      { tierNumber: 2, threshold: 1000,  name: 'Pasture',img: null },
      { tierNumber: 3, threshold: 5000,  name: 'Farmland', img: null },
      { tierNumber: 4, threshold: 10000, name: 'Estate',img: null },
    ],
  },
  {
    id: 'abbot',
    label: 'Abbot',
    types: ['abbot'],
    unit: 'Abbot Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Devotee', img: null },
      { tierNumber: 2, threshold: 500,  name: 'Servant', img: null },
      { tierNumber: 3, threshold: 2500, name: 'Elder', img: null },
      { tierNumber: 4, threshold: 5000, name: 'Saint',img: null },
    ],
  },
  {
    id: 'cathedral',
    label: 'Cathedral',
    types: ['cathedral'],
    unit: 'Cathedral Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Shrine',  img: null },
      { tierNumber: 2, threshold: 500,  name: 'Chapel', img: null },
      { tierNumber: 3, threshold: 2500, name: 'Sanctuary',  img: null },
      { tierNumber: 4, threshold: 5000,  name: 'Grand Basilica',  img: null }
    ],
  },
  {
    id: 'inn',
    label: 'Inn',
    types: ['inn'],
    unit: 'Inn Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Alehouse',  img: null },
      { tierNumber: 2, threshold: 500,  name: 'Tavern',  img: null },
      { tierNumber: 3, threshold: 2500, name: "Traveler's Haven", img: null },
      { tierNumber: 4, threshold: 5000, name: "The King's Rest", img: null },
    ],
  },
  {
    id: 'pig',
    label: 'Pig',
    types: ['pig'],
    unit: 'Pig Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Piglet',      img: null },
      { tierNumber: 2, threshold: 500,  name: 'Prized Hog',      img: null },
      { tierNumber: 3, threshold: 2500, name: 'Fat Swine', img: null },
      { tierNumber: 4, threshold: 5000, name: 'Golden Boar',     img: null },
    ],
  },
  {
    id: 'barn',
    label: 'Barn',
    types: ['barn'],
    unit: 'Barn Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Shed',        img: null },
      { tierNumber: 2, threshold: 500,  name: 'Stable',        img: null },
      { tierNumber: 3, threshold: 2500, name: 'Homestead',     img: null },
      { tierNumber: 4, threshold: 5000, name: 'Great Manor', img: null },
    ],
  },
  {
    id: 'goods',
    label: 'Merchant Coins',
    types: ['wine', 'grain', 'cloth'],
    unit: 'Goods Points',
    tiers: [
      { tierNumber: 1, threshold: 50,  name: 'Trading Post',      img: null },
      { tierNumber: 2, threshold: 500,  name: 'Market Stand',      img: null },
      { tierNumber: 3, threshold: 2500, name: 'Bazaar',       img: null },
      { tierNumber: 4, threshold: 5000, name: 'Royal Marketplace', img: null },
    ],
  },
  {
    id: 'wins',
    label: 'Wins',
    metric: 'wins', // counts victories, not breakdown points
    unit: 'Victories',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 5,  name: 'Winner', img: null },
      { tierNumber: 2, threshold: 50,  name: 'Champion', img: null },
      { tierNumber: 3, threshold: 250, name: 'Master', img: null },
      { tierNumber: 4, threshold: 500, name: 'Legend', img: null },
    ],
  },
  {
    id: 'expansions',
    label: 'Expansions',
    metric: 'expansions', // counts full expansions owned, not breakdown points
    unit: 'Full Expansions Owned',
    alwaysVisible: true,
    tiers: [
      { tierNumber: 1, threshold: 1,  name: 'Fan', img: null },
      { tierNumber: 2, threshold: 4,  name: 'Hobbyist', img: null },
      { tierNumber: 3, threshold: 7, name: 'Collector', img: null },
      { tierNumber: 4, threshold: 11, name: 'Aficionado', img: null },
    ],
  },
];

// Replaces ACCOUNT_MILESTONES's contents IN PLACE (never reassigns the
// export binding) with the authoritative numeric config from
// migrations/milestone_config.sql (categories: id/metric/types/sort_order,
// tiers: category_id/tier_number/threshold) — every existing
// `import { ACCOUNT_MILESTONES } from '../data/accountMilestones'` call site
// keeps working unchanged, since they all hold a live reference to this same
// array. Cosmetic fields (label/unit/alwaysVisible/tier name/img) are never
// fetched — they're carried over from whatever's already in ACCOUNT_MILESTONES
// (the hardcoded fallback below, until this runs) so the DB never needs to
// know about display text at all.
export function applyMilestoneConfig(categories, tiers) {
  if (!categories || !tiers) return; // fetch failed — keep the built-in fallback

  const tiersByCategory = {};
  for (const t of tiers) {
    (tiersByCategory[t.category_id] ||= []).push(t);
  }
  // Captured from the CURRENT (pre-mutation) contents, before the array is
  // cleared below.
  const displayById = Object.fromEntries(ACCOUNT_MILESTONES.map(c => [c.id, c]));

  const merged = [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => {
      const display = displayById[c.id] || {};
      const tierDisplayByNumber = Object.fromEntries((display.tiers || []).map(t => [t.tierNumber, t]));
      return {
        id: c.id,
        label: display.label ?? c.id,
        metric: c.metric ?? undefined,
        types: c.types ?? undefined,
        unit: display.unit ?? '',
        alwaysVisible: !!display.alwaysVisible,
        tiers: (tiersByCategory[c.id] || [])
          .sort((a, b) => a.tier_number - b.tier_number)
          .map(t => {
            const td = tierDisplayByNumber[t.tier_number] || {};
            return { tierNumber: t.tier_number, threshold: Number(t.threshold), name: td.name ?? `Tier ${t.tier_number}`, img: td.img ?? null };
          }),
      };
    });

  ACCOUNT_MILESTONES.length = 0;
  ACCOUNT_MILESTONES.push(...merged);
}

// Current progress toward a category's tiers from the account aggregate
// ({ gamesCount, breakdown } as returned by calcAccountStats)
export function accountMilestoneProgress(category, account) {
  if (category.metric === 'games') return account.gamesCount;
  if (category.metric === 'wins') return account.stats.wins;
  if (category.metric === 'expansions') return account.expansionsFullCount;
  return progressForTypes(category.types, account.breakdown);
}

// Categories to show in the milestones carousel: always-visible base-game
// categories plus any the account has actually scored in. Filter only —
// config order is preserved so newly unlocked categories slot into place.
export function visibleAccountMilestones(account) {
  return ACCOUNT_MILESTONES.filter(
    (c) => c.alwaysVisible || accountMilestoneProgress(c, account) > 0
  );
}

// Full tier state for one category — the single source of tier math.
export function categoryTierState(category, account) {
  const progress = accountMilestoneProgress(category, account);
  const reached = category.tiers.filter((t) => progress >= t.threshold);
  const currentTier = reached[reached.length - 1] ?? null; // null = not started
  const nextTier = category.tiers.find((t) => progress < t.threshold) ?? null; // null = maxed
  return {
    progress,
    currentTier,
    currentTierNumber: currentTier ? currentTier.tierNumber : category.tiers[0].tierNumber - 1,
    nextTier,
    reached, // tiers already unlocked — used to place progress-bar notches
    maxed: nextTier === null,
    pct: nextTier === null ? 100 : Math.min(100, (progress / nextTier.threshold) * 100),
    remaining: nextTier === null ? 0 : nextTier.threshold - progress,
  };
}
