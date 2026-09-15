/**
 * Cryptographically secure random helpers for monetary outcomes.
 */

import crypto from 'crypto';

/** Uniform float in [0, 1). */
export function secureRandom() {
  return crypto.randomBytes(4).readUInt32BE(0) / 0x1_0000_0000;
}

/** Integer in [min, max] inclusive. */
export function secureRandomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  const span = hi - lo + 1;
  return lo + Math.floor(secureRandom() * span);
}

/** Pick index by weights (array of positive numbers). */
export function secureWeightedPick(weights) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let r = secureRandom() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
