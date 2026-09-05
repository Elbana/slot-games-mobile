/**
 * Download Greedy + Pets & Beasts static assets into games-mobile.
 * Run: node tools/cache-lottery-assets.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ORIGIN = process.env.LOTTERY_ORIGIN || 'https://121233.com';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games');

const GREEDY_SYMBOLS = [
  'BIGO_GREEDY_TOMATO',
  'BIGO_GREEDY_CABBAGE',
  'BIGO_GREEDY_CORN',
  'BIGO_GREEDY_CARROTS',
  'BIGO_GREEDY_SALAD',
  'BIGO_GREEDY_BEEF',
  'BIGO_GREEDY_CHICKEN_LEGS',
  'BIGO_GREEDY_KEBABS',
  'BIGO_GREEDY_HOT_DOGS',
  'BIGO_GREEDY_PIZZA',
  'BIGO_GREEDY_VEGETABLE_BASKET',
  'BIGO_GREEDY_MEAT_PLATES',
];

const PETS_SYMBOLS = [
  'PETS_BEASTS_EAGLE',
  'PETS_BEASTS_TIGER',
  'PETS_BEASTS_LION',
  'PETS_BEASTS_UNICORN',
  'PETS_BEASTS_DOG',
  'PETS_BEASTS_CAT',
  'PETS_BEASTS_RABBIT',
  'PETS_BEASTS_BEAR',
];

const GREEDY_STATIC = [
  'gameBg.png',
  'bet-entrance.png',
  'gold-bg.png',
  'history-bg-red.png',
  'history-bg-blue.png',
  'bottom-bg.png',
  'hot.png',
  'history-new.png',
  'help-icon.png',
  'time-icon.png',
  'home-icon@2x.png',
  'switch-icon.png',
  'x-1@2x.png',
  'x-2@2x.png',
  'x-4@2x.png',
  'pizza@2x.png',
  'salad@2x.png',
  'zs@2x.png',
  'r-1@2x.png',
  'r-2@2x.png',
  'r-3@2x.png',
  'greedy-new/king.png',
];

const PETS_STATIC = [
  'gameBg.png',
  'bottom-bg.png',
  'loading.gif',
  'new.png',
  'logo.png',
  'help-icon.png',
  'time-icon.png',
  'home-icon@2x.png',
  'box-running.png',
  'box-default.png',
  'box-active.png',
  'x-1@2x.png',
  'x-2@2x.png',
];

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { skipped: true };
  }
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { bytes: buf.length };
}

async function cacheSet(prefix, staticFiles, symbols, outDir) {
  const tasks = [];
  for (const file of staticFiles) {
    tasks.push({ rel: file, url: `${ORIGIN}/${prefix}/${file}`, dest: path.join(outDir, file) });
  }
  for (const sym of symbols) {
    tasks.push({
      rel: `${sym}.png`,
      url: `${ORIGIN}/${prefix}/${sym}.png`,
      dest: path.join(outDir, `${sym}.png`),
    });
    if (prefix === 'greedy') {
      tasks.push({
        rel: `prize/${sym}_TIP.png`,
        url: `${ORIGIN}/${prefix}/prize/${sym}_TIP.png`,
        dest: path.join(outDir, 'prize', `${sym}_TIP.png`),
      });
    }
  }

  let ok = 0;
  let fail = 0;
  for (const t of tasks) {
    try {
      const r = await download(t.url, t.dest);
      ok++;
      if (!r.skipped) console.log(`  ok ${t.rel} (${r.bytes} bytes)`);
    } catch (e) {
      fail++;
      console.warn(`  fail ${t.rel}: ${e.message}`);
    }
  }
  return { ok, fail, total: tasks.length };
}

console.log(`Caching lottery assets from ${ORIGIN}\n`);

console.log('Greedy:');
const g = await cacheSet('greedy', GREEDY_STATIC, GREEDY_SYMBOLS, path.join(GAMES, 'greedy'));
console.log(`  ${g.ok}/${g.total} ok, ${g.fail} failed\n`);

console.log('Pets assets (shared path /lottery/petsbeasts):');
const petsAssets = path.join(GAMES, 'pets-beasts', 'assets');
const p = await cacheSet('petsbeasts', PETS_STATIC, PETS_SYMBOLS, petsAssets);
console.log(`  ${p.ok}/${p.total} ok, ${p.fail} failed\n`);

console.log('Done.');
