/**
 * Football Gold — Pixi scene matching SOR clone (1200×900, layered symbol clips).
 */

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  createSymbolClip,
  createSymbolSprite,
  createGridPlate,
  createGridDividers,
  createWinGlow,
  createBackgroundClip,
  loadFootballAssets,
  getBackgroundTexture,
  getLogoTexture,
} from './AssetLoader.js';
import { attachClipTicker } from './SymbolClipPlayer.js';
import { animate } from './ReelAnimator.js';
import { createEventReplayer } from './EventReplayer.js';
import { GRID, STAGE, CHROME, ORIGIN, TIMING, gridPixelSize, cellPosition } from './config.js';

/**
 * @param {{ cols: number, rows: number, app: import('pixi.js').Application }} opts
 */
export async function createFootballScene(opts) {
  const { cols, rows, app } = opts;
  const ticker = app.ticker;

  await loadFootballAssets();

  const root = new Container();
  const stageContent = new Container();
  stageContent.pivot.set(STAGE.width / 2, STAGE.height / 2);
  root.addChild(stageContent);

  const bgLayer = new Container();
  const chromeLayer = new Container();
  const reelLayer = new Container();
  const dividerLayer = new Container();
  const overlayLayer = new Container();
  stageContent.addChild(bgLayer, chromeLayer, reelLayer, dividerLayer, overlayLayer);

  /** @type {ReturnType<typeof createSymbolClip>[]} */
  const clipPlayers = [];

  const bgTex = getBackgroundTexture();
  if (bgTex) {
    const bgSprite = new Sprite(bgTex);
    bgSprite.anchor.set(0.5);
    bgSprite.position.set(STAGE.width / 2, STAGE.height / 2);
    bgLayer.addChild(bgSprite);
    root.__bgSprite = bgSprite;
  }

  const bgClip = createBackgroundClip();
  if (bgClip) {
    bgLayer.addChild(bgClip.view);
    clipPlayers.push(bgClip);
  }

  const gridPlate = createGridPlate();
  if (gridPlate) chromeLayer.addChild(gridPlate);

  const logoWrap = new Container();
  logoWrap.position.set(CHROME.logo.x, CHROME.logo.y);
  const logoTex = getLogoTexture();
  if (logoTex) {
    const logoSprite = new Sprite(logoTex);
    logoSprite.anchor.set(0.5);
    logoSprite.scale.set(
      Math.min(CHROME.logo.maxW / logoSprite.width, CHROME.logo.maxH / logoSprite.height)
    );
    logoWrap.addChild(logoSprite);
  } else {
    const title = new Text({
      text: 'FOOTBALL GOLD',
      style: {
        fill: 0xffe082,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 3,
        stroke: { color: 0x1b5e20, width: 4 },
      },
    });
    title.anchor.set(0.5);
    logoWrap.addChild(title);
  }
  chromeLayer.addChild(logoWrap);

  const reelRoot = new Container();
  reelRoot.position.set(ORIGIN.x, ORIGIN.y);
  reelLayer.addChild(reelRoot);

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
      reelRoot.addChild(wrap);
      cells[c][r] = wrap;
    }
  }

  const dividers = createGridDividers();
  if (dividers) dividerLayer.addChild(dividers);

  const detachClips = attachClipTicker(ticker, clipPlayers);

  function clearCell(cell) {
    if (cell.__glow) {
      cell.removeChild(cell.__glow);
      cell.__glow.destroy();
      cell.__glow = null;
    }
    if (cell.__clip) {
      const idx = clipPlayers.indexOf(cell.__clip);
      if (idx >= 0) clipPlayers.splice(idx, 1);
      cell.removeChild(cell.__clip.view);
      cell.__clip.view.destroy({ children: true });
      cell.__clip = null;
    }
    if (cell.__sprite) {
      cell.removeChild(cell.__sprite);
      cell.__sprite.destroy();
      cell.__sprite = null;
    }
  }
  /** Filtered clip for idle; sprite fallback if clip missing. */
  /** @param {import('pixi.js').Container} cell @param {number} sym @param {{ scroll?: boolean }} [opts] */
  function mountSymbol(cell, sym, opts = {}) {
    if (!opts.scroll && cell.__sym === sym && (cell.__sprite || cell.__clip)) {
      if (cell.__sprite) cell.__sprite.alpha = 1;
      return;
    }

    clearCell(cell);
    const cx = GRID.cell / 2;
    const cy = GRID.cell / 2;

    const clip = createSymbolClip(sym, GRID.clip);
    if (clip) {
      clip.view.x = cx;
      clip.view.y = cy;
      if (opts.scroll) clip.view.alpha = 0.88;
      cell.addChild(clip.view);
      clipPlayers.push(clip);
      cell.__clip = clip;
      cell.__sym = sym;
      return;
    }

    const sprite = createSymbolSprite(sym, GRID.clip);
    if (!sprite) return;
    sprite.x = cx;
    sprite.y = cy;
    sprite.alpha = opts.scroll ? 0.88 : 1;
    cell.addChild(sprite);
    cell.__sprite = sprite;
    cell.__sym = sym;
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function setCellSymbolScroll(cell, sym) {
    mountSymbol(cell, sym, { scroll: true });
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function setCellSymbol(cell, sym) {
    mountSymbol(cell, sym);
  }

  /** @param {import('pixi.js').Container} cell @param {number} sym */
  function paintCell(cell, sym) {
    mountSymbol(cell, sym);
  }

  /** @param {import('pixi.js').Container} cell @param {(clip: ReturnType<typeof createSymbolClip>) => Promise<void>} run */
  async function withTempClip(cell, run) {
    const sym = cell.__sym ?? 0;
    const cx = GRID.cell / 2;
    const cy = GRID.cell / 2;
    const clip = createSymbolClip(sym, GRID.clip);
    if (!clip) return;
    clearCell(cell);
    clip.view.x = cx;
    clip.view.y = cy;
    cell.addChild(clip.view);
    clipPlayers.push(clip);
    cell.__clip = clip;
    cell.__sym = sym;
    await run(clip);
    paintCell(cell, sym);
  }

  /** @param {import('pixi.js').Container} cell */
  function playWinClip(cell) {
    return withTempClip(cell, (clip) => clip.play('win', 'restore'));
  }

  /** @param {import('pixi.js').Container} cell */
  function playLandClip(cell) {
    return withTempClip(cell, (clip) => clip.play('land', 'restore'));
  }

  /** @param {number[][]} grid */
  async function playScatterClips(grid) {
    /** @type {Promise<void>[]} */
    const plays = [];
    for (let c = 0; c < grid.length; c++) {
      for (let r = 0; r < grid[c].length; r++) {
        if (grid[c][r] !== 9) continue;
        const cell = cells[c]?.[r];
        if (!cell) continue;
        plays.push(withTempClip(cell, (clip) => clip.playSegment('win', 35)));
      }
    }
    if (plays.length) await Promise.all(plays);
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

  const wheelBanner = new Container();
  wheelBanner.position.set(STAGE.width / 2, STAGE.height / 2 - 40);
  wheelBanner.visible = false;
  overlayLayer.addChild(wheelBanner);
  const wheelText = new Text({
    text: '',
    style: { fill: 0xffe082, fontSize: 28, fontWeight: '900', stroke: { color: 0x1a472a, width: 5 } },
  });
  wheelText.anchor.set(0.5);
  wheelBanner.addChild(wheelText);

  const fsBanner = new Container();
  fsBanner.position.set(STAGE.width / 2, 120);
  fsBanner.visible = false;
  overlayLayer.addChild(fsBanner);
  const fsText = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 26, fontWeight: '900', stroke: { color: 0x1b5e20, width: 4 } },
  });
  fsText.anchor.set(0.5);
  fsBanner.addChild(fsText);

  const scatterFlash = new Container();
  scatterFlash.position.set(STAGE.width / 2, STAGE.height / 2);
  scatterFlash.visible = false;
  overlayLayer.addChild(scatterFlash);
  const scatterText = new Text({
    text: '',
    style: { fill: 0xffd700, fontSize: 24, fontWeight: '900', stroke: { color: 0x1a237e, width: 4 } },
  });
  scatterText.anchor.set(0.5);
  scatterFlash.addChild(scatterText);

  async function showBanner(banner, textEl, text, holdMs) {
    textEl.text = text;
    banner.visible = true;
    banner.alpha = 0;
    banner.scale.set(0.7);
    await animate(ticker, TIMING.fsBannerIn, (t) => {
      banner.alpha = t;
      banner.scale.set(0.7 + t * 0.3);
    });
    await new Promise((r) => setTimeout(r, holdMs));
    await animate(ticker, 300, (t) => {
      banner.alpha = 1 - t;
    });
    banner.visible = false;
  }

  function layoutScene(screenW, screenH) {
    // SOR portrait: main game sits above ~14% bottom gamepanel (config_mobile pt).
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
  requestAnimationFrame(() => layoutScene(app.screen.width, app.screen.height));

  const replayer = createEventReplayer({
    ticker,
    cells,
    setCellSymbol,
    setCellSymbolScroll,
    cellPos: cellPosition,
    createWinGlow,
    cellSize: GRID.cell,
    playWinClip,
    playLandClip,
    playScatterClips,
    showWheelBanner: (n) => showBanner(wheelBanner, wheelText, `WHEEL: ${n} FREE SPINS!`, TIMING.wheelBannerHold),
    showFsBanner: (n) => showBanner(fsBanner, fsText, `+${n} FREE SPINS!`, TIMING.fsBannerHold),
    showScatterFlash: (n) => showBanner(scatterFlash, scatterText, `${n} TROPHIES!`, 700),
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
