import { COLS, ROWS } from './config.mjs';
import { clientSymbol } from './symbols.mjs';

/** Col-major reels → client col-major grid (visible rows only). */
export function reelsToClientGrid(reels, rowCounts = null) {
  const out = [];
  for (let col = 0; col < COLS; col++) {
    out[col] = [];
    const rows = rowCounts?.[col] ?? reels[col]?.length ?? ROWS;
    const windowRows = Math.min(ROWS, rows);
    for (let row = 0; row < ROWS; row++) {
      const sym = row < windowRows ? (reels[col]?.[rows - windowRows + row] ?? reels[col]?.[row] ?? 0) : 0;
      out[col][row] = clientSymbol(sym);
    }
  }
  return out;
}

/** Flat visible (col-major) → client grid. */
export function flatToClientGrid(flat, rows = ROWS) {
  const out = [];
  for (let col = 0; col < COLS; col++) {
    out[col] = [];
    for (let row = 0; row < rows; row++) {
      out[col][row] = clientSymbol(flat[col * rows + row] ?? 0);
    }
  }
  return out;
}

/** @deprecated alias */
export function toClientGrid(reels) {
  return reelsToClientGrid(reels);
}
