import {
  REELS,
  ADJACENT,
  FS_BASE_ROWS,
  FS_MAX_ROWS,
  FS_STRIPS,
  ELEPHANT_SYMBOL,
  WARHORN_SYMBOL,
  MULT_WILD_TIERS,
  WILD,
  PAYTABLE,
  TREASURE_SCATTER,
} from './config.mjs';
import { spinFromStrips, flattenVisible, buildAdjacent, evaluatePaylines } from './reel-spin.mjs';
import { sanitizeFlat } from './symbols.mjs';

export function createFsReelState() {
  return {
    rowCounts: Array(5).fill(FS_BASE_ROWS),
    frozenMask: Array.from({ length: 5 }, () => []),
    elephants: [],
    spinIndex: 0,
  };
}

function pickStrip(strips, col) {
  const strip = strips[col] ?? strips[0];
  const start = Math.floor(Math.random() * strip.length);
  const rows = FS_MAX_ROWS;
  const out = [];
  for (let i = 0; i < rows; i++) out.push(strip[(start + i) % strip.length]);
  return out;
}

export function evaluateElephantPay(reels, elephants, lineBet) {
  const positions = [...elephants];
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < (reels[col]?.length ?? 0); row++) {
      if (reels[col][row] === ELEPHANT_SYMBOL) positions.push({ col, row });
    }
  }
  const unique = [];
  const seen = new Set();
  for (const p of positions) {
    const k = `${p.col},${p.row}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(p);
    }
  }
  const count = unique.length;
  if (count < 3) return { wins: [], coins: 0, positions: unique };
  const tier = PAYTABLE[ELEPHANT_SYMBOL]?.[Math.min(count, 5)] ?? 0;
  const coins = tier * lineBet;
  const wins = [{ pattern: 0, symbol: ELEPHANT_SYMBOL, count, flags: 1, coins }];
  return { wins, coins, positions: unique };
}

function applyWarhorn(reels, elephants) {
  const moved = elephants.map((e) => ({ col: e.col, row: Math.max(0, e.row - 1) }));
  let gridCount = moved.length;
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < (reels[col]?.length ?? 0); row++) {
      if (reels[col][row] === ELEPHANT_SYMBOL) gridCount++;
    }
  }
  while (gridCount < 3) {
    const col = Math.floor(Math.random() * reels.length);
    const row = Math.floor(Math.random() * (reels[col]?.length ?? FS_BASE_ROWS));
    if (reels[col][row] !== ELEPHANT_SYMBOL && reels[col][row] !== WARHORN_SYMBOL) {
      reels[col][row] = ELEPHANT_SYMBOL;
      moved.push({ col, row });
      gridCount++;
    }
  }
  return moved;
}

function pickMultiplierWildTier() {
  return MULT_WILD_TIERS[Math.floor(Math.random() * MULT_WILD_TIERS.length)];
}

function fsCmdWindow(reels, rowCounts) {
  return reels.map((col, colIdx) => {
    const active = col.slice(0, rowCounts[colIdx] ?? FS_BASE_ROWS);
    const window = active.slice(Math.max(0, active.length - FS_BASE_ROWS));
    while (window.length < FS_BASE_ROWS) window.unshift(-1);
    return window;
  });
}

/**
 * @param {object} fsReels - session.footballFs.fsReels
 * @param {number[]} expandingSymbols
 */
export function spinRoundStadiumFs(bet, activeLines, fsReels, expandingSymbols = []) {
  const lineBet = Math.max(1, Math.round(bet / Math.max(1, activeLines)));
  const rowCounts = fsReels.rowCounts.map((n) => Math.min(FS_MAX_ROWS, Math.max(FS_BASE_ROWS, n)));

  for (let col = 0; col < rowCounts.length; col++) {
    rowCounts[col] = Math.min(FS_MAX_ROWS, rowCounts[col] + 1);
  }

  const reels = rowCounts.map((rows, col) => pickStrip(FS_STRIPS, col).slice(0, rows));

  const frozenMask = rowCounts.map((rows) => {
    const freezeCount = Math.floor(Math.random() * Math.min(2, rows));
    return Array.from({ length: rows }, (_, row) => row >= rows - freezeCount);
  });

  for (const e of fsReels.elephants ?? []) {
    if (e.col < reels.length && e.row < reels[e.col].length) {
      reels[e.col][e.row] = ELEPHANT_SYMBOL;
    }
  }

  let warhornHit = false;
  let multDelta = 0;
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (frozenMask[col][row]) continue;
      const r = Math.random();
      if (r < 0.04) {
        reels[col][row] = WARHORN_SYMBOL;
        warhornHit = true;
      } else if (r < 0.12) {
        reels[col][row] = ELEPHANT_SYMBOL;
      } else if (r < 0.18) {
        reels[col][row] = WILD;
        multDelta += pickMultiplierWildTier();
      }
    }
  }

  let elephants = fsReels.elephants ?? [];
  if (warhornHit) elephants = applyWarhorn(reels, elephants);

  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (reels[col][row] === ELEPHANT_SYMBOL) {
        if (!elephants.some((e) => e.col === col && e.row === row)) {
          elephants.push({ col, row });
        }
      }
    }
  }

  const clearGrid = frozenMask;
  const afterFallCounts = rowCounts.map((rows, col) => {
    const drop = frozenMask[col].filter(Boolean).length;
    return Math.max(FS_BASE_ROWS, rows - drop);
  });

  const { wins: lineWins, totalCoins: lineWin } = evaluatePaylines(
    reels.map((col, i) => col.slice(0, rowCounts[i])),
    lineBet,
    activeLines
  );

  const expandingWins = [];
  for (const sym of expandingSymbols) {
    let count = 0;
    for (const col of reels) for (const s of col) if (s === sym) count++;
    if (count >= 3) {
      const tier = PAYTABLE[sym]?.[Math.min(count, 5)] ?? 0;
      if (tier > 0) {
        expandingWins.push({ pattern: 0, symbol: sym, count, flags: 2, coins: tier * lineBet });
      }
    }
  }

  const elephantEval = evaluateElephantPay(reels, elephants, lineBet);
  const fsMultiplier = (fsReels.fsMultiplier ?? 0) + multDelta;
  const baseWin = lineWin + expandingWins.reduce((s, w) => s + w.coins, 0) + elephantEval.coins;
  const winAmount = baseWin * Math.max(1, fsMultiplier);

  fsReels.rowCounts = afterFallCounts;
  fsReels.frozenMask = clearGrid;
  fsReels.elephants = elephants.filter((e) => e.row < (afterFallCounts[e.col] ?? FS_BASE_ROWS));
  fsReels.fsMultiplier = fsMultiplier;
  fsReels.spinIndex = (fsReels.spinIndex ?? 0) + 1;

  /** @type {object[]} */
  const fsEvents = [];
  if (clearGrid.some((col) => col.some(Boolean))) {
    fsEvents.push({ type: 'grid_clear', rowCounts: [...rowCounts], frozen: clearGrid });
  }
  const newTop = reels.map((col) => col.map((sym, row) => (row === 0 ? sym : -1)));
  fsEvents.push({ type: 'grid_update', rowCounts: [...rowCounts], newTop });
  if (elephantEval.wins.length) {
    fsEvents.push({
      type: 'elephant_win',
      wins: elephantEval.wins,
      positions: elephantEval.positions.map((p) => [p.col, p.row]),
    });
  }
  if (multDelta > 0) {
    fsEvents.push({ type: 'fs_multiplier_update', delta: multDelta, value: fsMultiplier });
  }
  if (warhornHit) fsEvents.push({ type: 'warhorn' });

  let treasureScatters = 0;
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (reels[col][row] === TREASURE_SCATTER) treasureScatters++;
    }
  }

  return {
    reels,
    rowCounts,
    visible: sanitizeFlat(flattenVisible(fsCmdWindow(reels, rowCounts))),
    adjacent: buildAdjacent(REELS, ADJACENT, FS_STRIPS),
    wins: [...lineWins, ...expandingWins, ...elephantEval.wins],
    winAmount,
    lineWin: baseWin,
    treasureScatters,
    fsEvents,
    freeSpinMultiplier: fsMultiplier,
    multDelta,
    warhornHit,
  };
}

export { spinFromStrips };
