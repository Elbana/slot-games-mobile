import {
  REELS,
  ADJACENT,
  LINE_COUNT,
  WILD,
  PAY_SYMBOL_MIN,
  PAY_SYMBOL_MAX,
  PAYTABLE,
  SCATTER_PAYTABLE,
  TREASURE_SCATTER,
  COIN_SCATTER,
  TREASURE_SCATTER_REELS,
  PAYLINES,
  BASE_STRIPS,
  FS_STRIPS,
} from './config.mjs';
import { sanitizeFlat, sanitizeSymbol } from './symbols.mjs';

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

export function buildAdjacent(reelsSpec = REELS, adjacent = ADJACENT, strips = BASE_STRIPS) {
  const out = [];
  for (let col = 0; col < reelsSpec.length; col++) {
    const strip = strips[col] ?? strips[0];
    for (let i = 0; i < adjacent; i++) out.push(sanitizeSymbol(strip[Math.floor(Math.random() * strip.length)]));
    for (let i = 0; i < adjacent; i++) out.push(sanitizeSymbol(strip[Math.floor(Math.random() * strip.length)]));
  }
  return out;
}

function symAt(reels, reel, row) {
  return reels[reel]?.[row] ?? -1;
}

function isWild(sym) {
  return sym === WILD;
}

function isPaySymbol(sym) {
  return sym >= PAY_SYMBOL_MIN && sym <= PAY_SYMBOL_MAX;
}

function matchPayline(reels, pattern) {
  let paySym = null;
  let count = 0;
  for (let reel = 0; reel < pattern.length; reel++) {
    const sym = symAt(reels, reel, pattern[reel]);
    if (isWild(sym)) {
      count++;
      continue;
    }
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
    const tier = PAYTABLE[match.symbol]?.[Math.min(match.count, PAYTABLE[match.symbol].length - 1)] ?? 0;
    if (tier <= 0) continue;
    const coins = tier * lineBet;
    wins.push({ pattern, symbol: match.symbol, count: match.count, flags: 0, coins });
    totalCoins += coins;
  }

  return { wins, totalCoins };
}

export function countSymbol(reels, symbolId) {
  let n = 0;
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (reels[col][row] === symbolId) n++;
    }
  }
  return n;
}

export function countTreasureScatters(reels) {
  let n = 0;
  for (const col of TREASURE_SCATTER_REELS) {
    for (let row = 0; row < (reels[col]?.length ?? 0); row++) {
      if (reels[col][row] === TREASURE_SCATTER) n++;
    }
  }
  return n;
}

export function evaluateScatterPay(reels, lineBet) {
  const count = countSymbol(reels, TREASURE_SCATTER);
  if (count < 3) return 0;
  const tier = SCATTER_PAYTABLE[Math.min(count, SCATTER_PAYTABLE.length - 1)] ?? 0;
  return tier * lineBet;
}

export function plantWinningReels() {
  const reels = spinFromStrips();
  const sym = 5;
  for (let col = 0; col < 3; col++) reels[col][1] = sym;
  return reels;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.inFreeSpins]
 * @param {boolean} [opts.forceWin]
 * @param {number} [opts.forceScatterCount]
 * @param {number} [opts.forceCoinCount]
 */
export function spinRoundStadium(bet, activeLines = LINE_COUNT, opts = {}) {
  const lines = Math.max(1, Math.min(activeLines, PAYLINES.length));
  const lineBet = Math.max(1, Math.round(bet / lines));
  const strips = opts.inFreeSpins ? FS_STRIPS : BASE_STRIPS;
  let reels;
  if (opts.forceWin) {
    reels = plantWinningReels();
  } else if (Math.random() < 0.3 && !opts.inFreeSpins) {
    reels = plantWinningReels();
  } else {
    reels = spinFromStrips(strips);
  }

  if (opts.forceScatterCount >= 3 && !opts.inFreeSpins) {
    const cols = [...TREASURE_SCATTER_REELS];
    for (let i = 0; i < Math.min(opts.forceScatterCount, cols.length); i++) {
      reels[cols[i]][1] = TREASURE_SCATTER;
    }
    for (let col = 0; col < reels.length; col++) {
      for (let row = 0; row < reels[col].length; row++) {
        if (reels[col][row] === COIN_SCATTER) reels[col][row] = PAY_SYMBOL_MIN;
      }
    }
  }

  if (opts.forceCoinCount > 0 && !opts.inFreeSpins) {
    for (let col = 0; col < reels.length; col++) {
      for (let row = 0; row < reels[col].length; row++) {
        if (reels[col][row] === COIN_SCATTER) reels[col][row] = PAY_SYMBOL_MIN;
      }
    }
    let placed = 0;
    for (let col = 0; col < reels.length && placed < opts.forceCoinCount; col++) {
      for (let row = 0; row < reels[col].length && placed < opts.forceCoinCount; row++) {
        if (reels[col][row] !== TREASURE_SCATTER) {
          reels[col][row] = COIN_SCATTER;
          placed++;
        }
      }
    }
  }

  const { wins, totalCoins: lineWin } = evaluatePaylines(reels, lineBet, lines);
  const scatterPay = opts.inFreeSpins ? 0 : evaluateScatterPay(reels, lineBet);
  const treasureScatters = opts.inFreeSpins ? 0 : countTreasureScatters(reels);
  const coinScatters = opts.inFreeSpins ? 0 : countSymbol(reels, COIN_SCATTER);
  const winAmount = lineWin + scatterPay;

  return {
    reels,
    visible: sanitizeFlat(flattenVisible(reels)),
    adjacent: buildAdjacent(REELS, ADJACENT, strips),
    wins,
    winAmount,
    lineWin,
    scatterPay,
    lineBet,
    treasureScatters,
    coinScatters,
    numFeatures: 0,
  };
}
