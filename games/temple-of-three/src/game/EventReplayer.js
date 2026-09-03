/**
 * Egypt Treasures — maps server events → TOT-style reel animations.
 */

import { TIMING, LAND_ANIM_SYMBOLS } from './config.js';
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
    showFeatureBanner,
    createWinGlow,
    cellSize,
    playWinClip,
    playLandClip,
    playCashCollectClip,
    playPotCollect,
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
          landAnimSymbols: LAND_ANIM_SYMBOLS,
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

      if (ev.type === 'coin_win' || ev.type === 'cash_win') {
        runningWin += ev.pay ?? 0;
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
        await showFeatureBanner?.('CASH WIN', ev.pay);
        continue;
      }

      if (ev.type === 'pot_collect') {
        const collections = ev.collections ?? [];
        const potTypes = [...new Set(collections.map((c) => c.pot).filter((p) => p != null))];
        /** @type {Promise<void>[]} */
        const potPlays = potTypes.map((ppsType) => playPotCollect?.(ppsType) ?? Promise.resolve());
        /** @type {Promise<void>[]} */
        const collectPlays = [];
        for (const c of collections) {
          const cell = cells[c.col]?.[c.row];
          if (cell && playCashCollectClip) collectPlays.push(playCashCollectClip(cell, c.pot));
        }
        await Promise.all([...potPlays, ...collectPlays]);
        const positions = collections.map((c) => [c.col, c.row]);
        if (positions.length) {
          await animateWinHighlight(
            ticker,
            cells,
            positions,
            TIMING.winHighlight * 0.6,
            createWinGlow,
            cellSize,
            playWinClip
          );
        }
        const pots = [...new Set(collections.map((c) => c.pot) ?? [])].join(' · ');
        await showFeatureBanner?.('POT COLLECT', pots);
        continue;
      }

      if (ev.type === 'free_spins_awarded') {
        await showFeatureBanner?.('FREE SPINS', ev.count);
        continue;
      }
    }

    if (lastGrid) {
      for (let c = 0; c < lastGrid.length; c++) {
        for (let r = 0; r < lastGrid[c].length; r++) {
          const pos = cellPos(c, r);
          const cell = cells[c][r];
          cell.x = pos.x;
          cell.y = pos.y;
          cell.scale.set(1);
          cell.alpha = 1;
          setCellSymbol(cell, lastGrid[c][r]);
        }
      }
    }
  }

  return { replay };
}
