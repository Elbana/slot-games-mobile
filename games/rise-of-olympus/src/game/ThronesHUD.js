/**
 * Thrones of Olympus — DOM HUD copied from RoO1000 mobile gamepanel (portrait .fg.pt).
 */

import './thrones-roo-hud.css';
import { playThronesSound } from './ThronesSound.js';

const ASSET_BASE = '/assets/rise-of-olympus';

/**
 * @param {HTMLElement} root
 * @param {{ betLevels?: number[], onSpin: () => void, onBetChange?: (bet: number) => void, onRules?: () => void }} opts
 */
export function createThronesHUD(root, opts) {
  const levels = opts.betLevels ?? [20, 40, 60, 100, 200, 500, 1000];

  root.innerHTML = `
    <div class="gc-hud gc-hud--thrones">
      <header class="gc-hud__top gc-hud__top--thrones">
        <span class="gc-hud__back">Rise of Olympus</span>
        <button type="button" id="gc-rules" class="gc-hud__rules">Rules</button>
      </header>
      <footer id="roo-gamepanel" class="pt roo-gamepanel" style="--roo-bottom-bg: url('${ASSET_BASE}/bottomBg.png'); --roo-ui-elements: url('${ASSET_BASE}/uiElements2.png'); --roo-ui: url('${ASSET_BASE}/ui.png');">
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
            <button type="button" id="betDec" class="roo-bet-btn roo-bet-btn--dec" aria-label="Decrease bet"></button>
            <button type="button" id="betOpen" class="coinsBet" aria-label="Select bet">—</button>
            <button type="button" id="betInc" class="roo-bet-btn roo-bet-btn--inc" aria-label="Increase bet"></button>
          </div>
        </div>
        <div id="chipSelectorWrapper" class="roo-chip-overlay" hidden>
          <div class="roo-chip-overlay__backdrop"></div>
          <div class="roo-chip-overlay__panel">
            <p class="roo-chip-overlay__title">Select bet</p>
            <div class="roo-chip-grid" id="chipGrid"></div>
            <button type="button" class="roo-chip-overlay__close" id="chipClose">Close</button>
          </div>
        </div>
        <div class="roo-feature" id="gc-feature" hidden></div>
        <p class="roo-msg" id="gc-msg" hidden></p>
      </footer>
    </div>`;

  const balanceEl = root.querySelector('#moneyBalance');
  const winEl = root.querySelector('#moneyWin');
  const spinBtn = root.querySelector('#spinBtn');
  const spinWrap = root.querySelector('#spinBtnWrapper');
  const betEl = root.querySelector('#betOpen');
  const betDec = root.querySelector('#betDec');
  const betInc = root.querySelector('#betInc');
  const chipOverlay = root.querySelector('#chipSelectorWrapper');
  const chipGrid = root.querySelector('#chipGrid');
  const msgEl = root.querySelector('#gc-msg');
  const featureEl = root.querySelector('#gc-feature');
  const gamepanel = root.querySelector('#roo-gamepanel');

  let betIndex = Math.max(0, levels.indexOf(levels[0]));
  let betEnabled = true;

  function renderChipGrid() {
    chipGrid.innerHTML = levels
      .map(
        (v, i) =>
          `<button type="button" class="roo-chip-btn${i === betIndex ? ' roo-chip-btn--active' : ''}" data-idx="${i}">${v.toLocaleString()}</button>`
      )
      .join('');
  }

  function openChipSelector() {
    if (!betEnabled) return;
    renderChipGrid();
    chipOverlay.hidden = false;
  }

  function closeChipSelector() {
    chipOverlay.hidden = true;
  }

  function syncBetButtons() {
    betDec.disabled = !betEnabled || betIndex <= 0;
    betInc.disabled = !betEnabled || betIndex >= levels.length - 1;
    betEl.disabled = !betEnabled;
  }

  function setBetIndex(idx, notify = true) {
    betIndex = Math.max(0, Math.min(levels.length - 1, idx));
    betEl.textContent = levels[betIndex].toLocaleString();
    syncBetButtons();
    if (notify) opts.onBetChange?.(levels[betIndex]);
  }

  spinBtn.addEventListener('click', () => {
    playThronesSound('ui_interact');
    opts.onSpin();
  });
  root.querySelector('#gc-rules').addEventListener('click', () => opts.onRules?.());
  betDec.addEventListener('click', () => {
    playThronesSound('ui_interact');
    setBetIndex(betIndex - 1);
  });
  betInc.addEventListener('click', () => {
    playThronesSound('ui_interact');
    setBetIndex(betIndex + 1);
  });
  betEl.addEventListener('click', openChipSelector);
  root.querySelector('#chipClose').addEventListener('click', closeChipSelector);
  root.querySelector('.roo-chip-overlay__backdrop').addEventListener('click', closeChipSelector);
  chipGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.roo-chip-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx ?? '0', 10);
    setBetIndex(idx);
    closeChipSelector();
  });

  setBetIndex(0, false);

  return {
    setBalance(v) {
      balanceEl.textContent = v.toLocaleString();
    },
    setWin(v) {
      winEl.textContent = v.toLocaleString();
      winEl.classList.toggle('roo-win--active', v > 0);
    },
    setBet(v) {
      const idx = levels.indexOf(v);
      if (idx >= 0) setBetIndex(idx, false);
      else betEl.textContent = v.toLocaleString();
    },
    getBet() {
      return levels[betIndex] ?? parseInt(String(betEl.textContent).replace(/,/g, ''), 10);
    },
    setBetEnabled(on) {
      betEnabled = on;
      syncBetButtons();
    },
    setSpinEnabled(on) {
      spinBtn.disabled = !on;
      spinBtn.classList.toggle('roo-spin--disabled', !on);
      spinWrap.classList.toggle('roo-spin--disabled', !on);
    },
    setSpinLabel(_t) {
      /* PG spin is sprite-only */
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
    setFreeSpins(fs) {
      if (fs.remaining > 0) {
        const mult = fs.multiplier > 0 ? ` · ×${fs.multiplier}` : '';
        this.setFeature(`FREE SPIN ${fs.remaining}${mult}`);
        spinBtn.classList.add('roo-spin--free');
        gamepanel?.classList.add('fg');
        this.setBetEnabled(false);
        closeChipSelector();
      } else {
        this.setFeature('');
        spinBtn.classList.remove('roo-spin--free');
        gamepanel?.classList.remove('fg');
        this.setBetEnabled(true);
      }
    },
  };
}
