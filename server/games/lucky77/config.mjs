/**
 * Lucky 77 — three-zone wheel (BooAn luck77_2_half style).
 * 9 physical stops: Lemon ×4, Watermelon ×4, Seven ×1 (no adjacent lemons).
 */

import { validateLucky77PlaceBet } from '../../../games/lucky77/bet-rules.js';

export const LUCK77_TYP = 'LUCK77_HALF';
export const LUCK77_LOTTERY = 'luck77_2_half';

/** @type {import('../lottery/engine.mjs').LotterySymbol[]} */
export const LUCK77_SYMBOLS = [
  { playCode: 'LUCK77_LEMON', label: 'Lemon', emoji: '🍋', odd: 2 },
  { playCode: 'LUCK77_SEVEN', label: 'Golden Trio', emoji: '✦', odd: 8 },
  { playCode: 'LUCK77_WATERMELON', label: 'Watermelon', emoji: '🍉', odd: 2 },
];

/** Clockwise from pointer (12 o'clock). Alternating — never two lemons in a row. */
export const LUCK77_WHEEL_STOPS = [
  'LUCK77_SEVEN',
  'LUCK77_LEMON',
  'LUCK77_WATERMELON',
  'LUCK77_LEMON',
  'LUCK77_WATERMELON',
  'LUCK77_LEMON',
  'LUCK77_WATERMELON',
  'LUCK77_LEMON',
  'LUCK77_WATERMELON',
];

export const LUCK77_GAME = {
  id: 'triple-harvest',
  name: 'Triple Harvest',
  typCode: LUCK77_TYP,
  lotteryCode: LUCK77_LOTTERY,
  bettingSeconds: 10,
  spinSeconds: 5,
  resultSeconds: 2,
  symbols: LUCK77_SYMBOLS,
  wheelStops: LUCK77_WHEEL_STOPS,
  validateBet: validateLucky77PlaceBet,
};
