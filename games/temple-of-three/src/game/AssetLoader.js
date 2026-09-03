/**
 * Egypt Treasures — TOT placeholder assets (paytable + spine JPG atlases).
 */

import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { createSymbolClipPlayer } from './SymbolClipPlayer.js';
import { GRID, CHROME, STAGE, ORIGIN } from './config.js';

const BASE = '/assets/temple-of-three';

/** @type {Record<string, unknown> | null} */
let manifest = null;
/** @type {Map<string, import('pixi.js').Texture>} */
let frameToTex = null;
/** @type {Map<string, object>} */
let frameMeta = null;
/** @type {Map<number, import('pixi.js').Texture>} */
let symbolTextures = null;
/** @type {Map<string, import('pixi.js').Texture>} */
let uiTextures = null;
/** @type {Record<string, object> | null} */
let symbolClips = null;
/** @type {object | null} */
let backgroundClipDef = null;
/** @type {Record<string, object> | null} */
let potClips = null;
/** @type {Record<string, object> | null} */
let logoClips = null;
/** @type {import('pixi.js').Texture | null} */
let backgroundTexture = null;
/** @type {import('pixi.js').Texture | null} */
let logoTexture = null;
/** @type {import('pixi.js').Texture | null} */
let reelPlateTexture = null;

async function loadManifest() {
  if (manifest) return manifest;
  const res = await fetch(`${BASE}/manifest.json`);
  if (!res.ok) throw new Error('Missing assets/egypt-treasures/manifest.json — run npm run fetch-tot-assets');
  manifest = await res.json();
  return manifest;
}

/** @param {string} jsonFile */
async function ingestAtlasJson(jsonFile) {
  try {
    const res = await fetch(`${BASE}/${jsonFile}`);
    if (!res.ok) return;
    const json = await res.json();
    for (const [key, entry] of Object.entries(json.frames ?? {})) {
      if (!frameMeta.has(key)) frameMeta.set(key, entry);
    }
  } catch {
    /* optional */
  }
}

