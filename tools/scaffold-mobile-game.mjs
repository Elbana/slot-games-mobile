/**
 * Scaffold a standalone mobile Pixi game from rise-of-olympus template + slot-games-client code.
 *
 *   node tools/scaffold-mobile-game.mjs --game stadium-of-riches
 *   node tools/scaffold-mobile-game.mjs --all
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'games', 'rise-of-olympus');
const CLIENT_ROOT = path.join(ROOT, '..', 'slot-games-client');

const SKIP = new Set(['node_modules', 'dist', '.git']);

/** @type {Record<string, object>} */
const GAMES = {
  'stadium-of-riches': {
    title: 'Stadium of Riches',
    port: 5181,
    clientPkg: 'football-gold',
    assetPkg: 'football-gold',
    cssTheme: 'football',
    bgColor: '0x0a1a0f',
    sceneFn: 'createFootballScene',
    sceneImport: 'FootballScene.js',
    hudFn: 'createFootballHUD',
    hudImport: 'FootballHUD.js',
    paytableImport: 'PaytablePanel.js',
    spinFn: 'spinFootballGold',
    spinImport: './games/stadium-of-riches/spin.mjs',
    effectiveImport: './games/stadium-of-riches/freespin.mjs',
    sessionKind: 'football',
    cols: 5,
    rows: 3,
    symbolCount: 10,
    sessionPrefix: 'sor',
    extraFiles: [],
  },
  'temple-of-three': {
    title: 'Temple of Three',
    port: 5182,
    clientPkg: 'egypt-treasures',
    assetPkg: 'egypt-treasures',
    cssTheme: 'egypt',
    bgColor: '0x120818',
    sceneFn: 'createEgyptScene',
    sceneImport: 'EgyptScene.js',
    hudFn: 'createEgyptHUD',
    hudImport: 'EgyptHUD.js',
    paytableImport: 'PaytablePanel.js',
    spinFn: 'spinEgyptTreasures',
    spinImport: './games/temple-of-three/spin.mjs',
    effectiveImport: null,
    sessionKind: 'egypt',
    cols: 5,
    rows: 3,
    symbolCount: 9,
    sessionPrefix: 'tot',
    extraFiles: [
      { from: 'football-gold/SymbolClipPlayer.js', to: 'SymbolClipPlayer.js' },
      { from: 'football-gold/ReelAnimator.js', to: 'ReelAnimator.js' },
    ],
  },
  'spinnin-records-into-the-beat': {
    title: "Spinnin' Records Into the Beat",
    port: 5183,
    clientPkg: 'football-gold',
    assetPkg: 'football-gold',
    cssTheme: 'football',
    bgColor: '0x0a1028',
    sceneFn: 'createFootballScene',
    sceneImport: 'FootballScene.js',
    hudFn: 'createFootballHUD',
    hudImport: 'FootballHUD.js',
    paytableImport: 'PaytablePanel.js',
    spinFn: 'spinFootballGold',
    spinImport: './games/spinnin-records-into-the-beat/spin.mjs',
    effectiveImport: './games/spinnin-records-into-the-beat/freespin.mjs',
    sessionKind: 'football',
    cols: 5,
    rows: 3,
    symbolCount: 10,
    sessionPrefix: 'beat',
    extraFiles: [],
    readmeNote:
      'Native beat art/client TBD — currently uses Stadium-style reel client + math as a playable placeholder.',
  },
};

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`);
  const stat = fs.statSync(src);
  if (stat.isFile()) {
    if (!filter(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name)) continue;
    copyDir(path.join(src, name), path.join(dest, name), filter);
  }
}

function patchFile(file, pairs) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) text = text.split(from).join(to);
  fs.writeFileSync(file, text);
}

function writeSlotGame(target, id, spec) {
  const mountFn = `mount${id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')}`;
  const content = `/**
 * ${spec.title} — Pixi scene + HUD + spin API.
 */
import { Application } from 'pixi.js';
import { requestSpin, fetchSession } from '../api/spin-api.js';
import { ${spec.sceneFn} } from '../game/${spec.sceneImport}';
import { ${spec.hudFn} } from '../game/${spec.hudImport}';
import { mountPaytablePanel } from '../game/${spec.paytableImport}';
import { animateWinCount } from './WinCount.js';
import { TIMING } from '../game/config.js';

const GAME = {
  slug: '${id}',
  title: ${JSON.stringify(spec.title)},
  cols: ${spec.cols},
  rows: ${spec.rows},
  symbolCount: ${spec.symbolCount},
};

const DEFAULT_BET_LEVELS = [20, 40, 60, 100, 200, 500, 1000];

/** @typedef {'idle' | 'spinning' | 'showingWin' | 'feature'} GamePhase */

export async function ${mountFn}(mount) {
  mount.innerHTML = '';
  mount.className = 'gc-game gc-game--${spec.cssTheme}';

  const stageWrap = document.createElement('div');
  stageWrap.className = 'gc-game__stage';
  const hudMount = document.createElement('div');
  hudMount.className = 'gc-game__hud';
  const paytableMount = document.createElement('div');
  mount.append(stageWrap, hudMount, paytableMount);

  const app = new Application();
  await app.init({
    background: ${spec.bgColor},
    antialias: true,
    resizeTo: stageWrap,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  stageWrap.appendChild(app.canvas);

  const grid = await ${spec.sceneFn}({ cols: GAME.cols, rows: GAME.rows, app });
  app.stage.addChild(grid.view);

  function onResize() {
    grid.layout?.(app.screen.width, app.screen.height);
  }
  onResize();
  app.renderer.on('resize', onResize);

  let balance = 0;
  let bet = 20;
  let betLevels = DEFAULT_BET_LEVELS;
  let phase = 'idle';
  let displayedWin = 0;
  let gameState = {};

  const paytable = mountPaytablePanel(paytableMount);
  const hud = ${spec.hudFn}(hudMount, {
    betLevels,
    onSpin: () => void doSpin(),
    onBetChange: (v) => {
      bet = v;
      syncHud();
    },
    onRules: () => paytable.open(),
  });

  try {
    const session = await fetchSession(GAME.slug);
    balance = session.balance;
    bet = session.bet ?? bet;
    betLevels = session.betLevels ?? betLevels;
    gameState = session.state ?? {};
    hud.setBet?.(bet);
  } catch (err) {
    console.warn(\`[\${GAME.title}] session init failed\`, err);
    balance = 2_500_000;
    hud.setMessage?.(err instanceof Error ? err.message : 'Could not load session');
  }

  hud.setBalance(balance);
  hud.setWin(0);
  syncHud();

  function canSpin() {
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    return phase === 'idle' && balance >= charge;
  }

  function syncHud() {
    hud.setBalance(balance);
    hud.setSpinEnabled(canSpin());
    hud.setFreeSpins?.({
      remaining: gameState.fsRemaining ?? 0,
      multiplier: gameState.fsMultiplier ?? 0,
    });
    grid.setFreeSpinMode?.((gameState.fsRemaining ?? 0) > 0);
    grid.syncFreeSpinState?.({
      remaining: gameState.fsRemaining ?? 0,
      multiplier: gameState.fsMultiplier ?? 0,
      expandingSymbols: gameState.expandingSymbols ?? [],
    });
  }

  async function tickWin(to) {
    if (to === displayedWin) {
      hud.setWin(to);
      displayedWin = to;
      return;
    }
    await animateWinCount(displayedWin, to, TIMING.winCountUp, (v) => hud.setWin(v));
    displayedWin = to;
  }

  async function doSpin() {
    if (phase !== 'idle') return;
    if (hud.getBet) bet = hud.getBet();
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    if (balance < charge) {
      hud.setMessage?.('Insufficient balance');
      syncHud();
      return;
    }
    phase = 'spinning';
    hud.setSpinEnabled(false);
    displayedWin = 0;
    hud.setWin(0);
    hud.setMessage?.('');

    try {
      const spinPromise = requestSpin(GAME.slug, { bet, balance });
      if (grid.shuffleAnimation) await grid.shuffleAnimation();
      const result = await spinPromise;

      const featureTypes = [
        'line_win',
        'free_spins_awarded',
        'free_spins_end',
        'wheel_spin',
        'coin_win',
        'cash_win',
        'pot_collect',
      ];
      const events =
        result.events?.length > 0 ? result.events : [{ type: 'deal', grid: result.symbols }];
      if (events.some((e) => featureTypes.includes(e.type))) phase = 'feature';

      await grid.replayEvents?.(
        events,
        (partial) => {
          phase = 'showingWin';
          void tickWin(partial);
        },
        bet,
      );

      balance = result.balance;
      gameState = result.state ?? {};
      if (result.betLevels) betLevels = result.betLevels;
      await tickWin(result.win);
      syncHud();
    } catch (err) {
      console.error(\`[\${GAME.title}] spin error\`, err);
      hud.setMessage?.(err instanceof Error ? err.message : 'Spin failed');
    } finally {
      phase = 'idle';
      syncHud();
    }
  }

  const initial = [];
  for (let c = 0; c < GAME.cols; c++) {
    initial[c] = [];
    for (let r = 0; r < GAME.rows; r++) initial[c][r] = (c + r) % GAME.symbolCount;
  }
  grid.setSymbols(initial);

  return {
    destroy() {
      app.renderer.off('resize', onResize);
      app.destroy(true, { children: true });
      mount.innerHTML = '';
    },
  };
}
`;
  fs.writeFileSync(path.join(target, 'src', 'engine', 'SlotGame.js'), content);
  return mountFn;
}

