/**
 * Reel spin / stop — SOR clone column scroll + land clips.
 */

import { GRID, LAND_ANIM_SYMBOLS } from './config.js';

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {number} durationMs
 * @param {(t: number) => void} onFrame
 */
export function animate(ticker, durationMs, onFrame) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      onFrame(t);
      if (t >= 1) {
        ticker.remove(tick);
        resolve();
      }
    };
    ticker.add(tick);
  });
}

/**
 * @param {object} opts
 */
export async function animateReelSpin(opts) {
  const {
    ticker,
    cells,
    targetGrid,
    setCellSymbol,
    setCellSymbolScroll,
    cellPos,
    staggerMs,
    spinMs,
    stopMs,
    scrollInterval,
    playLandClip,
    landAnimSymbols,
  } = opts;
  const scrollSetCell = setCellSymbolScroll ?? setCellSymbol;
  const landSyms = landAnimSymbols ?? LAND_ANIM_SYMBOLS;
  const cols = cells.length;
  const rows = cells[0]?.length ?? 0;
  const pitch = GRID.rowPitch;

  for (let c = 0; c < cols; c++) {
    const colCells = cells[c];
    let scrollAcc = 0;
    let lastScroll = performance.now();
    let scrollOffset = 0;

    await animate(ticker, spinMs + c * staggerMs, () => {
      const now = performance.now();
      scrollAcc += now - lastScroll;
      lastScroll = now;

      while (scrollAcc >= scrollInterval) {
        scrollAcc -= scrollInterval;
        scrollOffset += pitch * 0.85;
        for (let r = 0; r < rows; r++) {
          scrollSetCell(colCells[r], Math.floor(Math.random() * 10));
        }
      }

      for (let r = 0; r < rows; r++) {
        const baseY = cellPos(c, r).y;
        const wrapped = scrollOffset % pitch;
        colCells[r].y = baseY + wrapped;
        colCells[r].alpha = 0.88 + Math.random() * 0.12;
      }
    });

    for (let r = 0; r < rows; r++) {
      setCellSymbol(colCells[r], targetGrid[c][r]);
      colCells[r].y = cellPos(c, r).y - pitch * 0.35;
      colCells[r].alpha = 1;
    }

    await animate(ticker, stopMs, (t) => {
      const ease = 1 - (1 - t) ** 3;
      for (let r = 0; r < rows; r++) {
        const cell = colCells[r];
        cell.y = cellPos(c, r).y - pitch * 0.35 * (1 - ease);
        cell.scale.set(1 + Math.sin(t * Math.PI) * 0.05);
      }
    });

    /** @type {Promise<void>[]} */
    const lands = [];
    for (let r = 0; r < rows; r++) {
      colCells[r].scale.set(1);
      colCells[r].y = cellPos(c, r).y;
      colCells[r].alpha = 1;
      const sym = targetGrid[c][r];
      if (landSyms.has(sym) && playLandClip) {
        lands.push(playLandClip(colCells[r]));
      }
    }
    if (lands.length) await Promise.all(lands);
  }
}

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {import('pixi.js').Container[][]} cells
 * @param {[number, number][]} positions
 * @param {number} durationMs
 * @param {(size: number) => import('pixi.js').Container | null} [createWinGlow]
 * @param {number} [cellSize]
 * @param {(cell: import('pixi.js').Container) => Promise<void>} [playWinClip]
 */
export async function animateWinHighlight(
  ticker,
  cells,
  positions,
  durationMs,
  createWinGlow,
  cellSize = GRID.cell,
  playWinClip
) {
  const set = new Set(positions.map(([c, r]) => `${c},${r}`));
  /** @type {Promise<void>[]} */
  const winPlays = [];

  for (const [c, r] of positions) {
    const cell = cells[c]?.[r];
    if (!cell) continue;
    if (createWinGlow) {
      const glow = createWinGlow(cellSize);
      if (glow) {
        glow.x = GRID.cell / 2;
        glow.y = GRID.cell / 2;
        cell.addChildAt(glow, 0);
        cell.__glow = glow;
      }
    }
    if (playWinClip) winPlays.push(playWinClip(cell));
  }

  const highlightPromise = animate(ticker, durationMs, (t) => {
    const pulse = 0.5 + Math.sin(t * Math.PI * 4) * 0.5;
    for (let c = 0; c < cells.length; c++) {
      for (let r = 0; r < cells[c].length; r++) {
        const cell = cells[c][r];
        cell.alpha = set.has(`${c},${r}`) ? 1 : 0.3 + (1 - t) * 0.35;
        if (cell.__glow) cell.__glow.alpha = 0.45 + pulse * 0.55;
      }
    }
  });

  await Promise.all([highlightPromise, ...winPlays]);

  for (const col of cells) {
    for (const cell of col) {
      cell.alpha = 1;
      if (cell.__glow) {
        cell.removeChild(cell.__glow);
        cell.__glow.destroy();
        cell.__glow = null;
      }
    }
  }
}
