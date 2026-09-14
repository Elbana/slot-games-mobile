import { footballClashInit, footballClashState, footballClashBet } from './api.js';

const CHIP_STYLE_CLASSES = ['100', '1k', '10k', '100k', '100k', '100k'];

let chips = [200, 1000, 5000, 10000, 50000, 100000];
let selectedChip = 200;
let state = null;
let prevPhase = null;
let lastEventCount = 0;
let lastOverlayKey = '';
let animTime = 0;
let goalFlash = 0;
let scorePop = { home: 0, away: 0 };
/** @type {{ pred: string, amount: number } | null} */
let lastBet = null;
let betLock = false;

/** @type {{ x:number,y:number,vx:number,vy:number,life:number,color:string,size:number }[]} */
let confetti = [];

const stadiumCanvas = document.getElementById('fc-stadium');
const stadiumCtx = stadiumCanvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const RING_C = 238.76;

const vis = {
  phase: 'betting',
  homeTeam: null,
  awayTeam: null,
  homeScore: 0,
  awayScore: 0,
  displayHome: 0,
  displayAway: 0,
  ball: { x: 0.5, y: 0.55, vx: 0, vy: 0 },
  crowd: 0,
  pitch: null,
};

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

function resize() {
  const rect = stadiumCanvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  stadiumCanvas.width = Math.floor(w * dpr);
  stadiumCanvas.height = Math.floor(h * dpr);
  stadiumCanvas.style.width = `${w}px`;
  stadiumCanvas.style.height = `${h}px`;
}

function burstConfetti() {
  for (let i = 0; i < 50; i++) {
    confetti.push({
      x: 0.5 + (Math.random() - 0.5) * 0.3,
      y: 0.4,
      vx: (Math.random() - 0.5) * 0.014,
      vy: -0.005 - Math.random() * 0.01,
      life: 1,
      color: ['#4ade80', '#fbbf24', '#fff'][Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 4,
    });
  }
}

function drawConfetti(w, h) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.0003; p.life -= 0.011;
    if (p.life <= 0) { confetti.splice(i, 1); continue; }
    stadiumCtx.globalAlpha = p.life;
    stadiumCtx.fillStyle = p.color;
    stadiumCtx.fillRect(p.x * w, p.y * h, p.size, p.size * 0.55);
  }
  stadiumCtx.globalAlpha = 1;
}

function drawPitchFull(w, h, t) {
  const grass = stadiumCtx.createLinearGradient(0, 0, 0, h);
  grass.addColorStop(0, '#34d399');
  grass.addColorStop(0.45, '#22c55e');
  grass.addColorStop(1, '#15803d');
  stadiumCtx.fillStyle = grass;
  stadiumCtx.fillRect(0, 0, w, h);

  const sky = stadiumCtx.createLinearGradient(0, 0, 0, h * 0.28);
  sky.addColorStop(0, 'rgba(8, 24, 48, 0.75)');
  sky.addColorStop(1, 'rgba(8, 24, 48, 0)');
  stadiumCtx.fillStyle = sky;
  stadiumCtx.fillRect(0, 0, w, h * 0.28);

  vis.crowd = 0.5 + 0.5 * Math.sin(t * 0.003);
  const lights = vis.phase === 'playing' ? 0.7 + vis.crowd * 0.3 : 0.2;
  const lightCount = Math.max(10, Math.floor(w / 22));
  for (let i = 0; i < lightCount; i++) {
    const x = (i / (lightCount - 1)) * (w - 8) + 4;
    const flicker = 0.5 + 0.5 * Math.sin(t * 0.005 + i * 1.7);
    stadiumCtx.fillStyle = `rgba(255, 220, 100, ${lights * flicker * 0.4})`;
    stadiumCtx.fillRect(x, h * 0.04, 4, 2);
  }

  const stripeW = Math.max(14, w * 0.055);
  const offset = (t * 0.012) % (stripeW * 2);
  stadiumCtx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let x = -offset; x < w + stripeW; x += stripeW * 2) {
    stadiumCtx.fillRect(x, 0, stripeW, h);
  }

  const m = Math.max(3, w * 0.012);
  const fx = m;
  const fy = m;
  const fw = w - m * 2;
  const fh = h - m * 2;
  const lw = Math.max(1, w / 280);

  stadiumCtx.strokeStyle = 'rgba(255,255,255,0.6)';
  stadiumCtx.lineWidth = lw;
  stadiumCtx.strokeRect(fx, fy, fw, fh);
  stadiumCtx.beginPath();
  stadiumCtx.moveTo(w / 2, fy);
  stadiumCtx.lineTo(w / 2, fy + fh);
  stadiumCtx.stroke();
  stadiumCtx.beginPath();
  stadiumCtx.arc(w / 2, fy + fh / 2, Math.min(fw * 0.11, fh * 0.22), 0, Math.PI * 2);
  stadiumCtx.stroke();

  const boxW = Math.min(fw * 0.16, 52);
  const boxH = Math.min(fh * 0.55, 72);
  stadiumCtx.strokeRect(fx, fy + (fh - boxH) / 2, boxW, boxH);
  stadiumCtx.strokeRect(fx + fw - boxW, fy + (fh - boxH) / 2, boxW, boxH);

  vis.pitch = { fx, fy, fw, fh };
}

