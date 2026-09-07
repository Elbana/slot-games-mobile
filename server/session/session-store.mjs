/**
 * Persistent player sessions — file-backed JSON store.
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_BALANCE, DEFAULT_CHIP, IDEMPOTENCY_CACHE_SIZE, SESSION_DIR } from '../config.mjs';

/** @type {Map<string, object>} */
const cache = new Map();

function sessionPath(sessionKey) {
  const safe = sessionKey.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 160);
  return path.join(SESSION_DIR, `${safe}.json`);
}

function ensureDir() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/** @param {string} sessionKey @param {number} [balanceHint] */
export function loadSession(sessionKey, balanceHint) {
  const cached = cache.get(sessionKey);
  if (cached) {
    if (balanceHint != null && Number.isFinite(balanceHint)) {
      cached.balance = balanceHint;
    }
    return cached;
  }

  ensureDir();
  const file = sessionPath(sessionKey);
  if (fs.existsSync(file)) {
    try {
      const session = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (balanceHint != null && Number.isFinite(balanceHint)) {
        session.balance = balanceHint;
      }
      cache.set(sessionKey, session);
      return session;
    } catch {
      /* fall through */
    }
  }

  const session = {
    balance: balanceHint ?? DEFAULT_BALANCE,
    bet: DEFAULT_CHIP,
    thronesFs: null,
    thronesLastWin: null,
    lottery: {},
    spinCache: {},
    spinCacheOrder: [],
    updatedAt: Date.now(),
  };
  cache.set(sessionKey, session);
  return session;
}

/** @param {string} sessionKey @param {object} session */
export function saveSession(sessionKey, session) {
  session.updatedAt = Date.now();
  cache.set(sessionKey, session);
  ensureDir();
  const file = sessionPath(sessionKey);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(session, null, 0));
  fs.renameSync(tmp, file);
}

/** @param {string} sessionKey @param {string|number} spinId @param {object} result */
export function cacheSpinResult(sessionKey, spinId, result) {
  const session = cache.get(sessionKey);
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

/** @param {string} sessionKey @param {string|number} spinId */
export function getCachedSpin(sessionKey, spinId) {
  const session = cache.get(sessionKey);
  if (!session?.spinCache) return null;
  return session.spinCache[String(spinId)] ?? null;
}
