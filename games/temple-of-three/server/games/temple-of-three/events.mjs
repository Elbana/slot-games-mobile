import { PAYLINES, PPS_LABELS, winPayScale } from './config.mjs';
import { flatToClientGrid } from './grid.mjs';

function scalePay(coins) {
  if (coins <= 0) return 0;
  return Math.max(1, Math.round(coins * winPayScale()));
}

function positionsForLine(pattern, count) {
  /** @type {[number, number][]} */
  const positions = [];
  for (let reel = 0; reel < count; reel++) positions.push([reel, PAYLINES[pattern][reel]]);
  return positions;
}

export function buildSpinEvents(round) {
  const { wins = [], collections = [], visible = [] } = round;
  /** @type {object[]} */
  const events = [{ type: 'deal', grid: flatToClientGrid(visible) }];

  const lineWins = [];
  let lineTotal = 0;
  for (const w of wins) {
    const pay = scalePay(w.coins);
    lineTotal += pay;
    lineWins.push({
      lineIndex: w.pattern,
      symbol: w.symbol,
      count: w.count,
      pay,
      positions: positionsForLine(w.pattern, w.count),
    });
  }

  if (lineWins.length) {
    events.push({ type: 'line_win', wins: lineWins, totalWin: lineTotal });
  }

  if (collections.length) {
    events.push({
      type: 'pot_collect',
      collections: collections.map((c) => ({
        col: c.col,
        row: c.row,
        pot: PPS_LABELS[c.ppsType] ?? 'Pot',
        ppsType: c.ppsType,
      })),
    });
  }

  return { events, totalWin: lineTotal };
}
