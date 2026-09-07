import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FS_INITIAL_AWARD,
  FS_MAX_TOTAL,
  FS_RETRIGGER_AWARD,
  createFreeSpinState,
  effectiveBet,
  resolveFreeSpinEnd,
  scatterFreeSpinAward,
} from './freespin.mjs';
import { spinThronesOfOlympus } from './spin.mjs';

describe('freespin rules', () => {
  it('awards 5 on base-game trigger', () => {
    const session = { thronesFs: createFreeSpinState() };
    const r = resolveFreeSpinEnd(session, { scatterCount: 3, spinId: 1 });
    assert.equal(r.triggered, true);
    assert.equal(r.fsAwardAdded, FS_INITIAL_AWARD);
    assert.equal(r.freeSpinsLeft, 5);
    assert.equal(session.thronesFs.freeSpinMultiplier, 1);
    assert.equal(session.thronesFs.fsTotalAwarded, 5);
    assert.equal(session.thronesFs.retriggerUsed, false);
  });

  it('consumes one FS per round and charges zero bet during FS', () => {
    const session = {
      thronesFs: { ...createFreeSpinState(), freeSpinsLeft: 5, freeSpinMultiplier: 1, fsTotalAwarded: 5 },
    };
    assert.equal(effectiveBet(session, 200), 0);
    const r = resolveFreeSpinEnd(session, { scatterCount: 0, roundWin: 100, spinId: 2 });
    assert.equal(r.freeSpinsLeft, 4);
    assert.equal(session.thronesFs.fsTotalWin, 100);
  });

  it('allows one retrigger of +3 (max 8 total awarded)', () => {
    const session = {
      thronesFs: {
        ...createFreeSpinState(),
        freeSpinsLeft: 2,
        freeSpinMultiplier: 2,
        fsTotalAwarded: 5,
        retriggerUsed: false,
        fsTotalWin: 0,
      },
    };
    const r = resolveFreeSpinEnd(session, { scatterCount: 4, roundWin: 50, spinId: 3 });
    assert.equal(r.retriggered, true);
    assert.equal(r.fsAwardAdded, FS_RETRIGGER_AWARD);
    assert.equal(r.freeSpinsLeft, 4); // 2 - 1 + 3
    assert.equal(session.thronesFs.fsTotalAwarded, 8);
    assert.equal(session.thronesFs.retriggerUsed, true);
  });

  it('blocks further scatter awards after retrigger used', () => {
    const session = {
      thronesFs: {
        ...createFreeSpinState(),
        freeSpinsLeft: 3,
        freeSpinMultiplier: 3,
        fsTotalAwarded: 8,
        retriggerUsed: true,
      },
    };
    const r = resolveFreeSpinEnd(session, { scatterCount: 5, roundWin: 0, spinId: 4 });
    assert.equal(r.fsAwardAdded, 0);
    assert.equal(r.retriggered, false);
    assert.equal(r.freeSpinsLeft, 2);
    assert.equal(scatterFreeSpinAward(5, { inFreeSpins: true, retriggerUsed: true }), 0);
  });

  it('resets FS state when session ends', () => {
    const session = {
      thronesFs: {
        ...createFreeSpinState(),
        freeSpinsLeft: 1,
        freeSpinMultiplier: 4,
        fsTotalAwarded: 8,
        retriggerUsed: true,
        fsTotalWin: 900,
      },
    };
    const r = resolveFreeSpinEnd(session, { scatterCount: 0, roundWin: 100, spinId: 5 });
    assert.equal(r.fsEnded, true);
    assert.equal(r.fsSessionTotalWin, 1000);
    assert.equal(r.freeSpinsLeft, 0);
    assert.equal(session.thronesFs.freeSpinMultiplier, 0);
    assert.equal(session.thronesFs.fsTotalAwarded, 0);
    assert.equal(session.thronesFs.retriggerUsed, false);
  });

  it('ignores duplicate resolve for same spinId', () => {
    const session = { thronesFs: createFreeSpinState() };
    resolveFreeSpinEnd(session, { scatterCount: 3, spinId: 99 });
    const dup = resolveFreeSpinEnd(session, { scatterCount: 3, spinId: 99 });
    assert.equal(dup.alreadyResolved, true);
    assert.equal(dup.fsAwardAdded, 0);
    assert.equal(session.thronesFs.freeSpinsLeft, 5);
  });
});

describe('freespin integration', () => {
  it('persists FS across consecutive spins until exhausted', () => {
    const session = { balance: 1_000_000, thronesFs: createFreeSpinState() };
    resolveFreeSpinEnd(session, { scatterCount: 3, spinId: 1000 });
    assert.equal(session.thronesFs.freeSpinsLeft, 5);

    for (let i = 0; i < 5; i++) {
      const before = session.thronesFs.freeSpinsLeft;
      const result = spinThronesOfOlympus(session, 200, { spinId: 2000 + i });
      assert.equal(result.bet, 0, `spin ${i} should be free`);
      assert.equal(result.state.fsRemaining, before - 1);
    }
    assert.equal(session.thronesFs.freeSpinsLeft, 0);
  });
});
