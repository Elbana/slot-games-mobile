/**
 * GET /api/v1/economy — pool stats and operator economy config.
 */

import { requireOperator, isGameEnabled } from '../auth/operator-auth.mjs';
import { getGame, listGames } from '../registry/games.mjs';
import { getPoolStats } from '../economy/prize-pool.mjs';
import { getOperatorEconomy } from '../economy/operator-economy.mjs';
import { bettingPayload, getBetConfig } from '../betting/bet-config.mjs';

export function handleGetEconomy(req, res) {
  const operator = requireOperator(req, res);
  if (!operator) return;

  const q = { ...req.query, ...req.body };
  const gameSlug = q.game || null;

  if (gameSlug) {
    if (!getGame(gameSlug)) {
      return res.status(404).json({ error: 'Unknown game', slug: gameSlug });
    }
    if (!isGameEnabled(operator, gameSlug)) {
      return res.status(403).json({ error: 'Game not enabled for this operator', slug: gameSlug });
    }
    return res.json({
      ...getPoolStats(operator, gameSlug),
      betting: bettingPayload(getBetConfig(operator)),
    });
  }

  const games = listGames()
    .filter((g) => isGameEnabled(operator, g.slug))
    .map((g) => getPoolStats(operator, g.slug));

  res.json({
    operator: { id: operator.id, name: operator.name },
    economy: getOperatorEconomy(operator),
    betting: bettingPayload(getBetConfig(operator)),
    games,
  });
}
