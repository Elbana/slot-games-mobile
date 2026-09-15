/**
 * Shared-room crash engine — one round at a time for all connected players.
 */

import { ROCKET_GAME } from './config.mjs';
import { capMultiplier, capWinByBet } from '../../economy/payout-limits.mjs';
import { withRealtimeSync } from '../../realtime/sync.mjs';
import { secureRandom } from '../../economy/secure-rng.mjs';
import { capRocketCrash } from '../../economy/pool-guard.mjs';

/** @typedef {'betting' | 'flying' | 'ended'} RocketPhase */

/**
 * @param {number} [houseEdge]
 * @param {number} [maxMultiplier]
 * @returns {number} crash multiplier (>= 1.0)
 */
export function generateCrashPoint(
  houseEdge = ROCKET_GAME.houseEdge,
  maxMultiplier = ROCKET_GAME.maxMultiplier,
) {
  const r = secureRandom();
  if (r < houseEdge) return 1 + secureRandom() * 0.35;
  const raw = (1 - houseEdge) / (1 - r);
  return capMultiplier(raw, maxMultiplier);
}

/**
 * Raw crash point before pool cap (secure RNG).
 * @param {number} houseEdge
 * @param {number} maxMultiplier
 */
export function generateRawCrashPoint(
  houseEdge = ROCKET_GAME.houseEdge,
  maxMultiplier = ROCKET_GAME.maxMultiplier,
) {
  return generateCrashPoint(houseEdge, maxMultiplier);
}

/** @param {object[]} roundBets bets with `.operator` and `.amount` */
function poolCapCrashForRound(roundBets, rawCrash) {
  const operators = [...new Map(
    roundBets.filter((b) => b.operator?.id).map((b) => [b.operator.id, b.operator]),
  ).values()];
  if (!operators.length) return rawCrash;

  let crash = rawCrash;
  for (const operator of operators) {
    const opTotal = roundBets
      .filter((b) => b.operator?.id === operator.id)
      .reduce((s, b) => s + b.amount, 0);
    crash = Math.min(
      crash,
      capRocketCrash({ operator, totalRoundBets: opTotal, rawCrash: crash }),
    );
  }
  return crash;
}

function rocketWinAmount(betAmount, multiplier, config = ROCKET_GAME) {
  const mult = capMultiplier(multiplier, config.maxMultiplier);
  const raw = Math.floor(betAmount * mult);
  return capWinByBet(betAmount, raw, config.maxWinBetMultiple);
}

export function multiplierAt(elapsedSec, crashAt) {
  const raw = Math.exp(ROCKET_GAME.multK * elapsedSec);
  return Math.min(crashAt, Math.max(1, Math.round(raw * 100) / 100));
}

export function flightDurationSec(crashAt) {
  if (crashAt <= 1) return 0;
  return Math.log(crashAt) / ROCKET_GAME.multK;
}

