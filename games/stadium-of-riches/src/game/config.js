/**
 * Football Gold — client layout & timing (SOR clone: 1200×900 stage).
 */

/** Clone mobile bundle: symbol 195×195, xGap 9, yGap 0, origin (190, 235). */
export const GRID = {
  cell: 195,
  gapX: 9,
  gapY: 0,
  clip: 210,
  get colPitch() {
    return this.cell + this.gapX;
  },
  get rowPitch() {
    return this.cell + this.gapY;
  },
};

export const STAGE = { width: 1200, height: 900 };

/** Grid top-left in stage space (stadiumofriches_mobile.bundle.js). */
export const ORIGIN = { x: 190, y: 235 };

/** VB/MainGame chrome — game_bundle.json frame 0 placements. */
export const CHROME = {
  plate: { x: 599, y: 408, pivotX: 527, pivotY: 321, designW: 1054, designH: 642 },
  divider: { y: 411.5, pivotX: 3.5, pivotY: 308.5, designW: 7, designH: 617, xs: [286.5, 495.5, 703.5, 912.5] },
  logo: { x: 600, y: 158, maxW: 420, maxH: 110 },
};

/** SOR regularSpinTime=2500, reelStop=300ms stagger @ 30fps */
export const TIMING = {
  reelSpin: 2500,
  reelStagger: 300,
  reelStop: 300,
  reelScrollInterval: 33,
  winHighlight: 4000,
  winCountUp: 550,
  wheelBannerIn: 500,
  wheelBannerHold: 900,
  fsBannerIn: 450,
  fsBannerHold: 1000,
};

export const SYMBOL = {
  WILD: 8,
  SCATTER: 9,
};

/** Symbols 5+ play land animation on reel stop (SOR clone). */
export const LAND_ANIM_SYMBOLS = new Set([5, 6, 7, 8, 9]);

export const SYMBOL_LABELS = [
  'KIT',
  'BOOT',
  'BALL',
  'GLOVE',
  'CARD',
  'MEDAL',
  'STAR',
  'CUP',
  'WILD',
  'TROPHY',
];

export const SYMBOL_COLORS = [
  0x2ecc71, 0xffffff, 0xf39c12, 0x3498db, 0xe74c3c,
  0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xffd700,
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

/** Stage-space center of a cell (for overlays). */
export function cellStageCenter(c, r) {
  return {
    x: ORIGIN.x + c * GRID.colPitch + GRID.cell / 2,
    y: ORIGIN.y + r * GRID.rowPitch + GRID.cell / 2,
  };
}
