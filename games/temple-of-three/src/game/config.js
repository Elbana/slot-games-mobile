/**
 * Egypt Treasures — client layout (Temple of Three clone: 1200×900).
 */

export const GRID = {
  cell: 195,
  gapX: 9,
  gapY: 0,
  /** Visible symbol draw size inside each cell (room for frame + glow). */
  clip: 168,
  get colPitch() {
    return this.cell + this.gapX;
  },
  get rowPitch() {
    return this.cell + this.gapY;
  },
};

export const STAGE = { width: 1200, height: 900 };

/** templeofthree_mobile.bundle.js — x0=190, y0=235 */
export const ORIGIN = { x: 190, y: 235 };

/** TOT game_bundle.json — PB.reelFrameOverlay, MB.Logo, QB.collectors, grid chrome. */
export const CHROME = {
  reelFrame: { x: 715, y: 450 },
  logo: { x: 600, y: 74, maxW: 420, maxH: 140 },
  plate: { x: 599, y: 408, pivotX: 527, pivotY: 321, designW: 1054, designH: 642 },
  divider: { y: 411.5, pivotX: 3.5, pivotY: 308.5, designW: 7, designH: 617, xs: [286.5, 495.5, 703.5, 912.5] },
  collectors: {
    ra: { x: 295.35, y: 315.6, maxW: 90, maxH: 90 },
    bastet: { x: 211.7, y: 222.95, maxW: 90, maxH: 90 },
    anubis: { x: 118.1, y: 315.6, maxW: 90, maxH: 90 },
  },
};

export const TIMING = {
  reelSpin: 2500,
  reelStagger: 300,
  reelStop: 300,
  reelScrollInterval: 33,
  winHighlight: 3500,
  winCountUp: 550,
  featureBannerIn: 450,
  featureBannerHold: 900,
};

/** Client renders symbols 0–8 (LP/HP + cash). */
export const LAND_ANIM_SYMBOLS = new Set([5, 6, 7, 8]);

export const SYMBOL_LABELS = [
  'A',
  'J',
  'K',
  'Q',
  '10',
  'RA',
  'ANUBIS',
  'BASTET',
  'CASH',
];

/** @param {number} cols @param {number} rows */
export function gridPixelSize(cols, rows) {
  return {
    width: cols * GRID.colPitch - GRID.gapX,
    height: rows * GRID.rowPitch - GRID.gapY,
  };
}

/** @param {number} c @param {number} r */
export function cellPosition(c, r) {
  return { x: c * GRID.colPitch, y: r * GRID.rowPitch };
}

export function cellStageCenter(c, r) {
  return {
    x: ORIGIN.x + c * GRID.colPitch + GRID.cell / 2,
    y: ORIGIN.y + r * GRID.rowPitch + GRID.cell / 2,
  };
}
