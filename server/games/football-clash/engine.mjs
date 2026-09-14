/**
 * Shared-room Football Clash engine.
 */

import crypto from 'crypto';
import { FOOTBALL_CLASH_GAME, FOOTBALL_TEAMS } from './config.mjs';

/** @typedef {'betting' | 'playing' | 'results'} FootballPhase */
/** @typedef {'home' | 'away' | 'draw'} FootballPrediction */
/** @typedef {'homeWin' | 'awayWin' | 'draw'} FootballOutcome */

const FIRST_NAMES = ['David', 'Mohamed', 'Kevin', 'Cristiano', 'Lionel', 'Erling', 'Kylian', 'Harry', 'Bruno'];
const LAST_NAMES = ['Silva', 'Salah', 'De Bruyne', 'Ronaldo', 'Messi', 'Haaland', 'Mbappé', 'Kane', 'Fernandes'];

function secureRandom() {
  const buffer = crypto.randomBytes(4);
  return buffer.readUInt32BE(0) / 0xffffffff;
}

function pickTeams() {
  const shuffled = [...FOOTBALL_TEAMS].sort(() => secureRandom() - 0.5);
  return { homeTeam: shuffled[0], awayTeam: shuffled[1] };
}

/** @param {{ rating: number }} home @param {{ rating: number }} away */
function determineOutcome(home, away, config) {
  const adjustment = (home.rating - away.rating) * 0.005;
  let homeWinProb = config.homeWinProbability + adjustment;
  let awayWinProb = config.awayWinProbability - adjustment;
  const drawProb = config.drawProbability;
  const total = homeWinProb + awayWinProb + drawProb;
  homeWinProb /= total;
  awayWinProb /= total;
  const rand = secureRandom();
  if (rand < homeWinProb) return 'homeWin';
  if (rand < homeWinProb + awayWinProb) return 'awayWin';
  return 'draw';
}

/** @param {FootballOutcome} outcome */
function generateScore(outcome) {
  if (outcome === 'draw') {
    const score = secureRandom() < 0.6
      ? (secureRandom() < 0.5 ? 0 : 1)
      : Math.floor(secureRandom() * 2) + 2;
    return { homeScore: score, awayScore: score };
  }
  const goalDiff = secureRandom() < 0.7 ? 1 : (secureRandom() < 0.8 ? 2 : 3);
  const winnerScore = Math.floor(secureRandom() * 2) + goalDiff;
  const loserScore = winnerScore - goalDiff;
  if (outcome === 'homeWin') return { homeScore: winnerScore, awayScore: loserScore };
  return { homeScore: loserScore, awayScore: winnerScore };
}

