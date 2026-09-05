import { getMathProfile } from '../../math-profile.mjs';
export const COLS = 6;
export const ROWS = 5;
/** Minimum connected cluster size for a BLITZWAY win (paytable: 8+ symbols). */
export const MIN_CLUSTER = 8;

/**
 * Client gK enum:
 * LP1=0 … HP3=9, MULTIPLIER_PLACEHOLDER=10, SCATTER=11,
 * MULTIPLIER_HADES=12, MULTIPLIER_POSEIDON=13, MULTIPLIER_ZEUS=14
 */
export const SYMBOL = {
  LP1: 0,
  LP2: 1,
  LP3: 2,
  LP4: 3,
  MP1: 4,
  MP2: 5,
  MP3: 6,
  HP1: 7,
  HP2: 8,
  HP3: 9,
  MULTIPLIER_PLACEHOLDER: 10,
  SCATTER: 11,
  MULTIPLIER_HADES: 12,
  MULTIPLIER_POSEIDON: 13,
  MULTIPLIER_ZEUS: 14,
};

export const PAY_SYMBOL_MIN = SYMBOL.LP1;
export const PAY_SYMBOL_MAX = SYMBOL.HP3;

/** Client bronze / silver / gold thresholds (GameSymbol in bundle). */
export const MULTIPLIER_STAGES = [2, 3, 4, 5, 7, 8, 10, 12, 15, 20, 25, 50, 100, 500, 1000];
export const BRONZE_MULTIPLIER_STAGES = MULTIPLIER_STAGES.slice(0, 4);
export const SILVER_MULTIPLIER_STAGES = MULTIPLIER_STAGES.slice(4, 10);
export const GOLD_MULTIPLIER_STAGES = MULTIPLIER_STAGES.slice(10);

/**
 * Relative weights for pay symbols (LP1=0 … HP3=9).
 * Stones (LP1–LP4) dominate wins and grid fills like the commercial game.
 */
export const WIN_SYMBOL_WEIGHTS = [
  22, 22, 22, 22, // LP1–LP4 stones (~90% of planted wins)
  2, 2, 2, // MP1–MP3 bars (~6%)
  1, 1, 1, // HP1–HP3 (~3%)
];

/** Initial grid / cascade refill — stone-heavy board like the commercial game. */
export const GRID_SYMBOL_WEIGHTS = [
  18, 18, 18, 18, // LP1–LP4 stones (~89%)
  2, 2, 2, // MP1–MP3 (~6%)
  1, 1, 1, // HP1–HP3 (~3%)
];

function pickWeightedPaySymbol(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return PAY_SYMBOL_MIN + i;
  }
  return PAY_SYMBOL_MAX;
}

/**
 * Weighted pay symbol for demo boost, force-win, and natural seeded wins.
 * @param {number|null} [lastSymbol] — optional anti-repeat: avoid immediate same id (~75% re-roll).
 */
export function randomWinSymbol(lastSymbol = null) {
  let sym = pickWeightedPaySymbol(WIN_SYMBOL_WEIGHTS);
  if (
    lastSymbol != null &&
    lastSymbol >= PAY_SYMBOL_MIN &&
    lastSymbol <= PAY_SYMBOL_MAX &&
    sym === lastSymbol &&
    Math.random() < 0.75
  ) {
    const weights = [...WIN_SYMBOL_WEIGHTS];
    weights[lastSymbol - PAY_SYMBOL_MIN] = 0;
    sym = pickWeightedPaySymbol(weights);
  }
  return sym;
}

/** Per-cell land rate for god multiplier symbols (12–14) in random grids. */
export const MULTIPLIER_LAND_WEIGHT = 0.02;

/**
 * Per-cell scatter rate on the initial deal only (~0.12 scatters per 30-cell board).
 * Cascade tumble refills must not use this — see randomPaySymbolOrMultiplier().
 */
export const SCATTER_LAND_WEIGHT = 0.004;

/**
 * Rare FS trigger seed: place exactly FS_TRIGGER_MIN scatters after grid setup.
 */
export function scatterFsSeedRateForDeal() {
  return scatterFsSeedRate();
}

/** After a planted win cluster, tease 1–2 scatters on non-cluster cells for visibility. */
export const SCATTER_TEASE_RATE = 0.28;

/** Tease on non-win spins so scatters are visible even when demo boost misses. */
export const SCATTER_LOSE_TEASE_RATE = 0.15;
export const SCATTER_TEASE_MAX = 2;

/** Value assigned when a multiplier symbol first lands. */
export const INITIAL_MULTIPLIER_VALUE = BRONZE_MULTIPLIER_STAGES[0];

