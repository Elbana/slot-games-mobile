import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmpPools = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-pools-'));
process.env.POOLS_DIR = tmpPools;

const { recordRound, tryPoolWin, getPoolStats, loadPool } = await import('./prize-pool.mjs');
const { getOperatorEconomy } = await import('./operator-economy.mjs');

const operator = {
  id: 'test-op',
  economy: {
    houseEdgePercent: 10,
    poolContributionPercent: 50,
    poolWinTriggerChance: 1,
    maxPoolWinMultiplier: 5,
  },
};

after(() => {
  fs.rmSync(tmpPools, { recursive: true, force: true });
});

describe('operator economy', () => {
  it('applies defaults for missing fields', () => {
    const e = getOperatorEconomy({});
    assert.equal(e.houseEdgePercent, 3);
    assert.equal(e.slotMathProfile, 'voice_social');
  });

  it('clamps invalid percentages', () => {
    const e = getOperatorEconomy({ economy: { houseEdgePercent: 200, poolWinTriggerChance: 2 } });
    assert.equal(e.houseEdgePercent, 100);
    assert.equal(e.poolWinTriggerChance, 1);
  });
});

describe('prize pool ledger', () => {
  it('grows pool and house on net loss', () => {
    recordRound({ operator, game: 'greedy', bet: 100, baseWin: 0 });
    const stats = getPoolStats(operator, 'greedy');
    assert.equal(stats.houseTaken, 10);
    assert.equal(stats.poolBalance, 50);
    assert.equal(stats.totalBet, 100);
  });

  it('pays pool win and debits pool balance', () => {
    const before = loadPool(operator.id, 'greedy').poolBalance;
    assert.ok(before >= 50);
    const { poolWin, poolBalance } = tryPoolWin({
      operator,
      game: 'greedy',
      bet: 1000,
      baseWin: 0,
      playerId: 'p1',
    });
    assert.ok(poolWin > 0);
    assert.equal(poolBalance, before - poolWin);
  });

  it('does not pool-win when baseWin covers bet', () => {
    recordRound({ operator, game: 'rise-of-olympus', bet: 50, baseWin: 50 });
    const { poolWin } = tryPoolWin({
      operator,
      game: 'rise-of-olympus',
      bet: 50,
      baseWin: 50,
    });
    assert.equal(poolWin, 0);
  });
});
