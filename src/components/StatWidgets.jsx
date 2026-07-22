// Presentational stat widgets shared by the per-realm RealmBook pages and
// the account-wide Profile page.

import ValInfo from './ValInfo';

const MEEPLE_MODULES = import.meta.glob('../../images/meeples/*.png',     { eager: true, import: 'default' });
const FUN_MODULES    = import.meta.glob('../../images/meeples/fun/*.png', { eager: true, import: 'default' });
export const MEEPLE_IMGS = {
  ...Object.fromEntries(Object.entries(MEEPLE_MODULES).map(([p, img]) => [p.split('/').pop(), img])),
  ...Object.fromEntries(Object.entries(FUN_MODULES).map(([p, img]) => [`fun/${p.split('/').pop()}`, img])),
};

export const TYPE_LABELS = {
  road: 'Road', city: 'City', monastery: 'Monastery', field: 'Field',
  inn: 'Inn', cathedral: 'Cathedral',
  princess: 'Princess', fairy: 'Fairy',
  wine: 'Wine', grain: 'Grain', cloth: 'Cloth', pig: 'Pig',
  largest_city: 'Largest City', largest_road: 'Largest Road',
  abbey: 'Abbey', barn: 'Barn', abbot: 'Abbot', wagon: 'Wagon',
};

export function WinRateBadge({ rate }) {
  const cls = rate >= 60 ? 'badge-high' : rate >= 40 ? 'badge-mid' : 'badge-low';
  return <span className={`win-rate-badge ${cls}`}>{rate}%</span>;
}

