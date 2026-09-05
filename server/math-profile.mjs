/**
 * Shared math profile for spin generation.
 */

export const MATH_PROFILE = process.env.MATH_PROFILE || 'social';

/** @type {string | null} Request-scoped profile override */
let activeProfileOverride = null;

/** Run sync fn under a math profile (per-operator slot spins). */
export function runWithMathProfile(profileName, fn) {
  const prev = activeProfileOverride;
  activeProfileOverride = profileName;
  try {
    return fn();
  } finally {
    activeProfileOverride = prev;
  }
}

/** Run async fn under a math profile. */
export async function runWithMathProfileAsync(profileName, fn) {
  const prev = activeProfileOverride;
  activeProfileOverride = profileName;
  try {
    return await fn();
  } finally {
    activeProfileOverride = prev;
  }
}

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
  voice_social: {
    rtpTarget: '92–96%',
    plantedWinRate: 0.38,
    naturalWinRate: 0.09,
    winPayMultiplier: 1.08,
    reelHitRate: 0.36,
    reelRtpFactor: 0.94,
    scatterFsSeedRate: 0.014,
    description: 'Voice chat — frequent small hits; pool bonuses for excitement',
  },
};

export function getMathProfile() {
  const key = activeProfileOverride || MATH_PROFILE;
  return PROFILES[key] ?? PROFILES.social;
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
