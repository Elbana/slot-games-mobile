import {
  lotteryInit,
  betState,
  periodList,
  oddList,
  placeBet,
  oddsMap,
  LotteryApiError,
} from '/shared/lottery/api.js';

const ASSET = '/lottery/petsbeasts';
const GAME_ID = 'pets-beasts';

const ANIMALS = [
  { id: 'PETS_BEASTS_EAGLE', name: 'Eagle', group: 'BEASTS' },
  { id: 'PETS_BEASTS_TIGER', name: 'Tiger', group: 'BEASTS' },
  { id: 'PETS_BEASTS_LION', name: 'Lion', group: 'BEASTS' },
  { id: 'PETS_BEASTS_UNICORN', name: 'Unicorn', group: 'BEASTS' },
  { id: 'PETS_BEASTS_DOG', name: 'Dog', group: 'PETS' },
  { id: 'PETS_BEASTS_CAT', name: 'Cat', group: 'PETS' },
  { id: 'PETS_BEASTS_RABBIT', name: 'Rabbit', group: 'PETS' },
  { id: 'PETS_BEASTS_BEAR', name: 'Bear', group: 'PETS' },
];

const CHIPS = [2, 10, 50, 100, 1000];

let config = null;
let sessionId = localStorage.getItem(`lottery-session-${GAME_ID}`) || '';
let selectedChip = CHIPS[0];
let odds = {};
let spinIndex = 0;
let spinTimer = null;
let lastResultPeriod = '';
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
  ANIMALS.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = `animal-item animal-item-${i}`;
    el.dataset.code = a.id;
    el.innerHTML = `
      <img class="card-bg" src="${ASSET}/box-default.png" alt="" />
      <img class="animal-img no-bet" src="${img(a.id)}" alt="${a.name}" />
      <div class="card-text"><span class="odd-txt">win <span class="odd-val">${odds[a.id] || '?'}</span> times</span></div>`;
    el.addEventListener('click', () => betAnimal(a.id));
    arena.appendChild(el);
  });
}

function buildChips() {
  $('chips').innerHTML = CHIPS.map(
    (v) => `<button type="button" class="goldItem${v === selectedChip ? ' active' : ''}" data-chip="${v}">${v >= 1000 ? '1K' : v}</button>`
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

  const petsAmt = (pending.PETS_BEASTS_PETS || 0);
  const beastsAmt = (pending.PETS_BEASTS_BEASTS || 0);
  $('amt-pets').hidden = !petsAmt;
  $('amt-beasts').hidden = !beastsAmt;
  if (petsAmt) $('amt-pets').textContent = petsAmt;
  if (beastsAmt) $('amt-beasts').textContent = beastsAmt;
}

async function betAnimal(code) {
  await doBet(code);
  pending[code] = (pending[code] || 0) + selectedChip;
  updatePendingUI();
}

async function betGroup(group) {
  const code = group === 'PETS' ? 'PETS_BEASTS_PETS' : 'PETS_BEASTS_BEASTS';
  await doBet(code);
  pending[code] = (pending[code] || 0) + selectedChip;
  updatePendingUI();
}

async function doBet(playCode) {
  const state = await betState(config, sessionId);
  if (state.Stage !== 1) {
    toast('Betting closed');
    throw new Error('closed');
  }
  const data = await placeBet(config, sessionId, playCode, selectedChip);
  if (data.SessionId) {
    sessionId = data.SessionId;
    localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
  }
  $('balance') && ($('balance').textContent = Number(data.Balance).toLocaleString());
}

function startSpin() {
  if (spinTimer) return;
  spinTimer = setInterval(() => {
    spinIndex = (spinIndex + 1) % ANIMALS.length;
    document.querySelectorAll('.animal-item').forEach((el, i) => {
      const bg = el.querySelector('.card-bg');
      bg.src = i === spinIndex ? `${ASSET}/box-running.png` : `${ASSET}/box-default.png`;
    });
  }, 120);
}

function stopSpin(targetCode) {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
  }
  const idx = ANIMALS.findIndex((a) => a.id === targetCode);
  document.querySelectorAll('.animal-item').forEach((el, i) => {
    const bg = el.querySelector('.card-bg');
    bg.src = i === idx ? `${ASSET}/box-running.png` : `${ASSET}/box-default.png`;
  });
}

