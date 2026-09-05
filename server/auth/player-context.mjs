/**
 * Resolve player identity from WebView / API requests.
 */

/** @param {import('express').Request} req */
export function extractPlayerId(req) {
  const q = { ...req.query, ...req.body };
  const fromQuery =
    q.player || q.playerId || q.userId || q.uid || req.headers['x-player-id'] || req.headers['x-player'];
  if (fromQuery) return String(fromQuery).slice(0, 128);

  const session = q.session || req.headers['x-session-id'];
  if (session) return `session:${String(session).slice(0, 96)}`;

  return `anon:${req.ip || 'default'}`;
}

/** @param {object} operator @param {string} playerId */
export function sessionKey(operator, playerId) {
  return `${operator.id}:${playerId}`;
}
