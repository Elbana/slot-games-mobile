/**
 * In-process wallet for dev/demo — balance stored in session store.
 */

import { loadSession, saveSession } from '../session/session-store.mjs';
import { DEFAULT_BALANCE } from '../config.mjs';

/** @returns {import('./wallet-adapter.mjs').WalletAdapter} */
export function createMockWallet() {
  return {
    async getBalance(ctx) {
      const session = loadSession(ctx.sessionKey);
      if (session.balance == null) session.balance = DEFAULT_BALANCE;
      return session.balance;
    },

    async debit(ctx, tx) {
      const session = loadSession(ctx.sessionKey);
      const balance = session.balance ?? DEFAULT_BALANCE;
      if (balance < tx.amount) {
        const err = new Error('Insufficient balance');
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
      }
      session.balance = balance - tx.amount;
      session.walletTx = session.walletTx ?? {};
      session.walletTx[tx.transactionId] = { type: 'debit', ...tx, at: Date.now() };
      saveSession(ctx.sessionKey, session);
      return { balance: session.balance, transactionId: tx.transactionId };
    },

    async credit(ctx, tx) {
      const session = loadSession(ctx.sessionKey);
      const balance = session.balance ?? DEFAULT_BALANCE;
      session.balance = balance + tx.amount;
      session.walletTx = session.walletTx ?? {};
      session.walletTx[tx.transactionId] = { type: 'credit', ...tx, at: Date.now() };
      saveSession(ctx.sessionKey, session);
      return { balance: session.balance, transactionId: tx.transactionId };
    },

    async rollback(ctx, tx) {
      const session = loadSession(ctx.sessionKey);
      const prev = session.walletTx?.[tx.transactionId];
      if (!prev) return;
      if (prev.type === 'debit') session.balance = (session.balance ?? 0) + prev.amount;
      if (prev.type === 'credit') session.balance = Math.max(0, (session.balance ?? 0) - prev.amount);
      delete session.walletTx[tx.transactionId];
      saveSession(ctx.sessionKey, session);
    },
  };
}
