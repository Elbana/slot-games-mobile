import { COLS, ROWS, SYMBOL } from './config.mjs';
import { spinRooRound } from './spin-round.mjs';
import {
  createFreeSpinState,
  effectiveBet,
  ensureFreeSpinState,
  resolveFreeSpinEnd,
} from './freespin.mjs';
import { extractGridMultipliers, sumMultipliers } from './grid.mjs';

/** Server grid[row][col] → client symbols[col][row] */
export function toClientGrid(grid) {
  const out = [];
  for (let c = 0; c < COLS; c++) {
    out[c] = [];
    for (let r = 0; r < ROWS; r++) {
      out[c][r] = grid[r][c];
    }
  }
  return out;
}

/** Column-major flat index → [col, row] for client animations */
export function flatToClientPos(idx) {
  const row = idx % ROWS;
  const col = Math.floor(idx / ROWS);
  return [col, row];
}

function landEvents(lands) {
  return (lands ?? []).map((land) => ({
    type: 'multiplier_land',
    godId: land.godId,
    value: land.value,
    col: land.col,
    row: land.row,
  }));
}

/** Server grid → client scatter cell positions */
export function scatterPositions(grid) {
  /** @type {[number, number][]} */
  const out = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === SYMBOL.SCATTER) out.push([col, row]);
    }
  }
  return out;
}

function buildEvents(round, { totalWin, fsAwardAdded, fsEnded, fsSessionTotalWin }) {
  /** @type {object[]} */
  const events = [];

  events.push({
    type: 'deal',
    grid: toClientGrid(round.grid),
    multipliers: round.multipliers,
    multiplierSum: round.sumMulti,
    scatterCount: round.scatterCount,
    scatterPositions: scatterPositions(round.grid),
  });

  events.push(...landEvents(round.initialLandedMultipliers));

  for (const step of round.steps) {
    events.push({
      type: 'cluster_win',
      wins: step.wins.map((w) => ({
        symbol: w.symbol,
        pay: w.pay,
        positions: w.positions.map(flatToClientPos),
      })),
      grid: toClientGrid(step.grid),
      multipliers: step.multipliers,
      multiplierSum: step.sumMulti ?? 0,
    });
    events.push(...landEvents(step.landedMultipliers));
    for (const up of step.multiplierUpgrades ?? []) {
      events.push({
        type: 'multiplier_upgrade',
        col: up.col,
        row: up.row,
        value: up.value,
        super: up.super ?? false,
      });
    }
  }

  if (round.finalSumMulti > 0 && round.baseWin > 0) {
    events.push({
      type: 'multiplier_apply',
      sum: round.finalSumMulti,
      baseWin: round.baseWin,
      totalWin,
    });
  }

  if (fsAwardAdded > 0) {
    events.push({ type: 'free_spins_awarded', count: fsAwardAdded });
  }

  if (round.scatterCount >= 3) {
    events.push({
      type: 'scatter_show',
      count: round.scatterCount,
      positions: scatterPositions(round.grid),
    });
  }

  if (fsEnded && fsSessionTotalWin > 0) {
    events.push({ type: 'free_spins_end', totalWin: fsSessionTotalWin });
  }

  return events;
}

/**
 * @param {object} session
 * @param {number} bet
 * @param {{ forceWin?: boolean, spinId?: number }} [opts]
 */
export function spinThronesOfOlympus(session, bet, opts = {}) {
  ensureFreeSpinState(session);
  const fs = session.thronesFs;
  const inFreeSpins = fs.freeSpinsLeft > 0;
  const charge = effectiveBet(session, bet);
  const baseBet = session.bet || bet;
  const goUltra =
    bet > baseBet * 1.25 ||
    fs.goUltra === true ||
    process.env.ROO_GO_ULTRA === '1';

  const prevFsMulti = fs.freeSpinMultiplier ?? 0;
  session.thronesFs.goUltra = goUltra;

  const round = spinRooRound(bet, {
    forceWin: opts.forceWin === true || process.env.THRONES_FORCE_WIN === '1',
    goUltra,
    inFreeSpins,
    fsMulti: fs.freeSpinMultiplier ?? 0,
    lastWinSymbol: session.thronesLastWin ?? null,
  });
  round.inFreeSpins = inFreeSpins;

  if (round.primaryWinSymbol != null) {
    session.thronesLastWin = round.primaryWinSymbol;
  }

  const spinId = opts.spinId ?? Date.now();
  const fsResult = resolveFreeSpinEnd(session, {
    scatterCount: round.scatterCount,
    roundWin: round.winAmount,
    fsMulti: round.fsMulti,
    spinId,
  });

  session.balance = Math.max(0, session.balance - charge + round.winAmount);

  const events = buildEvents(round, {
    totalWin: round.winAmount,
    fsAwardAdded: fsResult.fsAwardAdded,
    fsEnded: fsResult.fsEnded === true,
    fsSessionTotalWin: fsResult.fsSessionTotalWin ?? 0,
  });

  if (fsResult.triggered && !inFreeSpins) {
    session.thronesFs.freeSpinMultiplier = 1;
    events.push({ type: 'fs_multiplier_update', value: 1 });
  } else if (inFreeSpins && round.fsMulti > prevFsMulti) {
    events.push({ type: 'fs_multiplier_update', value: round.fsMulti });
  }

  return {
    spinId,
    symbols: toClientGrid(round.finalGrid),
    initialSymbols: toClientGrid(round.grid),
    win: round.winAmount,
    balance: session.balance,
    bet: charge,
    events,
    state: {
      fsRemaining: fsResult.freeSpinsLeft,
      fsMultiplier: fsResult.freeSpinMultiplier,
      multiplierSum: round.finalSumMulti,
      goUltra,
    },
  };
}

export { runCascadeRound, findClusters } from './cascade.mjs';
