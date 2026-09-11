/**
 * Thrones of Olympus — layout from Rise of Olympus 1000 mobile reference.
 * Grid: 6×5 @ 130px, xGap 9, origin (190, 235). Stage: 1200×900.
 */

export const STAGE = { width: 1200, height: 900 };

/** Edge-fill color sampled from RoO1000 background JPG */
export const STAGE_BG_COLOR = 0x0a1028;

/** riseofolympus1000_mobile.bundle.js defaultParams */
export const ORIGIN = { x: 190, y: 235 };

export const GRID = {
  cell: 130,
  gapX: 9,
  gapY: 0,
  clip: 124,
  get colPitch() {
    return this.cell + this.gapX;
  },
  get rowPitch() {
    return this.cell + this.gapY;
  },
  get cellH() {
    return this.colPitch;
  },
};

/**
 * Ref riseofolympus1000 blockAnimatorOptions (cP):
 * acceleration 3e-5 row-units/ms², bounceScale 0.8, bounceDuration 200ms, bounceCount 1, maxBounceAmplitude 0.1
 * dropDelayConstant 200 (allowDropDelay false — column stagger via reelDelay ~40ms, blockDelay 10ms within column)
 */
export const DROP_PHYSICS = {
  acceleration: 3e-5,
  bounceScale: 0.8,
  bounceDuration: 200,
  bounceCount: 1,
  maxBounceAmplitude: 0.1,
  blockDelay: 8,
  reelDelay: 30,
};

/** Faster drops for cascade refills — survivors fall + new symbols from top. */
export const TUMBLE_PHYSICS = {
  ...DROP_PHYSICS,
  acceleration: 9e-5,
  bounceDuration: 90,
  maxBounceAmplitude: 0.06,
  blockDelay: 2,
  reelDelay: 10,
};

/** Default animation speed multipliers (1 = reference timings). */
export const ANIM_SPEED = {
  normal: 1.5,
  fast: 3,
};

/** Ref timing — synced to PG sound clips (~30fps spine), tuned faster for mobile. */
export const TIMING = {
  shuffle: 0,
  clearExitStagger: DROP_PHYSICS.reelDelay,
  dealStagger: DROP_PHYSICS.reelDelay,
  dealDrop: 0,
  /** Brief flash on matched stones before remove. */
  winHighlight: 85,
  /** Max wait for symbol win spine clips during cascades. */
  winClipCap: 120,
  remove: 110,
  tumbleStagger: TUMBLE_PHYSICS.reelDelay,
  tumbleDrop: 0,
  tumbleDisperseOut: 140,
  multiplierPulse: 120,
  tumblePanelPulse: 50,
  tumbleTextReveal: 160,
  signpostPulse: 180,
  bigWinIn: 520,
  bigWinHold: 2800,
  bigWinOut: 480,
  fsBannerIn: 400,
  fsBannerHold: 1400,
  fsBannerOut: 280,
  scatterFlash: 0,
  godLand: 140,
  orbLand: 120,
  orbRevealCap: 160,
  upgradeFxCap: 180,
  winCountUp: 480,
  trailCollect: 220,
};

/** Absolute stage-space chrome — config_mobile iPhone_p layout_mobile.json */
export const CHROME = {
  logo: { x: 600, y: 92 },
  signpost: { x: 255, y: 155, scale: 0.88 },
  reelFrame: { x: 602, y: 558 },
  platform: { x: 602, y: 558 },
  godPortrait: { x: 968, y: 218, scale: 0.48, skel: 'roo-god-zeus-skel' },
  tumbleWin: { x: 600, y: 185, frameBottomInset: 34, liftAboveGrid: 16 },
  /** extends logo in ref (fsCounter node) */
  fsCounter: { x: 600, y: 130 },
  /** main:freespinMultiplier — top banner during FS */
  runningMultiplier: { x: 480, y: 118 },
  introPanel: { x: 600, y: 400 },
};

/** Symbols that play land spine clips (ref: HP, scatter, multipliers only) */
export const LAND_ANIM_SYMBOLS = new Set([5, 6, 7, 8, 9, 11, 12, 13, 14]);

export const MULTIPLIER_SYMBOL_MIN = 12;
export const MULTIPLIER_SYMBOL_MAX = 14;
/** Always use Zeus (thunder) for multiplier land FX and portrait — 0=Hades, 1=Poseidon, 2=Zeus. */
export const MULTIPLIER_GOD_ID = 2;
export const SCATTER_SYMBOL = 11;

/** Bleed past grid clip rect to hide mask/platform fringe (px). */
export const GRID_BACKING_BLEED = 4;

/** Mobile portrait — grid sits just above wallet/bet/win HUD with small side inset. */
export const MOBILE_PLAYFIELD = {
  /** Frame lip below grid clip (stage px). */
  frameBottomPad: 18,
  /** Space above wallet row (screen px). */
  gapAboveHud: 12,
  /** Left/right inset so the golden frame is visible (screen px). */
  sideInsetPx: 14,
  /** Big-win spine scale in stage units — fits inside reel frame on portrait. */
  bigWinScale: 0.82,
};

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

export function gridStageCenter(cols, rows) {
  const { width, height } = gridPixelSize(cols, rows);
  return { x: ORIGIN.x + width / 2, y: ORIGIN.y + height / 2 };
}
