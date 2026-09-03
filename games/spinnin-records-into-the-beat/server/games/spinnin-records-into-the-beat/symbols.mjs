import { PAY_SYMBOL_MIN, PAY_SYMBOL_MAX, TREASURE_SCATTER, COIN_SCATTER } from './config.mjs';

/** Client renders Symbol0–Symbol9 only. */
export const CLIENT_SYMBOL_MAX = TREASURE_SCATTER;

export function clientSymbol(sym) {
  const id = sym | 0;
  if (id === COIN_SCATTER) return TREASURE_SCATTER;
  return id;
}

export function sanitizeSymbol(sym, rng = Math.random) {
  const id = sym | 0;
  if (id === COIN_SCATTER) return TREASURE_SCATTER;
  if (id >= PAY_SYMBOL_MIN && id <= CLIENT_SYMBOL_MAX) return id;
  const span = PAY_SYMBOL_MAX - PAY_SYMBOL_MIN + 1;
  return PAY_SYMBOL_MIN + Math.floor(rng() * span);
}

export function sanitizeReels(reels = []) {
  return reels.map((col) => col.map((s) => sanitizeSymbol(s)));
}

export function sanitizeFlat(visible = []) {
  return visible.map((s) => sanitizeSymbol(s));
}
