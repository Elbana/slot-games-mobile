import { diceDualInit, diceDualState, diceDualBet } from './api.js';

const ASSET = '/dice-dual/assets';
const NUM_DICE = 5;
const RING_C = 238.76;
const BATTLE_REVEAL_MS = 1750;

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
/** @type {{ x:number,y:number,vx:number,vy:number,life:number,len:number }[]} */
let sparks = [];

const imgs = {
  flag: { red: null, blue: null, draw: null },
  shield: { red: null, blue: null },
  arenaBg: null,
  vsBadge: null,
};

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
  outcome: null,
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

function loadImg(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function loadAssets() {
  for (const key of ['red', 'blue', 'draw']) {
    imgs.flag[key] = loadImg(FLAG_SRC[key]);
  }
  imgs.shield.red = loadImg(`${ASSET}/shield-red.svg`);
  imgs.shield.blue = loadImg(`${ASSET}/shield-blue.svg`);
  imgs.arenaBg = loadImg(`${ASSET}/arena-bg.svg`);
  imgs.vsBadge = loadImg(`${ASSET}/vs-badge.svg`);
}

function isBattleRevealed() {
  if (vis.phase === 'betting') return false;
  if (vis.phase === 'results') return true;
  if (vis.battleStart <= 0) return false;
  return animTime - vis.battleStart >= BATTLE_REVEAL_MS;
}

function winnerHighlight() {
  if (!isBattleRevealed()) return { red: false, blue: false, draw: false };
  if (vis.outcome === 'draw') return { red: false, blue: false, draw: true };
  return {
    red: vis.winner === 'red',
    blue: vis.winner === 'blue',
    draw: false,
  };
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

function drawNormalDie(ctx, x, y, size, value, rot) {
  const s = size;
  const r = s * 0.18;

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);

  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  roundRect(ctx, -s / 2 + 1, -s / 2 + 2, s, s, r);
  ctx.fill();

  const face = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = face;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
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

function drawDiceRow(ctx, cx, cy, displays, rolls, panelW) {
  const gap = 3;
  const dieSize = Math.min(20, (panelW - gap * (NUM_DICE - 1) - 8) / NUM_DICE);
  const totalW = NUM_DICE * dieSize + gap * (NUM_DICE - 1);
  const startX = cx - totalW / 2 + dieSize / 2;
  for (let i = 0; i < NUM_DICE; i++) {
    drawNormalDie(ctx, startX + i * (dieSize + gap), cy, dieSize, displays[i], rolls[i]);
  }
}

function drawImage(ctx, img, x, y, size) {
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return true;
  }
  return false;
}

function drawTeamPanel(ctx, cx, cy, pw, ph, kind, accent, displays, rolls, score, hi, shakeX, glowT) {
  ctx.save();
  ctx.translate(cx + shakeX, cy);

  const pulse = hi ? 0.55 + 0.45 * Math.sin(glowT * 8) : 0;

  const frame = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
  frame.addColorStop(0, 'rgba(255,255,255,0.12)');
  frame.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  frame.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = frame;
  ctx.strokeStyle = hi ? `rgba(251, 191, 36, ${0.55 + pulse * 0.35})` : 'rgba(255,255,255,0.14)';
  ctx.lineWidth = hi ? 2 + pulse : 1.5;
  if (hi) {
    ctx.shadowColor = `rgba(251, 191, 36, ${0.25 + pulse * 0.35})`;
    ctx.shadowBlur = 6 + pulse * 14;
  }
  roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 12);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = accent;
  roundRect(ctx, -pw / 2 + 4, -ph / 2 + 4, pw - 8, 18, 6);
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  const shield = imgs.shield[kind];
  if (!drawImage(ctx, shield, -pw / 2 + 16, -ph / 2 + 13, 16)) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-pw / 2 + 16, -ph / 2 + 13, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '800 9px system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind.toUpperCase(), -pw / 2 + 28, -ph / 2 + 13);

  drawDiceRow(ctx, 0, -6, displays, rolls, pw - 10);

  const scoreText = typeof score === 'number' ? String(score) : score;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -18, ph / 2 - 34, 36, 18, 9);
  ctx.fill();
  ctx.fillStyle = hi ? '#fde68a' : '#fff';
  ctx.font = '900 14px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(scoreText, 0, ph / 2 - 25);

  drawImage(ctx, imgs.flag[kind], 0, ph / 2 - 10, 20);

  ctx.restore();
}

