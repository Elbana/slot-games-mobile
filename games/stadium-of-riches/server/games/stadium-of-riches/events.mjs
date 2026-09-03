import {
  ROWS,
  PAYLINES,
  TREASURE_SCATTER,
  TREASURE_SCATTER_REELS,
  COIN_SCATTER,
  FS_WHEEL,
  winPayScale,
} from './config.mjs';
import { clientSymbol } from './symbols.mjs';
import { flatToClientGrid } from './grid.mjs';
import { coinPositions } from './coin-features.mjs';

function scalePay(coins) {
  if (coins <= 0) return 0;
  return Math.max(1, Math.round(coins * winPayScale()));
}

function positionsForLineWin(pattern, count) {
  /** @type {[number, number][]} */
  const positions = [];
  for (let reel = 0; reel < count; reel++) {
    positions.push([reel, PAYLINES[pattern][reel]]);
  }
  return positions;
}

function treasureScatterPositions(reels) {
  /** @type {[number, number][]} */
  const positions = [];
  for (const col of TREASURE_SCATTER_REELS) {
    for (let row = 0; row < (reels[col]?.length ?? 0); row++) {
      if (reels[col][row] === TREASURE_SCATTER) positions.push([col, row]);
    }
  }
  return positions;
}

function symbolPositions(reels, symbolId) {
  /** @type {[number, number][]} */
  const positions = [];
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < (reels[col]?.length ?? 0); row++) {
      if (reels[col][row] === symbolId) positions.push([col, row]);
    }
  }
  return positions;
}

function mapLineWins(wins, reels) {
  const lineWins = [];
  let total = 0;
  for (const w of wins) {
    if (w.pattern === -1) continue;
    const pay = scalePay(w.coins);
    total += pay;
    let positions;
    if (w.flags === 1 && w.symbol != null) {
      positions = symbolPositions(reels, w.symbol);
    } else if (w.flags === 2 && w.symbol != null) {
      positions = symbolPositions(reels, w.symbol);
    } else {
      positions = positionsForLineWin(w.pattern, w.count);
    }
    lineWins.push({
      lineIndex: w.pattern,
      symbol: clientSymbol(w.symbol),
      count: w.count,
      pay,
      positions,
    });
  }
  return { lineWins, total };
}

/**
 * @param {object} round
 * @param {object} ctx
 */
export function buildSpinEvents(round, ctx) {
  const {
    reels,
    wins = [],
    treasureScatters = 0,
    coinScatters = 0,
    fsEvents = [],
    fsTriggered = false,
    fsRetriggered = false,
    fsAwardAdded = 0,
    introScatterCount = 0,
    introAward = 0,
    introSymbol = null,
    freeSpinMultiplier = 0,
    wasInFreeSpins = false,
  } = ctx;

  /** @type {object[]} */
  const events = [];

  const grid = round.visible?.length
    ? flatToClientGrid(round.visible, ROWS)
    : flatToClientGrid([], ROWS);
  events.push({ type: 'deal', grid });

  const { lineWins, total: lineTotal } = mapLineWins(wins, reels ?? []);
  if (lineWins.length) {
    events.push({ type: 'line_win', wins: lineWins, totalWin: lineTotal });
  }

  const coinWin = wins.find((w) => w.pattern === -1);
  if (coinWin && coinScatters > 0) {
    const pay = scalePay(coinWin.coins);
    events.push({
      type: 'coin_win',
      count: coinScatters,
      pay,
      tier: coinScatters >= 5 ? 'GRAND' : coinScatters >= 4 ? 'MAJOR' : coinScatters >= 3 ? 'MINOR' : 'MINI',
      positions: coinPositions(reels).map((p) => [p.col, p.row]),
    });
  }

  if (treasureScatters >= 3) {
    events.push({
      type: 'scatter_show',
      count: treasureScatters,
      positions: treasureScatterPositions(reels),
    });
  }

  if (fsTriggered && introAward > 0) {
    const key = Math.min(6, Math.max(3, introScatterCount));
    const segments = FS_WHEEL[key] ?? FS_WHEEL[3];
    events.push({ type: 'wheel_spin', segments, result: introAward });
    if (introSymbol != null) {
      events.push({ type: 'expanding_symbol_pick', symbol: clientSymbol(introSymbol) });
    }
    events.push({ type: 'free_spins_awarded', count: introAward });
  } else if (fsRetriggered && fsAwardAdded > 0) {
    events.push({ type: 'free_spins_awarded', count: fsAwardAdded });
  }

  for (const ev of fsEvents) {
    events.push(ev);
  }

  if (wasInFreeSpins && freeSpinMultiplier > 0 && !fsEvents.some((e) => e.type === 'fs_multiplier_update')) {
    events.push({ type: 'fs_multiplier_update', value: freeSpinMultiplier });
  }

  return { events };
}
