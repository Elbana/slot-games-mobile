import {
  MULTIPLIER_STAGES,
  GOLD_MULTIPLIER_STAGES,
  INITIAL_MULTIPLIER_VALUE,
  isMultiplierSymbol,
} from './config.mjs';
import { COLS, ROWS } from './config.mjs';

const MAX_STAGE = MULTIPLIER_STAGES.length - 1;

/** Stage index for a multiplier value (defaults to bronze x2). */
export function stageIndex(value) {
  const idx = MULTIPLIER_STAGES.indexOf(value);
  return idx >= 0 ? idx : 0;
}

export function stageValue(index) {
  return MULTIPLIER_STAGES[Math.max(0, Math.min(index, MAX_STAGE))];
}

export function nextStageValue(value) {
  return stageValue(stageIndex(value) + 1);
}

export function isMaxStage(value) {
  return stageIndex(value) >= MAX_STAGE;
}

export function emptyUpgradeFlags() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(false));
}

export function cloneUpgradeFlags(flags) {
  return flags.map((row) => [...row]);
}

/** Random super-upgrade target — at least one stage above current, up to x1000. */
export function superUpgradeValue(current) {
  const from = stageIndex(current) + 1;
  if (from > MAX_STAGE) return current;
  const goldStart = stageIndex(GOLD_MULTIPLIER_STAGES[0]);
  const to = Math.max(from, goldStart);
  const target = to + Math.floor(Math.random() * (MAX_STAGE - to + 1));
  return stageValue(target);
}

/**
 * After a winning cascade tumble, roll stage upgrades for on-grid multipliers.
 * @returns {{ multValues, upgradeFlags, upgradedCells: {row,col,value,godId,super}[] }}
 */
export function applyCascadeMultiplierUpgrades(grid, multValues, upgradeFlags, { goUltra = false } = {}) {
  const nextMult = multValues.map((row) => [...row]);
  const nextFlags = cloneUpgradeFlags(upgradeFlags);
  const upgradedCells = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isMultiplierSymbol(grid[row][col])) continue;
      const cur = nextMult[row][col] || INITIAL_MULTIPLIER_VALUE;
      if (isMaxStage(cur)) continue;

      let next = cur;
      let isSuper = false;

      if (nextFlags[row][col] && Math.random() < 0.15) {
        next = superUpgradeValue(cur);
        isSuper = next !== cur;
      } else if (goUltra || Math.random() < 0.35) {
        next = nextStageValue(cur);
      }

      if (next !== cur) {
        nextMult[row][col] = next;
        nextFlags[row][col] = true;
        upgradedCells.push({ row, col, value: next, super: isSuper });
      }
    }
  }

  return { multValues: nextMult, upgradeFlags: nextFlags, upgradedCells };
}

/** Mark newly landed multiplier cells (for GO ULTRA guaranteed first upgrade on next cascade). */
export function markFreshMultiplierLands(grid, prevGrid, upgradeFlags) {
  const nextFlags = cloneUpgradeFlags(upgradeFlags);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const sym = grid[row][col];
      if (!isMultiplierSymbol(sym)) continue;
      const prevSym = prevGrid?.[row]?.[col] ?? -1;
      if (isMultiplierSymbol(prevSym)) continue;
      nextFlags[row][col] = false;
    }
  }
  return nextFlags;
}
