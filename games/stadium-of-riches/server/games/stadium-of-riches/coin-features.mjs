import { COIN_SCATTER, SHIP_PRIZES } from './config.mjs';

export function shipPrizeForCoins(coinCount) {
  if (coinCount >= 5) return 'GRAND';
  if (coinCount >= 4) return 'MAJOR';
  if (coinCount >= 3) return 'MINOR';
  if (coinCount >= 1) return 'MINI';
  return null;
}

export function shipAwardCoins(coinCount, totalBet) {
  const tier = Math.min(4, Math.max(1, coinCount));
  const mult = SHIP_PRIZES[tier]?.mult ?? SHIP_PRIZES[1].mult;
  return mult * totalBet;
}

export function buildCoinScatterInlineWin(coinCount, totalBet) {
  const coins = shipAwardCoins(coinCount, totalBet);
  return {
    pattern: -1,
    symbol: COIN_SCATTER,
    count: coinCount,
    flags: 0,
    coins,
  };
}

export function coinPositions(reels) {
  const out = [];
  for (let col = 0; col < reels.length; col++) {
    for (let row = 0; row < reels[col].length; row++) {
      if (reels[col][row] === COIN_SCATTER) out.push({ col, row });
    }
  }
  return out;
}
