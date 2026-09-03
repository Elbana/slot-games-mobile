/**
 * Egypt Treasures — Spine symbols + baked chrome/bg (TOT ref parity).
 */

import { Container, Graphics } from 'pixi.js';
import { createEventReplayer } from './EventReplayer.js';
import {
  createBackgroundClip,
  createGridPlate,
  createGridDividers,
  createCollectors,
  createSymbolSprite,
  getCollectorClipPlayers,
  getBackgroundTexture,
  loadEgyptAssets,
} from './AssetLoader.js';
import { attachClipTicker } from './SymbolClipPlayer.js';
import { GRID, STAGE, ORIGIN, gridPixelSize, cellPosition } from './config.js';
import {
  loadEgyptSpineAssets,
  createSymbolSpine,
  createScrollSymbolSpine,
  playSymbolPhase,
  createCollectorSpines,
  playPotCollect,
  createLogoSpine,
  createReelSpine,
} from './EgyptSpineLoader.js';

/**
 * @param {{ cols: number, rows: number, app: import('pixi.js').Application }} opts
 */
export async function createEgyptScene(opts) {
  const { cols, rows, app } = opts;
  const ticker = app.ticker;
  const symbolSize = GRID.clip;

  await loadEgyptAssets();
  await loadEgyptSpineAssets();

  const root = new Container();
  const stageContent = new Container();
  stageContent.pivot.set(STAGE.width / 2, STAGE.height / 2);
  root.addChild(stageContent);

  const bgLayer = new Container();
  const collectorLayer = new Container();
  const chromeLayer = new Container();
  const symbolLayer = new Container();
  const dividerLayer = new Container();
  const overlayLayer = new Container();
  stageContent.addChild(bgLayer, collectorLayer, chromeLayer, symbolLayer, dividerLayer, overlayLayer);

  /** @type {ReturnType<typeof attachClipTicker> extends () => infer R ? R : never} */
  let detachClips = () => {};
  /** @type {import('./SymbolClipPlayer.js').createSymbolClipPlayer[]} */
  const clipPlayers = [];

  const bgClip = createBackgroundClip();
  if (bgClip) {
    bgLayer.addChild(bgClip.view);
    clipPlayers.push(bgClip);
  } else {
    const bgTex = getBackgroundTexture();
    if (bgTex) {
      const { Sprite } = await import('pixi.js');
      const bgSprite = new Sprite(bgTex);
      bgSprite.anchor.set(0.5);
      bgSprite.position.set(STAGE.width / 2, STAGE.height / 2);
      bgLayer.addChild(bgSprite);
      root.__bgSprite = bgSprite;
    }
  }

  let potSpines = [];
  try {
    potSpines = createCollectorSpines();
    for (const pot of potSpines) collectorLayer.addChild(pot);
  } catch {
    const collectors = createCollectors();
    if (collectors) {
      collectorLayer.addChild(collectors);
      clipPlayers.push(...getCollectorClipPlayers(collectors));
    }
  }

  try {
    const reelSpine = createReelSpine();
    chromeLayer.addChild(reelSpine);
  } catch {
    /* reel spine optional */
  }
  const gridPlate = createGridPlate();
  if (gridPlate) chromeLayer.addChildAt(gridPlate, 0);

  try {
    const logoSpine = createLogoSpine();
    dividerLayer.addChild(logoSpine);
  } catch {
    /* logo clip optional */
  }

  const dividers = createGridDividers();
  if (dividers) dividerLayer.addChild(dividers);

  const reelRoot = new Container();
  reelRoot.position.set(ORIGIN.x, ORIGIN.y);
  symbolLayer.addChild(reelRoot);

  const { width: gridW, height: gridH } = gridPixelSize(cols, rows);
  const reelMask = new Graphics();
  reelMask.rect(0, 0, gridW, gridH).fill(0xffffff);
  reelRoot.addChild(reelMask);
  reelRoot.mask = reelMask;

  /** @type {import('pixi.js').Container[][]} */
  const cells = [];
  for (let c = 0; c < cols; c++) {
    cells[c] = [];
    for (let r = 0; r < rows; r++) {
      const wrap = new Container();
      wrap.x = c * GRID.colPitch;
      wrap.y = r * GRID.rowPitch;
      const cellMask = new Graphics();
      cellMask.rect(0, 0, GRID.cell, GRID.cell).fill(0xffffff);
      wrap.addChild(cellMask);
      wrap.mask = cellMask;
      reelRoot.addChild(wrap);
      cells[c][r] = wrap;
    }
  }

  detachClips = attachClipTicker(ticker, clipPlayers);

  function clearCell(cell) {
    if (cell.__spine) {
      cell.removeChild(cell.__spine);
      cell.__spine.destroy({ children: true });
      cell.__spine = null;
    }
    if (cell.__sprite) {
      cell.removeChild(cell.__sprite);
      cell.__sprite.destroy();
      cell.__sprite = null;
    }
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function paintCell(cell, sym) {
    clearCell(cell);
    try {
      const spine = createSymbolSpine(sym, symbolSize);
      cell.addChild(spine);
      cell.__spine = spine;
      cell.__sym = sym;
      return;
    } catch {
      /* spine unavailable — fall back to baked sprite */
    }
    const sprite = createSymbolSprite(sym, symbolSize);
    if (!sprite) return;
    sprite.x = GRID.cell / 2;
    sprite.y = GRID.cell / 2;
    cell.addChild(sprite);
    cell.__sprite = sprite;
    cell.__sym = sym;
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function setCellSymbolScroll(cell, sym) {
    clearCell(cell);
    try {
      const spine = createScrollSymbolSpine(symbolSize);
      cell.addChild(spine);
      cell.__spine = spine;
      cell.__sym = sym;
      return;
    } catch {
      paintCell(cell, sym);
    }
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function setCellSymbol(cell, sym) {
    if (cell.__sym === sym && cell.__sym != null && (cell.__spine || cell.__sprite)) return;
    paintCell(cell, sym);
  }

  /** @param {import('pixi.js').Container} cell */
  function playWinClip(cell) {
    const sym = cell.__sym ?? 0;
    if (!cell.__spine) return Promise.resolve();
    return playSymbolPhase(cell.__spine, 'win', sym);
  }

  /** @param {import('pixi.js').Container} cell */
  function playLandClip(cell) {
    const sym = cell.__sym ?? 0;
    if (!cell.__spine) return Promise.resolve();
    return playSymbolPhase(cell.__spine, 'land', sym);
  }

  /** @param {import('pixi.js').Container} cell @param {number} [ppsType] */
  async function playCashCollectClip(cell, ppsType) {
    if (!cell.__spine) return;
    await playSymbolPhase(cell.__spine, 'collect', 8, ppsType);
  }

  /** @param {number} ppsType */
  async function playPotCollectAnim(ppsType) {
    if (potSpines.length) await playPotCollect(potSpines, ppsType);
  }

  function setSymbolsImmediate(grid) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        paintCell(cells[c][r], grid[c]?.[r] ?? 0);
        const pos = cellPosition(c, r);
        cells[c][r].x = pos.x;
        cells[c][r].y = pos.y;
        cells[c][r].alpha = 1;
        cells[c][r].scale.set(1);
      }
    }
  }

  async function showFeatureBanner() {}

  function layoutScene(screenW, screenH) {
    const hudReserve = screenH * 0.14;
    const playH = screenH - hudReserve;
    root.x = screenW / 2;
    root.y = playH / 2;

    const bgSprite = root.__bgSprite;
    if (bgSprite?.texture) {
      const cover = Math.max(STAGE.width / bgSprite.texture.width, STAGE.height / bgSprite.texture.height);
      bgSprite.scale.set(cover);
    }

    const scale = Math.min(screenW / STAGE.width, playH / STAGE.height);
    stageContent.scale.set(scale);
  }

  layoutScene(app.screen.width, app.screen.height);
  app.renderer.on('resize', () => layoutScene(app.screen.width, app.screen.height));

  const replayer = createEventReplayer({
    ticker,
    cells,
    setCellSymbol,
    setCellSymbolScroll,
    cellPos: cellPosition,
    createWinGlow: () => null,
    cellSize: GRID.cell,
    playWinClip,
    playLandClip,
    playCashCollectClip,
    playPotCollect: playPotCollectAnim,
    showFeatureBanner,
  });

  return {
    view: root,
    width: gridW,
    height: gridH,
    setSymbols: setSymbolsImmediate,
    replayEvents: replayer.replay,
    layout: layoutScene,
    destroy() {
      detachClips();
    },
  };
}
