/**
 * JSON spin API for Rise of Olympus visual client.
 */

import { spinThronesOfOlympus } from './games/rise-of-olympus/spin.mjs';
import { effectiveBet } from './games/rise-of-olympus/freespin.mjs';
import { BET_LEVELS, RATE_LIMIT_SPIN_MS, REQUIRE_AUTH, API_KEY } from './config.mjs';
import { loadSession, saveSession, cacheSpinResult, getCachedSpin } from './session-store.mjs';
import { auditSpin } from './audit.mjs';

const GAME = 'rise-of-olympus';

/** @type {Map<string, number>} */
const lastSpinAt = new Map();

/**
 * @param {import('express').Request} req
 */
function resolvePlayer(req) {
  const auth = req.headers?.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const token = bearer || req.query.token || req.body?.token;

  if (REQUIRE_AUTH && !token) {
    return { error: 'Authentication required', status: 401 };
  }
  const playerId = token ? String(token) : String(req.query.session || req.body?.session || req.ip || 'default');
  return { playerId };
}

function sessionState(session) {
  const fs = session.thronesFs;
  return {
    fsRemaining: fs?.freeSpinsLeft ?? 0,
    fsMultiplier: fs?.freeSpinMultiplier ?? 0,
  };
}

export function handleGetSession(req, res) {
  const player = resolvePlayer(req);
  if ('error' in player) {
    return res.status(player.status).json({ error: player.error });
  }

  const q = { ...req.query, ...req.body };
  const balanceHint = q.balance != null ? parseInt(q.balance, 10) : undefined;
  const session = loadSession(player.playerId, balanceHint);

  res.json({
    game: GAME,
    balance: session.balance,
    bet: session.bet ?? 20,
    betLevels: BET_LEVELS,
    state: sessionState(session),
    playerId: player.playerId,
  });
}

export function handleV2Spin(req, res) {
  const player = resolvePlayer(req);
  if ('error' in player) {
    return res.status(player.status).json({ error: player.error });
  }

  const q = { ...req.query, ...req.body };
  const balanceHint = q.balance != null ? parseInt(q.balance, 10) : undefined;
  const session = loadSession(player.playerId, balanceHint);

  const bet = parseInt(q.bet, 10) || session.bet || 20;
  if (!BET_LEVELS.includes(bet)) {
    return res.status(400).json({ error: `Invalid bet. Allowed: ${BET_LEVELS.join(', ')}` });
  }
  session.bet = bet;

  const spinId = q.spinId != null ? String(q.spinId) : null;
  if (spinId) {
    const cached = getCachedSpin(player.playerId, spinId);
    if (cached) {
      return res.json({ ...cached, replay: true });
    }
  }

  const now = Date.now();
  const last = lastSpinAt.get(player.playerId) ?? 0;
  if (now - last < RATE_LIMIT_SPIN_MS) {
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const charge = effectiveBet(session, bet);
  if (session.balance < charge) {
    return res.status(400).json({ error: 'Insufficient balance', balance: session.balance });
  }

  lastSpinAt.set(player.playerId, now);

  const result = spinThronesOfOlympus(session, bet, { spinId: spinId ?? Date.now() });

  const response = {
    game: GAME,
    spinId: spinId ?? result.spinId,
    ...result,
    betLevels: BET_LEVELS,
  };

  if (spinId) cacheSpinResult(player.playerId, spinId, response);
  saveSession(player.playerId, session);

  auditSpin({
    playerId: player.playerId,
    game: GAME,
    spinId: response.spinId,
    bet: response.bet,
    win: response.win,
    balance: response.balance,
    fsRemaining: response.state?.fsRemaining ?? 0,
  });

  res.json(response);
}
