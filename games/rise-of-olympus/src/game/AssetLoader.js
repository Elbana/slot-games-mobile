/**
 * AssetLoader — RoO spritesheet frames (fallback when Spine unavailable).
 */

import { Assets, AnimatedSprite, Sprite, Texture } from 'pixi.js';
import { GRID, STAGE } from './config.js';

const BASE = '/assets/rise-of-olympus';

/** @type {Map<number, import('pixi.js').Texture>} */
const symbolTextures = new Map();
/** @type {Map<string, import('pixi.js').Texture>} */
const uiTextures = new Map();
/** @type {import('pixi.js').Texture | null} */
let backgroundTexture = null;
/** @type {import('pixi.js').Texture[] | null} */
let bgFxTextures = null;
/** @type {boolean} */
let ready = false;

export async function loadThronesAssets() {
  if (ready) return { symbolTextures, uiTextures, backgroundTexture, bgFxTextures };

  const [symSheet, bgSheet, bgJpg] = await Promise.all([
    Assets.load(`${BASE}/spine_roo_1000_alpha_sym_10_22_level2.json`),
    Assets.load(`${BASE}/spine_RoO1000_background_0922_level2.json`),
    Assets.load(`${BASE}/spine_RoO1000_background_0922_level2.jpg`).catch(() => null),
  ]);

  symbolTextures.clear();
  uiTextures.clear();
  bgFxTextures = [];
  backgroundTexture =
    (bgJpg instanceof Texture ? bgJpg : bgJpg?.texture) ??
    bgSheet?.textures?.bg_0 ??
    null;

  if (symSheet?.textures) {
    for (const [key, tex] of Object.entries(symSheet.textures)) {
      if (key.startsWith('sym_')) {
        const id = parseInt(key.replace('sym_', ''), 10);
        if (!Number.isNaN(id)) symbolTextures.set(id, tex);
      } else if (key.startsWith('ui_')) {
        uiTextures.set(key.replace('ui_', ''), tex);
      }
    }
  }

  if (bgSheet?.textures) {
    const list = Object.entries(bgSheet.textures)
      .filter(([k]) => k.startsWith('bg_fx_'))
      .sort((a, b) => {
        const ai = parseInt(a[0].match(/bg_fx_(\d+)/)?.[1] ?? '0', 10);
        const bi = parseInt(b[0].match(/bg_fx_(\d+)/)?.[1] ?? '0', 10);
        return ai - bi;
      })
      .map(([, tex]) => tex);
    bgFxTextures = list;
  }

  if (symbolTextures.size === 0) {
    throw new Error('No symbol textures — run node scripts/extract-roo-spine-data.mjs');
  }

  ready = true;
  return { symbolTextures, uiTextures, backgroundTexture, bgFxTextures };
}

export function createBackgroundFx() {
  if (!bgFxTextures?.length) return null;
  const anim = new AnimatedSprite(bgFxTextures);
  anim.anchor.set(0.5);
  anim.position.set(STAGE.width / 2, STAGE.height / 2);
  anim.animationSpeed = 0.4;
  anim.play();
  return anim;
}

/** @param {number} symbolId @param {number} size */
export function createSymbolSprite(symbolId, size = GRID.clip) {
  const tex = symbolTextures.get(symbolId) ?? symbolTextures.get(0);
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  const fw = tex?.orig?.width ?? tex?.width ?? 1;
  const fh = tex?.orig?.height ?? tex?.height ?? 1;
  sprite.scale.set(size / Math.max(fw, fh));
  return sprite;
}

/** @param {string} key @param {number} maxW */
export function createUiSprite(key, maxW = 400) {
  const tex = uiTextures.get(key);
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  if (sprite.width > maxW) sprite.scale.set(maxW / sprite.width);
  return sprite;
}

/** @param {number} size */
export function createWinGlow(size) {
  const tex = uiTextures.get('win_glow');
  if (!tex) return null;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.scale.set((size * 1.1) / Math.max(sprite.width, sprite.height));
  sprite.alpha = 0.85;
  sprite.blendMode = 'add';
  return sprite;
}

export function getClientMultiplier(multGrid, col, row) {
  if (!multGrid) return 0;
  return multGrid[row]?.[col] ?? 0;
}

/**
 * Server sends multiplier values as a column-major flat tail aligned with multiplier symbols.
 * @param {number[][] | null | undefined} clientGrid symbols[col][row]
 * @param {number[] | number[][] | null | undefined} multList
 * @returns {number[][] | null} values[row][col]
 */
export function toClientMultiplierGrid(clientGrid, multList) {
  if (!multList || !clientGrid?.length) return null;
  if (Array.isArray(multList[0])) return /** @type {number[][]} */ (multList);

  const cols = clientGrid.length;
  const rows = clientGrid[0]?.length ?? 0;
  /** @type {number[][]} */
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  let idx = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const sym = clientGrid[c][r];
      if (sym >= 12 && sym <= 14) {
        out[r][c] = multList[idx] ?? 0;
        idx++;
      }
    }
  }
  return out;
}

export function getBackgroundTexture() {
  return backgroundTexture;
}

/** Full-bleed static backdrop behind animated bg spine */
export function createStaticBackgroundSprite() {
  const tex = backgroundTexture ?? Texture.WHITE;
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5);
  sprite.position.set(STAGE.width / 2, STAGE.height / 2);
  const cover = Math.max(STAGE.width / (tex.width || 1), STAGE.height / (tex.height || 1)) * 1.35;
  sprite.scale.set(cover);
  return sprite;
}
