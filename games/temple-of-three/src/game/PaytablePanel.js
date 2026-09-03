const PAYTABLE_ROWS = [
  { label: 'Royals A / J', ids: [0, 1], pays: ['5×', '15×', '50×'] },
  { label: 'Royals K / Q', ids: [2, 3], pays: ['10×', '30×', '100×'] },
  { label: 'Royal 10 / Ra', ids: [4, 5], pays: ['15×', '50×', '150×'] },
  { label: 'Anubis / Bastet', ids: [6, 7], pays: ['25×', '100×', '400×'] },
];

export const RULES_HTML = `
<h2>Egypt Treasures</h2>
<p><strong>5×3</strong> Egyptian slot with <strong>10 paylines</strong>. Wins pay left to right.</p>
<h3>Collection pots</h3>
<p>Land cash symbols to fill Bastet, Anubis, and Ra pots — triggering hold &amp; spin, multipliers, and mystery prizes.</p>
<h3>Divine Respin</h3>
<p>Non-winning spins can respin empty reels for another chance at features.</p>
<h3>Go Ultra</h3>
<p>Optional bet boost increases feature tiers when active.</p>
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
