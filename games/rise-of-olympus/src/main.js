import './styles.css';
import { mountRiseOfOlympus } from './engine/SlotGame.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount missing');

mountRiseOfOlympus(root).catch((err) => {
  console.error('[RiseOfOlympus] boot failed', err);
  root.innerHTML = `<pre class="gc-boot-error">${err instanceof Error ? err.message : String(err)}</pre>`;
});
