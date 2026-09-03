/**
 * Rise of Olympus 1000 — Spine assets (exact clone skeletons + atlases).
 */
import '@esotericsoftware/spine-pixi-v8';
import { Assets, Text } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { GRID, STAGE, CHROME, gridPixelSize, SCATTER_SYMBOL } from './config.js';
import { animate, easeOutBack } from './GridAnimator.js';

const BASE = '/assets/rise-of-olympus/spine';

/** @type {Map<number, string>} */
const symbolAliases = new Map();
/** @type {boolean} */
let ready = false;

const CHROME_SPINE = {
  background: { skel: 'roo-bg-skel', atlas: 'roo-bg-atlas', x: STAGE.width / 2, y: STAGE.height / 2 },
  logo: { skel: 'roo-logo-skel', atlas: 'roo-sym-atlas', x: CHROME.logo.x, y: CHROME.logo.y },
  signpost: { skel: 'roo-signpost-skel', atlas: 'roo-sym-atlas', x: CHROME.signpost.x, y: CHROME.signpost.y },
  reelFrame: { skel: 'roo-reel-frame-skel', atlas: 'roo-ui-atlas', x: CHROME.reelFrame.x, y: CHROME.reelFrame.y },
  tumbleWin: { skel: 'roo-tumble-skel', atlas: 'roo-sym-atlas', x: CHROME.tumbleWin.x, y: CHROME.tumbleWin.y },
  bigWin: { x: STAGE.width / 2, y: STAGE.height / 2 },
  fsCounter: { x: CHROME.fsCounter.x, y: CHROME.fsCounter.y },
};

function hasAnim(spine, name) {
  return spine.skeleton.data.animations.some((a) => a.name === name);
}

/**
 * Attach a Pixi label to a Spine slot (ref uses maxmultiplier / tumbleWinValue bounds).
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {string} slotName
 * @param {import('pixi.js').Text} label
 */
export function attachSpineSlotLabel(spine, slotName, label) {
  label.anchor.set(0.5);
  try {
    spine.addSlotObject(slotName, label, { followSlotColor: false });
  } catch {
    spine.addChild(label);
  }
  spine.__slotLabels = spine.__slotLabels ?? {};
  spine.__slotLabels[slotName] = label;
  return label;
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {string} slotName */
export function setSpineSlotLabel(spine, slotName, text) {
  const label = spine.__slotLabels?.[slotName];
  if (!label) return;
  label.text = text;
  label.visible = Boolean(text);
}

export function createSignpostMultiplierLabel() {
  return new Text({
    text: '',
    style: {
      fill: 0xffee7f,
      fontSize: 20,
      fontWeight: '700',
      stroke: { color: 0xff6800, width: 2 },
      dropShadow: { color: 0xff6800, blur: 5, distance: 2, alpha: 0.8 },
      letterSpacing: 1,
    },
  });
}

export function createTumbleWinValueLabel() {
  return new Text({
    text: '',
    style: {
      fill: 0xfff8dc,
      fontSize: 34,
      fontWeight: '900',
      fontFamily: 'Arial Black, Arial, sans-serif',
      align: 'center',
      stroke: { color: 0x2a1200, width: 4 },
      dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.85 },
      letterSpacing: 1,
    },
  });
}

const TUMBLE_WIN_FRAME_SLOTS = [
  'images/normal/tumble/tembole_small_frame',
  'images/normal/tumble/tembole_small_frame2',
  'images/normal/tumble/tumble_big_frame',
];

/** hide fades frame slots to alpha 0; hidden does not restore them — reset manually. */
export function ensureTumbleWinFramesVisible(spine) {
  if (!spine?.skeleton) return;
  for (const name of TUMBLE_WIN_FRAME_SLOTS) {
    const slot = spine.skeleton.findSlot(name);
    if (slot) slot.color.set(1, 1, 1, 1);
  }
}

/** charge/charge_stop fade this slot out — restore when showing a win value. */
export function ensureTumbleWinValueSlotVisible(spine, visible) {
  const slot = spine.skeleton?.findSlot('tumbleWinValue');
  if (slot) slot.color.set(1, 1, 1, visible ? 1 : 0);
}

/** Frame center in spine local space (tumble_pivot + container offset). */
const TUMBLE_WIN_LABEL_OFFSET = { x: -0.45, y: 4.65 };

/** Place win text in the center of the tumble frame bounds. */
export function layoutTumbleWinLabel(spine) {
  const label = spine?.__tumbleWinLabel;
  if (!label) return;
  label.position.set(TUMBLE_WIN_LABEL_OFFSET.x, TUMBLE_WIN_LABEL_OFFSET.y);
}

/** Ref DynamicSizedSymbol multiplier_value text field — format "x2", "x15", etc. */
export function createSymbolMultiplierLabel() {
  return new Text({
    text: '',
    style: {
      fill: 0xffffff,
      fontSize: 30,
      fontWeight: '900',
      stroke: { color: 0x2a1400, width: 3 },
      align: 'center',
    },
  });
}

