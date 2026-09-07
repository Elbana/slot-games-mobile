import {
  SYMBOLS,
  SYMBOL_ORDER,
  analyzeHistory,
  formatPct,
  formatRate,
  roundPnL,
  shouldSwitchStrategy,
} from './engine.js';

const STORAGE_KEY = 'bet-advisor-session-v1';

/** @typedef {'watermelon'|'fig'|'77'} SymbolId */

const state = {
  phase: 'setup',
  history: /** @type {SymbolId[]} */ ([]),
  windowSize: 30,
  bankroll: 1000,
  sessionLog: /** @type {object[]} */ ([]),
  sessionPnL: 0,
  prevSuggestion: null,
  lastAnalysis: null,
};

const el = {
  setupScreen: document.getElementById('setup-screen'),
  liveScreen: document.getElementById('live-screen'),
  setupHistory: document.getElementById('setup-history'),
  liveHistory: document.getElementById('live-history'),
  setupCount: document.getElementById('setup-count'),
  liveCount: document.getElementById('live-count'),
  btnStart: document.getElementById('btn-start'),
  btnUndo: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.btn-undo')),
  btnClearSetup: document.getElementById('btn-clear-setup'),
  btnResetSession: document.getElementById('btn-reset-session'),
  recCard: document.getElementById('rec-card'),
  recAction: document.getElementById('rec-action'),
  recBet: document.getElementById('rec-bet'),
  recMode: document.getElementById('rec-mode'),
  recConfidence: document.getElementById('rec-confidence'),
  recReason: document.getElementById('rec-reason'),
  recBestValue: document.getElementById('rec-best-value'),
  recCover: document.getElementById('rec-cover'),
  evList: document.getElementById('ev-list'),
  statRounds: document.getElementById('stat-rounds'),
  statPnL: document.getElementById('stat-pnl'),
  statWinRate: document.getElementById('stat-winrate'),
  statFollowed: document.getElementById('stat-followed'),
  sessionLog: document.getElementById('session-log'),
  inputBankroll: document.getElementById('input-bankroll'),
  inputWindow: document.getElementById('input-window'),
  switchBanner: document.getElementById('switch-banner'),
  setupPreview: document.getElementById('setup-preview'),
  setupRecAction: document.getElementById('setup-rec-action'),
  setupRecReason: document.getElementById('setup-rec-reason'),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch {
    /* ignore */
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      phase: state.phase,
      history: state.history,
      windowSize: state.windowSize,
      bankroll: state.bankroll,
      sessionLog: state.sessionLog,
      sessionPnL: state.sessionPnL,
    }),
  );
}

function chipHtml(id, isLatest = false) {
  const sym = SYMBOLS[id];
  const cls = id === '77' ? 'seventy-seven' : id;
  const content = id === '77' ? '77' : sym.emoji;
  return `<div class="ba-chip ${cls}${isLatest ? ' latest' : ''}" title="${sym.label}">${content}</div>`;
}

function renderHistoryGrid(container, history) {
  if (!history.length) {
    container.innerHTML = '<div class="ba-empty">Tap symbols below to add history (oldest → newest)</div>';
    return;
  }
  const items = [...history].reverse().map((id, i) => chipHtml(id, i === 0));
  container.innerHTML = items.join('');
}

function actionLabel(action) {
  if (action === 'skip') return '⏸ Sit Out';
  if (action === 'cover') return '🍉+🍑 Cover Both';
  return `${SYMBOLS[action].emoji} ${SYMBOLS[action].label}`;
}

function renderEvList(analysis) {
  const maxAbs = Math.max(...SYMBOL_ORDER.map((id) => Math.abs(analysis.ev[id])), 0.01);
  el.evList.innerHTML = SYMBOL_ORDER.map((id) => {
    const ev = analysis.ev[id];
    const rate = analysis.rates[id];
    const pct = Math.min(100, (Math.abs(ev) / maxAbs) * 100);
    const pos = ev >= 0;
    return `
      <div class="ba-ev-row">
        <span>${SYMBOLS[id].emoji} ${SYMBOLS[id].short}</span>
        <div class="ba-ev-bar-wrap">
          <div class="ba-ev-bar ${pos ? 'pos' : 'neg'}" style="width:${pct}%"></div>
        </div>
        <span class="ba-ev-val ${pos ? 'pos' : 'neg'}">${formatPct(ev)}</span>
      </div>
      <div class="ba-ev-row" style="margin-top:-4px;font-size:0.72rem;color:var(--ba-muted)">
        <span></span>
        <span>Hit ${formatRate(rate)} · ${SYMBOLS[id].payout}×</span>
        <span></span>
      </div>`;
  }).join('');
}

