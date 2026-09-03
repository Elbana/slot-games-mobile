/**
 * Ticker-driven grid animations for Thrones of Olympus.
 * Drop motion matches ref BlockAnimator (acceleration + sine bounce on land).
 */

import { DROP_PHYSICS, GRID, TUMBLE_PHYSICS } from './config.js';

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {number} durationMs
 * @param {(t: number) => void} onFrame
 */
export function animate(ticker, durationMs, onFrame) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      onFrame(easeOutCubic(t));
      if (t >= 1) {
        ticker.remove(step);
        resolve();
      }
    };
    ticker.add(step);
  });
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function spriteBaseScale(cell) {
  return cell.__sprite?.__baseScale ?? 1;
}

function spineBaseScale(cell) {
  return cell.__spine?.__baseScale ?? cell.__spine?.scale.x ?? 1;
}

function applyLandingSquash(cell, bounceT, impactStart = 0.72) {
  if (bounceT < impactStart) {
    cell.__sprite?.scale.set(spriteBaseScale(cell));
    const spineBase = spineBaseScale(cell);
    cell.__spine?.scale.set(spineBase);
    return;
  }
  const u = (bounceT - impactStart) / (1 - impactStart);
  const squash = 1 - Math.sin(u * Math.PI) * 0.16;
  const stretch = 1 + (1 - squash) * 0.4;
  if (cell.__sprite) {
    const base = spriteBaseScale(cell);
    cell.__sprite.scale.set(base * stretch, base * squash);
  }
  if (cell.__spine) {
    const base = spineBaseScale(cell);
    cell.__spine.scale.set(base * stretch, base * squash);
  }
}

/**
 * @param {import('pixi.js').Ticker} ticker
 * @param {number} fromRow
 * @param {number} targetRow
 * @param {number} cellH
 * @param {typeof DROP_PHYSICS} [physics]
 * @param {number} [startDelayMs]
 * @param {(state: { y: number, bounceT: number }) => void} [onFrame]
 */
export function runGravityDrop(ticker, fromRow, targetRow, cellH, physics, startDelayMs, onFrame, landBounce = true) {
  const p = physics ?? DROP_PHYSICS;
  const delay = startDelayMs ?? 0;

  if (fromRow >= targetRow) {
    onFrame?.({ y: targetRow * cellH, bounceT: 1 });
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let pos = fromRow;
    let velocity = 0;
    let startTime = null;
    let prevTime = 0;
    let bouncing = false;
    let bounceStart = 0;
    let bounceAmp = 0;

    const step = () => {
      const now = performance.now();
      if (startTime === null) {
        startTime = now;
        prevTime = now;
      }

      if (now - startTime < delay) return;

      if (bouncing) {
        const bt = (now - bounceStart) / p.bounceDuration;
        if (bt >= 1) {
          onFrame?.({ y: targetRow * cellH, bounceT: 1 });
          ticker.remove(step);
          resolve();
          return;
        }
        const overshoot = Math.abs(Math.sin(bt * Math.PI * p.bounceCount)) * (1 - bt) * bounceAmp;
        pos = targetRow - overshoot;
        onFrame?.({ y: pos * cellH, bounceT: bt });
        return;
      }

      const dt = Math.min(32, now - prevTime);
      prevTime = now;
      velocity += p.acceleration * dt;
      pos += velocity * dt;

      if (pos >= targetRow) {
        if (!landBounce) {
          onFrame?.({ y: targetRow * cellH, bounceT: 1 });
          ticker.remove(step);
          resolve();
          return;
        }
        bouncing = true;
        bounceAmp = Math.min(velocity * p.bounceScale, p.maxBounceAmplitude);
        bounceStart = now;
        pos = targetRow;
        onFrame?.({ y: pos * cellH, bounceT: 0 });
        return;
      }

      onFrame?.({ y: pos * cellH, bounceT: -1 });
    };

    ticker.add(step);
  });
}

/**
 * Drop one column's symbols from above (deal / spin landing).
 */
