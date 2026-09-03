/**
 * Ticker-driven grid animations for Thrones of Olympus.
 * Drop motion matches ref BlockAnimator (acceleration + sine bounce on land).
 */

import { DROP_PHYSICS, GRID } from './config.js';

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
export function runGravityDrop(ticker, fromRow, targetRow, cellH, physics, startDelayMs, onFrame) {
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

      if (pos > targetRow) {
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

  const stagger = Math.max(8, staggerMs / speedMult);
  const blockDelay = Math.max(4, blockDelayMs / speedMult);
  const physics =
    speedMult > 1
      ? {
          ...DROP_PHYSICS,
          acceleration: DROP_PHYSICS.acceleration * speedMult,
          bounceDuration: Math.max(80, DROP_PHYSICS.bounceDuration / speedMult),
        }
      : DROP_PHYSICS;

  /** @type {{ cell: import('pixi.js').Container, fromRow: number, toRow: number, sym: number, col: number }[]} */
  const motions = [];

  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const mult = getMult?.(multGrid, c, r) ?? 0;
      paintCell(cells[c][r], targetGrid[c][r], mult);
      const pos = cellPos(c, r);
      cells[c][r].y = pos.y - cellH * (layout.rows + 2);
      cells[c][r].alpha = 1;
      cells[c][r].scale.set(1);
      cells[c][r].visible = true;
      motions.push({
        cell: cells[c][r],
        fromRow: -(layout.rows + 2 - r),
        toRow: r,
        sym: targetGrid[c][r],
        col: c,
      });
    }
  }

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * stagger));
        onColumnStart?.(c);

        const colMotions = motions.filter((m) => m.col === c);
        /** bottom row drops first (ref: s from n-1 down to 0) */
        colMotions.sort((a, b) => b.toRow - a.toRow);

        await Promise.all(
          colMotions.map((m, idx) =>
            runGravityDrop(ticker, m.fromRow, m.toRow, cellH, physics, idx * blockDelay, (state) => {
              m.cell.y = state.y;
              if (state.bounceT >= 0) applyLandingSquash(m.cell, state.bounceT);
            }).then(async () => {
              m.cell.y = cellPos(c, m.toRow).y;
              const base = spriteBaseScale(m.cell);
              m.cell.__sprite?.scale.set(base);
              m.cell.__spine?.scale.set(spineBaseScale(m.cell));
              if (playLandClip && (shouldPlayLand?.(m.sym) ?? true)) await playLandClip(m.cell);
              onSymbolLand?.(m.sym, c, m.toRow);
            })
          )
        );

        onColumnLand?.(c);
      })()
    )
  );
}

/** Pre-spin shuffle — blurred symbols scroll vertically (ref Symbol_blurred_dummy). */
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

/** Win highlight pulse — dim non-winners; duration follows spine win clips */
export async function animateWinHighlight(opts) {
  const { ticker, cells, layout, positions, glowLayer, cellSize, durationMs = 680, playWinClip } = opts;
  const set = new Set(positions.map(([c, r]) => `${c},${r}`));

  glowLayer.removeChildren();
  /** @type {import('pixi.js').Container[]} */
  const glows = [];
  /** @type {Promise<void>[]} */
  const winPlays = [];
  for (const [c, r] of positions) {
    const cell = cells[c][r];
    const g = glowLayer.__makeGlow?.(cellSize) ?? null;
    if (g) {
      g.x = cell.x + cellSize / 2;
      g.y = cell.y + cellSize / 2;
      glowLayer.addChild(g);
      glows.push(g);
    }
    if (playWinClip) winPlays.push(playWinClip(cell));
  }

  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const cell = cells[c][r];
      if (set.has(`${c},${r}`)) {
        if (cell.__sprite) cell.__sprite.tint = 0xffffaa;
        cell.alpha = 1;
      } else {
        cell.alpha = 0.1;
        if (cell.__spine) cell.__spine.alpha = 0.1;
      }
    }
  }

  const highlightMs = durationMs > 0 ? durationMs : 0;

  if (highlightMs <= 0 && winPlays.length > 0) {
    await Promise.all(winPlays);
    await animate(ticker, 180, (t) => {
      glowLayer.alpha = 0.5 * (1 - t);
    });
  } else {
    await Promise.all([
      animate(ticker, highlightMs > 0 ? highlightMs : 680, (t) => {
        const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.12;
        const wobble = Math.sin(t * Math.PI * 6) * 0.04;
        for (const [c, r] of positions) {
          cells[c][r].scale.set(pulse);
          cells[c][r].rotation = wobble;
        }
        glowLayer.alpha = 0.35 + Math.sin(t * Math.PI * 5) * 0.5;
        for (const g of glows) {
          g.scale.set(0.8 + Math.sin(t * Math.PI * 7) * 0.25);
        }
      }),
      ...winPlays,
    ]);
  }
}

