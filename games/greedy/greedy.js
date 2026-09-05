import {
  lotteryInit,
  betState,
  periodList,
  oddList,
  placeBet,
  oddsMap,
  LotteryApiError,
} from '/shared/lottery/api.js';

const ASSET = '/lottery/greedy';
const BOX_ASSET = '/lottery/petsbeasts';
const GAME_ID = 'greedy';

/** 8 wheel slots — same layout positions as Pets & Beasts */
const FOODS = [
  { id: 'BIGO_GREEDY_HOT_DOGS', name: 'Hot Dogs' },
  { id: 'BIGO_GREEDY_KEBABS', name: 'Kebabs' },
  { id: 'BIGO_GREEDY_CHICKEN_LEGS', name: 'Chicken' },
  { id: 'BIGO_GREEDY_BEEF', name: 'Beef' },
  { id: 'BIGO_GREEDY_CARROTS', name: 'Carrots' },
  { id: 'BIGO_GREEDY_CORN', name: 'Corn' },
  { id: 'BIGO_GREEDY_CABBAGE', name: 'Cabbage' },
  { id: 'BIGO_GREEDY_TOMATO', name: 'Tomato' },
];

const CHIPS = [2, 10, 50, 100, 1000];

/** History icon ring color by food group (matches original) */
const FOOD_GROUP = {
  BIGO_GREEDY_HOT_DOGS: 'pizza',
  BIGO_GREEDY_KEBABS: 'salad',
  BIGO_GREEDY_CHICKEN_LEGS: 'salad',
  BIGO_GREEDY_BEEF: 'pizza',
  BIGO_GREEDY_CARROTS: 'pizza',
  BIGO_GREEDY_CORN: 'salad',
  BIGO_GREEDY_CABBAGE: 'salad',
  BIGO_GREEDY_TOMATO: 'pizza',
};

let config = null;
let sessionId = localStorage.getItem(`lottery-session-${GAME_ID}`) || '';
let selectedChip = CHIPS[0];
let odds = {};
let spinIndex = 0;
let spinTimer = null;
let lastShownResultKey = '';
let resultTimer = null;
let prevStage = null;
let isFirstTick = true;
/** @type {Record<string, number>} pending bets this round (UI only) */
const pending = {};

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function img(code) {
  return `${ASSET}/${code}.png`;
}

function periodShort(period) {
  if (!period) return '--';
  return String(Number(String(period).slice(-4)));
}

function buildArena() {
  const arena = $('arena');
  FOODS.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = `animal-item animal-item-${i}`;
    el.dataset.code = f.id;
    el.innerHTML = `
      <img class="card-bg" src="${BOX_ASSET}/box-default.png" alt="" />
      <img class="animal-img no-bet" src="${img(f.id)}" alt="${f.name}" />
      <div class="card-text"><span class="odd-txt">×<span class="odd-val">${odds[f.id] || '?'}</span></span></div>`;
    el.addEventListener('click', () => betFood(f.id));
    arena.appendChild(el);
  });
}

function buildChips() {
  $('chips').innerHTML = CHIPS.map(
    (v) => `<button type="button" class="goldItem${v === selectedChip ? ' active' : ''}" data-chip="${v}"><div class="goldItemIcon">${v}</div></button>`
  ).join('');
  $('chips').querySelectorAll('.goldItem').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
    });
  });
}

function updatePendingUI() {
  document.querySelectorAll('.animal-item').forEach((el) => {
    const code = el.dataset.code;
    const amt = pending[code] || 0;
    let badge = el.querySelector('.your-bet');
    const imgEl = el.querySelector('.animal-img');
    if (amt > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'your-bet';
        el.appendChild(badge);
      }
      badge.textContent = `Your: ${amt}`;
      imgEl.classList.add('with-bet');
      imgEl.classList.remove('no-bet');
    } else if (badge) {
      badge.remove();
      imgEl.classList.remove('with-bet');
      imgEl.classList.add('no-bet');
    }
  });

}

async function betFood(code) {
  await doBet(code);
  pending[code] = (pending[code] || 0) + selectedChip;
  updatePendingUI();
}

async function betGroup(group) {
  const code = group === 'VEG' ? 'BIGO_GREEDY_VEGETABLE_BASKET' : 'BIGO_GREEDY_MEAT_PLATES';
  await doBet(code);
  pending[code] = (pending[code] || 0) + selectedChip;
  updatePendingUI();
}

async function doBet(playCode) {
  const state = await betState(config, sessionId);
  if (state.Stage !== 1) {
    toast('Betting closed — wait for next round');
    throw new Error('closed');
  }
  const data = await placeBet(config, sessionId, playCode, selectedChip);
  if (data.SessionId) {
    sessionId = data.SessionId;
    localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
  }
}

