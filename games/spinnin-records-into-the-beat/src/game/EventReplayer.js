/**
 * Football Gold — maps server events → SOR clone reel + symbol clip animations.
 */

import { TIMING } from './config.js';
import { animateReelSpin, animateWinHighlight } from './ReelAnimator.js';

/**
 * @param {object} ctx
 */
export function createEventReplayer(ctx) {
  const {
    ticker,
    cells,
    setCellSymbol,
    setCellSymbolScroll,
    cellPos,
    showWheelBanner,
    showFsBanner,
    createWinGlow,
    cellSize,
    playWinClip,
    playLandClip,
    playScatterClips,
  } = ctx;

  /**
   * @param {import('../../api/spin-types.js').SpinEvent[]} events
   * @param {(partial: number) => void} [onWinTick]
   */
  async function replay(events, onWinTick) {
    let runningWin = 0;
    /** @type {number[][] | null} */
    let lastGrid = null;

    for (const ev of events) {
      if (ev.type === 'deal') {
        await animateReelSpin({
          ticker,
          cells,
          targetGrid: ev.grid,
          setCellSymbol,
          setCellSymbolScroll,
          cellPos,
          staggerMs: TIMING.reelStagger,
          spinMs: TIMING.reelSpin,
          stopMs: TIMING.reelStop,
          scrollInterval: TIMING.reelScrollInterval,
          playLandClip,
        });
        lastGrid = ev.grid;
        continue;
      }

      if (ev.type === 'line_win') {
        runningWin = ev.totalWin;
        onWinTick?.(runningWin);
        const positions = ev.wins.flatMap((w) => w.positions);
        await animateWinHighlight(
          ticker,
          cells,
          positions,
          TIMING.winHighlight,
          createWinGlow,
          cellSize,
          playWinClip
        );
        continue;
      }

      if (ev.type === 'scatter_show') {
        if (lastGrid && playScatterClips) await playScatterClips(lastGrid);
        await ctx.showScatterFlash?.(ev.count);
        continue;
      }

      if (ev.type === 'wheel_spin') {
        await showWheelBanner?.(ev.result);
        continue;
      }

      if (ev.type === 'free_spins_awarded') {
        await showFsBanner?.(ev.count);
        continue;
      }

      if (ev.type === 'coin_win') {
        runningWin += ev.pay;
        onWinTick?.(runningWin);
        if (ev.positions?.length) {
          await animateWinHighlight(
            ticker,
            cells,
            ev.positions,
            TIMING.winHighlight,
            createWinGlow,
            cellSize,
            playWinClip
          );
        }
        await ctx.showCoinBanner?.(ev.tier, ev.pay);
        continue;
      }

      if (ev.type === 'expanding_symbol_pick') {
        await ctx.showExpandingPick?.(ev.symbol);
        continue;
      }

      if (ev.type === 'fs_multiplier_update') {
        await ctx.updateFsMultiplier?.(ev.value);
        continue;
      }

      if (ev.type === 'elephant_win') {
        runningWin += ev.wins?.reduce((s, w) => s + (w.pay ?? w.coins ?? 0), 0) ?? 0;
        onWinTick?.(runningWin);
        if (ev.positions?.length) {
          await animateWinHighlight(
            ticker,
            cells,
            ev.positions,
            TIMING.winHighlight,
            createWinGlow,
            cellSize,
            playWinClip
          );
        }
        continue;
      }

      if (ev.type === 'warhorn') {
        await ctx.showWarhornBanner?.();
        continue;
      }

      if (ev.type === 'grid_clear' || ev.type === 'grid_update') {
        continue;
      }
    }

    if (lastGrid) {
      for (let c = 0; c < lastGrid.length; c++) {
        for (let r = 0; r < lastGrid[c].length; r++) {
          setCellSymbol(cells[c][r], lastGrid[c][r]);
        }
      }
    }
  }

  return { replay };
}