/** Fade + shrink disperse (ref cluster remove) */
export async function animateRemove(opts) {
  const { ticker, cells, positions, durationMs = 280 } = opts;
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
    cells[c][r].visible = false;
    cells[c][r].alpha = 1;
    cells[c][r].scale.set(1);
    cells[c][r].rotation = 0;
  }
}

/**
 * Per-column cascade tumble with gravity — survivors fall, new symbols drop from above.
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
    getMult,
    staggerMs = DROP_PHYSICS.reelDelay,
    blockDelayMs = DROP_PHYSICS.blockDelay,
    playLandClip,
    shouldPlayLand,
    onSymbolLand,
    speedMult = 1,
  } = opts;

  const stagger = Math.max(8, staggerMs / speedMult);
  const blockDelay = Math.max(4, blockDelayMs / speedMult);
  const physics =
    speedMult > 1
      ? {
          ...DROP_PHYSICS,
          acceleration: DROP_PHYSICS.acceleration * speedMult,
          bounceDuration: Math.max(80, DROP_PHYSICS.bounceDuration / speedMult),
        }
      : DROP_PHYSICS;

  const removed = new Set(removedPositions.map(([c, r]) => `${c},${r}`));

  await Promise.all(
    Array.from({ length: layout.cols }, (_, c) =>
      (async () => {
        if (c > 0) await new Promise((r) => setTimeout(r, c * stagger));

        /** @type {{ toRow: number, fromRow: number, sym: number, isNew: boolean }[]} */
        const motions = [];
        const kept = [];
        for (let r = 0; r < layout.rows; r++) {
          if (!removed.has(`${c},${r}`)) kept.push({ sym: prevGrid[c][r], fromRow: r });
        }
        const newCount = layout.rows - kept.length;
        const startRow = newCount;

        for (let i = 0; i < kept.length; i++) {
          motions.push({
            toRow: startRow + i,
            fromRow: kept[i].fromRow,
            sym: kept[i].sym,
            isNew: false,
          });
        }
        for (let r = 0; r < newCount; r++) {
          motions.push({
            toRow: r,
            fromRow: -(newCount - r),
            sym: targetGrid[c][r],
            isNew: true,
          });
        }

        for (const m of motions) {
          const cell = cells[c][m.toRow];
          const mult = getMult?.(multGrid, c, m.toRow) ?? 0;
          if (m.isNew) {
            if (paintCellScroll) paintCellScroll(cell);
            else paintCell(cell, m.sym, mult);
          } else if (m.fromRow !== m.toRow) {
            paintCell(cell, m.sym, mult);
            cells[c][m.fromRow].visible = false;
          }

          cell.visible = true;
          cell.alpha = 1;
          cell.scale.set(1);
          cell.rotation = 0;
          cell.y = cellPos(c, m.fromRow).y;
        }

        motions.sort((a, b) => b.toRow - a.toRow);

        await Promise.all(
          motions.map((m, idx) =>
            runGravityDrop(
              ticker,
              m.fromRow,
              m.toRow,
              cellH,
              physics,
              idx * blockDelay,
              (state) => {
                const cell = cells[c][m.toRow];
                cell.y = state.y;
                if (m.isNew && state.bounceT >= 0) applyLandingSquash(cell, state.bounceT);
              }
            ).then(async () => {
              const cell = cells[c][m.toRow];
              cell.y = cellPos(c, m.toRow).y;
              const base = spriteBaseScale(cell);
              cell.__sprite?.scale.set(base);
              cell.__spine?.scale.set(spineBaseScale(cell));
              if (m.isNew) {
                paintCell(cell, m.sym, getMult?.(multGrid, c, m.toRow) ?? 0);
                if (playLandClip && (shouldPlayLand?.(m.sym) ?? true)) await playLandClip(cell);
                onSymbolLand?.(m.sym, c, m.toRow);
              }
            })
          )
        );
      })()
    )
  );
}

export function resetCellVisuals(cells, layout) {
  for (let c = 0; c < layout.cols; c++) {
    for (let r = 0; r < layout.rows; r++) {
      const cell = cells[c][r];
      cell.visible = true;
      cell.alpha = 1;
      cell.scale.set(1);
      cell.rotation = 0;
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
