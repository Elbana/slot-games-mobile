/**
 * Pool-aware outcome guards — never pay more than the pool can afford.
 */

import { loadPool } from './prize-pool.mjs';
import { getGameEconomy, POOL_RULES } from './game-economy.mjs';
import { capMultiplier, capWinByBet } from './payout-limits.mjs';
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

/** @param {object[]} roundBets */
function uniqueOperators(roundBets) {
  return [...new Map(
    roundBets.filter((b) => b.operator?.id).map((b) => [b.operator.id, b.operator]),
  ).values()];
}

/**
 * Pick a shared-room outcome weighted by base odds but constrained by prize pool.
 * Falls back to the lowest-liability outcome when the pool cannot fund winners.
 *
 * @param {{
 *   candidates: { key: string, weight: number }[],
 *   roundBets: object[],
 *   gameSlug: string,
 *   calcPayout: (outcomeKey: string, bets: object[]) => number,
 * }} opts
 * @returns {string}
 */
export function pickPoolAwareOutcome({ candidates, roundBets, gameSlug, calcPayout }) {
  if (!candidates.length) return 'draw';

  const payoutTotal = (key) => calcPayout(key, roundBets);

  const isAffordable = (key) => {
    const operators = uniqueOperators(roundBets);
    if (!operators.length) return true;
    return operators.every((op) => {
      const opBets = roundBets.filter((b) => b.operator?.id === op.id);
      const payout = calcPayout(key, opBets);
      return payout <= maxAffordablePayout(op, gameSlug);
    });
  };

  let pool = candidates.filter((c) => isAffordable(c.key));
  if (!pool.length) {
    const minPayout = Math.min(...candidates.map((c) => payoutTotal(c.key)));
    pool = candidates.filter((c) => payoutTotal(c.key) === minPayout);
  }

  const weightSum = pool.reduce((s, c) => s + Math.max(0, c.weight), 0);
  if (weightSum <= 0) return pool[0].key;

  let r = secureRandom() * weightSum;
  for (const c of pool) {
    r -= Math.max(0, c.weight);
    if (r <= 0) return c.key;
  }
  return pool.at(-1).key;
}

/**
 * Drop high-payout outcomes (e.g. draw) when jackpot pool is not funded.
 * @param {{ key: string, weight: number, highPayout?: boolean }[]} candidates
 * @param {object[]} roundBets
 * @param {string} gameSlug
 */
/**
 * Cap slot / lottery wins so payout never exceeds affordable pool share.
 * When the jackpot pool is unfunded, big wins are clamped to `bigWinBetMultiple`.
 *
 * @param {{ operator: object, gameSlug: string, bet: number, win: number }} opts
 */
export function capWinByPool({ operator, gameSlug, bet, win }) {
  const econ = getGameEconomy(gameSlug);
  const stake = Math.max(0, Math.floor(Number(bet)) || 0);
  let capped = Math.max(0, Math.floor(Number(win)) || 0);
  if (capped <= 0 || stake <= 0) return capped;

  const minPool = econ.bigWinMinPool ?? POOL_RULES.minPoolForJackpot;
  if (!poolAllowsJackpot(operator, gameSlug, minPool)) {
    const bigCap = econ.bigWinBetMultiple ?? 20;
    capped = capWinByBet(stake, capped, bigCap);
  }

  const affordable = maxAffordablePayout(operator, gameSlug);
  if (affordable >= 0 && capped > affordable) {
    capped = Math.min(capped, affordable);
  }

  return Math.max(0, Math.floor(capped));
}

export function gateJackpotOutcomes(candidates, roundBets, gameSlug) {
  const operators = uniqueOperators(roundBets);
  if (!operators.length) return candidates;

  const minPool = getGameEconomy(gameSlug).highOutcomeMinPool ?? POOL_RULES.minPoolForJackpot;
  const jackpotOk = operators.every((op) => poolAllowsJackpot(op, gameSlug, minPool));
  if (jackpotOk) return candidates;

  const filtered = candidates.filter((c) => !c.highPayout);
  return filtered.length ? filtered : candidates;
}
