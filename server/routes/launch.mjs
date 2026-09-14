/**
 * Launch URL API — signed WebView URLs for host apps (Flutter).
 */

import { requireOperator, isGameEnabled } from '../auth/operator-auth.mjs';
import { extractPlayerId } from '../auth/player-context.mjs';
import { createLaunchToken } from '../auth/launch-token.mjs';
import { getGame } from '../registry/games.mjs';
import { PORT } from '../config.mjs';

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

export function handleGetLaunch(req, res) {
  const operator = requireOperator(req, res);
  if (!operator) return;

  const game = req.query.game || req.body?.game;
  if (!game) {
    return res.status(400).json({ error: 'Query parameter "game" is required (slug)' });
  }

  const def = getGame(game);
  if (!def) {
    return res.status(404).json({ error: 'Unknown game', slug: game });
  }
  if (!isGameEnabled(operator, game)) {
    return res.status(403).json({ error: 'Game not enabled for this operator', slug: game });
  }

  const playerId = extractPlayerId(req);
  const { token, expiresAt } = createLaunchToken({
    operatorId: operator.id,
    operatorToken: operator.token,
    playerId,
    game,
  });

  const launchUrl = `${baseUrl(req)}${def.playPath}?launch=${encodeURIComponent(token)}`;

  res.json({
    game: def.slug,
    name: def.name,
    playUrl: def.playPath,
    launchUrl,
    expiresAt,
    playerId,
  });
}
