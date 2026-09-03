/**
 * SOR clip player — composites layered PG timeline frames (original game assets).
 */

import { Container, Sprite } from 'pixi.js';

/**
 * @param {Container} root
 * @param {object} layer
 * @param {Map<string, import('pixi.js').Texture>} frameToTex
 * @param {Map<string, object>} [frameMeta]
 */
export function paintLayers(root, layer, frameToTex, frameMeta) {
  const alpha = typeof layer.ap === 'number' ? layer.ap : 1;
  if (alpha <= 0) return;

  const tex = frameToTex.get(layer.frame);
  if (!tex) return;

  const meta = frameMeta?.get(layer.frame);
  const fw = meta?.sourceSize?.w ?? tex.orig?.width ?? tex.width ?? 1;
  const fh = meta?.sourceSize?.h ?? tex.orig?.height ?? tex.height ?? 1;

  const sprite = new Sprite(tex);
  sprite.anchor.set((layer.tfx ?? 0) / fw, (layer.tfy ?? 0) / fh);
  sprite.position.set(layer.x ?? 0, layer.y ?? 0);
  sprite.scale.set(layer.scx ?? 1, layer.scy ?? 1);
  if (layer.bm === 1) sprite.blendMode = 'add';
  sprite.alpha = alpha;
  root.addChild(sprite);
}

/** PG settled idle frame index (restore — not transition stop frame 0). */
export function idleFrameIndex(def) {
  if (typeof def?.labels?.restore === 'number') return def.labels.restore;
  if (typeof def?.labels?.stop === 'number') return def.labels.stop;
  return 0;
}
/** Drop motion-blur / off-center ghost layers from settled idle frames. */
export function filterSettledLayers(layers, symSize = 210) {
  const cx = symSize / 2;
  const cy = symSize / 2;
  return (layers ?? []).filter((layer) => {
    if ((layer.ap ?? 1) <= 0) return false;
    if (layer.bm === 1) return false;
    const maxSc = Math.max(Math.abs(layer.scx ?? 1), Math.abs(layer.scy ?? 1));
    if (maxSc > 1.35) return false;
    const x = layer.x ?? 0;
    const y = layer.y ?? 0;
    const dist = Math.min(Math.hypot(x - cx, y - cy), Math.hypot(x, y));
    if (dist > 52) return false;
    if (maxSc > 1.08 && dist > 32) return false;
    return true;
  });
}

/** Layers for idle display — hide invisible / additive streaks; dedupe frames. */
export function filterIdleLayers(layers, symSize = 210) {
  const seen = new Set();
  return filterSettledLayers(layers, symSize).filter((layer) => {
    const key = layer.frame ?? '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Stricter filter for flat atlas bake (drop motion-blur scale + dupes). */
export function filterBakeLayers(layers, symSize = 210) {
  return filterIdleLayers(layers, symSize);
}

/**
 * @param {object} def
 * @param {Map<string, import('pixi.js').Texture>} frameToTex
 * @param {Map<string, object>} [frameMeta]
 * @param {number} [displaySize]
 * @param {{ w?: number, h?: number }} [stageSize]
 */
export function createSymbolClipPlayer(def, frameToTex, frameMeta, displaySize, stageSize) {
  const root = new Container();
  const inner = new Container();
  root.addChild(inner);
  const symW = stageSize?.w ?? def.size?.w ?? def.size ?? 210;
  const symH = stageSize?.h ?? def.size?.h ?? def.size ?? 210;
  const fitSize = displaySize ?? Math.max(symW, symH);
  const scale = fitSize / Math.max(symW, symH);
  inner.position.set(-symW / 2, -symH / 2);
  root.scale.set(scale);
  root.__baseScale = scale;

  let frame = 0;
  let playing = false;
  let endFrame = 0;
  let loop = false;
  let loopStart = 0;
  let accum = 0;
  const fps = def.fps ?? 30;

  function rebuild() {
    inner.removeChildren();
    const raw = def.frames?.[frame] ?? def.frames?.[0] ?? def.layers ?? [];
    const layers = playing ? raw : filterIdleLayers(raw, symW);
    for (const layer of layers) paintLayers(inner, layer, frameToTex, frameMeta);
  }

  function gotoFrame(f) {
    frame = Math.max(0, Math.min(f, (def.duration ?? 1) - 1));
    rebuild();
  }

  function gotoLabel(label) {
    const f = def.labels?.[label];
    gotoFrame(typeof f === 'number' ? f : 0);
  }

  /** @param {string} fromLabel @param {number} [frameCount] */
  function playSegment(fromLabel, frameCount = 36) {
    if (typeof def.labels?.[fromLabel] !== 'number') {
      gotoLabel('restore');
      return Promise.resolve();
    }
    const start = def.labels[fromLabel];
    frame = start;
    endFrame = Math.min(start + frameCount, def.duration);
    loop = false;
    playing = true;
    accum = 0;
    rebuild();
    return new Promise((resolve) => {
      root.__onComplete = resolve;
    });
  }

  /** @param {string} fromLabel @param {string} [toLabel] */
  function play(fromLabel, toLabel = 'restore') {
    if (typeof def.labels?.[fromLabel] !== 'number') {
      gotoLabel('restore');
      return Promise.resolve();
    }
    const start = def.labels[fromLabel];
    let end = typeof def.labels?.[toLabel] === 'number' ? def.labels[toLabel] : def.duration;
    if (end <= start) end = def.duration;
    frame = start;
    endFrame = end;
    loop = false;
    playing = true;
    accum = 0;
    rebuild();
    return new Promise((resolve) => {
      root.__onComplete = resolve;
    });
  }

  function playLoop() {
    playLoopRange(0, def.duration ?? 1);
  }

  /** @param {number} start @param {number} end */
  function playLoopRange(start, end) {
    loop = true;
    playing = true;
    loopStart = start;
    frame = start;
    endFrame = end;
    accum = 0;
    rebuild();
  }

  function stopLoop() {
    loop = false;
    playing = false;
    gotoLabel('restore');
  }

  function tick(deltaMs) {
    if (!playing) return;
    accum += deltaMs;
    const frameDur = 1000 / fps;
    while (accum >= frameDur && playing) {
      accum -= frameDur;
      frame++;
      if (frame >= endFrame) {
        if (loop) {
          frame = loopStart;
          rebuild();
          continue;
        }
        playing = false;
        gotoLabel('restore');
        root.__onComplete?.();
        root.__onComplete = null;
        return;
      }
      rebuild();
    }
  }

  gotoLabel('restore');

  return {
    view: root,
    gotoLabel,
    gotoFrame,
    play,
    playSegment,
    playLoop,
    playLoopRange,
    stopLoop,
    tick,
    get playing() {
      return playing;
    },
  };
}

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {ReturnType<typeof createSymbolClipPlayer>[]} players
 */
export function attachClipTicker(ticker, players) {
  const tick = () => {
    const dt = ticker.deltaMS;
    for (const p of players) {
      if (p.playing) p.tick(dt);
    }
  };
  ticker.add(tick);
  return () => ticker.remove(tick);
}
