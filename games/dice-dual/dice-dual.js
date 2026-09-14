import { diceDualInit, diceDualState, diceDualBet } from './api.js';

const ASSET = '/dice-dual/assets';
const NUM_DICE = 5;
const RING_C = 238.76;

const DICE_PIPS = {
  1: [[0, 0]],
  2: [[-0.28, -0.28], [0.28, 0.28]],
  3: [[-0.28, -0.28], [0, 0], [0.28, 0.28]],
  4: [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]],
  5: [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]],
  6: [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0], [0.28, 0], [-0.28, 0.28], [0.28, 0.28]],
};

const FLAG_SRC = {
  red: `${ASSET}/flag-red.svg`,
  blue: `${ASSET}/flag-blue.svg`,
  draw: `${ASSET}/flag-draw.svg`,
};

const CHIP_STYLE_CLASSES = ['100', '1k', '10k', '100k', '100k', '100k'];

let chips = [200, 1000, 5000, 10000, 50000, 100000];
let selectedChip = 200;
let state = null;
let prevPhase = null;
let animTime = 0;
let lastOverlayKey = '';
let cachedHistory = [];
/** @type {{ pred: string, amount: number } | null} */
let lastBet = null;
let betLock = false;

/** @type {{ x:number,y:number,vx:number,vy:number,life:number,color:string,size:number }[]} */
let confetti = [];

const flagImgs = { red: null, blue: null, draw: null };

const vis = {
  phase: 'betting',
  redDice: Array(NUM_DICE).fill(1),
  blueDice: Array(NUM_DICE).fill(1),
  redDisplay: Array(NUM_DICE).fill(1),
  blueDisplay: Array(NUM_DICE).fill(1),
  redRoll: Array(NUM_DICE).fill(0),
  blueRoll: Array(NUM_DICE).fill(0),
  redScore: 0,
  blueScore: 0,
  winner: null,
  battleStart: 0,
};

const arenaCanvas = document.getElementById('dd-arena');
const arenaCtx = arenaCanvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const $ = (id) => document.getElementById(id);

