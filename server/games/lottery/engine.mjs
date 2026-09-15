/**
 * Shared period engine for BooAn-style lottery games (Greedy, Lucky 77).
 * Lifecycle: betting (stage 1) → spin (2) → result (4) → repeat.
 */

import { PAYOUT_LIMITS, capWinByBet } from '../../economy/payout-limits.mjs';
import { secureRandom, secureRandomInt } from '../../economy/secure-rng.mjs';
import {
  getActiveOperator,
  poolAllowsJackpot,
  filterSymbolsByPool,
} from '../../economy/pool-guard.mjs';
import { getGameEconomy } from '../../economy/game-economy.mjs';

/** @typedef {{ playCode: string, label: string, emoji: string, odd: number, group?: string[] }} LotterySymbol */

/**
 * @param {{
 *   typCode: string,
 *   lotteryCode: string,
 *   bettingSeconds?: number,
 *   spinSeconds?: number,
 *   resultSeconds?: number,
 *   symbols: LotterySymbol[],
 *   validateBet?: (sessionId: string, playCode: string, periodBets: Map<string, number>, betKey: (sessionId: string, playCode: string) => string) => { ok: boolean, message?: string },
 * }} config
 */
export function createLotteryEngine(config) {
  const bettingSeconds = config.bettingSeconds ?? 30;
  const spinSeconds = config.spinSeconds ?? 4;
  const resultSeconds = config.resultSeconds ?? 4;
  const totalSeconds = bettingSeconds + spinSeconds + resultSeconds;

  /** @type {Map<string, number>} */
  const periodBets = new Map();
  /** @type {Map<string, number>} bets from the period that just finished (for payout) */
  let settledPeriodBets = new Map();

  let periodSeq = Math.floor(Date.now() / 1000) % 1_000_000;
  let periodStartMs = Date.now();
  let currentPeriod = nextPeriodId();
  let lastPeriod = '';
  let resultDrawnForCurrentPeriod = false;
  let resultDrawnCycle = -1;
  /** @type {string[]} */
  let lastNum = [];
  /** Wheel stop index (0-based) when config.wheelStops is set. */
  let lastWheelIndex = -1;
  /** @type {{ periodNo: string, result: string[], openAt: string }[]} */
  let history = [];

  const symbolByCode = new Map(config.symbols.map((s) => [s.playCode, s]));
  const weights = buildWeights(config.symbols);

  function nextPeriodId() {
    periodSeq += 1;
    const d = new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(periodSeq, 6)}`;
  }

  function rawElapsedSec() {
    return (Date.now() - periodStartMs) / 1000;
  }

  function elapsedInPeriod() {
    return rawElapsedSec() % totalSeconds;
  }

  function ensureResultDrawn(cycle) {
    if (resultDrawnForCurrentPeriod && resultDrawnCycle === cycle) return;
    drawResult(currentPeriod);
    lastPeriod = currentPeriod;
    settledPeriodBets = new Map(periodBets);
    resultDrawnForCurrentPeriod = true;
    resultDrawnCycle = cycle;
  }

  function getPhase() {
    const cycle = Math.floor(rawElapsedSec() / totalSeconds);
    const elapsed = elapsedInPeriod();
    if (elapsed < bettingSeconds) {
      return { stage: 1, countdown: Math.ceil(bettingSeconds - elapsed), closeDuration: spinSeconds };
    }
    ensureResultDrawn(cycle);
    if (elapsed < bettingSeconds + spinSeconds) {
      return { stage: 2, countdown: Math.ceil(bettingSeconds + spinSeconds - elapsed), closeDuration: spinSeconds };
    }
    return {
      stage: 4,
      countdown: Math.ceil(totalSeconds - elapsed),
      closeDuration: spinSeconds,
    };
  }

  function maybeAdvancePeriod() {
    const raw = rawElapsedSec();
    if (raw < totalSeconds) return;
    const cycles = Math.floor(raw / totalSeconds);
    periodBets.clear();
    periodStartMs += cycles * totalSeconds * 1000;
    for (let i = 0; i < cycles; i++) {
      currentPeriod = nextPeriodId();
    }
    resultDrawnForCurrentPeriod = false;
    resultDrawnCycle = -1;
    lastWheelIndex = -1;
  }

  function drawResult(periodNo) {
    const gameSlug = config.id ?? '';
    const operator = getActiveOperator(gameSlug);
    const stops = config.wheelStops;
    if (Array.isArray(stops) && stops.length > 0) {
      const econ = getGameEconomy(gameSlug);
      const highCode = config.symbols.find((s) => s.odd >= (econ.highOutcomeOdd ?? 8))?.playCode;
      let eligible = stops.map((_, i) => i);
      if (operator && highCode && !poolAllowsJackpot(operator, gameSlug, econ.highOutcomeMinPool)) {
        eligible = eligible.filter((i) => stops[i] !== highCode);
      }
      if (!eligible.length) eligible = stops.map((_, i) => i);
      lastWheelIndex = eligible[secureRandomInt(0, eligible.length - 1)];
      lastNum = [stops[lastWheelIndex]];
    } else {
      lastWheelIndex = -1;
      let drawWeights = weights;
      if (operator) {
        const allowed = filterSymbolsByPool(config.symbols, operator, gameSlug);
        drawWeights = buildWeights(allowed);
      }
      const code = weightedPick(drawWeights);
      lastNum = [code];
    }
    history.unshift({
      periodNo,
      result: [...lastNum],
      openAt: new Date().toISOString(),
    });
    if (history.length > 100) history.length = 100;
  }

  function tick() {
    maybeAdvancePeriod();
  }

  setInterval(tick, 250);

  function getPoolItems() {
    /** @type {Record<string, number>} */
    const byCode = {};
    for (const [key, amt] of periodBets) {
      const code = key.includes(':') ? key.split(':').slice(1).join(':') : key;
      byCode[code] = (byCode[code] || 0) + amt;
    }
    return Object.entries(byCode).map(([PlayCode, Amount]) => ({ PlayCode, Amount }));
  }

  function getBetState() {
    tick();
    const phase = getPhase();
    const now = Date.now();
    const elapsed = elapsedInPeriod();
    let phaseEndsAt = now;
    if (phase.stage === 1) phaseEndsAt = now + Math.max(0, bettingSeconds - elapsed) * 1000;
    else if (phase.stage === 2) phaseEndsAt = now + Math.max(0, bettingSeconds + spinSeconds - elapsed) * 1000;
    else phaseEndsAt = now + Math.max(0, totalSeconds - elapsed) * 1000;

    return {
      TypCode: config.typCode,
      LotteryCode: config.lotteryCode,
      Period: currentPeriod,
      Stage: phase.stage,
      CountDown: phase.countdown,
      CloseDuration: phase.closeDuration,
      LastPeriod: lastPeriod,
      LastNum: lastNum.length ? [...lastNum] : [],
      ShowArea: lastWheelIndex >= 0 ? lastWheelIndex : undefined,
      serverTime: now,
      phaseEndsAt,
      periodStartMs,
      poolItems: getPoolItems(),
      totalBets: periodBets.size,
    };
  }

  function getOddList() {
    const playCodeOdd = config.symbols.map((s) => ({
      PlayCode: s.playCode,
      Odd: s.odd,
      MaxOdd: s.odd,
      Name: s.label,
    }));
    return {
      TypCode: config.typCode,
      LotteryCode: config.lotteryCode,
      PalySubType: [{ PlayCodeOdd: playCodeOdd }],
    };
  }

  function getPeriodList(page = { Idx: 1, Size: 20 }) {
    const idx = Math.max(1, page.Idx || 1);
    const size = Math.min(100, page.Size || 20);
    const start = (idx - 1) * size;
    const rows = history.slice(start, start + size).map((h) => ({
      PeriodNo: h.periodNo,
      Result: h.result,
      OpenAt: h.openAt,
    }));
    return { rows, Total: history.length };
  }

  function betKey(sessionId, playCode) {
    return `${sessionId}:${playCode}`;
  }

  /**
   * @param {string} sessionId
   * @param {string} playCode
   * @param {number} amount
   * @param {() => number} getBalance
   * @param {(n: number) => void} setBalance
   */
  function placeBet(sessionId, playCode, amount, getBalance, setBalance) {
    tick();
    const phase = getPhase();
    if (phase.stage !== 1) {
      return { ok: false, code: 400, message: 'Betting closed' };
    }
    const sym = symbolByCode.get(playCode);
    if (!sym) return { ok: false, code: 400, message: 'Unknown play code' };
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, code: 400, message: 'Invalid bet amount' };
    }
    const balance = getBalance();
    if (balance < amt) return { ok: false, code: 400, message: 'Insufficient balance' };

    if (config.validateBet) {
      const combo = config.validateBet(sessionId, playCode, periodBets, betKey);
      if (!combo.ok) return { ok: false, code: 400, message: combo.message || 'Invalid bet combination' };
    }

    setBalance(balance - amt);
    const key = betKey(sessionId, playCode);
    periodBets.set(key, (periodBets.get(key) || 0) + amt);

    return {
      ok: true,
      data: {
        Period: currentPeriod,
        PlayCode: playCode,
        BetAmount: amt,
        Balance: getBalance(),
      },
    };
  }

  /**
   * Settle bets for a session when result is known.
   * @param {string} sessionId
   * @param {() => number} getBalance
   * @param {(n: number) => void} setBalance
   * @returns {{ winAmount: number, winCodes: string[] }}
   */
  function settleSession(sessionId, getBalance, setBalance) {
    if (!lastNum.length) return { winAmount: 0, winCodes: [] };
    const winning = new Set(lastNum);
    for (const sym of config.symbols) {
      if (sym.group) {
        for (const c of sym.group) winning.add(c);
      }
    }

    let winAmount = 0;
    /** @type {string[]} */
    const winCodes = [];

    for (const sym of config.symbols) {
      const key = betKey(sessionId, sym.playCode);
      const staked = settledPeriodBets.get(key);
      if (!staked) continue;

      let won = winning.has(sym.playCode);
      if (!won && sym.group) {
        won = lastNum.some((r) => sym.group.includes(r));
      }
      if (won) {
        const payout = staked * sym.odd;
        winAmount += capWinByBet(staked, payout, PAYOUT_LIMITS.lottery.maxWinBetMultiple);
        winCodes.push(sym.playCode);
      }
    }

    if (winAmount > 0) setBalance(getBalance() + winAmount);
    return { winAmount, winCodes };
  }

  function getSymbol(playCode) {
    return symbolByCode.get(playCode);
  }

  return {
    config,
    getBetState,
    getOddList,
    getPeriodList,
    placeBet,
    settleSession,
    getSymbol,
    get currentPeriod() {
      return currentPeriod;
    },
    get lastNum() {
      return lastNum;
    },
  };
}

/** @param {LotterySymbol[]} symbols */
function buildWeights(symbols) {
  const singles = symbols.filter((s) => !s.group || s.group.length === 0);
  const pool = singles.length ? singles : symbols;
  const total = pool.reduce((sum, s) => sum + 1 / s.odd, 0);
  return pool.map((s) => ({ playCode: s.playCode, weight: (1 / s.odd) / total }));
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
