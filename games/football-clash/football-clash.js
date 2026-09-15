import { footballClashInit, footballClashState, footballClashBet } from './api.js';
import { chipBallHtml } from './chip-ball.js';

const ASSET = '/football-clash/assets';
const DRAW_FLAG = `${ASSET}/flag-draw.svg`;
const CHIP_STYLE_CLASSES = ['100', '1k', '10k', '100k', '100k', '100k'];
const RING_C = 238.76;

let chips = [200, 1000, 5000, 10000, 50000, 100000];
let selectedChip = 200;
let state = null;
let prevPhase = null;
let lastEventCount = 0;
let lastActionEventCount = 0;
let lastGoalEventKey = '';
let lastOverlayKey = '';
let cachedHistory = [];
let animTime = 0;
let goalFlash = 0;
let goalBanner = 0;
let scorePop = { home: 0, away: 0 };
/** @type {{ pred: string, amount: number } | null} */
let lastBet = null;
let betLock = false;
/** @type {{ x:number,y:number,vx:number,vy:number,life:number,color:string,size:number }[]} */
let confetti = [];
/** @type {{ x:number,y:number,vx:number,vy:number,life:number,char:string,size:number }[]} */
let cheerBits = [];

const SFX = {
  whistle: `${ASSET}/audio/whistle.mp3`,
  kick: `${ASSET}/audio/kick.mp3`,
  shot: `${ASSET}/audio/shot.mp3`,
  goal: `${ASSET}/audio/goal-cheer.mp3`,
  chip: `${ASSET}/audio/chip.mp3`,
};

const SFX_VOL = { whistle: 0.9, kick: 0.88, shot: 0.68, goal: 0.85, chip: 0.72 };
const SOUND_MUTE_KEY = 'fc-sound-muted';

let audioUnlocked = false;
let soundMuted = localStorage.getItem(SOUND_MUTE_KEY) === '1';
/** @type {Record<string, HTMLAudioElement>} */
const sfxPool = {};
let kickTimer = null;
let goalOverlayTimer = null;
let resultPopupTimer = null;
const RESULT_POPUP_MS = 6000;
let pendingKickoffWhistle = false;
/** @type {Map<string, HTMLImageElement>} */
const flagImgs = new Map();
/** @type {Map<string, string>} */
const teamLogoById = new Map();

const stadiumCanvas = document.getElementById('fc-stadium');
const stadiumCtx = stadiumCanvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);

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

function buildTeamLogoMap(teams) {
  teamLogoById.clear();
  for (const team of teams || []) {
    if (team?.id && team.logo) teamLogoById.set(team.id, team.logo);
  }
}

function teamLogoSrc(teamOrId) {
  if (!teamOrId) return '';
  if (typeof teamOrId === 'object') {
    return teamOrId.logo || teamLogoById.get(teamOrId.id) || '';
  }
  return teamLogoById.get(teamOrId) || '';
}

function historyFlagSrc(winnerTeamId) {
  if (winnerTeamId === 'draw') return DRAW_FLAG;
  return teamLogoSrc(winnerTeamId);
}

function loadFlag(teamId) {
  if (!teamId || teamId === 'draw' || flagImgs.has(teamId)) return flagImgs.get(teamId);
  const url = teamLogoSrc(teamId);
  if (!url) return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  flagImgs.set(teamId, img);
  return img;
}

function preloadFlagsFromHistory(history) {
  for (const h of history || []) {
    if (h.winnerTeamId && h.winnerTeamId !== 'draw') loadFlag(h.winnerTeamId);
    if (h.homeTeamId) loadFlag(h.homeTeamId);
    if (h.awayTeamId) loadFlag(h.awayTeamId);
  }
}