async function animateColumnDropOne(col, opts) {
  const {
    ticker,
    cells,
    layout,
    targetGrid,
    multGrid,
    paintCell,
    cellPos,
    rowH,
    getMult,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    playLandClip,
    shouldPlayLand,
    onSymbolLand,
    physics,
    speedMult = 1,
  } = opts;

  const blockDelay = Math.max(4, blockDelayMs / speedMult);
  /** @type {{ cell: import('pixi.js').Container, fromRow: number, toRow: number, sym: number }[]} */
  const motions = [];

  for (let r = 0; r < layout.rows; r++) {
    const mult = getMult?.(multGrid, col, r) ?? 0;
    paintCell(cells[col][r], targetGrid[col][r], mult);
    const pos = cellPos(col, r);
    cells[col][r].y = pos.y - rowH * (layout.rows + 2);
    cells[col][r].alpha = 1;
    cells[col][r].scale.set(1);
    cells[col][r].visible = true;
    motions.push({
      cell: cells[col][r],
      fromRow: -(layout.rows + 2 - r),
      toRow: r,
      sym: targetGrid[col][r],
    });
  }

  motions.sort((a, b) => b.toRow - a.toRow);

  await Promise.all(
    motions.map((m, idx) =>
      runGravityDrop(
        ticker,
        m.fromRow,
        m.toRow,
        rowH,
        physics,
        idx * blockDelay,
        (state) => {
          m.cell.y = state.y;
          if (state.bounceT >= 0) applyLandingSquash(m.cell, state.bounceT);
        },
        true
      ).then(async () => {
        m.cell.y = cellPos(col, m.toRow).y;
        const base = spriteBaseScale(m.cell);
        m.cell.__sprite?.scale.set(base);
        m.cell.__spine?.scale.set(spineBaseScale(m.cell));
        if (playLandClip && (shouldPlayLand?.(m.sym) ?? true)) await playLandClip(m.cell);
        onSymbolLand?.(m.sym, col, m.toRow);
      })
    )
  );
}

/**
 * Fall one column's current symbols off the bottom.
 */
async function animateColumnExitOne(col, opts) {
  const {
    ticker,
    cells,
    layout,
    cellPos,
    rowH,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    physics,
    speedMult = 1,
  } = opts;

  const blockDelay = Math.max(3, blockDelayMs / speedMult);
  const exitRow = layout.rows + 2;
  /** @type {{ cell: import('pixi.js').Container, fromRow: number }[]} */
  const motions = [];

  for (let r = 0; r < layout.rows; r++) {
    const cell = cells[col][r];
    if (!cell.__spine && !cell.__sprite) continue;
    cell.visible = true;
    cell.alpha = 1;
    cell.y = cellPos(col, r).y;
    motions.push({ cell, fromRow: r });
  }

  motions.sort((a, b) => b.fromRow - a.fromRow);

  await Promise.all(
    motions.map((m, idx) =>
      runGravityDrop(
        ticker,
        m.fromRow,
        exitRow,
        rowH,
        physics,
        idx * blockDelay,
        (state) => {
          m.cell.y = state.y;
          if (state.bounceT < 0) {
            const progress = (state.y / rowH - m.fromRow) / (exitRow - m.fromRow);
            m.cell.alpha = Math.max(0.3, 1 - progress * 0.45);
          } else {
            m.cell.alpha = Math.max(0, 1 - state.bounceT);
          }
        },
        false
      ).then(() => {
        m.cell.visible = false;
        m.cell.alpha = 0;
      })
    )
  );
}

/**
 * Spin transition — each column: current symbols fall out, then new ones drop in.
 * Fetches spin result while columns exit so there is no blank board pause.
 */
export async function animateSpinTransition(opts) {
  const {
    ticker,
    cells,
    layout,
    cellPos,
    rowH = GRID.rowPitch,
    getSpinData,
    paintCell,
    multGrid: initialMultGrid,
    targetGrid: initialTargetGrid,
    getMult,
    exitStaggerMs = DROP_PHYSICS.reelDelay,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    playLandClip,
    shouldPlayLand,
    onColumnStart,
    onColumnLand,
    onSymbolLand,
    speedMult = 1,
  } = opts;

  const exitStagger = Math.max(6, exitStaggerMs / speedMult);
  const exitPhysics = {
    ...DROP_PHYSICS,
    acceleration: DROP_PHYSICS.acceleration * 2.4,
  };
  const dropPhysics =
    speedMult > 1
      ? {
          ...DROP_PHYSICS,
          acceleration: DROP_PHYSICS.acceleration * speedMult,
          bounceDuration: Math.max(80, DROP_PHYSICS.bounceDuration / speedMult),
        }
      : DROP_PHYSICS;

  /** @type {Promise<{ targetGrid: number[][], multGrid?: number[][] | null }> | null} */
  let spinDataPromise = null;
  const ensureSpinData = () => {
    if (initialTargetGrid) {
      return Promise.resolve({ targetGrid: initialTargetGrid, multGrid: initialMultGrid ?? null });
    }
    if (!spinDataPromise) spinDataPromise = getSpinData();
    return spinDataPromise;
  };

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * exitStagger));

        await animateColumnExitOne(c, {
          ticker,
          cells,
          layout,
          cellPos,
          rowH,
          blockDelayMs,
          physics: exitPhysics,
          speedMult,
        });

        const { targetGrid, multGrid } = await ensureSpinData();

        onColumnStart?.(c);
        await animateColumnDropOne(c, {
          ticker,
          cells,
          layout,
          targetGrid,
          multGrid,
          paintCell,
          cellPos,
          rowH,
          getMult,
          blockDelayMs,
          playLandClip,
          shouldPlayLand,
          onSymbolLand,
          physics: dropPhysics,
          speedMult,
        });
        onColumnLand?.(c);
      })()
    )
  );
}

