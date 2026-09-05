import { COLS, ROWS, SYMBOL } from './config.mjs';

/** 3+ scatters trigger FS. Initial award 5; one retrigger +3 (max 8 total per FS session). */
export const FS_TRIGGER_MIN = 3;
export const FS_INITIAL_AWARD = 5;
export const FS_RETRIGGER_AWARD = 3;
export const FS_MAX_TOTAL = 8;

export function countScatters(grid) {
  let n = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === SYMBOL.SCATTER) n++;
    }
  }
  return n;
}

/** @param {object} session */
export function ensureFreeSpinState(session) {
  if (!session.thronesFs) session.thronesFs = createFreeSpinState();
  if (!session.rooFs) session.rooFs = session.thronesFs;
  return session.thronesFs;
}

/** Award free spins for scatter count (0 if below threshold). */
export function scatterFreeSpinAward(scatterCount, { inFreeSpins = false, retriggerUsed = false } = {}) {
  if (scatterCount < FS_TRIGGER_MIN) return 0;
  if (inFreeSpins) return retriggerUsed ? 0 : FS_RETRIGGER_AWARD;
  return FS_INITIAL_AWARD;
}

/** @deprecated kept for callers — use fsTotalAwarded + retriggerUsed instead */
export function clampFreeSpinTotal(played, remaining, add) {
  const room = Math.max(0, FS_MAX_TOTAL - played - remaining);
  return Math.min(add, room);
}

export function createFreeSpinState() {
  return {
    freeSpinsLeft: 0,
    freeSpinMultiplier: 0,
    fsTotalWin: 0,
    goUltra: false,
    lastFsResolvedSpin: 0,
    freespinCnt: 0,
    fsTotalAwarded: 0,
    retriggerUsed: false,
  };
}

/** @deprecated alias */
export const createThronesFreeSpinState = createFreeSpinState;

/** True when session has active free spins. */
export function isInFreeSpins(session) {
  ensureFreeSpinState(session);
  return (session.thronesFs?.freeSpinsLeft ?? 0) > 0;
}

/** Emit scatter FS intro only when this spin actually awards FS. */
export function shouldEmitScatterFeature(scatterCount, fsAwardAdded) {
  return scatterCount >= FS_TRIGGER_MIN && (fsAwardAdded ?? 0) > 0;
}

/**
 * Apply SPINEND free-spin fields from round result.
 * - Base game 3+ scatters: start FS with 5 spins, multiplier 1.
 * - During FS: consume 1 spin per round; at most one +3 retrigger (cap 8 awarded total).
 */
export function resolveFreeSpinEnd(
  session,
  { scatterCount = 0, roundWin = 0, fsMulti = 0, spinId = null } = {}
) {
  const fs = ensureFreeSpinState(session);

  if (spinId != null && fs.lastFsResolvedSpin === spinId) {
    return {
      freeSpinsLeft: fs.freeSpinsLeft,
      freeSpinMultiplier: fs.freeSpinMultiplier ?? 0,
      triggered: false,
      retriggered: false,
      fsAwardAdded: 0,
      alreadyResolved: true,
    };
  }

  const wasInFs = fs.freeSpinsLeft > 0;
  let freeSpinsLeft = fs.freeSpinsLeft;
  let freeSpinMultiplier = fs.freeSpinMultiplier ?? 0;
  let freespinCnt = fs.freespinCnt ?? 0;
  let fsTotalAwarded = fs.fsTotalAwarded ?? 0;
  let retriggerUsed = fs.retriggerUsed === true;
  let fsTotalWin = fs.fsTotalWin ?? 0;

  if (wasInFs) {
    freeSpinsLeft = Math.max(0, freeSpinsLeft - 1);
    freespinCnt += 1;
    fsTotalWin += roundWin;
    if (fsMulti > 0) freeSpinMultiplier = fsMulti;
  }

  let triggered = false;
  let retriggered = false;
  let fsAwardAdded = 0;

  if (scatterCount >= FS_TRIGGER_MIN) {
    if (!wasInFs) {
      freeSpinsLeft = FS_INITIAL_AWARD;
      freeSpinMultiplier = 1;
      fsTotalAwarded = FS_INITIAL_AWARD;
      retriggerUsed = false;
      freespinCnt = 0;
      fsTotalWin = 0;
      fsAwardAdded = FS_INITIAL_AWARD;
      triggered = true;
    } else if (!retriggerUsed && fsTotalAwarded < FS_MAX_TOTAL) {
      const add = Math.min(FS_RETRIGGER_AWARD, FS_MAX_TOTAL - fsTotalAwarded);
      if (add > 0) {
        freeSpinsLeft += add;
        fsTotalAwarded += add;
        retriggerUsed = true;
        fsAwardAdded = add;
        retriggered = true;
      }
    }
  }

  const fsEnded = wasInFs && freeSpinsLeft === 0;

  if (freeSpinsLeft === 0) {
    freeSpinMultiplier = 0;
    fsTotalAwarded = 0;
    retriggerUsed = false;
    freespinCnt = 0;
    if (fsEnded) fsTotalWin = fsTotalWin;
    else fsTotalWin = 0;
  }

  session.thronesFs = {
    ...fs,
    freeSpinsLeft,
    freeSpinMultiplier,
    freespinCnt: freeSpinsLeft > 0 ? freespinCnt : 0,
    fsTotalWin: freeSpinsLeft > 0 ? fsTotalWin : 0,
    fsTotalAwarded: freeSpinsLeft > 0 ? fsTotalAwarded : 0,
    retriggerUsed: freeSpinsLeft > 0 ? retriggerUsed : false,
    lastFsResolvedSpin: spinId ?? fs.lastFsResolvedSpin ?? 0,
  };
  session.rooFs = session.thronesFs;

  return {
    freeSpinsLeft,
    freeSpinMultiplier,
    triggered,
    retriggered,
    fsAwardAdded,
    fsEnded,
    fsSessionTotalWin: fsEnded ? fsTotalWin : 0,
  };
}

/** Bet cost — zero during free spins. */
export function effectiveBet(session, bet) {
  return isInFreeSpins(session) ? 0 : bet;
}
