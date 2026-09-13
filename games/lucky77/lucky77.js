import {
  lotteryInit,
  betState,
  periodList,
  oddList,
  placeBet,
  oddsMap,
  LotteryApiError,
} from '/shared/lottery/api.js';
import { LUCK77_WHEEL_STOPS } from './wheel-stops.js';
import {
  loadAssetManifest,
  symbolAssetUrl,
  symbolAssetUrls,
  uiAssetUrl,
  chipAssetUrl,
} from './assets.mjs';

const GAME_ID = 'lucky77';
const CHIPS = [100, 1000, 10000, 100000];
const SEGMENTS = LUCK77_WHEEL_STOPS.length;
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS;

const ZONE_META = {
  LUCK77_LEMON: { kind: 'lemon', label: 'Lemon', odd: 2 },
  LUCK77_SEVEN: { kind: 'seven', label: 'Lucky 77', odd: 8 },
  LUCK77_WATERMELON: { kind: 'melon', label: 'Watermelon', odd: 2 },
};

let config = null;
let sessionId = localStorage.getItem(`lottery-session-${GAME_ID}`) || '';
let selectedChip = CHIPS[0];
let odds = {};
let wheelRotation = 0;
let spinAnim = null;
let glowAnim = null;
let glowStopTimer = null;
let lastSpinKey = '';
let lastSpinPeriod = '';
let winningSegmentIndex = -1;
let showSegmentGlow = false;
let glowPhase = 0;
const GLOW_DURATION_MS = 1200;
let prevStage = null;
let isFirstTick = true;
let lastShownResultKey = '';
/** @type {Record<string, number>} */
const pending = {};
/** @type {Record<string, number>} */
let lastBets = {};

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
/** @type {Record<string, HTMLImageElement>} */
const assetImages = {};

function $(id) {
  return document.getElementById(id);
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function periodShort(period) {
  if (!period) return '--';
  return String(Number(String(period).slice(-4)));
}

function zoneKind(code) {
  return ZONE_META[code]?.kind || 'lemon';
}

/** Server wheel stop index — never guess from symbol (duplicate wedges). */
function resolveWheelIndex(state) {
  const raw = state.ShowArea ?? state.showArea;
  if (raw === undefined || raw === null || raw === '') return -1;
  const idx = Number(raw);
  if (!Number.isInteger(idx) || idx < 0 || idx >= SEGMENTS) return -1;
  return idx;
}

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const size = Math.floor(wrap.clientWidth * dpr);
  canvas.width = size;
  canvas.height = size;
  drawWheel(wheelRotation);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`asset failed: ${url}`));
    img.src = url;
  });
}

async function loadAssets() {
  const urls = symbolAssetUrls();
  const entries = await Promise.all(
    Object.entries(urls).map(async ([kind, url]) => {
      try {
        return [kind, await loadImage(url)];
      } catch {
        return [kind, null];
      }
    }),
  );
  for (const [kind, img] of entries) {
    if (img) assetImages[kind] = img;
  }
}

function applyDomAssets() {
  document.querySelectorAll('[data-l77-symbol]').forEach((img) => {
    const kind = img.dataset.l77Symbol;
    if (kind) img.src = symbolAssetUrl(kind);
  });
  const coin = document.getElementById('asset-coin');
  if (coin) coin.src = uiAssetUrl('coin');
  const pointer = document.getElementById('asset-pointer');
  if (pointer) pointer.src = uiAssetUrl('pointer');
  const shell = document.querySelector('.gm-shell--lucky77');
  if (shell) {
    shell.style.setProperty('--l77-stage-bg', `url("${uiAssetUrl('stageBg')}")`);
  }
  document.querySelectorAll('.l77-statue').forEach((el) => {
    el.style.backgroundImage = `url("${uiAssetUrl('statue')}")`;
  });
  const ring = document.querySelector('.l77-wheel-ring');
  if (ring) ring.style.backgroundImage = `url("${uiAssetUrl('wheelRing')}")`;
}

