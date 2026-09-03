/**
 * Production server configuration.
 */

import { applyMathDefaults } from './math-profile.mjs';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function applyProductionDefaults() {
  applyMathDefaults();
}

export const PORT = parseInt(process.env.PORT || '5183', 10);
export const DEFAULT_BALANCE = parseInt(process.env.DEFAULT_BALANCE || '2500000', 10);
export const BET_LEVELS = [20, 40, 60, 100, 200, 500, 1000];
export const SESSION_DIR = process.env.SESSION_DIR || './data/sessions';
export const AUDIT_DIR = process.env.AUDIT_DIR || './data/audit';
export const RATE_LIMIT_SPIN_MS = parseInt(process.env.RATE_LIMIT_SPIN_MS || '400', 10);
export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';
export const API_KEY = process.env.API_KEY || '';
export const IDEMPOTENCY_CACHE_SIZE = 32;
