/**
 * Rocket crash game API.
 */

import { ROCKET_GAME } from '../games/rocket/config.mjs';
import { getRocketEngine } from '../games/rocket/engine.mjs';
import { requireGameAccess } from '../auth/operator-auth.mjs';
import { extractPlayerId, sessionKey } from '../auth/player-context.mjs';
import { createWalletForOperator } from '../wallet/wallet-adapter.mjs';
import { auditWallet } from '../audit.mjs';
import { bettingPayload, getBetConfig, validateBetAmount } from '../betting/bet-config.mjs';
import { recordRound } from '../economy/prize-pool.mjs';
import { touchActiveOperator } from '../economy/pool-guard.mjs';

const SLUG = ROCKET_GAME.id;
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
    const txId = `rocket-win-${ctx.sessionKey}-${Date.now()}`;
    await ctx.wallet.credit(ctx, {
      amount: pending.winAmount,
      game: SLUG,
      roundId: String(engine.getPublicState().roundId),
      transactionId: txId,
      reason: 'rocket_cashout',
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

export function mountRocketRoutes(app) {
  const engine = getRocketEngine();

  app.get(`${API}/init`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    try {
      await settlePlayer(engine, ctx);
    } catch {
      /* wallet optional on init */
    }

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch (err) {
      return res.status(502).json(fail(err.message || 'Wallet unavailable', 502));
    }

    const presets = ROCKET_GAME.chipPresets;
    res.json(
      ok({
        game: ROCKET_GAME,
        balance,
        betting: {
          ...bettingPayload(ctx.betting),
          chipPresets: presets,
          defaultChip: ROCKET_GAME.defaultChip,
        },
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
      /* ignore settle errors during poll */
    }

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch {
      balance = null;
    }

    const pub = engine.getPublicState();
    const myBet = engine.serializePlayer(ctx.sessionKey);

    res.json(
      ok({
        ...pub,
        balance,
        myBet,
      }),
    );
  });

  app.post(`${API}/bet`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    const amount = req.body?.amount ?? req.body?.BetAmount;
    const autoCashout = Number(req.body?.autoCashout || 0);

    const amt = Math.floor(Number(amount));
    const presetOk = ROCKET_GAME.chipPresets.includes(amt);
    const betCheck = presetOk
      ? { ok: true, amount: amt }
      : validateBetAmount(amount, ctx.betting);
    if (!betCheck.ok) return res.json(fail(betCheck.error));

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch (err) {
      return res.json(fail(err.message || 'Wallet unavailable', 502));
    }
    if (balance < betCheck.amount) return res.json(fail('Insufficient balance'));

    touchActiveOperator(SLUG, ctx.operator);
    const pub = engine.getPublicState();
    if (pub.phase !== 'betting') return res.json(fail('Betting closed — wait for next round'));
    const existing = engine.serializePlayer(ctx.sessionKey);
    if (existing?.status === 'pending') {
      return res.json(fail('Already bet this round'));
    }

    const txId = `rocket-${ctx.sessionKey}-${Date.now()}`;
    try {
      await ctx.wallet.debit(ctx, {
        amount: betCheck.amount,
        game: SLUG,
        roundId: String(pub.roundId),
        transactionId: txId,
        reason: 'rocket_bet',
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

    const result = engine.placeBet(ctx.sessionKey, betCheck.amount, autoCashout, { operator: ctx.operator });
    if (!result.ok) {
      try {
        await ctx.wallet.rollback?.(ctx, { transactionId: txId });
      } catch (rollbackErr) {
        console.error('[rocket] rollback failed after placeBet', rollbackErr);
      }
      return res.json(fail(result.message));
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

  app.post(`${API}/cashout`, async (req, res) => {
    const ctx = buildContext(req, res);
    if (!ctx) return;

    const result = engine.cashOut(ctx.sessionKey);
    if (!result.ok) return res.json(fail(result.message));

    const winAmount = result.data.winAmount;
    const bet = engine.serializePlayer(ctx.sessionKey);
    const txId = `rocket-win-${ctx.sessionKey}-${Date.now()}`;
    try {
      await ctx.wallet.credit(ctx, {
        amount: winAmount,
        game: SLUG,
        roundId: String(engine.getPublicState().roundId),
        transactionId: txId,
        reason: 'rocket_cashout',
      });
      auditWallet({
        operatorId: ctx.operator.id,
        playerId: ctx.playerId,
        type: 'credit',
        amount: winAmount,
        txId,
        game: SLUG,
      });
      recordRound({
        operator: ctx.operator,
        game: SLUG,
        bet: bet?.amount ?? winAmount,
        baseWin: winAmount,
        playerId: ctx.playerId,
      });
    } catch (err) {
      return res.json(fail(err.message || 'Credit failed'));
    }

    let balance;
    try {
      balance = await balanceFromWallet(ctx);
    } catch {
      balance = null;
    }

    res.json(
      ok({
        ...result.data,
        balance,
        myBet: engine.serializePlayer(ctx.sessionKey),
      }),
    );
  });
}
