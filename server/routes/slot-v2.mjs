/**
 * Slot game API — /api/v2/session and /api/v2/spin
 */

import { spinThronesOfOlympus } from '../games/rise-of-olympus/spin.mjs';
import { effectiveBet, ensureFreeSpinState } from '../games/rise-of-olympus/freespin.mjs';
import { RATE_LIMIT_SPIN_MS } from '../config.mjs';
import { loadSession, saveSession, cacheSpinResult, getCachedSpin } from '../session/session-store.mjs';
import { auditSpin, auditWallet } from '../audit.mjs';
import { requireGameAccess } from '../auth/operator-auth.mjs';
import { extractPlayerId, sessionKey } from '../auth/player-context.mjs';
import { createWalletForOperator } from '../wallet/wallet-adapter.mjs';
import { getOperatorEconomy } from '../economy/operator-economy.mjs';
import { recordRound, tryPoolWin } from '../economy/prize-pool.mjs';
import { runWithMathProfileAsync } from '../math-profile.mjs';
import { bettingPayload, getBetConfig, validateBetAmount } from '../betting/bet-config.mjs';

/** @type {Map<string, number>} */
const lastSpinAt = new Map();

function resolveGameSlug(req) {
  const q = { ...req.query, ...req.body };
  return q.game || 'rise-of-olympus';
}

function buildContext(req, res, slug) {
  const operator = requireGameAccess(req, res, slug);
  if (!operator) return null;
  const playerId = extractPlayerId(req);
  const key = sessionKey(operator, playerId);
  return {
    operator,
    playerId,
    sessionKey: key,
    wallet: createWalletForOperator(operator),
    economy: getOperatorEconomy(operator),
    betting: getBetConfig(operator),
    slug,
  };
}

function sessionState(session) {
  const fs = ensureFreeSpinState(session);
  return {
    fsRemaining: fs.freeSpinsLeft ?? 0,
    fsMultiplier: fs.freeSpinMultiplier ?? 0,
  };
}

function resolveSessionBet(q, session, betting) {
  const parsed = parseInt(q.bet, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    const check = validateBetAmount(parsed, betting);
    if (check.ok) return check.amount;
  }
  const stored = session.bet;
  if (Number.isFinite(stored) && betting.chipUnits.includes(stored)) return stored;
  return betting.defaultChip;
}

export async function handleGetSession(req, res) {
  const slug = resolveGameSlug(req);
  const ctx = buildContext(req, res, slug);
  if (!ctx) return;

  const q = { ...req.query, ...req.body };
  const session = loadSession(ctx.sessionKey);
  if (!ctx.betting.chipUnits.includes(session.bet)) {
    session.bet = ctx.betting.defaultChip;
  }
  session.bet = resolveSessionBet(q, session, ctx.betting);

  try {
    session.balance = await ctx.wallet.getBalance(ctx);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Wallet unavailable' });
  }

  const betting = bettingPayload(ctx.betting);

  res.json({
    game: slug,
    balance: session.balance,
    bet: session.bet,
    betLevels: ctx.betting.chipUnits,
    betting,
    state: sessionState(session),
    playerId: ctx.playerId,
    operatorId: ctx.operator.id,
  });
}

