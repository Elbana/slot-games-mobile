function qs() {
  return new URLSearchParams(window.location.search);
}

function authHeaders() {
  const token = qs().get('token') || window.__PLATFORM__?.token || '';
  const player = qs().get('player') || window.__PLATFORM__?.player || 'demo';
  return {
    'Content-Type': 'application/json',
    'X-Operator-Token': token,
    'X-Player-Id': player,
  };
}

async function api(url, opts = {}) {
  const u = new URL(url, window.location.origin);
  const res = await fetch(u, { ...opts, headers: { ...authHeaders(), ...opts.headers } });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.msg || 'Request failed');
  return json.data;
}

export function diceDualInit() {
  return api('/api/dice-dual/init');
}

export function diceDualState() {
  return api('/api/dice-dual/state');
}

export function diceDualBet(prediction, amount) {
  return api('/api/dice-dual/bet', {
    method: 'POST',
    body: JSON.stringify({ prediction, amount }),
  });
}
