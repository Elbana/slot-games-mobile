import { rocketInit, rocketState, rocketBet, rocketCashout } from './api.js';

const ASSET = '/rocket/assets';

let chips = [5000, 25000, 50000, 250000];
let selectedChip = 5000;
let autoCashout = 0;
let state = null;
let prevPhase = null;
let winBannerTimer = null;
let rocketImg = null;
let lastPing = 72;
let smoothMult = 1;
let flyStartPerf = 0;
let serverClockSkew = 0;
let lastRoundId = 0;
let animTime = 0;
/** @type {{ x: number, y: number, start: number, dur: number, particles: object[] } | null} */
let explosion = null;
/** @type {{ x: number, y: number }[]} */
let trailHistory = [];

/** Match server curve: mult = exp(MULT_K * seconds) */
const MULT_K = 0.085;

const canvas = document.getElementById('rk-canvas');
const ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function fmtChip(v) {
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}K`;
  return String(v);
}

function fmtMult(m) {
  return `${Number(m).toFixed(2)}X`;
}

function pillClass(mult) {
  if (mult >= 5) return 'rk-pill--high';
  if (mult >= 2) return 'rk-pill--mid';
  return 'rk-pill--low';
}

function renderHistory(history) {
  $('history-bar').innerHTML = (history || []).slice(0, 12).map((m, i) => {
    const latest = i === 0 ? ' rk-pill--latest' : '';
    return `<span class="rk-pill ${pillClass(m)}${latest}">${Number(m).toFixed(2)}x</span>`;
  }).join('');
}

const CHIP_TIER = {
  5000: '5k',
  25000: '25k',
  50000: '50k',
  250000: '250k',
};

function chipTier(v) {
  return CHIP_TIER[v] || '5k';
}

function fuelCanSrc(v) {
  return `${ASSET}/fuel-can-${chipTier(v)}.svg`;
}

function buildChips() {
  $('chips').innerHTML = chips.map((v) => `
    <button type="button" class="rk-chip rk-chip--${chipTier(v)}${v === selectedChip ? ' active' : ''}" data-chip="${v}">
      <img class="rk-chip__can" src="${fuelCanSrc(v)}" alt="" />
      <span>${fmtChip(v)}</span>
    </button>`).join('');
  $('chips').querySelectorAll('.rk-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
      updateActionAmt();
    });
  });
}

function updateActionAmt() {
  const label = fmtChip(selectedChip);
  $('action-amt').textContent = label;
  $('auto-bet-amt').textContent = label;
}

function showWinBanner(mult) {
  $('win-banner').hidden = false;
  $('live-mult').classList.add('is-hidden');
  $('win-mult').textContent = fmtMult(mult);
  clearTimeout(winBannerTimer);
  winBannerTimer = setTimeout(() => {
    $('win-banner').hidden = true;
    $('live-mult').classList.remove('is-hidden');
  }, 2800);
}

function updateActionButton() {
  const btn = $('btn-action');
  const phase = state?.phase;
  const bet = state?.myBet;

  btn.classList.remove('rk-action--cashout');
  btn.disabled = false;

  if (phase === 'betting') {
    $('action-label').textContent = 'BET';
    if (bet && (bet.status === 'pending' || bet.status === 'active')) {
      btn.disabled = true;
    }
  } else if (phase === 'flying') {
    if (bet?.status === 'active') {
      $('action-label').textContent = 'CASH OUT';
      btn.classList.add('rk-action--cashout');
    } else {
      $('action-label').textContent = 'BET';
      btn.disabled = true;
    }
  } else {
    $('action-label').textContent = 'BET';
    btn.disabled = true;
  }
}

function applyState(data) {
  state = data;
  if (data.serverTime) {
    serverClockSkew = performance.now() - data.serverTime;
  }
  if (data.balance != null) {
    $('balance').textContent = Number(data.balance).toLocaleString();
  }
  $('players-count').textContent = `${data.playerCount || 3}/${data.maxPlayers || 13}`;
  renderHistory(data.history);
  $('live-mult').textContent = fmtMult(data.multiplier || 1);

  if (data.phase === 'flying') {
    $('win-banner').hidden = true;
    $('live-mult').classList.remove('is-hidden');
  }

  if (prevPhase === 'flying' && data.phase === 'ended') {
    const bet = data.myBet;
    if (bet?.status === 'cashed_out' && bet.cashoutMult) {
      showWinBanner(bet.cashoutMult);
    }
    const w = canvas.width;
    const h = canvas.height;
    if (w && h) {
      const { p0, p1, p2 } = flightPath(w, h);
      const t = multToProgress(data.multiplier || smoothMult, 'ended');
      const crashPos = quadPoint(p0, p1, p2, t);
      triggerExplosion(crashPos.x, crashPos.y, w);
    }
  }

  if (data.phase === 'flying' && (prevPhase !== 'flying' || data.roundId !== lastRoundId)) {
    flyStartPerf = data.flyStartMs ? data.flyStartMs + serverClockSkew : performance.now();
    smoothMult = 1;
    trailHistory = [];
  }
  if (data.phase === 'betting' && prevPhase !== 'betting') {
    smoothMult = 1;
    trailHistory = [];
    explosion = null;
  }
  lastRoundId = data.roundId;

  updateActionButton();
  prevPhase = data.phase;
}

async function pollState() {
  const t0 = performance.now();
  try {
    const data = await rocketState();
    lastPing = Math.round(performance.now() - t0);
    $('ping').textContent = `${lastPing}ms`;
    applyState(data);
  } catch (err) {
    toast(err.message || 'Connection error');
  }
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  trailHistory = [];
}

function drawStars(w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const seed = 42;
  for (let i = 0; i < 80; i++) {
    const x = ((seed * (i + 1) * 97) % 1000) / 1000 * w;
    const y = ((seed * (i + 1) * 53) % 1000) / 1000 * h;
    const r = (i % 3 === 0 ? 1.2 : 0.8) * dpr;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(200,220,255,0.9)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function multToProgress(mult, phase) {
  if (phase === 'betting') return 0;
  const m = Math.max(1, mult);
  // Longer flights travel further along the arc (log scale feels natural for crash games)
  const progress = Math.log(m) / Math.log(55);
  return phase === 'ended' ? Math.min(1, progress) : Math.min(0.98, progress);
}

function flightPath(w, h) {
  return {
    p0: { x: w * 0.11, y: h * 0.91 },
    p1: { x: w * 0.48, y: h * 0.68 },
    p2: { x: w * 0.76, y: h * 0.22 },
  };
}

function quadPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function quadTangent(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function padAngle(p0, p1) {
  return Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2;
}

function triggerExplosion(x, y, w) {
  const n = 28;
  explosion = {
    x,
    y,
    start: performance.now(),
    dur: 1400,
    particles: Array.from({ length: n }, (_, i) => ({
      angle: (i / n) * Math.PI * 2 + Math.random() * 0.4,
      speed: (1.5 + Math.random() * 3.5) * w * 0.00035,
      size: (4 + Math.random() * 10) * dpr,
      kind: i % 3,
    })),
  };
}

function pushTrailPoint(pos, w) {
  const last = trailHistory[trailHistory.length - 1];
  if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > w * 0.006) {
    trailHistory.push({ x: pos.x, y: pos.y });
    if (trailHistory.length > 72) trailHistory.shift();
  }
}

function drawSmoothTrail(w, p0, head) {
  const pts = [p0, ...trailHistory];
  if (head && (pts.length === 0 || pts[pts.length - 1].x !== head.x)) {
    pts.push(head);
  }
  if (pts.length < 2) return;

  const pulse = 0.85 + Math.sin(animTime * 0.018) * 0.15;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft outer glow
  ctx.strokeStyle = `rgba(255, 90, 60, ${0.22 * pulse})`;
  ctx.lineWidth = 8 * dpr;
  ctx.shadowColor = 'rgba(255, 120, 80, 0.6)';
  ctx.shadowBlur = 14 * dpr;
  strokeMidpointCurve(pts);
  ctx.stroke();

  // Core trail with gradient along length
  const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
  grad.addColorStop(0, 'rgba(255, 70, 50, 0.15)');
  grad.addColorStop(0.45, 'rgba(255, 110, 70, 0.55)');
  grad.addColorStop(1, `rgba(255, 200, 120, ${0.95 * pulse})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = (2.8 + Math.sin(animTime * 0.022) * 0.6) * dpr;
  ctx.shadowBlur = 8 * dpr;
  strokeMidpointCurve(pts);
  ctx.stroke();

  ctx.restore();
}

