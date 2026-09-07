/**
 * Registry + REST handlers for BooAn-style lottery API.
 */

import { createLotteryEngine } from './engine.mjs';
import { getLotterySession, lotteryBalance, setLotteryBalance } from './session.mjs';
import { GREEDY_GAME } from '../greedy/config.mjs';
import { PETS_BEASTS_GAME } from '../pets-beasts/config.mjs';

/** @type {Map<string, ReturnType<typeof createLotteryEngine>>} */
const engines = new Map();

const GAME_DEFS = [GREEDY_GAME, PETS_BEASTS_GAME];

function engineKey(typCode, lotteryCode) {
  return `${typCode}:${lotteryCode}`;
}

function resolveEngine(typCode, lotteryCode) {
  const key = engineKey(typCode, lotteryCode);
  if (engines.has(key)) return engines.get(key);
  const def = GAME_DEFS.find((g) => g.typCode === typCode && g.lotteryCode === lotteryCode);
  if (!def) return null;
  const engine = createLotteryEngine(def);
  engines.set(key, engine);
  return engine;
}

function resolveEngineFromBody(body = {}) {
  const typCode = body.TypCode || body.TypeCode || body.typCode;
  const lotteryCode = body.LotteryCode || body.lotteryCode;
  if (!typCode && lotteryCode) {
    const def = GAME_DEFS.find((g) => g.lotteryCode === lotteryCode);
    if (def) return resolveEngine(def.typCode, lotteryCode);
  }
  return resolveEngine(typCode, lotteryCode);
}

export function resolveEngineForGameId(gameId) {
  const def = GAME_DEFS.find((g) => g.id === gameId);
  if (!def) return null;
  return resolveEngine(def.typCode, def.lotteryCode);
}

export { resolveEngineFromBody };

function ok(data) {
  return { code: 0, msg: 'ok', data };
}

/** 121233.com Vue client expects this envelope on /bigo routes. */
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

function sessionFromReq(req) {
  const id = req.headers['x-lottery-session'] || req.body?.SessionId || req.body?.sessionId;
  return getLotterySession(typeof id === 'string' ? id : undefined);
}

/** Prevent handler throws from taking down the process. */
export function safeHandler(fn) {
  return (req, res) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch((err) => {
        console.error('[lottery]', req.method, req.path, err);
        if (!res.headersSent) res.status(500).json({ code: 500, msg: err?.message || 'Internal error', data: null });
      });
  };
}

export function listLotteryGames() {
  return GAME_DEFS.map((g) => ({
    id: g.id,
    name: g.name,
    typCode: g.typCode,
    lotteryCode: g.lotteryCode,
    playUrl: `/play/${g.id}`,
    symbolCount: g.symbols.length,
  }));
}

export function handleOddList(req, res) {
  const engine = resolveEngineFromBody(req.body);
  if (!engine) return res.json(fail('Unknown game'));
  respond(res, engine.getOddList(), req);
}

export function handleBetState(req, res) {
  const engine = resolveEngineFromBody(req.body);
  if (!engine) return res.json(fail('Unknown game'));
  const session = sessionFromReq(req);
  const state = engine.getBetState();

  let settlement = null;
  if (
    state.Stage === 4 &&
    state.LastNum?.length &&
    state.LastPeriod &&
    session.lastSettledPeriod !== state.LastPeriod
  ) {
    settlement = engine.settleSession(
      session.id,
      () => lotteryBalance(session),
      (n) => setLotteryBalance(session, n)
    );
    session.lastSettledPeriod = state.LastPeriod;
  }

  respond(
    res,
    {
      ...state,
      Balance: lotteryBalance(session),
      SessionId: session.id,
      Items: [],
      LastTop: [],
      ...(settlement?.winAmount ? { WinAmount: settlement.winAmount, WinCodes: settlement.winCodes } : {}),
    },
    req
  );
}

export function handlePeriodList(req, res) {
  const engine = resolveEngineFromBody(req.body);
  if (!engine) return res.json(fail('Unknown game'));
  const page = req.body?.Page || { Idx: 1, Size: 20 };
  const list = engine.getPeriodList(page);
  const periods = list.rows.map((row) => ({
    Id: row.PeriodNo,
    PeriodNo: row.PeriodNo,
    Period: row.PeriodNo,
    Result: row.Result,
    OpenAt: row.OpenAt,
    TypCode: engine.config.typCode,
    LotteryCode: engine.config.lotteryCode,
  }));
  respond(
    res,
    {
      ...list,
      rows: list.rows,
      Periods: periods,
      Total: list.Total,
      count: list.Total,
    },
    req
  );
}

export function handleBet(req, res) {
  const engine = resolveEngineFromBody(req.body);
  if (!engine) return res.json(fail('Unknown game'));
  const session = sessionFromReq(req);
  const playCode = req.body?.PlayCode || req.body?.playCode;
  const amount = req.body?.BetAmount ?? req.body?.betAmount;
  const result = engine.placeBet(
    session.id,
    playCode,
    amount,
    () => lotteryBalance(session),
    (n) => setLotteryBalance(session, n)
  );
  if (!result.ok) return res.json(fail(result.message, result.code));
  respond(res, { ...result.data, Balance: lotteryBalance(session), SessionId: session.id }, req);
}

export function handleIncomeRankToday(req, res) {
  respond(
    res,
    {
      Ranks: [
        { Index: 1, NickName: 'Player1', Head: '', Balance: 12500, Win: 8500 },
        { Index: 2, NickName: 'Player2', Head: '', Balance: 8200, Win: 4200 },
        { Index: 3, NickName: 'Player3', Head: '', Balance: 5100, Win: 2100 },
      ],
    },
    req
  );
}

export function handlePeriodTrend(req, res) {
  const engine = resolveEngineFromBody(req.body);
  if (!engine) return res.json(fail('Unknown game'));
  respond(res, { Trends: [] }, req);
}

export function handleLotteryInit(req, res) {
  const gameId = req.params.gameId;
  const def = GAME_DEFS.find((g) => g.id === gameId);
  if (!def) return res.status(404).json(fail('Unknown game'));
  const engine = resolveEngine(def.typCode, def.lotteryCode);
  const session = getLotterySession();
  res.json(
    ok({
      game: def,
      sessionId: session.id,
      balance: lotteryBalance(session),
      symbols: def.symbols,
      betState: engine.getBetState(),
    })
  );
}

/** Pre-warm engines at startup. */
export function initLotteryEngines() {
  for (const def of GAME_DEFS) resolveEngine(def.typCode, def.lotteryCode);
  return GAME_DEFS.length;
}
