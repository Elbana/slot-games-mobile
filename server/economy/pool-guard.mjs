/**
 * Pool-aware outcome guards — never pay more than the pool can afford.
 */

import { loadPool } from './prize-pool.mjs';
import { getGameEconomy, POOL_RULES } from './game-economy.mjs';
import { capMultiplier } from './payout-limits.mjs';
import { secureRandom } from './secure-rng.mjs';

/**
 * @param {object} operator
 * @param {string} gameSlug
 */
export function getPoolBalance(operator, gameSlug) {
  return loadPool(operator.id, gameSlug).poolBalance;
}

/**
 * Max total payout affordable from pool this round.
 * @param {object} operator
 * @param {string} gameSlug
 */
export function maxAffordablePayout(operator, gameSlug) {
  const balance = getPoolBalance(operator, gameSlug);
  if (balance <= POOL_RULES.poolReserveFloor) return 0;
  const usable = balance - POOL_RULES.poolReserveFloor;
  return Math.floor(usable * POOL_RULES.maxPoolPayoutRatio);
}

/**
 * Whether a high-multiplier outcome is allowed given current pool.
 * @param {object} operator
 * @param {string} gameSlug
 * @param {number} [minPoolOverride]
 */
export function poolAllowsJackpot(operator, gameSlug, minPoolOverride) {
  const minPool = minPoolOverride ?? POOL_RULES.minPoolForJackpot;
  return getPoolBalance(operator, gameSlug) >= minPool;
}

/**
 * Cap rocket crash point based on pool + round bet volume.
 * @param {{ operator: object, totalRoundBets: number, rawCrash: number, gameSlug?: string }} opts
 */
export function capRocketCrash({ operator, totalRoundBets, rawCrash, gameSlug = 'rocket-rush' }) {
  const econ = getGameEconomy(gameSlug);
  const pool = getPoolBalance(operator, gameSlug);
  let maxCrash = econ.highPoolMaxCrash ?? econ.maxMultiplier ?? 50;

  if (pool < POOL_RULES.minPoolForNormalPlay) {
    maxCrash = Math.min(maxCrash, econ.lowPoolMaxCrash ?? 3);
  } else if (pool < (econ.highOutcomeMinPool ?? POOL_RULES.minPoolForJackpot)) {
    maxCrash = Math.min(maxCrash, econ.lowPoolMaxCrash ?? 4);
  }

  if (totalRoundBets > 0) {
    const affordable = maxAffordablePayout(operator, gameSlug);
    if (affordable <= 0) {
      maxCrash = Math.min(maxCrash, 1.2 + secureRandom() * 0.35);
    } else {
      const poolCap = affordable / totalRoundBets;
      maxCrash = Math.min(maxCrash, Math.max(1.15, poolCap));
    }
  }

  return capMultiplier(rawCrash, maxCrash);
}

/**
 * Generate crash multiplier with house edge + pool cap.
 * @param {{ operator: object, totalRoundBets: number, houseEdge?: number, maxMultiplier?: number }} opts
 */
export function generatePoolAwareCrashPoint(opts) {
  const houseEdge = opts.houseEdge ?? 0.1;
  const hardMax = opts.maxMultiplier ?? 50;
  const r = secureRandom();
  let raw;
  if (r < houseEdge) {
    raw = 1 + secureRandom() * 0.35;
  } else {
    raw = (1 - houseEdge) / (1 - r);
  }
  raw = capMultiplier(raw, hardMax);
  return capRocketCrash({
    operator: opts.operator,
    totalRoundBets: opts.totalRoundBets,
    rawCrash: raw,
  });
}

/**
 * Filter lottery symbols — remove high-odd symbols when pool is unfunded.
 * @param {object[]} symbols — items with `.odd`
 * @param {object} operator
 * @param {string} gameSlug
 */
/** @type {Map<string, object>} */
const activeOperatorByGame = new Map();

/** Track last operator active on a game (used for shared-room draw gating). */
export function touchActiveOperator(gameSlug, operator) {
  if (operator?.id) activeOperatorByGame.set(gameSlug, operator);
}

/** @param {string} gameSlug */
export function getActiveOperator(gameSlug) {
  return activeOperatorByGame.get(gameSlug) ?? null;
}

export function filterSymbolsByPool(symbols, operator, gameSlug) {
  const econ = getGameEconomy(gameSlug);
  const threshold = econ.highOutcomeOdd ?? 15;
  const minPool = econ.highOutcomeMinPool ?? POOL_RULES.minPoolForJackpot;
  if (poolAllowsJackpot(operator, gameSlug, minPool)) return symbols;
  return symbols.filter((s) => (s.odd ?? 1) < threshold);
}
