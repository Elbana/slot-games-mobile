/**
 * Persistent player sessions — file-backed JSON store.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_BALANCE, DEFAULT_BET, BET_LEVELS, IDEMPOTENCY_CACHE_SIZE } from './config.mjs';

/** @type {Map<string, object>} */
const cache = new Map();

function getSessionDir() {
  return process.env.SESSION_DIR || './data/sessions';
}

function sessionPath(playerId) {
  const safe = playerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return path.join(getSessionDir(), `${safe}.json`);
}

function ensureDir() {
  fs.mkdirSync(getSessionDir(), { recursive: true });
}

/**
 * @param {string} playerId
 * @param {number} [balanceHint]
 */
export function loadSession(playerId, balanceHint) {
  const cached = cache.get(playerId);
  if (cached) {
    if (balanceHint != null && Number.isFinite(balanceHint)) {
      cached.balance = balanceHint;
    }
    return cached;
  }

  ensureDir();
  const file = sessionPath(playerId);
  if (fs.existsSync(file)) {
    try {
      const session = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (balanceHint != null && Number.isFinite(balanceHint)) {
        session.balance = balanceHint;
      }
      if (!BET_LEVELS.includes(session.bet)) {
        session.bet = DEFAULT_BET;
      }
      cache.set(playerId, session);
      return session;
    } catch {
      /* fall through */
    }
  }

  const session = {
    balance: balanceHint ?? DEFAULT_BALANCE,
    bet: DEFAULT_BET,
    thronesFs: null,
    thronesLastWin: null,
    spinCache: {},
    spinCacheOrder: [],
    updatedAt: Date.now(),
  };
  cache.set(playerId, session);
  return session;
}

/** @param {string} playerId @param {object} session */
export function saveSession(playerId, session) {
  session.updatedAt = Date.now();
  cache.set(playerId, session);
  ensureDir();
  const file = sessionPath(playerId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(session, null, 0));
  fs.renameSync(tmp, file);
}

/** @param {string} playerId @param {string|number} spinId @param {object} result */
export function cacheSpinResult(playerId, spinId, result) {
  const session = cache.get(playerId);
  if (!session) return;
  const key = String(spinId);
  session.spinCache = session.spinCache ?? {};
  session.spinCacheOrder = session.spinCacheOrder ?? [];
  if (!session.spinCache[key]) {
    session.spinCacheOrder.push(key);
    while (session.spinCacheOrder.length > IDEMPOTENCY_CACHE_SIZE) {
      const old = session.spinCacheOrder.shift();
      delete session.spinCache[old];
    }
  }
  session.spinCache[key] = result;
}

/** @param {string} playerId @param {string|number} spinId */
export function getCachedSpin(playerId, spinId) {
  const session = cache.get(playerId);
  if (!session?.spinCache) return null;
  return session.spinCache[String(spinId)] ?? null;
}
