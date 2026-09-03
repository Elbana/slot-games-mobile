import { LINE_COUNT, winPayScale } from './config.mjs';
import { spinRoundStadium } from './reel-spin.mjs';
import { spinRoundStadiumFs } from './fs-reels.mjs';
import {
  createFreeSpinState,
  isInFreeSpins,
  queueFsIntro,
  commitFsIntro,
  resolveFreeSpinEnd,
} from './freespin.mjs';
import { buildCoinScatterInlineWin } from './coin-features.mjs';
import { flatToClientGrid } from './grid.mjs';
import { buildSpinEvents } from './events.mjs';

export function ensureFootballSession(session) {
  if (!session.footballFs) session.footballFs = createFreeSpinState();
  return session;
}

/**
 * @param {object} session
 * @param {number} bet
 * @param {{ spinId?: number|string, forceWin?: boolean, forceScatterCount?: number, forceCoinCount?: number }} [opts]
 */
export function applyFootballSpin(session, bet, opts = {}) {
  ensureFootballSession(session);
  const lines = LINE_COUNT;
  const inFs = isInFreeSpins(session);
  const charge = inFs ? 0 : bet;

  let round;
  let multDelta = 0;
  let fsEvents = [];
  let introScatterCount = 0;
  let introAward = 0;
  let introSymbol = null;
  let fsTriggered = false;

  if (inFs) {
    round = spinRoundStadiumFs(bet, lines, session.footballFs.fsReels, session.footballFs.expandingSymbols ?? []);
    fsEvents = round.fsEvents ?? [];
    multDelta = round.multDelta ?? 0;
  } else {
    round = spinRoundStadium(bet, lines, {
      forceWin: opts.forceWin === true || process.env.FOOTBALL_FORCE_WIN === '1',
      forceScatterCount: opts.forceScatterCount,
      forceCoinCount: opts.forceCoinCount,
    });
  }

  const fsTriggering = !inFs && round.treasureScatters >= 3;

  if (fsTriggering) {
    queueFsIntro(session, round.treasureScatters);
    introScatterCount = session.footballFs.introScatterCount;
    introAward = session.footballFs.introAward;
    introSymbol = session.footballFs.introSymbol;
    const intro = commitFsIntro(session);
    fsTriggered = true;
    introAward = intro.fsAwardAdded;
    introSymbol = intro.expandingSymbol ?? introSymbol;
  }

  if (!inFs && !fsTriggering && round.coinScatters >= 1) {
    const coinWin = buildCoinScatterInlineWin(round.coinScatters, bet);
    round.wins = [...round.wins, coinWin];
    round.winAmount += coinWin.coins;
  }

  const scaledWin =
    round.winAmount > 0 ? Math.max(1, Math.round(round.winAmount * winPayScale())) : 0;

  const preFsEnd = resolveFreeSpinEnd(session, {
    scatterCount: round.treasureScatters,
    roundWin: scaledWin,
    wasInFs: inFs,
    multDelta,
  });

  const { events } = buildSpinEvents(round, {
    reels: round.reels,
    wins: round.wins,
    treasureScatters: round.treasureScatters,
    coinScatters: round.coinScatters ?? 0,
    fsEvents,
    fsTriggered,
    fsRetriggered: preFsEnd.retriggered,
    fsAwardAdded: preFsEnd.fsAwardAdded,
    introScatterCount,
    introAward,
    introSymbol,
    freeSpinMultiplier: preFsEnd.freeSpinMultiplier,
    wasInFreeSpins: inFs,
  });

  session.balance = Math.max(0, session.balance - charge + scaledWin);

  const symbols = round.visible?.length
    ? flatToClientGrid(round.visible)
    : flatToClientGrid([]);

  const lineEv = events.find((e) => e.type === 'line_win');
  if (lineEv) {
    const coinEv = events.find((e) => e.type === 'coin_win');
    lineEv.totalWin = scaledWin - (coinEv?.pay ?? 0);
  }

  return {
    spinId: opts.spinId ?? Date.now(),
    symbols,
    win: scaledWin,
    balance: session.balance,
    bet: charge,
    events,
    state: {
      fsRemaining: preFsEnd.freeSpinsLeft,
      fsMultiplier: preFsEnd.freeSpinMultiplier,
      expandingSymbols: (session.footballFs?.expandingSymbols ?? []).map((s) => s),
    },
  };
}

export { isInFreeSpins };
