/**
 * Download Rise of Olympus sound sprites → public/assets/rise-of-olympus/sounds/
 * Run: node scripts/fetch-roo-sounds.mjs
 */

import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'rise-of-olympus', 'sounds');
const CDN =
  'https://cdn.playngonetwork.com/1.3.3-riseofolympus1000.364/resources/games/gridslot/riseofolympus1000/sounds';
const LOCAL_CDN = join(
  ROOT,
  '..',
  '..',
  'olympus-compose',
  'resources',
  'cdn',
  '1.3.3-riseofolympus1000.364',
  'resources',
  'games',
  'gridslot',
  'riseofolympus1000',
  'sounds'
);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  Referer: 'https://cdn.playngonetwork.com/',
  Accept: '*/*',
};

const FILES = [
  'sounds_mobile.json',
  'sounds_mobile_0.json',
  'sounds_mobile_1.json',
  'sounds_mobile_2.json',
  'sounds_mobile_0.mp3',
  'sounds_mobile_1.mp3',
  'sounds_mobile_2.mp3',
];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuf(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ensureFile(name) {
  const dest = join(OUT, name);
  if (await exists(dest)) {
    console.log(`  skip ${name} (exists)`);
    return;
  }

  const local = join(LOCAL_CDN, name);
  if (await exists(local)) {
    await copyFile(local, dest);
    console.log(`  copy ${name} (local cache)`);
    return;
  }

  const buf = await fetchBuf(`${CDN}/${name}`);
  await writeFile(dest, buf);
  console.log(`  ok ${name} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

await mkdir(OUT, { recursive: true });
console.log('Fetching RoO sounds…\n');
for (const name of FILES) {
  await ensureFile(name);
}
console.log('\nDone.');
