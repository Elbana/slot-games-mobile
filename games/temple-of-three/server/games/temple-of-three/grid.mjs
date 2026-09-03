import { COLS, ROWS } from './config.mjs';
import { clientSymbol } from './symbols.mjs';

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

export function reelsToClientGrid(reels) {
  const out = [];
  for (let col = 0; col < COLS; col++) {
    out[col] = [];
    for (let row = 0; row < ROWS; row++) {
      out[col][row] = clientSymbol(reels[col]?.[row] ?? 0);
    }
  }
  return out;
}
