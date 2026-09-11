/**
 * End-of-round coin shower — Pixi sprites (original coin01–coin05 spin atlas).
 */
import { Container, Sprite, Spritesheet, Texture, ImageSource } from 'pixi.js';
import { STAGE } from './config.js';

/** Ref riseofolympus1000 WinCounter limits (bet multiples). */
export const WIN_CELEBRATION_LIMITS = [1, 3, 7, 15];

const COIN_BASE = '/assets/rise-of-olympus/coins';
const COIN_SHEET_JSON = `${COIN_BASE}/coin_sprites.json`;
const COIN_SHEET_PNG = `${COIN_BASE}/main_texture0_level2.png`;
const COIN_SOURCE_SIZE = 50;

/** @type {WeakMap<import('pixi.js').Application, import('pixi.js').Texture[][]>} */
const coinAnimByApp = new WeakMap();

const DEFAULT_COIN_PX = 40;

const TIER_COIN = [
  { burst: 8, rate: 3, speed: 640, spread: 0.5, spawnMs: 750 },
  { burst: 12, rate: 4, speed: 680, spread: 0.55, spawnMs: 900 },
  { burst: 16, rate: 5, speed: 720, spread: 0.6, spawnMs: 1050 },
  { burst: 22, rate: 7, speed: 760, spread: 0.65, spawnMs: 1200 },
  { burst: 28, rate: 9, speed: 800, spread: 0.7, spawnMs: 1350 },
];

export function resolveWinCelebrationTier(totalWin, bet) {
  if (!totalWin || totalWin <= 0 || bet <= 0) return -1;
  let tier = 0;
  for (let i = 0; i < WIN_CELEBRATION_LIMITS.length; i++) {
    if (totalWin >= bet * WIN_CELEBRATION_LIMITS[i]) tier = i + 1;
  }
  return tier;
}

/** Full cloud/gods presentation — 5× bet (social demo; ref uses 10×). */
export const BIG_WIN_BET_MULTIPLE = 5;

/** True when the round qualifies for the full cloud / gods big-win presentation. */
export function isBigWinRound(totalWin, bet) {
  return totalWin > 0 && bet > 0 && totalWin >= bet * BIG_WIN_BET_MULTIPLE;
}

export function resolveCoinShowerTier(totalWin, bet) {
  const labelTier = resolveWinCelebrationTier(totalWin, bet);
  let coinTier = Math.max(0, labelTier);
  if (totalWin >= bet * 100) coinTier = Math.max(coinTier, 4);
  else if (totalWin >= bet * 50) coinTier = Math.max(coinTier, 3);
  else if (totalWin >= bet * 25) coinTier = Math.max(coinTier, 2);
  else if (totalWin >= bet * BIG_WIN_BET_MULTIPLE) coinTier = Math.max(coinTier, 1);
  return coinTier;
}