export async function loadEgyptAssets() {
  manifest = null;
  frameToTex = null;
  frameMeta = null;
  symbolTextures = null;
  uiTextures = null;
  symbolClips = null;
  backgroundClipDef = null;
  potClips = null;
  logoClips = null;
  backgroundTexture = null;
  logoTexture = null;
  reelPlateTexture = null;

  const cfg = await loadManifest();
  frameToTex = new Map();
  frameMeta = new Map();
  symbolTextures = new Map();
  uiTextures = new Map();
  symbolClips = null;

  const sheetFiles = [...(cfg.spritesheets ?? []), ...(cfg.backgroundSheets ?? [])];
  const cacheBust = import.meta.env?.DEV ? `?v=${Date.now()}` : '';
  await Promise.all(sheetFiles.map((file) => ingestAtlasJson(file)));

  const sheets = await Promise.all(
    sheetFiles.map((file) => Assets.load(`${BASE}/${file}${cacheBust}`).catch(() => null))
  );
  for (const sheet of sheets) {
    if (!sheet?.textures) continue;
    for (const [key, tex] of Object.entries(sheet.textures)) {
      if (!frameToTex.has(key)) frameToTex.set(key, tex);
    }
  }

  try {
    const clipsRes = await fetch(`${BASE}/${cfg.clips ?? 'symbol-clips.json'}`);
    if (clipsRes.ok) {
      symbolClips = await clipsRes.json();
      backgroundClipDef = symbolClips.backgroundClip ?? null;
    }
  } catch {
    /* optional */
  }

  const logoSheet = cfg.logoAnimSheet ?? 'logo_anim.json';
  try {
    await ingestAtlasJson(logoSheet);
    const logoSheetLoaded = await Assets.load(`${BASE}/${logoSheet}`).catch(() => null);
    if (logoSheetLoaded?.textures) {
      for (const [key, tex] of Object.entries(logoSheetLoaded.textures)) {
        frameToTex.set(key, tex);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const potClipsRes = await fetch(`${BASE}/${cfg.potClips ?? 'pot-clips.json'}`);
    if (potClipsRes.ok) potClips = await potClipsRes.json();
  } catch {
    /* optional */
  }

  const potSheet = cfg.potAnimSheet ?? 'pot_anim.json';
  try {
    await ingestAtlasJson(potSheet);
    const potSheetLoaded = await Assets.load(`${BASE}/${potSheet}`).catch(() => null);
    if (potSheetLoaded?.textures) {
      for (const [key, tex] of Object.entries(potSheetLoaded.textures)) {
        frameToTex.set(key, tex);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const logoClipsRes = await fetch(`${BASE}/${cfg.logoClips ?? 'logo-clips.json'}`);
    if (logoClipsRes.ok) logoClips = await logoClipsRes.json();
  } catch {
    /* optional */
  }

  if (!potClips?.pots && symbolClips?.potClips) {
    potClips = { fps: symbolClips.fps ?? 30, pots: symbolClips.potClips };
  }

  for (const [id, entry] of Object.entries(cfg.symbols ?? {})) {
    const frame = /** @type {{ frame?: string }} */ (entry).frame;
    const tex = frameToTex.get(frame);
    if (tex) symbolTextures.set(parseInt(id, 10), tex);
  }

  for (const [uiKey, frameKey] of Object.entries(cfg.ui ?? {})) {
    const tex = frameToTex.get(frameKey);
    if (tex) uiTextures.set(uiKey, tex);
  }

  const bg = cfg.background ?? {};
  for (const file of [bg.png, bg.jpg].filter(Boolean)) {
    try {
      backgroundTexture = await Assets.load(`${BASE}/${file}`);
      break;
    } catch {
      /* try next */
    }
  }

  const logo = cfg.logo ?? {};
  for (const file of [logo.png, logo.jpg].filter(Boolean)) {
    try {
      logoTexture = await Assets.load(`${BASE}/${file}`);
      break;
    } catch {
      /* try next */
    }
  }

  const reel = cfg.reelFrame ?? {};
  for (const file of [reel.png, reel.jpg].filter(Boolean)) {
    try {
      reelPlateTexture = await Assets.load(`${BASE}/${file}`);
      break;
    } catch {
      /* try next */
    }
  }

  if (!symbolClips?.symbols) {
    throw new Error('Missing symbol-clips.json — run npm run fetch-tot-assets');
  }

  if (backgroundClipDef) {
    const probe = backgroundClipDef.frames?.[0]?.[0]?.frame;
    if (probe && !frameToTex.has(probe)) {
      backgroundClipDef = null;
    }
  }

  return { frameToTex, frameMeta, symbolTextures, uiTextures, backgroundTexture, logoTexture, reelPlateTexture, symbolClips };
}

export function getFrameMeta() {
  return frameMeta;
}

/** @param {number} symbolId */
export function getSymbolClipDef(symbolId) {
  return symbolClips?.symbols?.[String(symbolId)] ?? null;
}

/** @param {number} symbolId @param {number} [displaySize] */
export function createSymbolClip(symbolId, displaySize = GRID.clip) {
  const def = getSymbolClipDef(symbolId);
  if (!def || !frameToTex?.size) return null;
  return createSymbolClipPlayer(def, frameToTex, frameMeta, displaySize);
}

/** @param {number} symbolId @param {number} size @param {{ blur?: boolean }} [opts] */
export function createSymbolSprite(symbolId, size = GRID.clip, opts = {}) {
  const tex = symbolTextures?.get(symbolId) ?? symbolTextures?.get(0);
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  const scale = size / Math.max(sprite.width, sprite.height);
  sprite.scale.set(scale);
  sprite.__baseScale = scale;
  if (opts.blur) {
    sprite.alpha = 0.82;
    sprite.scale.set(scale * 1.04);
  }
  return sprite;
}

/** Ambient temple background (fire + hieroglyph glow loop). */
export function createBackgroundClip() {
  if (!backgroundClipDef || !frameToTex?.size) return null;
  const probe = backgroundClipDef.frames?.[0]?.[0]?.frame;
  if (probe && !frameToTex.has(probe)) return null;

  const bw = backgroundClipDef.size?.w ?? STAGE.width;
  const bh = backgroundClipDef.size?.h ?? STAGE.height;
  const player = createSymbolClipPlayer(
    { ...backgroundClipDef, fps: symbolClips?.fps ?? 30 },
    frameToTex,
    frameMeta,
    STAGE.width,
    { w: bw, h: bh }
  );
  player.view.position.set(STAGE.width / 2, STAGE.height / 2);
  player.playLoop();
  return player;
}

/** @param {number} [cols] @param {number} [rows] */
export function createReelPlate(cols = 5, rows = 3) {
  if (!reelPlateTexture) return null;
  const sprite = new Sprite(reelPlateTexture);
  sprite.anchor.set(0.5);
  const gridW = cols * GRID.colPitch - GRID.gapX;
  const gridH = rows * GRID.rowPitch - GRID.gapY;
  const padX = 36;
  const padY = 28;
  sprite.scale.set((gridW + padX) / sprite.width, (gridH + padY) / sprite.height);
  sprite.position.set(ORIGIN.x + gridW / 2, ORIGIN.y + gridH / 2);
  return sprite;
}

/** Dark grid plate behind symbols. */
export function createGridPlate() {
  const plateTex = uiTextures?.get('grid_plate');
  if (!plateTex) return null;
  const plate = new Sprite(plateTex);
  const dw = CHROME.plate.designW ?? plateTex.width;
  const dh = CHROME.plate.designH ?? plateTex.height;
  plate.anchor.set(CHROME.plate.pivotX / dw, CHROME.plate.pivotY / dh);
  plate.width = dw;
  plate.height = dh;
  plate.position.set(CHROME.plate.x, CHROME.plate.y);
  return plate;
}

/** Vertical reel dividers (drawn over symbols). */
export function createGridDividers() {
  const divTex = uiTextures?.get('grid_divider');
  if (!divTex) return null;
  const root = new Container();
  const dw = CHROME.divider.designW ?? divTex.width;
  const dh = CHROME.divider.designH ?? divTex.height;
  for (const x of CHROME.divider.xs) {
    const div = new Sprite(divTex);
    div.anchor.set(CHROME.divider.pivotX / dw, CHROME.divider.pivotY / dh);
    div.width = dw;
    div.height = dh;
    div.position.set(x, CHROME.divider.y);
    root.addChild(div);
  }
  return root;
}

/** Grid plate + reel dividers (main_texture0). */
export function createReelGridChrome() {
  const root = new Container();
  const plate = createGridPlate();
  if (plate) root.addChild(plate);
  const dividers = createGridDividers();
  if (dividers) root.addChild(dividers);
  return root;
}

/** Ra / Bastet / Anubis pot idle loops from baked pot_anim. */
export function createCollectors() {
  if (!potClips?.pots || !frameToTex?.size) return null;

  const root = new Container();
  /** @type {ReturnType<typeof createSymbolClipPlayer>[]} */
  const players = [];

  root.__potPlayers = {};
  for (const [key, entry] of Object.entries(CHROME.collectors)) {
    const def = potClips.pots[key];
    if (!def) continue;
    const player = createSymbolClipPlayer(
      { ...def, fps: potClips.fps ?? 30 },
      frameToTex,
      frameMeta,
      entry.maxW,
      { w: def.size ?? entry.maxW, h: def.size ?? entry.maxH }
    );
    player.view.position.set(entry.x, entry.y);
    player.playLoopRange(0, def.labels?.collect ?? 24);
    root.addChild(player.view);
    players.push(player);
    root.__potPlayers[key] = player;
  }

  root.__clipPlayers = players;
  return root.children.length ? root : null;
}

export function getCollectorClipPlayers(collectorsRoot) {
  return collectorsRoot?.__clipPlayers ?? [];
}

export function getPotPlayer(collectorsRoot, ppsType) {
  const key = potKeyFromPpsType(ppsType);
  return collectorsRoot?.__potPlayers?.[key] ?? null;
}

/** ppsType from server → pot clip key */
const PPS_POT_KEY = { 4: 'anubis', 2: 'bastet', 1: 'ra' };

/** @param {number} ppsType */
export function potKeyFromPpsType(ppsType) {
  return PPS_POT_KEY[ppsType] ?? 'anubis';
}
export function createStageChrome() {
  return new Container();
}

/** @param {number} size */
export function createWinGlow(size) {
  const tex = uiTextures?.get('win_glow');
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.scale.set(size / Math.max(tex.width, tex.height));
  sprite.alpha = 0.85;
  sprite.blendMode = 'add';
  return sprite;
}

export function getBackgroundTexture() {
  return backgroundTexture;
}

/** @param {number} [size] */
export function createCellMask(size = GRID.cell) {
  const g = new Graphics();
  g.rect(0, 0, size, size).fill(0xffffff);
  return g;
}

export function getLogoTexture() {
  return logoTexture;
}

/** Static logo from baked logo_anim first frame (banner aspect). */
export function createLogoSprite() {
  const tex = frameToTex?.get('add_Comp_1_00000');
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.scale.set(
    Math.min(CHROME.logo.maxW / sprite.width, CHROME.logo.maxH / sprite.height)
  );
  return sprite;
}

/** Animated logo from TOT spine atlas bake. */
export function createLogoClip() {
  if (!logoClips?.frames?.length || !frameToTex?.size) return null;
  return createSymbolClipPlayer(logoClips, frameToTex, frameMeta, CHROME.logo.maxW, {
    w: logoClips.size?.w ?? CHROME.logo.maxW,
    h: logoClips.size?.h ?? CHROME.logo.maxH,
  });
}
