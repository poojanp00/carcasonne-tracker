/**
 * CARCASSONNE score board PATH GENERATION
 * 
 * Generates a 50-point snake-like scoring track path using linear interpolation
 * between manually-defined anchor points. All coordinates are percentage-based
 * (0-100) for responsive scaling across different screen sizes.
 * 
 * The path follows these segments:
 * - Start (0): Bottom right corner (88, 88)
 * - Positions 1-7: Move left along bottom edge  
 * - Positions 8-13: Move up along left edge
 * - Positions 15-24: Move right across top edge
 * - Positions 25-26: Move down along right edge
 * - Positions 30-40: Spiral inward toward center
 * - Positions 45-49: Final approach to finish line
 * 
 * Linear interpolation fills gaps between anchor points to create
 * smooth movement for player meeples during gameplay.
 */

// BOARD_PATH: generates 50 percentage-based coordinates for a snake-like path
// We define anchor points and linearly interpolate between them so the board
// scales responsively while following the segments described in the prompt.

const ANCHORS = [
  { i: 0,  x: 88, y: 88 },
  { i: 1,  x: 75, y: 86 },
  { i: 3,  x: 55, y: 88 },
  { i: 5,  x: 38, y: 88 },
  { i: 6,  x: 27, y: 88 },
  { i: 7,  x: 16, y: 91 },
  { i: 8,  x: 8, y: 81 },
  { i: 10, x: 5, y: 55 },
  { i: 13, x: 7, y: 17 },
  { i: 15, x: 22, y: 8 },
  { i: 20, x: 60, y: 8 },
  { i: 24, x: 92, y: 7 },
  { i: 25, x: 95, y: 20 },
  { i: 26, x: 93, y: 29 },
  { i: 30, x: 62, y: 30 },
  { i: 35, x: 30, y: 29 },
  { i: 36, x: 24, y: 36 },
  { i: 37, x: 21, y: 45 },
  { i: 38, x: 26, y: 53 },
  { i: 40, x: 38, y: 55 },
  { i: 45, x: 72, y: 51 },
  { i: 46, x: 79, y: 52 },
  { i: 47, x: 86, y: 50 },
  { i: 48, x: 92, y: 56 },
  { i: 49, x: 93, y: 65 },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const BOARD_PATH = (() => {
  const path = new Array(50);
  for (let s = 0; s < ANCHORS.length - 1; s++) {
    const a = ANCHORS[s];
    const b = ANCHORS[s + 1];
    const span = b.i - a.i;
    for (let k = 0; k <= span; k++) {
      const idx = a.i + k;
      const t = span === 0 ? 0 : k / span;
      if (idx >= 0 && idx < 50) {
        path[idx] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      }
    }
  }

  // Fill any missing positions (shouldn't happen) by copying nearest anchor
  for (let i = 0; i < 50; i++) {
    if (!path[i]) {
      let nearest = ANCHORS[0];
      let best = Math.abs(i - ANCHORS[0].i);
      for (const a of ANCHORS) {
        const d = Math.abs(i - a.i);
        if (d < best) { best = d; nearest = a; }
      }
      path[i] = { x: nearest.x, y: nearest.y };
    }
  }

  return path;
})();

export default BOARD_PATH;
