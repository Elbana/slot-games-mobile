import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeHistory,
  roundPnL,
  shouldSwitchStrategy,
  simulateSessionPnL,
} from './engine.js';

describe('bet-advisor engine', () => {
  it('computes positive EV for 77 when hit rate exceeds breakeven', () => {
    const history = [
      ...Array(10).fill('77'),
      ...Array(17).fill('fig'),
      ...Array(17).fill('watermelon'),
    ];
    const a = analyzeHistory(history, 48);
    assert.ok(a.ev['77'] > 0);
    assert.equal(a.suggestion.action, '77');
  });

  it('suggests hotter fruit when 77 is rare', () => {
    const history = [
      ...Array(26).fill('fig'),
      ...Array(20).fill('watermelon'),
      ...Array(4).fill('77'),
    ];
    const a = analyzeHistory(history, 50);
    assert.equal(a.mode.id, 'fruit_hot');
    assert.equal(a.suggestion.action, 'fig');
  });

  it('calculates round PnL for single and cover bets', () => {
    assert.equal(roundPnL('watermelon', 'watermelon', 100), 100);
    assert.equal(roundPnL('fig', 'watermelon', 100), -100);
    assert.equal(roundPnL('watermelon', 'cover', 50), 0);
    assert.equal(roundPnL('77', 'cover', 50), -100);
  });

  it('detects strategy switches', () => {
    const prev = analyzeHistory(Array(20).fill('77'), 20).suggestion;
    const next = analyzeHistory([...Array(20).fill('77'), ...Array(10).fill('fig')], 30).suggestion;
    assert.equal(shouldSwitchStrategy(prev, next), prev.action !== next.action);
  });

  it('simulates session PnL', () => {
    const pnl = simulateSessionPnL([
      { result: 'watermelon', action: 'watermelon', betAmount: 10, bankroll: 1000 },
      { result: 'fig', action: 'watermelon', betAmount: 10, bankroll: 1000 },
    ]);
    assert.equal(pnl, 0);
  });
});
