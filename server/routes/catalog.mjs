/**
 * Game catalog filtered by operator token.
 */

import { requireOperator, isGameEnabled } from '../auth/operator-auth.mjs';
import { catalogEntry, listGames } from '../registry/games.mjs';

export function handleGetCatalog(req, res) {
  const operator = requireOperator(req, res);
  if (!operator) return;

  const games = listGames()
    .filter((g) => isGameEnabled(operator, g.slug))
    .map(catalogEntry);

  res.json({
    operator: { id: operator.id, name: operator.name },
    games,
  });
}
