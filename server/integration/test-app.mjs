/**
 * In-process Express app for integration tests (no listen).
 */

import express from 'express';
import { applyProductionDefaults } from '../config.mjs';
import { handleGetCatalog } from '../routes/catalog.mjs';
import { handleGetEconomy } from '../routes/economy.mjs';
import { handleGetBetting } from '../routes/betting.mjs';
import { handleGetLaunch } from '../routes/launch.mjs';
import { handleGetSession, handleV2Spin } from '../routes/slot-v2.mjs';
import { mountLotteryRoutes } from '../routes/lottery.mjs';
import { mountDiceDualRoutes } from '../routes/dice-dual.mjs';
import { mountFootballClashRoutes } from '../routes/football-clash.mjs';
import { mountRocketRoutes } from '../routes/rocket.mjs';
import { listGames } from '../registry/games.mjs';

export function createTestApp() {
  applyProductionDefaults();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, games: listGames().map((g) => g.slug) });
  });

  app.get('/api/v1/games', handleGetCatalog);
  app.get('/api/v1/launch', handleGetLaunch);
  app.get('/api/v1/economy', handleGetEconomy);
  app.get('/api/v1/betting', handleGetBetting);
  app.get('/api/v2/session', handleGetSession);
  app.get('/api/v2/spin', handleV2Spin);
  app.post('/api/v2/spin', handleV2Spin);

  mountLotteryRoutes(app);
  mountDiceDualRoutes(app);
  mountFootballClashRoutes(app);
  mountRocketRoutes(app);

  return app;
}
