/**
 * SSE push for shared realtime rounds — all players see the same phase at once.
 */

import { getGame } from '../registry/games.mjs';
import { resolveEngineForGameId } from '../games/lottery/routes.mjs';
import { getDiceDualEngine } from '../games/dice-dual/engine.mjs';
import { getFootballClashEngine } from '../games/football-clash/engine.mjs';
import { getRocketEngine } from '../games/rocket/engine.mjs';
import { requireGameAccess } from '../auth/operator-auth.mjs';

/** @type {Record<string, () => object>} */
const STATE_READERS = {
  'greedy-feast': () => resolveEngineForGameId('greedy-feast')?.getBetState?.() ?? null,
  'luck-77': () => resolveEngineForGameId('luck-77')?.getBetState?.() ?? null,
  'dice-duel': () => getDiceDualEngine().getPublicState(),
  'goal-clash': () => getFootballClashEngine().getPublicState(),
  'rocket-rush': () => getRocketEngine().getPublicState(),
};

function snapshotKey(state) {
  if (!state) return '';
  return JSON.stringify({
    r: state.roundId ?? state.Period,
    p: state.phase ?? state.Stage,
    c: state.countdown ?? state.CountDown,
  });
}

export function mountRealtimeRoutes(app) {
  app.get('/api/v1/realtime/:slug/events', (req, res) => {
    const slug = req.params.slug;
    const game = getGame(slug);
    if (!game || game.type === 'slot') {
      return res.status(404).json({ error: 'Unknown realtime game' });
    }
    const operator = requireGameAccess(req, res, slug);
    if (!operator) return;

    const read = STATE_READERS[slug];
    if (!read) return res.status(404).json({ error: 'No realtime reader' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let lastKey = '';
    const push = () => {
      const state = read();
      if (!state) return;
      const key = snapshotKey(state);
      if (key !== lastKey) {
        lastKey = key;
        res.write(`data: ${JSON.stringify({ game: slug, state })}\n\n`);
      }
    };

    push();
    const timer = setInterval(push, 200);
    req.on('close', () => clearInterval(timer));
  });
}
