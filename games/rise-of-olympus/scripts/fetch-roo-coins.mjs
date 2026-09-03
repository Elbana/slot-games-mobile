/**
 * Download RoO coin particle atlas → public/assets/rise-of-olympus/coins/
 * Run: node scripts/fetch-roo-coins.mjs
 */
import { mkdir, copyFile, access, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'rise-of-olympus', 'coins');
const CDN =
  'https://cdn.playngonetwork.com/1.3.3-riseofolympus1000.364/resources/games/gridslot/riseofolympus1000/main';
const LOCAL_CDN = join(
  ROOT,
  '..',
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
  'main',
);
const BUNDLE = join(
  ROOT,
  '..',
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
  'game_bundle.json',
);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  Referer: 'https://cdn.playngonetwork.com/',
  Accept: '*/*',
};

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function download(name) {
  const dest = join(OUT, name);
  if (await exists(dest)) {
    console.log('[coins] skip (exists)', name);
    return;
  }
  const local = join(LOCAL_CDN, name);
  if (await exists(local)) {
    await copyFile(local, dest);
    console.log('[coins] copied local', name);
    return;
  }
  const url = `${CDN}/${name}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log('[coins] downloaded', name, buf.length);
}

function buildSpritesheetJson() {
  const raw = JSON.parse(readFileSync(BUNDLE, 'utf8'));
  const main = raw.bundle.find((b) => b.name === 'main');
  const srcFrames = main.data.tex.main_texture0.frames;
  const coinClips = main.data.cls.filter((c) => /^coin0[1-5]$/.test(c.lcn || ''));
  const outFrames = {};
  for (const clip of coinClips) {
    for (let i = 0; i < clip.tl.length; i++) {
      const tex = clip.tl[i].dl[0].tex;
      const key = `${clip.lcn}_${i}`;
      const f = srcFrames[tex]?.frame;
      if (!f) continue;
      outFrames[`${key}.png`] = {
        frame: { x: f.x, y: f.y, w: f.w, h: f.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
        sourceSize: { w: f.w, h: f.h },
      };
    }
  }
  return {
    frames: outFrames,
    meta: {
      image: 'main_texture0_level2.png',
      format: 'RGBA8888',
      size: main.data.tex.main_texture0.meta.size,
      scale: '1',
    },
  };
}

await mkdir(OUT, { recursive: true });
await download('main_texture0_level2.png');
const sheet = buildSpritesheetJson();
await writeFile(join(OUT, 'coin_sprites.json'), JSON.stringify(sheet));
console.log('[coins] wrote coin_sprites.json', Object.keys(sheet.frames).length, 'frames');
