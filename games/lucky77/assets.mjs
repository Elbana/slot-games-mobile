/**
 * Lucky 77 asset paths — single source of truth for the client.
 * Swap files under assets/ (same names) or edit manifest.json.
 */

export const L77_ASSET_BASE = '/lottery/lucky77/assets';

/** @type {Record<string, string>} */
let symbolPaths = {
  lemon: 'lemon.png',
  melon: 'watermelon.png',
  seven: 'seven.svg',
};

/** @type {Record<string, string>} */
let uiPaths = {
  coin: 'coin.png',
  stageBg: 'stage-bg.jpg',
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
