import { footballClashInit, footballClashState, footballClashBet } from './api.js';

let chips = [5000, 25000, 50000, 250000];
let selectedChip = 5000;
let selectedPred = 'home';
let state = null;
let prevPhase = null;
let lastEventCount = 0;
let lastOverlayKey = '';
let animTime = 0;
let goalFlash = 0;
let scorePop = { home: 0, away: 0 };

/** @type {{ x:number,y:number,vx:number,vy:number,life:number,color:string,size:number }[]} */
let confetti = [];

const fxCanvas = document.getElementById('fc-fx');
const fxCtx = fxCanvas.getContext('2d');
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
};

const $ = (id) => document.getElementById(id);

function fmtChip(v) { return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v); }
function fmtNum(n) { return Number(n || 0).toLocaleString(); }

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function resize() {
  for (const c of [fxCanvas, stadiumCanvas]) {
    const rect = c === fxCanvas
      ? document.body.getBoundingClientRect()
      : c.parentElement.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width = `${rect.width}px`;
    c.style.height = `${rect.height}px`;
  }
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

function drawFx(w, h) {
  fxCtx.clearRect(0, 0, w, h);
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.0003; p.life -= 0.011;
    if (p.life <= 0) { confetti.splice(i, 1); continue; }
    fxCtx.globalAlpha = p.life;
    fxCtx.fillStyle = p.color;
    fxCtx.fillRect(p.x * w, p.y * h, p.size, p.size * 0.55);
  }
  fxCtx.globalAlpha = 1;
}

function drawField(w, h, t) {
  const sky = stadiumCtx.createLinearGradient(0, 0, 0, h * 0.45);
  sky.addColorStop(0, '#0f2847');
  sky.addColorStop(1, '#1e3c72');
  stadiumCtx.fillStyle = sky;
  stadiumCtx.fillRect(0, 0, w, h * 0.45);

  const grass = stadiumCtx.createLinearGradient(0, h * 0.38, 0, h);
  grass.addColorStop(0, '#2ecc71');
  grass.addColorStop(0.5, '#27ae60');
  grass.addColorStop(1, '#1e8449');
  stadiumCtx.fillStyle = grass;
  stadiumCtx.fillRect(0, h * 0.38, w, h * 0.62);

  const stripeW = 28;
  const offset = (t * 0.02) % (stripeW * 2);
  stadiumCtx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = -offset; x < w + stripeW; x += stripeW * 2) {
    stadiumCtx.fillRect(x, h * 0.38, stripeW, h * 0.62);
  }

  stadiumCtx.strokeStyle = 'rgba(255,255,255,0.55)';
  stadiumCtx.lineWidth = 2;
  const fy = h * 0.42;
  const fh = h - fy - 12;
  stadiumCtx.strokeRect(14, fy, w - 28, fh);
  stadiumCtx.beginPath();
  stadiumCtx.moveTo(w / 2, fy);
  stadiumCtx.lineTo(w / 2, fy + fh);
  stadiumCtx.stroke();
  stadiumCtx.beginPath();
  stadiumCtx.arc(w / 2, fy + fh / 2, 36, 0, Math.PI * 2);
  stadiumCtx.stroke();

  const spotGrad = stadiumCtx.createRadialGradient(w / 2, fy + fh / 2, 0, w / 2, fy + fh / 2, 50);
  spotGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
  spotGrad.addColorStop(1, 'rgba(255,255,255,0)');
  stadiumCtx.fillStyle = spotGrad;
  stadiumCtx.fillRect(0, fy, w, fh);
}

function drawCrowd(w, h, t) {
  vis.crowd = 0.5 + 0.5 * Math.sin(t * 0.003);
  const lights = vis.phase === 'playing' ? 0.6 + vis.crowd * 0.4 : 0.25;
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * w + 8;
    const flicker = 0.5 + 0.5 * Math.sin(t * 0.005 + i * 1.7);
    stadiumCtx.fillStyle = `rgba(255, 220, 100, ${lights * flicker * 0.35})`;
    stadiumCtx.fillRect(x, h * 0.08, 6, 4);
  }
}

function drawTeamBadge(x, y, r, team, isHome) {
  if (!team) return;
  const color = team.color || '#fff';
  const glow = stadiumCtx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.4);
  glow.addColorStop(0, `${color}88`);
  glow.addColorStop(1, 'transparent');
  stadiumCtx.fillStyle = glow;
  stadiumCtx.beginPath();
  stadiumCtx.arc(x, y, r * 1.4, 0, Math.PI * 2);
  stadiumCtx.fill();

  stadiumCtx.fillStyle = 'rgba(0,0,0,0.35)';
  stadiumCtx.strokeStyle = color;
  stadiumCtx.lineWidth = 3;
  stadiumCtx.beginPath();
  stadiumCtx.arc(x, y, r, 0, Math.PI * 2);
  stadiumCtx.fill();
  stadiumCtx.stroke();

  stadiumCtx.font = `${r * 0.9}px system-ui`;
  stadiumCtx.textAlign = 'center';
  stadiumCtx.textBaseline = 'middle';
  stadiumCtx.fillText(team.emoji || (isHome ? '🏠' : '✈️'), x, y + 1);

  stadiumCtx.fillStyle = '#fff';
  stadiumCtx.font = `bold ${Math.max(11, r * 0.38)}px system-ui,sans-serif`;
  stadiumCtx.fillText(team.shortName || '—', x, y + r + 16);
}