/**
 * Column-staggered symbol drop (deal / spin landing) with ref gravity physics.
 * @param {object} opts
 */
export async function animateColumnDrop(opts) {
  const {
    ticker,
    cells,
    layout,
    targetGrid,
    multGrid,
    paintCell,
    paintCellScroll,
    cellPos,
    cellH,
    rowH = cellH ?? GRID.rowPitch,
    getMult,
    staggerMs = DROP_PHYSICS.reelDelay,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    playLandClip,
    shouldPlayLand,
    onColumnStart,
    onColumnLand,
    onSymbolLand,
    speedMult = 1,
  } = opts;

  void paintCellScroll;

  const stagger = Math.max(8, staggerMs / speedMult);
  const physics =
    speedMult > 1
      ? {
          ...DROP_PHYSICS,
          acceleration: DROP_PHYSICS.acceleration * speedMult,
          bounceDuration: Math.max(80, DROP_PHYSICS.bounceDuration / speedMult),
        }
      : DROP_PHYSICS;

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * stagger));
        onColumnStart?.(c);
        await animateColumnDropOne(c, {
          ticker,
          cells,
          layout,
          targetGrid,
          multGrid,
          paintCell,
          cellPos,
          rowH,
          getMult,
          blockDelayMs,
          playLandClip,
          shouldPlayLand,
          onSymbolLand,
          physics,
          speedMult,
        });
        onColumnLand?.(c);
      })()
    )
  );
}

/**
 * Pre-spin clear — current symbols fall off the bottom (column stagger), then deal drops new ones.
 */
export async function animateColumnExit(opts) {
  const {
    ticker,
    cells,
    layout,
    cellPos,
    cellH,
    rowH = cellH ?? GRID.rowPitch,
    staggerMs = DROP_PHYSICS.reelDelay,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    onColumnStart,
    speedMult = 1,
  } = opts;

  const stagger = Math.max(6, staggerMs / speedMult);
  const exitPhysics = {
    ...DROP_PHYSICS,
    acceleration: DROP_PHYSICS.acceleration * 2.4,
  };

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * stagger));
        onColumnStart?.(c);
        await animateColumnExitOne(c, {
          ticker,
          cells,
          layout,
          cellPos,
          rowH,
          blockDelayMs,
          physics: exitPhysics,
          speedMult,
        });
      })()
    )
  );
}

/** @deprecated Use animateColumnExit + animateColumnDrop for spin transitions. */
export async function animateShuffle(opts) {
  const { ticker, cells, layout, cellPos, durationMs = 280, paintCellScroll } = opts;

  if (paintCellScroll) {
    for (let c = 0; c < layout.cols; c++) {
      for (let r = 0; r < layout.rows; r++) {
        paintCellScroll(cells[c][r]);
      }
    }
  }

  const rowH = GRID.cellH;
  await animate(ticker, durationMs, (t) => {
    const scroll = easeOutCubic(t);
    for (let c = 0; c < layout.cols; c++) {
      for (let r = 0; r < layout.rows; r++) {
        const cell = cells[c][r];
        const base = cellPos(c, r).y;
        const colLag = c * 0.04;
        const phase = (scroll * 2.8 + colLag + r * 0.12) % 1;
        cell.y = base - rowH * 0.35 + phase * rowH * 0.7;
        cell.alpha = 0.65 + 0.35 * (1 - Math.abs(phase - 0.5) * 2);
      }
    }
  });

  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      cells[c][r].y = cellPos(c, r).y;
      cells[c][r].alpha = 1;
      cells[c][r].rotation = 0;
    }
  }
}

