/**
 * Temple of Three — Spine assets (exact clone skeletons + atlases).
 */
import '@esotericsoftware/spine-pixi-v8';
import { Assets } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { GRID } from './config.js';

const BASE = '/assets/temple-of-three/spine';

/** @type {boolean} */
let ready = false;

/** @type {Map<number, string>} */
const symbolAliases = new Map();

const CHROME_SPINE = {
  background: { skel: 'tot-bg-skel', atlas: 'tot-bg-atlas', x: 600, y: 450 },
  logo: { skel: 'tot-logo-skel', atlas: 'tot-logo-atlas', x: 600, y: 74 },
  reel: { skel: 'tot-reel-skel', atlas: 'tot-reel-atlas', x: 715, y: 450 },
  pots: [
    { skel: 'tot-pps1-skel', atlas: 'tot-pps-atlas', x: 118.1, y: 315.6, ppsType: 4 },
    { skel: 'tot-pps2-skel', atlas: 'tot-pps-atlas', x: 211.7, y: 222.95, ppsType: 2 },
    { skel: 'tot-pps3-skel', atlas: 'tot-pps-atlas', x: 295.35, y: 315.6, ppsType: 1 },
  ],
};

/** Server ppsType → pot spine index (Anubis, Bastet, Ra). */
const PPS_POT_INDEX = { 4: 0, 2: 1, 1: 2 };

/** Cash symbol collect anims per pot type. */
const CASH_COLLECT_ANIM = { 1: 'collect_red', 2: 'collect_purple', 4: 'collect_green' };

/** @param {Spine} spine @param {string} name */
function hasAnim(spine, name) {
  return spine.skeleton.data.animations.some((a) => a.name === name);
}

/** @param {Spine} spine @param {number} targetSize */
function fitAndCenterSpine(spine, targetSize) {
  spine.scale.set(1);
  const bounds = spine.getLocalBounds();
  const max = Math.max(bounds.width, bounds.height, 1);
  const scale = targetSize / max;
  spine.scale.set(scale);
  spine.x = targetSize / 2 - (bounds.x + bounds.width / 2) * scale;
  spine.y = targetSize / 2 - (bounds.y + bounds.height / 2) * scale;
}

/** @param {Spine} spine @param {string[]} names @param {boolean} [loop] @param {number} [track] */
export function playSpineAnim(spine, names, loop = false, track = 0) {
  for (const name of names) {
    if (!hasAnim(spine, name)) continue;
    return new Promise((resolve) => {
      const entry = spine.state.setAnimation(track, name, loop);
      if (!entry || loop) {
        resolve();
        return;
      }
      entry.listener = { complete: () => resolve() };
    });
  }
  return Promise.resolve();
}

function playPotIdle(spine) {
  void playSpineAnim(spine, ['level_0'], true, 0);
  if (hasAnim(spine, 'halo_loop')) void playSpineAnim(spine, ['halo_loop'], true, 1);
  if (hasAnim(spine, 'effects_loop')) void playSpineAnim(spine, ['effects_loop'], true, 2);
}

function playSymbolIdle(spine, symbolId) {
  if (symbolId === 8) {
    void playSpineAnim(spine, ['stop'], true);
    return;
  }
  if (symbolId >= 5) {
    void playSpineAnim(spine, ['idle'], true);
    return;
  }
  void playSpineAnim(spine, ['stop'], true);
}

export async function loadEgyptSpineAssets() {
  if (ready) return;

  const coreLoads = [
    { alias: 'tot-sym-atlas', src: `${BASE}/symbols/spine_symbols_level2.atlas` },
    { alias: 'tot-pps-atlas', src: `${BASE}/pps/spine_pps_level2.atlas` },
    {
      alias: 'tot-sym-blur-skel',
      src: `${BASE}/symbols/SymbolBlurredDummy.skel`,
      data: { spineAtlas: 'tot-sym-atlas' },
    },
  ];

  for (let id = 0; id <= 8; id++) {
    const skelAlias = `tot-sym-${id}-skel`;
    symbolAliases.set(id, skelAlias);
    coreLoads.push({
      alias: skelAlias,
      src: `${BASE}/symbols/Symbol${id}.skel`,
      data: { spineAtlas: 'tot-sym-atlas' },
    });
  }

  await Assets.load(coreLoads);

  const optionalLoads = [
    { alias: 'tot-bg-atlas', src: `${BASE}/background/spine_background_level2.atlas` },
    { alias: 'tot-logo-atlas', src: `${BASE}/logo/spine_logo_level2.atlas` },
    { alias: 'tot-reel-atlas', src: `${BASE}/reel/spine_reel_level2.atlas` },
    { alias: 'tot-bg-skel', src: `${BASE}/background/Background.skel`, data: { spineAtlas: 'tot-bg-atlas' } },
    { alias: 'tot-logo-skel', src: `${BASE}/logo/Logo.skel`, data: { spineAtlas: 'tot-logo-atlas' } },
    { alias: 'tot-reel-skel', src: `${BASE}/reel/Reel.skel`, data: { spineAtlas: 'tot-reel-atlas' } },
    { alias: 'tot-pps1-skel', src: `${BASE}/pps/PPS1.skel`, data: { spineAtlas: 'tot-pps-atlas' } },
    { alias: 'tot-pps2-skel', src: `${BASE}/pps/PPS2.skel`, data: { spineAtlas: 'tot-pps-atlas' } },
    { alias: 'tot-pps3-skel', src: `${BASE}/pps/PPS3.skel`, data: { spineAtlas: 'tot-pps-atlas' } },
  ];

  await Promise.all(
    optionalLoads.map((item) => Assets.load(item).catch(() => null))
  );

  ready = true;
}

