import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWalletForOperator } from './wallet-adapter.mjs';
import { resolveOperator } from '../auth/operator-auth.mjs';
import { DEFAULT_BALANCE } from '../config.mjs';

describe('wallet adapter', () => {
  it('uses HTTP wallet for op_riko even when WALLET_MOCK is enabled in dev', async () => {
    const operator = resolveOperator('op_riko');
    assert.ok(operator);
    assert.equal(operator.wallet.mode, 'http');
    const wallet = createWalletForOperator(operator);
    const ctx = { operator, playerId: 'test-player', sessionKey: 'riko:test-player' };
    await assert.rejects(() => wallet.getBalance(ctx));
  });

  it('uses mock wallet for demo operators', async () => {
    const operator = resolveOperator('op_demo_all');
    assert.ok(operator);
    const wallet = createWalletForOperator(operator);
    const ctx = {
      operator,
      playerId: 'wallet-test-demo',
      sessionKey: `demo-all:wallet-test-demo-${Date.now()}`,
    };
    const balance = await wallet.getBalance(ctx);
    assert.equal(balance, DEFAULT_BALANCE);
  });
});
