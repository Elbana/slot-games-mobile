/**
 * Football Gold — rules & paytable (symbol art from SOR spritesheets).
 */

const PAYTABLE_ROWS = [
  { label: 'Low pays 1 / 2', ids: [0, 1], pays: ['5×', '15×', '40×'] },
  { label: 'Low pays 3 / 4', ids: [2, 3], pays: ['8×', '20×', '50×'] },
  { label: 'Medals / Cards', ids: [4, 5], pays: ['12×', '30×', '80×'] },
  { label: 'Stars / Cups', ids: [6, 7], pays: ['20×', '50×', '120× / 200×'] },
];

export const RULES_HTML = `
<h2>Football Gold</h2>
<p>Classic <strong>5×3</strong> slot with <strong>10 paylines</strong>. Wins pay left to right.</p>
<h3>Wild</h3>
<p>Wild substitutes for all symbols except Trophy scatter.</p>
<h3>Trophy scatter</h3>
<p>Land 3+ Trophies on reels 2, 3 &amp; 4 to spin the <strong>Free Spins Wheel</strong> (8–20 free spins).</p>
<p>During free spins, 3+ Trophies retrigger <strong>+5</strong> spins.</p>
<h3>Bet</h3>
<p>Total bet is split across 10 lines. Free spins cost no balance.</p>
`;

/**
 * @param {HTMLElement} mount
 */
export function mountPaytablePanel(mount) {
  const rows = PAYTABLE_ROWS.map(
    ({ label, pays }) =>
      `<tr><td>${label}</td><td>${pays[0]}</td><td>${pays[1]}</td><td>${pays[2]}</td></tr>`
  ).join('');

  mount.innerHTML = `
    <div class="gc-paytable" role="dialog" aria-label="Game rules" hidden>
      <div class="gc-paytable__backdrop"></div>
      <div class="gc-paytable__sheet">
        <button type="button" class="gc-paytable__close" aria-label="Close">×</button>
        <div class="gc-paytable__body">
          ${RULES_HTML}
          <h3>Paytable (× line bet)</h3>
          <table class="gc-paytable__table">
            <thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  const root = mount.querySelector('.gc-paytable');
  const close = () => {
    root.hidden = true;
  };
  mount.querySelector('.gc-paytable__close').addEventListener('click', close);
  mount.querySelector('.gc-paytable__backdrop').addEventListener('click', close);
  return { open: () => { root.hidden = false; }, close };
}
