import {
  COLS,
  ROWS,
  MIN_CLUSTER,
  SYMBOL,
  INITIAL_MULTIPLIER_VALUE,
  isMultiplierSymbol,
  randomInitialGridSymbol,
  randomPaySymbolOrMultiplier,
  randomWinSymbol,
} from './config.mjs';

/** Column-major cell index (matches client TOP_TO_BOTTOM grid: col * rows + row). */
export function cellIndex(row, col) {
  return col * ROWS + row;
}

export function indexToRowCol(idx) {
  return { row: idx % ROWS, col: Math.floor(idx / ROWS) };
}

export function emptyMultValueGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export function cloneMultValueGrid(multValues) {
  return multValues.map((row) => [...row]);
}

/** Sync multiplier values with symbol ids on grid (column-major tail source). */
export function syncMultValuesFromGrid(grid, multValues = emptyMultValueGrid()) {
  const next = cloneMultValueGrid(multValues);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isMultiplierSymbol(grid[row][col])) {
        if (!next[row][col]) next[row][col] = INITIAL_MULTIPLIER_VALUE;
      } else {
        next[row][col] = 0;
      }
    }
  }
  return next;
}

export function setCellMultiplier(grid, multValues, row, col, symbol, value = INITIAL_MULTIPLIER_VALUE) {
  grid[row][col] = symbol;
  multValues[row][col] = isMultiplierSymbol(symbol) ? value : 0;
}

export function randomGrid() {
  const grid = [];
  const multValues = emptyMultValueGrid();
  for (let row = 0; row < ROWS; row++) {
    const line = [];
    for (let col = 0; col < COLS; col++) {
      const sym = randomInitialGridSymbol();
      line.push(sym);
      if (isMultiplierSymbol(sym)) multValues[row][col] = INITIAL_MULTIPLIER_VALUE;
    }
    grid.push(line);
  }
  return { grid, multValues };
}

const CLUSTER_DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function shufflePairs(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Place a connected paying-symbol cluster via random flood-fill.
 * Seed and growth order vary so wins don't always land in the same row band.
 * @param {Set<number>} [exclude] — cell indices that must not be overwritten.
 */
export function plantWinCluster(grid, multValues, sym, size = MIN_CLUSTER, exclude = null) {
  const target = Math.max(MIN_CLUSTER, Math.min(size, COLS * ROWS - 1));
  const startRow = Math.floor(Math.random() * ROWS);
  const startCol = Math.floor(Math.random() * COLS);
  const clusterSet = new Set();
  const placed = [];
  const queue = [[startRow, startCol]];

  while (placed.length < target && queue.length > 0) {
    const idx = Math.floor(Math.random() * queue.length);
    const [row, col] = queue.splice(idx, 1)[0];
    const k = cellIndex(row, col);
    if (clusterSet.has(k) || exclude?.has(k)) continue;

    clusterSet.add(k);
    grid[row][col] = sym;
    multValues[row][col] = 0;
    placed.push(k);

    const neighbors = [];
    for (const [dr, dc] of CLUSTER_DIRS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const nk = cellIndex(nr, nc);
      if (!clusterSet.has(nk) && !exclude?.has(nk)) neighbors.push([nr, nc]);
    }
    queue.push(...shufflePairs(neighbors));
  }

  if (placed.length < target) {
    for (let row = 0; row < ROWS && placed.length < target; row++) {
      for (let col = 0; col < COLS && placed.length < target; col++) {
        const k = cellIndex(row, col);
        if (clusterSet.has(k) || exclude?.has(k)) continue;
        clusterSet.add(k);
        grid[row][col] = sym;
        multValues[row][col] = 0;
        placed.push(k);
      }
    }
  }

  return placed;
}

/**
 * Optional second cluster on a different stone — more color variety per spin.
 * @param {Set<number>} primaryCells
 * @param {number} primarySymbol
 * @returns {Set<number> | null}
 */
export function tryPlantSecondaryCluster(grid, multValues, primaryCells, primarySymbol) {
  if (Math.random() > 0.32) return null;
  const sym = randomWinSymbol(primarySymbol);
  const size = MIN_CLUSTER + Math.floor(Math.random() * 4);
  const placed = plantWinCluster(grid, multValues, sym, size, primaryCells);
  return placed.length >= MIN_CLUSTER ? new Set(placed) : null;
}

/**
 * Place scatter symbols on random cells (optionally skipping a set of indices).
 * Multiplier cells are skipped. Returns how many scatters were placed.
 */
export function placeScatters(grid, multValues, count, { exclude = null } = {}) {
  const candidates = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = cellIndex(row, col);
      if (exclude?.has(idx)) continue;
      if (isMultiplierSymbol(grid[row][col])) continue;
      candidates.push([row, col]);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(count, candidates.length);
  for (let i = 0; i < n; i++) {
    const [row, col] = candidates[i];
    grid[row][col] = SYMBOL.SCATTER;
    multValues[row][col] = 0;
  }
  return n;
}

/**
 * Demo / ROO_FORCE_WIN layout: diverse background + one realistic cluster + optional god multipliers.
 */
export function buildForceWinGrid({ withMultipliers = true, lastWinSymbol = null } = {}) {
  const { grid, multValues } = randomGrid();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === SYMBOL.SCATTER) {
        grid[row][col] = randomPaySymbolOrMultiplier();
        multValues[row][col] = 0;
      }
    }
  }
  const sym = randomWinSymbol(lastWinSymbol);
  plantWinCluster(grid, multValues, sym, MIN_CLUSTER + Math.floor(Math.random() * 6));

  if (withMultipliers) {
    const gods = [SYMBOL.MULTIPLIER_HADES, SYMBOL.MULTIPLIER_ZEUS, SYMBOL.MULTIPLIER_POSEIDON];
    let placed = 0;
    for (let row = 0; row < ROWS && placed < 3; row++) {
      for (let col = 0; col < COLS && placed < 3; col++) {
        if (isMultiplierSymbol(grid[row][col])) continue;
        if (grid[row][col] === sym) continue;
        setCellMultiplier(grid, multValues, row, col, gods[placed % gods.length], INITIAL_MULTIPLIER_VALUE);
        placed++;
      }
    }
  }

  return { grid, multValues };
}