function chipLabel(v) {
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}k`;
  return String(v);
}

function chipStyleClass(v) {
  const idx = chips.indexOf(v);
  return CHIP_STYLE_CLASSES[Math.max(0, Math.min(idx, CHIP_STYLE_CLASSES.length - 1))];
}

function chipInnerHtml(cls, label) {
  return `${chipBallHtml()}<span class="fc-chip__label">${label}</span>`;
}

function playChipSound() {
  playSfxKey('chip', SFX_VOL.chip);
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

function initAudio() {
  for (const [key, url] of Object.entries(SFX)) {
    const a = new Audio(url);
    a.preload = 'auto';
    sfxPool[key] = a;
  }
}

function flushPendingAudio() {
  if (pendingKickoffWhistle) {
    pendingKickoffWhistle = false;
    playSfxKey('whistle', SFX_VOL.whistle);
  }
  if (vis.phase === 'playing') scheduleKickSounds();
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Prime clips during the user tap — required on mobile / WebView
  for (const [key, a] of Object.entries(sfxPool)) {
    const vol = SFX_VOL[key] ?? 0.5;
    a.volume = 0.001;
    a.play().then(() => {
      a.pause();
      a.currentTime = 0;
      a.volume = vol;
    }).catch(() => {
      a.volume = vol;
    });
  }
  flushPendingAudio();
}

function syncMuteButton() {
  const btn = $('btn-mute');
  if (!btn) return;
  btn.classList.toggle('is-muted', soundMuted);
  btn.setAttribute('aria-pressed', soundMuted ? 'true' : 'false');
  btn.setAttribute('aria-label', soundMuted ? 'Unmute sound' : 'Mute sound');
}

function setSoundMuted(muted) {
  soundMuted = !!muted;
  localStorage.setItem(SOUND_MUTE_KEY, soundMuted ? '1' : '0');
  syncMuteButton();
  if (soundMuted) clearKickTimer();
  else if (vis.phase === 'playing' && audioUnlocked) scheduleKickSounds();
}

function setupMuteButton() {
  syncMuteButton();
  $('btn-mute')?.addEventListener('click', () => {
    unlockAudio();
    setSoundMuted(!soundMuted);
  });
}

function setupHelpModal() {
  const modal = $('help-modal');
  const close = () => { modal.hidden = true; };
  $('btn-help')?.addEventListener('click', () => { modal.hidden = false; });
  $('help-close')?.addEventListener('click', close);
  $('help-backdrop')?.addEventListener('click', close);
}

function playSfxKey(key, volume) {
  if (!audioUnlocked || soundMuted) return false;
  const base = sfxPool[key];
  if (!base) return false;
  const vol = volume ?? SFX_VOL[key] ?? 0.5;
  let a;
  try {
    a = base.cloneNode(true);
  } catch {
    a = new Audio(base.src);
  }
  a.volume = vol;
  a.play().catch(() => {
    base.pause();
    base.currentTime = 0;
    base.volume = vol;
    base.play().catch(() => {});
  });
  return true;
}

function clearKickTimer() {
  if (kickTimer) {
    clearTimeout(kickTimer);
    kickTimer = null;
  }
}

function scheduleKickSounds() {
  clearKickTimer();
  if (!audioUnlocked || vis.phase !== 'playing') return;
  const delay = 400 + Math.random() * 900;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    playKickSound();
    scheduleKickSounds();
  }, delay);
}

function playKickSound() {
  if (!audioUnlocked || vis.phase !== 'playing') return;
  playSfxKey('kick', (SFX_VOL.kick ?? 0.5) + Math.random() * 0.08);
}

function playWhistle() {
  if (!audioUnlocked) {
    pendingKickoffWhistle = true;
    return;
  }
  pendingKickoffWhistle = false;
  playSfxKey('whistle', SFX_VOL.whistle);
}

function syncMatchAudio(phase, fromPhase = null) {
  if (phase === 'playing' && fromPhase !== 'playing') {
    pendingKickoffWhistle = true;
    playWhistle();
  }
  if (phase === 'playing' && audioUnlocked) {
    scheduleKickSounds();
  } else if (phase !== 'playing') {
    clearKickTimer();
  }
}

function checkActionSounds(events) {
  if (!audioUnlocked || vis.phase !== 'playing') return;
  const actions = (events || []).filter((e) => e.type === 'shot' || e.type === 'corner');
  if (actions.length <= lastActionEventCount) return;
  lastActionEventCount = actions.length;
  playKickSound();
}

function playGoalSound() {
  if (!audioUnlocked) return;
  playSfxKey('goal', SFX_VOL.goal);
}

function showGoalOverlay() {
  const overlay = $('goal-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.style.animation = 'none';
  void overlay.offsetHeight;
  overlay.style.animation = '';
  clearTimeout(goalOverlayTimer);
  goalOverlayTimer = setTimeout(() => {
    overlay.hidden = true;
  }, 3000);
}

let pitchStaticCanvas = null;
let pitchStaticKey = '';

function resize() {
  const rect = stadiumCanvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  stadiumCanvas.width = Math.floor(w * dpr);
  stadiumCanvas.height = Math.floor(h * dpr);
  stadiumCanvas.style.width = `${w}px`;
  stadiumCanvas.style.height = `${h}px`;
  pitchStaticKey = '';
  animLastDraw = 0;
  scheduleAnimLoop();
}

function burstConfetti(color) {
  for (let i = 0; i < 50; i++) {
    confetti.push({
      x: 0.5 + (Math.random() - 0.5) * 0.3,
      y: 0.4,
      vx: (Math.random() - 0.5) * 0.014,
      vy: -0.005 - Math.random() * 0.01,
      life: 1,
      color: color || ['#4ade80', '#fbbf24', '#fff'][Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 4,
    });
  }
}

function burstGoalCheer() {
  burstConfetti('#fbbf24');
  burstConfetti('#fde68a');
  const icons = ['👏', '🎉', '⚽', '✨', '🙌'];
  for (let i = 0; i < 28; i++) {
    cheerBits.push({
      x: 0.5 + (Math.random() - 0.5) * 0.55,
      y: 0.48 + (Math.random() - 0.5) * 0.12,
      vx: (Math.random() - 0.5) * 0.016,
      vy: -0.006 - Math.random() * 0.014,
      life: 1,
      char: icons[Math.floor(Math.random() * icons.length)],
      size: 12 + Math.random() * 10,
    });
  }
}

function drawConfetti(w, h) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.0003; p.life -= 0.008;
    if (p.life <= 0) { confetti.splice(i, 1); continue; }
    stadiumCtx.globalAlpha = p.life;
    stadiumCtx.fillStyle = p.color;
    stadiumCtx.fillRect(p.x * w, p.y * h, p.size, p.size * 0.55);
  }
  stadiumCtx.globalAlpha = 1;
}

function drawCheerBits(w, h) {
  for (let i = cheerBits.length - 1; i >= 0; i--) {
    const p = cheerBits[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.00025; p.life -= 0.007;
    if (p.life <= 0) { cheerBits.splice(i, 1); continue; }
    stadiumCtx.globalAlpha = p.life;
    stadiumCtx.font = `${p.size}px system-ui`;
    stadiumCtx.textAlign = 'center';
    stadiumCtx.textBaseline = 'middle';
    stadiumCtx.fillText(p.char, p.x * w, p.y * h);
  }
  stadiumCtx.globalAlpha = 1;
}

function roundRect(ctx, x, y, rw, rh, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
  ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
  ctx.arcTo(x, y + rh, x, y, rad);
  ctx.arcTo(x, y, x + rw, y, rad);
  ctx.closePath();
}

function drawFlagImage(teamId, x, y, size) {
  const img = teamId ? flagImgs.get(teamId) : null;
  if (img?.complete && img.naturalWidth) {
    stadiumCtx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return true;
  }
  return false;
}

function rebuildPitchStatic(w, h) {
  if (!pitchStaticCanvas) pitchStaticCanvas = document.createElement('canvas');
  pitchStaticCanvas.width = Math.floor(w * dpr);
  pitchStaticCanvas.height = Math.floor(h * dpr);
  const ctx = pitchStaticCanvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const grass = ctx.createLinearGradient(0, 0, 0, h);
  grass.addColorStop(0, '#34d399');
  grass.addColorStop(0.45, '#22c55e');
  grass.addColorStop(1, '#15803d');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.28);
  sky.addColorStop(0, 'rgba(8, 24, 48, 0.75)');
  sky.addColorStop(1, 'rgba(8, 24, 48, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.28);

  const lw = Math.max(1, w / 280);
  const m = Math.max(3, w * 0.012) + lw / 2;
  const fx = m;
  const fy = m;
  const fw = w - m * 2;
  const fh = h - m * 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = lw;
  ctx.strokeRect(fx, fy, fw, fh);
  ctx.beginPath();
  ctx.moveTo(w / 2, fy);
  ctx.lineTo(w / 2, fy + fh);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, fy + fh / 2, Math.min(fw * 0.11, fh * 0.22), 0, Math.PI * 2);
  ctx.stroke();

  const boxW = Math.min(fw * 0.16, 52);
  const boxH = Math.min(fh * 0.55, 72);
  ctx.strokeRect(fx, fy + (fh - boxH) / 2, boxW, boxH);
  ctx.strokeRect(fx + fw - boxW, fy + (fh - boxH) / 2, boxW, boxH);

  vis.pitch = { fx, fy, fw, fh };
  pitchStaticKey = `${w}x${h}`;
}

function drawPitchLights(w, h, t) {
  vis.crowd = 0.5 + 0.5 * Math.sin(t * 0.003);
  const lights = 0.7 + vis.crowd * 0.3;
  const lightCount = Math.max(10, Math.floor(w / 22));
  for (let i = 0; i < lightCount; i += 1) {
    const x = (i / (lightCount - 1)) * (w - 8) + 4;
    const flicker = 0.5 + 0.5 * Math.sin(t * 0.005 + i * 1.7);
    stadiumCtx.fillStyle = `rgba(255, 220, 100, ${lights * flicker * 0.4})`;
    stadiumCtx.fillRect(x, h * 0.04, 4, 2);
  }
}

function drawPitchStripes(w, h, t) {
  const stripeW = Math.max(14, w * 0.055);
  const offset = (t * 0.012) % (stripeW * 2);
  stadiumCtx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let x = -offset; x < w + stripeW; x += stripeW * 2) {
    stadiumCtx.fillRect(x, 0, stripeW, h);
  }
}

function drawPitchFull(w, h, t) {
  const key = `${w}x${h}`;
  if (pitchStaticKey !== key) rebuildPitchStatic(w, h);
  if (pitchStaticCanvas) {
    stadiumCtx.drawImage(pitchStaticCanvas, 0, 0, w, h);
  }
  if (vis.phase === 'playing') {
    drawPitchLights(w, h, t);
    drawPitchStripes(w, h, t);
  }
}

function drawScoreHud(w, h) {
  if (!vis.homeTeam || !vis.awayTeam) return;

  const popH = 1 + scorePop.home * 0.12;
  const popA = 1 + scorePop.away * 0.12;
  scorePop.home *= 0.88;
  scorePop.away *= 0.88;

  const barH = Math.min(36, h * 0.22);
  const barW = Math.min(w * 0.72, 280);
  const barX = (w - barW) / 2;
  const barY = Math.max(4, h * 0.04);
  const midY = barY + barH * 0.5;
  const cx = w / 2;
  const flagSize = Math.min(30, barH * 0.78);

  stadiumCtx.fillStyle = 'rgba(0,0,0,0.58)';
  stadiumCtx.strokeStyle = 'rgba(255,255,255,0.2)';
  stadiumCtx.lineWidth = 1;
  roundRect(stadiumCtx, barX, barY, barW, barH, 8);
  stadiumCtx.fill();
  stadiumCtx.stroke();

  const homeX = barX + barW * 0.2;
  const awayX = barX + barW * 0.8;

  const drawTeamFlag = (x, team) => {
    if (!team) return;
    if (!drawFlagImage(team.id, x, midY, flagSize)) {
      stadiumCtx.fillStyle = team.color || '#fff';
      stadiumCtx.beginPath();
      stadiumCtx.arc(x, midY, flagSize * 0.38, 0, Math.PI * 2);
      stadiumCtx.fill();
    }
  };
  drawTeamFlag(homeX, vis.homeTeam);
  drawTeamFlag(awayX, vis.awayTeam);

  const scoreSize = Math.min(barH * 0.52, 20);
  stadiumCtx.textBaseline = 'middle';
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
  goalFlash *= 0.94;
  stadiumCtx.fillStyle = `rgba(255,255,255,${goalFlash * 0.35})`;
  stadiumCtx.fillRect(0, 0, w, h);
  stadiumCtx.fillStyle = `rgba(74,222,128,${goalFlash * 0.25})`;
  stadiumCtx.fillRect(0, 0, w, h);
}

function drawGoalBanner(w, h) {
  if (goalBanner <= 0) return;
  goalBanner -= 0.0048;
  const fadeOut = goalBanner < 0.2 ? goalBanner / 0.2 : 1;
  const alpha = Math.min(1, goalBanner * 1.1) * fadeOut;
  const pulse = 1 + Math.sin(animTime * 0.014) * 0.05;
  const fontSize = Math.min(w * 0.2 * pulse, 64);
  const y = h * 0.5;

  stadiumCtx.save();
  stadiumCtx.textAlign = 'center';
  stadiumCtx.textBaseline = 'middle';
  stadiumCtx.font = `900 ${fontSize}px system-ui,sans-serif`;
  stadiumCtx.globalAlpha = alpha;
  stadiumCtx.shadowColor = 'rgba(251, 191, 36, 0.95)';
  stadiumCtx.shadowBlur = 22;
  stadiumCtx.strokeStyle = 'rgba(146, 64, 14, 0.9)';
  stadiumCtx.lineWidth = 5;
  stadiumCtx.strokeText('GOAL!', w / 2, y);
  const grad = stadiumCtx.createLinearGradient(w / 2, y - fontSize * 0.5, w / 2, y + fontSize * 0.5);
  grad.addColorStop(0, '#fde68a');
  grad.addColorStop(0.45, '#fbbf24');
  grad.addColorStop(1, '#d97706');
  stadiumCtx.fillStyle = grad;
  stadiumCtx.fillText('GOAL!', w / 2, y);
  stadiumCtx.restore();
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
  drawGoalBanner(w, h);
  drawGoalFlash(w, h);
  drawCheerBits(w, h);
  drawConfetti(w, h);
}

let animScheduled = false;
let animLastDraw = 0;

function animFrameBudget() {
  if (goalBanner > 0 || goalFlash > 0 || confetti.length || cheerBits.length) return 1000 / 45;
  if (vis.phase === 'playing') return 1000 / 24;
  return 1000 / 10;
}

function needsAnimLoop() {
  return vis.phase === 'playing'
    || goalBanner > 0
    || goalFlash > 0
    || confetti.length > 0
    || cheerBits.length > 0
    || scorePop.home > 0.02
    || scorePop.away > 0.02;
}

function scheduleAnimLoop() {
  if (animScheduled || document.hidden) return;
  animScheduled = true;
  requestAnimationFrame(animLoop);
}

function animLoop(t) {
  animScheduled = false;
  if (document.hidden) return;

  const budget = animFrameBudget();
  if (t - animLastDraw < budget) {
    if (needsAnimLoop()) scheduleAnimLoop();
    return;
  }
  animLastDraw = t;
  animTime = t;

  if (vis.phase === 'playing') {
    const wobble = Math.sin(t * 0.011 + vis.ball.x * 9.5) * 0.00035;
    vis.ball.x += vis.ball.vx;
    vis.ball.y += vis.ball.vy;
    vis.ball.vx += (0.5 - vis.ball.x) * 0.0012 + wobble;
    vis.ball.vy += (0.5 - vis.ball.y) * 0.0012 - wobble * 0.6;
    vis.ball.x = Math.max(0.08, Math.min(0.92, vis.ball.x));
    vis.ball.y = Math.max(0.1, Math.min(0.9, vis.ball.y));
  }

  drawStadium(t);
  if (needsAnimLoop()) scheduleAnimLoop();
}

function eventLabel(ev, match) {
  const team = ev.team === 'home' ? match.homeTeam.shortName : match.awayTeam.shortName;
  if (ev.type === 'goal') return `${ev.minute}' ⚽ GOAL — ${ev.player || 'Player'} (${team})`;
  if (ev.type === 'yellow_card') return `${ev.minute}' 🟨 Yellow card (${team})`;
  if (ev.type === 'corner') return `${ev.minute}' 🚩 Corner kick (${team})`;
  if (ev.type === 'shot') return `${ev.minute}' 🎯 Shot on target (${team})`;
  return `${ev.minute}' Foul (${team})`;
}

