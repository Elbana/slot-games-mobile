/**
 * Lucky 77 asset paths — single source of truth for the client.
 * Swap files under assets/ (same names) or edit manifest.json.
 */

export const L77_ASSET_BASE = '/lottery/lucky77/assets';

/** @type {Record<string, string>} */
let symbolPaths = {
  lemon: 'lemon.png',
  melon: 'watermelon.png',
  seven: 'seven.png',
};

/** @type {Record<string, string>} */
let uiPaths = {
  coin: 'coin.png',
  pointer: 'pointer.png',
  wheelRing: 'wheel-ring.png',
  stageBg: 'stage-bg.jpg',
  statue: 'statue.png',
  betPanel: 'bet-panel.png',
  chip100: 'chip-100.png',
  chip1k: 'chip-1k.png',
  chip10k: 'chip-10k.png',
  chip100k: 'chip-100k.png',
};

export function assetUrl(relativePath) {
  return `${L77_ASSET_BASE}/${relativePath}`;
}

export function symbolAssetUrl(kind) {
  const file = symbolPaths[kind];
  return file ? assetUrl(file) : '';
}

export function uiAssetUrl(key) {
  const file = uiPaths[key];
  return file ? assetUrl(file) : '';
}

export function chipAssetUrl(value) {
  const map = {
    100: uiPaths.chip100,
    1000: uiPaths.chip1k,
    10000: uiPaths.chip10k,
    100000: uiPaths.chip100k,
  };
  const file = map[value];
  return file ? assetUrl(file) : '';
}

/** @returns {Record<string, string>} kind → url */
export function symbolAssetUrls() {
  return Object.fromEntries(
    Object.entries(symbolPaths).map(([k, f]) => [k, assetUrl(f)]),
  );
}

export async function loadAssetManifest() {
  try {
    const res = await fetch(`${L77_ASSET_BASE}/manifest.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.symbols) {
      if (data.symbols.lemon) symbolPaths.lemon = data.symbols.lemon;
      if (data.symbols.watermelon) symbolPaths.melon = data.symbols.watermelon;
      if (data.symbols.seven) symbolPaths.seven = data.symbols.seven;
    }
    if (data.ui) uiPaths = { ...uiPaths, ...data.ui };
  } catch {
    /* defaults */
  }
}

export { symbolPaths, uiPaths };
