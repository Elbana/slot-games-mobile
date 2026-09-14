/**
 * Signed launch tokens — bind operator, player, and game for WebView sessions.
 */

import crypto from 'crypto';
import { LAUNCH_SECRET } from '../config.mjs';

const DEFAULT_TTL_SEC = 3600;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function sign(body) {
  return crypto.createHmac('sha256', LAUNCH_SECRET).update(body).digest('base64url');
}

/**
 * @param {{ operatorId: string, operatorToken: string, playerId: string, game: string, ttlSec?: number }} opts
 */
export function createLaunchToken(opts) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSec ?? DEFAULT_TTL_SEC);
  const payload = {
    oid: opts.operatorId,
    ot: opts.operatorToken,
    pid: opts.playerId,
    game: opts.game,
    exp,
    iat: now,
  };
  const body = b64urlJson(payload);
  const sig = sign(body);
  return { token: `${body}.${sig}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** @param {string} token */
export function verifyLaunchToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.oid || !payload.ot || !payload.pid || !payload.game) return null;
    return payload;
  } catch {
    return null;
  }
}