function checkNewGoals(events) {
  const goals = (events || []).filter((e) => e.type === 'goal');
  if (!goals.length) return;
  const last = goals[goals.length - 1];
  const key = `${last.minute}-${last.team}-${last.player || ''}`;
  if (key === lastGoalEventKey) return;
  lastGoalEventKey = key;
  goalBanner = 1;
  goalFlash = 1;
  burstGoalCheer();
  showGoalOverlay();
  playGoalSound();
}

function renderHistoryBar(history) {
  cachedHistory = history || [];
  preloadFlagsFromHistory(cachedHistory);
  $('history-bar').innerHTML = cachedHistory.slice(0, 12).map((h, i) => {
    const latest = i === 0 ? ' fc-dot--latest' : '';
    const src = historyFlagSrc(h.winnerTeamId);
    const title = `#${h.round} ${h.home} ${h.score} ${h.away}`;
    return `<span class="fc-dot${latest}" title="${title}">
      <img src="${src}" alt="" loading="lazy" />
    </span>`;
  }).join('');
}

function renderHistoryGrid() {
  const grid = $('history-grid');
  if (!cachedHistory.length) {
    grid.innerHTML = '<p class="fc-history-empty">No results yet</p>';
    return;
  }
  grid.innerHTML = cachedHistory.map((h, i) => {
    const latest = i === 0 ? ' fc-history-cell--latest' : '';
    const src = historyFlagSrc(h.winnerTeamId);
    return `<div class="fc-history-cell${latest}" title="Round ${h.round}: ${h.home} ${h.score} ${h.away}">
      <img src="${src}" alt="" loading="lazy" />
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

function ensurePickFlagImg(el) {
  if (!el) return null;
  if (el.tagName === 'IMG') return el;
  const img = document.createElement('img');
  img.id = el.id;
  img.className = 'fc-pick__flag';
  el.replaceWith(img);
  return img;
}

function setPickFlag(el, team) {
  if (!el || !team) return;
  const imgEl = ensurePickFlagImg(el);
  if (!imgEl) return;
  const url = teamLogoSrc(team);
  imgEl.alt = team.shortName || team.name || '';
  imgEl.src = url;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    const span = document.createElement('span');
    span.id = imgEl.id;
    span.className = 'fc-pick__flag fc-pick__flag--emoji';
    span.textContent = team.emoji || '⚽';
    imgEl.replaceWith(span);
  };
  loadFlag(team.id);
}

function updateTeamPicks(match) {
  if (!match?.homeTeam || !match?.awayTeam) return;
  setPickFlag($('pick-flag-home'), match.homeTeam);
  setPickFlag($('pick-flag-away'), match.awayTeam);
}

function buildChips() {
  $('chips').innerHTML = chips.map((v) => {
    const cls = chipStyleClass(v);
    return `<button type="button" class="fc-chip fc-chip--${cls}${v === selectedChip ? ' active' : ''}" data-chip="${v}">${chipInnerHtml(cls, chipLabel(v))}</button>`;
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
  const cls = chipStyleClass(amount);
  const chip = document.createElement('div');
  chip.className = `fc-chip-fly fc-chip-fly--${cls}`;
  chip.innerHTML = chipInnerHtml(cls, chipLabel(amount));
  chip.style.setProperty('--from-x', `${from.left + from.width / 2}px`);
  chip.style.setProperty('--from-y', `${from.top + from.height / 2}px`);
  chip.style.setProperty('--to-x', `${to.left + to.width / 2}px`);
  chip.style.setProperty('--to-y', `${to.top + to.height / 2}px`);
  layer.appendChild(chip);
  playChipSound();
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
}

function updatePickButtons() {
  const betting = state?.phase === 'betting';
  const myBet = state?.myBet;
  document.querySelectorAll('.fc-pick__btn').forEach((btn) => {
    btn.disabled = false;
    const pred = btn.dataset.pred;
    const amt = myBet?.prediction === pred ? myBet.amount : 0;
    btn.querySelector('[data-amt]').textContent = amt > 0 ? fmtNum(amt) : '0';
    btn.classList.toggle('has-bet', amt > 0);
    btn.classList.toggle('is-pick', betting && myBet?.prediction === pred);
  });
}

function bettingClosedMessage() {
  if (state?.phase === 'playing') return 'Please wait — match in progress';
  if (state?.phase === 'results') return 'Please wait — next match starting soon';
  return 'Please wait';
}

async function doBet(pred) {
  if (betLock) return;
  if (state?.phase !== 'betting') {
    toast(bettingClosedMessage());
    return;
  }
  const myBet = state?.myBet;
  if (myBet && myBet.prediction !== pred) {
    toast('You can only bet on one team per match');
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

function closeResultPopup() {
  if (resultPopupTimer) {
    clearTimeout(resultPopupTimer);
    resultPopupTimer = null;
  }
  $('result-win-banner').hidden = true;
  $('result-popup').hidden = true;
}

function scheduleResultPopupClose() {
  if (resultPopupTimer) clearTimeout(resultPopupTimer);
  resultPopupTimer = setTimeout(() => {
    resultPopupTimer = null;
    closeResultPopup();
    lastOverlayKey = '';
  }, RESULT_POPUP_MS);
}

function showResultPopup() {
  const popup = $('result-popup');
  if (resultPopupTimer) return;

  const match = state?.match;
  if (state?.phase !== 'results' || !match) {
    popup.hidden = true;
    lastOverlayKey = '';
    return;
  }

  const key = `${state.roundId}-${match.outcome}-${match.homeScore}-${match.awayScore}`;
  if (key === lastOverlayKey) return;
  lastOverlayKey = key;

  const winnerId = match.outcome === 'draw'
    ? 'draw'
    : match.outcome === 'homeWin'
      ? match.homeTeam.id
      : match.awayTeam.id;

  const wrap = document.querySelector('.fc-result__flag-wrap');
  let flagEl = $('result-flag');
  if (!flagEl || flagEl.tagName !== 'IMG') {
    wrap.innerHTML = '<img id="result-flag" class="fc-result__flag" alt="" />';
    flagEl = $('result-flag');
  }
  if (winnerId === 'draw') {
    flagEl.src = DRAW_FLAG;
    flagEl.alt = 'Draw';
    flagEl.onerror = null;
  } else {
    const winnerTeam = match.outcome === 'homeWin' ? match.homeTeam : match.awayTeam;
    flagEl.src = teamLogoSrc(winnerTeam) || teamLogoSrc(winnerId);
    flagEl.alt = winnerTeam?.name || 'Winner';
    flagEl.onerror = () => {
      flagEl.onerror = null;
      const span = document.createElement('span');
      span.id = 'result-flag';
      span.className = 'fc-result__flag fc-result__flag--emoji';
      span.textContent = winnerTeam?.emoji || '⚽';
      flagEl.replaceWith(span);
    };
  }

  const myBet = state?.myBet;
  const betAmt = myBet?.amount ?? 0;
  const winAmt = myBet?.status === 'won' ? (myBet.winAmount ?? 0) : 0;
  const won = myBet?.status === 'won';
  const lost = betAmt > 0 && myBet?.status === 'lost';

  $('result-bet-amt').textContent = fmtNum(betAmt);
  $('result-win-amt').textContent = fmtNum(winAmt);
  $('result-score').textContent = `${match.homeTeam.shortName} ${match.homeScore} – ${match.awayScore} ${match.awayTeam.shortName}`;

  if (match.outcome === 'draw') {
    $('result-title').textContent = 'Draw';
  } else {
    const winnerName = match.outcome === 'homeWin' ? match.homeTeam.name : match.awayTeam.name;
    $('result-title').textContent = `${winnerName} wins`;
  }

  const card = $('result-card');
  card.className = 'fc-result__card';
  if (won) card.classList.add('fc-result__card--win');
  else if (lost) card.classList.add('fc-result__card--lose');

  $('result-win-banner').hidden = !won;

  if (won) {
    window.gmNotifyWallet?.('win', {
      game: 'goal-clash',
      amount: winAmt,
      balance: state?.balance,
      delta: winAmt,
    });
  }

  popup.hidden = false;
  scheduleResultPopupClose();
}

function applyState(next) {
  const prevScore = { h: vis.homeScore, a: vis.awayScore };
  vis.phase = next.phase;
  if (prevPhase !== next.phase) {
    lastEventCount = 0;
    lastActionEventCount = 0;
    if (next.phase === 'betting') {
      lastGoalEventKey = '';
      cheerBits.length = 0;
    }
    syncMatchAudio(next.phase, prevPhase);
  } else if (next.phase === 'playing' && audioUnlocked && !kickTimer) {
    scheduleKickSounds();
  }
  prevPhase = next.phase;
  state = next;

  $('balance').textContent = fmtNum(next.balance ?? 0);
  $('countdown').textContent = String(next.countdown ?? 0);
  setTimerRing(next.countdown ?? 0, next.phase);

  const chip = $('phase-chip');
  chip.textContent = next.phase === 'betting' ? 'Pick your prediction'
    : next.phase === 'playing' ? '⚽ Match live' : 'Full time';
  chip.classList.toggle('is-live', next.phase === 'playing');
  chip.classList.toggle('is-ft', next.phase === 'results');

  renderHistoryBar(next.history);

  const m = next.match;
  if (m) {
    vis.homeTeam = m.homeTeam;
    vis.awayTeam = m.awayTeam;
    vis.homeScore = m.homeScore;
    vis.awayScore = m.awayScore;
    vis.displayHome = m.homeScore;
    vis.displayAway = m.awayScore;

    updateTeamPicks(m);

    if (m.homeScore > prevScore.h) scorePop.home = 1;
    if (m.awayScore > prevScore.a) scorePop.away = 1;

    const events = m.events || [];
    checkNewGoals(events);
    checkActionSounds(events);
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
  showResultPopup();
  scheduleAnimLoop();
}

async function poll() {
  try { applyState(await footballClashState()); } catch { /* retry */ }
}

async function init() {
  initAudio();
  const unlockOnce = () => {
    unlockAudio();
    document.removeEventListener('pointerdown', unlockOnce);
    document.removeEventListener('touchstart', unlockOnce);
    document.removeEventListener('keydown', unlockOnce);
  };
  document.addEventListener('pointerdown', unlockOnce, { passive: true });
  document.addEventListener('touchstart', unlockOnce, { passive: true });
  document.addEventListener('keydown', unlockOnce);

  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(stadiumCanvas.parentElement);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    animLastDraw = 0;
    scheduleAnimLoop();
  });
  requestAnimationFrame(() => {
    resize();
    scheduleAnimLoop();
  });

  setupHistoryModal();
  setupMuteButton();
  setupHelpModal();
  buildChips();

  document.querySelectorAll('.fc-pick__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      unlockAudio();
      doBet(btn.dataset.pred).catch(() => {});
    });
  });

  $('chips')?.addEventListener('click', unlockAudio, { passive: true });

  $('btn-repeat').addEventListener('click', async () => {
    unlockAudio();
    if (!lastBet) {
      toast('No previous bet');
      return;
    }
    if (state?.phase !== 'betting') {
      toast(bettingClosedMessage());
      return;
    }
    if (state?.myBet && state.myBet.prediction !== lastBet.pred) {
      toast('You can only bet on one team per match');
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
    buildTeamLogoMap(data.game?.teams);
    applyBettingConfig(data.betting);
    buildChips();
    applyState({ ...data.state, balance: data.balance, myBet: data.state.myBet });
  } catch (err) {
    toast(err.message || 'Failed to load');
  }

  setInterval(poll, 400);
  window.addEventListener('gm-realtime', () => poll());
}

init();