function updateAnalysis() {
  const analysis = analyzeHistory(state.history, state.windowSize);
  const { suggestion, mode, bestValue, coverBoth } = analysis;

  const switched = shouldSwitchStrategy(state.prevSuggestion, suggestion);
  if (switched && state.phase === 'live') {
    el.switchBanner.hidden = false;
    el.switchBanner.textContent = `Strategy switch: ${actionLabel(state.prevSuggestion?.action)} → ${actionLabel(suggestion.action)}`;
    el.recCard.classList.add('switch');
  } else {
    el.switchBanner.hidden = true;
    el.recCard.classList.remove('switch');
  }

  const betAmount = Math.round(state.bankroll * suggestion.betPct);

  el.recAction.textContent = actionLabel(suggestion.action);
  el.recBet.textContent =
    suggestion.action === 'skip'
      ? 'No bet recommended'
      : suggestion.action === 'cover'
        ? `$${betAmount * 2} total ($${betAmount} each fruit)`
        : `$${betAmount} (${(suggestion.betPct * 100).toFixed(1)}% bankroll)`;
  el.recMode.textContent = mode.label;
  el.recMode.style.background = `${mode.color}33`;
  el.recMode.style.color = mode.color;
  el.recConfidence.textContent = `${suggestion.confidence} confidence`;
  el.recConfidence.className = `ba-badge ${suggestion.confidence}`;
  el.recReason.textContent = suggestion.reason;
  el.recBestValue.textContent = `${SYMBOLS[bestValue.id].emoji} ${SYMBOLS[bestValue.id].label} (${formatPct(bestValue.ev)} EV)`;
  el.recCover.textContent = coverBoth.note;

  renderEvList(analysis);

  state.lastAnalysis = analysis;
  state.prevSuggestion = { ...suggestion };

  if (state.phase === 'setup') {
    const show = state.history.length >= 3;
    el.setupPreview.hidden = !show;
    if (show) {
      el.setupRecAction.textContent = actionLabel(suggestion.action);
      el.setupRecReason.textContent = `${suggestion.reason} Best value: ${SYMBOLS[bestValue.id].label} (${formatPct(bestValue.ev)}).`;
    }
  }
}

function updateStats() {
  el.setupCount.textContent = String(state.history.length);
  el.liveCount.textContent = String(state.history.length);

  const sessionOnly = state.sessionLog.length;
  const wins = state.sessionLog.filter((r) => r.pnl > 0).length;
  el.statRounds.textContent = String(sessionOnly);
  el.statPnL.textContent = (state.sessionPnL >= 0 ? '+' : '') + state.sessionPnL.toFixed(0);
  el.statPnL.parentElement.className = `ba-stat ${state.sessionPnL >= 0 ? 'pos' : 'neg'}`;
  el.statWinRate.textContent = sessionOnly ? `${Math.round((wins / sessionOnly) * 100)}%` : '—';
  el.statFollowed.textContent = String(sessionOnly);

  el.sessionLog.innerHTML = state.sessionLog.length
    ? [...state.sessionLog]
        .reverse()
        .slice(0, 20)
        .map(
          (r) =>
            `<div class="ba-log-item"><span>R${r.round}: ${actionLabel(r.action)} → ${SYMBOLS[r.result].emoji}</span><span class="${r.pnl >= 0 ? 'pos' : 'neg'}">${r.pnl >= 0 ? '+' : ''}${r.pnl}</span></div>`,
        )
        .join('')
    : '<div class="ba-empty">Session bets appear here</div>';
}

function render() {
  renderHistoryGrid(el.setupHistory, state.history);
  renderHistoryGrid(el.liveHistory, state.history);
  el.btnStart.disabled = state.history.length < 3;
  el.inputBankroll.value = String(state.bankroll);
  el.inputWindow.value = String(state.windowSize);
  updateAnalysis();
  updateStats();
  el.setupScreen.classList.toggle('active', state.phase === 'setup');
  el.liveScreen.classList.toggle('active', state.phase === 'live');
  saveState();
}

/** @param {SymbolId} id */
function addResult(id) {
  state.history.push(id);

  if (state.phase === 'live' && state.lastAnalysis) {
    const suggestion = state.lastAnalysis.suggestion;
    const betUnit = Math.round(state.bankroll * suggestion.betPct);
    const pnl = roundPnL(id, suggestion.action, betUnit);
    state.sessionPnL += pnl;
    state.sessionLog.push({
      round: state.sessionLog.length + 1,
      result: id,
      action: suggestion.action,
      bet: betUnit,
      pnl,
    });
  }

  updateAnalysis();
  updateStats();
  renderHistoryGrid(el.setupHistory, state.history);
  renderHistoryGrid(el.liveHistory, state.history);
  saveState();
}

function undoLast() {
  if (!state.history.length) return;
  state.history.pop();
  if (state.phase === 'live' && state.sessionLog.length) {
    const last = state.sessionLog.pop();
    if (last) state.sessionPnL -= last.pnl;
  }
  render();
}

function clearHistory() {
  state.history = [];
  state.sessionLog = [];
  state.sessionPnL = 0;
  state.prevSuggestion = null;
  render();
}

function startSession() {
  if (state.history.length < 3) return;
  state.phase = 'live';
  state.sessionLog = [];
  state.sessionPnL = 0;
  state.prevSuggestion = null;
  updateAnalysis();
  render();
}

function resetAll() {
  state.phase = 'setup';
  state.history = [];
  state.sessionLog = [];
  state.sessionPnL = 0;
  state.prevSuggestion = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function bindSymbolButtons(container, enabled = true) {
  container.querySelectorAll('.ba-symbol-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!enabled && state.phase !== 'setup' && state.phase !== 'live') return;
      addResult(/** @type {SymbolId} */ (btn.dataset.id));
    });
  });
}

function init() {
  loadState();
  bindSymbolButtons(document);

  el.btnStart.addEventListener('click', startSession);
  el.btnUndo.forEach((btn) => btn.addEventListener('click', undoLast));
  el.btnClearSetup.addEventListener('click', clearHistory);
  el.btnResetSession.addEventListener('click', () => {
    if (confirm('Reset entire session and history?')) resetAll();
  });

  el.inputBankroll.addEventListener('change', () => {
    state.bankroll = Math.max(1, Number(el.inputBankroll.value) || 1000);
    render();
  });

  el.inputWindow.addEventListener('change', () => {
    state.windowSize = Math.max(5, Math.min(200, Number(el.inputWindow.value) || 30));
    render();
  });

  render();
}

init();
