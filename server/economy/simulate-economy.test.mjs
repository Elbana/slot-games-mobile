import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from './simulate-economy.mjs';

describe('economy simulation', () => {
  it('keeps all prize pools solvent over sample rounds', () => {
    const report = runSimulation({ rounds: 500, bet: 1000 });
    assert.equal(report.games.length, 6);

    for (const g of report.games) {
      assert.equal(g.solvency, 'ok', `${g.slug} pool insolvency`);
      assert.ok(g.minPool >= 0, `${g.slug} min pool below zero`);
      assert.ok(g.finalPool >= 0, `${g.slug} final pool below zero`);
      assert.ok(g.rtp >= 0 && g.rtp <= 200, `${g.slug} rtp out of range`);
    }
  });
});