function writeSpinApi(target, id, spec) {
  const effective =
    spec.effectiveImport != null
      ? `import { effectiveBet } from '${spec.effectiveImport}';\n`
      : '';
  const chargeBlock =
    spec.sessionKind === 'football'
      ? '  const charge = effectiveBet(session, bet);'
      : '  const charge = bet;';

  const sessionStateBlock =
    spec.sessionKind === 'football'
      ? `  const fs = session.footballFs;
  return {
    fsRemaining: fs?.freeSpinsLeft ?? 0,
    fsMultiplier: fs?.freeSpinMultiplier ?? 0,
    expandingSymbols: fs?.expandingSymbols ?? [],
  };`
      : '  return {};';

  const content = `/**
 * JSON spin API — ${spec.title}
 */
import { ${spec.spinFn} } from '${spec.spinImport}';
${effective}import { BET_LEVELS, RATE_LIMIT_SPIN_MS, REQUIRE_AUTH } from './config.mjs';
import { loadSession, saveSession, cacheSpinResult, getCachedSpin } from './session-store.mjs';
import { auditSpin } from './audit.mjs';

const GAME = '${id}';

/** @type {Map<string, number>} */
const lastSpinAt = new Map();

function resolvePlayer(req) {
  const auth = req.headers?.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const token = bearer || req.query.token || req.body?.token;
  if (REQUIRE_AUTH && !token) return { error: 'Authentication required', status: 401 };
  const playerId = token ? String(token) : String(req.query.session || req.body?.session || req.ip || 'default');
  return { playerId };
}

function sessionState(session) {
${sessionStateBlock}
}

export function handleGetSession(req, res) {
  const player = resolvePlayer(req);
  if ('error' in player) return res.status(player.status).json({ error: player.error });

  const q = { ...req.query, ...req.body };
  const balanceHint = q.balance != null ? parseInt(q.balance, 10) : undefined;
  const session = loadSession(player.playerId, balanceHint);

  res.json({
    game: GAME,
    balance: session.balance,
    bet: session.bet ?? 20,
    betLevels: BET_LEVELS,
    state: sessionState(session),
    playerId: player.playerId,
  });
}

export function handleV2Spin(req, res) {
  const player = resolvePlayer(req);
  if ('error' in player) return res.status(player.status).json({ error: player.error });

  const q = { ...req.query, ...req.body };
  const balanceHint = q.balance != null ? parseInt(q.balance, 10) : undefined;
  const session = loadSession(player.playerId, balanceHint);

  const bet = parseInt(q.bet, 10) || session.bet || 20;
  if (!BET_LEVELS.includes(bet)) {
    return res.status(400).json({ error: \`Invalid bet. Allowed: \${BET_LEVELS.join(', ')}\` });
  }
  session.bet = bet;

  const spinId = q.spinId != null ? String(q.spinId) : null;
  if (spinId) {
    const cached = getCachedSpin(player.playerId, spinId);
    if (cached) return res.json({ ...cached, replay: true });
  }

  const now = Date.now();
  const last = lastSpinAt.get(player.playerId) ?? 0;
  if (now - last < RATE_LIMIT_SPIN_MS) {
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

${chargeBlock}
  if (session.balance < charge) {
    return res.status(400).json({ error: 'Insufficient balance', balance: session.balance });
  }

  lastSpinAt.set(player.playerId, now);
  const result = ${spec.spinFn}(session, bet, { spinId: spinId ?? Date.now() });

  const response = { game: GAME, spinId: spinId ?? result.spinId, ...result, betLevels: BET_LEVELS };
  if (spinId) cacheSpinResult(player.playerId, spinId, response);
  saveSession(player.playerId, session);

  auditSpin({
    playerId: player.playerId,
    game: GAME,
    spinId: response.spinId,
    bet: response.bet,
    win: response.win,
    balance: response.balance,
    fsRemaining: response.state?.fsRemaining ?? 0,
  });

  res.json(response);
}
`;
  fs.writeFileSync(path.join(target, 'server', 'spin-api.mjs'), content);
}

