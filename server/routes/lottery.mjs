/**
 * Lottery API with operator auth + wallet integration.
 */

import {
  initLotteryEngines,
  listLotteryGames,
  handleOddList,
  handlePeriodList,
  handleIncomeRankToday,
  handlePeriodTrend,
  safeHandler,
} from '../games/lottery/routes.mjs';
import { GREEDY_GAME } from '../games/greedy/config.mjs';
import { PETS_BEASTS_GAME } from '../games/pets-beasts/config.mjs';
import { requireGameAccess } from '../auth/operator-auth.mjs';
import { extractPlayerId, sessionKey } from '../auth/player-context.mjs';
import { createWalletForOperator } from '../wallet/wallet-adapter.mjs';
import { loadSession, saveSession } from '../session/session-store.mjs';
import { auditWallet } from '../audit.mjs';
import {
  getLotterySession,
  linkLotterySession,
  lotteryBalanceFromWallet,
  lotteryDebit,
  lotteryCredit,
} from '../games/lottery/session.mjs';
import { resolveEngineFromBody, resolveEngineForGameId } from '../games/lottery/routes.mjs';
import { getOperatorEconomy } from '../economy/operator-economy.mjs';
import { recordRound, tryPoolWin } from '../economy/prize-pool.mjs';
import { bettingPayload, getBetConfig, validateBetAmount } from '../betting/bet-config.mjs';

const GAME_DEFS = [GREEDY_GAME, PETS_BEASTS_GAME];

function slugForTypCode(typCode) {
  const def = GAME_DEFS.find((g) => g.typCode === typCode);
  return def?.id ?? null;
}

function buildContext(req, res, slug) {
  const operator = requireGameAccess(req, res, slug);
  if (!operator) return null;
  const playerId = extractPlayerId(req);
  return {
    operator,
    playerId,
    sessionKey: sessionKey(operator, playerId),
    wallet: createWalletForOperator(operator),
    economy: getOperatorEconomy(operator),
    betting: getBetConfig(operator),
    slug,
  };
}

function ok(data) {
  return { code: 0, msg: 'ok', data };
}

function bigoOk(data) {
  return { status: { Code: 'ES_1000', Message: 'ok' }, data };
}

function respond(res, data, req) {
  const useBigo = req?.headers?.['x-bigo-format'] === '1' || (req?.path || '').includes('/bigo/');
  res.json(useBigo ? bigoOk(data) : ok(data));
}

function fail(msg, code = 400) {
  return { code, msg, data: null };
}

export function mountLotteryRoutes(app) {
  initLotteryEngines();

  app.get('/api/lottery/:gameId/init', safeHandler(async (req, res) => {
    const slug = req.params.gameId;
    const ctx = buildContext(req, res, slug);
    if (!ctx) return;

    const engine = resolveEngineForGameId(slug);
    if (!engine) return res.status(404).json(fail('Unknown game'));

    const lotterySession = getLotterySession();
    linkLotterySession(lotterySession, ctx);

    let balance;
    try {
      balance = await lotteryBalanceFromWallet(ctx);
    } catch (err) {
      return res.status(502).json(fail(err.message || 'Wallet unavailable', 502));
    }

    const def = GAME_DEFS.find((g) => g.id === slug);
    res.json(
      ok({
        game: def,
        sessionId: lotterySession.id,
        balance,
        symbols: def.symbols,
        betState: engine.getBetState(),
        betting: bettingPayload(ctx.betting),
        playerId: ctx.playerId,
        operatorId: ctx.operator.id,
      })
    );
  }));

  app.post('/bigo/v1/odd_list', safeHandler((req, res) => handleOddList(req, res)));
  app.post('/bigo/v1/period_list', safeHandler((req, res) => handlePeriodList(req, res)));
  app.post('/bigo/v1/income_rank_today', safeHandler((req, res) => handleIncomeRankToday(req, res)));
  app.post('/uapi/v2/period_list', safeHandler((req, res) => handlePeriodList(req, res)));
  app.post('/bigo/v1/period_trend', safeHandler((req, res) => handlePeriodTrend(req, res)));

  app.post('/bigo/v1/bet_state', safeHandler(async (req, res) => {
    const engine = resolveEngineFromBody(req.body);
    if (!engine) return res.json(fail('Unknown game'));
    const slug = slugForTypCode(engine.config.typCode);
    const ctx = buildContext(req, res, slug);
    if (!ctx) return;

    const lotterySession = getLotterySession(req.headers['x-lottery-session'] || req.body?.SessionId);
    linkLotterySession(lotterySession, ctx);

    const state = engine.getBetState();
    let settlement = null;

    if (
      state.Stage === 4 &&
      state.LastNum?.length &&
      state.LastPeriod &&
      lotterySession.lastSettledPeriod !== state.LastPeriod
    ) {
      settlement = await settleWithWallet(engine, lotterySession, ctx);
      lotterySession.lastSettledPeriod = state.LastPeriod;
    }

    let balance;
    try {
      balance = await lotteryBalanceFromWallet(ctx);
    } catch {
      balance = 0;
    }

    respond(
      res,
      {
        ...state,
        Balance: balance,
        SessionId: lotterySession.id,
        Items: [],
        LastTop: [],
        ...(settlement?.winAmount ? { WinAmount: settlement.winAmount, WinCodes: settlement.winCodes } : {}),
      },
      req
    );
  }));

  app.post('/bigo/v1/bet', safeHandler(async (req, res) => {
    const engine = resolveEngineFromBody(req.body);
    if (!engine) return res.json(fail('Unknown game'));
    const slug = slugForTypCode(engine.config.typCode);
    const ctx = buildContext(req, res, slug);
    if (!ctx) return;

    const lotterySession = getLotterySession(req.headers['x-lottery-session'] || req.body?.SessionId);
    linkLotterySession(lotterySession, ctx);

    const playCode = req.body?.PlayCode || req.body?.playCode;
    const amount = req.body?.BetAmount ?? req.body?.betAmount;

    const result = await placeBetWithWallet(engine, lotterySession, ctx, playCode, amount);
    if (!result.ok) return res.json(fail(result.message, result.code));

    let balance;
    try {
      balance = await lotteryBalanceFromWallet(ctx);
    } catch {
      balance = 0;
    }

    respond(res, { ...result.data, Balance: balance, SessionId: lotterySession.id }, req);
  }));
}

