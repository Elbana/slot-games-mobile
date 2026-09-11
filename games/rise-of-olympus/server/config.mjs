/**
 * Production server configuration.
 */

import { applyMathDefaults } from './math-profile.mjs';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function applyProductionDefaults() {
  applyMathDefaults();
}

export const PORT = parseInt(process.env.PORT || '5180', 10);
export const DEFAULT_BALANCE = parseInt(process.env.DEFAULT_BALANCE || '10000000', 10);
/** Unified chip tiers — must match platform server/betting/bet-config.mjs */
export const BET_LEVELS = [200, 1000, 5000, 10000, 50000, 100000];
export const DEFAULT_BET = BET_LEVELS[0];
export const SESSION_DIR = process.env.SESSION_DIR || './data/sessions';
export const AUDIT_DIR = process.env.AUDIT_DIR || './data/audit';
export const RATE_LIMIT_SPIN_MS = parseInt(process.env.RATE_LIMIT_SPIN_MS || '400', 10);
export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';
export const API_KEY = process.env.API_KEY || '';
export const IDEMPOTENCY_CACHE_SIZE = 32;
