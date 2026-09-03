/**
 * Thrones of Olympus — native Pixi scene (RoO1000 Spine + spritesheet fallback).
 */

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  createSymbolSprite,
  createWinGlow,
  loadThronesAssets,
  createStaticBackgroundSprite,
  getBackgroundTexture,
} from './AssetLoader.js';
import {
  loadThronesSpineAssets,
  loadThronesChromeSpines,
  createSymbolSpine,
  createScrollSymbolSpine,
  createBackgroundSpine,
  createFreespinBackgroundSpine,
  createPlatformSpine,
  createLogoSpine,
  createSignpostSpine,
  createReelFrameSpine,
  createTumbleWinSpine,
  createGodPortraitSpine,
  createBigWinStack,
  createFsCounterSpine,
  createWinboxSpine,
  createWinlabelSpine,
  createTrailMultiSpine,
  createRunningMultiplierSpine,
  createIntroPanelSpine,
  createSummaryPanelSpine,
  showFsSummaryPanel,
  hideFsSummaryPanel,
  playSymbolPhase,
  setSymbolMultiplierValue,
  playSpineAnim,
  playScatterActivation,
  setGodMeterLevel,
  showSignpostLoop,
  showSignpostIdle,
  hideSignpost,
  setSignpostMultiplier,
  setTumbleWinValue,
  tumbleWinShow,
  tumbleWinCharge,
  tumbleWinPay,
  tumbleWinDisperse,
  tumbleWinHide,
  showBigWinCelebration,
  hideBigWinCelebration,
  showFsCounterAward,
  hideFsCounter,
  showIntroPanel,
  hideIntroPanel,
  playWinboxIn,
  playWinboxOut,
  playWinlabelShow,
  playWinlabelHide,
  playTrailCollect,
  showRunningMultiplier,
  updateRunningMultiplier,
  hideRunningMultiplier,
  swapGodPortraitSpine,
  playGodAction,
} from './ThronesSpineLoader.js';
import { animate } from './GridAnimator.js';
import { createEventReplayer } from './EventReplayer.js';
import {
  loadGameSounds,
  unlockAudio,
  startBaseMusic,
  playThronesSound,
} from './ThronesSound.js';
import {
  SCATTER_SYMBOL,
  LAND_ANIM_SYMBOLS,
  GRID,
  STAGE,
  STAGE_BG_COLOR,
  ORIGIN,
  CHROME,
  TIMING,
  GRID_BACKING_BLEED,
  gridPixelSize,
  cellPosition,
} from './config.js';

/**
 * @param {{ cols: number, rows: number, app: import('pixi.js').Application }} opts
 */
