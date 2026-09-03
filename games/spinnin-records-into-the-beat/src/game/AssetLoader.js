/**
 * Football Gold — original SOR assets (layered clips + skin/background atlases).
 */

import { Assets, AnimatedSprite, Container, Sprite } from 'pixi.js';
import { createSymbolClipPlayer } from './SymbolClipPlayer.js';
import { GRID, CHROME, STAGE } from './config.js';

const BASE = '/assets/spinnin-records-into-the-beat';

/** @type {Record<string, unknown> | null} */
let manifest = null;
/** @type {Map<string, import('pixi.js').Texture>} */
let clipFrameToTex = null;
/** @type {Map<string, object>} */
let frameMeta = null;
/** @type {Map<number, import('pixi.js').Texture>} */
let symbolTextures = null;
/** @type {Map<number, import('pixi.js').Texture[]>} */
let winTextures = null;
/** @type {Map<string, import('pixi.js').Texture>} */
let uiTextures = null;
/** @type {Record<string, object> | null} */
let symbolClips = null;
/** @type {object | null} */
let backgroundClipDef = null;
/** @type {import('pixi.js').Texture | null} */
let backgroundTexture = null;
/** @type {import('pixi.js').Texture | null} */
let logoTexture = null;

async function loadManifest() {
  if (manifest) return manifest;
  const res = await fetch(`${BASE}/manifest.json`);
  if (!res.ok) throw new Error('Missing assets/football-gold/manifest.json — run npm run fetch-sor-assets');
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
    /* optional sheet */
  }
}

export async function loadFootballAssets() {
  manifest = null;
  clipFrameToTex = null;
  frameMeta = null;
  symbolTextures = null;
  winTextures = null;
  uiTextures = null;
  symbolClips = null;
  backgroundClipDef = null;
  backgroundTexture = null;
  logoTexture = null;

  const cfg = await loadManifest();
  frameMeta = new Map();
  clipFrameToTex = new Map();
  symbolTextures = new Map();
  winTextures = new Map();
  uiTextures = new Map();

  const cacheBust = import.meta.env?.DEV ? `?v=${Date.now()}` : '';

  const symSheet = await Assets.load(`${BASE}/symbols_level2.json${cacheBust}`).catch(() => null);
  if (symSheet?.textures) {
    for (const [id, entry] of Object.entries(cfg.symbols ?? {})) {
      const frame = /** @type {{ frame?: string }} */ (entry).frame;
      const tex = symSheet.textures[frame];
      if (tex) symbolTextures.set(parseInt(id, 10), tex);
    }
  }

  await ingestAtlasJson('skin_texture0_level2.json');
  const skin0 = await Assets.load(`${BASE}/skin_texture0_level2.json${cacheBust}`).catch(() => null);
  if (skin0?.textures) {
    for (const [uiKey, frameKey] of Object.entries(cfg.ui ?? {})) {
      const tex = skin0.textures[frameKey];
      if (tex) uiTextures.set(uiKey, tex);
    }
  }

  const skinSheets = (cfg.spritesheets ?? []).filter((f) => f.startsWith('skin_'));
  await Promise.all(skinSheets.map((file) => ingestAtlasJson(file)));
  const skinLoaded = await Promise.all(
    skinSheets.map((file) => Assets.load(`${BASE}/${file}${cacheBust}`).catch(() => null))
  );
  for (const sheet of skinLoaded) {
    if (!sheet?.textures) continue;
    for (const [key, tex] of Object.entries(sheet.textures)) {
      if (!clipFrameToTex.has(key)) clipFrameToTex.set(key, tex);
    }
  }

  try {
    const clipsFile = cfg.clips ?? 'symbol-clips.json';
    const clipsRes = await fetch(`${BASE}/${clipsFile}`);
    if (clipsRes.ok) {
      symbolClips = await clipsRes.json();
      backgroundClipDef = symbolClips.backgroundClip ?? null;
    }
  } catch {
    /* clips required for animations */
  }

  const bg = cfg.background ?? {};
  for (const file of [bg.avif, bg.jpg].filter(Boolean)) {
    try {
      backgroundTexture = await Assets.load(`${BASE}/${file}${cacheBust}`);
      break;
    } catch {
      /* try next */
    }
  }

  const logo = cfg.logo ?? {};
  if (logo.png) {
    try {
      logoTexture = await Assets.load(`${BASE}/${logo.png}${cacheBust}`);
    } catch {
      /* optional */
    }
  }

  if (symbolTextures.size === 0) {
    throw new Error('No symbol textures loaded — run npm run fetch-sor-assets');
  }

  if (!symbolClips?.symbols) {
    throw new Error('Missing symbol-clips.json — run npm run fetch-sor-assets');
  }

  return {
    frameToTex: clipFrameToTex,
    frameMeta,
    symbolTextures,
    uiTextures,
    backgroundTexture,
    logoTexture,
    symbolClips,
  };
}

