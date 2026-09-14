import { footballClashInit, footballClashState, footballClashBet } from './api.js';

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

let audioUnlocked = false;
/** @type {Record<string, HTMLAudioElement>} */
const sfxPool = {};
let kickTimer = null;
let goalOverlayTimer = null;
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

const CHIP_BALL_RPM = 14;
const CHIP_BALL_TILT_X = 16;
const CHIP_BALL_SIZE = 72;

let chipBallRot = 0;
let chipBallLastTs = 0;

function vec3Add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vec3Scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vec3Cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vec3Normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function vec3LerpSphere(a, b, t) {
  return vec3Normalize(vec3Add(vec3Scale(a, 1 - t), vec3Scale(b, t)));
}

const CHIP_BALL_PHI = (1 + Math.sqrt(5)) / 2;
const CHIP_BALL_ICO_VERTS = [
  [0, 1, CHIP_BALL_PHI], [0, 1, -CHIP_BALL_PHI], [0, -1, CHIP_BALL_PHI], [0, -1, -CHIP_BALL_PHI],
  [1, CHIP_BALL_PHI, 0], [1, -CHIP_BALL_PHI, 0], [-1, CHIP_BALL_PHI, 0], [-1, -CHIP_BALL_PHI, 0],
  [CHIP_BALL_PHI, 0, 1], [CHIP_BALL_PHI, 0, -1], [-CHIP_BALL_PHI, 0, 1], [-CHIP_BALL_PHI, 0, -1],
].map(vec3Normalize);

const CHIP_BALL_ICO_FACES = [
  [0, 2, 8], [0, 8, 4], [0, 4, 6], [0, 6, 10], [0, 10, 2],
  [2, 10, 7], [2, 7, 5], [2, 5, 8], [8, 5, 9], [8, 9, 4],
  [4, 9, 1], [4, 1, 6], [6, 1, 11], [6, 11, 10], [10, 11, 3],
  [10, 3, 7], [7, 3, 5], [5, 3, 9], [9, 3, 1], [9, 1, 11],
];

function chipBallIcoNeighbors(v) {
  const set = new Set();
  for (const [a, b, c] of CHIP_BALL_ICO_FACES) {
    if (a === v) { set.add(b); set.add(c); }
    if (b === v) { set.add(a); set.add(c); }
    if (c === v) { set.add(a); set.add(b); }
  }
  const center = CHIP_BALL_ICO_VERTS[v];
  const ref = Math.abs(center[1]) < 0.89 ? [0, 1, 0] : [1, 0, 0];
  const tangent = vec3Normalize(vec3Cross(ref, center));
  const bitangent = vec3Cross(center, tangent);
  const angleOnSphere = (idx) => {
    const dir = CHIP_BALL_ICO_VERTS[idx];
    return Math.atan2(
      dir[0] * bitangent[0] + dir[1] * bitangent[1] + dir[2] * bitangent[2],
      dir[0] * tangent[0] + dir[1] * tangent[1] + dir[2] * tangent[2],
    );
  };
  return [...set].sort((a, b) => angleOnSphere(a) - angleOnSphere(b));
}

function buildChipSoccerFaces() {
  const faces = [];
  for (let v = 0; v < CHIP_BALL_ICO_VERTS.length; v += 1) {
    const neighbors = chipBallIcoNeighbors(v);
    faces.push({
      kind: 'pent',
      verts: neighbors.map((n) => vec3LerpSphere(CHIP_BALL_ICO_VERTS[v], CHIP_BALL_ICO_VERTS[n], 1 / 3)),
    });
  }
  for (const [a, b, c] of CHIP_BALL_ICO_FACES) {
    faces.push({
      kind: 'hex',
      verts: [
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[a], CHIP_BALL_ICO_VERTS[b], 2 / 3),
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[b], CHIP_BALL_ICO_VERTS[c], 1 / 3),
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[b], CHIP_BALL_ICO_VERTS[c], 2 / 3),
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[c], CHIP_BALL_ICO_VERTS[a], 1 / 3),
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[c], CHIP_BALL_ICO_VERTS[a], 2 / 3),
        vec3LerpSphere(CHIP_BALL_ICO_VERTS[a], CHIP_BALL_ICO_VERTS[b], 1 / 3),
      ],
    });
  }
  return faces;
}

const CHIP_BALL_FACES = buildChipSoccerFaces();