/** @param {Record<string, import('pixi.js').Texture>} textures */
function buildCoinAnimSets(textures) {
  /** @type {import('pixi.js').Texture[][]} */
  const sets = [];
  for (let coin = 1; coin <= 5; coin++) {
    /** @type {import('pixi.js').Texture[]} */
    const frames = [];
    for (let i = 0; i < 19; i++) {
      const key = `coin0${coin}_${i}.png`;
      const tex = textures[key];
      if (tex) frames.push(tex);
    }
    if (frames.length) sets.push(frames);
  }
  return sets;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Load atlas into the coin overlay app's WebGL context (separate from main game). */
async function loadCoinAnimSetsForApp(coinApp) {
  if (!coinApp?.renderer) return null;
  const cached = coinAnimByApp.get(coinApp);
  if (cached?.length) return cached;

  try {
    const data = await fetch(COIN_SHEET_JSON).then((r) => r.json());
    if (data.meta && typeof data.meta.scale === 'string') {
      data.meta.scale = Number(data.meta.scale);
    }
    const img = await loadImage(COIN_SHEET_PNG);
    const source = new ImageSource({ resource: img });
    const page = new Texture({ source });
    const sheet = new Spritesheet({ texture: page, data });
    await sheet.parse();
    const sets = buildCoinAnimSets(sheet.textures);
    if (sets.length) {
      coinAnimByApp.set(coinApp, sets);
      return sets;
    }
  } catch (err) {
    console.warn('[WinCelebration] coin overlay atlas load failed', err);
  }
  return null;
}

export function preloadCoinShowerAssets() {
  return Promise.all([
    fetch(COIN_SHEET_JSON),
    loadImage(COIN_SHEET_PNG),
  ]).catch(() => {});
}

/**
 * @param {import('pixi.js').Application} coinApp
 * @param {number} tier
 * @param {{ width: number, height: number, floorY: number, minX: number, maxX: number, coinPx?: number }} [bounds]
 */
export async function startCoinShower(coinApp, tier, bounds) {
  const anims = await loadCoinAnimSetsForApp(coinApp);
  if (!anims?.length || !coinApp?.stage) return { stop() {} };

  const cfg = TIER_COIN[Math.max(0, Math.min(TIER_COIN.length - 1, tier))] ?? TIER_COIN[0];
  const ticker = coinApp.ticker;

  const screenW = bounds?.width ?? coinApp.screen.width ?? STAGE.width;
  const screenH = bounds?.height ?? coinApp.screen.height ?? STAGE.height;
  const floorY = bounds?.floorY ?? screenH * 0.82;
  const minX = bounds?.minX ?? 16;
  const maxX = bounds?.maxX ?? screenW - 16;
  const baseScale = (bounds?.coinPx ?? DEFAULT_COIN_PX) / COIN_SOURCE_SIZE;

  coinApp.stage.removeChildren();
  coinApp.stage.sortableChildren = true;
  const bucket = new Container();
  bucket.eventMode = 'none';
  bucket.zIndex = 1;
  coinApp.stage.addChild(bucket);

  /** @type {{
   *   sprite: Sprite,
   *   anim: import('pixi.js').Texture[],
   *   animFrame: number,
   *   animAcc: number,
   *   vx: number,
   *   vy: number,
   *   life: number,
   *   maxLife: number,
   * }[]} */
  const coins = [];
  let spawnAcc = 0;
  let stopped = false;
  let spawnDone = false;
  let spawnElapsed = 0;

  const spawnOne = () => {
    const anim = anims[Math.floor(Math.random() * anims.length)];
    const frame = Math.floor(Math.random() * anim.length);
    const sprite = new Sprite(anim[frame]);
    sprite.anchor.set(0.5);
    sprite.roundPixels = true;
    sprite.eventMode = 'none';
    const scale = baseScale * (0.98 + Math.random() * 0.06);
    sprite.scale.set(scale);
    sprite.x = minX + Math.random() * (maxX - minX);
    sprite.y = floorY + Math.random() * 10;
    const spread = (Math.random() - 0.5) * Math.PI * cfg.spread;
    const speed = cfg.speed * (0.9 + Math.random() * 0.2);
    bucket.addChild(sprite);
    coins.push({
      sprite,
      anim,
      animFrame: frame,
      animAcc: 0,
      vx: Math.sin(spread) * speed * 0.42,
      vy: -Math.abs(Math.cos(spread) * speed),
      life: 0,
      maxLife: 1100 + Math.random() * 500,
    });
  };

  for (let i = 0; i < cfg.burst; i++) spawnOne();

  const finish = () => {
    ticker.remove(step);
    for (const c of coins) c.sprite.destroy();
    coins.length = 0;
    bucket.removeChildren();
    bucket.destroy({ children: true });
    coinApp.stage.removeChildren();
  };

  const step = () => {
    if (stopped) return;
    const dt = Math.min(32, ticker.deltaMS);

    if (!spawnDone) {
      spawnElapsed += dt;
      spawnAcc += dt;
      if (cfg.rate > 0) {
        const interval = 1000 / cfg.rate;
        while (spawnAcc >= interval && spawnElapsed < cfg.spawnMs) {
          spawnAcc -= interval;
          spawnOne();
        }
      }
      if (spawnElapsed >= cfg.spawnMs) spawnDone = true;
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.life += dt;
      c.vy += 2 * dt;
      c.sprite.x += (c.vx * dt) / 1000;
      c.sprite.y += (c.vy * dt) / 1000;

      c.animAcc += dt;
      if (c.animAcc >= 45) {
        c.animAcc = 0;
        c.animFrame = (c.animFrame + 1) % c.anim.length;
        c.sprite.texture = c.anim[c.animFrame];
      }

      const t = c.life / c.maxLife;
      c.sprite.alpha = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;

      if (c.life >= c.maxLife || c.sprite.y < -50 || c.sprite.y > screenH + 60) {
        c.sprite.destroy();
        coins.splice(i, 1);
      }
    }

    if (spawnDone && coins.length === 0) finish();
  };

  ticker.add(step);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      finish();
    },
  };
}
