/** Rocket crash — multiplier fly / cash-out game. */

import { PAYOUT_LIMITS } from '../../economy/payout-limits.mjs';

const limits = PAYOUT_LIMITS.rocket;

export const ROCKET_GAME = {
  id: 'rocket-rush',
  name: 'Rocket Rush',
  bettingSeconds: 6,
  resultSeconds: 3,
  /** Exponential curve: mult = exp(MULT_K * elapsedSec) until crash. */
  multK: 0.085,
  maxMultiplier: limits.maxMultiplier,
  houseEdge: limits.houseEdge,
  maxWinBetMultiple: limits.maxWinBetMultiple,
  /** Default bet presets shown as fuel cans (UI). */
  chipPresets: [5000, 25000, 50000, 100000],
  defaultChip: 5000,
};
