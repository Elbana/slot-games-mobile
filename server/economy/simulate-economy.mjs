/**
 * Monte Carlo economy simulation for all six live games.
 * Verifies prize pools never go negative and reports RTP vs targets.
 *
 * Usage: node server/economy/simulate-economy.mjs [--rounds=10000] [--bet=1000]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GAME_ECONOMY, POOLED_GAMES } from './game-economy.mjs';
import { DEFAULT_ECONOMY } from './operator-economy.mjs';
import { recordRound, tryPoolWin, loadPool } from './prize-pool.mjs';
import {
  capWinByPool,
  capRocketCrash,
  filterSymbolsByPool,
  gateJackpotOutcomes,
  pickPoolAwareOutcome,
  poolAllowsJackpot,
} from './pool-guard.mjs';
import { capWinByBet, capMultiplier, PAYOUT_LIMITS } from './payout-limits.mjs';
import { secureRandom, secureRandomInt } from './secure-rng.mjs';
import { runWithMathProfile } from '../math-profile.mjs';
import { LUCK77_SYMBOLS, LUCK77_WHEEL_STOPS } from '../games/lucky77/config.mjs';
import { GREEDY_SYMBOLS } from '../games/greedy/config.mjs';
import { DICE_DUAL_GAME } from '../games/dice-dual/config.mjs';
import { FOOTBALL_CLASH_GAME } from '../games/football-clash/config.mjs';
import { ROCKET_GAME } from '../games/rocket/config.mjs';
import { generateCrashPoint } from '../games/rocket/engine.mjs';
import { spinRooRound } from '../games/rise-of-olympus/spin-round.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @param {string[]} argv */
function parseArgs(argv) {
  const opts = { rounds: 10_000, bet: 1000 };
  for (const arg of argv) {
    const m = arg.match(/^--(\w+)=(.+)$/);
    if (!m) continue;
    if (m[1] === 'rounds') opts.rounds = Math.max(100, parseInt(m[2], 10) || opts.rounds);
    if (m[1] === 'bet') opts.bet = Math.max(1, parseInt(m[2], 10) || opts.bet);
  }
  return opts;
}

/** @param {import('./game-economy.mjs').GameSlug} slug */
function targetRtp(slug) {
  return GAME_ECONOMY[slug]?.targetRtpPercent ?? 90;
}

/** @param {{ playCode: string, odd: number, group?: string[] }[]} symbols */
function buildLotteryWeights(symbols) {
  const singles = symbols.filter((s) => !s.group?.length);
  const pool = singles.length ? singles : symbols;
  const total = pool.reduce((sum, s) => sum + 1 / s.odd, 0);
  return pool.map((s) => ({ playCode: s.playCode, weight: (1 / s.odd) / total, odd: s.odd }));
}

/** @param {{ playCode: string, weight: number }[]} weights */
function weightedPick(weights) {
  let r = secureRandom();
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.playCode;
  }
  return weights.at(-1).playCode;
}

