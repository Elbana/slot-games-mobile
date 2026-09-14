/**
 * Platform-wide payout caps — prevent runaway multipliers and max-win exploits.
 * Target: social casino ~88–92% RTP, no routine 100×+ outcomes.
 */

/** @typedef {'rocket' | 'lottery' | 'slot' | 'pvp'} PayoutGameKind */

/** @type {Record<PayoutGameKind, { maxWinBetMultiple: number, maxMultiplier?: number, houseEdge?: number, maxGridMultiplierSum?: number, maxFsAccumulator?: number }>} */
export const PAYOUT_LIMITS = {
  rocket: {
    maxMultiplier: 50,
    houseEdge: 0.1,
    maxWinBetMultiple: 50,
  },
  lottery: {
    maxWinBetMultiple: 25,
  },
  slot: {
    maxWinBetMultiple: 100,
    maxGridMultiplierSum: 50,
    maxFsAccumulator: 25,
  },
  pvp: {
    maxWinBetMultiple: 5,
  },
};

/**
 * Cap a win amount relative to the triggering bet.
 * @param {number} bet
 * @param {number} win
 * @param {number} maxBetMultiple
 */
export function capWinByBet(bet, win, maxBetMultiple) {
  const stake = Math.floor(Number(bet)) || 0;
  const payout = Math.floor(Number(win)) || 0;
  if (stake <= 0 || payout <= 0) return payout;
  return Math.min(payout, stake * maxBetMultiple);
}

/**
 * @param {number} mult
 * @param {number} maxMult
 */
export function capMultiplier(mult, maxMult) {
  const m = Number(mult);
  if (!Number.isFinite(m)) return 1;
  return Math.min(maxMult, Math.max(1, Math.round(m * 100) / 100));
}
