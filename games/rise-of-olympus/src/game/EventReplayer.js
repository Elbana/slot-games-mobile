/**
 * Maps server spin events → grid/UI animations (our client logic).
 */

import { getClientMultiplier, toClientMultiplierGrid } from './AssetLoader.js';
import { GRID, TIMING, LAND_ANIM_SYMBOLS, SCATTER_SYMBOL, MULTIPLIER_GOD_ID, cellPosition, DROP_PHYSICS, TUMBLE_PHYSICS } from './config.js';
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
        return {
          targetGrid: deal.grid,
          multGrid: toClientMultiplierGrid(deal.grid, deal.multipliers ?? null),
        };
      },
      exitStaggerMs: TIMING.clearExitStagger,
    });
  }

  /**
   * @param {{ col: number, row: number, value: number, godId?: number }[]} batch
   */
  async function handleMultiplierLandBatch(batch) {
    if (!batch.length) return;

    for (const ev of batch) {
      ctx.setCellMultiplier?.(cells[ev.col]?.[ev.row], 0);
    }

    const lead = batch[0];
    await Promise.all([
      ...batch.map((ev) => {
        const cell = cells[ev.col]?.[ev.row];
        return animateOrbLand(ticker, cell, ctx.fxLayer, MULTIPLIER_GOD_ID, () => {
          ctx.setCellMultiplier?.(cell, ev.value);
        });
      }),
      (async () => {
        godPortrait = ctx.onMultiplierLand?.(lead) ?? ctx.godPortrait;
        await animateGodLand(ticker, godPortrait, MULTIPLIER_GOD_ID);
      })(),
    ]);
  }

  /**
   * @param {{ col: number, row: number, value: number, super?: boolean }[]} batch
   */
  async function handleMultiplierUpgradeBatch(batch) {
    if (batch.length) playGodPpsSound(MULTIPLIER_GOD_ID);
    await Promise.all(
      batch.map(async (ev) => {
        const cell = cells[ev.col]?.[ev.row];
        if (!cell) return;
        ctx.setCellMultiplier?.(cell, 0);
        await animateMultiplierUpgrade(ticker, cell, ctx.fxLayer, MULTIPLIER_GOD_ID, () => {
          ctx.setCellMultiplier?.(cell, ev.value);
        });
      })
    );
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

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
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
        lastMult = toClientMultiplierGrid(ev.grid, ev.multipliers);
        if (ev.multiplierSum > 0) ctx.setMultiplierSum(ev.multiplierSum);
        continue;
      }

      if (ev.type === 'cluster_win') {
        const positions = ev.wins.flatMap((w) => w.positions);
        const clusterPay = ev.wins.reduce((a, w) => a + w.pay, 0);
        const prevGrid = lastGrid ?? ev.grid;
        runningWin += clusterPay;
        sweetenerStep += 1;
        playWinCounterSweetener(sweetenerStep);

        const winFx = ctx.spawnWinFx?.(positions, clusterPay, bet);
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
        await winFx;
        await ctx.endWinFx?.();

        await ctx.onCascadeWin?.(runningWin);
        if (ctx.pulseTumblePanel) {
          await animate(ticker, TIMING.tumblePanelPulse / speedMult, (t) => ctx.pulseTumblePanel(t));
          ctx.resetPanelScale?.();
        }
        onWinTick?.(runningWin);

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
        lastMult = toClientMultiplierGrid(ev.grid, ev.multipliers);
        if (ev.multiplierSum > 0) ctx.setMultiplierSum(ev.multiplierSum);
        continue;
      }

      if (ev.type === 'multiplier_apply') {
        ctx.setMultiplierSum(ev.sum);
        onWinTick?.(ev.totalWin);
        await ctx.onMultiplierApply?.(ev.totalWin, ev.sum, ev.baseWin);
        if (ctx.pulseSignpost) {
          await animate(ticker, TIMING.signpostPulse / speedMult, (t) => ctx.pulseSignpost(t));
          ctx.resetPanelScale?.();
        }
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
        /** @type {typeof ev[]} */
        const batch = [ev];
        while (i + 1 < events.length && events[i + 1].type === 'multiplier_land') {
          batch.push(/** @type {typeof ev} */ (events[++i]));
        }
        await handleMultiplierLandBatch(batch);
        continue;
      }

      if (ev.type === 'multiplier_upgrade') {
        /** @type {typeof ev[]} */
        const batch = [ev];
        while (i + 1 < events.length && events[i + 1].type === 'multiplier_upgrade') {
          batch.push(/** @type {typeof ev} */ (events[++i]));
        }
        await handleMultiplierUpgradeBatch(batch);
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