function updateSparks(vsX, vsY) {
  if (vis.phase !== 'battling') {
    sparks.length = 0;
    return;
  }
  if (Math.random() < 0.45) {
    const fromLeft = Math.random() < 0.5;
    sparks.push({
      x: fromLeft ? vsX - 22 : vsX + 22,
      y: vsY + (Math.random() - 0.5) * 24,
      vx: fromLeft ? 2.2 + Math.random() : -2.2 - Math.random(),
      vy: (Math.random() - 0.5) * 2.5,
      life: 1,
      len: 5 + Math.random() * 8,
    });
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 0.07;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

function drawSparks(ctx) {
  ctx.save();
  for (const s of sparks) {
    ctx.globalAlpha = s.life * 0.95;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * s.len * 0.35, s.y - s.vy * s.len * 0.35);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVsZone(ctx, vsX, cy, hi, glowT) {
  const battling = vis.phase === 'battling';
  const pulse = battling ? 0.85 + 0.15 * Math.sin(glowT * 12) : 1;
  const size = (hi.draw ? 34 : 30) * pulse;

  if (battling) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(glowT * 10);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vsX, cy, size * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (hi.draw && isBattleRevealed()) {
    drawImage(ctx, imgs.flag.draw, vsX, cy, size);
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 8px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('DRAW', vsX, cy + size * 0.38);
    return;
  }

  if (!drawImage(ctx, imgs.vsBadge, vsX, cy, size)) {
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(vsX, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 9px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', vsX, cy);
  }
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

  if (imgs.arenaBg?.complete) {
    arenaCtx.drawImage(imgs.arenaBg, 0, 0, w, h);
  } else {
    const bg = arenaCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1030');
    bg.addColorStop(1, '#0a0614');
    arenaCtx.fillStyle = bg;
    arenaCtx.fillRect(0, 0, w, h);
  }

  const padX = 4;
  const vsGap = 38;
  const innerW = w - padX * 2;
  const pw = (innerW - vsGap) / 2;
  const ph = h - 8;
  const cy = h / 2;
  const leftCx = padX + pw / 2;
  const rightCx = w - padX - pw / 2;
  const vsX = w / 2;
  const glowT = animTime / 1000;
  const hi = winnerHighlight();

  const shakeR = vis.phase === 'battling' ? Math.sin(animTime * 0.04) * 2.5 : 0;
  const shakeB = vis.phase === 'battling' ? Math.sin(animTime * 0.04 + 1.2) * 2.5 : 0;

  updateSparks(vsX, cy);
  drawSparks(arenaCtx);

  drawTeamPanel(arenaCtx, leftCx, cy, pw, ph, 'red', '#ef4444',
    vis.redDisplay, vis.redRoll, vis.redScore, hi.red, shakeR, glowT);
  drawTeamPanel(arenaCtx, rightCx, cy, pw, ph, 'blue', '#3b82f6',
    vis.blueDisplay, vis.blueRoll, vis.blueScore, hi.blue, shakeB, glowT);

  drawVsZone(arenaCtx, vsX, cy, hi, glowT);

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
  showResultPopup();
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

function closeResultPopup() {
  $('result-popup').hidden = true;
}

function showResultPopup() {
  const popup = $('result-popup');
  const myBet = state?.myBet;
  const battle = state?.battle;
  if (!myBet || !battle || state?.phase !== 'results' || !isBattleRevealed()) {
    if (state?.phase !== 'results') {
      popup.hidden = true;
      lastOverlayKey = '';
    }
    return;
  }
  const key = `${state.roundId}-${myBet.status}`;
  if (key === lastOverlayKey) return;
  lastOverlayKey = key;

  const card = $('result-card');
  const won = myBet.status === 'won';
  const isDraw = battle.outcome === 'draw';
  const drawWin = isDraw && myBet.prediction === 'draw';

  card.className = `dd-result__card dd-result__card--${won || drawWin ? 'win' : isDraw ? 'draw' : 'lose'}`;

  const icon = $('result-icon');
  icon.className = 'dd-result__icon';
  icon.style.backgroundImage = `url(${FLAG_SRC[myBet.prediction]})`;
  icon.style.filter = won || drawWin ? 'drop-shadow(0 0 8px rgba(74,222,128,0.5))' : 'grayscale(0.35)';

  if (won) {
    $('result-title').textContent = 'You won!';
    $('result-amount').className = 'dd-result__amount';
    $('result-amount').textContent = `+${fmtNum(myBet.winAmount)}`;
    burstConfetti('#4ade80');
  } else if (isDraw && myBet.prediction === 'draw') {
    $('result-title').textContent = 'Draw — you win!';
    $('result-amount').className = 'dd-result__amount';
    $('result-amount').textContent = `+${fmtNum(myBet.winAmount)}`;
    burstConfetti('#fbbf24');
  } else {
    $('result-title').textContent = isDraw ? 'Draw' : 'Better luck next time';
    $('result-amount').className = 'dd-result__amount dd-result__amount--lose';
    $('result-amount').textContent = isDraw ? 'Scores tied this round' : `−${fmtNum(myBet.amount)}`;
  }

  $('result-score').textContent = `Red ${battle.redScore} — Blue ${battle.blueScore}`;
  popup.hidden = false;
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
    vis.outcome = battle.outcome;
    vis.winner = battle.winningTeam;
  } else if (next.phase === 'betting') {
    vis.redDice = Array(NUM_DICE).fill(1);
    vis.blueDice = Array(NUM_DICE).fill(1);
    vis.redScore = 0;
    vis.blueScore = 0;
    vis.outcome = null;
    vis.winner = null;
    lastOverlayKey = '';
    closeResultPopup();
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
  showResultPopup();
}

async function poll() {
  try { applyState(await diceDualState()); } catch { /* retry */ }
}

async function init() {
  loadAssets();
  resize();
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(arenaCanvas.parentElement);
  }
  setupHistoryModal();
  $('result-ok').addEventListener('click', closeResultPopup);
  $('result-backdrop').addEventListener('click', closeResultPopup);
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