function drawScoreboard(w, h) {
  const cx = w / 2;
  const cy = h * 0.52;
  const popH = 1 + scorePop.home * 0.15;
  const popA = 1 + scorePop.away * 0.15;
  scorePop.home *= 0.88;
  scorePop.away *= 0.88;

  stadiumCtx.fillStyle = 'rgba(0,0,0,0.55)';
  stadiumCtx.strokeStyle = 'rgba(255,255,255,0.25)';
  stadiumCtx.lineWidth = 2;
  roundRect(stadiumCtx, cx - 54, cy - 28, 108, 56, 12);
  stadiumCtx.fill();
  stadiumCtx.stroke();

  stadiumCtx.fillStyle = '#fff';
  stadiumCtx.textAlign = 'center';
  stadiumCtx.textBaseline = 'middle';
  stadiumCtx.font = `900 ${28 * popH}px system-ui,sans-serif`;
  stadiumCtx.fillText(String(vis.displayHome), cx - 28, cy);
  stadiumCtx.font = '900 18px system-ui,sans-serif';
  stadiumCtx.fillStyle = 'rgba(255,255,255,0.45)';
  stadiumCtx.fillText(':', cx, cy - 2);
  stadiumCtx.fillStyle = '#fff';
  stadiumCtx.font = `900 ${28 * popA}px system-ui,sans-serif`;
  stadiumCtx.fillText(String(vis.displayAway), cx + 28, cy);
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
  if (vis.phase !== 'playing') return;
  const bx = vis.ball.x * w;
  const by = vis.ball.y * h;
  const bounce = Math.sin(t * 0.008) * 8;
  stadiumCtx.fillStyle = 'rgba(0,0,0,0.25)';
  stadiumCtx.beginPath();
  stadiumCtx.ellipse(bx, by + 18, 10, 4, 0, 0, Math.PI * 2);
  stadiumCtx.fill();

  stadiumCtx.font = '26px system-ui';
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

  drawField(w, h, t);
  drawCrowd(w, h, t);

  if (vis.homeTeam && vis.awayTeam) {
    drawTeamBadge(w * 0.22, h * 0.58, 34, vis.homeTeam, true);
    drawTeamBadge(w * 0.78, h * 0.58, 34, vis.awayTeam, false);
    drawScoreboard(w, h);
    drawBall(w, h, t);
  }

  drawGoalFlash(w, h);

  if (vis.phase === 'betting' && vis.homeTeam) {
    stadiumCtx.fillStyle = 'rgba(255,255,255,0.55)';
    stadiumCtx.font = 'italic 12px system-ui,sans-serif';
    stadiumCtx.textAlign = 'center';
    stadiumCtx.fillText(`${vis.homeTeam.name} vs ${vis.awayTeam.name}`, w / 2, h * 0.36);
  }
}

function animLoop(t) {
  animTime = t;
  if (vis.phase === 'playing') {
    vis.ball.x += vis.ball.vx;
    vis.ball.y += vis.ball.vy;
    vis.ball.vx += (0.5 - vis.ball.x) * 0.0008;
    vis.ball.vy += (0.55 - vis.ball.y) * 0.0008;
    vis.ball.vx += (Math.random() - 0.5) * 0.0004;
    vis.ball.vy += (Math.random() - 0.5) * 0.0004;
    vis.ball.x = Math.max(0.15, Math.min(0.85, vis.ball.x));
    vis.ball.y = Math.max(0.45, Math.min(0.75, vis.ball.y));
  }
  drawStadium(t);
  drawFx(fxCanvas.width, fxCanvas.height);
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
  $('chips').innerHTML = chips.map((v) => `
    <button type="button" class="fc-chip${v === selectedChip ? ' active' : ''}" data-chip="${v}">${fmtChip(v)}</button>
  `).join('');
  $('chips').querySelectorAll('.fc-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedChip = Number(btn.dataset.chip);
      buildChips();
      $('bet-amt').textContent = fmtChip(selectedChip);
    });
  });
}

function setTimerRing(countdown, phase) {
  const max = phase === 'betting' ? 15 : phase === 'playing' ? 10 : 3;
  $('timer-ring').style.strokeDashoffset = String(RING_C * (1 - Math.max(0, countdown / max)));
}

function updateBetButton() {
  const btn = $('btn-bet');
  if (state?.myBet) {
    btn.disabled = true;
    btn.classList.add('is-placed');
    $('bet-label').textContent = 'BET LOCKED';
    return;
  }
  btn.disabled = state?.phase !== 'betting';
  btn.classList.remove('is-placed');
  $('bet-label').textContent = state?.phase === 'betting' ? 'PLACE BET' : 'WAIT…';
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

  updateBetButton();
  showOverlay(next.myBet);
}

async function poll() {
  try { applyState(await footballClashState()); } catch { /* retry */ }
}

async function init() {
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(animLoop);

  buildChips();
  $('bet-amt').textContent = fmtChip(selectedChip);

  document.querySelectorAll('.fc-pick__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPred = btn.dataset.pred;
      document.querySelectorAll('.fc-pick__btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  $('btn-bet').addEventListener('click', async () => {
    if (state?.myBet || state?.phase !== 'betting') return;
    try {
      const data = await footballClashBet(selectedPred, selectedChip);
      applyState({ ...data.state, balance: data.balance, myBet: data.myBet });
      toast(`Locked ${fmtChip(selectedChip)} on ${selectedPred.toUpperCase()}`);
    } catch (err) {
      toast(err.message || 'Bet failed');
    }
  });

  try {
    const data = await footballClashInit();
    chips = data.betting?.chipPresets || chips;
    selectedChip = data.betting?.defaultChip || selectedChip;
    buildChips();
    $('bet-amt').textContent = fmtChip(selectedChip);
    applyState({ ...data.state, balance: data.balance, myBet: data.state.myBet });
  } catch (err) {
    toast(err.message || 'Failed to load');
  }

  setInterval(poll, 400);
}

init();
