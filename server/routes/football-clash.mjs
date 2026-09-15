/**
 * Football Clash game API.
 */

import { FOOTBALL_CLASH_GAME } from '../games/football-clash/config.mjs';
import { getFootballClashEngine } from '../games/football-clash/engine.mjs';
import { requireGameAccess } from '../auth/operator-auth.mjs';
import { extractPlayerId, sessionKey } from '../auth/player-context.mjs';
import { createWalletForOperator } from '../wallet/wallet-adapter.mjs';
import { auditWallet } from '../audit.mjs';
import { bettingPayload, getBetConfig, validateBetAmount } from '../betting/bet-config.mjs';
import { recordRound } from '../economy/prize-pool.mjs';
import { touchActiveOperator } from '../economy/pool-guard.mjs';

const SLUG = FOOTBALL_CLASH_GAME.id;
const API = `/api/${SLUG}`;

function ok(data) {
  return { code: 0, msg: 'ok', data };
}

function fail(msg, code = 400) {
  return { code, msg, data: null };
}

function buildContext(req, res) {
  const operator = requireGameAccess(req, res, SLUG);
  if (!operator) return null;
  const playerId = extractPlayerId(req);
  return {
    operator,
    playerId,
    sessionKey: sessionKey(operator, playerId),
    wallet: createWalletForOperator(operator),
    betting: getBetConfig(operator),
    slug: SLUG,
  };
}

async function balanceFromWallet(ctx) {
  return ctx.wallet.getBalance(ctx);
}

async function settlePlayer(engine, ctx) {
  const pending = engine.pullSettlement(ctx.sessionKey);
  if (!pending) return;

  touchActiveOperator(SLUG, ctx.operator);

  if (pending.winAmount > 0) {
    const txId = `football-clash-win-${ctx.sessionKey}-${Date.now()}`;
    await ctx.wallet.credit(ctx, {
      amount: pending.winAmount,
      game: SLUG,
      roundId: String(engine.getPublicState().roundId),
      transactionId: txId,
      reason: 'football_clash_win',
    });
    auditWallet({
      operatorId: ctx.operator.id,
      playerId: ctx.playerId,
      type: 'credit',
      amount: pending.winAmount,
      txId,
      game: SLUG,
    });
  }

  recordRound({
    operator: ctx.operator,
    game: SLUG,
    bet: pending.betAmount,
    baseWin: pending.winAmount,
    playerId: ctx.playerId,
  });
}

export function mountFootballClashRoutes(app) {
  const engine = getFootballClashEngine();

  app.get(`${API}/init`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    try {
      await settlePlayer(engine, ctx);
    } catch {
      /* optional */
    }

    touchActiveOperator(SLUG, ctx.operator);

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch (err) {
      return res.status(502).json(fail(err.message || 'Wallet unavailable', 502));
    }

    res.json(
      ok({
        game: FOOTBALL_CLASH_GAME,
        balance,
        betting: bettingPayload(ctx.betting),
        state: {
          ...engine.getPublicState(),
          myBet: engine.serializePlayer(ctx.sessionKey),
        },
      }),
    );
  });

  app.get(`${API}/state`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    try {
      await settlePlayer(engine, ctx);
    } catch {
      /* ignore */
    }

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch {
      balance = null;
    }

    res.json(
      ok({
        ...engine.getPublicState(),
        balance,
        myBet: engine.serializePlayer(ctx.sessionKey),
      }),
    );
  });

  app.post(`${API}/bet`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    const prediction = String(req.body?.prediction || '').toLowerCase();
    const amount = req.body?.amount ?? req.body?.BetAmount;
    const betCheck = validateBetAmount(amount, ctx.betting);
    if (!betCheck.ok) return res.json(fail(betCheck.error));

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch (err) {
      return res.json(fail(err.message || 'Wallet unavailable', 502));
    }
    if (balance < betCheck.amount) return res.json(fail('Insufficient balance'));

    touchActiveOperator(SLUG, ctx.operator);
    const result = engine.placeBet(ctx.sessionKey, prediction, betCheck.amount, { operator: ctx.operator });
    if (!result.ok) return res.json(fail(result.message));

    const txId = `football-clash-${ctx.sessionKey}-${Date.now()}`;
    try {
      await ctx.wallet.debit(ctx, {
        amount: betCheck.amount,
        game: SLUG,
        roundId: String(result.data.roundId),
        transactionId: txId,
        reason: 'football_clash_bet',
      });
      auditWallet({
        operatorId: ctx.operator.id,
        playerId: ctx.playerId,
        type: 'debit',
        amount: betCheck.amount,
        txId,
        game: SLUG,
      });
    } catch (err) {
      return res.json(fail(err.message || 'Debit failed'));
    }

    let newBalance;
    try {
      newBalance = await balanceFromWallet(ctx);
    } catch {
      newBalance = balance - betCheck.amount;
    }

    res.json(
      ok({
        ...result.data,
        balance: newBalance,
        state: engine.getPublicState(),
        myBet: engine.serializePlayer(ctx.sessionKey),
      }),
    );
  });
}
