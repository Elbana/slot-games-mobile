/**
 * Thrones of Olympus — paytable data & rules copy (original text).
 */

export const SYMBOL_NAMES = [
  'Stone Alpha',
  'Stone Beta',
  'Stone Gamma',
  'Stone Delta',
  'Bar I',
  'Bar II',
  'Bar III',
  'Crown I',
  'Crown II',
  'Crown III',
  'Power Orb',
  'Scatter',
  'Ember Orb',
  'Tide Orb',
  'Storm Orb',
];

/** Coins per cluster size tier: 12+, 11, 10, 9, 8 */
export const PAYTABLE = {
  0: [9, 6, 4, 3, 1],
  1: [9, 6, 4, 3, 1],
  2: [12, 8, 6, 4, 2],
  3: [12, 8, 6, 4, 2],
  4: [18, 12, 9, 5, 3],
  5: [18, 12, 9, 5, 3],
  6: [25, 16, 12, 6, 4],
  7: [35, 24, 16, 8, 5],
  8: [55, 34, 22, 12, 6],
  9: [90, 50, 34, 16, 8],
};

export const CLUSTER_SIZES = ['12+', '11', '10', '9', '8'];

export const RULES_HTML = `
<h2>Thrones of Olympus</h2>
<p>6×5 cluster slot. Wins form when <strong>8 or more</strong> matching symbols connect orthogonally.</p>
<h3>Cascades</h3>
<p>Winning clusters are removed. Symbols fall and new ones refill the grid. Cascades continue until no new wins appear.</p>
<h3>Power Orbs</h3>
<p>Ember, Tide, and Storm orbs land with multiplier values. All orb values on the grid sum together and multiply the round win.</p>
<p>After each cascade, orbs may upgrade to higher multiplier tiers (×2 up to ×1000).</p>
<h3>Free Spins</h3>
<p>Land <strong>3 or more Scatters</strong> to trigger <strong>12 Free Spins</strong>. During Free Spins, orb multipliers accumulate into a persistent session multiplier applied to all wins.</p>
<p>Retrigger: 3+ Scatters award <strong>+3</strong> extra spins (max 36 total).</p>
<h3>Bet</h3>
<p>Select your bet before each spin. Free Spins do not deduct balance.</p>
`;

/**
 * @param {HTMLElement} mount
 */
export function mountPaytablePanel(mount) {
  const tiers = [7, 8, 9, 4, 5, 6, 0, 1, 2, 3];
  const rows = tiers
    .map((sym) => {
      const pays = PAYTABLE[sym];
      const cells = CLUSTER_SIZES.map((_, i) => `<td>${pays[i]}</td>`).join('');
      return `<tr><td>${SYMBOL_NAMES[sym]}</td>${cells}</tr>`;
    })
    .join('');

  mount.innerHTML = `
    <div class="gc-paytable" role="dialog" aria-label="Game rules" hidden>
      <div class="gc-paytable__backdrop"></div>
      <div class="gc-paytable__sheet">
        <button type="button" class="gc-paytable__close" aria-label="Close">×</button>
        <div class="gc-paytable__body">
          ${RULES_HTML}
          <h3>Paytable (coins per cluster)</h3>
          <table class="gc-paytable__table">
            <thead><tr><th>Symbol</th>${CLUSTER_SIZES.map((s) => `<th>${s}</th>`).join('')}</tr></thead>
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

  return {
    open() {
      root.hidden = false;
    },
    close,
  };
}