function normalizeAngle(angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

function segmentFillColor(kind) {
  if (kind === 'seven') return '#2e1065';
  if (kind === 'melon') return '#14532d';
  return '#5c3d0a';
}

function drawSegmentIcon(code, x, y, r) {
  const kind = zoneKind(code);
  const img = assetImages[kind];
  if (img) {
    const size = r * 2.4;
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return;
  }
  if (kind === 'lemon') {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === 'melon') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${r * 1.2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('77', x, y + 1);
}

function drawWinGlow(cx, cy, outer, inner, start, end, pulse) {
  const flash = 0.78
    + Math.sin(pulse * 18) * 0.16
    + Math.sin(pulse * 27) * 0.1;
  const bolt = 0.55 + Math.max(0, Math.sin(pulse * 32)) * 0.45;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, outer, start, end);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createRadialGradient(cx, cy - outer * 0.42, inner * 0.4, cx, cy, outer * 1.02);
  grad.addColorStop(0, `rgba(255, 252, 220, ${0.92 * flash})`);
  grad.addColorStop(0.2, `rgba(255, 228, 90, ${0.78 * flash})`);
  grad.addColorStop(0.45, `rgba(255, 185, 40, ${0.52 * flash * bolt})`);
  grad.addColorStop(0.72, `rgba(255, 140, 0, ${0.22 * flash})`);
  grad.addColorStop(1, 'rgba(255, 120, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
  ctx.restore();
}

function drawPointerSpotlight(cx, cy, outer, pulse) {
  const flash = 0.72
    + Math.sin(pulse * 20) * 0.18
    + Math.sin(pulse * 31) * 0.12;
  const topY = cy - outer * 0.72;
  ctx.save();
  const spot = ctx.createRadialGradient(cx, topY, 0, cx, topY, outer * 0.48);
  spot.addColorStop(0, `rgba(255, 252, 210, ${0.9 * flash})`);
  spot.addColorStop(0.35, `rgba(255, 215, 70, ${0.55 * flash})`);
  spot.addColorStop(0.65, `rgba(255, 170, 20, ${0.25 * flash})`);
  spot.addColorStop(1, 'rgba(255, 140, 0, 0)');
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.arc(cx, topY, outer * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWheel(rotation) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outer = w * 0.46;
  const inner = w * 0.12;
  const iconR = w * 0.055;
  const iconDist = outer * 0.62;
  const oddDist = outer * 0.38;
  const oddFont = `800 ${w * 0.028}px sans-serif`;

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, outer + w * 0.02, 0, Math.PI * 2);
  ctx.fillStyle = '#374151';
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < SEGMENTS; i++) {
    const start = i * SEG_ANGLE - Math.PI / 2;
    const end = start + SEG_ANGLE;
    const code = LUCK77_WHEEL_STOPS[i];
    const kind = zoneKind(code);
    const mid = start + SEG_ANGLE / 2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outer, start, end);
    ctx.closePath();
    ctx.fillStyle = segmentFillColor(kind);
    ctx.fill();

    const isWinner = showSegmentGlow && i === winningSegmentIndex;
    if (!isWinner) {
      ctx.strokeStyle = 'rgba(232, 197, 71, 0.35)';
      ctx.lineWidth = w * 0.004;
      ctx.stroke();
    }

    if (isWinner) {
      drawWinGlow(0, 0, outer, inner, start, end, glowPhase);
    }
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const start = i * SEG_ANGLE - Math.PI / 2;
    const mid = start + SEG_ANGLE / 2;
    const code = LUCK77_WHEEL_STOPS[i];
    const ix = Math.cos(mid) * iconDist;
    const iy = Math.sin(mid) * iconDist;
    drawSegmentIcon(code, ix, iy, iconR);

    const odd = ZONE_META[code]?.odd || 2;
    ctx.fillStyle = '#e8c547';
    ctx.font = oddFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${odd}`, Math.cos(mid) * oddDist, Math.sin(mid) * oddDist);
  }

  ctx.beginPath();
  ctx.arc(0, 0, inner, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 16, 32, 0.35)';
  ctx.fill();
  ctx.restore();

  if (showSegmentGlow && winningSegmentIndex >= 0) {
    drawPointerSpotlight(cx, cy, outer, glowPhase);
  }
}

function rotationForStop(index, fromRotation) {
  const segCenter = index * SEG_ANGLE + SEG_ANGLE / 2;
  const minSpins = 5;
  const endMod = normalizeAngle(-segCenter);
  const fromMod = normalizeAngle(fromRotation);
  let extra = endMod - fromMod;
  if (extra <= 0) extra += Math.PI * 2;
  return fromRotation + extra + minSpins * Math.PI * 2;
}

function startGlowLoop() {
  if (glowAnim) cancelAnimationFrame(glowAnim);
  const start = performance.now();
  function frame(now) {
    glowPhase = (now - start) / 1000;
    drawWheel(wheelRotation);
    if (showSegmentGlow) {
      glowAnim = requestAnimationFrame(frame);
    } else {
      glowAnim = null;
    }
  }
  glowAnim = requestAnimationFrame(frame);
}

function stopGlowLoop() {
  showSegmentGlow = false;
  winningSegmentIndex = -1;
  if (glowStopTimer) {
    clearTimeout(glowStopTimer);
    glowStopTimer = null;
  }
  if (glowAnim) {
    cancelAnimationFrame(glowAnim);
    glowAnim = null;
  }
}

function scheduleGlowEnd() {
  if (glowStopTimer) clearTimeout(glowStopTimer);
  glowStopTimer = setTimeout(() => {
    showSegmentGlow = false;
    if (glowAnim) {
      cancelAnimationFrame(glowAnim);
      glowAnim = null;
    }
    drawWheel(wheelRotation);
    glowStopTimer = null;
  }, GLOW_DURATION_MS);
}

function animateWheelToStop(index, durationMs = 4200) {
  if (spinAnim) cancelAnimationFrame(spinAnim);
  stopGlowLoop();
  const startRot = wheelRotation;
  const endRot = rotationForStop(index, startRot);
  const delta = endRot - startRot;
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = 1 - Math.pow(1 - t, 3);
      wheelRotation = startRot + delta * ease;
      drawWheel(wheelRotation);
      if (t < 1) {
        spinAnim = requestAnimationFrame(frame);
      } else {
        wheelRotation = endRot;
        winningSegmentIndex = index;
        showSegmentGlow = true;
        drawWheel(wheelRotation);
        startGlowLoop();
        scheduleGlowEnd();
        spinAnim = null;
        resolve();
      }
    }
    spinAnim = requestAnimationFrame(frame);
  });
}

function snapRotationForStop(index) {
  const segCenter = index * SEG_ANGLE + SEG_ANGLE / 2;
  const targetMod = normalizeAngle(-segCenter);
  const currentMod = normalizeAngle(wheelRotation);
  let delta = targetMod - currentMod;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return wheelRotation + delta;
}

function snapWheelToStop(index) {
  wheelRotation = snapRotationForStop(index);
  winningSegmentIndex = index;
  showSegmentGlow = true;
  drawWheel(wheelRotation);
  startGlowLoop();
  scheduleGlowEnd();
}

function buildChips() {
  $('chips').innerHTML = CHIPS.map((v) => {
    const cls = v === 100 ? '100' : v === 1000 ? '1k' : v === 10000 ? '10k' : '100k';
    const label = v >= 1000 ? `${v / 1000}k` : String(v);
    const src = chipAssetUrl(v);
    return `<button type="button" class="l77-chip l77-chip--${cls}${v === selectedChip ? ' active' : ''}" data-chip="${v}" style="background-image:url('${src}')"><span>${label}</span></button>`;
  }).join('');
  $('chips').querySelectorAll('.l77-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
    });
  });
}

function updatePendingUI() {
  document.querySelectorAll('.l77-bet').forEach((btn) => {
    const code = btn.dataset.code;
    const amt = pending[code] || 0;
    btn.querySelector('[data-amt]').textContent = amt > 0 ? amt.toLocaleString() : '0';
    btn.classList.toggle('has-bet', amt > 0);
  });
}

async function doBet(code) {
  const state = await betState(config, sessionId);
  if (state.Stage !== 1) {
    toast('Betting closed — wait for next round');
    throw new Error('closed');
  }
  const data = await placeBet(config, sessionId, code, selectedChip);
  if (data.SessionId) {
    sessionId = data.SessionId;
    localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
  }
  pending[code] = (pending[code] || 0) + selectedChip;
  updatePendingUI();
}

function clearPending() {
  lastBets = { ...pending };
  for (const k of Object.keys(pending)) delete pending[k];
  updatePendingUI();
}

function renderHistory(periods) {
  $('history').innerHTML = periods.slice(0, 12).map((row) => {
    const code = row.Result?.[0] || row.result?.[0];
    if (!code) return '';
    const meta = ZONE_META[code];
    const kind = zoneKind(code);
    const src = symbolAssetUrl(kind);
    const emoji = meta?.label === 'Lucky 77' ? '77' : kind === 'melon' ? '🍉' : '🍋';
    return `<span class="l77-dot l77-dot--${kind}" title="${meta?.label || code}"><img src="${src}" alt="${emoji}" loading="lazy" /></span>`;
  }).join('');
}

function updateCenterCountdown(state) {
  const cdEl = $('countdown');
  const betting = state.Stage === 1;
  const cd = Math.max(0, Number(state.CountDown || 0));
  cdEl.textContent = betting ? String(cd) : '10';
  cdEl.classList.toggle('is-hidden', !betting);
}

function resultKey(state) {
  const code = state.LastNum?.[0];
  if (!code || !state.LastPeriod) return '';
  return `${state.LastPeriod}:${code}:${state.ShowArea ?? ''}`;
}

function showWin(state) {
  if (state.WinAmount > 0) {
    $('win-title').textContent = 'Congratulations!';
    $('win-amount').textContent = `+${Number(state.WinAmount).toLocaleString()}`;
    $('win-overlay').hidden = false;
    toast(`Won ${Number(state.WinAmount).toLocaleString()}!`);
  }
}

async function tick() {
  const state = await betState(config, sessionId);
  if (state.SessionId && state.SessionId !== sessionId) {
    sessionId = state.SessionId;
    localStorage.setItem(`lottery-session-${GAME_ID}`, sessionId);
  }

  $('round-label').textContent = `Round ${periodShort(state.Period)}`;
  if (state.Balance != null) {
    $('balance').textContent = Number(state.Balance).toLocaleString();
  }

  const betting = state.Stage === 1;
  const spinning = state.Stage === 2;

  updateCenterCountdown(state);

  const idx = resolveWheelIndex(state);
  const spinKey = `${state.Period}:${idx}`;
  const periodChanged = state.Period !== lastSpinPeriod;

  if (spinning) {
    document.querySelectorAll('.l77-bet').forEach((b) => { b.disabled = true; });
    if (idx >= 0 && (periodChanged || spinKey !== lastSpinKey) && !spinAnim) {
      lastSpinKey = spinKey;
      lastSpinPeriod = state.Period;
      const spinMs = Math.max(1600, Number(state.CloseDuration || 5) * 700);
      animateWheelToStop(idx, spinMs);
    }
  } else if (state.Stage === 4 && idx >= 0) {
    document.querySelectorAll('.l77-bet').forEach((b) => { b.disabled = true; });
    if (!spinAnim && !showSegmentGlow && (periodChanged || spinKey !== lastSpinKey)) {
      snapWheelToStop(idx);
      lastSpinKey = spinKey;
      lastSpinPeriod = state.Period;
    }
  } else {
    if (state.Stage === 1) {
      if (periodChanged) {
        lastSpinKey = '';
        lastSpinPeriod = state.Period;
      }
      stopGlowLoop();
      drawWheel(wheelRotation);
    }
    document.querySelectorAll('.l77-bet').forEach((b) => { b.disabled = !betting; });
  }

  const spinJustEnded = prevStage === 2 && state.Stage !== 2;
  const key = resultKey(state);

  if (isFirstTick) {
    lastSpinPeriod = state.Period;
    if (state.Stage === 2 && idx >= 0 && !spinAnim) {
      lastSpinKey = spinKey;
      const spinMs = Math.max(1200, Number(state.CountDown || 3) * 700);
      animateWheelToStop(idx, spinMs);
    } else if (state.Stage === 4 && idx >= 0) {
      snapWheelToStop(idx);
      lastSpinKey = spinKey;
      if (state.WinAmount > 0) showWin(state);
      lastShownResultKey = key;
    } else if (key) {
      lastShownResultKey = key;
    }
    isFirstTick = false;
  } else if (spinJustEnded && key && key !== lastShownResultKey) {
    lastShownResultKey = key;
    showWin(state);
    clearPending();
  }

  prevStage = state.Stage;
  return state;
}

async function loadHistory() {
  try {
    const { periods } = await periodList(config, { Idx: 1, Size: 12 });
    renderHistory(periods);
  } catch (err) {
    if (!(err instanceof LotteryApiError && err.offline)) {
      console.warn('[lucky77] history', err);
    }
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  $('player-name').textContent = params.get('player') || 'Player';

  let res;
  try {
    res = await lotteryInit(GAME_ID);
  } catch (err) {
    toast(err instanceof LotteryApiError ? err.message : 'Cannot reach server');
    return;
  }
  if (res.code !== 0) {
    toast(res.msg || 'Game not enabled');
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

  document.querySelectorAll('.l77-bet').forEach((btn) => {
    const code = btn.dataset.code;
    const oddEl = btn.querySelector('.l77-bet__odd');
    if (oddEl) oddEl.textContent = `×${odds[code] || ZONE_META[code]?.odd || '?'}`;
    btn.addEventListener('click', () => doBet(code).catch(() => {}));
  });

  await loadAssetManifest();
  applyDomAssets();
  await loadAssets();
  buildChips();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  drawWheel(0);

  $('btn-rebet').addEventListener('click', async () => {
    if (!Object.keys(lastBets).length) {
      toast('No previous bets');
      return;
    }
    try {
      for (const [code, amt] of Object.entries(lastBets)) {
        let left = amt;
        while (left > 0) {
          const chip = CHIPS.filter((c) => c <= left).pop() || CHIPS[0];
          selectedChip = chip;
          await doBet(code);
          left -= chip;
        }
      }
    } catch {
      /* closed */
    }
  });

  $('btn-topup').addEventListener('click', () => toast('Demo wallet — use launcher token'));
  $('win-close').addEventListener('click', () => { $('win-overlay').hidden = true; });

  await tick();
  await loadHistory();

  async function poll() {
    try {
      await tick();
    } catch (err) {
      if (err instanceof LotteryApiError && err.offline) toast(err.message);
    }
    setTimeout(poll, prevStage === 2 ? 300 : 800);
  }
  poll();
  setInterval(loadHistory, 3000);
}

init();
