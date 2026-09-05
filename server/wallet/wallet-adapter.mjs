/**
 * Wallet adapter interface — operator-backed balance and transactions.
 */

import { createMockWallet } from './wallet-mock.mjs';
import { createOperatorHttpWallet } from './operator-http.mjs';
import { WALLET_MOCK } from '../config.mjs';

/** @typedef {object} WalletContext
 * @property {object} operator
 * @property {string} playerId
 * @property {string} sessionKey
 */

/** @typedef {object} WalletAdapter
 * @property {(ctx: WalletContext) => Promise<number>} getBalance
 * @property {(ctx: WalletContext, tx: object) => Promise<{ balance: number, transactionId: string }>} debit
 * @property {(ctx: WalletContext, tx: object) => Promise<{ balance: number, transactionId: string }>} credit
 * @property {(ctx: WalletContext, tx: object) => Promise<void>} [rollback]
 */

/** @param {object} operator */
export function createWalletForOperator(operator) {
  const mode = operator?.wallet?.mode || (WALLET_MOCK ? 'mock' : 'http');
  if (mode === 'mock' || WALLET_MOCK) return createMockWallet();
  return createOperatorHttpWallet(operator.wallet);
}

/** @param {WalletContext} ctx @param {object} operator */
export function walletForContext(ctx, operator) {
  return createWalletForOperator(operator);
}
