/**
 * Prize pool ledger per operator + game.
 * Net player losses feed the pool; house edge skimmed; pool-funded bonus wins.
 */

import fs from 'fs';
import path from 'path';
import { POOLS_DIR } from '../config.mjs';
import { getOperatorEconomy } from './operator-economy.mjs';
import { auditLog } from '../audit.mjs';

/** @type {Map<string, object>} */
const cache = new Map();

function poolKey(operatorId, gameSlug) {
  return `${operatorId}:${gameSlug}`;
}

function poolPath(operatorId, gameSlug) {
  const safe = `${operatorId}_${gameSlug}`.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 160);
  return path.join(POOLS_DIR, `${safe}.json`);
}

function ensureDir() {
  fs.mkdirSync(POOLS_DIR, { recursive: true });
}

function emptyLedger() {
  return {
    poolBalance: 0,
    houseTaken: 0,
    totalBet: 0,
    totalPaid: 0,
    poolPaid: 0,
    updatedAt: Date.now(),
  };
}

/** @param {string} operatorId @param {string} gameSlug */
export function loadPool(operatorId, gameSlug) {
  const key = poolKey(operatorId, gameSlug);
  if (cache.has(key)) return cache.get(key);

  ensureDir();
  const file = poolPath(operatorId, gameSlug);
  if (fs.existsSync(file)) {
    try {
      const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
      cache.set(key, ledger);
      return ledger;
    } catch {
      /* fall through */
    }
  }

  const ledger = emptyLedger();
  cache.set(key, ledger);
  return ledger;
}

/** @param {string} operatorId @param {string} gameSlug @param {object} ledger */
export function savePool(operatorId, gameSlug, ledger) {
  ledger.updatedAt = Date.now();
  const key = poolKey(operatorId, gameSlug);
  cache.set(key, ledger);
  ensureDir();
  const file = poolPath(operatorId, gameSlug);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 0));
  fs.renameSync(tmp, file);
}

/**
 * Record bet vs base win — update house edge and pool contribution.
 * @param {{ operator: object, game: string, bet: number, baseWin: number, playerId?: string }} opts
 */
export function recordRound({ operator, game, bet, baseWin, playerId }) {
  const economy = getOperatorEconomy(operator);
  const ledger = loadPool(operator.id, game);
  const b = Math.max(0, Math.floor(bet));
  const w = Math.max(0, Math.floor(baseWin));

  ledger.totalBet += b;
  ledger.totalPaid += w;

  const houseAdd = Math.floor((b * economy.houseEdgePercent) / 100);
  ledger.houseTaken += houseAdd;

  const netLoss = Math.max(0, b - w);
  const poolAdd = Math.floor((netLoss * economy.poolContributionPercent) / 100);
  ledger.poolBalance += poolAdd;

  savePool(operator.id, game, ledger);

  auditLog({
    kind: 'pool',
    action: 'record_round',
    operatorId: operator.id,
    game,
    playerId,
    bet: b,
    baseWin: w,
    houseAdd,
    poolAdd,
    poolBalance: ledger.poolBalance,
  });

  return { houseAdd, poolAdd, poolBalance: ledger.poolBalance };
}

/**
 * Attempt a pool-funded bonus win when base outcome was weak.
 * @param {{ operator: object, game: string, bet: number, baseWin: number, playerId?: string }} opts
 * @returns {{ poolWin: number, poolBalance: number }}
 */
export function tryPoolWin({ operator, game, bet, baseWin, playerId }) {
  const economy = getOperatorEconomy(operator);
  const ledger = loadPool(operator.id, game);

  if (ledger.poolBalance <= 0) return { poolWin: 0, poolBalance: ledger.poolBalance };
  if (baseWin >= bet) return { poolWin: 0, poolBalance: ledger.poolBalance };
  if (Math.random() >= economy.poolWinTriggerChance) {
    return { poolWin: 0, poolBalance: ledger.poolBalance };
  }

  const b = Math.max(1, Math.floor(bet));
  const mult = 1 + Math.floor(Math.random() * economy.maxPoolWinMultiplier);
  let poolWin = Math.min(ledger.poolBalance, b * mult);
  poolWin = Math.max(0, Math.floor(poolWin));
  if (poolWin <= 0) return { poolWin: 0, poolBalance: ledger.poolBalance };

  ledger.poolBalance -= poolWin;
  ledger.poolPaid += poolWin;
  ledger.totalPaid += poolWin;
  savePool(operator.id, game, ledger);

  auditLog({
    kind: 'pool',
    action: 'pool_win',
    operatorId: operator.id,
    game,
    playerId,
    poolWin,
    poolBalance: ledger.poolBalance,
  });

  return { poolWin, poolBalance: ledger.poolBalance };
}

/** @param {object} operator @param {string} gameSlug */
export function getPoolStats(operator, gameSlug) {
  const ledger = loadPool(operator.id, gameSlug);
  const economy = getOperatorEconomy(operator);
  return {
    game: gameSlug,
    operatorId: operator.id,
    economy,
    poolBalance: ledger.poolBalance,
    houseTaken: ledger.houseTaken,
    totalBet: ledger.totalBet,
    totalPaid: ledger.totalPaid,
    poolPaid: ledger.poolPaid,
    netHandle: ledger.totalBet - ledger.totalPaid,
    updatedAt: ledger.updatedAt,
  };
}
