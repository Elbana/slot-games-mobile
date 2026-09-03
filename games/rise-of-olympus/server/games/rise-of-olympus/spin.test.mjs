import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, MIN_CLUSTER, clusterPayCoins } from './config.mjs';
import { findClusters, runCascadeRound } from './cascade.mjs';
import { spinThronesOfOlympus, toClientGrid } from './spin.mjs';

describe('thrones-of-olympus config', () => {
  it('uses 6×5 grid with min cluster 8', () => {
    assert.equal(COLS, 6);
    assert.equal(ROWS, 5);
    assert.equal(MIN_CLUSTER, 8);
    assert.ok(clusterPayCoins(9, 12) > clusterPayCoins(0, 8));
  });
});

describe('thrones-of-olympus clusters', () => {
  it('finds horizontal cluster on server grid', () => {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(11));
    for (let c = 0; c < COLS; c++) {
      grid[0][c] = 0;
      grid[1][c] = 0;
    }
    const clusters = findClusters(grid);
    assert.equal(clusters.length, 1);
    assert.ok(clusters[0].cells.length >= MIN_CLUSTER);
  });

  it('transposes grid for client col-major format', () => {
    const grid = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => r * 10 + c)
    );
    const client = toClientGrid(grid);
    assert.equal(client[0][0], grid[0][0]);
    assert.equal(client[1][2], grid[2][1]);
  });
});

describe('thrones-of-olympus spin', () => {
  it('returns 6×5 client grid and events', () => {
    const session = { balance: 1_000_000 };
    const result = spinThronesOfOlympus(session, 20, { forceWin: true, spinId: 1 });
    assert.equal(result.symbols.length, COLS);
    assert.equal(result.symbols[0].length, ROWS);
    assert.ok(result.events.some((e) => e.type === 'deal'));
    assert.ok(result.win >= 0);
  });

  it('force win produces cluster_win events', () => {
    const session = { balance: 1_000_000 };
    const result = spinThronesOfOlympus(session, 20, { forceWin: true, spinId: 2 });
    assert.ok(result.events.some((e) => e.type === 'cluster_win'));
  });

  it('events follow deal → cascade → apply order', () => {
    const session = { balance: 1_000_000 };
    let result = null;
    for (let i = 0; i < 5; i++) {
      result = spinThronesOfOlympus(session, 20, { forceWin: true, spinId: 3 + i });
      if (result.events.some((e) => e.type === 'cluster_win')) break;
    }
    assert.equal(result.events[0].type, 'deal');
    const clusterIdx = result.events.findIndex((e) => e.type === 'cluster_win');
    assert.ok(clusterIdx > 0);
    const applyIdx = result.events.findIndex((e) => e.type === 'multiplier_apply');
    if (applyIdx >= 0) {
      assert.ok(applyIdx > clusterIdx);
    }
  });

  it('cascade completes within safety limit', () => {
    const round = runCascadeRound(20, { forceWin: true, coins: 1 });
    assert.ok(round.steps.length <= 12);
  });

  it('multiplier_land events include col and row', () => {
    const session = { balance: 1_000_000 };
    let lands = [];
    for (let i = 0; i < 40 && lands.length === 0; i++) {
      const result = spinThronesOfOlympus(session, 20, { spinId: 100 + i });
      lands = result.events.filter((e) => e.type === 'multiplier_land');
    }
    if (lands.length === 0) return;
    for (const ev of lands) {
      assert.ok(Number.isInteger(ev.col));
      assert.ok(Number.isInteger(ev.row));
      assert.ok(ev.col >= 0 && ev.row >= 0);
    }
  });

  it('free spin multiplier applies to wins', () => {
    process.env.THRONES_FORCE_WIN = '1';
    const session = {
      balance: 1_000_000,
      thronesFs: {
        freeSpinsLeft: 5,
        freeSpinMultiplier: 10,
        fsTotalWin: 0,
        goUltra: false,
        lastFsResolvedSpin: 0,
      },
    };
    const result = spinThronesOfOlympus(session, 20, { spinId: 999 });
    if (result.win > 0) {
      assert.ok(result.win >= result.events.find((e) => e.type === 'multiplier_apply')?.baseWin ?? 0);
    }
    delete process.env.THRONES_FORCE_WIN;
  });

  it('deal event includes scatter metadata', () => {
    const session = { balance: 1_000_000 };
    const result = spinThronesOfOlympus(session, 20, { spinId: 50 });
    const deal = result.events.find((e) => e.type === 'deal');
    assert.ok(deal);
    assert.ok(Array.isArray(deal.scatterPositions));
    assert.ok(typeof deal.scatterCount === 'number');
  });

  it('free_spins_end emitted when FS session completes with win', () => {
    process.env.THRONES_FORCE_WIN = '1';
    const session = {
      balance: 1_000_000,
      thronesFs: {
        freeSpinsLeft: 1,
        freeSpinMultiplier: 5,
        fsTotalWin: 500,
        goUltra: false,
        lastFsResolvedSpin: 0,
      },
    };
    const result = spinThronesOfOlympus(session, 20, { spinId: 888 });
    if (result.state.fsRemaining === 0 && result.win > 0) {
      assert.ok(result.events.some((e) => e.type === 'free_spins_end'));
    }
    delete process.env.THRONES_FORCE_WIN;
  });

  it('FS trigger emits fs_multiplier_update starting at 1', () => {
    const session = { balance: 1_000_000 };
    let found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const s = { balance: 1_000_000 };
      const result = spinThronesOfOlympus(s, 20, { spinId: 2000 + i });
      if (result.events.some((e) => e.type === 'free_spins_awarded')) {
        assert.ok(result.events.some((e) => e.type === 'fs_multiplier_update' && e.value === 1));
        found = true;
      }
    }
  });
});
