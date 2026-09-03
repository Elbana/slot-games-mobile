import { COLS, ROWS, SYMBOL } from './config.mjs';

/** Paytable (IDS_ROO1K_PT20/21/23A): 3+ scatters → 12 FS; retrigger → +3; cap 36. */
export const FS_TRIGGER_MIN = 3;
export const FS_INITIAL_AWARD = 12;
export const FS_RETRIGGER_AWARD = 3;
export const FS_MAX_TOTAL = 36;

export function countScatters(grid) {
  let n = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] === SYMBOL.SCATTER) n++;
    }
  }
  return n;
}

/** Award free spins for scatter count (0 if below threshold). */
export function scatterFreeSpinAward(scatterCount, { inFreeSpins = false } = {}) {
  if (scatterCount < FS_TRIGGER_MIN) return 0;
  return inFreeSpins ? FS_RETRIGGER_AWARD : FS_INITIAL_AWARD;
}

/** Clamp total FS (played + remaining) to game max. */
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
  };
}

/** @deprecated alias */
export const createThronesFreeSpinState = createFreeSpinState;

/** True when session has active free spins. */
export function isInFreeSpins(session) {
  return (session?.thronesFs?.freeSpinsLeft ?? session?.rooFs?.freeSpinsLeft ?? 0) > 0;
}

/**
 * Emit cmd-2 scatter FS intro block only when this spin actually awards FS.
 * Requires 3+ scatters on the initial grid AND a non-zero award (+12 trigger or +3 retrigger).
 */
export function shouldEmitScatterFeature(scatterCount, fsAwardAdded) {
  return scatterCount >= FS_TRIGGER_MIN && (fsAwardAdded ?? 0) > 0;
}

/**
 * Apply SPINEND free-spin fields from round result.
 * Trigger (base game, 3+ scatters): SET initial award once.
 * Retrigger (during FS, 3+ scatters): ADD +3 once, capped at FS_MAX_TOTAL.
 * Same spin never applies both paths; repeat calls for the same spinId are ignored.
 */
export function resolveFreeSpinEnd(
  session,
  { scatterCount = 0, roundWin = 0, fsMulti = 0, spinId = null } = {}
) {
  const fs = session.thronesFs ?? session.rooFs ?? createFreeSpinState();
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

  if (wasInFs) {
    freeSpinsLeft = Math.max(0, freeSpinsLeft - 1);
    fs.fsTotalWin = (fs.fsTotalWin ?? 0) + roundWin;
    freespinCnt += 1;
    if (fsMulti > 0) freeSpinMultiplier = fsMulti;
  }

  let triggered = false;
  let retriggered = false;
  let fsAwardAdded = 0;

  if (scatterCount >= FS_TRIGGER_MIN) {
    if (wasInFs) {
      const add = clampFreeSpinTotal(freespinCnt, freeSpinsLeft, FS_RETRIGGER_AWARD);
      if (add > 0) {
        freeSpinsLeft += add;
        fsAwardAdded = add;
        retriggered = true;
      }
    } else {
      const initial = clampFreeSpinTotal(0, 0, FS_INITIAL_AWARD);
      if (initial > 0) {
        freeSpinsLeft = initial;
        fsAwardAdded = initial;
        triggered = true;
      }
    }
  }

  const fsTotalWin = fs.fsTotalWin ?? 0;
  const fsEnded = wasInFs && freeSpinsLeft === 0;

  if (freeSpinsLeft === 0) {
    freeSpinMultiplier = 0;
  }

  session.thronesFs = {
    ...fs,
    freeSpinsLeft,
    freeSpinMultiplier,
    freespinCnt: freeSpinsLeft > 0 ? freespinCnt : 0,
    fsTotalWin: freeSpinsLeft > 0 ? fsTotalWin : 0,
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
  const fs = session?.thronesFs ?? session?.rooFs;
  return isInFreeSpins({ thronesFs: fs }) ? 0 : bet;
}
