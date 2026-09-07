/**
 * Rise of Olympus — mobile portrait HUD (RoO1000 gamepanel layout).
 */

import './thrones-roo-hud.css';
import { playThronesSound } from './ThronesSound.js';
import { isMuted, setMuted } from './SoundEngine.js';

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
 *   onSoundToggle?: (enabled: boolean) => void,
 * }} opts
 */
export function createThronesHUD(root, opts) {
  const levels = opts.betLevels ?? [20, 40, 60, 100, 200, 500, 1000];

  root.innerHTML = `
    <div class="gc-hud gc-hud--thrones">
      <header class="gc-hud__top gc-hud__top--thrones">
        <div class="gc-hud__top-actions">
          <button type="button" id="gc-sound" class="gc-hud__sound" aria-label="Toggle sound"></button>
          <button type="button" id="gc-menu" class="gc-hud__menu" aria-label="Settings"></button>
        </div>
      </header>
      <div id="gc-settings" class="roo-settings-overlay" hidden>
        <div class="roo-settings-overlay__backdrop"></div>
        <div class="roo-settings-overlay__panel">
          <p class="roo-settings-overlay__title">Settings</p>
          <button type="button" id="settingsSound" class="roo-settings-row">
            <span class="roo-settings-row__icon roo-settings-row__icon--sound" aria-hidden="true"></span>
            <span class="roo-settings-row__label" id="settingsSoundLabel">Sound on</span>
          </button>
          <button type="button" id="settingsRules" class="roo-settings-row">
            <span class="roo-settings-row__icon roo-settings-row__icon--rules" aria-hidden="true"></span>
            <span class="roo-settings-row__label">Game rules</span>
          </button>
          <button type="button" class="roo-settings-overlay__close" id="settingsClose">Close</button>
        </div>
      </div>
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
          <div id="buttonsWrapper" class="roo-controls-row">
            <button type="button" id="turboBtn" class="roo-btn roo-btn--aux" aria-label="Faster animations">
              <span class="roo-btn__icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor"/></svg>
              </span>
              <span class="roo-btn__tag" id="turboLabel">SPEED</span>
            </button>
            <button type="button" id="betDec" class="roo-btn roo-btn--round" aria-label="Decrease bet">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>
            </button>
            <div id="spinBtnWrapper" class="roo-spin-wrap">
              <button type="button" id="spinBtn" class="roo-btn roo-btn--spin" aria-label="Spin">
                <span class="roo-btn__spin-ring" aria-hidden="true"></span>
                <span class="roo-btn__spin-core">SPIN</span>
              </button>
            </div>
            <button type="button" id="betInc" class="roo-btn roo-btn--round" aria-label="Increase bet">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" id="autoBtn" class="roo-btn roo-btn--aux" aria-label="Auto play">
              <span class="roo-btn__icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 01-5.65 4 6 6 0 110-12c1.66 0 3.14.67 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
              </span>
              <span class="roo-btn__tag" id="autoLabel">AUTO</span>
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
  const spinCore = root.querySelector('.roo-btn__spin-core');
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
  const soundBtn = root.querySelector('#gc-sound');
  const settingsOverlay = root.querySelector('#gc-settings');
  const settingsSoundBtn = root.querySelector('#settingsSound');
  const settingsSoundLabel = root.querySelector('#settingsSoundLabel');

  let betIndex = 0;
  let betEnabled = true;
  let turboOn = false;
  let autoOn = false;
  let soundOn = !isMuted();

  function syncSoundUi() {
    soundOn = !isMuted();
    soundBtn.classList.toggle('gc-hud__sound--off', !soundOn);
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
    if (settingsSoundLabel) {
      settingsSoundLabel.textContent = soundOn ? 'Sound on' : 'Sound off';
    }
    settingsSoundBtn?.classList.toggle('roo-settings-row--off', !soundOn);
  }

  function toggleSound() {
    soundOn = !soundOn;
    setMuted(!soundOn);
    syncSoundUi();
    opts.onSoundToggle?.(soundOn);
    if (soundOn) playThronesSound('ui_interact');
  }

  function openSettings() {
    settingsOverlay.hidden = false;
    syncSoundUi();
  }

  function closeSettings() {
    settingsOverlay.hidden = true;
  }

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
    betEl.disabled = !betEnabled;
  }

  function setBetIndex(idx, notify = true) {
    const next = Math.max(0, Math.min(levels.length - 1, idx));
    const changed = next !== betIndex;
    betIndex = next;
    betEl.textContent = formatMoney(levels[betIndex]);
    if (changed && notify) opts.onBetChange?.(levels[betIndex]);
  }

  function syncTurbo() {
    turboBtn.classList.toggle('roo-btn--active', turboOn);
    turboLabel.textContent = turboOn ? 'FAST' : 'SPEED';
    opts.onTurboToggle?.(turboOn);
  }

  function syncAuto() {
    autoBtn.classList.toggle('roo-btn--active', autoOn);
    autoLabel.textContent = autoOn ? 'STOP' : 'AUTO';
    opts.onAutoToggle?.(autoOn);
  }

  root.querySelector('#gc-menu').addEventListener('click', () => {
    playThronesSound('ui_interact');
    openSettings();
  });
  soundBtn.addEventListener('click', () => {
    toggleSound();
  });
  settingsSoundBtn.addEventListener('click', () => {
    toggleSound();
  });
  root.querySelector('#settingsRules').addEventListener('click', () => {
    closeSettings();
    opts.onRules?.();
  });
  root.querySelector('#settingsClose').addEventListener('click', closeSettings);
  settingsOverlay.querySelector('.roo-settings-overlay__backdrop').addEventListener('click', closeSettings);
  spinBtn.addEventListener('click', () => {
    playThronesSound('ui_interact');
    opts.onSpin();
  });
  betDec.addEventListener('click', () => {
    if (!betEnabled || betIndex <= 0) return;
    playThronesSound('ui_interact');
    setBetIndex(betIndex - 1);
  });
  betInc.addEventListener('click', () => {
    if (!betEnabled || betIndex >= levels.length - 1) return;
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
  syncSoundUi();

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
      let idx = levels.indexOf(v);
      if (idx < 0 && v != null && Number.isFinite(v)) {
        idx = levels.reduce(
          (best, lv, i) => (Math.abs(lv - v) < Math.abs(levels[best] - v) ? i : best),
          0
        );
      }
      if (idx < 0) idx = 0;
      setBetIndex(idx, false);
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
      spinBtn.classList.toggle('roo-btn--disabled', !on);
      spinWrap.classList.toggle('roo-spin-wrap--disabled', !on);
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
        spinBtn.classList.add('roo-btn--free');
        if (spinCore) spinCore.textContent = 'FREE';
        gamepanel?.classList.add('fg');
        this.setBetEnabled(false);
        closeChipSelector();
      } else {
        this.setFeature('');
        spinBtn.classList.remove('roo-btn--free');
        if (spinCore) spinCore.textContent = 'SPIN';
        gamepanel?.classList.remove('fg');
        this.setBetEnabled(true);
      }
    },
  };
}
