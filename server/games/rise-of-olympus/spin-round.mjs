import { DEFAULT_BET, DEFAULT_LINES, DEFAULT_DENOM } from './config.mjs';
import { runCascadeRound } from './cascade.mjs';
import { extractGridMultipliers, sumMultipliers, dominantGodId } from './grid.mjs';
import { countScatters } from './freespin.mjs';

/** One Rise of Olympus round — cascade steps + protocol fields. */
export function spinRooRound(bet, opts = {}) {
  const forceWin =
    opts.forceWin === true ||
    process.env.ROO_FORCE_WIN === '1' ||
    process.env.THRONES_FORCE_WIN === '1';
  const goUltra = opts.goUltra === true || process.env.ROO_GO_ULTRA === '1';
  const inFreeSpins = opts.inFreeSpins === true;
  const fsMultiIn = opts.fsMulti ?? 0;
  const lines = opts.lines ?? DEFAULT_LINES;
  const denom = opts.denom ?? DEFAULT_DENOM;
  const coins =
    opts.coins ??
    (Number.isFinite(opts.lines) && Number.isFinite(opts.denom) && opts.lines * opts.denom > 0
      ? Math.max(1, Math.round(bet / (opts.lines * opts.denom)))
      : Math.max(1, Math.round(bet / (DEFAULT_LINES * DEFAULT_DENOM))));

  const { initialGrid, initialMultValues, initialLandedMultipliers, steps, totalWin: roundTotalWin, baseWin, multipliers, sumMulti, grid, scatterSeed, scatterTease, primaryWinSymbol } =
    runCascadeRound(bet, {
      forceWin,
      goUltra,
      coins,
      lastWinSymbol: opts.lastWinSymbol ?? null,
    });

  const initialMultipliers = extractGridMultipliers(initialGrid, initialMultValues);
  const initialSumMulti = sumMultipliers(initialMultipliers);
  const scatterCount = countScatters(initialGrid);

  let winAmount = roundTotalWin;
  if (inFreeSpins && baseWin > 0) {
    const fsTotalMulti = Math.max(1, fsMultiIn + (sumMulti > 0 ? sumMulti : 0));
    winAmount = baseWin * fsTotalMulti;
  }

  let fsMulti = fsMultiIn;
  if (inFreeSpins && baseWin > 0 && sumMulti > 0) {
    fsMulti = fsMultiIn + sumMulti;
  } else if (inFreeSpins && baseWin > 0 && fsMultiIn > 0) {
    fsMulti = fsMultiIn;
  }

  return {
    grid: initialGrid,
    finalGrid: grid,
    steps,
    winAmount,
    baseWin,
    bet,
    coins,
    lines,
    denom,
    multipliers: initialMultipliers,
    sumMulti: initialSumMulti,
    finalMultipliers: multipliers,
    finalSumMulti: sumMulti,
    fsMulti,
    scatterCount,
    scatterSeed,
    scatterTease,
    goUltra,
    primaryWinSymbol,
    initialLandedMultipliers,
    initialLand:
      initialLandedMultipliers.length > 0
        ? {
            values: initialLandedMultipliers.map((m) => m.value),
            godId: initialLandedMultipliers[0].godId ?? dominantGodId(initialGrid),
          }
        : null,
  };
}

export function applyRooSpin(session, bet, opts = {}) {
  const fs = session.rooFs ?? {};
  const inFreeSpins = (fs.freeSpinsLeft ?? 0) > 0;
  const baseBet = session.bet || DEFAULT_BET;
  const goUltra =
    opts.goUltra === true ||
    process.env.ROO_GO_ULTRA === '1' ||
    (bet > 0 && bet > baseBet * 1.25);
  if (bet > 0) session.rooFs = { ...fs, goUltra };

  const round = spinRooRound(bet, {
    ...opts,
    inFreeSpins,
    fsMulti: fs.freeSpinMultiplier ?? 0,
    goUltra: fs.goUltra ?? false,
    lastWinSymbol: session.rooLastWinSymbol ?? null,
  });

  if (round.primaryWinSymbol != null) {
    session.rooLastWinSymbol = round.primaryWinSymbol;
  }

  const charge = (fs.freeSpinsLeft ?? 0) > 0 ? 0 : bet;
  session.balance = Math.max(0, session.balance - charge + round.winAmount);

  return {
    win: round.winAmount > 0,
    bet,
    winAmount: round.winAmount,
    baseWin: round.baseWin,
    balance: session.balance,
    grid: round.grid,
    cascadeSteps: round.steps,
    multipliers: round.multipliers,
    sumMulti: round.sumMulti,
    finalMultipliers: round.finalMultipliers,
    finalSumMulti: round.finalSumMulti,
    fsMulti: round.fsMulti,
    scatterCount: round.scatterCount,
    scatterSeed: round.scatterSeed,
    scatterTease: round.scatterTease,
    coins: round.coins,
    lines: round.lines,
    denom: round.denom,
    initialLand: round.initialLand,
    clusters: round.steps.flatMap((s) => s.wins),
  };
}
