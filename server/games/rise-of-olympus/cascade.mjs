import {
  COLS,
  ROWS,
  MIN_CLUSTER,
  plantedWinRate,
  naturalWinRate,
  scatterFsSeedRateForDeal,
  isDemoWinBoostEnabled,
  PAY_SYMBOL_MIN,
  PAY_SYMBOL_MAX,
  randomWinSymbol,
  clusterPayCoins,
  INITIAL_MULTIPLIER_VALUE,
  isMultiplierSymbol,
  randomPaySymbolOrMultiplier,
  SCATTER_TEASE_RATE,
  SCATTER_LOSE_TEASE_RATE,
  SCATTER_TEASE_MAX,
} from './config.mjs';
import {
  cellIndex,
  cloneGrid,
  randomGrid,
  buildForceWinGrid,
  plantWinCluster,
  placeScatters,
  extractGridMultipliers,
  cloneMultValueGrid,
  syncMultValuesFromGrid,
  sumMultipliers,
  extractNewMultiplierLands,
} from './grid.mjs';
import { countScatters, FS_TRIGGER_MIN } from './freespin.mjs';
import {
  emptyUpgradeFlags,
  applyCascadeMultiplierUpgrades,
  markFreshMultiplierLands,
} from './multiplier.mjs';

const DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/** Orthogonal flood-fill cluster from (row,col). */
function collectCluster(grid, row, col, seen) {
  const sym = grid[row][col];
  const cells = [];
  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const k = cellIndex(r, c);
    if (seen.has(k) || grid[r][c] !== sym) continue;
    seen.add(k);
    cells.push(k);
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && !seen.has(cellIndex(nr, nc)) && grid[nr][nc] === sym) {
        stack.push([nr, nc]);
      }
    }
  }
  return { symbol: sym, cells };
}

/** All paying-symbol clusters of size >= MIN_CLUSTER. */
export function findClusters(grid) {
  const seen = new Set();
  const clusters = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const sym = grid[row][col];
      if (sym < PAY_SYMBOL_MIN || sym > PAY_SYMBOL_MAX) continue;
      const k = cellIndex(row, col);
      if (seen.has(k)) continue;
      const cluster = collectCluster(grid, row, col, seen);
      if (cluster.cells.length >= MIN_CLUSTER) clusters.push(cluster);
    }
  }
  return clusters;
}

/** Tumble refills never drop scatters (matches commercial cascade slots). */
function randomRefillSymbol() {
  return randomPaySymbolOrMultiplier();
}

/**
 * Remove cluster cells, drop symbols down, refill tops.
 * Multiplier symbols and values tumble with the column.
 * @returns {{ grid: number[][], multValues: number[][], refills: number[][] }}
 */
export function tumbleGrid(grid, removeIndices, multValues) {
  const next = cloneGrid(grid);
  const nextMult = cloneMultValueGrid(multValues);
  const remove = new Set(removeIndices);
  const refills = [];

  for (let col = 0; col < COLS; col++) {
    const remaining = [];
    const remainingMult = [];
    for (let row = 0; row < ROWS; row++) {
      if (!remove.has(cellIndex(row, col))) {
        remaining.push(next[row][col]);
        remainingMult.push(nextMult[row][col]);
      }
    }
    const newCount = ROWS - remaining.length;
    const incoming = [];
    for (let i = 0; i < newCount; i++) {
      const sym = randomRefillSymbol();
      incoming.push(sym);
    }
    for (let row = 0; row < ROWS; row++) {
      if (row < newCount) {
        const sym = incoming[row];
        next[row][col] = sym;
        nextMult[row][col] = isMultiplierSymbol(sym) ? INITIAL_MULTIPLIER_VALUE : 0;
      } else {
        next[row][col] = remaining[row - newCount];
        nextMult[row][col] = remainingMult[row - newCount];
      }
    }
    refills.push(incoming);
  }
  return { grid: next, multValues: nextMult, refills };
}

function applyRoundMultiplier(totalWin, sumMulti) {
  if (totalWin <= 0 || sumMulti <= 0) return totalWin;
  return totalWin * sumMulti;
}

/** FS seed or tease scatters after win planting — refills stay scatter-free. */
function applyInitialScatterLayout(grid, multValues, plantedCells) {
  if (Math.random() < scatterFsSeedRateForDeal()) {
    placeScatters(grid, multValues, FS_TRIGGER_MIN);
    return { scatterSeed: true, scatterTease: false };
  }
  const hasPlanted = plantedCells?.size > 0;
  const teaseRate = hasPlanted ? SCATTER_TEASE_RATE : SCATTER_LOSE_TEASE_RATE;
  if (Math.random() >= teaseRate) return { scatterSeed: false, scatterTease: false };
  const existing = countScatters(grid);
  if (existing >= FS_TRIGGER_MIN - 1) return { scatterSeed: false, scatterTease: false };
  const maxAdd = Math.min(SCATTER_TEASE_MAX, FS_TRIGGER_MIN - 1 - existing);
  if (maxAdd <= 0) return { scatterSeed: false, scatterTease: false };
  const n = 1 + Math.floor(Math.random() * maxAdd);
  placeScatters(grid, multValues, n, { exclude: hasPlanted ? plantedCells : null });
  return { scatterSeed: false, scatterTease: true };
}

