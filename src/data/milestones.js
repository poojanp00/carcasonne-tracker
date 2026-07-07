// Milestone badge definitions for the Statistics page player-card back side.
// Badge artwork lives in images/milestones/<category>/<badgename>.png.
// Thresholds and ordering follow milestones.md.

import cityPlanner from '../../images/milestones/city/cityplanner.png';
import architect from '../../images/milestones/city/architect.png';
import lordCitadel from '../../images/milestones/city/lordcitadel.png';
import pathfinder from '../../images/milestones/road/pathfinder.png';
import trailblazer from '../../images/milestones/road/trailblazer.png';
import wayfarer from '../../images/milestones/road/wayfarer.png';
import acolyte from '../../images/milestones/monastery/acolyte.png';
import prior from '../../images/milestones/monastery/prior.png';
import warden from '../../images/milestones/monastery/warden.png';
import sower from '../../images/milestones/field/sower.png';
import cultivator from '../../images/milestones/field/cultivator.png';
import grandAgrarian from '../../images/milestones/field/grandagrarian.png';
import connoisseur from '../../images/milestones/goods/connoisseur.png';
import miller from '../../images/milestones/goods/miller.png';
import weaver from '../../images/milestones/goods/weaver.png';

export const MILESTONE_CATEGORIES = [
  {
    id: 'city',
    label: 'Cities',
    // Breakdown score types that count toward this category's progress
    types: ['city', 'cathedral'],
    unit: 'City Points',
    badges: [
      { threshold: 500,  name: 'City Planner',        img: cityPlanner, description: 'Laying the foundations of cities, one tile at a time.' },
      { threshold: 1500, name: 'Architect',           img: architect, description: 'A master builder whose walls rise high above the countryside.' },
      { threshold: 2500, name: 'Lord of the Citadel', img: lordCitadel, description: 'Ruler of cities. No city in the realm stands without your seal.' },
    ],
  },
  {
    id: 'road',
    label: 'Roads',
    types: ['road', 'inn'],
    unit: 'Road Points',
    badges: [
      { threshold: 250,  name: 'Pathfinder',  img: pathfinder, description: 'A pioneer laying the first paths across the realm.' },
      { threshold: 750,  name: 'Trailblazer', img: trailblazer, description: 'Your routes connect distant lands and open new horizons.' },
      { threshold: 1500, name: 'Wayfarer',    img: wayfarer, description: 'A renowned explorer. Your footprints leave a legacy across the realm.' },
    ],
  },
  {
    id: 'monastery',
    label: 'Monasteries',
    types: ['monastery', 'abbot', 'abbey'],
    unit: 'Monastery Points',
    badges: [
      { threshold: 250,  name: 'Acolyte', img: acolyte, description: 'A humble servant tending the courtyard gardens.' },
      { threshold: 750,  name: 'Prior',   img: prior, description: 'The brothers of the abbey look to you for guidance.' },
      { threshold: 1500, name: 'Warden',  img: warden, description: 'Keeper of the realm\'s most sacred grounds.' },
    ],
  },
  {
    id: 'field',
    label: 'Fields',
    types: ['field', 'barn', 'pig'],
    unit: 'Field Points',
    badges: [
      { threshold: 250,  name: 'Sower',          img: sower, description: 'A humble farmer nurturing the fields of the realm.' },
      { threshold: 750,  name: 'Cultivator',     img: cultivator, description: 'Your fields feed cities far and wide.' },
      { threshold: 1500, name: 'Grand Agrarian', img: grandAgrarian, description: 'A legendary farmer. The kingdom flourishes under your care.' },
    ],
  },
  {
    id: 'goods',
    label: 'Goods',
    types: ['wine', 'grain', 'cloth'],
    unit: 'Goods Points',
    badges: [
      // Each goods badge tracks a single good, overriding the category types/unit
      { threshold: 100, name: 'Connoisseur', img: connoisseur, types: ['wine'],  unit: 'Wine Points', description: 'A developed taste for the realm\'s finest vintages.' },
      { threshold: 100, name: 'Miller',      img: miller,      types: ['grain'], unit: 'Grain Points', description: 'Grain flows through your hands like gold.' },
      { threshold: 100, name: 'Weaver',      img: weaver,      types: ['cloth'], unit: 'Cloth Points', description: 'Your cloth is sought in every market across the land.' },
    ],
  },
];

// Lifetime points from a player's aggregated score breakdown for a set of score types
export function progressForTypes(types, breakdown) {
  return types.reduce((sum, t) => sum + (breakdown?.[t] || 0), 0);
}

// Progress toward a badge — a badge may override its category's score types
// (e.g. individual goods)
export function badgeProgress(category, badge, breakdown) {
  return progressForTypes(badge.types ?? category.types, breakdown);
}
