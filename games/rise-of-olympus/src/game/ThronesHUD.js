/**
 * Rise of Olympus — mobile portrait HUD (RoO1000 gamepanel layout).
 */

import './thrones-roo-hud.css';
import { playThronesSound } from './ThronesSound.js';

const ASSET_BASE = '/assets/rise-of-olympus';

/** @param {number} v */
export function formatMoney(v) {
  const n = Math.max(0, Math.round(v));
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$ ${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 10_000) return `$ ${Math.round(n / 1000)}K`;
  return `$ ${n.toLocaleString()}`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   betLevels?: number[],
 *   onSpin: () => void,
 *   onBetChange?: (bet: number) => void,
 *   onRules?: () => void,
 *   onTurboToggle?: (enabled: boolean) => void,
 *   onAutoToggle?: (enabled: boolean) => void,
 * }} opts
 */
export function createThronesHUD(root, opts) {
  const levels = opts.betLevels ?? [20, 40, 60, 100, 200, 500, 1000];

  root.innerHTML = `
    <div class="gc-hud gc-hud--thrones">
      <header class="gc-hud__top gc-hud__top--thrones">
        <button type="button" id="gc-menu" class="gc-hud__menu" aria-label="Menu"></button>
        <button type="button" id="gc-rules" class="gc-hud__rules">Rules</button>
      </header>
      <p class="roo-status" id="roo-status">GOOD LUCK</p>
      <footer id="roo-gamepanel" class="roo-gamepanel pt" style="--roo-bottom-bg: url('${ASSET_BASE}/bottomBg.png'); --roo-ui-elements: url('${ASSET_BASE}/uiElements2.png'); --roo-ui: url('${ASSET_BASE}/ui.png');">
        <div id="backgroundImg"></div>
        <div id="bottomPanelWrapper">
          <div class="roo-stats-row">
            <div class="roo-stat" id="moneyBalanceWrapper">
              <span class="roo-stat__label" id="balanceText">WALLET</span>
              <strong class="roo-stat__value" id="moneyBalance">—</strong>
            </div>
            <div class="roo-stat roo-stat--bet" id="coinsBetWrapper">
              <span class="roo-stat__label coinsText">BET</span>
              <button type="button" id="betOpen" class="roo-stat__value roo-stat__value--btn coinsBet" aria-label="Select bet">—</button>
            </div>
            <div class="roo-stat" id="moneyWinWrapper">
              <span class="roo-stat__label" id="winText">WIN</span>
              <strong class="roo-stat__value moneyWin" id="moneyWin">$ 0</strong>
            </div>
          </div>
          <div id="buttonsWrapper" class="roo-controls-row pt">
            <button type="button" id="betDec" class="roo-ctrl roo-bet-btn roo-bet-btn--dec" aria-label="Decrease bet"></button>
            <button type="button" id="turboBtn" class="roo-ctrl roo-ctrl--turbo" aria-label="Faster animations">
              <span class="roo-ctrl__icon roo-ctrl__icon--bolt"></span>
              <span class="roo-ctrl__label" id="turboLabel">SPEED</span>
            </button>
            <div id="spinBtnWrapper">
              <button type="button" id="spinBtn" aria-label="Spin"></button>
              <div id="spinBtnPulse"></div>
            </div>
            <button type="button" id="betInc" class="roo-ctrl roo-bet-btn roo-bet-btn--inc" aria-label="Increase bet"></button>
            <button type="button" id="autoBtn" class="roo-ctrl roo-ctrl--auto" aria-label="Auto play">
              <span class="roo-ctrl__icon roo-ctrl__icon--auto"></span>
              <span class="roo-ctrl__label" id="autoLabel">AUTO</span>
            </button>
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
  const statusEl = root.querySelector('#roo-status');
  const spinBtn = root.querySelector('#spinBtn');
  const spinWrap = root.querySelector('#spinBtnWrapper');
  const betEl = root.querySelector('#betOpen');
  const betDec = root.querySelector('#betDec');
  const betInc = root.querySelector('#betInc');
  const turboBtn = root.querySelector('#turboBtn');
  const turboLabel = root.querySelector('#turboLabel');
  const autoBtn = root.querySelector('#autoBtn');
  const autoLabel = root.querySelector('#autoLabel');
  const chipOverlay = root.querySelector('#chipSelectorWrapper');
  const chipGrid = root.querySelector('#chipGrid');
  const msgEl = root.querySelector('#gc-msg');
  const featureEl = root.querySelector('#gc-feature');
  const gamepanel = root.querySelector('#roo-gamepanel');

  let betIndex = 0;
  let betEnabled = true;
  let turboOn = false;
  let autoOn = false;

  function renderChipGrid() {
    chipGrid.innerHTML = levels
      .map(
        (v, i) =>
          `<button type="button" class="roo-chip-btn${i === betIndex ? ' roo-chip-btn--active' : ''}" data-idx="${i}">${formatMoney(v)}</button>`
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
    betEl.textContent = formatMoney(levels[betIndex]);
    syncBetButtons();
    if (notify) opts.onBetChange?.(levels[betIndex]);
  }

  function syncTurbo() {
    turboBtn.classList.toggle('roo-ctrl--turbo-on', turboOn);
    turboLabel.textContent = turboOn ? 'FAST' : 'SPEED';
    opts.onTurboToggle?.(turboOn);
  }

  function syncAuto() {
    autoBtn.classList.toggle('roo-ctrl--auto-on', autoOn);
    autoLabel.textContent = autoOn ? 'STOP' : 'AUTO';
    opts.onAutoToggle?.(autoOn);
  }

  root.querySelector('#gc-menu').addEventListener('click', () => opts.onRules?.());
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
  turboBtn.addEventListener('click', () => {
    playThronesSound('ui_interact');
    turboOn = !turboOn;
    syncTurbo();
  });
  autoBtn.addEventListener('click', () => {
    playThronesSound('ui_interact');
    autoOn = !autoOn;
    syncAuto();
  });
  root.querySelector('#chipClose').addEventListener('click', closeChipSelector);
  root.querySelector('.roo-chip-overlay__backdrop').addEventListener('click', closeChipSelector);
  chipGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.roo-chip-btn');
    if (!btn) return;
    setBetIndex(parseInt(btn.dataset.idx ?? '0', 10));
    closeChipSelector();
  });

  setBetIndex(0, false);
  syncTurbo();
  syncAuto();

  return {
    setBalance(v) {
      balanceEl.textContent = formatMoney(v);
    },
    setWin(v) {
      winEl.textContent = formatMoney(v);
      winEl.classList.toggle('roo-win--active', v > 0);
    },
    setStatus(text) {
      statusEl.textContent = text || 'GOOD LUCK';
    },
    setBet(v) {
      const idx = levels.indexOf(v);
      if (idx >= 0) setBetIndex(idx, false);
      else betEl.textContent = formatMoney(v);
    },
    getBet() {
      return levels[betIndex] ?? parseInt(String(betEl.textContent).replace(/[^\d]/g, ''), 10);
    },
    getTurbo() {
      return turboOn;
    },
    getAuto() {
      return autoOn;
    },
    setAuto(on) {
      autoOn = !!on;
      syncAuto();
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
      /* sprite-only spin button */
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
        this.setStatus('GOOD LUCK');
        return;
      }
      featureEl.hidden = false;
      featureEl.textContent = text;
      this.setStatus(text);
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
