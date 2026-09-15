import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFootballClashEngine } from './engine.mjs';

describe('football-clash engine placeBet', () => {
  it('stacks bets on the same prediction', () => {
    const engine = createFootballClashEngine();
    const key = 'player-stack';
    assert.equal(engine.placeBet(key, 'home', 200).ok, true);
    const second = engine.placeBet(key, 'home', 500);
    assert.equal(second.ok, true);
    assert.equal(second.data.amount, 700);
    assert.equal(engine.serializePlayer(key).amount, 700);
  });

  it('blocks switching prediction mid-round', () => {
    const engine = createFootballClashEngine();
    const key = 'player-switch';
    assert.equal(engine.placeBet(key, 'home', 200).ok, true);
    const away = engine.placeBet(key, 'away', 200);
    assert.equal(away.ok, false);
    assert.match(away.message, /one team/i);
  });
});
