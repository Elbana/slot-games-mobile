import { LINE_COUNT } from './config.mjs';
import { spinRoundTot } from './reel-spin.mjs';
import { flatToClientGrid } from './grid.mjs';
import { buildSpinEvents } from './events.mjs';

/**
 * @param {object} session
 * @param {number} bet
 * @param {{ spinId?: number|string, forceWin?: boolean, forceCashCount?: number }} [opts]
 */
export function spinEgyptTreasures(session, bet, opts = {}) {
  const round = spinRoundTot(bet, LINE_COUNT, {
    forceWin: opts.forceWin === true || process.env.EGYPT_FORCE_WIN === '1',
    forceCashCount: opts.forceCashCount,
  });

  const { events, totalWin } = buildSpinEvents(round);
  session.balance = Math.max(0, session.balance - bet + totalWin);

  return {
    spinId: opts.spinId ?? Date.now(),
    symbols: flatToClientGrid(round.visible),
    win: totalWin,
    balance: session.balance,
    bet,
    events,
    state: {},
  };
}