function drawScoreHud(w, h) {
  if (!vis.homeTeam || !vis.awayTeam) return;

  const popH = 1 + scorePop.home * 0.12;
  const popA = 1 + scorePop.away * 0.12;
  scorePop.home *= 0.88;
  scorePop.away *= 0.88;

  const barH = Math.min(34, h * 0.2);
  const barW = Math.min(w * 0.78, 320);
  const barX = (w - barW) / 2;
  const barY = Math.max(4, h * 0.04);
  const midY = barY + barH * 0.46;
  const cx = w / 2;
  const badgeR = Math.min(10, barH * 0.28);

  stadiumCtx.fillStyle = 'rgba(0,0,0,0.58)';
  stadiumCtx.strokeStyle = 'rgba(255,255,255,0.2)';
  stadiumCtx.lineWidth = 1;
  roundRect(stadiumCtx, barX, barY, barW, barH, 8);
  stadiumCtx.fill();
  stadiumCtx.stroke();

  const homeX = barX + barW * 0.14;
  const awayX = barX + barW * 0.86;

  const drawBadge = (x, team) => {
    if (!team) return;
    stadiumCtx.fillStyle = 'rgba(0,0,0,0.4)';
    stadiumCtx.strokeStyle = team.color || '#fff';
    stadiumCtx.lineWidth = 1.5;
    stadiumCtx.beginPath();
    stadiumCtx.arc(x, midY, badgeR, 0, Math.PI * 2);
    stadiumCtx.fill();
    stadiumCtx.stroke();
    stadiumCtx.font = `${Math.floor(badgeR * 1.1)}px system-ui`;
    stadiumCtx.textAlign = 'center';
    stadiumCtx.textBaseline = 'middle';
    stadiumCtx.fillText(team.emoji || '⚽', x, midY);
  };
  drawBadge(homeX, vis.homeTeam);
  drawBadge(awayX, vis.awayTeam);

  const labelSize = Math.max(8, barH * 0.24);
  const scoreSize = Math.min(barH * 0.52, 18);
  stadiumCtx.textBaseline = 'middle';

  stadiumCtx.fillStyle = 'rgba(255,255,255,0.75)';
  stadiumCtx.font = `700 ${labelSize}px system-ui,sans-serif`;
  stadiumCtx.textAlign = 'right';
  stadiumCtx.fillText(vis.homeTeam.shortName || 'HOM', homeX + badgeR + 6, midY);
  stadiumCtx.textAlign = 'left';
  stadiumCtx.fillText(vis.awayTeam.shortName || 'AWY', awayX - badgeR - 6, midY);

  stadiumCtx.fillStyle = '#fff';
  stadiumCtx.textAlign = 'center';
  stadiumCtx.font = `900 ${scoreSize * popH}px system-ui,sans-serif`;
  stadiumCtx.fillText(String(vis.displayHome), cx - scoreSize * 0.9, midY);
  stadiumCtx.font = `900 ${scoreSize * 0.55}px system-ui,sans-serif`;
  stadiumCtx.fillStyle = 'rgba(255,255,255,0.45)';
  stadiumCtx.fillText('–', cx, midY - 1);
  stadiumCtx.fillStyle = '#fff';
  stadiumCtx.font = `900 ${scoreSize * popA}px system-ui,sans-serif`;
  stadiumCtx.fillText(String(vis.displayAway), cx + scoreSize * 0.9, midY);
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

function drawBall(w, h, t) {
  if (vis.phase !== 'playing' || !vis.pitch) return;
  const { fx, fy, fw, fh } = vis.pitch;
  const bx = fx + vis.ball.x * fw;
  const by = fy + vis.ball.y * fh;
  const ballSize = Math.max(12, Math.min(18, h * 0.1));
  const bounce = Math.sin(t * 0.008) * 2;

  stadiumCtx.fillStyle = 'rgba(0,0,0,0.22)';
  stadiumCtx.beginPath();
  stadiumCtx.ellipse(bx, by + ballSize * 0.65, ballSize * 0.4, ballSize * 0.14, 0, 0, Math.PI * 2);
  stadiumCtx.fill();

  stadiumCtx.font = `${ballSize}px system-ui`;
  stadiumCtx.textAlign = 'center';
  stadiumCtx.textBaseline = 'middle';
  stadiumCtx.fillText('⚽', bx, by + bounce);
}

function drawGoalFlash(w, h) {
  if (goalFlash <= 0) return;
  goalFlash *= 0.88;
  stadiumCtx.fillStyle = `rgba(255,255,255,${goalFlash * 0.35})`;
  stadiumCtx.fillRect(0, 0, w, h);
  stadiumCtx.fillStyle = `rgba(74,222,128,${goalFlash * 0.25})`;
  stadiumCtx.fillRect(0, 0, w, h);
}

function drawStadium(t) {
  const w = stadiumCanvas.width / dpr;
  const h = stadiumCanvas.height / dpr;
  stadiumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stadiumCtx.clearRect(0, 0, w, h);

  if (w < 2 || h < 2) return;

  drawPitchFull(w, h, t);

  if (vis.homeTeam && vis.awayTeam) {
    drawScoreHud(w, h);
  } else {
    stadiumCtx.fillStyle = 'rgba(255,255,255,0.55)';
    stadiumCtx.font = '600 12px system-ui,sans-serif';
    stadiumCtx.textAlign = 'center';
    stadiumCtx.textBaseline = 'middle';
    stadiumCtx.fillText('Loading match…', w / 2, h * 0.12);
  }

  drawBall(w, h, t);
  drawGoalFlash(w, h);
  drawConfetti(w, h);
}

function animLoop(t) {
  animTime = t;
  if (vis.phase === 'playing') {
    vis.ball.x += vis.ball.vx;
    vis.ball.y += vis.ball.vy;
    vis.ball.vx += (0.5 - vis.ball.x) * 0.0012;
    vis.ball.vy += (0.5 - vis.ball.y) * 0.0012;
    vis.ball.vx += (Math.random() - 0.5) * 0.0006;
    vis.ball.vy += (Math.random() - 0.5) * 0.0006;
    vis.ball.x = Math.max(0.08, Math.min(0.92, vis.ball.x));
    vis.ball.y = Math.max(0.1, Math.min(0.9, vis.ball.y));
  }
  drawStadium(t);
  requestAnimationFrame(animLoop);
}

function eventLabel(ev, match) {
  const team = ev.team === 'home' ? match.homeTeam.shortName : match.awayTeam.shortName;
  if (ev.type === 'goal') return `${ev.minute}' ⚽ GOAL — ${ev.player || 'Player'} (${team})`;
  if (ev.type === 'yellow_card') return `${ev.minute}' 🟨 Yellow card (${team})`;
  if (ev.type === 'corner') return `${ev.minute}' 🚩 Corner kick (${team})`;
  if (ev.type === 'shot') return `${ev.minute}' 🎯 Shot on target (${team})`;
  return `${ev.minute}' Foul (${team})`;
}

function buildChips() {
  $('chips').innerHTML = chips.map((v) => {
    const cls = chipStyleClass(v);
    return `<button type="button" class="fc-chip fc-chip--${cls}${v === selectedChip ? ' active' : ''}" data-chip="${v}">${chipLabel(v)}</button>`;
  }).join('');
  $('chips').querySelectorAll('.fc-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
    });
  });
}

