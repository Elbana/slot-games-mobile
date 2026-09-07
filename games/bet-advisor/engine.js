/**
 * Rolling EV advisor for 3-outcome fruit betting game.
 * Symbols: watermelon ×2, fig ×2, 77 ×8
 */

export const SYMBOLS = {
  watermelon: {
    id: 'watermelon',
    label: 'Watermelon',
    short: 'WM',
    emoji: '🍉',
    payout: 2,
    breakeven: 0.5,
  },
  fig: {
    id: 'fig',
    label: 'Fig',
    short: 'Fig',
    emoji: '🍑',
    payout: 2,
    breakeven: 0.5,
  },
  '77': {
    id: '77',
    label: '77',
    short: '77',
    emoji: '77',
    payout: 8,
    breakeven: 0.125,
  },
};

export const SYMBOL_ORDER = ['watermelon', 'fig', '77'];

/** @typedef {'watermelon'|'fig'|'77'} SymbolId */

/**
 * @param {SymbolId[]} history Full history oldest → newest
 * @param {number} [windowSize=30]
 */
export function analyzeHistory(history, windowSize = 30) {
  const window = history.slice(-Math.max(1, windowSize));
  const n = window.length;

  /** @type {Record<SymbolId, number>} */
  const counts = { watermelon: 0, fig: 0, '77': 0 };
  for (const id of window) {
    if (counts[id] !== undefined) counts[id] += 1;
  }

  /** @type {Record<SymbolId, number>} */
  const rates = {};
  /** @type {Record<SymbolId, number>} */
  const ev = {};
  for (const id of SYMBOL_ORDER) {
    rates[id] = counts[id] / n;
    ev[id] = rates[id] * SYMBOLS[id].payout - 1;
  }

  const mode = detectMode(rates);
  const suggestion = buildSuggestion(rates, ev, mode, n);
  const coverBoth = analyzeCoverBoth(rates);

  return {
    windowSize: n,
    counts,
    rates,
    ev,
    mode,
    suggestion,
    coverBoth,
    bestValue: pickBestValue(ev),
    lastResult: history.length ? history[history.length - 1] : null,
  };
}

/** @param {Record<SymbolId, number>} rates */
function detectMode(rates) {
  const r77 = rates['77'];
  const rw = rates.watermelon;
  const rf = rates.fig;

  if (r77 >= 0.15) {
    return { id: '77_hot', label: '77 Hot', color: '#f59e0b' };
  }
  if (r77 < 0.1 && (rw >= 0.48 || rf >= 0.48)) {
    const hot = rw >= rf ? 'watermelon' : 'fig';
    return { id: 'fruit_hot', label: `${SYMBOLS[hot].label} Hot`, color: '#22c55e' };
  }
  if (r77 < 0.1 && rw >= 0.4 && rf >= 0.4) {
    return { id: 'fruit_mixed', label: 'Fruit Mixed', color: '#38bdf8' };
  }
  if (r77 >= 0.1 && r77 < 0.15) {
    return { id: '77_warm', label: '77 Warm', color: '#fb923c' };
  }
  return { id: 'unclear', label: 'Unclear', color: '#94a3b8' };
}

/**
 * @param {Record<SymbolId, number>} rates
 * @param {Record<SymbolId, number>} ev
 * @param {{ id: string, label: string, color: string }} mode
 * @param {number} sampleSize
 */