function startSpin() {
  if (spinTimer) return;
  spinTimer = setInterval(() => {
    spinIndex = (spinIndex + 1) % FOODS.length;
    document.querySelectorAll('.animal-item').forEach((el, i) => {
      const bg = el.querySelector('.card-bg');
      bg.src = i === spinIndex ? `${BOX_ASSET}/box-running.png` : `${BOX_ASSET}/box-default.png`;
    });
  }, 120);
}

function stopSpin(targetCode) {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
  }
  const idx = FOODS.findIndex((f) => f.id === targetCode);
  document.querySelectorAll('.animal-item').forEach((el, i) => {
    const bg = el.querySelector('.card-bg');
    bg.src = i === idx ? `${BOX_ASSET}/box-running.png` : `${BOX_ASSET}/box-default.png`;
  });
}

function clearPending() {
  for (const k of Object.keys(pending)) delete pending[k];
  updatePendingUI();
}

function renderWinners(lastTop) {
  const winners = (lastTop || [])
    .filter((w) => w && (w.NickName || w.Head || w.Win))
    .slice(0, 3);

  const container = $('winners-container');
  if (!winners.length) {
    container.innerHTML = '<div class="no-winners">暂无大赢家数据</div>';
    return;
  }

  container.innerHTML = `<div class="winners-list">${winners.map((w) => `
    <div class="winner-item">
      <img class="winner-avatar" src="${w.Head || `${ASSET}/home-icon@2x.png`}" alt="" />
      <div class="winner-name">${w.NickName || 'Player'}</div>
      <div class="winner-win">+${w.Win || '0'}</div>
    </div>`).join('')}</div>`;
}

function resultKey(state) {
  const code = state.LastNum?.[0];
  if (!code || !state.LastPeriod) return '';
  return `${state.LastPeriod}:${code}`;
}

function showResult(state) {
  const key = resultKey(state);
  if (!key || key === lastShownResultKey) return;
  lastShownResultKey = key;
  const code = state.LastNum[0];

  $('result-banner').src = `${ASSET}/prize/${code}_TIP.png`;
  $('result-img').src = img(code);
  $('result-period-text').textContent = `the ${periodShort(state.LastPeriod)} round's results：`;
  renderWinners(state.LastTop);

  if (state.WinAmount > 0) {
    toast(`🎉 Won ${Number(state.WinAmount).toLocaleString()}!`);
  }

  $('result-overlay').hidden = false;

  let sec = 5;
  $('result-countdown').textContent = `(${sec}s)`;
  clearInterval(resultTimer);
  resultTimer = setInterval(() => {
    sec--;
    $('result-countdown').textContent = sec > 0 ? `(${sec}s)` : '';
    if (sec <= 0) {
      clearInterval(resultTimer);
      $('result-overlay').hidden = true;
    }
  }, 1000);

  clearPending();
}

function renderHistory(periods) {
  $('history').innerHTML = periods.slice(0, 10).map((row, i) => {
    const code = row.Result?.[0] || row.result?.[0];
    if (!code) return '';
    const group = FOOD_GROUP[code] || '';
    return `<div class="result-icon ${group}">
      <img class="result-food-img" src="${img(code)}" alt="" />
      ${i === 0 ? `<img class="result-new-tag" src="${ASSET}/history-new.png" alt="" />` : ''}
    </div>`;
  }).join('');
}

function updateOdds() {
  document.querySelectorAll('.odd-val').forEach((el) => {
    const item = el.closest('.animal-item');
    if (item) el.textContent = odds[item.dataset.code] || '?';
  });
  $('odd-veg').textContent = `${odds.BIGO_GREEDY_VEGETABLE_BASKET || '?'}x`;
  $('odd-meat').textContent = `${odds.BIGO_GREEDY_MEAT_PLATES || '?'}x`;
}

let pollOffline = false;
/** @type {Promise<void> | null} */
let pollInFlight = null;

async function pollOnce() {
  if (pollInFlight) return pollInFlight;
  pollInFlight = tick().finally(() => {
    pollInFlight = null;
  });
  return pollInFlight;
}

function shouldShowResult(state, spinJustEnded) {
  const key = resultKey(state);
  if (!key || key === lastShownResultKey) return false;
  if (state.Stage === 2) return false;
  return spinJustEnded || state.Stage === 4;
}