function chipPatchRgba(color, alpha) {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function setupChipBallCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(CHIP_BALL_SIZE * dpr);
  canvas.height = Math.round(CHIP_BALL_SIZE * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function chipBallRotate(v, rotY, rotX) {
  const ry = (rotY * Math.PI) / 180;
  const rx = (rotX * Math.PI) / 180;
  const x1 = v[0] * Math.cos(ry) + v[2] * Math.sin(ry);
  const z1 = -v[0] * Math.sin(ry) + v[2] * Math.cos(ry);
  const y1 = v[1];
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

function chipBallProject(v, radius, cx, cy) {
  return { x: cx + v[0] * radius, y: cy - v[1] * radius, z: v[2] };
}

function drawChipFace(ctx, points, fill, stroke, lineW) {
  if (points.length < 3) return;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawChipSoccerBall(ctx, size, rotY, patchColor) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.44;
  const rotX = CHIP_BALL_TILT_X;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const lightX = cx - R * 0.34;
  const lightY = cy - R * 0.36;
  const sphere = ctx.createRadialGradient(lightX, lightY, R * 0.05, cx + R * 0.04, cy + R * 0.06, R * 1.08);
  sphere.addColorStop(0, '#ffffff');
  sphere.addColorStop(0.34, '#f8fafc');
  sphere.addColorStop(0.68, '#cbd5e1');
  sphere.addColorStop(1, '#475569');
  ctx.fillStyle = sphere;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  const faces = CHIP_BALL_FACES.map((face) => {
    const projected = face.verts.map((v) => chipBallProject(chipBallRotate(v, rotY, rotX), R, cx, cy));
    const avgZ = projected.reduce((sum, p) => sum + p.z, 0) / projected.length;
    return { ...face, projected, avgZ };
  }).filter((face) => face.avgZ > -0.12).sort((a, b) => a.avgZ - b.avgZ);

  for (const face of faces) {
    const alpha = 0.58 + 0.42 * ((face.avgZ + 1) / 2);
    const fill = face.kind === 'pent'
      ? chipPatchRgba(patchColor, alpha)
      : chipPatchRgba('#f8fafc', Math.min(1, alpha + 0.06));
    drawChipFace(
      ctx,
      face.projected,
      fill,
      `rgba(15, 23, 42, ${Math.min(0.92, 0.38 + alpha * 0.5).toFixed(3)})`,
      Math.max(0.65, 1.05 * (0.65 + 0.35 * ((face.avgZ + 1) / 2))),
    );
  }

  const hx = cx - R * 0.22 * Math.cos((rotY * Math.PI) / 180);
  const hy = cy - R * 0.28;
  const gloss = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.42);
  gloss.addColorStop(0, 'rgba(255,255,255,0.72)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function paintChipBallCanvas(canvas, rotY) {
  const host = canvas.closest('.fc-chip, .fc-chip-fly');
  if (!host) return;
  const patch = getComputedStyle(host).getPropertyValue('--ball-patch').trim() || '#16a34a';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawChipSoccerBall(ctx, CHIP_BALL_SIZE, rotY, patch);
}

function updateChipBalls(ts) {
  if (!document.querySelector('.fc-chip__ball-canvas')) return;
  if (!chipBallLastTs) chipBallLastTs = ts;
  const dt = Math.min(32, Math.max(0, ts - chipBallLastTs));
  chipBallLastTs = ts;
  chipBallRot = (chipBallRot + (CHIP_BALL_RPM * 360 * dt) / 60000) % 360;
  document.querySelectorAll('.fc-chip__ball-canvas').forEach((canvas) => paintChipBallCanvas(canvas, chipBallRot));
}

function chipInnerHtml(cls, label) {
  return `<span class="fc-chip__ball-wrap" aria-hidden="true"><canvas class="fc-chip__ball-canvas" width="${CHIP_BALL_SIZE}" height="${CHIP_BALL_SIZE}"></canvas></span><span class="fc-chip__label">${label}</span>`;
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

function playSfxKey(key, volume) {
  if (!audioUnlocked) return false;
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

function resize() {
  const rect = stadiumCanvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  stadiumCanvas.width = Math.floor(w * dpr);
  stadiumCanvas.height = Math.floor(h * dpr);
  stadiumCanvas.style.width = `${w}px`;
  stadiumCanvas.style.height = `${h}px`;
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
  updateChipBalls(t);
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
  $('chips').querySelectorAll('.fc-chip__ball-canvas').forEach(setupChipBallCanvas);
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
  chip.querySelectorAll('.fc-chip__ball-canvas').forEach(setupChipBallCanvas);
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
  $('result-popup').hidden = true;
}

function showResultPopup() {
  const popup = $('result-popup');
  const match = state?.match;
  if (state?.phase !== 'results' || !match) {
    if (state?.phase !== 'results') {
      popup.hidden = true;
      lastOverlayKey = '';
    }
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
    flagEl.onerror = null;
  } else {
    const winnerTeam = match.outcome === 'homeWin' ? match.homeTeam : match.awayTeam;
    flagEl.src = teamLogoSrc(winnerTeam) || teamLogoSrc(winnerId);
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

  $('result-bet-amt').textContent = fmtNum(betAmt);
  $('result-win-amt').textContent = fmtNum(winAmt);
  $('result-score').textContent = `${match.homeTeam.shortName} ${match.homeScore} – ${match.awayScore} ${match.awayTeam.shortName}`;

  if (match.outcome === 'draw') {
    $('result-title').textContent = 'Draw';
  } else {
    const winnerName = match.outcome === 'homeWin' ? match.homeTeam.name : match.awayTeam.name;
    $('result-title').textContent = `${winnerName} wins!`;
  }

  const card = $('result-card');
  const won = myBet?.status === 'won';
  card.className = 'fc-result__card';
  if (won) {
    card.classList.add('fc-result__card--win');
    burstConfetti('#4ade80');
  } else if (betAmt > 0) {
    card.classList.add('fc-result__card--lose');
  }

  popup.hidden = false;
}

function applyState(next) {
  const prevScore = { h: vis.homeScore, a: vis.awayScore };
  vis.phase = next.phase;
  if (prevPhase !== next.phase) {
    lastEventCount = 0;
    lastActionEventCount = 0;
    if (next.phase === 'betting') {
      lastGoalEventKey = '';
      lastOverlayKey = '';
      closeResultPopup();
      cheerBits.length = 0;
    }
    syncMatchAudio(next.phase, prevPhase);
  } else if (next.phase === 'playing' && audioUnlocked && !kickTimer) {
    scheduleKickSounds();
  }
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
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(animLoop);
  });

  setupHistoryModal();
  $('result-ok').addEventListener('click', closeResultPopup);
  $('result-backdrop').addEventListener('click', closeResultPopup);

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
}

init();