export function formatSymbolMultiplier(value) {
  return value > 0 ? `x${value}` : '';
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine | null | undefined} spine @param {number} value */
export function setSymbolMultiplierValue(spine, value) {
  if (!spine) return;
  setSpineSlotLabel(spine, 'multiplier_value', formatSymbolMultiplier(value));
}

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

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {string[]} names */
export function getSpineAnimDurationMs(spine, names) {
  for (const name of names) {
    const anim = spine.skeleton.data.animations.find((a) => a.name === name);
    if (anim) return Math.ceil(anim.duration * 1000);
  }
  return 680;
}

/** @type {number | null} Shared stop-pose fit size — measured from Hades (Symbol7). */
let symbolFitReferenceMax = null;

/** Premium board symbols sized to one reference (gods, scatter, multipliers). */
const UNIFORM_FIT_SYMBOLS = new Set([7, 8, 9, 10, 11, 12, 13, 14]);

/** 7=Hades (red), 8=Poseidon (green), 9=Zeus (blue). */

function applySymbolFitPose(spine, symbolId = -1) {
  if (symbolId >= 12 && symbolId <= 14) {
    const tier = symbolId === 14 ? 'gold' : symbolId === 13 ? 'silver' : 'bronze';
    if (hasAnim(spine, tier)) {
      spine.state.setAnimation(0, tier, true);
      return;
    }
  }
  if (hasAnim(spine, 'stop')) {
    spine.state.setAnimation(0, 'stop', true);
    return;
  }
  if (hasAnim(spine, 'stop1')) {
    spine.state.setAnimation(0, 'stop1', true);
    return;
  }
  if (hasAnim(spine, 'idle')) spine.state.setAnimation(0, 'idle', true);
}

function measureSymbolFitReference() {
  try {
    const skel = symbolAliases.get(7);
    if (!skel) return;
    const spine = spawnSpine(skel, 'roo-sym-atlas');
    applySymbolFitPose(spine, 7);
    spine.update(0);
    const bounds = spine.getLocalBounds();
    symbolFitReferenceMax = Math.max(bounds.width, bounds.height, 1);
    spine.destroy({ children: true });
  } catch {
    symbolFitReferenceMax = null;
  }
}

function fitAndCenterSpine(spine, targetSize, symbolId = -1) {
  spine.scale.set(1);
  applySymbolFitPose(spine, symbolId);
  spine.update(0);
  const bounds = spine.getLocalBounds();
  const rawMax = Math.max(bounds.width, bounds.height, 1);
  let fitMax = rawMax;
  if (symbolFitReferenceMax != null && UNIFORM_FIT_SYMBOLS.has(symbolId)) {
    fitMax = symbolFitReferenceMax;
  }
  const scale = targetSize / fitMax;
  spine.scale.set(scale);
  spine.__baseScale = scale;
  spine.x = targetSize / 2 - (bounds.x + bounds.width / 2) * scale;
  spine.y = targetSize / 2 - (bounds.y + bounds.height / 2) * scale;
}

function playSymbolIdle(spine, symbolId) {
  if (symbolId >= 7) void playSpineAnim(spine, ['idle', 'stop'], true);
  else void playSpineAnim(spine, ['stop', 'idle'], true);
}

function playGodIdle(spine) {
  void playSpineAnim(spine, ['idle_loop', 'idle_break', 'idle', 'stop'], true);
}

export async function loadThronesSpineAssets() {
  if (ready) return;

  await Assets.load({ alias: 'roo-sym-atlas', src: `${BASE}/symbols/spine_roo_1000_alpha_sym_10_22_level2.atlas` });

  for (let id = 0; id <= 14; id++) {
    const skelAlias = `roo-sym-${id}-skel`;
    symbolAliases.set(id, skelAlias);
    await Assets.load({
      alias: skelAlias,
      src: `${BASE}/symbols/Symbol${id}.json`,
      data: { spineAtlas: 'roo-sym-atlas' },
    });
  }

  const symChrome = [
    { alias: 'roo-sym-blur-skel', src: `${BASE}/symbols/Symbol_blurred_dummy.json`, data: { spineAtlas: 'roo-sym-atlas' } },
    { alias: 'roo-logo-skel', src: `${BASE}/symbols/logo_game.json`, data: { spineAtlas: 'roo-sym-atlas' } },
    { alias: 'roo-signpost-skel', src: `${BASE}/symbols/multiplier_signpost.json`, data: { spineAtlas: 'roo-sym-atlas' } },
    { alias: 'roo-tumble-skel', src: `${BASE}/symbols/tumble_win_container.json`, data: { spineAtlas: 'roo-sym-atlas' } },
  ];
  await Promise.all(symChrome.map((item) => Assets.load(item).catch(() => null)));

  await Assets.load([
    { alias: 'roo-bg-atlas', src: `${BASE}/background/spine_RoO1000_background_0922_level2.atlas` },
    { alias: 'roo-bg-skel', src: `${BASE}/background/basegame_bg.json`, data: { spineAtlas: 'roo-bg-atlas' } },
    { alias: 'roo-platform-skel', src: `${BASE}/background/Platform.json`, data: { spineAtlas: 'roo-bg-atlas' } },
    { alias: 'roo-fs-bg-skel', src: `${BASE}/background/freespin_bg.json`, data: { spineAtlas: 'roo-bg-atlas' } },
  ]).catch((err) => console.warn('[Thrones] bg spine load failed', err));

  measureSymbolFitReference();
  ready = true;
}

