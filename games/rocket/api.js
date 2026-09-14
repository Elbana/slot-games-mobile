function platformParams() {
  const p = typeof window !== 'undefined' ? window.__PLATFORM__ || {} : {};
  const params = new URLSearchParams(window.location.search);
  return {
    token: p.token || params.get('token') || 'op_demo_all',
    player: p.player || params.get('player') || 'demo',
  };
}

function appendAuth(url) {
  const { token, player } = platformParams();
  const u = new URL(url, window.location.origin);
  if (token) u.searchParams.set('token', token);
  if (player) u.searchParams.set('player', player);
  return u.toString();
}

async function fetchJson(url, init) {
  const res = await fetch(appendAuth(url), init);
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.msg || 'API error');
  return data.data;
}

const API = '/api/sky-streak';

export function rocketInit() {
  return fetchJson(`${API}/init`);
}

export function rocketState() {
  return fetchJson(`${API}/state`);
}

export function rocketBet(amount, autoCashout = 0) {
  return fetchJson(`${API}/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, autoCashout }),
  }).then((data) => {
    window.gmNotifyWallet?.('bet', { game: 'sky-streak', amount, balance: data.balance, delta: -amount });
    return data;
  });
}

export function rocketCashout() {
  return fetchJson(`${API}/cashout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((data) => {
    window.gmNotifyWallet?.('win', { game: 'sky-streak', amount: data.winAmount, balance: data.balance, delta: data.winAmount });
    return data;
  });
}
