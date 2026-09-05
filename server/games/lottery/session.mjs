/**
 * Lottery player sessions linked to platform wallet context.
 */

const sessions = new Map();

function randomId(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** @param {string} [sessionId] */
export function getLotterySession(sessionId) {
  if (sessionId && sessions.has(sessionId)) return sessions.get(sessionId);
  const id = sessionId || randomId();
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      lastSettledPeriod: '',
      platformKey: null,
      operatorId: null,
      playerId: null,
    });
  }
  return sessions.get(id);
}

/** @param {object} lotterySession @param {object} ctx */
export function linkLotterySession(lotterySession, ctx) {
  lotterySession.platformKey = ctx.sessionKey;
  lotterySession.operatorId = ctx.operator.id;
  lotterySession.playerId = ctx.playerId;
  lotterySession.wallet = ctx.wallet;
}

export async function lotteryBalanceFromWallet(ctx) {
  return ctx.wallet.getBalance(ctx);
}

export async function lotteryDebit(ctx, tx) {
  return ctx.wallet.debit(ctx, tx);
}

export async function lotteryCredit(ctx, tx) {
  return ctx.wallet.credit(ctx, tx);
}

/** @deprecated local balance helpers for legacy callers */
export function lotteryBalance(session) {
  return 0;
}

/** @deprecated */
export function setLotteryBalance(_session, _amount) {}
