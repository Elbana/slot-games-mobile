/** Lucky 77 — Lemon and Watermelon are mutually exclusive; 77 pairs with either. */

export const LUCK77_FRUIT = {
  LEMON: 'LUCK77_LEMON',
  MELON: 'LUCK77_WATERMELON',
  SEVEN: 'LUCK77_SEVEN',
};

export const LUCK77_COMBO_TOAST = 'You can only pick one fruit.';

/** @param {Record<string, number>} stakes */
function fruitStakes(stakes) {
  return {
    lemon: (stakes[LUCK77_FRUIT.LEMON] || 0) > 0,
    melon: (stakes[LUCK77_FRUIT.MELON] || 0) > 0,
  };
}

/** @param {Record<string, number>} stakes @param {string} playCode */
export function canBetLucky77(stakes, playCode) {
  const { lemon, melon } = fruitStakes(stakes);
  if (playCode === LUCK77_FRUIT.LEMON) return !melon;
  if (playCode === LUCK77_FRUIT.MELON) return !lemon;
  return true;
}

/** @param {Record<string, number>} stakes @param {string} playCode */
export function lucky77BetMessage(stakes, playCode) {
  return canBetLucky77(stakes, playCode) ? null : LUCK77_COMBO_TOAST;
}

/**
 * Server-side check against period bet map.
 * @param {string} sessionId
 * @param {string} playCode
 * @param {Map<string, number>} periodBets
 * @param {(sessionId: string, playCode: string) => string} betKey
 */
export function validateLucky77PlaceBet(sessionId, playCode, periodBets, betKey) {
  const stakes = {};
  for (const code of Object.values(LUCK77_FRUIT)) {
    const amt = periodBets.get(betKey(sessionId, code));
    if (amt) stakes[code] = amt;
  }
  const msg = lucky77BetMessage(stakes, playCode);
  if (msg) return { ok: false, message: msg };
  return { ok: true };
}
