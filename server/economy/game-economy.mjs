/**
 * Central economy config for all six live games.
 * Tune RTP, pool thresholds, and per-game odds here — engines read these values.
 */

/** @typedef {'luck-77' | 'greedy-feast' | 'dice-duel' | 'goal-clash' | 'rocket-rush' | 'olympus-rise'} GameSlug */

/** Shared pool / jackpot rules applied to every game unless overridden. */
export const POOL_RULES = {
  /** Minimum pool balance before high-multiplier / jackpot outcomes are allowed. */
  minPoolForJackpot: 50_000,
  /** Below this pool, tighten payouts aggressively. */
  minPoolForNormalPlay: 5_000,
  /** Never pay more than this fraction of current pool in a single round settlement. */
  maxPoolPayoutRatio: 0.35,
  /** Reserve — pool must stay above this after a big win. */
  poolReserveFloor: 1_000,
};

/**
 * Per-game economy profile.
 * @type {Record<GameSlug, object>}
 */
export const GAME_ECONOMY = {
  'luck-77': {
    targetRtpPercent: 90,
    /** 8× Luck 77 symbol — gated when pool is low. */
    highOutcomeOdd: 8,
    highOutcomeMinPool: POOL_RULES.minPoolForJackpot,
    maxWinBetMultiple: 25,
  },
  'greedy-feast': {
    targetRtpPercent: 91,
    /** Symbols at or above this odd require a funded pool. */
    highOutcomeOdd: 15,
    highOutcomeMinPool: POOL_RULES.minPoolForJackpot,
    maxWinBetMultiple: 25,
  },
  'dice-duel': {
    targetRtpPercent: 88,
    teamWinMult: 1.95,
    drawMult: 3.5,
    teamWinProb: 0.45,
    drawProb: 0.1,
    maxWinBetMultiple: 5,
  },
  'goal-clash': {
    targetRtpPercent: 86,
    sideWinMult: 2.05,
    drawMult: 3.2,
    homeWinProb: 0.42,
    awayWinProb: 0.38,
    drawProb: 0.2,
    maxWinBetMultiple: 5,
  },
  'rocket-rush': {
    targetRtpPercent: 90,
    houseEdge: 0.1,
    maxMultiplier: 50,
    maxWinBetMultiple: 50,
    /** When pool is below minPoolForJackpot, crash cannot exceed this. */
    lowPoolMaxCrash: 4,
    /** When pool is healthy, crash can reach this before hard cap. */
    highPoolMaxCrash: 50,
    /** Pool must cover this multiple × round bet volume for high crashes. */
    highCrashBetCoverage: 8,
  },
  'olympus-rise': {
    targetRtpPercent: 94,
    maxWinBetMultiple: 100,
    bigWinBetMultiple: 20,
    bigWinMinPool: POOL_RULES.minPoolForJackpot,
  },
};

/** @param {GameSlug | string} slug */
export function getGameEconomy(slug) {
  return GAME_ECONOMY[slug] ?? {};
}

/** All slugs that participate in the prize pool ledger. */
export const POOLED_GAMES = /** @type {GameSlug[]} */ ([
  'luck-77',
  'greedy-feast',
  'dice-duel',
  'goal-clash',
  'rocket-rush',
  'olympus-rise',
]);
