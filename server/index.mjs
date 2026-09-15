/**
 * games-mobile — unified platform server (slots + lottery).
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { injectMobilePlayHead } from './mobile-head.mjs';
import { applyProductionDefaults, CORS_ORIGINS, GAMES_ROOT, IS_PRODUCTION, PORT } from './config.mjs';
import { handleGetCatalog } from './routes/catalog.mjs';
import { handleGetEconomy } from './routes/economy.mjs';
import { handleGetBetting } from './routes/betting.mjs';
import { handleGetLauncher } from './routes/launcher.mjs';
import { handleGetSession, handleV2Spin } from './routes/slot-v2.mjs';
import { mountLotteryRoutes } from './routes/lottery.mjs';
import { mountDiceDualRoutes } from './routes/dice-dual.mjs';
import { mountFootballClashRoutes } from './routes/football-clash.mjs';
import { mountRocketRoutes } from './routes/rocket.mjs';
import { listGames } from './registry/games.mjs';
import { SLOT_SLUG } from './registry/game-names.mjs';
import { handleGetLaunch } from './routes/launch.mjs';
import { mountRealtimeRoutes } from './routes/realtime.mjs';
import { verifyLaunchToken } from './auth/launch-token.mjs';
import { describeMathProfile } from './math-profile.mjs';

applyProductionDefaults();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.argv.includes('--dev');

const app = express();
app.use(express.json());

/** Expand signed launch tokens into token/player/game query params for WebView URLs. */
app.use((req, _res, next) => {
  const launch = req.query.launch;
  if (typeof launch === 'string' && launch) {
    const payload = verifyLaunchToken(launch);
    if (payload) {
      req.query.token = payload.ot;
      req.query.player = payload.pid;
      req.query.game = payload.game;
    }
  }
  next();
});

if (CORS_ORIGINS.length) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Operator-Token, X-Player-Id, X-Lottery-Session');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    env: IS_PRODUCTION ? 'production' : 'development',
    games: listGames().map((g) => g.slug),
  });
});

app.get('/api/v1/games', handleGetCatalog);
app.get('/api/v1/launch', handleGetLaunch);
app.get('/api/v1/economy', handleGetEconomy);
app.get('/api/v1/betting', handleGetBetting);
app.get('/api/v2/session', handleGetSession);
app.get('/api/v2/spin', handleV2Spin);
app.post('/api/v2/spin', handleV2Spin);

mountLotteryRoutes(app);
mountDiceDualRoutes(app);
mountFootballClashRoutes(app);
mountRocketRoutes(app);
mountRealtimeRoutes(app);

app.use('/launcher', express.static(path.join(ROOT, 'public', 'launcher')));

// Lottery static assets (legacy paths from cloned UIs)
app.use('/shared', express.static(path.join(GAMES_ROOT, 'shared')));
app.use('/lottery/greedy', express.static(path.join(GAMES_ROOT, 'greedy')));
app.use('/lottery/petsbeasts', express.static(path.join(GAMES_ROOT, 'pets-beasts', 'assets')));
app.use('/lottery/lucky77', express.static(path.join(GAMES_ROOT, 'lucky77')));
app.use('/dice-dual', express.static(path.join(GAMES_ROOT, 'dice-dual')));
app.use('/football-clash', express.static(path.join(GAMES_ROOT, 'football-clash')));
app.use('/rocket', express.static(path.join(GAMES_ROOT, 'rocket')));
app.use('/bet-advisor', express.static(path.join(GAMES_ROOT, 'bet-advisor')));

function sendPlayPage(res, htmlPath, req) {
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).type('text/plain').send('Game not found');
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  const qs = new URLSearchParams();
  if (req.query.token) qs.set('token', req.query.token);
  if (req.query.player) qs.set('player', req.query.player);
  if (req.query.launch) qs.set('launch', req.query.launch);
  const inject = qs.size ? `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>` : '';
  html = injectMobilePlayHead(html, inject);
  res.type('html').send(html);
}

app.get('/play/greedy-feast', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'greedy', 'play.html'), req);
});

app.get('/play/luck-77', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'lucky77', 'play.html'), req);
});

app.get('/play/dice-duel', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'dice-dual', 'play.html'), req);
});

app.get('/play/goal-clash', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'football-clash', 'play.html'), req);
});

app.get('/play/rocket-rush', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'rocket', 'play.html'), req);
});

app.get('/play/bet-advisor', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'bet-advisor', 'index.html'), req);
});

app.get('/', handleGetLauncher);

const server = createServer(app);
let rooVite = null;

function fixMobileShellLinks(html) {
  return html.replace(
    /href="\/play\/olympus-rise\/shared\/mobile-shell\.css"/g,
    'href="/shared/mobile-shell.css"',
  );
}

async function mountRiseOfOlympus() {
  const rooRoot = path.join(GAMES_ROOT, 'rise-of-olympus');
  const rooDist = path.join(rooRoot, 'dist');
  const rooPublic = path.join(rooRoot, 'public');

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    rooVite = await createViteServer({
      root: rooRoot,
      configFile: path.join(rooRoot, 'vite.config.js'),
      server: { middlewareMode: true, hmr: { server } },
    });

    app.use(`/play/${SLOT_SLUG}`, rooVite.middlewares);
    app.get(`/play/${SLOT_SLUG}`, async (req, res, next) => {
      try {
        const html = fs.readFileSync(path.join(rooRoot, 'index.html'), 'utf8');
        const transformed = await rooVite.transformIndexHtml(req.originalUrl, html);
        const qs = new URLSearchParams(req.query);
        const inject = qs.size
          ? `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>`
          : '';
        const out = fixMobileShellLinks(injectMobilePlayHead(transformed, inject));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(out);
      } catch (err) {
        next(err);
      }
    });
    app.use(rooVite.middlewares);
  } else {
    app.use(`/play/${SLOT_SLUG}`, express.static(rooDist));
    app.use('/assets', express.static(path.join(rooPublic, 'assets')));
    app.get(`/play/${SLOT_SLUG}`, (_req, res) => {
      const index = path.join(rooDist, 'index.html');
      if (!fs.existsSync(index)) {
        return res.status(503).type('text/plain').send('Build rise-of-olympus first: npm run build');
      }
      let html = fs.readFileSync(index, 'utf8');
      const qs = new URLSearchParams(_req.query);
      const inject = qs.size
        ? `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>`
        : '';
      html = injectMobilePlayHead(html, inject);
      html = fixMobileShellLinks(html);
      res.type('html').send(html);
    });
  }
}

await mountRiseOfOlympus();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`games-mobile platform — http://0.0.0.0:${PORT}/ (emulator: http://10.0.2.2:${PORT}/)`);
  console.log(describeMathProfile());
  console.log(`Games: ${listGames().map((g) => g.slug).join(', ')}`);
  if (isDev) console.log('Dev mode: Vite (RoO) + static lottery clients');
});
