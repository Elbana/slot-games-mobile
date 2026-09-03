/**
 * Egypt Treasures — DOM HUD copied from TOT mobile gamepanel.
 */

import './egypt-tot-hud.css';

/**
 * @param {HTMLElement} root
 * @param {{ betLevels?: number[], onSpin: () => void, onBetChange?: (bet: number) => void, onRules?: () => void }} opts
 */
export function createEgyptHUD(root, opts) {
  const levels = opts.betLevels ?? [20, 40, 60, 100, 200, 500, 1000];
  const assetBase = '/assets/temple-of-three';

  root.innerHTML = `
    <div class="gc-hud gc-hud--egypt">
      <header class="gc-hud__top gc-hud__top--egypt">
        <a class="gc-hud__back" href="/games">← Games</a>
        <button type="button" id="gc-rules" class="gc-hud__rules">Rules</button>
      </header>
      <footer id="tot-gamepanel" class="pt fg tot-gamepanel" style="--tot-bottom-bg: url('${assetBase}/bottomBg.png'); --tot-ui-elements: url('${assetBase}/uiElements2.png'); --tot-ui: url('${assetBase}/ui.png');">
        <div id="backgroundImg"></div>
        <div id="bottomPanelWrapper">
          <div id="moneyBalanceWrapper">
            <span id="balanceText">Balance</span>
            <strong id="moneyBalance">—</strong>
          </div>
          <div id="buttonsWrapper" class="pt">
            <div id="spinBtnWrapper">
              <button type="button" id="spinBtn" aria-label="Spin"></button>
              <div id="spinBtnPulse"></div>
            </div>
          </div>
          <div id="moneyWinWrapper">
            <span id="winText">Win</span>
            <strong id="moneyWin" class="moneyWin">0</strong>
          </div>
          <div id="coinsBetWrapper">
            <span class="coinsText">Bet</span>
            <select id="gc-bet" class="coinsBet" aria-label="Bet amount">
              ${levels.map((b) => `<option value="${b}">${b.toLocaleString()}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="tot-feature" id="gc-feature" hidden></div>
        <p class="tot-msg" id="gc-msg" hidden></p>
      </footer>
    </div>`;

  const balanceEl = root.querySelector('#moneyBalance');
  const winEl = root.querySelector('#moneyWin');
  const spinBtn = root.querySelector('#spinBtn');
  const betSelect = root.querySelector('#gc-bet');
  const msgEl = root.querySelector('#gc-msg');
  const featureEl = root.querySelector('#gc-feature');

  spinBtn.addEventListener('click', () => opts.onSpin());
  root.querySelector('#gc-rules').addEventListener('click', () => opts.onRules?.());
  betSelect.addEventListener('change', () => opts.onBetChange?.(parseInt(betSelect.value, 10)));

  return {
    setBalance(v) {
      balanceEl.textContent = v.toLocaleString();
    },
    setWin(v) {
      winEl.textContent = v.toLocaleString();
      winEl.classList.toggle('tot-win--active', v > 0);
    },
    setBet(v) {
      betSelect.value = String(v);
    },
    getBet() {
      return parseInt(betSelect.value, 10);
    },
    setBetEnabled(on) {
      betSelect.disabled = !on;
    },
    setSpinEnabled(on) {
      spinBtn.disabled = !on;
      spinBtn.classList.toggle('is-disabled', !on);
    },
    setMessage(text) {
      if (!text) {
        msgEl.hidden = true;
        msgEl.textContent = '';
        return;
      }
      msgEl.hidden = false;
      msgEl.textContent = text;
    },
    setFeature(text) {
      if (!text) {
        featureEl.hidden = true;
        featureEl.textContent = '';
        return;
      }
      featureEl.hidden = false;
      featureEl.textContent = text;
    },
  };
}
