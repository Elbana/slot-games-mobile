import './styles.css';

// Absolute URL — must not go through Vite index transform (base path breaks /shared/…).
if (!document.querySelector('link[data-gm-shell]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/shared/mobile-shell.css';
  link.dataset.gmShell = '1';
  document.head.appendChild(link);
}

import { mountRiseOfOlympus } from './engine/SlotGame.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount missing');

mountRiseOfOlympus(root).catch((err) => {
  console.error('[RiseOfOlympus] boot failed', err);
  root.innerHTML = `<pre class="gc-boot-error">${err instanceof Error ? err.message : String(err)}</pre>`;
});