/**
 * Full spin round: initial grid + cascade steps until no wins.
 * @returns {{ initialGrid, grid, multValues, steps, totalWin, multipliers, sumMulti, baseWin }}
 */
export function runCascadeRound(
  bet,
  { forceWin = false, goUltra = false, coins = 1, lastWinSymbol = null } = {}
) {
  const { grid: initialGridRaw, multValues: initialMultRaw } = randomGrid();
  let grid = cloneGrid(initialGridRaw);
  let multValues = cloneMultValueGrid(initialMultRaw);
  let upgradeFlags = emptyUpgradeFlags();

  let plantedCells = null;
  let plantedWinSymbol = null;
  if (forceWin) {
    ({ grid, multValues } = buildForceWinGrid({ withMultipliers: true, lastWinSymbol }));
  } else if (isDemoWinBoostEnabled() && Math.random() < plantedWinRate()) {
    const sym = randomWinSymbol(lastWinSymbol);
    plantedWinSymbol = sym;
    plantedCells = new Set(
      plantWinCluster(grid, multValues, sym, MIN_CLUSTER + Math.floor(Math.random() * 4))
    );
  } else if (Math.random() < naturalWinRate()) {
    const sym = randomWinSymbol(lastWinSymbol);
    plantedWinSymbol = sym;
    plantedCells = new Set(
      plantWinCluster(grid, multValues, sym, MIN_CLUSTER + Math.floor(Math.random() * 3))
    );
  }

  const { scatterSeed = false, scatterTease = false } =
    applyInitialScatterLayout(grid, multValues, plantedCells) ?? {};

  const initialGrid = cloneGrid(grid);

  multValues = syncMultValuesFromGrid(grid, multValues);
  const initialMultValues = cloneMultValueGrid(multValues);
  const initialLandedMultipliers = extractNewMultiplierLands(
    Array.from({ length: ROWS }, () => Array(COLS).fill(-1)),
    grid,
    multValues
  );

  const steps = [];
  let baseWin = 0;
  let roundId = 0;
  let safety = 0;

  while (safety++ < 12) {
    const clusters = findClusters(grid);
    if (!clusters.length) break;

    const wins = clusters.map((c) => ({
      symbol: c.symbol,
      pay: clusterPayCoins(c.symbol, c.cells.length, coins),
      flags: 0,
      positions: c.cells,
      multiplier: 1,
    }));
    const stepWin = wins.reduce((a, w) => a + w.pay, 0);
    baseWin += stepWin;

    const removeIndices = clusters.flatMap((c) => c.cells);
    const gridBeforeTumble = cloneGrid(grid);
    const tumbled = tumbleGrid(grid, removeIndices, multValues);
    grid = tumbled.grid;
    multValues = syncMultValuesFromGrid(grid, tumbled.multValues);
    upgradeFlags = markFreshMultiplierLands(grid, gridBeforeTumble, upgradeFlags);
    const upgradeResult = applyCascadeMultiplierUpgrades(grid, multValues, upgradeFlags, {
      goUltra,
    });
    multValues = upgradeResult.multValues;
    upgradeFlags = upgradeResult.upgradeFlags;
    const { upgradedCells } = upgradeResult;

    const stepMults = extractGridMultipliers(grid, multValues);
    const landedMultipliers = extractNewMultiplierLands(gridBeforeTumble, grid, multValues);
    steps.push({
      roundId: roundId++,
      wins,
      refills: tumbled.refills,
      grid: cloneGrid(grid),
      multipliers: stepMults,
      sumMulti: sumMultipliers(stepMults),
      fsMulti: 0,
      landedMultipliers,
      multiplierUpgrades: upgradedCells.map((u) => ({
        row: u.row,
        col: u.col,
        value: u.value,
        super: u.super ?? false,
      })),
    });
  }

  const multipliers = extractGridMultipliers(grid, multValues);
  const sumMulti = sumMultipliers(multipliers);
  const totalWin = applyRoundMultiplier(baseWin, sumMulti);

  let primaryWinSymbol = plantedWinSymbol;
  if (primaryWinSymbol == null && steps.length > 0 && steps[0].wins.length > 0) {
    primaryWinSymbol = steps[0].wins[0].symbol;
  }

  return {
    initialGrid,
    initialMultValues,
    initialLandedMultipliers,
    grid,
    multValues,
    steps,
    baseWin,
    totalWin,
    multipliers,
    sumMulti,
    scatterSeed,
    scatterTease,
    primaryWinSymbol,
  };
}