function strokeMidpointCurve(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawFlameAttached(rw, rh, intensity = 1) {
  const flicker = 0.82 + Math.sin(animTime * 0.028) * 0.18;
  const len = rh * 0.52 * flicker * intensity;
  const halfW = rw * 0.16;
  const tailY = rh * 0.33;

  ctx.save();
  ctx.translate(0, tailY);
  ctx.shadowColor = 'rgba(255, 150, 50, 0.95)';
  ctx.shadowBlur = 18 * dpr;

  const outer = ctx.createLinearGradient(0, 0, 0, len);
  outer.addColorStop(0, 'rgba(255, 248, 180, 0.98)');
  outer.addColorStop(0.2, 'rgba(255, 180, 50, 0.92)');
  outer.addColorStop(0.55, 'rgba(255, 90, 20, 0.75)');
  outer.addColorStop(1, 'rgba(255, 40, 0, 0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(-halfW, 0);
  ctx.quadraticCurveTo(0, len * 1.2, halfW, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 230, 0.85)';
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.35, 0);
  ctx.lineTo(0, len * 0.55);
  ctx.lineTo(halfW * 0.35, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRocketAt(w, pos, angle, wobble, { flame = false, alpha = 1, flameIntensity = 1 } = {}) {
  if (!rocketImg || alpha <= 0) return;
  const rw = w * 0.13;
  const rh = rw * 1.35;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle + wobble);
  ctx.drawImage(rocketImg, -rw / 2, -rh * 0.62, rw, rh);
  if (flame) drawFlameAttached(rw, rh, flameIntensity);
  ctx.restore();
}

function drawExplosion(w, now) {
  if (!explosion) return;
  const age = now - explosion.start;
  if (age > explosion.dur) {
    explosion = null;
    return;
  }
  const p = age / explosion.dur;
  const fade = 1 - p * p;

  ctx.save();

  // Flash burst
  const flashR = w * (0.04 + p * 0.14);
  const flash = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, flashR);
  flash.addColorStop(0, `rgba(255, 250, 200, ${0.85 * fade})`);
  flash.addColorStop(0.35, `rgba(255, 160, 40, ${0.5 * fade})`);
  flash.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, flashR, 0, Math.PI * 2);
  ctx.fill();

  // Particles
  for (const pt of explosion.particles) {
    const dist = pt.speed * age;
    const px = explosion.x + Math.cos(pt.angle) * dist;
    const py = explosion.y + Math.sin(pt.angle) * dist;
    const a = fade * (pt.kind === 0 ? 1 : 0.7);
    if (pt.kind === 2) {
      ctx.fillStyle = `rgba(180, 180, 180, ${a * 0.5})`;
    } else if (pt.kind === 1) {
      ctx.fillStyle = `rgba(255, 120, 30, ${a})`;
    } else {
      ctx.fillStyle = `rgba(255, 230, 100, ${a})`;
    }
    ctx.beginPath();
    ctx.arc(px, py, pt.size * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // Smoke ring
  ctx.strokeStyle = `rgba(120, 80, 60, ${0.45 * fade})`;
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, w * (0.03 + p * 0.1), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawScene(mult, phase, now = performance.now()) {
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;

  drawStars(w, h);

  const { p0, p1, p2 } = flightPath(w, h);
  const launchAngle = padAngle(p0, p1);
  const exploding = explosion && now - explosion.start < explosion.dur;

  // Ghost path
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 70, 50, 0.1)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i <= 56; i++) {
    const pt = quadPoint(p0, p1, p2, i / 56);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.restore();

  if (phase === 'betting') {
    const idleBob = Math.sin(animTime * 0.004) * w * 0.004;
    const padWobble = Math.sin(animTime * 0.005) * 0.012;
    const padPos = { x: p0.x, y: p0.y + idleBob };
    const rw = w * 0.13;
    const rh = rw * 1.35;
    drawRocketAt(w, padPos, launchAngle, padWobble, { flame: false });
    ctx.save();
    ctx.translate(padPos.x, padPos.y);
    ctx.rotate(launchAngle + padWobble);
    drawFlameAttached(rw, rh, 0.32 + Math.sin(animTime * 0.012) * 0.1);
    ctx.restore();
    return;
  }

  const progress = multToProgress(mult, phase);
  const t = Math.max(0, Math.min(0.999, progress));
  const pos = quadPoint(p0, p1, p2, t);
  const tan = quadTangent(p0, p1, p2, Math.max(0.01, t));
  const speed = Math.hypot(tan.x, tan.y) || 1;
  const nx = tan.x / speed;
  const ny = tan.y / speed;
  const angle = Math.atan2(ny, nx) + Math.PI / 2;
  const wobble = phase === 'flying' ? Math.sin(animTime * 0.009) * 0.028 : 0;

  if (phase === 'flying') {
    pushTrailPoint(pos, w);
    drawSmoothTrail(w, p0, pos);
    drawRocketAt(w, pos, angle, wobble, { flame: true, flameIntensity: 1 });
  } else if (phase === 'ended') {
    drawSmoothTrail(w, p0, null);
    if (!exploding) {
      drawRocketAt(w, pos, angle, 0, { flame: false });
    }
    drawExplosion(w, now);
  }
}

async function handleAction() {
  if (!state) return;
  if (state.phase === 'betting') {
    try {
      const data = await rocketBet(selectedChip, autoCashout);
      applyState({ ...state, ...data.state, balance: data.balance, myBet: data.myBet });
      toast(`Bet ${fmtChip(selectedChip)} placed`);
    } catch (err) {
      toast(err.message || 'Bet failed');
    }
  } else if (state.phase === 'flying' && state.myBet?.status === 'active') {
    try {
      const data = await rocketCashout();
      showWinBanner(data.multiplier);
      applyState({ ...state, balance: data.balance, myBet: data.myBet, multiplier: data.multiplier });
      toast(`Cashed out ${fmtMult(data.multiplier)}`);
    } catch (err) {
      toast(err.message || 'Cash out failed');
    }
  }
}

function setupAutoCashout() {
  const pop = $('auto-pop');
  $('btn-auto').addEventListener('click', () => {
    pop.hidden = !pop.hidden;
  });
  $('auto-apply').addEventListener('click', () => {
    const v = Number($('auto-input').value);
    if (v >= 1.1) {
      autoCashout = v;
      $('auto-label').textContent = `${v.toFixed(2)}x`;
    }
    pop.hidden = true;
  });
  $('auto-clear').addEventListener('click', () => {
    autoCashout = 0;
    $('auto-label').textContent = 'Off';
    pop.hidden = true;
  });
}

async function init() {
  rocketImg = new Image();
  rocketImg.src = `${ASSET}/rocket.svg`;

  try {
    const data = await rocketInit();
    if (data.betting?.chipPresets?.length) {
      chips = data.betting.chipPresets;
      selectedChip = data.betting.defaultChip || chips[0];
    }
    buildChips();
    updateActionAmt();
    applyState({ ...data.state, balance: data.balance });
  } catch (err) {
    toast(err.message || 'Cannot start game');
  }

  $('btn-action').addEventListener('click', handleAction);
  $('btn-topup').addEventListener('click', () => toast('Demo wallet — use launcher token'));
  $('btn-menu').addEventListener('click', () => toast('Settings coming soon'));
  setupAutoCashout();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const stage = canvas.parentElement;
  if (stage && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resizeCanvas).observe(stage);
  }

  async function loop() {
    await pollState();
    const ms = state?.phase === 'flying' ? 80 : 400;
    setTimeout(loop, ms);
  }
  loop();
  window.addEventListener('gm-realtime', () => pollState());

  function animFrame(now) {
    animTime = now;
    if (!state) {
      requestAnimationFrame(animFrame);
      return;
    }

    let mult = state.multiplier || 1;
    const phase = state.phase;

    if (phase === 'flying') {
      const target = state.multiplier || 1;
      smoothMult += (target - smoothMult) * 0.14;
      const elapsed = (now - flyStartPerf) / 1000;
      const local = Math.exp(MULT_K * elapsed);
      mult = Math.min(target + 0.08, Math.max(smoothMult, local * 0.98));
      $('live-mult').textContent = fmtMult(mult);
    }

    drawScene(mult, phase, now);
    requestAnimationFrame(animFrame);
  }
  requestAnimationFrame(animFrame);
}

init();
