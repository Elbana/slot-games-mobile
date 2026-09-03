import './styles.css';
import { mountSpinninRecordsIntoTheBeat } from './engine/SlotGame.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount missing');

mountSpinninRecordsIntoTheBeat(root).catch((err) => {
  console.error('[boot] failed', err);
  root.innerHTML = `<pre class="gc-boot-error">${err instanceof Error ? err.message : String(err)}</pre>`;
});