export async function createThronesScene(opts) {
  const { cols, rows, app } = opts;
  const layout = { cols, rows };
  const ticker = app.ticker;
  const { width: gridW, height: gridH } = gridPixelSize(cols, rows);
  const symbolSize = GRID.clip;

  await loadThronesAssets();
  await loadThronesSpineAssets();
  await loadThronesChromeSpines();
  await loadGameSounds().catch((err) => console.warn('[Thrones] sounds failed', err));
  void unlockAudio().then((ok) => {
    if (ok) startBaseMusic();
  });

  const root = new Container();

  /** Full-canvas bleed behind letterboxed stage (avoids atlas junk at edges). */
  const viewportBg = new Graphics();
  root.addChild(viewportBg);
  /** @type {import('pixi.js').Sprite | null} */
  let viewportBleedSprite = null;
  const bleedTex = getBackgroundTexture();
  if (bleedTex) {
    viewportBleedSprite = new Sprite(bleedTex);
    viewportBleedSprite.anchor.set(0.5);
    root.addChild(viewportBleedSprite);
  }

  const stageContent = new Container();
  stageContent.pivot.set(STAGE.width / 2, STAGE.height / 2);
  root.addChild(stageContent);

  const bgLayer = new Container();
  const platformLayer = new Container();
  const frameLayer = new Container();
  const gridLayer = new Container();
  const fxLayer = new Container();
  const uiLayer = new Container();
  const overlayLayer = new Container();
  // bg → platform → frame → grid (plate + symbols) → fx → ui → overlay
  stageContent.addChild(bgLayer, platformLayer, frameLayer, gridLayer, fxLayer, uiLayer, overlayLayer);

  /** @type {import('pixi.js').Sprite | null} */
  let staticBgSprite = null;
  try {
    staticBgSprite = createStaticBackgroundSprite();
    bgLayer.addChild(staticBgSprite);
  } catch (err) {
    console.warn('[Thrones] static bg failed', err);
  }

  try {
    bgLayer.addChild(createBackgroundSpine());
  } catch (err) {
    console.warn('[Thrones] background spine failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let fsBgSpine = null;
  try {
    fsBgSpine = createFreespinBackgroundSpine();
    bgLayer.addChild(fsBgSpine);
  } catch (err) {
    console.warn('[Thrones] fs bg spine failed', err);
  }


  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let reelFrameSpine = null;
  try {
    reelFrameSpine = createReelFrameSpine();
    frameLayer.addChild(reelFrameSpine);
  } catch (err) {
    console.warn('[Thrones] reel frame spine failed', err);
  }

  try {
    platformLayer.addChild(createPlatformSpine());
  } catch (err) {
    console.warn('[Thrones] platform spine failed', err);
  }

  /** Unmasked opaque plate — must sit outside reelRoot so bleed is not stencil-clipped. */
  const gridPlate = new Graphics();
  const bleed = GRID_BACKING_BLEED;
  gridPlate
    .rect(-bleed, -bleed, gridW + bleed * 2, gridH + bleed * 2)
    .fill({ color: STAGE_BG_COLOR });
  gridPlate.position.set(ORIGIN.x, ORIGIN.y);
  gridLayer.addChild(gridPlate);

  const reelRoot = new Container();
  reelRoot.position.set(ORIGIN.x, ORIGIN.y);
  gridLayer.addChild(reelRoot);

  const reelMask = new Graphics();
  reelMask.rect(0, 0, gridW, gridH).fill(0xffffff);
  reelMask.includeInBuild = true;
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
      const badge = new Text({
        text: '',
        style: { fill: 0xffee88, fontSize: 11, fontWeight: '800', stroke: { color: 0x000000, width: 3 } },
      });
      badge.anchor.set(1, 0);
      badge.x = GRID.cell - 2;
      badge.y = 2;
      badge.visible = false;
      wrap.__badge = badge;
      wrap.addChild(badge);
      reelRoot.addChild(wrap);
      cells[c][r] = wrap;
    }
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let logoSpine = null;
  try {
    logoSpine = createLogoSpine();
    uiLayer.addChild(logoSpine);
  } catch (err) {
    console.warn('[Thrones] logo spine failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let signpostSpine = null;
  try {
    signpostSpine = createSignpostSpine();
    uiLayer.addChild(signpostSpine);
  } catch (err) {
    console.warn('[Thrones] signpost spine failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let tumbleWinSpine = null;
  try {
    tumbleWinSpine = createTumbleWinSpine();
    uiLayer.addChild(tumbleWinSpine);
  } catch (err) {
    console.warn('[Thrones] tumble win spine failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let godPortraitSpine = null;
  try {
    godPortraitSpine = createGodPortraitSpine(0);
    uiLayer.addChild(godPortraitSpine);
  } catch (err) {
    console.warn('[Thrones] god portrait spine failed', err);
  }

  const bigWinStack = createBigWinStack();
  for (const s of [bigWinStack.bg, bigWinStack.shine, bigWinStack.stars, bigWinStack.banner]) {
    if (s) overlayLayer.addChild(s);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let winboxSpine = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let winlabelSpine = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let runningMultSpine = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let introPanelSpine = null;
  try {
    winboxSpine = createWinboxSpine();
    fxLayer.addChild(winboxSpine);
  } catch (err) {
    console.warn('[Thrones] winbox failed', err);
  }
  try {
    winlabelSpine = createWinlabelSpine();
    winlabelSpine.position.set(STAGE.width / 2, CHROME.tumbleWin.y + 40);
    fxLayer.addChild(winlabelSpine);
  } catch (err) {
    console.warn('[Thrones] winlabel failed', err);
  }
  try {
    runningMultSpine = createRunningMultiplierSpine();
    uiLayer.addChild(runningMultSpine);
  } catch (err) {
    console.warn('[Thrones] running multiplier failed', err);
  }
  try {
    introPanelSpine = createIntroPanelSpine();
    overlayLayer.addChild(introPanelSpine);
  } catch (err) {
    console.warn('[Thrones] intro panel failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let summaryPanelSpine = null;
  try {
    summaryPanelSpine = createSummaryPanelSpine();
    overlayLayer.addChild(summaryPanelSpine);
  } catch (err) {
    console.warn('[Thrones] summary panel failed', err);
  }

  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let fsCounterSpine = null;
  try {
    fsCounterSpine = createFsCounterSpine();
    overlayLayer.addChild(fsCounterSpine);
  } catch (err) {
    console.warn('[Thrones] fs counter spine failed', err);
  }

  const godWraps = godPortraitSpine ? [godPortraitSpine] : [];

  const fxRoot = new Container();
  fxRoot.position.set(ORIGIN.x, ORIGIN.y);
  fxLayer.addChild(fxRoot);
  const glowLayer = new Container();
  fxRoot.addChild(glowLayer);
  glowLayer.__makeGlow = createWinGlow;

  const bigWinBanner = new Container();
  bigWinBanner.position.set(STAGE.width / 2, STAGE.height / 2);
  bigWinBanner.visible = false;
  overlayLayer.addChild(bigWinBanner);
  const bigWinText = new Text({
    text: 'BIG WIN',
    style: { fill: 0xffe082, fontSize: 42, fontWeight: '900', stroke: { color: 0x6a1b00, width: 6 } },
  });
  bigWinText.anchor.set(0.5);
  bigWinBanner.addChild(bigWinText);

  const fsBanner = new Container();
  fsBanner.position.set(CHROME.logo.x, CHROME.logo.y + 52);
  fsBanner.visible = false;
  overlayLayer.addChild(fsBanner);
  const fsText = new Text({
    text: 'FREE SPINS!',
    style: { fill: 0xeebbff, fontSize: 26, fontWeight: '900' },
  });
  fsText.anchor.set(0.5);
  fsBanner.addChild(fsText);

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

  function paintCell(cell, sym, mult = 0, revealMult = false) {
    clearCell(cell);
    cell.__sym = sym;
    cell.__mult = mult;

    try {
      const spine = createSymbolSpine(sym, symbolSize);
      cell.addChildAt(spine, 0);
      cell.__spine = spine;
    } catch {
      const sprite = createSymbolSprite(sym, symbolSize);
      if (sprite) {
        sprite.x = GRID.cell / 2;
        sprite.y = GRID.cell / 2;
        cell.addChildAt(sprite, 0);
        cell.__sprite = sprite;
      }
    }

    if (sym >= 12 && sym <= 14 && cell.__spine) {
      setSymbolMultiplierValue(cell.__spine, revealMult ? mult : 0);
    }
    cell.__badge.visible = false;
  }

  function setCellMultiplier(cell, value) {
    if (!cell) return;
    setSymbolMultiplierValue(cell.__spine, value);
    cell.__badge.visible = false;
  }

  function paintCellScroll(cell) {
    clearCell(cell);
    cell.__sym = -1;
    try {
      const spine = createScrollSymbolSpine(symbolSize);
      cell.addChildAt(spine, 0);
      cell.__spine = spine;
    } catch {
      /* blur optional */
    }
  }

  function playWinClip(cell) {
    const sym = cell.__sym ?? 0;
    if (!cell.__spine) return Promise.resolve();
    return playSymbolPhase(cell.__spine, 'win', sym);
  }

  function playLandClip(cell) {
    const sym = cell.__sym ?? 0;
    if (!LAND_ANIM_SYMBOLS.has(sym) || !cell.__spine) return Promise.resolve();
    return playSymbolPhase(cell.__spine, 'land', sym);
  }

  let tumbleWinVisible = false;
  let tumbleWinValue = 0;

  function updateTumbleText(value) {
    tumbleWinValue = value;
    if (tumbleWinSpine) setTumbleWinValue(tumbleWinSpine, value);
  }

  async function resetTumbleWin() {
    tumbleWinVisible = false;
    tumbleWinValue = 0;
    updateTumbleText(0);
    if (tumbleWinSpine) await tumbleWinHide(tumbleWinSpine);
    if (signpostSpine) setSignpostMultiplier(signpostSpine, 0);
  }

  async function onCascadeWin(value) {
    updateTumbleText(value);
    if (!tumbleWinSpine) return;
    if (!tumbleWinVisible) {
      tumbleWinVisible = true;
      await tumbleWinShow(tumbleWinSpine);
    }
    await tumbleWinCharge(tumbleWinSpine);
  }

  async function onMultiplierApply(totalWin, sum) {
    if (signpostSpine) {
      setSignpostMultiplier(signpostSpine, sum);
      await playSpineAnim(signpostSpine, ['show'], false);
      void playSpineAnim(signpostSpine, ['loop'], true);
    }
    updateTumbleText(totalWin);
    if (tumbleWinSpine) {
      await tumbleWinPay(tumbleWinSpine);
      await new Promise((r) => setTimeout(r, TIMING.tumbleDisperseOut));
      await tumbleWinDisperse(tumbleWinSpine);
    }
    tumbleWinVisible = false;
    updateTumbleText(0);
  }

  function hideSignpostFn() {
    if (signpostSpine) {
      signpostSpine.visible = false;
      void hideSignpost(signpostSpine);
    }
  }

  function showSignpostIdleFn() {
    if (signpostSpine) void showSignpostIdle(signpostSpine);
  }

  function spawnWinFx(positions) {
    if (!winboxSpine && !winlabelSpine) return Promise.resolve();
    let cx = 0;
    let cy = 0;
    for (const [c, r] of positions) {
      cx += cells[c][r].x + GRID.cell / 2;
      cy += cells[c][r].y + GRID.cell / 2;
    }
    cx = ORIGIN.x + cx / positions.length;
    cy = ORIGIN.y + cy / positions.length;
    if (winboxSpine) {
      winboxSpine.x = cx;
      winboxSpine.y = cy;
    }
    return Promise.all([
      winboxSpine ? playWinboxIn(winboxSpine) : Promise.resolve(),
      winlabelSpine ? playWinlabelShow(winlabelSpine) : Promise.resolve(),
    ]);
  }

  async function endWinFx() {
    await Promise.all([
      winboxSpine ? playWinboxOut(winboxSpine) : Promise.resolve(),
      winlabelSpine ? playWinlabelHide(winlabelSpine) : Promise.resolve(),
    ]);
  }

  function spawnTrailFx(positions) {
    const target = {
      x: tumbleWinSpine?.x ?? CHROME.tumbleWin.x,
      y: tumbleWinSpine?.y ?? CHROME.tumbleWin.y,
    };
    for (const [c, r] of positions) {
      try {
        const trail = createTrailMultiSpine();
        trail.x = ORIGIN.x + cells[c][r].x + GRID.cell / 2;
        trail.y = ORIGIN.y + cells[c][r].y + GRID.cell / 2;
        fxLayer.addChild(trail);
        void playTrailCollect(trail, target).then(() => trail.destroy({ children: true }));
      } catch {
        /* optional */
      }
    }
  }

  function onColumnStart(_col) {
    /* column cloud / anticipation FX removed */
  }

  function onColumnLand(_col) {
    /* column cloud / anticipation FX removed */
  }

  function onHyperSpinStart() {
    /* hyperspin cloud overlay removed */
  }

  function onHyperSpinStop() {
    /* hyperspin cloud overlay removed */
  }

  function onColumnAnticipate(_col, _phase) {
    /* column cloud / anticipation FX removed */
  }

  function onFreeSpinsAwarded(_count) {
    setFreeSpinMode(true);
    if (runningMultSpine) void showRunningMultiplier(runningMultSpine, 1);
  }

  function onFreeSpinsEnd() {
    setFreeSpinMode(false);
    if (runningMultSpine) void hideRunningMultiplier(runningMultSpine);
  }

  async function showFsSummary(totalWin) {
    if (!summaryPanelSpine) return;
    await showFsSummaryPanel(summaryPanelSpine, totalWin);
    await new Promise((r) => setTimeout(r, TIMING.fsBannerHold));
    await hideFsSummaryPanel(summaryPanelSpine);
  }

  function setFreeSpinMode(inFs) {
    if (fsBgSpine) {
      fsBgSpine.visible = inFs;
      if (inFs) {
        void playSpineAnim(fsBgSpine, ['transition'], false).then(() =>
          playSpineAnim(fsBgSpine, ['loop_freespin'], true)
        );
      } else {
        fsBgSpine.visible = false;
      }
    }
    if (!inFs && runningMultSpine) void hideRunningMultiplier(runningMultSpine);
  }

  function onFsMultiplierUpdate(value) {
    if (!runningMultSpine) return;
    if (value > 0) {
      void showRunningMultiplier(runningMultSpine, value);
      void updateRunningMultiplier(runningMultSpine, value);
    } else {
      void hideRunningMultiplier(runningMultSpine);
    }
  }

  function setGodMeterLevels(sum) {
    if (!godPortraitSpine) return;
    const level = sum >= 30 ? 3 : sum >= 15 ? 2 : sum >= 5 ? 1 : 0;
    setGodMeterLevel(godPortraitSpine, level);
  }

  function getMult(multGrid, c, r) {
    if (!multGrid) return 0;
    return multGrid[r]?.[c] ?? 0;
  }

  function setSymbolsImmediate(grid, multGrid = null) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        paintCell(cells[c][r], grid[c]?.[r] ?? 0, getMult(multGrid, c, r), true);
        const pos = cellPosition(c, r);
        cells[c][r].x = pos.x;
        cells[c][r].y = pos.y;
        cells[c][r].visible = true;
        cells[c][r].alpha = 1;
        cells[c][r].scale.set(1);
      }
    }
    glowLayer.removeChildren();
  }

  function showTumbleWin(value) {
    void value;
    /* driven by onCascadeWin / onMultiplierApply in EventReplayer */
  }

  function setMultiplierSum(sum) {
    setGodMeterLevels(sum);
    if (!signpostSpine) return;
    if (sum > 0) {
      setSignpostMultiplier(signpostSpine, sum);
      void showSignpostLoop(signpostSpine, `×${sum}`);
    } else {
      showSignpostIdleFn();
    }
  }

  let panelBaseScale = 1;
  function pulseTumblePanel(t) {
    if (!tumbleWinSpine) return;
    const pulse = 1 + Math.sin(t * Math.PI) * 0.12;
    tumbleWinSpine.scale.set(panelBaseScale * pulse);
  }

  let signpostBaseScale = CHROME.signpost.scale;
  function pulseSignpost(t) {
    if (!signpostSpine) return;
    const pulse = 1 + Math.sin(t * Math.PI) * 0.15;
    signpostSpine.scale.set(signpostBaseScale * pulse);
  }

  function resetPanelScale() {
    if (tumbleWinSpine) tumbleWinSpine.scale.set(panelBaseScale);
    if (signpostSpine) signpostSpine.scale.set(signpostBaseScale);
  }

  async function showBigWin(amount, bet = 20) {
    if (amount < bet * 10) return;
    if (logoSpine) void playSpineAnim(logoSpine, ['win', 'idle'], false);
    if (godPortraitSpine) void playGodAction(godPortraitSpine, godPortraitSpine.__godId ?? 0);
    if (bigWinStack.banner) {
      await showBigWinCelebration(bigWinStack, amount, bet);
      await new Promise((r) => setTimeout(r, TIMING.bigWinHold));
      await hideBigWinCelebration(bigWinStack);
      return;
    }
    bigWinText.text = amount >= bet * 50 ? 'MEGA WIN' : 'BIG WIN';
    bigWinBanner.visible = true;
    bigWinBanner.alpha = 0;
    await animate(ticker, TIMING.bigWinIn, (t) => {
      bigWinBanner.alpha = t;
    });
    await new Promise((r) => setTimeout(r, TIMING.bigWinHold));
    await animate(ticker, TIMING.bigWinOut, (t) => {
      bigWinBanner.alpha = 1 - t;
    });
    bigWinBanner.visible = false;
  }

  async function showFsBanner(count) {
    if (introPanelSpine && count >= 12) {
      await showIntroPanel(introPanelSpine);
      await new Promise((r) => setTimeout(r, TIMING.fsBannerHold));
      await hideIntroPanel(introPanelSpine);
    }
    if (fsCounterSpine) {
      await showFsCounterAward(fsCounterSpine, count);
      await new Promise((r) => setTimeout(r, TIMING.fsBannerHold));
      await hideFsCounter(fsCounterSpine);
      return;
    }
    fsText.text = `+${count} FREE SPINS!`;
    fsBanner.visible = true;
    fsBanner.alpha = 0;
    await animate(ticker, TIMING.fsBannerIn, (t) => {
      fsBanner.alpha = t;
    });
    await new Promise((r) => setTimeout(r, TIMING.fsBannerHold));
    await animate(ticker, TIMING.fsBannerOut, (t) => {
      fsBanner.alpha = 1 - t;
    });
    fsBanner.visible = false;
  }

  async function showScatterFlash(count, positions) {
    /** @type {Promise<void>[]} */
    const plays = [];
    const posSet =
      positions?.length > 0
        ? new Set(positions.map(([c, r]) => `${c},${r}`))
        : null;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (posSet && !posSet.has(`${c},${r}`)) continue;
        const cell = cells[c][r];
        if (cell.__sym !== SCATTER_SYMBOL) continue;
        if (cell.__spine) plays.push(playScatterActivation(cell.__spine));
        else plays.push(playWinClip(cell));
      }
    }
    if (logoSpine) plays.push(playSpineAnim(logoSpine, ['win', 'idle'], false));
    if (plays.length) await Promise.all(plays);
    else await new Promise((r) => setTimeout(r, TIMING.scatterFlash));
    void count;
  }

  function onMultiplierLand(ev) {
    if (!godPortraitSpine) return godPortraitSpine;
    godPortraitSpine = swapGodPortraitSpine(godPortraitSpine, ev.godId ?? 0);
    if (godWraps.length) godWraps[0] = godPortraitSpine;
    return godPortraitSpine;
  }

  function layoutScene(screenW, screenH) {
    const hudReserve = screenH * 0.14;
    const playH = Math.max(0, screenH - hudReserve);
    root.x = screenW / 2;
    root.y = playH / 2;
    const scale = Math.min(screenW / STAGE.width, playH / STAGE.height);
    stageContent.scale.set(scale);

    // Snap grid origin to whole screen pixels — reduces subpixel shimmer at mask edges.
    const pivotX = STAGE.width / 2;
    const pivotY = STAGE.height / 2;
    const gridScreenX = root.x + (ORIGIN.x - pivotX) * scale;
    const gridScreenY = root.y + (ORIGIN.y - pivotY) * scale;
    root.x += Math.round(gridScreenX) - gridScreenX;
    root.y += Math.round(gridScreenY) - gridScreenY;

    viewportBg.clear();
    viewportBg.rect(-screenW / 2, -playH / 2, screenW, screenH).fill({ color: STAGE_BG_COLOR });

    const canvasOffsetY = (screenH - playH) / 2;
    if (viewportBleedSprite?.texture) {
      const tex = viewportBleedSprite.texture;
      viewportBleedSprite.position.set(0, canvasOffsetY);
      const cover = Math.max(screenW / tex.width, screenH / tex.height) * 1.1;
      viewportBleedSprite.scale.set(cover);
    }

    if (staticBgSprite?.texture) {
      const tex = staticBgSprite.texture;
      const cover =
        Math.max(STAGE.width / tex.width, STAGE.height / tex.height) * 1.35;
      staticBgSprite.scale.set(cover);
    }
  }

  layoutScene(app.screen.width, app.screen.height);
  requestAnimationFrame(() => layoutScene(app.screen.width, app.screen.height));
  app.renderer.on('resize', () => layoutScene(app.screen.width, app.screen.height));

  setMultiplierSum(0);

  const replayer = createEventReplayer({
    ticker,
    cells,
    layout,
    glowLayer,
    paintCell,
    paintCellScroll,
    setSymbolsImmediate,
    showTumbleWin,
    setMultiplierSum,
    setCellMultiplier,
    showFsBanner,
    showScatterFlash,
    showBigWin,
    godWraps,
    godPortrait: godPortraitSpine,
    fxLayer,
    hideSignpost: hideSignpostFn,
    resetTumbleWin,
    onCascadeWin,
    onMultiplierApply,
    spawnWinFx,
    endWinFx,
    spawnTrailFx,
    onColumnStart,
    onColumnLand,
    pulseTumblePanel,
    pulseSignpost,
    resetPanelScale,
    playWinClip,
    playLandClip,
    onMultiplierLand,
    onFsMultiplierUpdate,
    onHyperSpinStart,
    onHyperSpinStop,
    onColumnAnticipate,
    onFreeSpinsAwarded,
    onFreeSpinsEnd,
    showFsSummary,
  });

  async function runSpinTransition(spinPromise) {
    await replayer.runSpinTransition(spinPromise);
  }

  function syncFreeSpinState(fs) {
    setFreeSpinMode(fs.remaining > 0);
    if (fs.remaining > 0 && runningMultSpine) {
      void showRunningMultiplier(runningMultSpine, Math.max(1, fs.multiplier ?? 1));
    } else if (fs.remaining <= 0 && runningMultSpine) {
      void hideRunningMultiplier(runningMultSpine);
    }
  }

  return {
    view: root,
    width: gridW,
    height: gridH,
    setSymbols: setSymbolsImmediate,
    runSpinTransition,
    replayEvents: replayer.replay,
    setAnimationSpeed: replayer.setAnimationSpeed,
    layout: layoutScene,
    setMultiplierSum,
    showTumbleWin,
    setFreeSpinMode,
    syncFreeSpinState,
    playSymbolPhase,
  };
}
