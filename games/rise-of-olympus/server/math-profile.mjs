/**
 * Shared math profile for spin generation.
 */

export const MATH_PROFILE = process.env.MATH_PROFILE || 'social';

/** @type {Record<string, object>} */
export const PROFILES = {
  social: {
    rtpTarget: '88–92%',
    plantedWinRate: 0.41,
    naturalWinRate: 0.07,
    winPayMultiplier: 1.22,
    reelHitRate: 0.30,
    reelRtpFactor: 0.90,
    scatterFsSeedRate: 0.012,
    description: 'Social casino — fair, fun, slow rewarding',
  },
  stingy: {
    rtpTarget: '70–80%',
    plantedWinRate: 0.08,
    naturalWinRate: 0.04,
    winPayMultiplier: 1,
    reelHitRate: 0.18,
    reelRtpFactor: 0.72,
    scatterFsSeedRate: 0.006,
    description: 'Stingy economy',
  },
  generous: {
    rtpTarget: '93–96%',
    plantedWinRate: 0.45,
    naturalWinRate: 0.08,
    winPayMultiplier: 1.1,
    reelHitRate: 0.42,
    reelRtpFactor: 0.94,
    scatterFsSeedRate: 0.015,
    description: 'Generous social mode',
  },
};

/** @returns {typeof PROFILES.social} */
export function getMathProfile() {
  return PROFILES[MATH_PROFILE] ?? PROFILES.social;
}

export function applyMathDefaults() {
  if (process.env.MATH_PROFILE == null) {
    process.env.MATH_PROFILE = 'social';
  }
}

export function describeMathProfile() {
  const p = getMathProfile();
  return `math: ${MATH_PROFILE} (${p.description}, target RTP ${p.rtpTarget})`;
}
