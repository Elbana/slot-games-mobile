/**
 * Shared-room Dice Dual engine — red vs blue, 5 dice each.
 * Bet red, blue, or draw (no refund hedge — wrong call loses).
 */

import { DICE_DUAL_GAME } from './config.mjs';
import { PAYOUT_LIMITS, capWinByBet } from '../../economy/payout-limits.mjs';
import { withRealtimeSync } from '../../realtime/sync.mjs';
import { secureRandom } from '../../economy/secure-rng.mjs';
import { gateJackpotOutcomes, pickPoolAwareOutcome } from '../../economy/pool-guard.mjs';

/** @typedef {'betting' | 'battling' | 'results'} DiceDualPhase */
/** @typedef {'red' | 'blue' | 'draw'} DicePrediction */
/** @typedef {'redWins' | 'blueWins' | 'draw'} DiceOutcome */

function rollDice(numDice) {
  const dice = [];
  for (let i = 0; i < numDice; i++) {
    dice.push(Math.floor(secureRandom() * 6) + 1);
  }
  return dice;
}

/** @param {object[]} roundBets @param {object} config */
function determineOutcome(roundBets, config) {
  const gameSlug = config.id ?? 'dice-duel';
  let candidates = [
    { key: 'redWins', weight: config.redWinProbability, highPayout: false },
    { key: 'blueWins', weight: config.blueWinProbability, highPayout: false },
    { key: 'draw', weight: config.drawProbability, highPayout: true },
  ];
  candidates = gateJackpotOutcomes(candidates, roundBets, gameSlug);

  return pickPoolAwareOutcome({
    candidates,
    roundBets,
    gameSlug,
    calcPayout: (outcomeKey, bets) => {
      let total = 0;
      for (const bet of bets) {
        total += calculateWinnings(bet.prediction, /** @type {DiceOutcome} */ (outcomeKey), bet.amount, config).winAmount;
      }
      return total;
    },
  });
}

/** @param {number[]} redDice @param {number[]} blueDice @param {DiceOutcome} outcome */
function adjustScoresToMatchOutcome(redDice, blueDice, outcome, numDice) {
  let redScore = redDice.reduce((s, v) => s + v, 0);
  let blueScore = blueDice.reduce((s, v) => s + v, 0);
  const maxScore = numDice * 6;

  switch (outcome) {
    case 'redWins':
      if (redScore <= blueScore) {
        redScore = Math.min(blueScore + Math.floor(secureRandom() * 5) + 1, maxScore);
      }
      break;
    case 'blueWins':
      if (blueScore <= redScore) {
        blueScore = Math.min(redScore + Math.floor(secureRandom() * 5) + 1, maxScore);
      }
      break;
    case 'draw': {
      const avg = Math.floor((redScore + blueScore) / 2);
      redScore = avg;
      blueScore = avg;
      break;
    }
    default:
      break;
  }
  return { redScore, blueScore };
}

/** @param {DicePrediction} prediction @param {DiceOutcome} outcome */
function calculateWinnings(prediction, outcome, betAmount, config) {
  const actual = outcome === 'redWins' ? 'red' : outcome === 'blueWins' ? 'blue' : 'draw';
  if (prediction !== actual) {
    return { winAmount: 0, isWinner: false };
  }
  const mult = prediction === 'draw' ? config.drawBetMultiplier : config.teamWinMultiplier;
  const winAmount = capWinByBet(
    betAmount,
    Math.floor(betAmount * mult),
    PAYOUT_LIMITS.pvp.maxWinBetMultiple,
  );
  return { winAmount, isWinner: true };
}