function playerName() {
  const f = FIRST_NAMES[Math.floor(secureRandom() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(secureRandom() * LAST_NAMES.length)];
  return `${f} ${l}`;
}

/** @param {FootballOutcome} outcome @param {number} homeScore @param {number} awayScore @param {number} matchMs */
function buildMatchEvents(outcome, homeScore, awayScore, matchMs) {
  /** @type {{ type: string, team: string, minute: number, player?: string, atMs: number }[]} */
  const events = [];
  for (let i = 0; i < homeScore; i++) {
    events.push({ type: 'goal', team: 'home', minute: Math.floor(secureRandom() * 88) + 1, player: playerName(), atMs: 0 });
  }
  for (let i = 0; i < awayScore; i++) {
    events.push({ type: 'goal', team: 'away', minute: Math.floor(secureRandom() * 88) + 1, player: playerName(), atMs: 0 });
  }
  const extras = ['corner', 'yellow_card', 'shot', 'foul'];
  const extraCount = Math.floor(secureRandom() * 3) + 1;
  for (let i = 0; i < extraCount; i++) {
    events.push({
      type: extras[Math.floor(secureRandom() * extras.length)],
      team: secureRandom() > 0.5 ? 'home' : 'away',
      minute: Math.floor(secureRandom() * 88) + 1,
      atMs: 0,
    });
  }
  events.sort((a, b) => a.minute - b.minute);
  const interval = matchMs / Math.max(events.length, 1);
  events.forEach((ev, i) => {
    ev.atMs = Math.floor(interval * (i + 0.6));
  });
  return events;
}

/** @param {FootballPrediction} prediction @param {FootballOutcome} outcome */
function calculateWinnings(prediction, outcome, betAmount, config) {
  const actual = outcome === 'homeWin' ? 'home' : outcome === 'awayWin' ? 'away' : 'draw';
  if (prediction !== actual) return { winAmount: 0, isWinner: false };
  const mult = prediction === 'draw' ? config.drawMultiplier : config.winMultiplier;
  return { winAmount: Math.floor(betAmount * mult), isWinner: true };
}

export function createFootballClashEngine(config = FOOTBALL_CLASH_GAME) {
  let roundSeq = 0;
  /** @type {FootballPhase} */
  let phase = 'betting';
  let phaseStartMs = Date.now();
  let phaseEndsMs = phaseStartMs + config.bettingSeconds * 1000;

  /** @type {{ roundId: number, homeTeam: object, awayTeam: object, homeScore: number, awayScore: number, outcome: FootballOutcome, winner: string | null, events: object[] } | null} */
  let match = null;

  const bets = new Map();
  let history = [
    { round: 8, home: 'LIV', away: 'RMA', score: '2-1', outcome: 'homeWin' },
    { round: 7, home: 'BAR', away: 'CHE', score: '1-1', outcome: 'draw' },
  ];

  function resolveBets() {
    if (!match) return;
    for (const bet of bets.values()) {
      if (bet.roundId !== roundSeq) continue;
      const { winAmount, isWinner } = calculateWinnings(bet.prediction, match.outcome, bet.amount, config);
      bet.winAmount = winAmount;
      bet.status = isWinner ? 'won' : 'lost';
    }
    history.unshift({
      round: roundSeq,
      home: match.homeTeam.shortName,
      away: match.awayTeam.shortName,
      score: `${match.homeScore}-${match.awayScore}`,
      outcome: match.outcome,
    });
    if (history.length > 12) history.length = 12;
  }

  function finalizeMatch() {
    const homeTeam = match.homeTeam;
    const awayTeam = match.awayTeam;
    const outcome = determineOutcome(homeTeam, awayTeam, config);
    const { homeScore, awayScore } = generateScore(outcome);
    const events = buildMatchEvents(outcome, homeScore, awayScore, config.matchSeconds * 1000);
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.outcome = outcome;
    match.winner = outcome === 'draw' ? null : outcome === 'homeWin' ? 'home' : 'away';
    match.events = events;
    match.resolved = true;
    resolveBets();
  }

  function prepareMatch() {
    const { homeTeam, awayTeam } = pickTeams();
    const outcome = determineOutcome(homeTeam, awayTeam, config);
    const { homeScore, awayScore } = generateScore(outcome);
    const events = buildMatchEvents(outcome, homeScore, awayScore, config.matchSeconds * 1000);
    match = {
      roundId: roundSeq,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      outcome,
      winner: outcome === 'draw' ? null : outcome === 'homeWin' ? 'home' : 'away',
      events,
      resolved: true,
    };
    resolveBets();
  }

  function startBettingRound(now = Date.now()) {
    roundSeq += 1;
    phase = 'betting';
    phaseStartMs = now;
    phaseEndsMs = now + config.bettingSeconds * 1000;
    const { homeTeam, awayTeam } = pickTeams();
    match = {
      roundId: roundSeq,
      homeTeam,
      awayTeam,
      homeScore: 0,
      awayScore: 0,
      outcome: null,
      winner: null,
      events: [],
      resolved: false,
    };
    for (const [key, bet] of bets) {
      if (bet.roundId < roundSeq) bets.delete(key);
    }
  }

  function startPlaying(now) {
    phase = 'playing';
    phaseStartMs = now;
    phaseEndsMs = now + config.matchSeconds * 1000;
    if (!match || match.roundId !== roundSeq) prepareMatch();
    else finalizeMatch();
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
    if (phase === 'betting' && now >= phaseEndsMs) startPlaying(now);
    else if (phase === 'playing' && now >= phaseEndsMs) startResults(now);
    else if (phase === 'results' && now >= phaseEndsMs) startBettingRound(now);
  }

  setInterval(tick, 50);

  function liveScore(now) {
    if (!match || phase === 'betting') return { home: 0, away: 0 };
    if (phase === 'results') return { home: match.homeScore, away: match.awayScore };
    const elapsed = now - phaseStartMs;
    let home = 0;
    let away = 0;
    for (const ev of match.events) {
      if (ev.type !== 'goal' || ev.atMs > elapsed) continue;
      if (ev.team === 'home') home += 1;
      else away += 1;
    }
    return { home, away };
  }

  function visibleEvents(now) {
    if (!match || phase === 'betting') return [];
    const elapsed = phase === 'results' ? Infinity : now - phaseStartMs;
    return match.events.filter((ev) => ev.atMs <= elapsed);
  }

  function getPublicState() {
    tick();
    const now = Date.now();
    const countdown = Math.max(0, Math.ceil((phaseEndsMs - now) / 1000));
    const score = liveScore(now);
    const roundBets = [...bets.values()].filter((b) => b.roundId === roundSeq);

    return {
      roundId: roundSeq,
      phase,
      countdown,
      totalBets: roundBets.length,
      history: [...history],
      match: match && match.roundId === roundSeq
        ? {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            homeScore: score.home,
            awayScore: score.away,
            finalHomeScore: match.resolved ? match.homeScore : null,
            finalAwayScore: match.resolved ? match.awayScore : null,
            outcome: phase === 'results' ? match.outcome : null,
            winner: phase === 'results' ? match.winner : null,
            events: visibleEvents(now),
          }
        : null,
    };
  }

  function placeBet(platformKey, prediction, amount) {
    tick();
    if (phase !== 'betting') return { ok: false, message: 'Betting closed — wait for next match' };
    if (!['home', 'away', 'draw'].includes(prediction)) {
      return { ok: false, message: 'Pick home, away, or draw' };
    }
    const existing = bets.get(platformKey);
    if (existing && existing.roundId === roundSeq) {
      return { ok: false, message: 'Already bet this match' };
    }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return { ok: false, message: 'Invalid bet amount' };

    bets.set(platformKey, { roundId: roundSeq, prediction, amount: amt, status: 'pending' });
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
      return { winAmount: bet.winAmount, prediction: bet.prediction };
    }
    if (bet.status === 'lost' && phase === 'results') bet.settled = true;
    return null;
  }

  startBettingRound();

  return { config, getPublicState, placeBet, serializePlayer, pullSettlement };
}

let singleton = null;

export function getFootballClashEngine() {
  if (!singleton) singleton = createFootballClashEngine();
  return singleton;
}
