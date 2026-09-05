/**
 * Thin JSON client for /api/v2/spin.
 */

/** @typedef {import('./spin-types.js').SpinResult} SpinResult */
/** @typedef {import('./spin-types.js').SessionInfo} SessionInfo */

const SESSION_KEY = 'roo-session';

function platformParams() {
  const injected = typeof window !== 'undefined' ? window.__PLATFORM__ || {} : {};
  const params = new URLSearchParams(window.location.search);
  return {
    token: injected.token || params.get('token') || 'op_demo_all',
    player: injected.player || params.get('player') || getSessionId(),
    session: getSessionId(),
  };
}

/** @returns {string} */
export function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'default';
  }
}

function authParams() {
  const { token, player, session } = platformParams();
  return { token, player, session };
}

/**
 * @param {string} game
 * @returns {Promise<SessionInfo>}
 */
export async function fetchSession(game) {
  const params = new URLSearchParams({ game, ...authParams() });
  const res = await fetch(`/api/v2/session?${params}`);
  const text = await res.text();
  if (!res.ok) {
    let msg = `Session failed (${res.status})`;
    try {
      const body = JSON.parse(text);
      if (body.error) msg = body.error;
    } catch {
      if (text.startsWith('<!')) msg = 'API unavailable — use npm run dev';
    }
    throw new Error(msg);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('API unavailable — use npm run dev');
  }
}

/**
 * @param {string} game
 * @param {{ bet?: number, balance?: number, spinId?: string }} [opts]
 * @returns {Promise<SpinResult>}
 */
export async function requestSpin(game, opts = {}) {
  const params = new URLSearchParams({ game, ...authParams() });
  if (opts.bet != null) params.set('bet', String(opts.bet));
  const spinId = opts.spinId ?? globalThis.crypto?.randomUUID?.() ?? String(Date.now());
  params.set('spinId', spinId);

  const res = await fetch(`/api/v2/spin?${params}`, { method: 'POST' });
  const text = await res.text();
  if (!res.ok) {
    let msg = `Spin failed (${res.status})`;
    try {
      const body = JSON.parse(text);
      if (body.error) msg = body.error;
    } catch {
      if (text.startsWith('<!')) msg = 'API unavailable — use npm run dev';
    }
    throw new Error(msg);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('API unavailable — use npm run dev');
  }
}