export async function loadThronesChromeSpines() {
  await Promise.all([
    Assets.load([
      { alias: 'roo-ui-atlas', src: `${BASE}/ui/spine_roo_1000_alpha_UI_10_30_level2.atlas` },
      { alias: 'roo-reel-frame-skel', src: `${BASE}/ui/reel_frame.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-col-anticipation-skel', src: `${BASE}/ui/reel_anticipation.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-fs-counter-skel', src: `${BASE}/ui/RoOO_FS_counter.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-winlabel-skel', src: `${BASE}/ui/winlabel.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-winbox-skel', src: `${BASE}/ui/winbox.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-intro-panel-skel', src: `${BASE}/ui/Intro_panel.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-summary-panel-skel', src: `${BASE}/ui/Summary_panel.json`, data: { spineAtlas: 'roo-ui-atlas' } },
      { alias: 'roo-hyperspin-skel', src: `${BASE}/ui/hyperspin.json`, data: { spineAtlas: 'roo-ui-atlas' } },
    ]).catch(() => null),
    Assets.load([
      { alias: 'roo-god-hades-skel', src: `${BASE}/symbols/fs_hades.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-god-poseidon-skel', src: `${BASE}/symbols/fs_poseidon.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-god-zeus-skel', src: `${BASE}/symbols/fs_zeus.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-bigwin-skel', src: `${BASE}/symbols/bigwin.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-bigwin-bg-skel', src: `${BASE}/symbols/bigwinBg.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-bigwin-shine-skel', src: `${BASE}/symbols/bigwinShine.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-bigwin-stars-skel', src: `${BASE}/symbols/bigwinStars.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-upgrade-fx-skel', src: `${BASE}/symbols/upgrade_fx.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-trail-multi-skel', src: `${BASE}/symbols/trail_multi.json`, data: { spineAtlas: 'roo-sym-atlas' } },
      { alias: 'roo-running-mult-skel', src: `${BASE}/symbols/running_multiplier.json`, data: { spineAtlas: 'roo-sym-atlas' } },
    ]).catch(() => null),
  ]);
}

const GOD_SKELS = ['roo-god-hades-skel', 'roo-god-poseidon-skel', 'roo-god-zeus-skel'];
const UPGRADE_FX = ['feature_fire', 'feature_water', 'feature_lightning'];

function spawnSpine(skel, atlas) {
  return Spine.from({ skeleton: skel, atlas, scale: 1, autoUpdate: true });
}

export function createSymbolSpine(symbolId, displaySize = GRID.clip) {
  const skel = symbolAliases.get(symbolId) ?? symbolAliases.get(0);
  const spine = spawnSpine(skel, 'roo-sym-atlas');
  fitAndCenterSpine(spine, displaySize, symbolId);
  if (symbolId >= 12 && symbolId <= 14) {
    attachSpineSlotLabel(spine, 'multiplier_value', createSymbolMultiplierLabel());
  }
  playSymbolIdle(spine, symbolId);
  return spine;
}

/** Blurred dummy symbol while columns scroll (ref Symbol_blurred_dummy → animation). */
export function createScrollSymbolSpine(displaySize = GRID.clip) {
  const spine = spawnSpine('roo-sym-blur-skel', 'roo-sym-atlas');
  fitAndCenterSpine(spine, displaySize);
  void playSpineAnim(spine, ['animation'], true);
  return spine;
}

function coverStageSpine(spine, overscan = 1.15) {
  spine.scale.set(1);
  spine.update(0);
  const bounds = spine.getLocalBounds();
  const bw = Math.max(bounds.width, 1);
  const bh = Math.max(bounds.height, 1);
  const cover = Math.max(STAGE.width / bw, STAGE.height / bh) * overscan;
  spine.scale.set(cover);
  spine.x = STAGE.width / 2 - (bounds.x + bw / 2) * cover;
  spine.y = STAGE.height / 2 - (bounds.y + bh / 2) * cover;
}

export function createBackgroundSpine() {
  const spine = spawnSpine(CHROME_SPINE.background.skel, CHROME_SPINE.background.atlas);
  void playSpineAnim(spine, ['loop_basegame', 'base', 'idle'], true, 0);
  coverStageSpine(spine, 1.32);
  return spine;
}

export function createFreespinBackgroundSpine() {
  const spine = spawnSpine('roo-fs-bg-skel', 'roo-bg-atlas');
  coverStageSpine(spine, 1.32);
  spine.visible = false;
  void playSpineAnim(spine, ['loop_freespin', 'transition'], true);
  return spine;
}

export function createPlatformSpine() {
  const spine = spawnSpine('roo-platform-skel', 'roo-bg-atlas');
  spine.position.set(CHROME.platform.x, CHROME.platform.y);
  // Static pose — base_idle/base_In scale pulse shimmers at platform hole vs grid edge.
  void playSpineAnim(spine, ['stop', 'idle'], true);
  return spine;
}

export function createLogoSpine() {
  const spine = spawnSpine(CHROME_SPINE.logo.skel, CHROME_SPINE.logo.atlas);
  spine.position.set(CHROME_SPINE.logo.x, CHROME_SPINE.logo.y);
  void playSpineAnim(spine, ['stop', 'idle'], false).then(() => playSpineAnim(spine, ['idle', 'stop'], true));
  return spine;
}

export function createSignpostSpine() {
  const spine = spawnSpine(CHROME_SPINE.signpost.skel, CHROME_SPINE.signpost.atlas);
  spine.position.set(CHROME_SPINE.signpost.x, CHROME_SPINE.signpost.y);
  spine.scale.set(CHROME.signpost.scale);
  spine.__baseScale = CHROME.signpost.scale;
  attachSpineSlotLabel(spine, 'maxmultiplier', createSignpostMultiplierLabel());
  void playSpineAnim(spine, ['loop'], true);
  return spine;
}

export function createReelFrameSpine() {
  const spine = spawnSpine(CHROME_SPINE.reelFrame.skel, CHROME_SPINE.reelFrame.atlas);
  spine.position.set(CHROME_SPINE.reelFrame.x, CHROME_SPINE.reelFrame.y);
  void playSpineAnim(spine, ['show', 'stop'], true);
  return spine;
}

export function createColumnAnticipationSpine() {
  const spine = spawnSpine('roo-col-anticipation-skel', 'roo-ui-atlas');
  spine.visible = false;
  void playSpineAnim(spine, ['hidden'], true);
  return spine;
}

export function playColumnAnticipation(spine, phase) {
  if (!spine) return Promise.resolve();
  if (phase === 'in') {
    spine.visible = true;
    return playSpineAnim(spine, ['in', 'loop'], true);
  }
  return playSpineAnim(spine, ['out', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

export function createTumbleWinSpine() {
  const spine = spawnSpine(CHROME_SPINE.tumbleWin.skel, CHROME_SPINE.tumbleWin.atlas);
  spine.position.set(CHROME_SPINE.tumbleWin.x, CHROME_SPINE.tumbleWin.y);
  spine.sortableChildren = true;
  const label = createTumbleWinValueLabel();
  label.anchor.set(0.5);
  label.visible = false;
  label.alpha = 0;
  label.zIndex = 20;
  spine.addChild(label);
  spine.__tumbleWinLabel = label;
  spine.__tumbleWinAmount = 0;
  layoutTumbleWinLabel(spine);
  ensureTumbleWinFramesVisible(spine);
  void playSpineAnim(spine, ['stop'], true);
  layoutTumbleWinLabel(spine);
  return spine;
}

export function createGodPortraitSpine(godId = 0) {
  const cfg = CHROME.godPortrait;
  const skel = GOD_SKELS[godId] ?? GOD_SKELS[0];
  const spine = spawnSpine(skel, 'roo-sym-atlas');
  spine.position.set(cfg.x, cfg.y);
  spine.scale.set(cfg.scale);
  spine.__godId = godId;
  playGodIdle(spine);
  return spine;
}

export function createBigWinSpine() {
  const spine = spawnSpine('roo-bigwin-skel', 'roo-sym-atlas');
  spine.position.set(CHROME_SPINE.bigWin.x, CHROME_SPINE.bigWin.y);
  spine.visible = false;
  void playSpineAnim(spine, ['hidden'], true);
  return spine;
}

/** @returns {{ bg: import('@esotericsoftware/spine-pixi-v8').Spine | null, shine: import('@esotericsoftware/spine-pixi-v8').Spine | null, stars: import('@esotericsoftware/spine-pixi-v8').Spine | null, banner: import('@esotericsoftware/spine-pixi-v8').Spine | null }} */
export function createBigWinStack() {
  const pos = CHROME_SPINE.bigWin;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let bg = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let shine = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let stars = null;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let banner = null;
  try {
    bg = spawnSpine('roo-bigwin-bg-skel', 'roo-sym-atlas');
    shine = spawnSpine('roo-bigwin-shine-skel', 'roo-sym-atlas');
    stars = spawnSpine('roo-bigwin-stars-skel', 'roo-sym-atlas');
    banner = spawnSpine('roo-bigwin-skel', 'roo-sym-atlas');
    for (const s of [bg, shine, stars, banner]) {
      if (!s) continue;
      s.position.set(pos.x, pos.y);
      s.visible = false;
    }
  } catch {
    /* optional stack */
  }
  return { bg, shine, stars, banner };
}

export function createWinboxSpine() {
  const spine = spawnSpine('roo-winbox-skel', 'roo-ui-atlas');
  spine.visible = false;
  return spine;
}

export function createWinlabelValueLabel() {
  return new Text({
    text: '',
    style: {
      fill: 0xfff8dc,
      fontSize: 28,
      fontWeight: '900',
      fontFamily: 'Arial Black, Arial, sans-serif',
      align: 'center',
      stroke: { color: 0x2a1200, width: 3 },
      dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.85 },
      letterSpacing: 0.5,
    },
  });
}

export function createWinlabelSpine() {
  const spine = spawnSpine('roo-winlabel-skel', 'roo-ui-atlas');
  spine.visible = false;
  attachSpineSlotLabel(spine, 'winLabelValue', createWinlabelValueLabel());
  return spine;
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {number} amount */
export function setWinlabelValue(spine, amount) {
  setSpineSlotLabel(spine, 'winLabelValue', amount > 0 ? amount.toLocaleString() : '');
}

/**
 * Tiered win banner — ref WinCounter levels [1,3,7,15]× bet.
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {number} tier 0–4
 */
export function applyWinlabelTier(spine, tier) {
  if (!spine?.skeleton) return;
  const blueSlot = spine.skeleton.findSlot('roo1000_blue_background');
  const yellowSlot = spine.skeleton.findSlot('roo1000_yellow_background');
  const blueAtt = spine.skeleton.getAttachmentByName(
    'roo1000_blue_background',
    'normal/winlable/roo1000_blue_background',
  );
  const yellowAtt = spine.skeleton.getAttachmentByName(
    'roo1000_yellow_background',
    'normal/winlable/roo1000_yellow_background',
  );
  if (blueSlot) blueSlot.setAttachment(tier >= 1 ? blueAtt : null);
  if (yellowSlot) yellowSlot.setAttachment(tier >= 2 ? yellowAtt : null);
  if (blueSlot) blueSlot.color.set(1, 1, 1, 1);
  if (yellowSlot) yellowSlot.color.set(1, 1, 1, tier >= 3 ? 1 : 0.85);
  const scale = tier >= 4 ? 1.28 : tier >= 3 ? 1.16 : tier >= 2 ? 1.08 : tier >= 1 ? 1 : 0.92;
  spine.scale.set(scale);
}

export function createTrailMultiSpine() {
  return spawnSpine('roo-trail-multi-skel', 'roo-sym-atlas');
}

/** Flying multiplier value — ref trail_multi + multiplier_value label. */
export function createMultiplierTrailSpine(value) {
  const spine = createTrailMultiSpine();
  attachSpineSlotLabel(spine, 'multiplier_value', createSymbolMultiplierLabel());
  setSpineSlotLabel(spine, 'multiplier_value', formatSymbolMultiplier(value));
  return spine;
}

/**
 * Smooth arc flight to tumble win panel / collector.
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {{ x: number, y: number }} target
 * @param {number} [durationMs]
 */
export function playMultiplierValueTrail(spine, target, durationMs = 420) {
  if (!target) return playSpineAnim(spine, ['collect', 'idle'], false);

  const sx = spine.x;
  const sy = spine.y;
  const dx = target.x - sx;
  const dy = target.y - sy;
  const lift = Math.min(140, Math.hypot(dx, dy) * 0.28);
  const cx = sx + dx * 0.5;
  const cy = sy + dy * 0.5 - lift;

  return new Promise((resolve) => {
    const start = performance.now();
    const collectAnim = playSpineAnim(spine, ['collect'], false);
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = 1 - (1 - t) ** 3;
      const u = 1 - ease;
      spine.x = u * u * sx + 2 * u * ease * cx + ease * ease * target.x;
      spine.y = u * u * sy + 2 * u * ease * cy + ease * ease * target.y;
      const pulse = 1 + Math.sin(ease * Math.PI) * 0.18;
      spine.scale.set(pulse);
      spine.alpha = t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;
      if (t < 1) requestAnimationFrame(step);
      else collectAnim.then(resolve);
    };
    requestAnimationFrame(step);
  });
}

export function createRunningMultiplierSpine() {
  const spine = spawnSpine('roo-running-mult-skel', 'roo-sym-atlas');
  spine.position.set(CHROME.runningMultiplier.x, CHROME.runningMultiplier.y);
  spine.visible = false;
  const label = new Text({
    text: '',
    style: {
      fill: 0xffee7f,
      fontSize: 22,
      fontWeight: '800',
      stroke: { color: 0x3a1800, width: 2 },
    },
  });
  label.anchor.set(0.5);
  label.y = -6;
  spine.addChild(label);
  spine.__multLabel = label;
  void playSpineAnim(spine, ['hidden'], true);
  return spine;
}

function setRunningMultiplierLabel(spine, value) {
  if (spine?.__multLabel) spine.__multLabel.text = value > 0 ? `×${value}` : '';
}

export function createIntroPanelSpine() {
  const spine = spawnSpine('roo-intro-panel-skel', 'roo-ui-atlas');
  spine.position.set(CHROME.introPanel.x, CHROME.introPanel.y);
  spine.visible = false;
  void playSpineAnim(spine, ['hide', 'hidden'], true);
  return spine;
}

export function createSummaryPanelSpine() {
  const spine = spawnSpine('roo-summary-panel-skel', 'roo-ui-atlas');
  spine.position.set(CHROME.introPanel.x, CHROME.introPanel.y);
  spine.visible = false;
  attachSpineSlotLabel(spine, 'summarypanelMid', createTumbleWinValueLabel());
  attachSpineSlotLabel(spine, 'summarypanelDown', createSignpostMultiplierLabel());
  return spine;
}

export function createHyperspinSpine() {
  const spine = spawnSpine('roo-hyperspin-skel', 'roo-ui-atlas');
  spine.position.set(STAGE.width / 2, ORIGIN.y + gridPixelSize(6, 5).height / 2);
  spine.visible = false;
  return spine;
}

export async function showHyperspin(spine) {
  if (!spine) return;
  spine.visible = true;
  await playSpineAnim(spine, ['show'], false);
  void playSpineAnim(spine, ['loop'], true);
}

export function hideHyperspin(spine) {
  if (!spine) return Promise.resolve();
  return playSpineAnim(spine, ['hide', 'stop'], false).then(() => {
    spine.visible = false;
  });
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {number} totalWin */
export async function showFsSummaryPanel(spine, totalWin) {
  if (!spine) return;
  spine.visible = true;
  setSpineSlotLabel(spine, 'summarypanelMid', totalWin.toLocaleString());
  setSpineSlotLabel(spine, 'summarypanelDown', 'TOTAL WIN');
  await playSpineAnim(spine, ['in'], false);
  await playSpineAnim(spine, ['idle'], true);
}

export function hideFsSummaryPanel(spine) {
  if (!spine) return Promise.resolve();
  return playSpineAnim(spine, ['out'], false).then(() => {
    spine.visible = false;
  });
}

export function createFsCounterSpine() {
  const spine = spawnSpine('roo-fs-counter-skel', 'roo-ui-atlas');
  spine.position.set(CHROME_SPINE.fsCounter.x, CHROME_SPINE.fsCounter.y);
  spine.visible = false;
  void playSpineAnim(spine, ['hide_alt', 'hidden'], true);
  return spine;
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {number} godId */
export function swapGodPortraitSpine(spine, godId) {
  if (!spine || spine.__godId === godId) return spine;
  const cfg = CHROME.godPortrait;
  const parent = spine.parent;
  const idx = parent?.getChildIndex(spine) ?? -1;
  spine.destroy({ children: true });
  const next = createGodPortraitSpine(godId);
  if (parent && idx >= 0) parent.addChildAt(next, idx);
  return next;
}

export function playGodAction(spine, godId = 0) {
  const names =
    godId === 2
      ? ['action_loop', 'idle_loop']
      : godId === 1
        ? ['action_loop', 'idle_loop']
        : ['action_loop', 'skull_fire_loop', 'idle_loop'];
  return playSpineAnim(spine, names, false).then(() => playGodIdle(spine));
}

export function playReelAnticipation(spine, phase) {
  if (!spine) return Promise.resolve();
  if (phase === 'start') return playSpineAnim(spine, ['anticipation_in', 'anticipation_loop'], true);
  return playSpineAnim(spine, ['anticipation_out', 'stop'], false);
}

/**
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {number} amount
 * @param {number} bet
 */
export async function showBigWinCelebration(stack, amount, bet) {
  if (!stack?.banner || amount < bet * 10) return;

  /** @type {[string, string, string]} */
  let tier = ['bigwin_show', 'bigwin_idle', 'bigwin_hide'];
  if (amount >= bet * 100) tier = ['bigwin_to_ultra', 'ultra_idle', 'ultra_hide'];
  else if (amount >= bet * 50) tier = ['bigwin_to_mega', 'mega_idle', 'mega_hide'];
  else if (amount >= bet * 25) tier = ['bigwin_to_super', 'super_idle', 'super_hide'];

  for (const s of [stack.bg, stack.shine, stack.stars, stack.banner]) {
    if (s) s.visible = true;
  }
  if (stack.stars) void playSpineAnim(stack.stars, ['stars_show', 'stars_loop'], true);
  if (stack.shine) void playSpineAnim(stack.shine, ['bigwin_in', 'bigwin_loop'], true);
  const showPromises = [];
  if (stack.bg) showPromises.push(playSpineAnim(stack.bg, [tier[0], 'bigwin_show'], false));
  showPromises.push(playSpineAnim(stack.banner, [tier[0], 'bigwin_show'], false));
  await Promise.all(showPromises);
  await playSpineAnim(stack.banner, [tier[1], 'loop', 'bigwin_idle'], true);
  if (stack.bg) void playSpineAnim(stack.bg, [tier[1], 'bigwin_idle', 'mega_idle', 'super_idle', 'ultra_idle'], true);
}

export function hideBigWinCelebration(stack) {
  if (!stack?.banner) return Promise.resolve();
  const hides = [];
  if (stack.shine) hides.push(playSpineAnim(stack.shine, ['bigwin_out'], false));
  if (stack.stars) hides.push(playSpineAnim(stack.stars, ['stars_hide'], false));
  if (stack.bg) hides.push(playSpineAnim(stack.bg, ['bigwin_hide', 'mega_hide', 'super_hide', 'ultra_hide', 'hidden'], false));
  hides.push(playSpineAnim(stack.banner, ['bigwin_hide', 'mega_hide', 'super_hide', 'ultra_hide', 'hidden'], false));
  return Promise.all(hides).then(() => {
    for (const s of [stack.bg, stack.shine, stack.stars, stack.banner]) {
      if (s) s.visible = false;
    }
  });
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {number} count */
export async function showFsCounterAward(spine, count) {
  if (!spine) return;
  spine.visible = true;
  const intro = count >= 12 ? 'win_to_trigger' : 'show';
  await playSpineAnim(spine, [intro, 'show_alt', 'show'], false);
  await playSpineAnim(spine, ['idle'], true);
}

export function hideFsCounter(spine) {
  if (!spine) return Promise.resolve();
  return playSpineAnim(spine, ['hide_alt', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

/** Spawn one-shot upgrade FX; caller positions, plays, destroys. */
export function createUpgradeFxSpine() {
  return spawnSpine('roo-upgrade-fx-skel', 'roo-sym-atlas');
}

export function playUpgradeFx(spine, godId = 2) {
  const anim = UPGRADE_FX[godId] ?? UPGRADE_FX[2];
  return playSpineAnim(spine, [anim, 'feature_lightning'], false);
}

export function playScatterActivation(spine) {
  return playSpineAnim(spine, ['wait_in', 'feature_activation', 'wait'], false).then(() =>
    playSpineAnim(spine, ['wait_out', 'idle', 'stop1', 'stop2', 'stop'], true)
  );
}

function multiplierTierName(symbolId) {
  if (symbolId === 14) return 'gold';
  if (symbolId === 13) return 'silver';
  return 'bronze';
}

export function playMultiplierReveal(spine) {
  return playSpineAnim(spine, ['reveal'], false);
}

export function playMultiplierLandIdle(spine, symbolId) {
  const tier = multiplierTierName(symbolId);
  return playSpineAnim(spine, ['land', tier], false).then(() =>
    playSpineAnim(spine, [tier, 'idle'], true)
  );
}

export function playMultiplierLand(spine, symbolId) {
  return playMultiplierReveal(spine).then(() => playMultiplierLandIdle(spine, symbolId));
}

export function hideSignpost(spine) {
  setSpineSlotLabel(spine, 'maxmultiplier', '');
  return playSpineAnim(spine, ['hide', 'hidden'], false);
}

export function showSignpostIdle(spine) {
  if (!spine) return Promise.resolve();
  spine.visible = true;
  setSpineSlotLabel(spine, 'maxmultiplier', '');
  return playSpineAnim(spine, ['loop'], true);
}

export async function tumbleWinShow(spine) {
  await playSpineAnim(spine, ['show'], false);
}

export function tumbleWinCharge(spine) {
  return playSpineAnim(spine, ['charge'], false);
}

export function tumbleWinChargeStop(spine) {
  return playSpineAnim(spine, ['charge_stop', 'stop'], false);
}

export async function tumbleWinPay(spine) {
  await playSpineAnim(spine, ['win'], false);
  await playSpineAnim(spine, ['win_stop', 'stop'], false);
}

export async function tumbleWinDisperse(spine) {
  await playSpineAnim(spine, ['disperse', 'disperse_out'], false);
}

/** Empty tumble panel — frame stays visible, value cleared (never use hide: it fades frames out). */
export async function tumbleWinResetIdle(spine) {
  if (!spine) return;
  setTumbleWinValue(spine, 0);
  ensureTumbleWinFramesVisible(spine);
  await playSpineAnim(spine, ['stop'], true);
}

export function tumbleWinHide(spine) {
  return tumbleWinResetIdle(spine);
}

export function playWinboxIn(spine) {
  spine.visible = true;
  return playSpineAnim(spine, ['in', 'idle'], true);
}

export function playWinboxOut(spine) {
  return playSpineAnim(spine, ['out', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

export function playWinlabelShow(spine, tier = 1) {
  applyWinlabelTier(spine, tier);
  spine.visible = true;
  return playSpineAnim(spine, ['show', 'idle'], true);
}

export function playWinlabelHide(spine) {
  return playSpineAnim(spine, ['hide', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

export function playTrailCollect(spine, target) {
  if (!target) return playSpineAnim(spine, ['collect', 'idle'], false);
  const sx = spine.x;
  const sy = spine.y;
  const dx = target.x - sx;
  const dy = target.y - sy;
  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 420;
    const play = playSpineAnim(spine, ['collect'], false);
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      spine.x = sx + dx * ease;
      spine.y = sy + dy * ease;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    play.then(resolve);
  });
}

export async function showRunningMultiplier(spine, value) {
  spine.visible = true;
  setRunningMultiplierLabel(spine, value);
  await playSpineAnim(spine, ['show'], false);
  void playSpineAnim(spine, ['banner_loop', 'Pulsating_Loop'], true);
}

export function updateRunningMultiplier(spine, value) {
  setRunningMultiplierLabel(spine, value);
  void playSpineAnim(spine, ['Pulsating_Loop', 'charge'], false).then(() =>
    playSpineAnim(spine, ['banner_loop', 'Pulsating_Loop'], true)
  );
}

export function hideRunningMultiplier(spine) {
  return playSpineAnim(spine, ['hide', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

export async function showIntroPanel(spine) {
  spine.visible = true;
  await playSpineAnim(spine, ['show'], false);
  await playSpineAnim(spine, ['idle'], true);
}

export function hideIntroPanel(spine) {
  return playSpineAnim(spine, ['hide', 'hidden'], false).then(() => {
    spine.visible = false;
  });
}

export function setGodMeterLevel(spine, level) {
  const names =
    level >= 3
      ? ['action_loop', 'skull_fire_loop', 'idle_loop']
      : level >= 1
        ? ['action_loop', 'idle_loop']
        : ['idle_loop', 'idle_break', 'idle'];
  void playSpineAnim(spine, names, true);
}

export function showSignpostLoop(spine, multiplierText = '') {
  if (multiplierText) setSpineSlotLabel(spine, 'maxmultiplier', multiplierText);
  return playSpineAnim(spine, ['show'], false).then(() => playSpineAnim(spine, ['loop'], true));
}

export function setSignpostMultiplier(spine, sum) {
  if (!spine) return;
  if (sum > 0) setSpineSlotLabel(spine, 'maxmultiplier', `×${sum}`);
  else setSpineSlotLabel(spine, 'maxmultiplier', '');
}

export function setTumbleWinValue(spine, value) {
  if (!spine) return;
  setTumbleWinText(spine, value > 0 ? value.toLocaleString() : '', value);
}

/** @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine @param {string} text @param {number} [amount] */
export function setTumbleWinText(spine, text, amount = 0) {
  if (!spine) return;
  spine.__tumbleWinAmount = amount;
  layoutTumbleWinLabel(spine);
  const label = spine.__tumbleWinLabel;
  if (label) {
    label.style.fontSize = text.includes('×') ? 28 : 34;
    label.text = text;
    label.visible = Boolean(text);
    label.alpha = text ? 1 : 0;
    label.scale.set(1);
  }
}

/**
 * Pop text into the tumble frame (number or "20 × 2" formula).
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {import('pixi.js').Ticker} ticker
 * @param {string} text
 * @param {number} [amount]
 */
export async function animateTumbleWinTextReveal(spine, ticker, text, amount = 0) {
  if (!spine || !text) return;
  const label = spine.__tumbleWinLabel;
  if (!label || !ticker) {
    setTumbleWinText(spine, text, amount);
    return;
  }

  label.style.fontSize = text.includes('×') ? 28 : 34;
  label.text = text;
  label.visible = true;
  layoutTumbleWinLabel(spine);
  spine.__tumbleWinAmount = amount;
  label.alpha = 0;
  label.scale.set(0.35);

  await animate(ticker, 360, (t) => {
    layoutTumbleWinLabel(spine);
    const ease = easeOutBack(t);
    label.alpha = Math.min(1, t * 1.4);
    label.scale.set(0.35 + 0.65 * ease);
  });

  label.alpha = 1;
  label.scale.set(1);
  label.visible = true;
  layoutTumbleWinLabel(spine);
}

/**
 * Pop the win value into the frame after charge / pay (ref tumbleWinFont reveal).
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine} spine
 * @param {import('pixi.js').Ticker} ticker
 * @param {number} [value]
 */
export async function animateTumbleWinValueReveal(spine, ticker, value = spine?.__tumbleWinAmount ?? 0) {
  if (!spine || value <= 0) return;
  await animateTumbleWinTextReveal(spine, ticker, value.toLocaleString(), value);
}

export function refreshTumbleWinValueDisplay(spine) {
  if (!spine) return;
  setTumbleWinValue(spine, spine.__tumbleWinAmount ?? 0);
}

export function showTumbleWinSpine(spine, visible) {
  if (visible) void tumbleWinShow(spine);
  else void tumbleWinResetIdle(spine);
}

export function playSymbolPhase(spine, phase, symbolId = 0) {
  if (phase === 'win') {
    const dur = getSpineAnimDurationMs(spine, ['win']);
    return playSpineAnim(spine, ['win'], false).then(() => playSymbolIdle(spine, symbolId));
  }
  if (phase === 'land') {
    const names = symbolId === SCATTER_SYMBOL ? ['land', 'stop'] : ['land', 'stop'];
    return playSpineAnim(spine, names, false).then(() => playSymbolIdle(spine, symbolId));
  }
  playSymbolIdle(spine, symbolId);
  return Promise.resolve();
}