export function createDiceDualEngine(config = DICE_DUAL_GAME) {
  let roundSeq = 0;
  /** @type {DiceDualPhase} */
  let phase = 'betting';
  let phaseStartMs = Date.now();
  let phaseEndsMs = phaseStartMs + config.bettingSeconds * 1000;

  /** @type {{ roundId: number, outcome: DiceOutcome, redDice: number[], blueDice: number[], redScore: number, blueScore: number, winningTeam: 'red' | 'blue' | null } | null} */
  let battle = null;

  const bets = new Map();

  /** @type {{ round: number, outcome: DiceOutcome, redScore: number, blueScore: number }[]} */
  let history = [
    { round: 12, outcome: 'redWins', redScore: 22, blueScore: 17 },
    { round: 11, outcome: 'blueWins', redScore: 14, blueScore: 19 },
    { round: 10, outcome: 'draw', redScore: 18, blueScore: 18 },
  ];

  function resolveBets() {
    if (!battle) return;
    for (const bet of bets.values()) {
      if (bet.roundId !== roundSeq) continue;
      const { winAmount, isWinner } = calculateWinnings(
        bet.prediction,
        battle.outcome,
        bet.amount,
        config,
      );
      bet.winAmount = winAmount;
      bet.status = isWinner ? 'won' : 'lost';
    }
    history.unshift({
      round: roundSeq,
      outcome: battle.outcome,
      redScore: battle.redScore,
      blueScore: battle.blueScore,
    });
    if (history.length > 24) history.length = 24;
  }

  function executeBattle() {
    const roundBets = [...bets.values()].filter((b) => b.roundId === roundSeq);
    const outcome = /** @type {DiceOutcome} */ (determineOutcome(roundBets, config));
    const redDice = rollDice(config.numDicePerTeam);
    const blueDice = rollDice(config.numDicePerTeam);
    const { redScore, blueScore } = adjustScoresToMatchOutcome(
      redDice,
      blueDice,
      outcome,
      config.numDicePerTeam,
    );
    battle = {
      roundId: roundSeq,
      outcome,
      redDice,
      blueDice,
      redScore,
      blueScore,
      winningTeam: outcome === 'draw' ? null : outcome === 'redWins' ? 'red' : 'blue',
    };
    resolveBets();
  }

  function startBettingRound(now = Date.now()) {
    roundSeq += 1;
    phase = 'betting';
    phaseStartMs = now;
    phaseEndsMs = now + config.bettingSeconds * 1000;
    battle = null;
    for (const [key, bet] of bets) {
      if (bet.roundId < roundSeq) bets.delete(key);
    }
  }

  function startBattle(now) {
    phase = 'battling';
    phaseStartMs = now;
    phaseEndsMs = now + config.battleSeconds * 1000;
    executeBattle();
    for (const bet of bets.values()) {
      if (bet.roundId === roundSeq && bet.status === 'pending') bet.status = 'active';
    }
  }

  function startResults(now) {
    phase = 'results';
    phaseStartMs = now;
    phaseEndsMs = now + config.resultSeconds * 1000;
  }

  function tick() {
    const now = Date.now();
    if (phase === 'betting' && now >= phaseEndsMs) startBattle(now);
    else if (phase === 'battling' && now >= phaseEndsMs) startResults(now);
    else if (phase === 'results' && now >= phaseEndsMs) startBettingRound(now);
  }

  setInterval(tick, 50);

  function getPublicState() {
    tick();
    const now = Date.now();
    const countdown = Math.max(0, Math.ceil((phaseEndsMs - now) / 1000));
    const roundBets = [...bets.values()].filter((b) => b.roundId === roundSeq);

    return withRealtimeSync({
      roundId: roundSeq,
      phase,
      countdown,
      phaseEndsAt: phaseEndsMs,
      phaseStartedAt: phaseStartMs,
      totalBets: roundBets.length,
      redPool: roundBets.filter((b) => b.prediction === 'red').reduce((s, b) => s + b.amount, 0),
      bluePool: roundBets.filter((b) => b.prediction === 'blue').reduce((s, b) => s + b.amount, 0),
      drawPool: roundBets.filter((b) => b.prediction === 'draw').reduce((s, b) => s + b.amount, 0),
      history: [...history],
      battle:
        battle && battle.roundId === roundSeq
          ? {
              redDice: battle.redDice,
              blueDice: battle.blueDice,
              redScore: battle.redScore,
              blueScore: battle.blueScore,
              outcome: battle.outcome,
              winningTeam: battle.winningTeam,
            }
          : null,
    });
  }

  function placeBet(platformKey, prediction, amount, meta = {}) {
    tick();
    if (phase !== 'betting') {
      return { ok: false, message: 'Betting closed — wait for next round' };
    }
    if (!['red', 'blue', 'draw'].includes(prediction)) {
      return { ok: false, message: 'Pick red, blue, or draw' };
    }
    const existing = bets.get(platformKey);
    if (existing && existing.roundId === roundSeq) {
      return { ok: false, message: 'Already bet this round' };
    }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return { ok: false, message: 'Invalid bet amount' };
    }
    bets.set(platformKey, {
      roundId: roundSeq,
      prediction,
      amount: amt,
      status: 'pending',
      operator: meta.operator ?? null,
    });
    return { ok: true, data: { prediction, amount: amt, roundId: roundSeq } };
  }

  function serializePlayer(platformKey) {
    const bet = bets.get(platformKey);
    if (!bet || bet.roundId !== roundSeq) return null;
    return {
      prediction: bet.prediction,
      amount: bet.amount,
      status: bet.status,
      winAmount: bet.winAmount ?? null,
    };
  }

  function pullSettlement(platformKey) {
    const bet = bets.get(platformKey);
    if (!bet || bet.settled) return null;
    if (bet.status === 'won' && bet.winAmount != null && phase === 'results') {
      bet.settled = true;
      return {
        winAmount: bet.winAmount,
        betAmount: bet.amount,
        prediction: bet.prediction,
        outcome: battle?.outcome ?? null,
      };
    }
    if (bet.status === 'lost' && phase === 'results') {
      bet.settled = true;
      return { winAmount: 0, betAmount: bet.amount, lost: true };
    }
    return null;
  }

  startBettingRound();

  return {
    config,
    getPublicState,
    placeBet,
    serializePlayer,
    pullSettlement,
  };
}

let singleton = null;

export function getDiceDualEngine() {
  if (!singleton) singleton = createDiceDualEngine();
  return singleton;
}