async function tick() {
  try {
    const state = await betState(config, sessionId);
    pollOffline = false;
    const spinJustEnded = prevStage === 2 && state.Stage !== 2;
    if (state.SessionId && state.SessionId !== sessionId) {
      sessionId = state.SessionId;
      localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
    }

    $('period-label').textContent = `今日第${periodShort(state.Period)}期`;
    const betting = state.Stage === 1;
    const spinning = state.Stage === 2;
    const cd = Math.max(0, Number(state.CountDown || 0));

    if (state.Balance != null) {
      $('balance').textContent = Number(state.Balance).toLocaleString();
    }

    const labelEl = $('time-label');
    const cdEl = $('countdown');
    if (spinning) {
      labelEl.textContent = '开奖中';
      labelEl.classList.add('announce');
      cdEl.hidden = true;
      $('start-box').classList.add('mask');
      startSpin();
    } else {
      labelEl.textContent = '选择时间';
      labelEl.classList.remove('announce');
      cdEl.hidden = false;
      cdEl.innerHTML = `${cd}<span class="time-unit">s</span>`;
      $('start-box').classList.toggle('mask', !betting);
      if (spinTimer) stopSpin(state.LastNum?.[0]);
    }

    document.querySelectorAll('.bottom-left, .bottom-right').forEach((el) => {
      el.style.pointerEvents = betting ? '' : 'none';
      el.style.opacity = betting ? '' : '0.6';
    });

    const resultCode = state.LastNum?.[0];
    if (resultCode && state.Stage !== 2 && spinTimer) {
      stopSpin(resultCode);
    }

    if (isFirstTick) {
      const key = resultKey(state);
      if (state.Stage === 4 && key) {
        stopSpin(resultCode);
        showResult(state);
      } else if (key) {
        lastShownResultKey = key;
      }
      isFirstTick = false;
    } else if (shouldShowResult(state, spinJustEnded)) {
      stopSpin(resultCode);
      showResult(state);
    }

    prevStage = state.Stage;
  } catch (err) {
    if (err instanceof LotteryApiError && err.offline) {
      if (!pollOffline) {
        pollOffline = true;
        toast(err.message);
      }
      return;
    }
    console.warn('[greedy] poll failed', err);
  }
}

async function loadHistory() {
  try {
    const { periods } = await periodList(config, { Idx: 1, Size: 12 });
    renderHistory(periods);
  } catch (err) {
    if (!(err instanceof LotteryApiError && err.offline)) {
      console.warn('[greedy] history failed', err);
    }
  }
}

async function loadRankings() {
  try {
    const res = await fetch('/bigo/v1/income_rank_today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TypCode: config.typCode,
        LotteryCode: config.lotteryCode,
      }),
    });
    const json = await res.json();
    const ranks = json?.data?.Ranks || json?.Data?.Ranks || [];
    if (!ranks.length) {
      $('rank-detail').textContent = '暂无数据';
      return;
    }
    const top = ranks[0];
    $('rank-detail').textContent = `${top.Diamond || '—'}(${Number(top.Win || 0).toFixed(2)})`;
    if (top.Head) {
      const av = $('rank-avatar');
      av.outerHTML = `<img id="rank-avatar" src="${top.Head}" alt="" />`;
    }
  } catch (err) {
    console.warn('[greedy] rankings failed', err);
  }
}

async function init() {
  let res;
  try {
    res = await lotteryInit(GAME_ID);
  } catch (err) {
    toast(err instanceof LotteryApiError ? err.message : 'Cannot reach server');
    return;
  }
  if (res.code !== 0) {
    toast('Game not found');
    return;
  }
  config = res.data.game;
  if (res.data.sessionId) {
    sessionId = res.data.sessionId;
    localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
  }
  if (res.data.balance != null) {
    $('balance').textContent = Number(res.data.balance).toLocaleString();
  }

  try {
    odds = oddsMap(await oddList(config));
  } catch {
    odds = Object.fromEntries((config.symbols || []).map((s) => [s.playCode, s.odd]));
  }

  buildArena();
  buildChips();
  updateOdds();

  $('bet-veg').addEventListener('click', () => betGroup('VEG').catch(() => {}));
  $('bet-meat').addEventListener('click', () => betGroup('MEAT').catch(() => {}));
  $('result-overlay').addEventListener('click', (e) => {
    if (e.target === $('result-overlay')) {
      clearInterval(resultTimer);
      $('result-overlay').hidden = true;
    }
  });

  $('result-overlay').hidden = true;
  await tick();
  $('start-box').classList.add('ready');
  await loadHistory();
  await loadRankings();

  function schedulePoll() {
    const delay = prevStage === 2 || prevStage === 4 ? 300 : 1000;
    setTimeout(async () => {
      await pollOnce();
      schedulePoll();
    }, delay);
  }
  schedulePoll();
  setInterval(loadHistory, 3000);
}

init();
