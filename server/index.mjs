/**
 * games-mobile — unified platform server (slots + lottery).
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { applyProductionDefaults, CORS_ORIGINS, GAMES_ROOT, IS_PRODUCTION, PORT } from './config.mjs';
import { describeMathProfile } from './math-profile.mjs';
import { handleGetCatalog } from './routes/catalog.mjs';
import { handleGetEconomy } from './routes/economy.mjs';
import { handleGetLauncher } from './routes/launcher.mjs';
import { handleGetSession, handleV2Spin } from './routes/slot-v2.mjs';
import { mountLotteryRoutes } from './routes/lottery.mjs';
import { listGames } from './registry/games.mjs';

applyProductionDefaults();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.argv.includes('--dev');

const app = express();
app.use(express.json());

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
app.get('/api/v1/economy', handleGetEconomy);
app.get('/api/v2/session', handleGetSession);
app.get('/api/v2/spin', handleV2Spin);
app.post('/api/v2/spin', handleV2Spin);

mountLotteryRoutes(app);

app.use('/launcher', express.static(path.join(ROOT, 'public', 'launcher')));

// Lottery static assets (legacy paths from cloned UIs)
app.use('/shared', express.static(path.join(GAMES_ROOT, 'shared')));
app.use('/lottery/greedy', express.static(path.join(GAMES_ROOT, 'greedy')));
app.use('/lottery/pets-beasts', express.static(path.join(GAMES_ROOT, 'pets-beasts')));
app.use('/lottery/petsbeasts', express.static(path.join(GAMES_ROOT, 'pets-beasts', 'assets')));

function sendPlayPage(res, htmlPath, token, player) {
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).type('text/plain').send('Game not found');
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  const qs = new URLSearchParams();
  if (token) qs.set('token', token);
  if (player) qs.set('player', player);
  const inject = qs.size ? `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>` : '';
  html = html.replace('</head>', `${inject}</head>`);
  res.type('html').send(html);
}

app.get('/play/greedy', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'greedy', 'play.html'), req.query.token, req.query.player);
});

app.get('/play/pets-beasts', (req, res) => {
  sendPlayPage(res, path.join(GAMES_ROOT, 'pets-beasts', 'play.html'), req.query.token, req.query.player);
});

app.get('/', handleGetLauncher);

const server = createServer(app);
let rooVite = null;

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

    app.use('/play/rise-of-olympus', rooVite.middlewares);
    app.get('/play/rise-of-olympus', async (req, res, next) => {
      try {
        const html = fs.readFileSync(path.join(rooRoot, 'index.html'), 'utf8');
        const qs = new URLSearchParams(req.query);
        const inject = `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>`;
        const out = await rooVite.transformIndexHtml(req.originalUrl, html.replace('</head>', `${inject}</head>`));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(out);
      } catch (err) {
        next(err);
      }
    });
    app.use(rooVite.middlewares);
  } else {
    app.use('/play/rise-of-olympus', express.static(rooDist));
    app.use('/assets', express.static(path.join(rooPublic, 'assets')));
    app.get('/play/rise-of-olympus', (_req, res) => {
      const index = path.join(rooDist, 'index.html');
      if (!fs.existsSync(index)) {
        return res.status(503).type('text/plain').send('Build rise-of-olympus first: npm run build');
      }
      let html = fs.readFileSync(index, 'utf8');
      const qs = new URLSearchParams(_req.query);
      if (qs.size) {
        const inject = `<script>window.__PLATFORM__=${JSON.stringify(Object.fromEntries(qs))};</script>`;
        html = html.replace('</head>', `${inject}</head>`);
      }
      res.type('html').send(html);
    });
  }
}

await mountRiseOfOlympus();

server.listen(PORT, () => {
  console.log(`games-mobile platform — http://localhost:${PORT}/`);
  console.log(describeMathProfile());
  console.log('Games: rise-of-olympus, greedy, pets-beasts');
  if (isDev) console.log('Dev mode: Vite (RoO) + static lottery clients');
});