/** @param {object} operator @param {string} slug @param {object[]} symbols @param {number} bet @param {number} rounds */
function simulateLottery(operator, slug, symbols, bet, rounds) {
  let totalBet = 0;
  let totalPaid = 0;
  let minPool = Infinity;

  const playable = symbols.filter((s) => !s.group?.length);

  for (let i = 0; i < rounds; i++) {
    const pick = playable[secureRandomInt(0, playable.length - 1)];
    totalBet += bet;

    const allowed = filterSymbolsByPool(symbols, operator, slug);
    const weights = buildLotteryWeights(allowed);
    const resultCode = weightedPick(weights);

    let baseWin = 0;
    if (resultCode === pick.playCode) {
      baseWin = capWinByBet(bet, Math.floor(bet * pick.odd), PAYOUT_LIMITS.lottery.maxWinBetMultiple);
    }

    recordRound({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    const { poolWin } = tryPoolWin({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    totalPaid += baseWin + poolWin;

    const pool = loadPool(operator.id, slug).poolBalance;
    minPool = Math.min(minPool, pool);
    if (pool < 0) throw new Error(`${slug}: pool went negative at round ${i + 1}`);
  }

  return { totalBet, totalPaid, minPool, rtp: (totalPaid / totalBet) * 100 };
}

/** Luck 77 wheel draw — respects pool gating on the 8× stop. */
function simulateLuck77(operator, bet, rounds) {
  let totalBet = 0;
  let totalPaid = 0;
  let minPool = Infinity;
  const slug = 'luck-77';
  const highCode = LUCK77_SYMBOLS.find((s) => s.odd >= 8)?.playCode;

  for (let i = 0; i < rounds; i++) {
    const pick = LUCK77_SYMBOLS[secureRandomInt(0, LUCK77_SYMBOLS.length - 1)];
    totalBet += bet;

    let eligible = LUCK77_WHEEL_STOPS.map((_, i) => i);
    if (highCode && !poolAllowsJackpot(operator, slug)) {
      eligible = eligible.filter((i) => LUCK77_WHEEL_STOPS[i] !== highCode);
    }
    const stopIdx = eligible[secureRandomInt(0, eligible.length - 1)];
    const resultCode = LUCK77_WHEEL_STOPS[stopIdx];

    let baseWin = 0;
    if (resultCode === pick.playCode) {
      baseWin = capWinByBet(bet, Math.floor(bet * pick.odd), PAYOUT_LIMITS.lottery.maxWinBetMultiple);
    }

    recordRound({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    const { poolWin } = tryPoolWin({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    totalPaid += baseWin + poolWin;

    const pool = loadPool(operator.id, slug).poolBalance;
    minPool = Math.min(minPool, pool);
    if (pool < 0) throw new Error(`${slug}: pool went negative at round ${i + 1}`);
  }

  return { totalBet, totalPaid, minPool, rtp: (totalPaid / totalBet) * 100 };
}

/** @param {object} config @param {string} slug @param {string[]} predictions @param {(outcomeKey: string, bets: object[]) => number} calcPayout */
function simulatePvp(operator, config, slug, bet, rounds, predictions, calcPayout) {
  let totalBet = 0;
  let totalPaid = 0;
  let minPool = Infinity;

  for (let i = 0; i < rounds; i++) {
    const prediction = predictions[secureRandomInt(0, predictions.length - 1)];
    const roundBets = [{ operator, amount: bet, prediction }];
    totalBet += bet;

    let candidates = config.candidates.map((c) => ({ ...c }));
    candidates = gateJackpotOutcomes(candidates, roundBets, slug);
    const outcomeKey = pickPoolAwareOutcome({ candidates, roundBets, gameSlug: slug, calcPayout });
    const baseWin = calcPayout(outcomeKey, roundBets);

    recordRound({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    const { poolWin } = tryPoolWin({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    totalPaid += baseWin + poolWin;

    const pool = loadPool(operator.id, slug).poolBalance;
    minPool = Math.min(minPool, pool);
    if (pool < 0) throw new Error(`${slug}: pool went negative at round ${i + 1}`);
  }

  return { totalBet, totalPaid, minPool, rtp: (totalPaid / totalBet) * 100 };
}

function dicePayout(prediction, outcomeKey, amount, config) {
  const actual = outcomeKey === 'redWins' ? 'red' : outcomeKey === 'blueWins' ? 'blue' : 'draw';
  if (prediction !== actual) return 0;
  const mult = prediction === 'draw' ? config.drawBetMultiplier : config.teamWinMultiplier;
  return capWinByBet(amount, Math.floor(amount * mult), PAYOUT_LIMITS.pvp.maxWinBetMultiple);
}

function goalPayout(prediction, outcomeKey, amount, config) {
  const actual = outcomeKey === 'homeWin' ? 'home' : outcomeKey === 'awayWin' ? 'away' : 'draw';
  if (prediction !== actual) return 0;
  const mult = prediction === 'draw' ? config.drawMultiplier : config.winMultiplier;
  return capWinByBet(amount, Math.floor(amount * mult), PAYOUT_LIMITS.pvp.maxWinBetMultiple);
}

function simulateRocket(operator, bet, rounds) {
  const slug = 'rocket-rush';
  let totalBet = 0;
  let totalPaid = 0;
  let minPool = Infinity;

  for (let i = 0; i < rounds; i++) {
    totalBet += bet;
    const rawCrash = generateCrashPoint(ROCKET_GAME.houseEdge, ROCKET_GAME.maxMultiplier);
    const crash = capRocketCrash({ operator, totalRoundBets: bet, rawCrash, gameSlug: slug });

    let baseWin = 0;
    if (secureRandom() < 0.72) {
      const cashMult = 1.05 + secureRandom() * Math.min(Math.max(0, crash - 1.05), 12);
      const mult = capMultiplier(Math.min(cashMult, crash), ROCKET_GAME.maxMultiplier);
      baseWin = capWinByBet(bet, Math.floor(bet * mult), ROCKET_GAME.maxWinBetMultiple);
    }

    recordRound({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    const { poolWin } = tryPoolWin({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    totalPaid += baseWin + poolWin;

    const pool = loadPool(operator.id, slug).poolBalance;
    minPool = Math.min(minPool, pool);
    if (pool < 0) throw new Error(`${slug}: pool went negative at round ${i + 1}`);
  }

  return { totalBet, totalPaid, minPool, rtp: (totalPaid / totalBet) * 100 };
}

function simulateOlympus(operator, bet, rounds) {
  const slug = 'olympus-rise';
  let totalBet = 0;
  let totalPaid = 0;
  let minPool = Infinity;

  for (let i = 0; i < rounds; i++) {
    totalBet += bet;
    const jackpotFunded = poolAllowsJackpot(operator, slug);

    const round = runWithMathProfile(DEFAULT_ECONOMY.slotMathProfile, () =>
      spinRooRound(bet, { tightPool: !jackpotFunded })
    );

    let baseWin = capWinByPool({
      operator,
      gameSlug: slug,
      bet,
      win: round.winAmount,
    });

    recordRound({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    const { poolWin } = tryPoolWin({ operator, game: slug, bet, baseWin, playerId: 'sim' });
    totalPaid += baseWin + poolWin;

    const pool = loadPool(operator.id, slug).poolBalance;
    minPool = Math.min(minPool, pool);
    if (pool < 0) throw new Error(`${slug}: pool went negative at round ${i + 1}`);
  }

  return { totalBet, totalPaid, minPool, rtp: (totalPaid / totalBet) * 100 };
}

/**
 * Run full economy simulation.
 * @param {{ rounds?: number, bet?: number, poolsDir?: string, operator?: object }} [opts]
 */
export function runSimulation(opts = {}) {
  const rounds = opts.rounds ?? 10_000;
  const bet = opts.bet ?? 1000;
  const poolsDir = opts.poolsDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'gm-sim-'));

  if (!opts.poolsDir) process.env.POOLS_DIR = poolsDir;

  const operator = opts.operator ?? { id: 'sim-op', economy: { ...DEFAULT_ECONOMY } };

  /** @type {Record<string, ReturnType<typeof simulateLottery>>} */
  const results = {};

  results['luck-77'] = simulateLuck77(operator, bet, rounds);
  results['greedy-feast'] = simulateLottery(operator, 'greedy-feast', GREEDY_SYMBOLS, bet, rounds);
  results['dice-duel'] = simulatePvp(
    operator,
    {
      ...DICE_DUAL_GAME,
      candidates: [
        { key: 'redWins', weight: DICE_DUAL_GAME.redWinProbability, highPayout: false },
        { key: 'blueWins', weight: DICE_DUAL_GAME.blueWinProbability, highPayout: false },
        { key: 'draw', weight: DICE_DUAL_GAME.drawProbability, highPayout: true },
      ],
    },
    'dice-duel',
    bet,
    rounds,
    ['red', 'blue', 'draw'],
    (outcomeKey, bets) => dicePayout(bets[0].prediction, outcomeKey, bets[0].amount, DICE_DUAL_GAME),
  );
  results['goal-clash'] = simulatePvp(
    operator,
    {
      ...FOOTBALL_CLASH_GAME,
      candidates: [
        { key: 'homeWin', weight: FOOTBALL_CLASH_GAME.homeWinProbability, highPayout: false },
        { key: 'awayWin', weight: FOOTBALL_CLASH_GAME.awayWinProbability, highPayout: false },
        { key: 'draw', weight: FOOTBALL_CLASH_GAME.drawProbability, highPayout: true },
      ],
    },
    'goal-clash',
    bet,
    rounds,
    ['home', 'away', 'draw'],
    (outcomeKey, bets) => goalPayout(bets[0].prediction, outcomeKey, bets[0].amount, FOOTBALL_CLASH_GAME),
  );
  results['rocket-rush'] = simulateRocket(operator, bet, rounds);
  results['olympus-rise'] = simulateOlympus(operator, bet, rounds);

  const summary = POOLED_GAMES.map((slug) => {
    const r = results[slug];
    const target = targetRtp(slug);
    const delta = r.rtp - target;
    const finalPool = loadPool(operator.id, slug).poolBalance;
    return {
      slug,
      rounds,
      bet,
      rtp: Math.round(r.rtp * 100) / 100,
      targetRtp: target,
      delta: Math.round(delta * 100) / 100,
      minPool: r.minPool,
      finalPool,
      solvency: r.minPool >= 0 && finalPool >= 0 ? 'ok' : 'FAIL',
    };
  });

  if (!opts.poolsDir) {
    fs.rmSync(poolsDir, { recursive: true, force: true });
  }

  return { operator: operator.id, rounds, bet, games: summary };
}

function printReport(report) {
  console.log(`\nEconomy simulation — ${report.rounds.toLocaleString()} rounds × ${report.bet} bet\n`);
  console.log('Game            RTP%   Target  Δ      MinPool   FinalPool  Solvency');
  console.log('─'.repeat(72));
  for (const g of report.games) {
    const line = [
      g.slug.padEnd(16),
      String(g.rtp).padStart(5),
      String(g.targetRtp).padStart(7),
      `${g.delta >= 0 ? '+' : ''}${g.delta}`.padStart(7),
      String(g.minPool).padStart(9),
      String(g.finalPool).padStart(10),
      g.solvency.padStart(8),
    ].join(' ');
    console.log(line);
  }
  console.log('');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const report = runSimulation(opts);
  printReport(report);
}