/** Win highlight — pulse matched symbols only; board stays fully visible. */
export async function animateWinHighlight(opts) {
  const { ticker, cells, layout, positions, glowLayer, cellSize, durationMs = 680, playWinClip } = opts;

  glowLayer.removeChildren();
  /** @type {Promise<void>[]} */
  const winPlays = [];
  for (const [c, r] of positions) {
    const cell = cells[c][r];
    if (cell.__sprite) cell.__sprite.tint = 0xffffaa;
    if (playWinClip) winPlays.push(playWinClip(cell));
  }

  const highlightMs = durationMs > 0 ? durationMs : 0;

  if (highlightMs <= 0 && winPlays.length > 0) {
    await Promise.all(winPlays);
    await animate(ticker, 60, (t) => {
      glowLayer.alpha = 0.5 * (1 - t);
    });
  } else if (highlightMs > 0) {
    await Promise.all([
      animate(ticker, highlightMs, (t) => {
        const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.12;
        const wobble = Math.sin(t * Math.PI * 6) * 0.04;
        for (const [c, r] of positions) {
          cells[c][r].scale.set(pulse);
          cells[c][r].rotation = wobble;
        }
      }),
      ...winPlays,
    ]);
  } else if (winPlays.length > 0) {
    await Promise.all(winPlays);
  }

  for (const [c, r] of positions) {
    const cell = cells[c][r];
    cell.scale.set(1);
    cell.rotation = 0;
    if (cell.__sprite) cell.__sprite.tint = 0xffffff;
  }
  glowLayer.removeChildren();
}

/** Fade + shrink disperse (ref cluster remove) */
export async function animateRemove(opts) {
  const { ticker, cells, positions, durationMs = 280, cellPos } = opts;
  await animate(ticker, durationMs, (t) => {
    const ease = easeOutCubic(t);
    for (const [c, r] of positions) {
      const cell = cells[c][r];
      cell.alpha = 1 - ease;
      cell.scale.set(1 - ease * 0.72);
      cell.y = cell.y - ease * 6;
      cell.rotation = ease * 0.25;
    }
  });
  for (const [c, r] of positions) {
    const cell = cells[c][r];
    cell.visible = false;
    cell.alpha = 1;
    cell.scale.set(1);
    cell.rotation = 0;
    if (cellPos) cell.y = cellPos(c, r).y;
  }
}

/**
 * Match server tumbleGrid: survivors keep order and shift down, new symbols fill top rows.
 * @returns {{ toRow: number, fromRow: number, sym: number, isNew: boolean }[]}
 */
function planColumnTumbleMotions(col, layout, prevGrid, targetGrid, removed) {
  /** @type {{ sym: number, fromRow: number }[]} */
  const kept = [];
  for (let r = 0; r < layout.rows; r++) {
    if (removed.has(`${col},${r}`)) continue;
    kept.push({ sym: prevGrid[col][r], fromRow: r });
  }

  const newCount = layout.rows - kept.length;
  const startRow = newCount;
  /** @type {{ toRow: number, fromRow: number, sym: number, isNew: boolean }[]} */
  const motions = [];

  for (let i = 0; i < kept.length; i++) {
    const toRow = startRow + i;
    const fromRow = kept[i].fromRow;
    if (fromRow !== toRow) {
      motions.push({ toRow, fromRow, sym: kept[i].sym, isNew: false });
    }
  }

  for (let r = 0; r < newCount; r++) {
    motions.push({
      toRow: r,
      fromRow: -(layout.rows + 2 - r),
      sym: targetGrid[col][r],
      isNew: true,
    });
  }

  return motions;
}

/**
 * Per-column cascade tumble — matched cells vanish, survivors fall down, new symbols drop from top.
 */
