/**
 * Shared period engine for BooAn-style lottery games (Greedy, Pets & Beasts).
 * Lifecycle: betting (stage 1) → spin (2) → result (4) → repeat.
 */

/** @typedef {{ playCode: string, label: string, emoji: string, odd: number, group?: string[] }} LotterySymbol */

/**
 * @param {{
 *   typCode: string,
 *   lotteryCode: string,
 *   bettingSeconds?: number,
 *   spinSeconds?: number,
 *   resultSeconds?: number,
 *   symbols: LotterySymbol[],
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
  /** @type {string[]} */
  let lastNum = [];
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

  function elapsedInPeriod() {
    return ((Date.now() - periodStartMs) / 1000) % totalSeconds;
  }

  function ensureResultDrawn() {
    if (resultDrawnForCurrentPeriod) return;
    drawResult(currentPeriod);
    lastPeriod = currentPeriod;
    settledPeriodBets = new Map(periodBets);
    resultDrawnForCurrentPeriod = true;
  }

  function getPhase() {
    const elapsed = elapsedInPeriod();
    if (elapsed < bettingSeconds) {
      return { stage: 1, countdown: Math.ceil(bettingSeconds - elapsed), closeDuration: spinSeconds };
    }
    if (elapsed < bettingSeconds + spinSeconds) {
      return { stage: 2, countdown: Math.ceil(bettingSeconds + spinSeconds - elapsed), closeDuration: spinSeconds };
    }
    ensureResultDrawn();
    return {
      stage: 4,
      countdown: Math.ceil(totalSeconds - elapsed),
      closeDuration: spinSeconds,
    };
  }

  function maybeAdvancePeriod() {
    const elapsed = elapsedInPeriod();
    if (elapsed >= totalSeconds - 0.05) {
      periodBets.clear();
      periodStartMs = Date.now();
      currentPeriod = nextPeriodId();
      resultDrawnForCurrentPeriod = false;
    }
  }

  function drawResult(periodNo) {
    const code = weightedPick(weights);
    lastNum = [code];
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

  function getBetState() {
    tick();
    const phase = getPhase();
    return {
      TypCode: config.typCode,
      LotteryCode: config.lotteryCode,
      Period: currentPeriod,
      Stage: phase.stage,
      CountDown: phase.countdown,
      CloseDuration: phase.closeDuration,
      LastPeriod: lastPeriod,
      LastNum: lastNum.length ? [...lastNum] : [],
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
        winAmount += payout;
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
  let r = Math.random();
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.playCode;
  }
  return weights.at(-1).playCode;
}