function chipLabel(v) {
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}k`;
  return String(v);
}

function chipStyleClass(v) {
  const idx = chips.indexOf(v);
  return CHIP_STYLE_CLASSES[Math.max(0, Math.min(idx, CHIP_STYLE_CLASSES.length - 1))];
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

function applyBettingConfig(betting) {
  if (!betting?.chipUnits?.length) return;
  chips = betting.chipUnits.map((v) => Math.floor(Number(v))).filter((v) => v > 0);
  if (!chips.length) return;
  const preferred = Math.floor(Number(betting.defaultChip));
  selectedChip = chips.includes(preferred) ? preferred : chips[0];
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function outcomeKind(outcome) {
  if (outcome === 'draw') return 'draw';
  return outcome === 'redWins' ? 'red' : 'blue';
}

function loadFlags() {
  for (const key of ['red', 'blue', 'draw']) {
    const img = new Image();
    img.src = FLAG_SRC[key];
    flagImgs[key] = img;
  }
}

function resize() {
  const rect = arenaCanvas.parentElement.getBoundingClientRect();
  arenaCanvas.width = Math.floor(rect.width * dpr);
  arenaCanvas.height = Math.floor(rect.height * dpr);
  arenaCanvas.style.width = `${rect.width}px`;
  arenaCanvas.style.height = `${rect.height}px`;
}

function burstConfetti(color) {
  for (let i = 0; i < 50; i++) {
    confetti.push({
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.35,
      vx: (Math.random() - 0.5) * 0.012,
      vy: -0.004 - Math.random() * 0.012,
      life: 1,
      color: color || ['#fbbf24', '#4ade80', '#60a5fa'][Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 5,
    });
  }
}

function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawNormalDie(ctx, x, y, size, value, accent, rot) {
  const s = size;
  const r = s * 0.18;

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, -s / 2 + 1, -s / 2 + 2, s, s, r);
  ctx.fill();

  const face = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = face;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  roundRect(ctx, -s / 2, -s / 2, s, s, r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  const pips = DICE_PIPS[value] || DICE_PIPS[1];
  const pipR = Math.max(1.2, s * 0.09);
  for (const [px, py] of pips) {
    ctx.beginPath();
    ctx.arc(px * s * 0.68, py * s * 0.68, pipR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawDiceRow(ctx, cx, cy, displays, rolls, accent, panelW) {
  const gap = 3;
  const dieSize = Math.min(20, (panelW - gap * (NUM_DICE - 1) - 8) / NUM_DICE);
  const totalW = NUM_DICE * dieSize + gap * (NUM_DICE - 1);
  const startX = cx - totalW / 2 + dieSize / 2;
  for (let i = 0; i < NUM_DICE; i++) {
    drawNormalDie(ctx, startX + i * (dieSize + gap), cy, dieSize, displays[i], accent, rolls[i]);
  }
}

function drawFlag(ctx, x, y, kind, size) {
  const img = flagImgs[kind];
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  } else {
    ctx.fillStyle = kind === 'red' ? '#ef4444' : kind === 'blue' ? '#3b82f6' : '#eab308';
    ctx.fillRect(x - size / 2, y - size / 2, size, size * 0.65);
  }
}

function drawTeamPanel(ctx, cx, cy, pw, ph, kind, accent, displays, rolls, score, isWinner, shakeX) {
  ctx.save();
  ctx.translate(cx + shakeX, cy);

  const bg = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
  bg.addColorStop(0, `${accent}33`);
  bg.addColorStop(1, `${accent}10`);
  ctx.fillStyle = bg;
  ctx.strokeStyle = isWinner ? '#fbbf24' : `${accent}88`;
  ctx.lineWidth = isWinner ? 2 : 1.5;
  if (isWinner) {
    ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
    ctx.shadowBlur = 10;
  }
  roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 10);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawDiceRow(ctx, 0, -14, displays, rolls, accent, pw - 6);

  const scoreText = typeof score === 'number' ? String(score) : score;
  ctx.fillStyle = accent;
  ctx.font = '900 18px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(scoreText, 0, ph / 2 - 30);

  drawFlag(ctx, 0, ph / 2 - 12, kind, 22);

  ctx.restore();
}

function drawConfetti(w, h) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.00035;
    p.life -= 0.012;
    if (p.life <= 0) { confetti.splice(i, 1); continue; }
    arenaCtx.globalAlpha = p.life;
    arenaCtx.fillStyle = p.color;
    arenaCtx.fillRect(p.x * w, p.y * h, p.size, p.size * 0.55);
  }
  arenaCtx.globalAlpha = 1;
}

function drawArena() {
  const w = arenaCanvas.width / dpr;
  const h = arenaCanvas.height / dpr;
  arenaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  arenaCtx.clearRect(0, 0, w, h);

  const padX = 2;
  const vsGap = 34;
  const innerW = w - padX * 2;
  const pw = (innerW - vsGap) / 2;
  const ph = h - 6;
  const cy = h / 2;
  const leftCx = padX + pw / 2;
  const rightCx = w - padX - pw / 2;

  const shakeR = vis.phase === 'battling' ? Math.sin(animTime * 0.04) * 2 : 0;
  const shakeB = vis.phase === 'battling' ? Math.sin(animTime * 0.04 + 1.2) * 2 : 0;

  drawTeamPanel(arenaCtx, leftCx, cy, pw, ph, 'red', '#ef4444',
    vis.redDisplay, vis.redRoll, vis.redScore, vis.winner === 'red', shakeR);
  drawTeamPanel(arenaCtx, rightCx, cy, pw, ph, 'blue', '#3b82f6',
    vis.blueDisplay, vis.blueRoll, vis.blueScore, vis.winner === 'blue', shakeB);

  const vsX = w / 2;
  const vsR = 14;
  arenaCtx.fillStyle = 'rgba(0,0,0,0.35)';
  arenaCtx.beginPath();
  arenaCtx.arc(vsX, cy, vsR + 3, 0, Math.PI * 2);
  arenaCtx.fill();
  const vg = arenaCtx.createRadialGradient(vsX, cy, 0, vsX, cy, vsR);
  vg.addColorStop(0, '#fde68a');
  vg.addColorStop(1, '#d97706');
  arenaCtx.fillStyle = vg;
  arenaCtx.beginPath();
  arenaCtx.arc(vsX, cy, vsR, 0, Math.PI * 2);
  arenaCtx.fill();
  arenaCtx.fillStyle = '#451a03';
  arenaCtx.font = 'bold 9px system-ui,sans-serif';
  arenaCtx.textAlign = 'center';
  arenaCtx.textBaseline = 'middle';
  arenaCtx.fillText('VS', vsX, cy);

  drawConfetti(w, h);
}

function updateDiceAnim() {
  if (vis.phase === 'battling') {
    const elapsed = animTime - vis.battleStart;
    for (let i = 0; i < NUM_DICE; i++) {
      const stopAt = 500 + i * 220;
      if (elapsed < stopAt) {
        vis.redDisplay[i] = 1 + Math.floor(Math.random() * 6);
        vis.blueDisplay[i] = 1 + Math.floor(Math.random() * 6);
        vis.redRoll[i] = elapsed * 0.028 + i * 0.7;
        vis.blueRoll[i] = elapsed * 0.028 + i * 0.7 + 0.4;
      } else {
        vis.redDisplay[i] = vis.redDice[i];
        vis.blueDisplay[i] = vis.blueDice[i];
        vis.redRoll[i] *= 0.82;
        vis.blueRoll[i] *= 0.82;
      }
    }
    vis.redScore = elapsed > 1600 ? vis.redDice.reduce((a, b) => a + b, 0) : '…';
    vis.blueScore = elapsed > 1600 ? vis.blueDice.reduce((a, b) => a + b, 0) : '…';
  } else {
    vis.redDisplay = [...vis.redDice];
    vis.blueDisplay = [...vis.blueDice];
    if (vis.redDice.length) vis.redScore = vis.redDice.reduce((a, b) => a + b, 0);
    if (vis.blueDice.length) vis.blueScore = vis.blueDice.reduce((a, b) => a + b, 0);
  }
}

function animLoop(ts) {
  animTime = ts;
  updateDiceAnim();
  drawArena();
  requestAnimationFrame(animLoop);
}

function renderHistoryBar(history) {
  cachedHistory = history || [];
  $('history-bar').innerHTML = cachedHistory.slice(0, 12).map((h, i) => {
    const kind = outcomeKind(h.outcome);
    const latest = i === 0 ? ' dd-dot--latest' : '';
    return `<span class="dd-dot${latest}" title="#${h.round} ${h.redScore}-${h.blueScore}">
      <img src="${FLAG_SRC[kind]}" alt="${kind}" loading="lazy" />
    </span>`;
  }).join('');
}

function renderHistoryGrid() {
  const grid = $('history-grid');
  if (!cachedHistory.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:0.5;font-size:12px">No results yet</p>';
    return;
  }
  grid.innerHTML = cachedHistory.map((h, i) => {
    const kind = outcomeKind(h.outcome);
    const latest = i === 0 ? ' dd-history-cell--latest' : '';
    return `<div class="dd-history-cell${latest}" title="Round ${h.round}: ${h.redScore}-${h.blueScore}">
      <img src="${FLAG_SRC[kind]}" alt="${kind}" loading="lazy" />
    </div>`;
  }).join('');
}

function setupHistoryModal() {
  const modal = $('history-modal');
  const close = () => { modal.hidden = true; };
  $('btn-history').addEventListener('click', () => {
    renderHistoryGrid();
    modal.hidden = false;
  });
  $('history-close').addEventListener('click', close);
  $('history-backdrop').addEventListener('click', close);
}

function buildChips() {
  $('chips').innerHTML = chips.map((v) => {
    const cls = chipStyleClass(v);
    return `<button type="button" class="dd-chip dd-chip--${cls}${v === selectedChip ? ' active' : ''}" data-chip="${v}">${chipLabel(v)}</button>`;
  }).join('');
  $('chips').querySelectorAll('.dd-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
    });
  });
}

function flyChipToTeam(pred, amount) {
  const chipBtn = document.querySelector(`.dd-chip[data-chip="${amount}"]`)
    || document.querySelector('.dd-chip.active');
  const teamBtn = document.querySelector(`.dd-pick__btn[data-pred="${pred}"]`);
  const layer = $('dd-fx');
  if (!chipBtn || !teamBtn || !layer) return;

  const from = chipBtn.getBoundingClientRect();
  const to = teamBtn.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = `dd-chip-fly dd-chip-fly--${chipStyleClass(amount)}`;
  chip.textContent = chipLabel(amount);
  chip.style.setProperty('--from-x', `${from.left + from.width / 2}px`);
  chip.style.setProperty('--from-y', `${from.top + from.height / 2}px`);
  chip.style.setProperty('--to-x', `${to.left + to.width / 2}px`);
  chip.style.setProperty('--to-y', `${to.top + to.height / 2}px`);
  layer.appendChild(chip);
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
}

function updatePickButtons() {
  const betting = state?.phase === 'betting' && !state?.myBet;
  document.querySelectorAll('.dd-pick__btn').forEach((btn) => {
    btn.disabled = !betting;
    const pred = btn.dataset.pred;
    const myBet = state?.myBet;
    const amt = myBet?.prediction === pred ? myBet.amount : 0;
    btn.querySelector('[data-amt]').textContent = amt > 0 ? fmtNum(amt) : '0';
    btn.classList.toggle('has-bet', amt > 0);
  });
}

async function doBet(pred) {
  if (betLock) return;
  if (state?.myBet) {
    toast('Already bet this round');
    return;
  }
  if (state?.phase !== 'betting') {
    toast('Betting closed — wait for next round');
    return;
  }
  const amount = selectedChip;
  if ((state?.balance ?? 0) < amount) {
    toast('Insufficient balance');
    return;
  }

  betLock = true;
  flyChipToTeam(pred, amount);
  try {
    const data = await diceDualBet(pred, amount);
    lastBet = { pred, amount };
    applyState({ ...data.state, balance: data.balance, myBet: data.myBet });
  } catch (err) {
    toast(err.message || 'Bet failed');
  } finally {
    betLock = false;
  }
}

function setTimerRing(countdown, phase) {
  const max = phase === 'betting' ? 15 : phase === 'battling' ? 4 : 3;
  $('timer-ring').style.strokeDashoffset = String(RING_C * (1 - Math.max(0, countdown / max)));
}

function showOverlay(myBet, battle) {
  const overlay = $('overlay');
  const card = $('overlay-card');
  if (!myBet || !battle || state?.phase !== 'results') {
    overlay.hidden = true;
    lastOverlayKey = '';
    return;
  }
  const key = `${state.roundId}-${myBet.status}`;
  if (key === lastOverlayKey) return;
  lastOverlayKey = key;
  overlay.hidden = false;
  if (myBet.status === 'won') {
    card.className = 'dd-overlay__card dd-overlay__card--win';
    card.innerHTML = `GREAT WIN!<span class="dd-overlay__sub">+${fmtNum(myBet.winAmount)} coins</span>`;
    burstConfetti('#4ade80');
  } else {
    card.className = 'dd-overlay__card dd-overlay__card--lose';
    card.innerHTML = `DEFEAT<span class="dd-overlay__sub">Wrong pick this round</span>`;
  }
  setTimeout(() => { if (state?.phase !== 'results') overlay.hidden = true; }, 2800);
}

function syncVis(next) {
  const battle = next.battle;
  if (prevPhase !== next.phase && next.phase === 'battling' && battle) {
    vis.battleStart = animTime;
    vis.redDice = [...battle.redDice];
    vis.blueDice = [...battle.blueDice];
  }
  if (battle) {
    vis.redDice = [...battle.redDice];
    vis.blueDice = [...battle.blueDice];
    vis.winner = battle.winningTeam;
  } else if (next.phase === 'betting') {
    vis.redDice = Array(NUM_DICE).fill(1);
    vis.blueDice = Array(NUM_DICE).fill(1);
    vis.redScore = 0;
    vis.blueScore = 0;
    vis.winner = null;
    lastOverlayKey = '';
    $('overlay').hidden = true;
  }
  vis.phase = next.phase;
}

function applyState(next) {
  prevPhase = state?.phase ?? null;
  state = next;

  $('balance').textContent = fmtNum(next.balance ?? 0);
  $('round-id').textContent = String(next.roundId ?? '—');
  $('countdown').textContent = String(next.countdown ?? 0);
  setTimerRing(next.countdown ?? 0, next.phase);

  const chip = $('phase-chip');
  chip.textContent = next.phase === 'betting' ? 'Pick red, blue, or draw'
    : next.phase === 'battling' ? 'Rolling dice…' : 'Round result';
  chip.classList.toggle('is-battle', next.phase === 'battling');
  chip.classList.toggle('is-result', next.phase === 'results');

  $('red-pool').textContent = `Red ${fmtNum(next.redPool)}`;
  $('draw-pool').textContent = `Draw ${fmtNum(next.drawPool)}`;
  $('blue-pool').textContent = `Blue ${fmtNum(next.bluePool)}`;
  renderHistoryBar(next.history);

  syncVis(next);
  updatePickButtons();
  showOverlay(next.myBet, next.battle);
}

async function poll() {
  try { applyState(await diceDualState()); } catch { /* retry */ }
}

async function init() {
  loadFlags();
  resize();
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(arenaCanvas.parentElement);
  }
  setupHistoryModal();
  requestAnimationFrame(animLoop);

  buildChips();

  document.querySelectorAll('.dd-pick__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      doBet(btn.dataset.pred).catch(() => {});
    });
  });

  $('btn-repeat').addEventListener('click', async () => {
    if (!lastBet) {
      toast('No previous bet');
      return;
    }
    if (state?.myBet) {
      toast('Already bet this round');
      return;
    }
    if (state?.phase !== 'betting') {
      toast('Betting closed — wait for next round');
      return;
    }
    if (chips.includes(lastBet.amount)) {
      selectedChip = lastBet.amount;
    } else {
      selectedChip = chips.filter((c) => c <= lastBet.amount).pop() || chips[0];
    }
    buildChips();
    await doBet(lastBet.pred);
  });

  try {
    const data = await diceDualInit();
    applyBettingConfig(data.betting);
    buildChips();
    applyState({ ...data.state, balance: data.balance, myBet: data.state.myBet });
  } catch (err) {
    toast(err.message || 'Failed to load');
  }

  setInterval(poll, 400);
}

init();
