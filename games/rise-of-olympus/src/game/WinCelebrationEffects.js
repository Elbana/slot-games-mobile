/**
 * Cluster-win celebration — original coin01–coin05 shower + tier resolution.
 */
import { Container, Sprite, Assets, Spritesheet } from 'pixi.js';

/** Ref riseofolympus1000 WinCounter limits (bet multiples). */
export const WIN_CELEBRATION_LIMITS = [1, 3, 7, 15];

const COIN_BASE = '/assets/rise-of-olympus/coins';
const COIN_SHEET_JSON = `${COIN_BASE}/coin_sprites.json`;
const COIN_SHEET_PNG = `${COIN_BASE}/main_texture0_level2.png`;

/** @type {import('pixi.js').Texture[][] | null} */
let coinAnimSets = null;

const TIER_COIN = [
  { burst: 12, rate: 4, speed: 700, spread: 0.55, scale: 1.65 },
  { burst: 16, rate: 6, speed: 760, spread: 0.6, scale: 1.75 },
  { burst: 22, rate: 8, speed: 820, spread: 0.65, scale: 1.85 },
  { burst: 30, rate: 10, speed: 880, spread: 0.7, scale: 1.95 },
  { burst: 38, rate: 12, speed: 940, spread: 0.75, scale: 2.05 },
];

/**
 * @param {number} clusterPay
 * @param {number} bet
 * @returns {number} 0 = coins only, 1–4 = winlabel + escalating FX
 */
export function resolveWinCelebrationTier(clusterPay, bet) {
  if (!clusterPay || clusterPay <= 0 || bet <= 0) return -1;
  let tier = 0;
  for (let i = 0; i < WIN_CELEBRATION_LIMITS.length; i++) {
    if (clusterPay >= bet * WIN_CELEBRATION_LIMITS[i]) tier = i + 1;
  }
  return tier;
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
      const alt = `coin0${coin}_${i}`;
      const tex = textures[key] ?? textures[alt];
      if (tex) frames.push(tex);
    }
    if (frames.length) sets.push(frames);
  }
  return sets;
}

async function loadCoinAnimSets() {
  if (coinAnimSets?.length) return coinAnimSets;

  try {
    const sheet = await Assets.load({ alias: 'roo-coin-atlas', src: COIN_SHEET_JSON });
    const sets = buildCoinAnimSets(sheet?.textures ?? {});
    if (sets.length) {
      coinAnimSets = sets;
      return coinAnimSets;
    }
  } catch (err) {
    console.warn('[WinCelebration] Assets.load coin atlas failed', err);
  }

  try {
    const page = await Assets.load(COIN_SHEET_PNG);
    const data = await fetch(COIN_SHEET_JSON).then((r) => r.json());
    if (data.meta && typeof data.meta.scale === 'string') {
      data.meta.scale = Number(data.meta.scale);
    }
    const sheet = new Spritesheet({ texture: page, data });
    await sheet.parse();
    const sets = buildCoinAnimSets(sheet.textures);
    if (sets.length) {
      coinAnimSets = sets;
      return coinAnimSets;
    }
  } catch (err) {
    console.warn('[WinCelebration] Spritesheet coin load failed', err);
  }

  console.warn('[WinCelebration] no coin textures — shower disabled');
  return null;
}

/** Preload original coin spin sprites (coin01–coin05). */
export function preloadCoinShowerAssets() {
  return loadCoinAnimSets();
}

/**
 * Original RoO coins — spin frames arc up from the bottom of the stage.
 * @param {import('pixi.js').Container} layer
 * @param {{ width: number, height: number }} stage
 * @param {number} tier
 */
export async function startCoinShower(layer, stage, tier) {
  const anims = await loadCoinAnimSets();
  if (!anims?.length) return { stop() {} };

  const cfg = TIER_COIN[Math.max(0, Math.min(TIER_COIN.length - 1, tier))] ?? TIER_COIN[0];
  const bucket = new Container();
  bucket.zIndex = 500;
  bucket.eventMode = 'none';
  if (!layer.sortableChildren) layer.sortableChildren = true;
  layer.addChild(bucket);

  const floorY = stage.height - 8;
  const minX = 40;
  const maxX = stage.width - 40;

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
  let raf = 0;
  let last = performance.now();

  const spawnOne = () => {
    const anim = anims[Math.floor(Math.random() * anims.length)];
    const frame = Math.floor(Math.random() * anim.length);
    const sprite = new Sprite(anim[frame]);
    sprite.anchor.set(0.5);
    sprite.tint = 0xffffff;
    const scale = cfg.scale * (0.92 + Math.random() * 0.18);
    sprite.scale.set(scale);
    sprite.x = minX + Math.random() * (maxX - minX);
    sprite.y = floorY + Math.random() * 12;
    const spread = (Math.random() - 0.5) * Math.PI * cfg.spread;
    const speed = cfg.speed * (0.88 + Math.random() * 0.28);
    bucket.addChild(sprite);
    coins.push({
      sprite,
      anim,
      animFrame: frame,
      animAcc: 0,
      vx: Math.sin(spread) * speed * 0.45,
      vy: -Math.abs(Math.cos(spread) * speed),
      life: 0,
      maxLife: 1200 + Math.random() * 600,
    });
  };

  for (let i = 0; i < cfg.burst; i++) spawnOne();

  const step = (now) => {
    if (stopped) return;
    const dt = Math.min(32, now - last);
    last = now;
    spawnAcc += dt;
    if (cfg.rate > 0) {
      const interval = 1000 / cfg.rate;
      while (spawnAcc >= interval) {
        spawnAcc -= interval;
        spawnOne();
      }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.life += dt;
      c.vy += 2.2 * dt;
      c.sprite.x += (c.vx * dt) / 1000;
      c.sprite.y += (c.vy * dt) / 1000;

      c.animAcc += dt;
      if (c.animAcc >= 40) {
        c.animAcc = 0;
        c.animFrame = (c.animFrame + 1) % c.anim.length;
        c.sprite.texture = c.anim[c.animFrame];
      }

      const t = c.life / c.maxLife;
      c.sprite.alpha = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
      if (c.life >= c.maxLife || c.sprite.y < -80 || c.sprite.y > stage.height + 100) {
        c.sprite.destroy();
        coins.splice(i, 1);
      }
    }

    if (coins.length === 0 && stopped) {
      bucket.destroy({ children: true });
      return;
    }
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      for (const c of coins) c.sprite.destroy();
      coins.length = 0;
      bucket.destroy({ children: true });
    },
  };
}
