import { CLIENT_SYMBOL_MAX, CASH_SYMBOL } from './config.mjs';

export function clientSymbol(sym) {
  const id = sym | 0;
  if (id === CASH_SYMBOL) return CASH_SYMBOL;
  if (id >= 0 && id <= CLIENT_SYMBOL_MAX) return id;
  return Math.min(CLIENT_SYMBOL_MAX, Math.max(0, id));
}

export function sanitizeFlat(flat = []) {
  return flat.map((s) => clientSymbol(s));
}
