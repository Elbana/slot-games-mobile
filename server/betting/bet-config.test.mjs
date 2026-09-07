import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBetConfig,
  validateBetAmount,
  bettingPayload,
  formatUnitsForLog,
  DEFAULT_BET_CONFIG,
} from './bet-config.mjs';
import { CHIP_UNITS, DEFAULT_CHIP } from '../config.mjs';

describe('bet-config', () => {
  it('defaults to standard chip tiers', () => {
    const cfg = getBetConfig({});
    assert.deepEqual(cfg.chipUnits, CHIP_UNITS);
    assert.equal(cfg.defaultChip, DEFAULT_CHIP);
    assert.equal(cfg.unitType, 'integer');
  });

  it('reads operator betting overrides', () => {
    const cfg = getBetConfig({
      betting: {
        chipUnits: [500, 5000],
        defaultChip: 5000,
        minBalanceToPlay: 500,
      },
    });
    assert.deepEqual(cfg.chipUnits, [500, 5000]);
    assert.equal(cfg.defaultChip, 5000);
    assert.equal(cfg.minBalanceToPlay, 5000);
  });

  it('falls back when defaultChip is not in chipUnits', () => {
    const cfg = getBetConfig({ betting: { chipUnits: [1000, 5000], defaultChip: 200 } });
    assert.equal(cfg.defaultChip, 1000);
  });

  it('validates allowed chip amounts', () => {
    const cfg = DEFAULT_BET_CONFIG;
    assert.deepEqual(validateBetAmount(1000, cfg), { ok: true, amount: 1000 });
    const bad = validateBetAmount(999, cfg);
    assert.equal(bad.ok, false);
    assert.match(bad.error, /Invalid bet unit/);
  });

  it('rejects non-positive amounts', () => {
    const bad = validateBetAmount(0, DEFAULT_BET_CONFIG);
    assert.equal(bad.ok, false);
  });

  it('bettingPayload omits currency formatting', () => {
    const payload = bettingPayload(DEFAULT_BET_CONFIG);
    assert.deepEqual(payload.chipUnits, CHIP_UNITS);
    assert.equal(payload.displayHint, 'host_formats_units');
  });

  it('formatUnitsForLog returns plain integers', () => {
    assert.equal(formatUnitsForLog(100000), '100000');
    assert.equal(formatUnitsForLog('5000.9'), '5000');
  });
});
