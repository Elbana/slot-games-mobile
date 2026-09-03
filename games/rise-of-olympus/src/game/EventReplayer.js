/**
 * Maps server spin events → grid/UI animations (our client logic).
 */

import { getClientMultiplier } from './AssetLoader.js';
import { GRID, TIMING, LAND_ANIM_SYMBOLS, SCATTER_SYMBOL, cellPosition, DROP_PHYSICS, TUMBLE_PHYSICS } from './config.js';
import {
  animate,
  animateColumnTumble,
  animateRemove,
  animateSpinTransition,
  animateWinHighlight,
  resetCellVisuals,
} from './GridAnimator.js';
import { animateGodLand, animateMultiplierUpgrade, animateOrbLand } from './GodEffects.js';
import {
  playEventSound,
  playThronesSound,
  playGodPpsSound,
  playBigWinLevelup,
  playWinCounterSweetener,
  startFsMusic,
  startBaseMusic,
} from './ThronesSound.js';

/**
 * @param {object} ctx
 */
export function createEventReplayer(ctx) {
  const { ticker, cells, layout, glowLayer, paintCell, paintCellScroll, playWinClip, playLandClip } = ctx;
  const cellPos = cellPosition;
  /** @type {import('@esotericsoftware/spine-pixi-v8').Spine | null} */
  let godPortrait = ctx.godPortrait ?? null;

  let speedMult = 1;
  /** @type {[number, number][]} */
  let pendingScatters = [];
  let sweetenerStep = 0;

  const shouldPlayLand = (sym) => LAND_ANIM_SYMBOLS.has(sym);
  const dropOpts = {
    ticker,
    cells,
    layout,
    paintCell,
    paintCellScroll,
    cellPos,
    rowH: GRID.rowPitch,
    cellH: GRID.rowPitch,
    getMult: getClientMultiplier,
    staggerMs: TIMING.dealStagger,
    blockDelayMs: DROP_PHYSICS.blockDelay,
    playLandClip,
    shouldPlayLand,
    get speedMult() {
      return speedMult;
    },
    onColumnStart: (col) => {
      playThronesSound('drop');
      ctx.onColumnStart?.(col);
    },
    onColumnLand: (col) => {
      playThronesSound('land');
      const colScatters = pendingScatters.filter(([c]) => c === col);
      if (colScatters.length) playThronesSound('scatter');
      ctx.onColumnLand?.(col);
    },
  };

  const tumbleOpts = {
    ticker,
    cells,
    layout,
    paintCell,
    paintCellScroll,
    cellPos,
    cellH: GRID.rowPitch,
    rowH: GRID.rowPitch,
    getMult: getClientMultiplier,
    staggerMs: TIMING.tumbleStagger,
    blockDelayMs: TUMBLE_PHYSICS.blockDelay,
    tumblePhysics: TUMBLE_PHYSICS,
    playLandClip,
    shouldPlayLand,
    get speedMult() {
      return speedMult;
    },
    onSymbolLand: (sym) => {
      if (sym === SCATTER_SYMBOL) playThronesSound('scatter');
    },
  };

  /**
   * Exit current symbols column-by-column, then drop new ones as spin result arrives.
   * @param {Promise<import('../api/spin-types.js').SpinResult>} spinPromise
   */
  async function runSpinTransition(spinPromise) {
    playThronesSound('spin');
    glowLayer.removeChildren();
    ctx.hideSignpost?.();
    void ctx.resetTumbleWin?.();

    await animateSpinTransition({
      ...dropOpts,
      getSpinData: async () => {
        const result = await spinPromise;
        const deal =
          result.events?.find((e) => e.type === 'deal') ??
          { grid: result.symbols, multipliers: null, scatterPositions: [] };
        pendingScatters = deal.scatterPositions ?? [];
        if (!pendingScatters.length && deal.grid) {
          for (let c = 0; c < layout.cols; c++) {
            for (let r = 0; r < layout.rows; r++) {
              if (deal.grid[c]?.[r] === SCATTER_SYMBOL) pendingScatters.push([c, r]);
            }
          }
        }
        return { targetGrid: deal.grid, multGrid: deal.multipliers ?? null };
      },
      exitStaggerMs: TIMING.clearExitStagger,
    });
  }

  /**
   * @param {import('../../api/spin-api.js').SpinEvent[]} events
   * @param {(partial: number) => void} [onWinTick]
   * @param {number} [bet]
   */
  async function replay(events, onWinTick, bet = 20) {
    let runningWin = 0;
    /** @type {number[][] | null} */
    let lastGrid = null;
    /** @type {number[][] | null} */
    let lastMult = null;

    for (const ev of events) {
      playEventSound(ev);

      if (ev.type === 'deal') {
        pendingScatters = ev.scatterPositions ?? [];
        if (!pendingScatters.length && ev.grid) {
          for (let c = 0; c < layout.cols; c++) {
            for (let r = 0; r < layout.rows; r++) {
              if (ev.grid[c]?.[r] === SCATTER_SYMBOL) pendingScatters.push([c, r]);
            }
          }
        }
        lastGrid = ev.grid;
        lastMult = ev.multipliers;
        if (ev.multiplierSum > 0) ctx.setMultiplierSum(ev.multiplierSum);
        continue;
      }

      if (ev.type === 'cluster_win') {
        const positions = ev.wins.flatMap((w) => w.positions);
        const prevGrid = lastGrid ?? ev.grid;
        runningWin += ev.wins.reduce((a, w) => a + w.pay, 0);
        sweetenerStep += 1;
        playWinCounterSweetener(sweetenerStep);
        await ctx.onCascadeWin?.(runningWin);
        if (ctx.pulseTumblePanel) {
          await animate(ticker, TIMING.tumblePanelPulse / speedMult, (t) => ctx.pulseTumblePanel(t));
          ctx.resetPanelScale?.();
        }
        onWinTick?.(runningWin);

        await animateWinHighlight({
          ticker,
          cells,
          layout,
          positions,
          glowLayer,
          cellSize: GRID.cell,
          durationMs: TIMING.winHighlight / speedMult,
          playWinClip,
        });

        playThronesSound('trail');
        ctx.spawnTrailFx?.(positions);
        await animateRemove({
          ticker,
          cells,
          positions,
          durationMs: TIMING.remove / speedMult,
          cellPos,
        });
        await animateColumnTumble({
          ...tumbleOpts,
          prevGrid,
          targetGrid: ev.grid,
          removedPositions: positions,
          multGrid: ev.multipliers,
        });

        resetCellVisuals(cells, layout, cellPos);
        glowLayer.removeChildren();
        lastGrid = ev.grid;
        lastMult = ev.multipliers;
        if (ev.multiplierSum > 0) ctx.setMultiplierSum(ev.multiplierSum);
        continue;
      }

      if (ev.type === 'multiplier_apply') {
        ctx.setMultiplierSum(ev.sum);
        if (ctx.pulseSignpost) {
          await animate(ticker, TIMING.signpostPulse / speedMult, (t) => ctx.pulseSignpost(t));
          ctx.resetPanelScale?.();
        }
        onWinTick?.(ev.totalWin);
        await ctx.onMultiplierApply?.(ev.totalWin, ev.sum);
        continue;
      }

      if (ev.type === 'free_spins_awarded') {
        startFsMusic();
        ctx.onFreeSpinsAwarded?.(ev.count);
        await ctx.showFsBanner(ev.count);
        continue;
      }

      if (ev.type === 'free_spins_end') {
        await ctx.showFsSummary?.(ev.totalWin);
        startBaseMusic();
        ctx.onFreeSpinsEnd?.();
        continue;
      }

      if (ev.type === 'scatter_show') {
        await ctx.showScatterFlash(ev.count, ev.positions);
        continue;
      }

      if (ev.type === 'multiplier_land') {
        playGodPpsSound(ev.godId ?? 0);
        await Promise.all([
          animateOrbLand(ticker, cells[ev.col][ev.row], ctx.fxLayer, ev.godId),
          (async () => {
            godPortrait = ctx.onMultiplierLand?.(ev) ?? ctx.godPortrait;
            await animateGodLand(ticker, godPortrait, ev.godId);
          })(),
        ]);
        continue;
      }

      if (ev.type === 'multiplier_upgrade') {
        const cell = cells[ev.col]?.[ev.row];
        if (cell) {
          cell.__badge.visible = true;
          cell.__badge.text = `×${ev.value}`;
          const godId = cell.__sym === 14 ? 2 : cell.__sym === 13 ? 1 : 0;
          await animateMultiplierUpgrade(ticker, cell, ctx.fxLayer, godId);
        }
        continue;
      }

      if (ev.type === 'fs_multiplier_update') {
        ctx.onFsMultiplierUpdate?.(ev.value);
        continue;
      }
    }

    if (lastGrid) ctx.setSymbolsImmediate(lastGrid, lastMult);
    if (runningWin > 0) {
      const tier = runningWin >= bet * 100 ? 3 : runningWin >= bet * 50 ? 2 : 1;
      playThronesSound('big_win');
      playBigWinLevelup(tier);
      await ctx.showBigWin(runningWin, bet);
      playThronesSound('big_win_end');
    }
    sweetenerStep = 0;
  }

  return {
    replay,
    runSpinTransition,
    setAnimationSpeed(mult = 1) {
      speedMult = Math.max(1, Math.min(4, mult));
    },
  };
}
