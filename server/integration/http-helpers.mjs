/**
 * HTTP helpers for integration tests.
 */

import { createServer } from 'http';

export const DEMO_TOKEN = 'op_demo_all';

export function authHeaders(playerId, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Operator-Token': DEMO_TOKEN,
    'X-Player-Id': playerId,
    ...extra,
  };
}

export async function withServer(app, fn) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    return await fn(port);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

export async function getJson(port, path, playerId = 'integration-player') {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: authHeaders(playerId),
  });
  const json = await res.json();
  return { status: res.status, json };
}

export async function postJson(port, path, body, playerId = 'integration-player', extraHeaders = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: authHeaders(playerId, extraHeaders),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until predicate passes or timeout. */
export async function waitFor(label, fn, { timeoutMs = 15000, intervalMs = 150 } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timeout waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}
