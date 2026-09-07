/**
 * Platform server configuration.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { applyMathDefaults } from './math-profile.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const PORT = parseInt(process.env.PORT || '5180', 10);
export const GAMES_ROOT = path.join(ROOT, 'games');
export const DATA_ROOT = process.env.DATA_ROOT || path.join(ROOT, 'data');
export const SESSION_DIR = process.env.SESSION_DIR || path.join(DATA_ROOT, 'sessions');
export const AUDIT_DIR = process.env.AUDIT_DIR || path.join(DATA_ROOT, 'audit');
export const POOLS_DIR = process.env.POOLS_DIR || path.join(DATA_ROOT, 'pools');
export const OPERATORS_FILE =
  process.env.OPERATORS_FILE || path.join(ROOT, 'server', 'config', 'operators.json');

export const DEFAULT_BALANCE = parseInt(process.env.DEFAULT_BALANCE || '10000000', 10);
export const CHIP_UNITS = [200, 1000, 5000, 10000, 50000, 100000];
export const DEFAULT_CHIP = 200;
export const MIN_BALANCE_TO_PLAY = 200;
/** @deprecated Use CHIP_UNITS — kept for backward-compatible imports */
export const BET_LEVELS = CHIP_UNITS;
export const RATE_LIMIT_SPIN_MS = parseInt(process.env.RATE_LIMIT_SPIN_MS || '400', 10);
export const RATE_LIMIT_LOTTERY_MS = parseInt(process.env.RATE_LIMIT_LOTTERY_MS || '200', 10);
export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';
export const WALLET_MOCK = process.env.WALLET_MOCK === '1' || !IS_PRODUCTION;
export const WALLET_TIMEOUT_MS = parseInt(process.env.WALLET_TIMEOUT_MS || '8000', 10);
export const IDEMPOTENCY_CACHE_SIZE = 32;
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function applyProductionDefaults() {
  applyMathDefaults();
}
