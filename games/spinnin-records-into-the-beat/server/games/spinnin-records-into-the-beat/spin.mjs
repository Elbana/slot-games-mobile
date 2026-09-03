import { applyFootballSpin } from './spin-round.mjs';

/**
 * @param {object} session
 * @param {number} bet
 * @param {{ spinId?: number|string, forceWin?: boolean, forceScatterCount?: number, forceCoinCount?: number }} [opts]
 */
export function spinFootballGold(session, bet, opts = {}) {
  return applyFootballSpin(session, bet, opts);
}
