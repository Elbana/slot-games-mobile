import './styles.css';

function ensureLink(href, datasetKey) {
  if (document.querySelector(`link[data-${datasetKey}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset[datasetKey] = '1';
  document.head.appendChild(link);
}

function ensureScript(src, datasetKey) {
  if (document.querySelector(`script[data-${datasetKey}]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.dataset[datasetKey] = '1';
  document.head.appendChild(script);
}

// Absolute URLs — Vite dev transform can omit server head injections.
ensureLink('/shared/mobile-shell.css', 'gmShell');
const shellParams = new URLSearchParams(location.search);
if (shellParams.get('host') === 'riko' || shellParams.get('embed') === 'host') {
  document.documentElement.dataset.gmHostEmbed = '1';
}
if (shellParams.get('standalone') === '1') {
  document.documentElement.dataset.gmStandalone = '1';
}
if (shellParams.get('host') === 'riko' || shellParams.get('embed') === 'host' || shellParams.get('standalone') === '1') {
  ensureScript('/shared/standalone-mode.js', 'gmStandalone');
}

import { mountRiseOfOlympus } from './engine/SlotGame.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount missing');

mountRiseOfOlympus(root).catch((err) => {
  console.error('[RiseOfOlympus] boot failed', err);
  root.innerHTML = `<pre class="gc-boot-error">${err instanceof Error ? err.message : String(err)}</pre>`;
});
