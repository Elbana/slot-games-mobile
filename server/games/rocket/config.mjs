/** Rocket crash — multiplier fly / cash-out game. */

export const ROCKET_GAME = {
  id: 'rocket',
  name: 'Rocket',
  bettingSeconds: 6,
  resultSeconds: 3,
  /** Exponential curve: mult = exp(MULT_K * elapsedSec) until crash. */
  multK: 0.085,
  maxMultiplier: 150,
  /** Default bet presets shown as fuel cans (UI). */
  chipPresets: [5000, 25000, 50000, 250000],
  defaultChip: 5000,
};
