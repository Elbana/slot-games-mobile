/**
 * Start games-mobile server, run smoke tests, then exit.
 * npm run test:live
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* starting */
    }
    await sleep(300);
  }
  throw new Error(`Server did not start on ${BASE}`);
}

const child = spawn(process.execPath, ['server/index.mjs', '--dev'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let failed = false;

child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));

try {
  await waitForHealth();
  const smoke = spawn(process.execPath, ['tools/smoke-games.mjs'], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL: BASE },
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => smoke.on('close', resolve));
  if (code !== 0) failed = true;
} catch (err) {
  console.error(err.message || err);
  failed = true;
} finally {
  child.kill('SIGTERM');
  await sleep(500);
}

process.exit(failed ? 1 : 0);
