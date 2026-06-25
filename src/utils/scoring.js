/**
 * SCORING / WINNER UTILITIES
 *
 * Single source of truth for deciding a game's winner. Every game uses the
 * classic "highest score wins" rule (ties share the win), so all call sites
 * route through here instead of re-implementing the max-and-filter logic.
 */

/**
 * Determine the winner(s) of a game.
 *
 * @param {Object<string, number|string>} scoresByPlayer - map of player name → final score
 * @returns {{ winners: string[], maxScore: number }}
 *   winners is empty when no player has a positive score (i.e. no winner yet).
 */
export function computeWinners(scoresByPlayer) {
  const entries = Object.entries(scoresByPlayer || {});
  const maxScore = entries.reduce((max, [, score]) => Math.max(max, Number(score) || 0), 0);
  const winners = maxScore > 0
    ? entries.filter(([, score]) => (Number(score) || 0) === maxScore).map(([name]) => name)
    : [];
  return { winners, maxScore };
}