function buildSuggestion(rates, ev, mode, sampleSize) {
  const positive = SYMBOL_ORDER.filter((id) => ev[id] > 0).sort((a, b) => ev[b] - ev[a]);

  /** @type {SymbolId|'cover'|'skip'} */
  let action = 'skip';
  let confidence = 'low';
  let reason = '';
  let altAction = null;

  if (positive.length > 0) {
    action = positive[0];
    confidence = ev[action] > 0.2 ? 'high' : ev[action] > 0.05 ? 'medium' : 'low';
    reason = `${SYMBOLS[action].label} has positive EV (${formatPct(ev[action])}) in last ${sampleSize} rounds.`;
    if (positive.length > 1) {
      altAction = positive[1];
    }
  } else if (mode.id === '77_hot') {
    action = '77';
    confidence = 'medium';
    reason = '77 is hitting often (>15%). Best aggressive play despite mixed EV.';
  } else if (mode.id === 'fruit_hot') {
    action = rates.watermelon >= rates.fig ? 'watermelon' : 'fig';
    confidence = 'medium';
    reason = `${SYMBOLS[action].label} is the hotter fruit in a low-77 window.`;
  } else if (mode.id === 'fruit_mixed') {
    action = rates.watermelon >= rates.fig ? 'watermelon' : 'fig';
    confidence = 'low';
    reason = 'Both fruits active; pick the slightly hotter one or cover both.';
    altAction = 'cover';
  } else if (mode.id === '77_warm') {
    action = 'cover';
    confidence = 'low';
    reason = '77 is elevated (10–15%). Cover both fruits to limit damage.';
  } else {
    action = 'skip';
    confidence = 'low';
    reason = 'No clear edge. Wait or bet minimum until pattern clarifies.';
  }

  const betPct = betSizePercent(action, confidence, mode.id);

  return {
    action,
    altAction,
    confidence,
    reason,
    betPct,
    shouldSwitch: false,
  };
}

/** @param {Record<SymbolId, number>} ev */
function pickBestValue(ev) {
  let best = SYMBOL_ORDER[0];
  for (const id of SYMBOL_ORDER) {
    if (ev[id] > ev[best]) best = id;
  }
  return { id: best, ev: ev[best] };
}

/** @param {Record<SymbolId, number>} rates */
function analyzeCoverBoth(rates) {
  const lossRate = rates['77'];
  const evPerDollar = 1 - lossRate * 2;
  return {
    lossRate,
    evPerDollar,
    viable: lossRate < 0.12,
    note:
      lossRate < 0.08
        ? 'Safe hedge — 77 is rare.'
        : lossRate < 0.12
          ? 'Moderate hedge — some 77 risk.'
          : 'Risky hedge — 77 hitting too often.',
  };
}

function betSizePercent(action, confidence, modeId) {
  if (action === 'skip') return 0;
  if (action === 'cover') return 0.01;
  if (action === '77') return modeId === '77_hot' ? 0.02 : 0.01;
  if (confidence === 'high') return 0.03;
  if (confidence === 'medium') return 0.02;
  return 0.005;
}

/**
 * Compare previous vs current suggestion to flag strategy switches.
 * @param {ReturnType<typeof analyzeHistory>['suggestion']} prev
 * @param {ReturnType<typeof analyzeHistory>['suggestion']} next
 */
export function shouldSwitchStrategy(prev, next) {
  if (!prev) return false;
  return prev.action !== next.action;
}

/**
 * Session P&L if user followed suggestions.
 * @param {{ result: SymbolId, action: SymbolId|'cover'|'skip', betAmount: number, bankroll: number }[]} rounds
 */
export function simulateSessionPnL(rounds) {
  let pnl = 0;
  for (const r of rounds) {
    pnl += roundPnL(r.result, r.action, r.betAmount);
  }
  return pnl;
}

/** @param {SymbolId} result @param {SymbolId|'cover'|'skip'} action @param {number} bet */
export function roundPnL(result, action, bet) {
  if (action === 'skip' || bet <= 0) return 0;
  if (action === 'cover') {
    if (result === 'watermelon' || result === 'fig') return 0;
    return -bet * 2;
  }
  if (result === action) return bet * (SYMBOLS[action].payout - 1);
  return -bet;
}

export function formatPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export function formatRate(n) {
  return `${(n * 100).toFixed(1)}%`;
}

/** @param {SymbolId} id */
export function isValidSymbol(id) {
  return id in SYMBOLS;
}
