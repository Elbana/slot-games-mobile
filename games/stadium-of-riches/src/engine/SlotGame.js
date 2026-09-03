/**
 * Stadium of Riches — Pixi scene + HUD + spin API.
 */
import { Application } from 'pixi.js';
import { requestSpin, fetchSession } from '../api/spin-api.js';
import { createFootballScene } from '../game/FootballScene.js';
import { createFootballHUD } from '../game/FootballHUD.js';
import { mountPaytablePanel } from '../game/PaytablePanel.js';
import { animateWinCount } from './WinCount.js';
import { TIMING } from '../game/config.js';

const GAME = {
  slug: 'stadium-of-riches',
  title: 'Stadium of Riches',
  cols: 5,
  rows: 3,
  symbolCount: 10,
};

const DEFAULT_BET_LEVELS = [20, 40, 60, 100, 200, 500, 1000];

/** @typedef {'idle' | 'spinning' | 'showingWin' | 'feature'} GamePhase */

export async function mountStadiumOfRiches(mount) {
  mount.innerHTML = '';
  mount.className = 'gc-game gc-game--football';

  const stageWrap = document.createElement('div');
  stageWrap.className = 'gc-game__stage';
  const hudMount = document.createElement('div');
  hudMount.className = 'gc-game__hud';
  const paytableMount = document.createElement('div');
  mount.append(stageWrap, hudMount, paytableMount);

  const app = new Application();
  await app.init({
    background: 0x0a1a0f,
    antialias: true,
    resizeTo: stageWrap,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  stageWrap.appendChild(app.canvas);

  const grid = await createFootballScene({ cols: GAME.cols, rows: GAME.rows, app });
  app.stage.addChild(grid.view);

  function onResize() {
    grid.layout?.(app.screen.width, app.screen.height);
  }
  onResize();
  app.renderer.on('resize', onResize);

  let balance = 0;
  let bet = 20;
  let betLevels = DEFAULT_BET_LEVELS;
  let phase = 'idle';
  let displayedWin = 0;
  let gameState = {};

  const paytable = mountPaytablePanel(paytableMount);
  const hud = createFootballHUD(hudMount, {
    betLevels,
    onSpin: () => void doSpin(),
    onBetChange: (v) => {
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
    console.warn('[Stadium of Riches] session init failed', err);
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
    grid.setFreeSpinMode?.((gameState.fsRemaining ?? 0) > 0);
    grid.syncFreeSpinState?.({
      remaining: gameState.fsRemaining ?? 0,
      multiplier: gameState.fsMultiplier ?? 0,
      expandingSymbols: gameState.expandingSymbols ?? [],
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

    try {
      const spinPromise = requestSpin(GAME.slug, { bet, balance });
      if (grid.shuffleAnimation) await grid.shuffleAnimation();
      const result = await spinPromise;

      const featureTypes = [
        'line_win',
        'free_spins_awarded',
        'free_spins_end',
        'wheel_spin',
        'coin_win',
        'cash_win',
        'pot_collect',
      ];
      const events =
        result.events?.length > 0 ? result.events : [{ type: 'deal', grid: result.symbols }];
      if (events.some((e) => featureTypes.includes(e.type))) phase = 'feature';

      await grid.replayEvents?.(
        events,
        (partial) => {
          phase = 'showingWin';
          void tickWin(partial);
        },
        bet,
      );

      balance = result.balance;
      gameState = result.state ?? {};
      if (result.betLevels) betLevels = result.betLevels;
      await tickWin(result.win);
      syncHud();
    } catch (err) {
      console.error('[Stadium of Riches] spin error', err);
      hud.setMessage?.(err instanceof Error ? err.message : 'Spin failed');
    } finally {
      phase = 'idle';
      syncHud();
    }
  }

  const initial = [];
  for (let c = 0; c < GAME.cols; c++) {
    initial[c] = [];
    for (let r = 0; r < GAME.rows; r++) initial[c][r] = (c + r) % GAME.symbolCount;
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
