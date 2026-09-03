import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, LINE_COUNT } from './config.mjs';
import { spinRoundTot, evaluatePaylines, plantWinningReels } from './reel-spin.mjs';
import { spinEgyptTreasures } from './spin.mjs';

describe('egypt-treasures config', () => {
  it('uses 5×3 grid with 10 paylines', () => {
    assert.equal(COLS, 5);
    assert.equal(ROWS, 3);
    assert.equal(LINE_COUNT, 10);
  });
});

describe('egypt-treasures spin', () => {
  it('returns deal event and client-safe symbols', () => {
    const session = { balance: 100_000 };
    const result = spinEgyptTreasures(session, 20, { spinId: 1, forceWin: true });
    assert.equal(result.symbols.length, COLS);
    assert.ok(result.events.some((e) => e.type === 'deal'));
    for (const col of result.symbols) {
      for (const sym of col) assert.ok(sym >= 0 && sym <= 8);
    }
  });

  it('force win produces line_win', () => {
    const session = { balance: 100_000 };
    const result = spinEgyptTreasures(session, 20, { spinId: 2, forceWin: true });
    assert.ok(result.events.some((e) => e.type === 'line_win'));
  });

  it('cash coins emit pot_collect', () => {
    const session = { balance: 100_000 };
    const result = spinEgyptTreasures(session, 20, { spinId: 3, forceCashCount: 2 });
    assert.ok(result.events.some((e) => e.type === 'pot_collect'));
  });

  it('planted win pays on reels', () => {
    const reels = plantWinningReels();
    const { wins } = evaluatePaylines(reels, 2, LINE_COUNT);
    assert.ok(wins.length >= 1);
  });
});