/** @param {string} skel @param {string} atlas */
function spawnSpine(skel, atlas) {
  return Spine.from({ skeleton: skel, atlas, scale: 1, autoUpdate: true });
}

/** @param {number} symbolId @param {number} [displaySize] */
export function createSymbolSpine(symbolId, displaySize = GRID.cell) {
  const skel = symbolAliases.get(symbolId) ?? symbolAliases.get(0);
  const spine = spawnSpine(skel, 'tot-sym-atlas');
  fitAndCenterSpine(spine, displaySize);
  playSymbolIdle(spine, symbolId);
  return spine;
}

/** Blurred symbol used while reels scroll (TOT SymbolBlurredDummy). */
export function createScrollSymbolSpine(displaySize = GRID.cell) {
  const spine = spawnSpine('tot-sym-blur-skel', 'tot-sym-atlas');
  fitAndCenterSpine(spine, displaySize);
  void playSpineAnim(spine, ['stop'], true);
  return spine;
}

export function createBackgroundSpine() {
  const spine = spawnSpine(CHROME_SPINE.background.skel, CHROME_SPINE.background.atlas);
  spine.position.set(CHROME_SPINE.background.x, CHROME_SPINE.background.y);
  void playSpineAnim(spine, ['base'], true, 0);
  if (hasAnim(spine, 'base_idle')) void playSpineAnim(spine, ['base_idle'], true, 1);
  return spine;
}

export function createLogoSpine() {
  const spine = spawnSpine(CHROME_SPINE.logo.skel, CHROME_SPINE.logo.atlas);
  spine.position.set(CHROME_SPINE.logo.x, CHROME_SPINE.logo.y);
  void playSpineAnim(spine, ['logo'], true);
  return spine;
}

export function createReelSpine() {
  const spine = spawnSpine(CHROME_SPINE.reel.skel, CHROME_SPINE.reel.atlas);
  spine.position.set(CHROME_SPINE.reel.x, CHROME_SPINE.reel.y);
  void playSpineAnim(spine, ['base_game'], true);
  return spine;
}

export function createCollectorSpines() {
  return CHROME_SPINE.pots.map((pot, i) => {
    const spine = spawnSpine(pot.skel, pot.atlas);
    spine.position.set(pot.x, pot.y);
    playPotIdle(spine);
    spine.__potIndex = i;
    spine.__ppsType = pot.ppsType;
    return spine;
  });
}

/** @param {Spine[]} potSpines @param {number} ppsType */
export function playPotCollect(potSpines, ppsType) {
  const idx = PPS_POT_INDEX[ppsType] ?? 0;
  const pot = potSpines[idx];
  if (!pot) return Promise.resolve();
  return playSpineAnim(pot, ['collect'], false).then(() => playPotIdle(pot));
}

/** @param {Spine} spine @param {'stop'|'land'|'win'|'collect'} phase @param {number} [symbolId] @param {number} [ppsType] */
export function playSymbolPhase(spine, phase, symbolId = 0, ppsType) {
  if (symbolId === 8) {
    if (phase === 'collect' && ppsType != null) {
      const anim = CASH_COLLECT_ANIM[ppsType] ?? 'land';
      return playSpineAnim(spine, [anim], false).then(() => playSymbolIdle(spine, 8));
    }
    if (phase === 'win' || phase === 'land') {
      return playSpineAnim(spine, ['land'], false).then(() => playSymbolIdle(spine, 8));
    }
    return playSymbolIdle(spine, 8);
  }

  if (phase === 'win') {
    return playSpineAnim(spine, ['win'], false).then(() => playSymbolIdle(spine, symbolId));
  }
  if (phase === 'land') {
    if (symbolId >= 5) {
      return playSpineAnim(spine, ['land'], false).then(() => playSymbolIdle(spine, symbolId));
    }
    return playSymbolIdle(spine, symbolId);
  }
  return playSymbolIdle(spine, symbolId);
}

export function createWinGlow() {
  return null;
}
