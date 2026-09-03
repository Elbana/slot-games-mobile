/**
 * Rise of Olympus — Pixi scene + RoO HUD + spin API.
 */

import { Application } from 'pixi.js';
import { requestSpin, fetchSession } from '../api/spin-api.js';
import { createThronesScene } from '../game/ThronesScene.js';
import { createThronesHUD } from '../game/ThronesHUD.js';
import { mountPaytablePanel } from '../game/PaytablePanel.js';
import { animateWinCount } from './WinCount.js';
import { TIMING } from '../game/config.js';
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
    background: 0x0a1028,
    antialias: true,
    resizeTo: stageWrap,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  stageWrap.appendChild(app.canvas);

  const grid = await createThronesScene({ cols: GAME.cols, rows: GAME.rows, app });
  app.stage.addChild(grid.view);

  function onResize() {
    grid.layout(app.screen.width, app.screen.height);
  }
  onResize();
  app.renderer.on('resize', onResize);

  let balance = 0;
  let bet = 20;
  let betLevels = DEFAULT_BET_LEVELS;
  /** @type {GamePhase} */
  let phase = 'idle';
  let displayedWin = 0;
  /** @type {import('../api/spin-types.js').SpinState} */
  let gameState = {};

  const paytable = mountPaytablePanel(paytableMount);

  const hud = createThronesHUD(hudMount, {
    betLevels,
    onSpin: async () => {
      await unlockAudio();
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
    bet = session.bet ?? bet;
    betLevels = session.betLevels ?? betLevels;
    gameState = session.state ?? {};
    hud.setBet?.(bet);
  } catch (err) {
    console.warn('[RiseOfOlympus] session init failed', err);
    balance = 2_500_000;
    hud.setMessage?.(err instanceof Error ? err.message : 'Could not load session');
  }

  hud.setBalance(balance);
  hud.setWin(0);
  syncHud();

  function canSpin() {
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    return phase === 'idle' && balance >= charge;
  }

  function syncHud() {
    hud.setBalance(balance);
    hud.setSpinEnabled(canSpin());
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
    await animateWinCount(displayedWin, to, TIMING.winCountUp, (v) => hud.setWin(v));
    displayedWin = to;
  }

  async function doSpin() {
    if (phase === 'spinning' || phase === 'feature' || phase === 'showingWin') {
      grid.setAnimationSpeed?.(3);
      return;
    }
    if (phase !== 'idle') return;
    if (hud.getBet) bet = hud.getBet();
    const charge = gameState.fsRemaining > 0 ? 0 : bet;
    if (balance < charge) {
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
    grid.setAnimationSpeed?.(1);

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
    } finally {
      phase = 'idle';
      syncHud();
    }
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
      app.renderer.off('resize', onResize);
      app.destroy(true, { children: true });
      mount.innerHTML = '';
    },
  };
}