export async function animateColumnTumble(opts) {
  const {
    ticker,
    cells,
    layout,
    prevGrid,
    targetGrid,
    removedPositions,
    multGrid,
    paintCell,
    paintCellScroll,
    cellPos,
    cellH,
    rowH = cellH ?? GRID.rowPitch,
    getMult,
    staggerMs = TUMBLE_PHYSICS.reelDelay,
    blockDelayMs = TUMBLE_PHYSICS.blockDelay,
    tumblePhysics = TUMBLE_PHYSICS,
    playLandClip,
    shouldPlayLand,
    onSymbolLand,
    speedMult = 1,
  } = opts;

  void paintCellScroll;

  const stagger = Math.max(4, staggerMs / speedMult);
  const blockDelay = Math.max(2, blockDelayMs / speedMult);
  const physics =
    speedMult > 1
      ? {
          ...tumblePhysics,
          acceleration: tumblePhysics.acceleration * speedMult,
          bounceDuration: Math.max(70, tumblePhysics.bounceDuration / speedMult),
        }
      : tumblePhysics;

  const removed = new Set(removedPositions.map(([c, r]) => `${c},${r}`));

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * stagger));

        const motions = planColumnTumbleMotions(c, layout, prevGrid, targetGrid, removed);
        const survivorMotions = motions.filter((m) => !m.isNew).sort((a, b) => b.toRow - a.toRow);
        const newMotions = motions.filter((m) => m.isNew).sort((a, b) => a.toRow - b.toRow);

        for (const m of survivorMotions) {
          const src = cells[c][m.fromRow];
          src.visible = true;
          src.alpha = 1;
          src.scale.set(1);
          src.rotation = 0;
          src.y = cellPos(c, m.fromRow).y;

          await runGravityDrop(
            ticker,
            m.fromRow,
            m.toRow,
            rowH,
            physics,
            0,
            (state) => {
              src.y = state.y;
              if (state.bounceT >= 0) applyLandingSquash(src, state.bounceT);
            },
            true
          );

          const dst = cells[c][m.toRow];
          const mult = getMult?.(multGrid, c, m.toRow) ?? 0;
          src.visible = false;
          src.y = cellPos(c, m.fromRow).y;
          src.scale.set(1);
          src.rotation = 0;
          const srcBase = spriteBaseScale(src);
          src.__sprite?.scale.set(srcBase);
          src.__spine?.scale.set(spineBaseScale(src));

          paintCell(dst, m.sym, mult, true);
          dst.y = cellPos(c, m.toRow).y;
          dst.visible = true;
          dst.alpha = 1;
        }

        for (const m of newMotions) {
          const cell = cells[c][m.toRow];
          const mult = getMult?.(multGrid, c, m.toRow) ?? 0;
          paintCell(cell, m.sym, mult);
          cell.visible = true;
          cell.alpha = 1;
          cell.scale.set(1);
          cell.rotation = 0;
          cell.y = cellPos(c, m.fromRow).y;
        }

        await Promise.all(
          newMotions.map((m, idx) => {
            const cell = cells[c][m.toRow];
            return runGravityDrop(
              ticker,
              m.fromRow,
              m.toRow,
              rowH,
              physics,
              idx * blockDelay,
              (state) => {
                cell.y = state.y;
                if (state.bounceT >= 0) applyLandingSquash(cell, state.bounceT);
              },
              true
            ).then(async () => {
              cell.y = cellPos(c, m.toRow).y;
              const base = spriteBaseScale(cell);
              cell.__sprite?.scale.set(base);
              cell.__spine?.scale.set(spineBaseScale(cell));
              if (playLandClip && (shouldPlayLand?.(m.sym) ?? true)) await playLandClip(cell);
              onSymbolLand?.(m.sym, c, m.toRow);
            });
          })
        );
      })()
    )
  );

  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const cell = cells[c][r];
      const sym = targetGrid[c][r];
      const mult = getMult?.(multGrid, c, r) ?? 0;
      if (cell.__sym !== sym) paintCell(cell, sym, mult);
      cell.y = cellPos(c, r).y;
      cell.visible = true;
      cell.alpha = 1;
      cell.scale.set(1);
      cell.rotation = 0;
    }
  }
}

export function resetCellVisuals(cells, layout, cellPos) {
  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const cell = cells[c][r];
      cell.visible = true;
      cell.alpha = 1;
      cell.scale.set(1);
      cell.rotation = 0;
      if (cellPos) cell.y = cellPos(c, r).y;
      if (cell.__sprite) {
        cell.__sprite.tint = 0xffffff;
        cell.__sprite.scale.set(spriteBaseScale(cell));
      }
      if (cell.__spine) {
        cell.__spine.alpha = 1;
        cell.__spine.scale.set(spineBaseScale(cell));
      }
    }
  }
}
