/**
 * Rise of Olympus — Pixi scene + RoO HUD + spin API.
 */

import { Application } from 'pixi.js';
import { requestSpin, fetchSession } from '../api/spin-api.js';
import { createThronesScene } from '../game/ThronesScene.js';
import { createThronesHUD } from '../game/ThronesHUD.js';
import { mountPaytablePanel } from '../game/PaytablePanel.js';
import { animateWinCount } from './WinCount.js';
import { TIMING, ANIM_SPEED } from '../game/config.js';
import { unlockAudio } from '../game/ThronesSound.js';

const GAME = {
  slug: 'rise-of-olympus',
  title: 'Rise of Olympus',
  cols: 6,
  rows: 5,
  symbolCount: 15,
};

const DEFAULT_BET_LEVELS = [20, 40, 60, 100, 200, 500, 1000];

/** @typedef {'idle' | 'spinning' | 'showingWin' | 'feature'} GamePhase */

/**
 * @param {HTMLElement} mount
 */
export async function mountRiseOfOlympus(mount) {
  mount.innerHTML = '';
  mount.className = 'gc-game gc-game--thrones';

  const stageWrap = document.createElement('div');
  stageWrap.className = 'gc-game__stage';
  const hudMount = document.createElement('div');
  hudMount.className = 'gc-game__hud';
  const paytableMount = document.createElement('div');
  mount.append(stageWrap, hudMount, paytableMount);

  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    resizeTo: mount,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  stageWrap.appendChild(app.canvas);

  const grid = await createThronesScene({ cols: GAME.cols, rows: GAME.rows, app });
  app.stage.addChild(grid.view);

  function readHudHeightPx() {
    const panel = hudMount.querySelector('#roo-gamepanel');
    if (panel instanceof HTMLElement && panel.offsetHeight > 0) return panel.offsetHeight;
    const raw = getComputedStyle(mount).getPropertyValue('--roo-hud-height').trim();
    const px = Number.parseFloat(raw);
    return Number.isFinite(px) && px > 0 ? px : 160;
  }

  function onResize() {
    grid.layout?.(app.screen.width, app.screen.height, readHudHeightPx());
  }
  onResize();
  app.renderer.on('resize', onResize);

  let balance = 0;
  let bet = DEFAULT_BET_LEVELS[0];
  let betLevels = DEFAULT_BET_LEVELS;
  /** @type {GamePhase} */
  let phase = 'idle';
  let displayedWin = 0;
  /** @type {import('../api/spin-types.js').SpinState} */
  let gameState = {};
  let turbo = false;
  let autoSpin = false;

  const paytable = mountPaytablePanel(paytableMount);

  function animSpeed() {
    return turbo ? ANIM_SPEED.fast : ANIM_SPEED.normal;
  }

  function spinGapMs() {
    return turbo ? 70 : 160;
  }

  const hud = createThronesHUD(hudMount, {
    betLevels,
    onTurboToggle: (on) => {
      turbo = on;
      if (phase === 'spinning' || phase === 'feature' || phase === 'showingWin') {
        grid.setAnimationSpeed?.(animSpeed());
      }
    },
    onAutoToggle: (on) => {
      autoSpin = on;
      if (on && phase === 'idle') void doSpin();
    },
    onSpin: async () => {
      await unlockAudio();
      if (autoSpin) {
        autoSpin = false;
        hud.setAuto(false);
      }
      await doSpin();
    },
    onBetChange: async (v) => {
      await unlockAudio();
      bet = v;
      syncHud();
    },
    onRules: () => paytable.open(),
  });

  try {
    const session = await fetchSession(GAME.slug);
    balance = session.balance;
    betLevels = session.betLevels ?? betLevels;
    gameState = session.state ?? {};
    bet = betLevels[0] ?? DEFAULT_BET_LEVELS[0];
    hud.setBet?.(bet);
  } catch (err) {
    console.warn('[RiseOfOlympus] session init failed', err);
    balance = 2_500_000;
    bet = betLevels[0] ?? DEFAULT_BET_LEVELS[0];
    hud.setBet?.(bet);
    hud.setMessage?.(err instanceof Error ? err.message : 'Could not load session');
  }

  hud.setBalance(balance);
  hud.setWin(0);
  syncHud();
  requestAnimationFrame(() => onResize());

  function canSpin() {
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    return phase === 'idle' && balance >= charge;
  }

  function syncHud() {
    hud.setBalance(balance);
    hud.setSpinEnabled(canSpin() || autoSpin);
    hud.setFreeSpins?.({
      remaining: gameState.fsRemaining ?? 0,
      multiplier: gameState.fsMultiplier ?? 0,
    });
    grid.setMultiplierSum?.(gameState.multiplierSum ?? 0);
    grid.setFreeSpinMode?.((gameState.fsRemaining ?? 0) > 0);
    grid.syncFreeSpinState?.({
      remaining: gameState.fsRemaining ?? 0,
      multiplier: gameState.fsMultiplier ?? 0,
    });
  }

  async function tickWin(to) {
    if (to === displayedWin) {
      hud.setWin(to);
      displayedWin = to;
      return;
    }
    const countMs = TIMING.winCountUp / animSpeed();
    await animateWinCount(displayedWin, to, countMs, (v) => hud.setWin(v));
    displayedWin = to;
  }

  async function chainNextSpin() {
    if ((gameState.fsRemaining ?? 0) > 0) {
      await new Promise((r) => setTimeout(r, spinGapMs()));
      await doSpin();
      return;
    }
    if (autoSpin && canSpin()) {
      await new Promise((r) => setTimeout(r, spinGapMs()));
      await doSpin();
      return;
    }
    if (autoSpin && !canSpin()) {
      autoSpin = false;
      hud.setAuto(false);
      hud.setMessage?.('Auto stopped — insufficient balance');
    }
  }

  async function doSpin() {
    if (phase !== 'idle') return;
    if (hud.getBet) bet = hud.getBet();
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    if (balance < charge) {
      if (autoSpin) {
        autoSpin = false;
        hud.setAuto(false);
      }
      hud.setMessage?.('Insufficient balance');
      syncHud();
      return;
    }
    phase = 'spinning';
    hud.setSpinEnabled(false);
    displayedWin = 0;
    hud.setWin(0);
    hud.setMessage?.('');
    grid.showTumbleWin?.(0);
    grid.setAnimationSpeed?.(animSpeed());

    try {
      const spinPromise = requestSpin(GAME.slug, { bet, balance });
      await grid.runSpinTransition?.(spinPromise);
      const result = await spinPromise;

      const featureTypes = [
        'cluster_win',
        'free_spins_awarded',
        'free_spins_end',
        'multiplier_apply',
        'fs_multiplier_update',
      ];
      const events =
        result.events?.length > 0 ? result.events : [{ type: 'deal', grid: result.symbols }];
      if (events.some((e) => featureTypes.includes(e.type))) phase = 'feature';

      await grid.replayEvents(
        events,
        (partial) => {
          phase = 'showingWin';
          void tickWin(partial);
        },
        bet
      );

      balance = result.balance;
      gameState = result.state ?? {};
      if (result.betLevels) betLevels = result.betLevels;
      await tickWin(result.win);
      syncHud();
    } catch (err) {
      console.error('[RiseOfOlympus] spin error', err);
      hud.setMessage?.(err instanceof Error ? err.message : 'Spin failed');
      if (autoSpin) {
        autoSpin = false;
        hud.setAuto(false);
      }
    } finally {
      phase = 'idle';
      syncHud();
    }

    await chainNextSpin();
  }

  const initial = [];
  for (let c = 0; c < GAME.cols; c++) {
    initial[c] = [];
    for (let r = 0; r < GAME.rows; r++) {
      initial[c][r] = (c + r) % GAME.symbolCount;
    }
  }
  grid.setSymbols(initial);

  return {
    destroy() {
      autoSpin = false;
      app.renderer.off('resize', onResize);
      app.destroy(true, { children: true });
      mount.innerHTML = '';
    },
  };
}