export function getFrameMeta() {
  return frameMeta;
}

/** @param {number} symbolId */
export function getSymbolClipDef(symbolId) {
  return symbolClips?.symbols?.[String(symbolId)] ?? null;
}

/** @param {number} symbolId @param {number} [displaySize] */
export function createSymbolClip(symbolId, displaySize = GRID.cell) {
  const def = getSymbolClipDef(symbolId);
  if (!def || !clipFrameToTex?.size) return null;
  return createSymbolClipPlayer(def, clipFrameToTex, frameMeta, displaySize);
}

/** Ambient stadium layers from original background bundle. */
export function createBackgroundClip() {
  if (!backgroundClipDef || !clipFrameToTex?.size) return null;
  const player = createSymbolClipPlayer(
    { ...backgroundClipDef, fps: symbolClips?.fps ?? 30 },
    clipFrameToTex,
    frameMeta,
    STAGE.height,
    backgroundClipDef.size
  );
  player.view.position.set(STAGE.width / 2, STAGE.height / 2);
  player.playLoop();
  return player;
}

/** @param {number} symbolId @param {number} size */
export function createSymbolSprite(symbolId, size = GRID.cell) {
  const tex = symbolTextures?.get(symbolId) ?? symbolTextures?.get(0);
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  const fw = tex.orig?.width ?? tex.width ?? 1;
  const fh = tex.orig?.height ?? tex.height ?? 1;
  const scale = size / Math.max(fw, fh);
  sprite.scale.set(scale);
  sprite.__baseScale = scale;
  return sprite;
}

/** @param {number} symbolId @param {number} size */
export function createSymbolWinAnim(symbolId, size = GRID.cell) {
  const frames = winTextures?.get(symbolId) ?? winTextures?.get(0);
  if (!frames?.length) return null;
  const anim = new AnimatedSprite(frames);
  anim.anchor.set(0.5);
  const scale = size / Math.max(anim.width, anim.height);
  anim.scale.set(scale);
  anim.__baseScale = scale;
  anim.animationSpeed = 0.35;
  anim.loop = false;
  return anim;
}

/** Grid plate (T0CF) — behind symbols; scaled to VB logical size. */
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

/** Reel dividers (T0DF) — in front of symbols (SOR VB order). */
export function createGridDividers() {
  const root = new Container();
  const divTex = uiTextures?.get('grid_divider');
  if (!divTex) return null;
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

/** @deprecated Use createGridPlate + createGridDividers */
export function createStageChrome() {
  const root = new Container();
  const plate = createGridPlate();
  const dividers = createGridDividers();
  if (plate) root.addChild(plate);
  if (dividers) root.addChild(dividers);
  return root;
}

/** @param {number} size */
export function createWinGlow(size) {
  const tex = uiTextures?.get('win_glow');
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.scale.set(size / Math.max(tex.width, tex.height));
  sprite.alpha = 0.9;
  sprite.blendMode = 'add';
  return sprite;
}

export function getBackgroundTexture() {
  return backgroundTexture;
}

export function getLogoTexture() {
  return logoTexture;
}