export async function handleV2Spin(req, res) {
  const slug = resolveGameSlug(req);
  const ctx = buildContext(req, res, slug);
  if (!ctx) return;

  const session = loadSession(ctx.sessionKey);
  if (!ctx.betting.chipUnits.includes(session.bet)) {
    session.bet = ctx.betting.defaultChip;
  }
  const q = { ...req.query, ...req.body };
  const betRaw = parseInt(q.bet, 10) || session.bet || ctx.betting.defaultChip;
  const betCheck = validateBetAmount(betRaw, ctx.betting);
  if (!betCheck.ok) {
    return res.status(400).json({ error: betCheck.error });
  }
  const bet = betCheck.amount;
  session.bet = bet;

  const spinId = q.spinId != null ? String(q.spinId) : null;
  if (spinId) {
    const cached = getCachedSpin(ctx.sessionKey, spinId);
    if (cached) {
      return res.json({
        ...cached,
        replay: true,
        betLevels: ctx.betting.chipUnits,
        betting: bettingPayload(ctx.betting),
      });
    }
  }

  const rateKey = ctx.sessionKey;
  const now = Date.now();
  const last = lastSpinAt.get(rateKey) ?? 0;
  if (now - last < RATE_LIMIT_SPIN_MS) {
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const charge = effectiveBet(session, bet);
  let balance;
  try {
    balance = await ctx.wallet.getBalance(ctx);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Wallet unavailable' });
  }

  if (balance < charge) {
    return res.status(400).json({ error: 'Insufficient balance', balance });
  }

  const txId = spinId ?? `spin-${Date.now()}`;
  if (charge > 0) {
    try {
      const debited = await ctx.wallet.debit(ctx, {
        amount: charge,
        game: slug,
        roundId: txId,
        transactionId: `${txId}:debit`,
        reason: 'spin',
      });
      balance = debited.balance;
      auditWallet({ operatorId: ctx.operator.id, playerId: ctx.playerId, type: 'debit', amount: charge, txId });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Debit failed', code: err.code });
    }
  }

  lastSpinAt.set(rateKey, now);
  session.balance = balance;

  const result = await runWithMathProfileAsync(ctx.economy.slotMathProfile, () =>
    spinThronesOfOlympus(session, bet, { spinId: txId, skipBalanceUpdate: true })
  );

  const baseWin = result.win ?? 0;
  const roundBet = charge > 0 ? charge : bet;

  recordRound({
    operator: ctx.operator,
    game: slug,
    bet: roundBet,
    baseWin,
    playerId: ctx.playerId,
  });

  const { poolWin } = tryPoolWin({
    operator: ctx.operator,
    game: slug,
    bet: roundBet,
    baseWin,
    playerId: ctx.playerId,
  });

  const totalWin = baseWin + poolWin;

  if (poolWin > 0) {
    result.events = result.events ?? [];
    result.events.push({ type: 'pool_win', amount: poolWin });
    result.win = totalWin;
  }

  if (totalWin > 0) {
    try {
      const credited = await ctx.wallet.credit(ctx, {
        amount: totalWin,
        game: slug,
        roundId: txId,
        transactionId: `${txId}:credit`,
        reason: poolWin > 0 ? 'win_with_pool' : 'win',
      });
      session.balance = credited.balance;
      auditWallet({
        operatorId: ctx.operator.id,
        playerId: ctx.playerId,
        type: 'credit',
        amount: totalWin,
        baseWin,
        poolWin,
        txId,
      });
    } catch (err) {
      console.error('[slot] credit failed after win', err);
      auditWallet({
        operatorId: ctx.operator.id,
        playerId: ctx.playerId,
        type: 'credit_failed',
        amount: totalWin,
        txId,
        error: err.message,
      });
    }
  } else {
    session.balance = await ctx.wallet.getBalance(ctx);
  }

  result.balance = session.balance;

  const betting = bettingPayload(ctx.betting);

  const response = {
    game: slug,
    spinId: txId,
    ...result,
    betLevels: ctx.betting.chipUnits,
    betting,
    playerId: ctx.playerId,
    operatorId: ctx.operator.id,
    poolWin,
  };

  if (spinId) cacheSpinResult(ctx.sessionKey, spinId, response);
  saveSession(ctx.sessionKey, session);

  auditSpin({
    operatorId: ctx.operator.id,
    playerId: ctx.playerId,
    game: slug,
    spinId: txId,
    bet: result.bet,
    baseWin,
    poolWin,
    win: totalWin,
    balance: session.balance,
    fsRemaining: response.state?.fsRemaining ?? 0,
  });

  res.json(response);
}