function writeMain(target, mountFn) {
  fs.writeFileSync(
    path.join(target, 'src', 'main.js'),
    `import './styles.css';
import { ${mountFn} } from './engine/SlotGame.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount missing');

${mountFn}(root).catch((err) => {
  console.error('[boot] failed', err);
  root.innerHTML = \`<pre class="gc-boot-error">\${err instanceof Error ? err.message : String(err)}</pre>\`;
});
`,
  );
}

function writeReadme(target, spec, mountFn) {
  const note = spec.readmeNote ? `\n\n> ${spec.readmeNote}\n` : '';
  fs.writeFileSync(
    path.join(target, 'README.md'),
    `# ${spec.title} — PixiJS Mobile Client

Native PixiJS mobile client ported from \`slot-games-client\`.${note}

## Run

\`\`\`powershell
cd games/${spec.id}
npm install
npm run dev
\`\`\`

Open **http://localhost:${spec.port}/**

## Assets

Assets are copied from \`slot-games-client/public/assets/${spec.assetPkg}/\`.
If missing, run asset fetch scripts in \`slot-games-client\` first.
`,
  );
}

function scaffoldGame(id) {
  const spec = GAMES[id];
  if (!spec) throw new Error(`Unknown game: ${id}`);

  const target = path.join(ROOT, 'games', id);
  console.log(`\n=== Scaffolding ${spec.title} → ${target}`);

  if (fs.existsSync(target)) {
    console.log('  Removing existing…');
    rmrf(target);
  }

  copyDir(TEMPLATE, target, (src) => {
    const rel = path.relative(TEMPLATE, src).replace(/\\/g, '/');
    if (rel.startsWith('data/sessions') || rel.startsWith('data/audit')) return false;
    if (rel.startsWith('public/assets/rise-of-olympus')) return false;
    if (rel.startsWith('server/games/rise-of-olympus')) return false;
    if (rel === 'scripts/fetch-roo-coins.mjs' || rel === 'scripts/fetch-roo-sounds.mjs') return false;
    return true;
  });

  const gameDir = path.join(target, 'src', 'game');
  rmrf(gameDir);
  fs.mkdirSync(gameDir, { recursive: true });

  const clientSrc = path.join(CLIENT_ROOT, 'src', 'games', spec.clientPkg);
  copyDir(clientSrc, gameDir);
  for (const extra of spec.extraFiles) {
    copyDir(
      path.join(CLIENT_ROOT, 'src', 'games', extra.from),
      path.join(gameDir, extra.to),
    );
  }

  const serverSrc = path.join(CLIENT_ROOT, 'server', 'games', spec.clientPkg);
  const serverDest = path.join(target, 'server', 'games', id);
  copyDir(serverSrc, serverDest);

  const assetSrc = path.join(CLIENT_ROOT, 'public', 'assets', spec.assetPkg);
  const assetDest = path.join(target, 'public', 'assets', id);
  if (fs.existsSync(assetSrc)) {
    console.log('  Copying assets…');
    copyDir(assetSrc, assetDest);
  } else {
    console.warn(`  WARN: assets missing at ${assetSrc}`);
  }

  const assetBase = `/assets/${id}`;
  for (const file of fs.readdirSync(gameDir)) {
    if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
    patchFile(path.join(gameDir, file), [
      [`/assets/${spec.assetPkg}`, assetBase],
      [`'/assets/${spec.assetPkg}'`, `'${assetBase}'`],
      ['../football-gold/SymbolClipPlayer.js', './SymbolClipPlayer.js'],
      ['../football-gold/ReelAnimator.js', './ReelAnimator.js'],
    ]);
  }

  patchFile(path.join(target, 'server', 'config.mjs'), [
    ["process.env.PORT || '5180'", `process.env.PORT || '${spec.port}'`],
  ]);
  patchFile(path.join(target, 'server', 'index.mjs'), [
    ["game: 'rise-of-olympus'", `game: '${id}'`],
    ['Rise of Olympus', spec.title],
  ]);
  patchFile(path.join(target, 'package.json'), [
    ['rise-of-olympus-mobile', `${id}-mobile`],
    ['Rise of Olympus', spec.title],
  ]);
  const pkgPath = path.join(target, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  delete pkg.scripts['fetch-sounds'];
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  patchFile(path.join(target, 'index.html'), [
    ['Rise of Olympus — PixiJS', `${spec.title} — PixiJS`],
    ['#0a1028', spec.cssTheme === 'egypt' ? '#120818' : spec.cssTheme === 'football' ? '#0a1a0f' : '#0a1028'],
  ]);
  patchFile(path.join(target, 'src', 'api', 'spin-api.js'), [
    ["const SESSION_KEY = 'roo-session'", `const SESSION_KEY = '${spec.sessionPrefix}-session'`],
    ["const PLAYER_KEY = 'roo-player'", `const PLAYER_KEY = '${spec.sessionPrefix}-player'`],
  ]);
  fs.writeFileSync(
    path.join(target, 'vite.config.js'),
    `import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/',
  assetsInclude: ['**/*.skel'],
  server: {
    port: ${spec.port},
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
  },
});
`,
  );

  const mountFn = writeSlotGame(target, id, spec);
  writeSpinApi(target, id, spec);
  writeMain(target, mountFn);
  writeReadme(target, spec, mountFn);

  console.log('  npm install…');
  execSync('npm install', { cwd: target, stdio: 'inherit' });
  console.log(`  Done → http://localhost:${spec.port}/`);
}

const args = process.argv.slice(2);
const all = args.includes('--all');
const gameArg = args.includes('--game') ? args[args.indexOf('--game') + 1] : null;
const list = all ? Object.keys(GAMES) : gameArg ? [gameArg] : [];

if (!list.length) {
  console.error('Usage: node tools/scaffold-mobile-game.mjs --all | --game <id>');
  console.error('Games:', Object.keys(GAMES).join(', '));
  process.exit(1);
}

for (const id of list) scaffoldGame(id);