export function isMultiplierSymbol(sym) {
  return (
    sym === SYMBOL.MULTIPLIER_PLACEHOLDER ||
    sym === SYMBOL.MULTIPLIER_HADES ||
    sym === SYMBOL.MULTIPLIER_POSEIDON ||
    sym === SYMBOL.MULTIPLIER_ZEUS
  );
}

/** Random paying symbol or weighted god multiplier — no scatter (cascade refills, force-win filler). */
export function randomPaySymbolOrMultiplier() {
  if (Math.random() < MULTIPLIER_LAND_WEIGHT) {
    const gods = [SYMBOL.MULTIPLIER_HADES, SYMBOL.MULTIPLIER_POSEIDON, SYMBOL.MULTIPLIER_ZEUS];
    return gods[Math.floor(Math.random() * gods.length)];
  }
  return pickWeightedPaySymbol(GRID_SYMBOL_WEIGHTS);
}

/** Initial grid deal — rare scatter + paying/multiplier symbols. */
export function randomInitialGridSymbol() {
  if (Math.random() < SCATTER_LAND_WEIGHT) return SYMBOL.SCATTER;
  return randomPaySymbolOrMultiplier();
}

/** @deprecated Use randomInitialGridSymbol or randomPaySymbolOrMultiplier explicitly. */
export function randomGridSymbol() {
  return randomInitialGridSymbol();
}

/**
 * Paytable coin values per symbol tier (GamePaytableModel in client bundle).
 * Index 0 = 12+ symbols, … index 4 = 8 symbols.
 */
export const PAYTABLE = {
  0: [9, 6, 4, 3, 1],
  1: [9, 6, 4, 3, 1],
  2: [12, 8, 6, 4, 2],
  3: [12, 8, 6, 4, 2],
  4: [18, 12, 9, 5, 3],
  5: [18, 12, 9, 5, 3],
  6: [25, 16, 12, 6, 4],
  7: [35, 24, 16, 8, 5],
  8: [55, 34, 22, 12, 6],
  9: [90, 50, 34, 16, 8],
};

export const DEFAULT_BALANCE = 2_500_000;
export const DEFAULT_BET = 20;
export const DEFAULT_LINES = 20;
export const DEFAULT_DENOM = 1;

/** Planted win rate — from shared social math profile (default ~30%). */
export function plantedWinRate() {
  return getMathProfile().plantedWinRate;
}

/** Organic seeded win when planted roll misses. */
export function naturalWinRate() {
  return getMathProfile().naturalWinRate;
}

/** FS seed rate on initial deal — slightly higher in social mode for engagement. */
export function scatterFsSeedRate() {
  return getMathProfile().scatterFsSeedRate;
}

/**
 * Social win boost — always on unless ROO_DEMO_WIN_BOOST=0 or MATH_PROFILE=stingy.
 * ROO_FORCE_WIN=1 forces every spin (dev/testing only).
 */
export function isDemoWinBoostEnabled() {
  if (process.env.ROO_FORCE_WIN === '1' || process.env.THRONES_FORCE_WIN === '1') return true;
  const v = process.env.ROO_DEMO_WIN_BOOST;
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return process.env.MATH_PROFILE !== 'stingy';
}

/** @deprecated use plantedWinRate() */
export const DEMO_WIN_BOOST = 0.3;

/** @deprecated use naturalWinRate() */
export const NATURAL_WIN_RATE = 0.06;

/** Startup log line describing active win mode. */
export function describeWinBoostMode() {
  if (process.env.ROO_FORCE_WIN === '1' || process.env.THRONES_FORCE_WIN === '1') {
    return 'win mode: FORCE_WIN (100% planted wins — dev only)';
  }
  if (!isDemoWinBoostEnabled()) {
    return `win mode: stingy (~${Math.round(naturalWinRate() * 100)}% natural wins)`;
  }
  const p = getMathProfile();
  return `win mode: ${process.env.MATH_PROFILE || 'social'} (~${Math.round(plantedWinRate() * 100)}% planted, target RTP ${p.rtpTarget})`;
}

/** Map cluster size (8–12+) to PAYTABLE tier index. */
export function payTierIndex(size) {
  if (size >= 12) return 0;
  if (size === 11) return 1;
  if (size === 10) return 2;
  if (size === 9) return 3;
  return 4;
}

/** Coin payout for a winning cluster (matches client PaytableModel × coins). */
export function clusterPayCoins(symbol, size, coins = 1) {
  const tiers = PAYTABLE[symbol];
  if (!tiers) return 0;
  const c = Math.max(1, coins | 0);
  const scale = getMathProfile().winPayMultiplier ?? 1;
  return Math.max(1, Math.round(tiers[payTierIndex(size)] * c * scale));
}