function flyChipToPick(pred, amount) {
  const chipBtn = document.querySelector(`.fc-chip[data-chip="${amount}"]`)
    || document.querySelector('.fc-chip.active');
  const pickBtn = document.querySelector(`.fc-pick__btn[data-pred="${pred}"]`);
  const layer = $('fc-fx');
  if (!chipBtn || !pickBtn || !layer) return;

  const from = chipBtn.getBoundingClientRect();
  const to = pickBtn.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = `fc-chip-fly fc-chip-fly--${chipStyleClass(amount)}`;
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
  document.querySelectorAll('.fc-pick__btn').forEach((btn) => {
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
    toast('Betting closed — wait for kick off');
    return;
  }
  const amount = selectedChip;
  if ((state?.balance ?? 0) < amount) {
    toast('Insufficient balance');
    return;
  }

  betLock = true;
  flyChipToPick(pred, amount);
  try {
    const data = await footballClashBet(pred, amount);
    lastBet = { pred, amount };
    applyState({ ...data.state, balance: data.balance, myBet: data.myBet });
  } catch (err) {
    toast(err.message || 'Bet failed');
  } finally {
    betLock = false;
  }
}

function setTimerRing(countdown, phase) {
  const max = phase === 'betting' ? 15 : phase === 'playing' ? 10 : 3;
  $('timer-ring').style.strokeDashoffset = String(RING_C * (1 - Math.max(0, countdown / max)));
}

function showOverlay(myBet) {
  const overlay = $('overlay');
  const card = $('overlay-card');
  if (!myBet || state?.phase !== 'results') {
    overlay.hidden = true;
    lastOverlayKey = '';
    return;
  }
  const key = `${state.roundId}-${myBet.status}`;
  if (key === lastOverlayKey) return;
  lastOverlayKey = key;
  overlay.hidden = false;
  if (myBet.status === 'won') {
    card.className = 'fc-overlay__card fc-overlay__card--win';
    card.innerHTML = `FULL TIME WIN!<span class="fc-overlay__sub">+${fmtNum(myBet.winAmount)} coins</span>`;
    burstConfetti();
  } else {
    card.className = 'fc-overlay__card fc-overlay__card--lose';
    card.innerHTML = `FULL TIME<span class="fc-overlay__sub">Wrong call — try again</span>`;
  }
  setTimeout(() => { if (state?.phase !== 'results') overlay.hidden = true; }, 2800);
}

function applyState(next) {
  const prevScore = { h: vis.homeScore, a: vis.awayScore };
  if (prevPhase !== next.phase) lastEventCount = 0;
  prevPhase = next.phase;
  state = next;

  $('balance').textContent = fmtNum(next.balance ?? 0);
  $('round-id').textContent = String(next.roundId ?? '—');
  $('countdown').textContent = String(next.countdown ?? 0);
  setTimerRing(next.countdown ?? 0, next.phase);

  const chip = $('phase-chip');
  chip.textContent = next.phase === 'betting' ? 'Pick your prediction'
    : next.phase === 'playing' ? '⚽ Match live' : 'Full time';
  chip.classList.toggle('is-live', next.phase === 'playing');
  chip.classList.toggle('is-ft', next.phase === 'results');

  $('history-bar').innerHTML = (next.history || []).slice(0, 8).map((h) =>
    `<span class="fc-pill">#${h.round} ${h.home} ${h.score} ${h.away}</span>`,
  ).join('');

  const m = next.match;
  vis.phase = next.phase;
  if (m) {
    vis.homeTeam = m.homeTeam;
    vis.awayTeam = m.awayTeam;
    vis.homeScore = m.homeScore;
    vis.awayScore = m.awayScore;
    vis.displayHome = m.homeScore;
    vis.displayAway = m.awayScore;

    if (m.homeScore > prevScore.h) { scorePop.home = 1; goalFlash = 1; }
    if (m.awayScore > prevScore.a) { scorePop.away = 1; goalFlash = 1; }

    const events = m.events || [];
    if (events.length !== lastEventCount) {
      lastEventCount = events.length;
      $('events').innerHTML = events.slice(-4).reverse().map((ev) =>
        `<div class="fc-event${ev.type === 'goal' ? ' fc-event--goal' : ''}">${eventLabel(ev, m)}</div>`,
      ).join('');
    }
  } else if (next.phase === 'betting') {
    vis.homeScore = 0;
    vis.awayScore = 0;
    vis.displayHome = 0;
    vis.displayAway = 0;
  }

  updatePickButtons();
  showOverlay(next.myBet);
}

async function poll() {
  try { applyState(await footballClashState()); } catch { /* retry */ }
}

async function init() {
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(stadiumCanvas.parentElement);
  }
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(animLoop);
  });

  buildChips();

  document.querySelectorAll('.fc-pick__btn').forEach((btn) => {
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
      toast('Betting closed — wait for kick off');
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
    const data = await footballClashInit();
    applyBettingConfig(data.betting);
    buildChips();
    applyState({ ...data.state, balance: data.balance, myBet: data.state.myBet });
  } catch (err) {
    toast(err.message || 'Failed to load');
  }

  setInterval(poll, 400);
}

init();