export function createRocketEngine(config = ROCKET_GAME) {
  let roundSeq = 0;
  let phase /** @type {RocketPhase} */ = 'betting';
  let roundStartMs = Date.now();
  let bettingEndsMs = roundStartMs + config.bettingSeconds * 1000;
  let flyStartMs = 0;
  let crashAt = 1.5;
  let endedAtMs = 0;
  /** @type {number[]} */
  let history = [2.55, 7.75, 1.83, 3.6, 1.1, 4.2];

  /** @type {Map<string, { roundId: number, amount: number, status: string, cashoutMult?: number, autoCashout?: number, settled?: boolean, operator?: object }>} */
  const bets = new Map();

  function tick() {
    const now = Date.now();
    if (phase === 'betting' && now >= bettingEndsMs) {
      startFlight(now);
    } else if (phase === 'flying') {
      const elapsed = (now - flyStartMs) / 1000;
      const mult = multiplierAt(elapsed, crashAt);
      if (mult >= crashAt - 0.001) {
        endRound(now);
      } else {
        autoCashoutSweep(mult);
      }
    } else if (phase === 'ended' && now >= endedAtMs + config.resultSeconds * 1000) {
      startBettingRound(now);
    }
  }

  const timer = setInterval(tick, 50);
  if (typeof timer.unref === 'function') timer.unref();

  function startBettingRound(now = Date.now()) {
    roundSeq += 1;
    phase = 'betting';
    roundStartMs = now;
    bettingEndsMs = now + config.bettingSeconds * 1000;
    flyStartMs = 0;
    endedAtMs = 0;
    for (const [key, bet] of bets) {
      if (bet.roundId < roundSeq) bets.delete(key);
    }
  }

  function startFlight(now) {
    phase = 'flying';
    flyStartMs = now;
    const roundBets = [...bets.values()].filter((b) => b.roundId === roundSeq);
    const rawCrash = generateRawCrashPoint(config.houseEdge, config.maxMultiplier);
    crashAt = poolCapCrashForRound(roundBets, rawCrash);
    for (const bet of roundBets) {
      if (bet.status === 'pending') bet.status = 'active';
    }
  }

  function endRound(now) {
    phase = 'ended';
    endedAtMs = now;
    history.unshift(crashAt);
    if (history.length > 24) history.length = 24;
    for (const bet of bets.values()) {
      if (bet.roundId === roundSeq && bet.status === 'active') {
        bet.status = 'lost';
      }
    }
  }

  function autoCashoutSweep(mult) {
    for (const bet of bets.values()) {
      if (bet.roundId !== roundSeq || bet.status !== 'active') continue;
      if (bet.autoCashout && mult >= bet.autoCashout) {
        bet.status = 'cashed_out';
        bet.cashoutMult = bet.autoCashout;
      }
    }
  }

  function getPublicState() {
    tick();
    const now = Date.now();
    let multiplier = 1;
    let countdown = 0;

    if (phase === 'betting') {
      countdown = Math.max(0, Math.ceil((bettingEndsMs - now) / 1000));
      multiplier = 1;
    } else if (phase === 'flying') {
      const elapsed = (now - flyStartMs) / 1000;
      multiplier = multiplierAt(elapsed, crashAt);
    } else {
      multiplier = crashAt;
    }

    const activeBets = [...bets.values()].filter((b) => b.roundId === roundSeq);
    const playerCount = activeBets.length;
    const maxPlayers = 999;
    const phaseEndsAt =
      phase === 'betting'
        ? bettingEndsMs
        : phase === 'ended'
          ? endedAtMs + config.resultSeconds * 1000
          : undefined;

    return withRealtimeSync({
      roundId: roundSeq,
      phase,
      countdown,
      multiplier,
      crashAt: phase === 'ended' ? crashAt : undefined,
      history: [...history],
      playerCount,
      maxPlayers,
      phaseStartedAt: phase === 'flying' ? flyStartMs : roundStartMs,
      phaseEndsAt,
      flyStartMs: phase === 'flying' || phase === 'ended' ? flyStartMs : 0,
      bettingEndsMs,
    });
  }

  function playerBetKey(platformKey) {
    return platformKey;
  }

  function getPlayerBet(platformKey) {
    return bets.get(playerBetKey(platformKey)) ?? null;
  }

  function placeBet(platformKey, amount, autoCashout = 0, meta = {}) {
    tick();
    if (phase !== 'betting') {
      return { ok: false, message: 'Betting closed — wait for next round' };
    }
    const existing = bets.get(playerBetKey(platformKey));
    if (existing && existing.roundId === roundSeq && existing.status === 'pending') {
      return { ok: false, message: 'Already bet this round' };
    }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, message: 'Invalid bet amount' };
    }
    let autoTarget = autoCashout > 1 ? autoCashout : 0;
    if (autoTarget > config.maxMultiplier) {
      autoTarget = config.maxMultiplier;
    }
    bets.set(playerBetKey(platformKey), {
      roundId: roundSeq,
      amount: amt,
      status: 'pending',
      autoCashout: autoTarget,
      operator: meta.operator ?? null,
    });
    return { ok: true, data: { amount: amt, roundId: roundSeq } };
  }

  function activateBet(platformKey) {
    const bet = bets.get(playerBetKey(platformKey));
    if (bet && bet.roundId === roundSeq && bet.status === 'pending') {
      bet.status = 'active';
    }
  }

  function cashOut(platformKey) {
    tick();
    if (phase !== 'flying') {
      return { ok: false, message: 'Cannot cash out now' };
    }
    const bet = bets.get(playerBetKey(platformKey));
    if (!bet || bet.roundId !== roundSeq || bet.status !== 'active') {
      return { ok: false, message: 'No active bet to cash out' };
    }
    const elapsed = (Date.now() - flyStartMs) / 1000;
    const mult = multiplierAt(elapsed, crashAt);
    bet.status = 'cashed_out';
    bet.cashoutMult = capMultiplier(mult, config.maxMultiplier);
    bet.settled = true;
    return {
      ok: true,
      data: {
        multiplier: bet.cashoutMult,
        winAmount: rocketWinAmount(bet.amount, bet.cashoutMult, config),
      },
    };
  }

  function pullSettlement(platformKey) {
    const bet = bets.get(playerBetKey(platformKey));
    if (!bet || bet.settled) return null;
    if (bet.status === 'cashed_out' && bet.cashoutMult) {
      bet.settled = true;
      return {
        winAmount: rocketWinAmount(bet.amount, bet.cashoutMult, config),
        betAmount: bet.amount,
        multiplier: capMultiplier(bet.cashoutMult, config.maxMultiplier),
      };
    }
    if (bet.status === 'lost' && phase === 'ended') {
      bet.settled = true;
      return { winAmount: 0, betAmount: bet.amount, lost: true };
    }
    return null;
  }

  /** @param {string} platformKey */
  function serializePlayer(platformKey) {
    const bet = getPlayerBet(platformKey);
    if (!bet || bet.roundId !== roundSeq) return null;
    return {
      amount: bet.amount,
      status: bet.status,
      cashoutMult: bet.cashoutMult ?? null,
      autoCashout: bet.autoCashout || null,
    };
  }

  // Bootstrap first round
  startBettingRound();

  return {
    config,
    getPublicState,
    placeBet,
    activateBet,
    cashOut,
    serializePlayer,
    pullSettlement,
    get crashAt() {
      return crashAt;
    },
  };
}

let singleton = null;

export function getRocketEngine() {
  if (!singleton) singleton = createRocketEngine();
  return singleton;
}