function clearPending() {
  for (const k of Object.keys(pending)) delete pending[k];
  updatePendingUI();
}

function showResult(state) {
  const code = state.LastNum?.[0];
  if (!code || state.LastPeriod === lastResultPeriod) return;
  lastResultPeriod = state.LastPeriod;
  const animal = ANIMALS.find((a) => a.id === code);

  $('result-img').src = img(code);
  $('result-name').textContent = animal?.name || code;
  $('result-period').textContent = `Round ${periodShort(state.LastPeriod)} results`;
  const msg = $('result-msg');
  if (state.WinAmount > 0) {
    msg.className = 'win-msg';
    msg.textContent = `🎉 You won! +${Number(state.WinAmount).toLocaleString()}`;
  } else {
    msg.className = 'lose-msg';
    msg.textContent = 'Sorry, no win';
  }
  $('result-overlay').hidden = false;
  clearPending();
}

function renderHistory(periods) {
  $('history').innerHTML = periods.slice(0, 10).map((row, i) => {
    const code = row.Result?.[0] || row.result?.[0];
    if (!code) return '';
    return `<div class="hist-icon">
      <img src="${img(code)}" alt="" />
      ${i === 0 ? `<img class="new-badge" src="${ASSET}/new.png" alt="" />` : ''}
    </div>`;
  }).join('');
}

function updateOdds() {
  document.querySelectorAll('.odd-val').forEach((el) => {
    const item = el.closest('.animal-item');
    if (item) el.textContent = odds[item.dataset.code] || '?';
  });
  $('odd-pets').textContent = `${odds.PETS_BEASTS_PETS || '?'}x`;
  $('odd-beasts').textContent = `${odds.PETS_BEASTS_BEASTS || '?'}x`;
}

let pollOffline = false;

async function tick() {
  try {
    const state = await betState(config, sessionId);
    pollOffline = false;
    if (state.SessionId && state.SessionId !== sessionId) {
      sessionId = state.SessionId;
      localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
    }

    $('period-label').textContent = `Round ${periodShort(state.Period)}`;
    const betting = state.Stage === 1;
    const spinning = state.Stage === 2;
    const cd = Math.max(0, Number(state.CountDown || 0));

    const cdEl = $('countdown');
    if (spinning) {
      cdEl.innerHTML = '<span class="ct-drawing">Drawing…</span>';
      $('start-box').classList.add('mask');
      startSpin();
    } else {
      cdEl.innerHTML = `${cd}<span class="ct-s">s</span>`;
      $('start-box').classList.toggle('mask', !betting);
      if (spinTimer) stopSpin(state.LastNum?.[0]);
    }

    document.querySelectorAll('.batch-btn-wrap').forEach((el) => {
      el.classList.toggle('disabled', !betting);
    });

    if (state.Stage === 4 && state.LastNum?.length) {
      stopSpin(state.LastNum[0]);
      showResult(state);
    }
  } catch (err) {
    if (err instanceof LotteryApiError && err.offline) {
      if (!pollOffline) {
        pollOffline = true;
        toast(err.message);
      }
      return;
    }
    console.warn('[pets-beasts] poll failed', err);
  }
}

async function loadHistory() {
  try {
    const { periods } = await periodList(config, { Idx: 1, Size: 12 });
    renderHistory(periods);
  } catch (err) {
    if (!(err instanceof LotteryApiError && err.offline)) {
      console.warn('[pets-beasts] history failed', err);
    }
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

  try {
    odds = oddsMap(await oddList(config));
  } catch {
    odds = Object.fromEntries((config.symbols || []).map((s) => [s.playCode, s.odd]));
  }

  buildArena();
  buildChips();
  updateOdds();

  $('bet-pets').addEventListener('click', () => betGroup('PETS').catch(() => {}));
  $('bet-beasts').addEventListener('click', () => betGroup('BEASTS').catch(() => {}));
  $('close-result').addEventListener('click', () => { $('result-overlay').hidden = true; });

  $('result-overlay').hidden = true;
  await tick();
  $('start-box').classList.add('ready');
  await loadHistory();
  setInterval(async () => {
    await tick();
    await loadHistory();
  }, 1000);
}

init();
