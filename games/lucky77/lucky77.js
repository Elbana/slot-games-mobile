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
  uiPaths,
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
/** @type {Array<{ period: string, code: string }>} */
let cachedHistory = [];
const HISTORY_BAR_COUNT = 10;
const HISTORY_MODAL_COUNT = 30;

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
  const shell = document.querySelector('.gm-shell--lucky77');
  if (shell && uiPaths.stageBg) {
    shell.style.setProperty('--l77-stage-bg', `url("${uiAssetUrl('stageBg')}")`);
  }
}

function setupSettings() {
  const panel = $('settings-panel');
  const btn = $('btn-settings');
  const close = () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $('settings-close').addEventListener('click', close);
  $('settings-backdrop').addEventListener('click', close);
  $('setting-help').addEventListener('click', () => {
    close();
    toast('Pick Lemon, Watermelon, or 77 — wheel has 9 wedges. 77 pays ×8!');
  });
}

function normalizeAngle(angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

function segmentFillGradient(kind, cx, cy, outer, start, end) {
  const mid = (start + end) / 2;
  const gx = cx + Math.cos(mid) * outer * 0.35;
  const gy = cy + Math.sin(mid) * outer * 0.35;
  const grad = ctx.createRadialGradient(gx, gy, outer * 0.08, cx, cy, outer);
  if (kind === 'seven') {
    grad.addColorStop(0, '#6d28d9');
    grad.addColorStop(0.55, '#4c1d95');
    grad.addColorStop(1, '#1e1b4b');
    return grad;
  }
  if (kind === 'melon') {
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(0.5, '#15803d');
    grad.addColorStop(1, '#052e16');
    return grad;
  }
  grad.addColorStop(0, '#fbbf24');
  grad.addColorStop(0.45, '#b45309');
  grad.addColorStop(1, '#451a03');
  return grad;
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

function drawWheelLayer(rotation, alpha = 1) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outer = w * 0.46;
  const inner = w * 0.12;
  const iconR = w * 0.055;
  const iconDist = outer * 0.62;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  for (let i = 0; i < SEGMENTS; i++) {
    const start = i * SEG_ANGLE - Math.PI / 2;
    const end = start + SEG_ANGLE;
    const code = LUCK77_WHEEL_STOPS[i];
    const kind = zoneKind(code);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outer, start, end);
    ctx.closePath();
    ctx.fillStyle = segmentFillGradient(kind, 0, 0, outer, start, end);
    ctx.fill();

    const isWinner = showSegmentGlow && i === winningSegmentIndex;
    if (isWinner) {
      drawWinGlow(0, 0, outer, inner, start, end, glowPhase);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
    ctx.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
    ctx.stroke();
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const start = i * SEG_ANGLE - Math.PI / 2;
    const mid = start + SEG_ANGLE / 2;
    const code = LUCK77_WHEEL_STOPS[i];
    const ix = Math.cos(mid) * iconDist;
    const iy = Math.sin(mid) * iconDist;
    drawSegmentIcon(code, ix, iy, iconR);
  }

  ctx.beginPath();
  ctx.arc(0, 0, inner, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 12, 24, 0.5)';
  ctx.fill();
  ctx.restore();
  return { cx, cy, outer, inner, w };
}

function drawWheelSelector(cx, cy, outer, inner, w) {
  const half = SEG_ANGLE / 2;
  const top = -Math.PI / 2;
  const left = top - half;
  const right = top + half;
  const rimOuter = outer + w * 0.038;
  const rimInner = outer + w * 0.008;
  const hubEdge = inner + w * 0.006;
  const highlight = showSegmentGlow && winningSegmentIndex >= 0;

  ctx.save();

  // Golden outer rim (matches indicator)
  const rimGrad = ctx.createRadialGradient(cx, cy, rimInner, cx, cy, rimOuter);
  rimGrad.addColorStop(0, '#b45309');
  rimGrad.addColorStop(0.4, '#f59e0b');
  rimGrad.addColorStop(0.72, highlight ? '#ffe082' : '#fde68a');
  rimGrad.addColorStop(1, '#92400e');
  ctx.beginPath();
  ctx.arc(cx, cy, rimOuter, 0, Math.PI * 2);
  ctx.arc(cx, cy, rimInner, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = w * 0.0018;
  ctx.stroke();

  // Golden cap band on outer rim over the top segment
  ctx.beginPath();
  ctx.arc(cx, cy, rimOuter + w * 0.001, left, right);
  ctx.arc(cx, cy, rimInner - w * 0.001, right, left, true);
  ctx.closePath();
  const capGrad = ctx.createLinearGradient(cx, cy - rimOuter, cx, cy - outer);
  capGrad.addColorStop(0, highlight ? '#fff6bf' : '#ffeaa0');
  capGrad.addColorStop(0.45, highlight ? '#ffd54a' : '#f5cc4d');
  capGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = w * 0.002;
  ctx.stroke();

  // Downward golden rails along segment edges (reference bracket style)
  const drawRail = (angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpY = cos;
    const halfW = w * 0.011;
    const xOut = cx + cos * rimOuter;
    const yOut = cy + sin * rimOuter;
    const xIn = cx + cos * hubEdge;
    const yIn = cy + sin * hubEdge;

    ctx.beginPath();
    ctx.moveTo(xOut + perpX * halfW, yOut + perpY * halfW);
    ctx.lineTo(xIn + perpX * halfW, yIn + perpY * halfW);
    ctx.lineTo(xIn - perpX * halfW, yIn - perpY * halfW);
    ctx.lineTo(xOut - perpX * halfW, yOut - perpY * halfW);
    ctx.closePath();
    const railGrad = ctx.createLinearGradient(xOut, yOut, xIn, yIn);
    railGrad.addColorStop(0, highlight ? '#fff3b0' : '#fde68a');
    railGrad.addColorStop(0.5, '#f59e0b');
    railGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = railGrad;
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = w * 0.0015;
    ctx.stroke();
  };

  drawRail(left);
  drawRail(right);

  // Inner cap on hub — closes the frame at the center circle
  ctx.beginPath();
  ctx.arc(cx, cy, hubEdge + w * 0.001, left, right);
  ctx.arc(cx, cy, hubEdge - w * 0.003, right, left, true);
  ctx.closePath();
  const hubCapGrad = ctx.createLinearGradient(cx, cy - hubEdge, cx, cy);
  hubCapGrad.addColorStop(0, highlight ? '#ffd54a' : '#f5cc4d');
  hubCapGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = hubCapGrad;
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = w * 0.0015;
  ctx.stroke();

  // Apex notch on top of rim
  const apexX = cx;
  const apexY = cy - rimOuter;
  ctx.beginPath();
  ctx.moveTo(apexX - w * 0.024, apexY + w * 0.014);
  ctx.lineTo(apexX, apexY - w * 0.012);
  ctx.lineTo(apexX + w * 0.024, apexY + w * 0.014);
  ctx.closePath();
  ctx.fillStyle = highlight ? '#fff8c8' : '#f5cc4d';
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = w * 0.0015;
  ctx.stroke();

  ctx.restore();
}

function drawWheelFrame(cx, cy, outer, inner, w) {
  drawWheelSelector(cx, cy, outer, inner, w);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer + w * 0.003, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = w * 0.0018;
  ctx.stroke();
  ctx.restore();

  if (showSegmentGlow && winningSegmentIndex >= 0) {
    drawPointerSpotlight(cx, cy, outer, glowPhase);
  }
}

function drawWheel(rotation, blurStrength = 0) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (blurStrength > 0.02) {
    const trail = blurStrength * 0.018;
    drawWheelLayer(rotation - trail * 3, 0.12);
    drawWheelLayer(rotation - trail * 1.6, 0.22);
    drawWheelLayer(rotation - trail * 0.7, 0.38);
  }

  const layer = drawWheelLayer(rotation, 1);
  drawWheelFrame(layer.cx, layer.cy, layer.outer, layer.inner, layer.w);
}

function spinEase(t) {
  if (t >= 1) return 1;
  if (t < 0.72) {
    const u = t / 0.72;
    return u * u * 0.88;
  }
  const u = (t - 0.72) / 0.28;
  return 0.88 + (1 - Math.pow(1 - u, 4)) * 0.12;
}

function rotationForStop(index, fromRotation) {
  const segCenter = index * SEG_ANGLE + SEG_ANGLE / 2;
  const minSpins = 6;
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
  let prevRot = startRot;

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = spinEase(t);
      wheelRotation = startRot + delta * ease;
      const velocity = Math.abs(wheelRotation - prevRot);
      prevRot = wheelRotation;
      const blur = t < 0.85 ? Math.min(1, velocity * 28) : 0;
      drawWheel(wheelRotation, blur);
      if (t < 1) {
        spinAnim = requestAnimationFrame(frame);
      } else {
        wheelRotation = endRot;
        winningSegmentIndex = index;
        showSegmentGlow = true;
        drawWheel(wheelRotation, 0);
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
    return `<button type="button" class="l77-chip l77-chip--${cls}${v === selectedChip ? ' active' : ''}" data-chip="${v}">${label}</button>`;
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

function historyRowMeta(row) {
  const code = row.Result?.[0] || row.result?.[0];
  if (!code) return null;
  const period = row.PeriodNo || row.periodNo || '';
  return { period, code };
}

function renderHistoryBar() {
  $('history').innerHTML = cachedHistory.slice(0, HISTORY_BAR_COUNT).map((row) => {
    const meta = ZONE_META[row.code];
    const kind = zoneKind(row.code);
    const src = symbolAssetUrl(kind);
    const emoji = meta?.label === 'Lucky 77' ? '77' : kind === 'melon' ? '🍉' : '🍋';
    return `<span class="l77-dot l77-dot--${kind}" title="${meta?.label || row.code}"><img src="${src}" alt="${emoji}" loading="lazy" /></span>`;
  }).join('');
}

function renderHistoryTable(rows) {
  const body = $('history-table-body');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:rgba(255,255,255,0.45)">No results yet</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row) => {
    const meta = ZONE_META[row.code];
    const kind = zoneKind(row.code);
    const src = symbolAssetUrl(kind);
    const odd = meta?.odd || 2;
    const label = meta?.label || row.code;
    return `<tr>
      <td>${periodShort(row.period)}</td>
      <td><span class="l77-history-table__choice"><span class="l77-history-table__icon"><img src="${src}" alt="" /></span>${label}</span></td>
      <td class="l77-history-table__mult">×${odd}</td>
    </tr>`;
  }).join('');
}

function setupHistoryModal() {
  const modal = $('history-modal');
  const close = () => { modal.hidden = true; };
  $('btn-history').addEventListener('click', async () => {
    modal.hidden = false;
    renderHistoryTable(cachedHistory.slice(0, HISTORY_MODAL_COUNT));
    try {
      const { periods } = await periodList(config, { Idx: 1, Size: HISTORY_MODAL_COUNT });
      cachedHistory = periods.map(historyRowMeta).filter(Boolean);
      renderHistoryBar();
      renderHistoryTable(cachedHistory);
    } catch (err) {
      if (!(err instanceof LotteryApiError && err.offline)) {
        console.warn('[lucky77] history modal', err);
      }
    }
  });
  $('history-close').addEventListener('click', close);
  $('history-backdrop').addEventListener('click', close);
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
    const { periods } = await periodList(config, { Idx: 1, Size: HISTORY_MODAL_COUNT });
    cachedHistory = periods.map(historyRowMeta).filter(Boolean);
    renderHistoryBar();
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
  setupSettings();
  setupHistoryModal();

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
