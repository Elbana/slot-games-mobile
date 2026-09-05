/**
 * Shared lottery API client for cloned game UIs.
 */

function platformParams() {
  const p = typeof window !== 'undefined' ? window.__PLATFORM__ || {} : {};
  const params = new URLSearchParams(window.location.search);
  const token = p.token || params.get('token') || 'op_demo_all';
  const player = p.player || params.get('player') || 'demo';
  return { token, player };
}

function appendAuth(url) {
  const { token, player } = platformParams();
  const u = new URL(url, window.location.origin);
  if (token) u.searchParams.set('token', token);
  if (player) u.searchParams.set('player', player);
  return u.toString();
}

export class LotteryApiError extends Error {
  constructor(message, { offline = false, httpStatus } = {}) {
    super(message);
    this.name = 'LotteryApiError';
    this.offline = offline;
    this.httpStatus = httpStatus;
  }
}

async function fetchJson(url, init) {
  let res;
  try {
    res = await fetch(appendAuth(url), init);
  } catch {
    throw new LotteryApiError('Server unreachable — run npm run dev', { offline: true });
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new LotteryApiError(`Invalid JSON from ${url}`, { httpStatus: res.status });
  }
}

export async function lotteryInit(gameId) {
  return fetchJson(`/api/lottery/${gameId}/init`);
}

export async function postJson(path, body, sessionId) {
  return fetchJson(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'X-Lottery-Session': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function unwrap(res) {
  if (res?.code === 0) return res.data;
  if (res?.status?.Code === 'ES_1000') return res.data;
  throw new Error(res?.msg || res?.status?.Message || 'API error');
}

export async function betState(config, sessionId) {
  const res = await postJson(
    '/bigo/v1/bet_state',
    {
      TypCode: config.typCode,
      TypeCode: config.typCode,
      LotteryCode: config.lotteryCode,
      SessionId: sessionId,
    },
    sessionId
  );
  return unwrap(res);
}

export async function periodList(config, page = { Idx: 1, Size: 20 }) {
  const res = await postJson('/bigo/v1/period_list', {
    TypCode: config.typCode,
    TypeCode: config.typCode,
    LotteryCode: config.lotteryCode,
    Page: page,
  });
  const data = unwrap(res);
  return {
    periods: data.Periods || data.rows || [],
    total: data.Total ?? data.total ?? 0,
  };
}

export async function oddList(config) {
  const res = await postJson('/bigo/v1/odd_list', {
    TypCode: config.typCode,
    LotteryCode: config.lotteryCode,
  });
  return unwrap(res);
}

export async function placeBet(config, sessionId, playCode, amount) {
  const res = await postJson(
    '/bigo/v1/bet',
    {
      TypCode: config.typCode,
      LotteryCode: config.lotteryCode,
      PlayCode: playCode,
      BetAmount: amount,
      SessionId: sessionId,
    },
    sessionId
  );
  return unwrap(res);
}

export function oddsMap(oddListData) {
  const map = {};
  const subs = oddListData?.PalySubType || [];
  for (const sub of subs) {
    for (const row of sub.PlayCodeOdd || []) {
      if (row.PlayCode) map[row.PlayCode] = Number(row.MaxOdd || row.Odd || 0);
    }
  }
  return map;
}
