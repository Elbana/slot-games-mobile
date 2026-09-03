import { FS_WHEEL, PAY_SYMBOL_MIN, PAY_SYMBOL_MAX } from './config.mjs';
import { createFsReelState } from './fs-reels.mjs';

export const FS_TRIGGER_MIN = 3;
export const FS_RETRIGGER_AWARD = 1;

export function createFreeSpinState() {
  return {
    freeSpinsLeft: 0,
    freeSpinMultiplier: 0,
    freespinCnt: 0,
    fsTotalWin: 0,
    expandingSymbols: [],
    pendingIntro: false,
    introAward: 0,
    introSymbol: null,
    awaitingSymbolAck: false,
    introScatterCount: 0,
    fsReels: createFsReelState(),
  };
}

export function isInFreeSpins(session) {
  return (session?.footballFs?.freeSpinsLeft ?? 0) > 0;
}

export function effectiveBet(session, bet) {
  return isInFreeSpins(session) ? 0 : bet;
}

export function pickFsAward(scatterCount) {
  const key = Math.min(6, Math.max(FS_TRIGGER_MIN, scatterCount | 0));
  const choices = FS_WHEEL[key] ?? FS_WHEEL[FS_TRIGGER_MIN];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function pickExpandingSymbol(existing = []) {
  const pool = [];
  for (let s = PAY_SYMBOL_MIN; s <= PAY_SYMBOL_MAX; s++) {
    if (!existing.includes(s)) pool.push(s);
  }
  if (!pool.length) return Math.floor(Math.random() * (PAY_SYMBOL_MAX + 1));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function queueFsIntro(session, scatterCount) {
  const fs = session.footballFs ?? createFreeSpinState();
  session.footballFs = fs;
  fs.pendingIntro = true;
  fs.introScatterCount = scatterCount;
  fs.introAward = pickFsAward(scatterCount);
  fs.introSymbol = pickExpandingSymbol(fs.expandingSymbols);
  fs.awaitingSymbolAck = true;
}

export function commitFsIntro(session) {
  const fs = session.footballFs ?? createFreeSpinState();
  session.footballFs = fs;
  if (!fs.pendingIntro) return { freeSpinsLeft: fs.freeSpinsLeft, fsAwardAdded: 0 };
  fs.pendingIntro = false;
  fs.freeSpinsLeft = (fs.freeSpinsLeft ?? 0) + fs.introAward;
  fs.expandingSymbols.push(fs.introSymbol);
  fs.fsReels = createFsReelState();
  return {
    freeSpinsLeft: fs.freeSpinsLeft,
    fsAwardAdded: fs.introAward,
    expandingSymbol: fs.introSymbol,
  };
}

export function resolveFreeSpinEnd(
  session,
  { scatterCount = 0, roundWin = 0, wasInFs = false, multDelta = 0 } = {}
) {
  const fs = session.footballFs ?? createFreeSpinState();
  session.footballFs = fs;

  let freeSpinsLeft = fs.freeSpinsLeft ?? 0;
  let freeSpinMultiplier = fs.freeSpinMultiplier ?? 0;
  let retriggered = false;
  let fsAwardAdded = 0;

  if (wasInFs && multDelta > 0) {
    freeSpinMultiplier = Math.max(0, freeSpinMultiplier + multDelta);
    fs.freeSpinMultiplier = freeSpinMultiplier;
  }

  if (wasInFs && freeSpinsLeft > 0) {
    freeSpinsLeft = Math.max(0, freeSpinsLeft - 1);
    fs.freespinCnt = (fs.freespinCnt ?? 0) + 1;
    fs.fsTotalWin = (fs.fsTotalWin ?? 0) + roundWin;
  }

  if (wasInFs && scatterCount >= FS_TRIGGER_MIN) {
    freeSpinsLeft += FS_RETRIGGER_AWARD;
    fsAwardAdded = FS_RETRIGGER_AWARD;
    retriggered = true;
  }

  fs.freeSpinsLeft = freeSpinsLeft;
  const fsTotalWin = fs.fsTotalWin ?? 0;
  if (freeSpinsLeft === 0) {
    fs.freespinCnt = 0;
    fs.fsTotalWin = 0;
    fs.expandingSymbols = [];
    fs.freeSpinMultiplier = 0;
    fs.fsReels = createFsReelState();
  }

  fs.freeSpinMultiplier = freeSpinsLeft > 0 ? freeSpinMultiplier : 0;

  return { freeSpinsLeft, freeSpinMultiplier, retriggered, fsAwardAdded, fsTotalWin };
}
