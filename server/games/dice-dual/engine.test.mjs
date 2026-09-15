import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDiceDualEngine } from './engine.mjs';

describe('dice-dual engine placeBet', () => {
  it('stacks bets on the same prediction', () => {
    const engine = createDiceDualEngine();
    const key = 'player-stack';
    assert.equal(engine.placeBet(key, 'red', 200).ok, true);
    const second = engine.placeBet(key, 'red', 500);
    assert.equal(second.ok, true);
    assert.equal(second.data.amount, 700);
    assert.equal(engine.serializePlayer(key).amount, 700);
  });

  it('blocks switching prediction mid-round', () => {
    const engine = createDiceDualEngine();
    const key = 'player-switch';
    assert.equal(engine.placeBet(key, 'red', 200).ok, true);
    const blue = engine.placeBet(key, 'blue', 200);
    assert.equal(blue.ok, false);
    assert.match(blue.message, /one side/i);
  });
});
