/**
 * Football Gold — SOR-aligned math (our server; placeholder SOR assets on client).
 */

import { getMathProfile } from '../../math-profile.mjs';

export const COLS = 5;
export const ROWS = 3;
export const REELS = [3, 3, 3, 3, 3];
export const ADJACENT = 1;
export const LINE_COUNT = 10;

/** LP 0–4, HP 5–8 (HP4 = wild), treasure scatter 9, coin scatter 10 (server only). */
export const LP_MIN = 0;
export const LP_MAX = 4;
export const HP_MIN = 5;
export const HP_MAX = 8;
export const WILD = 8;
export const TREASURE_SCATTER = 9;
export const COIN_SCATTER = 10;

export const SYMBOL = {
  LP1: 0,
  LP2: 1,
  LP3: 2,
  LP4: 3,
  MP1: 4,
  MP2: 5,
  HP1: 6,
  HP2: 7,
  WILD: 8,
  SCATTER: TREASURE_SCATTER,
  COIN: COIN_SCATTER,
};

export const PAY_SYMBOL_MIN = LP_MIN;
export const PAY_SYMBOL_MAX = HP_MAX;

/** Coins per line bet for 3/4/5-of-a-kind (index = count). */
export const PAYTABLE = {
  0: [0, 0, 80, 80, 80],
  1: [0, 0, 80, 80, 80],
  2: [0, 0, 80, 80, 80],
  3: [0, 0, 120, 120, 120],
  4: [0, 0, 120, 120, 120],
  5: [0, 0, 600, 600, 600],
  6: [0, 0, 600, 600, 600],
  7: [0, 0, 1600, 300, 30],
  8: [0, 0, 5000, 1000, 100],
};

export const SCATTER_PAYTABLE = [0, 0, 200, 20, 2];
export const TREASURE_SCATTER_REELS = [1, 2, 3];
export const SCATTER_COLS = TREASURE_SCATTER_REELS;
export const SCATTER_TRIGGER = 3;

export const FS_WHEEL = {
  3: [10, 15, 20, 25, 30],
  4: [15, 20, 25, 30],
  5: [20, 25, 30],
  6: [25, 30],
};

export const SHIP_PRIZES = {
  1: { name: 'MINI', mult: 20 },
  2: { name: 'MINOR', mult: 50 },
  3: { name: 'MAJOR', mult: 100 },
  4: { name: 'GRAND', mult: 1000 },
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
  [1, 0, 1, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 2, 2, 0],
];

export const BASE_STRIPS = [
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 9, 2, 7, 3, 4, 0, 5, 10, 1, 6, 2],
  [0, 5, 1, 9, 6, 2, 7, 3, 8, 4, 0, 10, 5, 1, 6, 2, 7, 9, 3, 4, 0, 5, 1, 6],
  [0, 5, 1, 6, 9, 2, 7, 3, 8, 4, 0, 5, 1, 10, 6, 2, 7, 3, 9, 4, 0, 5, 1, 6],
  [0, 5, 1, 6, 2, 7, 9, 3, 8, 4, 0, 5, 1, 6, 2, 10, 7, 3, 4, 0, 5, 1, 6, 2],
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
];

export const ELEPHANT_SYMBOL = 6;
export const WARHORN_SYMBOL = 7;
export const MULT_WILD_TIERS = [1, 2, 3];
export const FS_BASE_ROWS = 3;
export const FS_MAX_ROWS = 6;

export const FS_STRIPS = [
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
  [0, 5, 1, 6, 2, 7, 3, 8, 4, 0, 5, 1, 6, 2, 7, 3, 4, 0, 5, 1, 6, 2, 7, 3],
];

export function lineBet(totalBet) {
  return Math.max(1, Math.round(totalBet / LINE_COUNT));
}

export function plantedWinRate() {
  return getMathProfile().plantedWinRate * 0.85;
}

export function naturalWinRate() {
  return getMathProfile().naturalWinRate;
}

export function winPayScale() {
  return getMathProfile().winPayMultiplier ?? 1;
}
