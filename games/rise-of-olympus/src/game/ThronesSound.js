/**
 * Rise of Olympus — original sound event mapping (PG sprite clips).
 */

import {
  loadGameSounds,
  unlockAudio,
  playSound,
  playCycled,
  playSymbolWinSound,
  playGodPpsSound,
  playMultiplierValueSound,
  startBaseMusic,
  startFsMusic,
  stopMusic,
  playBigWinLevelup,
  playWinCounterSweetener,
  isSoundReady,
  stopLoop,
} from './SoundEngine.js';

export {
  loadGameSounds,
  unlockAudio,
  startBaseMusic,
  startFsMusic,
  stopMusic,
  isSoundReady,
  playSymbolWinSound,
  playGodPpsSound,
  playMultiplierValueSound,
  playBigWinLevelup,
  playWinCounterSweetener,
};

/** @param {string} id — legacy alias ids */
export function playThronesSound(id) {
  switch (id) {
    case 'spin':
      playCycled('1044UiSpin', 3);
      break;
    case 'land':
      playCycled('1044SymbolsLand', 3);
      break;
    case 'drop':
      playCycled('1044SymbolsDrop', 3);
      break;
    case 'cascade':
      playSound('1044SfTumbleWin');
      break;
    case 'trail':
      playCycled('1044SfTumbleTrail', 2);
      break;
    case 'multiplier':
      playSound('1044SsMultiplierTrail');
      break;
    case 'win':
      playSound('1044WinLessOrEqual');
      break;
    case 'big_win':
      playSound('1044BwTrigger');
      playSound('1044MusBw', { loop: true, volume: 0.5, key: 'bw' });
      break;
    case 'big_win_end':
      stopLoop('bw');
      playSound('1044MusBwEnd');
      break;
    case 'fs_trigger':
      playSound('1044TrnFsPanelIn');
      playSound('1044SfBonusLand');
      break;
    case 'scatter':
      playSound('1044SymScatter1Land');
      break;
    case 'scatter_win':
      playSound('1044SymScatterWin');
      break;
    case 'fs_end':
      playSound('1044MusFsEnd');
      playSound('1044TrnFsPanelOut');
      break;
    case 'ui_interact':
      playCycled('1044UiInteract', 3, 0.8);
      break;
    default:
      break;
  }
}

/** @param {object} ev */
export function playEventSound(ev) {
  switch (ev.type) {
    case 'deal':
      break;
    case 'cluster_win':
      playThronesSound('cascade');
      if (ev.wins?.[0]?.symbol != null) playSymbolWinSound(ev.wins[0].symbol);
      break;
    case 'multiplier_apply':
      playThronesSound('multiplier');
      if (ev.sum != null) playMultiplierValueSound(ev.sum);
      break;
    case 'multiplier_land':
      playGodPpsSound(ev.godId ?? 0);
      break;
    case 'multiplier_upgrade':
      playSound('1044SfTumbleWin', { volume: 0.7 });
      break;
    case 'free_spins_awarded':
      playThronesSound('fs_trigger');
      break;
    case 'scatter_show':
      playThronesSound('scatter_win');
      break;
    case 'free_spins_end':
      playThronesSound('fs_end');
      break;
    default:
      break;
  }
}
