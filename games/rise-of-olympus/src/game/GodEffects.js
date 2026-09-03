/**
 * God multiplier land FX — Spine symbol clips + portrait pulse.
 */

import { animate } from './GridAnimator.js';
import { GRID, TIMING, cellStageCenter } from './config.js';
import {
  createUpgradeFxSpine,
  playGodAction,
  playMultiplierLand,
  playSpineAnim,
  playUpgradeFx,
} from './ThronesSpineLoader.js';

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {import('@esotericsoftware/spine-pixi-v8').Spine | null} godPortrait
 * @param {number} godId
 */
export async function animateGodLand(ticker, godPortrait, godId) {
  if (godPortrait) await playGodAction(godPortrait, godId);
  else {
    await animate(ticker, TIMING.godLand ?? 420, () => {});
  }
}

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {import('pixi.js').Container} cell
 * @param {import('pixi.js').Container} [fxLayer]
 * @param {number} [godId]
 */
export async function animateOrbLand(ticker, cell, fxLayer, godId = 0) {
  const sym = cell.__sym ?? 0;
  /** @type {Promise<void>[]} */
  const plays = [];

  if (cell.__spine && sym >= 12 && sym <= 14) {
    plays.push(playMultiplierLand(cell.__spine, sym));
  } else {
    plays.push(
      animate(ticker, TIMING.orbLand ?? 380, (t) => {
        const pulse = 1 + Math.sin(t * Math.PI) * 0.28;
        cell.scale.set(pulse);
        if (cell.__sprite) cell.__sprite.tint = 0xffffcc;
        if (cell.__spine) cell.__spine.alpha = 0.85 + 0.15 * Math.sin(t * Math.PI);
      }).then(() => {
        cell.scale.set(1);
        if (cell.__sprite) cell.__sprite.tint = 0xffffff;
        if (cell.__spine) cell.__spine.alpha = 1;
      })
    );
  }

  if (fxLayer) {
    const fx = createUpgradeFxSpine();
    const col = Math.round(cell.x / GRID.colPitch);
    const row = Math.round(cell.y / GRID.rowPitch);
    const pos = cellStageCenter(col, row);
    fx.position.set(pos.x, pos.y);
    fxLayer.addChild(fx);
    plays.push(
      playUpgradeFx(fx, godId).then(() => {
        fx.destroy({ children: true });
      })
    );
  }

  await Promise.all(plays);
}

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {import('pixi.js').Container} cell
 * @param {import('pixi.js').Container} [fxLayer]
 * @param {number} [godId]
 */
export async function animateMultiplierUpgrade(ticker, cell, fxLayer, godId = 0) {
  void ticker;
  if (cell.__spine && (cell.__sym ?? 0) >= 12) {
    const sym = cell.__sym ?? 12;
    const start =
      sym === 14
        ? ['upgrade_gold_start', 'upgrade_silver_start']
        : sym === 13
          ? ['upgrade_silver_start', 'upgrade_bronze_start']
          : ['upgrade_bronze_start'];
    const end =
      sym === 14
        ? ['upgrade_gold_end', 'gold']
        : sym === 13
          ? ['upgrade_silver_end', 'silver']
          : ['upgrade_bronze_end', 'bronze'];
    await playSpineAnim(cell.__spine, start, false);
    await playSpineAnim(cell.__spine, end, false);
    await playSpineAnim(cell.__spine, [sym === 14 ? 'gold' : sym === 13 ? 'silver' : 'bronze', 'idle'], true);
  }
  if (fxLayer) {
    const fx = createUpgradeFxSpine();
    const col = Math.round(cell.x / GRID.colPitch);
    const row = Math.round(cell.y / GRID.rowPitch);
    const pos = cellStageCenter(col, row);
    fx.position.set(pos.x, pos.y);
    fxLayer.addChild(fx);
    await playUpgradeFx(fx, godId);
    fx.destroy({ children: true });
  }
}
