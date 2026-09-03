/**
 * Temple of Three — dev + production server (Pixi client + JSON spin API).
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { handleV2Spin, handleGetSession } from './spin-api.mjs';
import { applyProductionDefaults, IS_PRODUCTION, PORT } from './config.mjs';
import { describeMathProfile } from './math-profile.mjs';

applyProductionDefaults();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.argv.includes('--dev');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');
const PUBLIC = path.join(ROOT, 'public');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, game: 'temple-of-three', env: IS_PRODUCTION ? 'production' : 'development' });
});

app.get('/api/v2/session', handleGetSession);
app.get('/api/v2/spin', handleV2Spin);
app.post('/api/v2/spin', handleV2Spin);

const server = createServer(app);

if (isDev) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    configFile: path.join(ROOT, 'vite.config.js'),
    server: { middlewareMode: true },
  });

  async function serveSpa(req, res) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    res.status(200).set({ 'Content-Type': 'text/html' }).end(await vite.transformIndexHtml(req.url, html));
  }

  app.use(vite.middlewares);
  app.get('/', serveSpa);
} else {
  app.use(express.static(DIST));
  app.use('/assets', express.static(path.join(PUBLIC, 'assets')));

  function serveSpa(_req, res) {
    if (!fs.existsSync(INDEX)) {
      return res.status(503).type('text/plain').send('Not built — run: npm run build');
    }
    res.set('Cache-Control', 'no-store');
    res.sendFile(INDEX);
  }

  app.get('/', serveSpa);
}

server.listen(PORT, () => {
  console.log(`Temple of Three (PixiJS) — http://localhost:${PORT}/`);
  console.log(describeMathProfile());
  if (isDev) console.log('Dev mode: Vite + spin API');
});