async function placeBetWithWallet(engine, lotterySession, ctx, playCode, amount) {
  const phase = engine.getBetState();
  if (phase.Stage !== 1) return { ok: false, code: 400, message: 'Betting closed' };

  const betCheck = validateBetAmount(amount, ctx.betting);
  if (!betCheck.ok) return { ok: false, code: 400, message: betCheck.error };
  const amt = betCheck.amount;

  let balance;
  try {
    balance = await lotteryBalanceFromWallet(ctx);
  } catch (err) {
    return { ok: false, code: 502, message: err.message || 'Wallet unavailable' };
  }
  if (balance < amt) return { ok: false, code: 400, message: 'Insufficient balance' };

  const txId = `lottery-${lotterySession.id}-${Date.now()}`;
  try {
    await lotteryDebit(ctx, {
      amount: amt,
      game: ctx.slug,
      roundId: phase.Period,
      transactionId: txId,
      reason: 'lottery_bet',
    });
    auditWallet({ operatorId: ctx.operator.id, playerId: ctx.playerId, type: 'debit', amount: amt, txId, game: ctx.slug });
  } catch (err) {
    return { ok: false, code: 400, message: err.message || 'Debit failed' };
  }

  const engineResult = engine.placeBet(
    lotterySession.id,
    playCode,
    amt,
    () => balance - amt,
    () => {}
  );

  if (!engineResult.ok) {
    try {
      await ctx.wallet.rollback?.(ctx, { transactionId: txId });
    } catch (err) {
      console.error('[lottery] rollback failed', err);
    }
    return engineResult;
  }

  recordRound({
    operator: ctx.operator,
    game: ctx.slug,
    bet: amt,
    baseWin: 0,
    playerId: ctx.playerId,
  });

  return engineResult;
}

async function settleWithWallet(engine, lotterySession, ctx) {
  let runningBalance;
  try {
    runningBalance = await lotteryBalanceFromWallet(ctx);
  } catch {
    runningBalance = 0;
  }

  const settlement = engine.settleSession(
    lotterySession.id,
    () => runningBalance,
    (n) => {
      runningBalance = n;
    }
  );

  if (settlement.winAmount > 0) {
    recordRound({
      operator: ctx.operator,
      game: ctx.slug,
      bet: 0,
      baseWin: settlement.winAmount,
      playerId: ctx.playerId,
    });

    const { poolWin } = tryPoolWin({
      operator: ctx.operator,
      game: ctx.slug,
      bet: settlement.winAmount,
      baseWin: settlement.winAmount,
      playerId: ctx.playerId,
    });

    const totalWin = settlement.winAmount + poolWin;

    const txId = `lottery-win-${lotterySession.id}-${Date.now()}`;
    try {
      await lotteryCredit(ctx, {
        amount: totalWin,
        game: ctx.slug,
        roundId: engine.getBetState().LastPeriod,
        transactionId: txId,
        reason: poolWin > 0 ? 'lottery_win_with_pool' : 'lottery_win',
      });
      auditWallet({
        operatorId: ctx.operator.id,
        playerId: ctx.playerId,
        type: 'credit',
        amount: totalWin,
        baseWin: settlement.winAmount,
        poolWin,
        txId,
        game: ctx.slug,
      });
    } catch (err) {
      console.error('[lottery] settlement credit failed', err);
    }

    if (poolWin > 0) settlement.poolWin = poolWin;
  }

  return settlement;
}

export { listLotteryGames };