/** Multiplier tail values in column-major reel order (matches getMultiplierSymbols). */
export function extractGridMultipliers(grid, multValues = null) {
  const values = multValues ?? syncMultValuesFromGrid(grid);
  const mults = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (isMultiplierSymbol(grid[row][col])) {
        mults.push(values[row][col] || INITIAL_MULTIPLIER_VALUE);
      }
    }
  }
  return mults;
}

/** Column-major flat list for GameSpin command 1. */
export function flattenColumnMajor(grid) {
  const out = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) out.push(grid[row][col]);
  }
  return out;
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function sumMultipliers(multipliers) {
  return multipliers.reduce((a, b) => a + b, 0);
}

/** Client dk enum: Hades=0, Poseidon=1, Zeus=2. */
export function symbolToGodId(sym) {
  if (sym === SYMBOL.MULTIPLIER_HADES) return 0;
  if (sym === SYMBOL.MULTIPLIER_POSEIDON) return 1;
  if (sym === SYMBOL.MULTIPLIER_ZEUS) return 2;
  return 2;
}

/** God id for multiplier-land awards — prefers explicit god symbol over placeholder default. */
export function dominantGodId(grid) {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const sym = grid[row][col];
      if (sym >= SYMBOL.MULTIPLIER_HADES && sym <= SYMBOL.MULTIPLIER_ZEUS) {
        return symbolToGodId(sym);
      }
    }
  }
  return 2;
}

/** Multipliers that appeared on grid this step (initial land or cascade refill). */
export function extractNewMultiplierLands(prevGrid, grid, multValues) {
  const lands = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const sym = grid[row][col];
      if (!isMultiplierSymbol(sym)) continue;
      const prevSym = prevGrid?.[row]?.[col] ?? -1;
      if (isMultiplierSymbol(prevSym)) continue;
      lands.push({
        godId: symbolToGodId(sym),
        value: multValues[row][col] || INITIAL_MULTIPLIER_VALUE,
        col,
        row,
      });
    }
  }
  return lands;
}
