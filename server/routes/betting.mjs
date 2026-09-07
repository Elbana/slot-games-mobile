/**
 * GET /api/v1/betting — operator chip tiers for host app integrators.
 */

import { requireOperator } from '../auth/operator-auth.mjs';
import { bettingPayload, getBetConfig } from '../betting/bet-config.mjs';

export function handleGetBetting(req, res) {
  const operator = requireOperator(req, res);
  if (!operator) return;

  const config = getBetConfig(operator);
  const unitLabel = operator?.wallet?.unitLabel ?? null;

  res.json({
    operator: { id: operator.id, name: operator.name },
    betting: bettingPayload(config),
    ...(unitLabel ? { unitLabel } : {}),
  });
}
