import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGameEnabled, resolveOperator } from '../auth/operator-auth.mjs';
import { catalogEntry, listGames } from '../registry/games.mjs';

describe('operator auth', () => {
  it('resolves demo operator tokens', () => {
    const all = resolveOperator('op_demo_all');
    assert.ok(all);
    assert.equal(isGameEnabled(all, 'rise-of-olympus'), true);
    assert.equal(isGameEnabled(all, 'greedy'), true);

    const lottery = resolveOperator('op_lottery_only');
    assert.ok(lottery);
    assert.equal(isGameEnabled(lottery, 'rise-of-olympus'), false);
    assert.equal(isGameEnabled(lottery, 'greedy'), true);
  });

  it('filters catalog by enabled games', () => {
    const operator = resolveOperator('op_slots_only');
    assert.ok(operator);
    const games = listGames()
      .filter((g) => isGameEnabled(operator, g.slug))
      .map(catalogEntry);
    assert.equal(games.length, 1);
    assert.equal(games[0].slug, 'rise-of-olympus');
  });
});
