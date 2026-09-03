/**
 * Egypt Treasures — TOT-aligned math (our server).
 */
import { getMathProfile } from '../../math-profile.mjs';

export const COLS = 5;
export const ROWS = 3;
export const REELS = [3, 3, 3, 3, 3];
export const ADJACENT = 1;
export const LINE_COUNT = 10;

export const LP_MIN = 0;
export const LP_MAX = 4;
export const HP_MIN = 5;
export const HP_MAX = 7;
export const PAY_SYMBOL_MIN = LP_MIN;
export const PAY_SYMBOL_MAX = HP_MAX;

export const CASH_SYMBOL = 8;
export const CLIENT_SYMBOL_MAX = CASH_SYMBOL;

export const PPS_MULTIPLIER = 1;
export const PPS_ENHANCER = 2;
export const PPS_MYSTERY = 4;

export const PAYTABLE = {
  0: [0, 0, 5, 15, 50],
  1: [0, 0, 5, 20, 60],
  2: [0, 0, 10, 30, 100],
  3: [0, 0, 10, 40, 120],
  4: [0, 0, 15, 50, 150],
  5: [0, 0, 20, 75, 200],
  6: [0, 0, 25, 100, 300],
  7: [0, 0, 30, 120, 400],
};

export const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 1, 0, 1],
];

export const BASE_STRIPS = [
  [0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 8],
  [0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6],
  [0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 8],
  [0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6],
  [0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6],
];

export function winPayScale() {
  return getMathProfile().winPayMultiplier ?? 1;
}

export function plantedWinRate() {
  return getMathProfile().plantedWinRate * 0.85;
}

export const PPS_LABELS = {
  [PPS_MULTIPLIER]: 'Ra',
  [PPS_ENHANCER]: 'Bastet',
  [PPS_MYSTERY]: 'Anubis',
};
