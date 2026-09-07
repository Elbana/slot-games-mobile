/**
 * Unified currency-agnostic betting — integer chip units per operator.
 */

import { CHIP_UNITS, DEFAULT_CHIP, MIN_BALANCE_TO_PLAY } from '../config.mjs';

/** @typedef {{ chipUnits: number[], defaultChip: number, minBalanceToPlay: number, unitType: 'integer', displayHint: string }} BetConfig */

export const DEFAULT_BET_CONFIG = {
  chipUnits: CHIP_UNITS,
  defaultChip: DEFAULT_CHIP,
  minBalanceToPlay: MIN_BALANCE_TO_PLAY,
  unitType: 'integer',
  displayHint: 'host_formats_units',
};

/** @param {unknown} units */
function normalizeChipUnits(units) {
  if (!Array.isArray(units) || units.length === 0) return null;
  const parsed = units
    .map((v) => Math.floor(Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (parsed.length === 0) return null;
  return [...new Set(parsed)].sort((a, b) => a - b);
}

/** @param {unknown} chip @param {number[]} chipUnits */
function pickDefaultChip(chip, chipUnits) {
  const n = Math.floor(Number(chip));
  if (Number.isFinite(n) && chipUnits.includes(n)) return n;
  return chipUnits[0];
}

/** @param {object} [operator] @returns {BetConfig} */
export function getBetConfig(operator) {
  const raw = operator?.betting ?? {};
  const chipUnits = normalizeChipUnits(raw.chipUnits) ?? CHIP_UNITS;
  const defaultChip = pickDefaultChip(raw.defaultChip ?? DEFAULT_CHIP, chipUnits);
  const minRaw = raw.minBalanceToPlay ?? MIN_BALANCE_TO_PLAY ?? defaultChip;
  const minBalanceToPlay = Math.max(defaultChip, Math.floor(Number(minRaw)) || defaultChip);

  return {
    chipUnits,
    defaultChip,
    minBalanceToPlay,
    unitType: 'integer',
    displayHint: 'host_formats_units',
  };
}

/** @param {BetConfig} config */
export function bettingPayload(config) {
  return {
    chipUnits: config.chipUnits,
    defaultChip: config.defaultChip,
    minBalanceToPlay: config.minBalanceToPlay,
    unitType: config.unitType,
    displayHint: config.displayHint,
  };
}

/**
 * @param {unknown} amount
 * @param {BetConfig} config
 * @returns {{ ok: true, amount: number } | { ok: false, error: string }}
 */
export function validateBetAmount(amount, config) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: 'Invalid bet amount' };
  }
  if (!config.chipUnits.includes(amt)) {
    return { ok: false, error: `Invalid bet unit. Allowed: ${config.chipUnits.join(', ')}` };
  }
  return { ok: true, amount: amt };
}

/** Plain integer string for audit logs — never currency-formatted. */
export function formatUnitsForLog(n) {
  return String(Math.floor(Number(n)) || 0);
}
