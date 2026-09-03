/**
 * Multiplier collect — fly orb values to the signpost (ref COLLECTOR_TRAIL).
 */

import { GRID, ORIGIN, TIMING } from './config.js';
import {
  createMultiplierTrailSpine,
  playMultiplierValueTrail,
} from './ThronesSpineLoader.js';

/**
 * @param {import('pixi.js').Container[][]} cells
 * @param {{ cols: number, rows: number }} layout
 * @returns {{ col: number, row: number, value: number }[]}
 */
export function findMultiplierCells(cells, layout) {
  /** @type {{ col: number, row: number, value: number }[]} */
  const sources = [];
  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const cell = cells[c]?.[r];
      if (!cell) continue;
      const sym = cell.__sym ?? 0;
      const value = cell.__mult ?? 0;
      if (sym >= 12 && sym <= 14 && value > 0) {
        sources.push({ col: c, row: r, value });
      }
    }
  }
  return sources;
}

/**
 * @param {object} opts
 * @param {{ col: number, row: number, value: number }[]} opts.sources
 * @param {import('pixi.js').Container[][]} opts.cells
 * @param {import('pixi.js').Container} opts.fxLayer
 * @param {{ x: number, y: number }} opts.target
 * @param {(cell: import('pixi.js').Container, value: number) => void} [opts.clearCellMultiplier]
 * @param {number} [opts.durationMs]
 */
export async function animateMultiplierCollectTrails(opts) {
  const {
    sources,
    cells,
    fxLayer,
    target,
    clearCellMultiplier,
    durationMs = TIMING.trailCollect,
  } = opts;

  if (!sources.length || !fxLayer) return;

  await Promise.all(
    sources.map(async ({ col, row, value }) => {
      const cell = cells[col]?.[row];
      if (!cell) return;

      clearCellMultiplier?.(cell, 0);

      const trail = createMultiplierTrailSpine(value);
      trail.x = ORIGIN.x + cell.x + GRID.cell / 2;
      trail.y = ORIGIN.y + cell.y + GRID.cell / 2;
      fxLayer.addChild(trail);

      try {
        await playMultiplierValueTrail(trail, target, durationMs);
      } finally {
        trail.destroy({ children: true });
      }
    })
  );
}
