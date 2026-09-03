import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, LINE_COUNT } from './config.mjs';
import { flatToClientGrid } from './grid.mjs';
import {
  spinFromStrips,
  plantWinningReels,
  evaluatePaylines,
  countTreasureScatters,
} from './reel-spin.mjs';
import { spinFootballGold } from './spin.mjs';
import { isInFreeSpins } from './freespin.mjs';

describe('football-gold config', () => {
  it('uses 5×3 grid with 10 paylines', () => {
    assert.equal(COLS, 5);
    assert.equal(ROWS, 3);
    assert.equal(LINE_COUNT, 10);
  });
});

describe('football-gold reels', () => {
  it('returns client col-major grid from visible flat', () => {
    const reels = spinFromStrips();
    const client = flatToClientGrid(reels.flatMap((col) => col));
    assert.equal(client.length, COLS);
    assert.equal(client[0].length, ROWS);
  });

  it('planted win produces line pays', () => {
    const reels = plantWinningReels();
    const { wins } = evaluatePaylines(reels, 2, LINE_COUNT);
    assert.ok(wins.length >= 1);
    assert.ok(wins[0].coins > 0);
  });
});

describe('football-gold spin', () => {
  it('returns symbols and events', () => {
    const session = { balance: 100_000 };
    const result = spinFootballGold(session, 20, { spinId: 1, forceWin: true });
    assert.equal(result.symbols.length, COLS);
    assert.ok(result.events.some((e) => e.type === 'deal'));
    assert.ok(result.win >= 0);
  });

  it('force win produces line_win event', () => {
    const session = { balance: 100_000 };
    const result = spinFootballGold(session, 20, { spinId: 2, forceWin: true });
    assert.ok(result.events.some((e) => e.type === 'line_win'));
  });

  it('scatter trigger awards free spins via wheel', () => {
    const session = { balance: 100_000 };
    const result = spinFootballGold(session, 20, { spinId: 3, forceScatterCount: 3 });
    assert.ok(result.events.some((e) => e.type === 'scatter_show'));
    assert.ok(result.events.some((e) => e.type === 'wheel_spin'));
    assert.ok(result.events.some((e) => e.type === 'free_spins_awarded'));
    assert.ok((result.state.fsRemaining ?? 0) > 0);
  });

  it('free spin path uses FS logic without charging bet', () => {
    const session = { balance: 100_000 };
    spinFootballGold(session, 20, { spinId: 10, forceScatterCount: 3 });
    assert.ok(isInFreeSpins(session));
    const before = session.balance;
    const fsResult = spinFootballGold(session, 20, { spinId: 11 });
    assert.equal(fsResult.bet, 0);
    assert.ok(fsResult.events.some((e) => e.type === 'deal'));
    assert.ok(session.balance >= before - 20);
  });

  it('coin scatter produces coin_win event', () => {
    const session = { balance: 100_000 };
    const result = spinFootballGold(session, 20, { spinId: 4, forceCoinCount: 2 });
    assert.ok(result.events.some((e) => e.type === 'coin_win'));
  });

  it('sanitized symbols stay within client range', () => {
    const session = { balance: 100_000 };
    const result = spinFootballGold(session, 20, { spinId: 5, forceCoinCount: 1 });
    for (const col of result.symbols) {
      for (const sym of col) {
        assert.ok(sym >= 0 && sym <= 9);
      }
    }
  });
});

describe('football-gold scatter detection', () => {
  it('counts treasure scatters on middle reels only', () => {
    const reels = spinFromStrips();
    for (const col of reels) {
      for (let row = 0; row < col.length; row++) {
        if (col[row] === 9) col[row] = 0;
      }
    }
    for (const col of [1, 2, 3]) reels[col][1] = 9;
    assert.equal(countTreasureScatters(reels), 3);
  });
});
