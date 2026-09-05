/**
 * Per-operator economy settings with safe defaults.
 */

/** @typedef {object} OperatorEconomy
 * @property {number} houseEdgePercent
 * @property {number} poolContributionPercent
 * @property {number} poolWinTriggerChance
 * @property {number} maxPoolWinMultiplier
 * @property {string} slotMathProfile
 * @property {number} lotteryHouseEdgePercent
 */

export const DEFAULT_ECONOMY = {
  houseEdgePercent: 3,
  poolContributionPercent: 35,
  poolWinTriggerChance: 0.06,
  maxPoolWinMultiplier: 25,
  slotMathProfile: 'voice_social',
  lotteryHouseEdgePercent: 5,
};

/** @param {object} [operator] */
export function getOperatorEconomy(operator) {
  const raw = operator?.economy ?? {};
  return {
    houseEdgePercent: clampPercent(raw.houseEdgePercent, DEFAULT_ECONOMY.houseEdgePercent),
    poolContributionPercent: clampPercent(raw.poolContributionPercent, DEFAULT_ECONOMY.poolContributionPercent),
    poolWinTriggerChance: clampRate(raw.poolWinTriggerChance, DEFAULT_ECONOMY.poolWinTriggerChance),
    maxPoolWinMultiplier: clampPositive(raw.maxPoolWinMultiplier, DEFAULT_ECONOMY.maxPoolWinMultiplier, 500),
    slotMathProfile: typeof raw.slotMathProfile === 'string' ? raw.slotMathProfile : DEFAULT_ECONOMY.slotMathProfile,
    lotteryHouseEdgePercent: clampPercent(raw.lotteryHouseEdgePercent, DEFAULT_ECONOMY.lotteryHouseEdgePercent),
  };
}

function clampPercent(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function clampRate(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function clampPositive(v, fallback, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}
