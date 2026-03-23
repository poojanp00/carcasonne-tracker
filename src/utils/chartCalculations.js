/**
 * Calculate aggregated scores for the three chart types
 */

export function calculateInfrastructureMetrics(players) {
  return players.map(player => {
    const breakdown = player.breakdown || {};
    return {
      name: player.name,
      roadScore: (breakdown.road || 0) + (breakdown.inn || 0),
      cityScore: (breakdown.city || 0) + (breakdown.cathedral || 0),
      monasteryScore: (breakdown.monastery || 0) + (breakdown.abbot || 0) + (breakdown.abbey || 0),
      agricultureScore: (breakdown.field || 0) + (breakdown.pig || 0) + (breakdown.barn || 0),
    };
  });
}

export function calculateEnhancementsMetrics(players) {
  return players.map(player => {
    const breakdown = player.breakdown || {};
    return {
      name: player.name,
      tradeGoods: (breakdown.wine || 0) + (breakdown.cloth || 0) + (breakdown.grain || 0),
      kingRobber: (breakdown.largest_city || 0) + (breakdown.largest_road || 0),
      supernatural: (breakdown.fairy || 0) + (breakdown.princess || 0) + (breakdown.wagon || 0),
      tower: breakdown.tower || 0,
    };
  });
}

export function calculateExpansionLift(players) {
  return players.map(player => {
    const breakdown = player.breakdown || {};
    const roadBase = breakdown.road || 0;
    const roadExpansion = (breakdown.inn || 0);

    const cityBase = breakdown.city || 0;
    const cityExpansion = (breakdown.cathedral || 0);

    const monasteryBase = breakdown.monastery || 0;
    const monasteryExpansion = (breakdown.abbot || 0) + (breakdown.abbey || 0);

    const fieldBase = breakdown.field || 0;
    const fieldExpansion = (breakdown.pig || 0) + (breakdown.barn || 0);

    return {
      name: player.name,
      'Road Base': roadBase,
      'Road Expansion': roadExpansion,
      'City Base': cityBase,
      'City Expansion': cityExpansion,
      'Monastery Base': monasteryBase,
      'Monastery Expansion': monasteryExpansion,
      'Field Base': fieldBase,
      'Field Expansion': fieldExpansion,
      roadTotal: roadBase + roadExpansion,
      cityTotal: cityBase + cityExpansion,
      monasteryTotal: monasteryBase + monasteryExpansion,
      fieldTotal: fieldBase + fieldExpansion,
    };
  });
}
