import {
  REELS,
  ADJACENT,
  LINE_COUNT,
  PAY_SYMBOL_MIN,
  PAY_SYMBOL_MAX,
  PAYTABLE,
  PAYLINES,
  BASE_STRIPS,
  CASH_SYMBOL,
  PPS_MULTIPLIER,
  PPS_ENHANCER,
  PPS_MYSTERY,
  plantedWinRate,
} from './config.mjs';
import { sanitizeFlat } from './symbols.mjs';

const PPS_TYPES = [PPS_MULTIPLIER, PPS_ENHANCER, PPS_MYSTERY];

function pickStrip(strips, col) {
  const strip = strips[col] ?? strips[0];
  const start = Math.floor(Math.random() * strip.length);
  const rows = REELS[col] ?? 3;
  const out = [];
  for (let i = 0; i < rows; i++) out.push(strip[(start + i) % strip.length]);
  return out;
}

export function spinFromStrips(strips = BASE_STRIPS) {
  return REELS.map((_, col) => pickStrip(strips, col));
}

export function flattenVisible(reels) {
  const out = [];
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) out.push(reels[col][row]);
  }
  return out;
}

export function flatIndex(col, row, rows = REELS[0]) {
  return col * rows + row;
}

export function buildAdjacent(strips = BASE_STRIPS) {
  const out = [];
  for (let col = 0; col < REELS.length; col++) {
    const strip = strips[col] ?? strips[0];
    for (let i = 0; i < ADJACENT; i++) out.push(strip[Math.floor(Math.random() * strip.length)]);
    for (let i = 0; i < ADJACENT; i++) out.push(strip[Math.floor(Math.random() * strip.length)]);
  }
  return out;
}

function symAt(reels, reel, row) {
  return reels[reel]?.[row] ?? -1;
}

function isPaySymbol(sym) {
  return sym >= PAY_SYMBOL_MIN && sym <= PAY_SYMBOL_MAX;
}

function matchPayline(reels, pattern) {
  let paySym = null;
  let count = 0;
  for (let reel = 0; reel < pattern.length; reel++) {
    const sym = symAt(reels, reel, pattern[reel]);
    if (!isPaySymbol(sym)) break;
    if (paySym === null) paySym = sym;
    if (sym !== paySym) break;
    count++;
  }
  if (count < 3 || paySym === null) return null;
  return { symbol: paySym, count };
}

export function evaluatePaylines(reels, lineBet, activeLines = LINE_COUNT) {
  const wins = [];
  let totalCoins = 0;
  const lines = Math.min(activeLines, PAYLINES.length);

  for (let pattern = 0; pattern < lines; pattern++) {
    const match = matchPayline(reels, PAYLINES[pattern]);
    if (!match) continue;
    const tier = PAYTABLE[match.symbol]?.[match.count] ?? 0;
    if (tier <= 0) continue;
    const coins = tier * lineBet;
    wins.push({ pattern, symbol: match.symbol, count: match.count, flags: 0, coins });
    totalCoins += coins;
  }

  return { wins, totalCoins };
}

export function plantWinningReels() {
  const reels = spinFromStrips();
  const sym = PAY_SYMBOL_MIN + Math.floor(Math.random() * (PAY_SYMBOL_MAX - PAY_SYMBOL_MIN + 1));
  for (let col = 0; col < 3; col++) reels[col][1] = sym;
  return reels;
}

export function findCashCollections(reels) {
  const rows = REELS[0] ?? 3;
  const collections = [];
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (reels[col][row] === CASH_SYMBOL) {
        collections.push({
          col,
          row,
          pos: flatIndex(col, row, rows),
          ppsType: PPS_TYPES[Math.floor(Math.random() * PPS_TYPES.length)],
        });
      }
    }
  }
  return collections;
}

export function maybePlantCashCoin(reels, probability = 0.14) {
  if (Math.random() >= probability) return reels;
  const col = Math.floor(Math.random() * reels.length);
  const row = Math.floor(Math.random() * reels[col].length);
  if (reels[col][row] === CASH_SYMBOL) return reels;
  reels[col][row] = CASH_SYMBOL;
  return reels;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.forceWin]
 * @param {number} [opts.forceCashCount]
 */
export function spinRoundTot(bet, activeLines = LINE_COUNT, opts = {}) {
  const lines = Math.max(1, Math.min(activeLines, PAYLINES.length));
  const lineBet = Math.max(1, Math.round(bet / lines));
  let reels;
  if (opts.forceWin) {
    reels = plantWinningReels();
  } else if (Math.random() < plantedWinRate()) {
    reels = plantWinningReels();
  } else {
    reels = spinFromStrips();
  }

  maybePlantCashCoin(reels);
  if (opts.forceCashCount > 0) {
    let placed = 0;
    for (let col = 0; col < reels.length && placed < opts.forceCashCount; col++) {
      for (let row = 0; row < reels[col].length && placed < opts.forceCashCount; row++) {
        reels[col][row] = CASH_SYMBOL;
        placed++;
      }
    }
  }

  const { wins, totalCoins } = evaluatePaylines(reels, lineBet, lines);
  const collections = findCashCollections(reels);

  return {
    reels,
    visible: sanitizeFlat(flattenVisible(reels)),
    adjacent: buildAdjacent(),
    wins,
    winAmount: totalCoins,
    lineBet,
    collections,
  };
}
