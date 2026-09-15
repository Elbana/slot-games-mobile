/**
 * Integration tests — full platform API flows with mock wallet (op_demo_all).
 * Run: npm run test:integration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './test-app.mjs';
import {
  withServer,
  getJson,
  postJson,
  waitFor,
  sleep,
} from './http-helpers.mjs';
import { LUCK77_GAME } from '../games/lucky77/config.mjs';
import { GREEDY_GAME } from '../games/greedy/config.mjs';

const ALL_GAMES = [
  'olympus-rise',
  'greedy-feast',
  'luck-77',
  'dice-duel',
  'goal-clash',
  'rocket-rush',
];

function unwrapOk(json) {
  assert.equal(json.code, 0, json.msg || 'expected code 0');
  return json.data;
}

function lotteryBetState(port, sessionId, game, playerId) {
  return postJson(
    port,
    '/bigo/v1/bet_state',
    {
      TypCode: game.typCode,
      LotteryCode: game.lotteryCode,
      SessionId: sessionId,
    },
    playerId,
    sessionId ? { 'X-Lottery-Session': sessionId } : {},
  );
}

async function waitLotteryBetting(port, sessionId, game, playerId) {
  return waitFor(`${game.id} betting phase`, async () => {
    const { json } = await lotteryBetState(port, sessionId, game, playerId);
    const data = json?.data ?? json;
    if (data?.Stage === 1) return data;
    return null;
  });
}

async function waitPvpBetting(port, apiPath, playerId) {
  return waitFor(`${apiPath} betting phase`, async () => {
    const { json } = await getJson(port, `${apiPath}/state`, playerId);
    const data = unwrapOk(json);
    if (data?.phase === 'betting') return data;
    return null;
  });
}

describe('platform health and catalog', () => {
  it('lists all six live games', async () => {
    await withServer(createTestApp(), async (port) => {
      const { json } = await getJson(port, '/health');
      assert.equal(json.ok, true);
      for (const slug of ALL_GAMES) {
        assert.ok(json.games.includes(slug), `missing ${slug}`);
      }

      const catalog = await getJson(port, '/api/v1/games');
      assert.ok(catalog.json.games.length >= 6);
    });
  });

  it('returns launch URLs for each game slug', async () => {
    await withServer(createTestApp(), async (port) => {
      for (const slug of ALL_GAMES) {
        const { json } = await getJson(port, `/api/v1/launch?game=${slug}`);
        assert.ok(json.launchUrl?.includes(slug), slug);
      }
    });
  });
});

describe('olympus-rise slot API', () => {
  it('returns session and completes a spin with balance', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'slot-player';
      const session = await getJson(port, '/api/v2/session?game=olympus-rise', player);
      assert.equal(session.status, 200);
      assert.ok(session.json.balance != null);

      const spin = await postJson(port, '/api/v2/spin?game=olympus-rise&bet=200', {}, player);
      assert.equal(spin.status, 200);
      assert.ok(Array.isArray(spin.json.symbols));
      assert.ok(spin.json.balance != null);
    });
  });
});

describe('dice-duel API', () => {
  it('init returns balance and accepts stacked bets on same side', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'dice-stack-player';
      const init = unwrapOk((await getJson(port, '/api/dice-duel/init', player)).json);
      assert.ok(init.balance > 0);

      await waitPvpBetting(port, '/api/dice-duel', player);

      const bet1 = unwrapOk((await postJson(
        port,
        '/api/dice-duel/bet',
        { prediction: 'red', amount: 200 },
        player,
      )).json);
      assert.equal(bet1.myBet.amount, 200);

      const bet2 = unwrapOk((await postJson(
        port,
        '/api/dice-duel/bet',
        { prediction: 'red', amount: 200 },
        player,
      )).json);
      assert.equal(bet2.myBet.amount, 400);
      assert.ok(bet2.balance < init.balance);
    });
  });

  it('state polls omit wallet balance', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'dice-poll-player';
      unwrapOk((await getJson(port, '/api/dice-duel/init', player)).json);
      for (let i = 0; i < 8; i++) {
        const data = unwrapOk((await getJson(port, '/api/dice-duel/state', player)).json);
        assert.equal(data.balance, undefined);
      }
    });
  });
});

describe('goal-clash API', () => {
  it('init returns balance and accepts stacked bets on same team', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'goal-stack-player';
      const init = unwrapOk((await getJson(port, '/api/goal-clash/init', player)).json);
      assert.ok(init.balance > 0);

      await waitPvpBetting(port, '/api/goal-clash', player);

      const bet1 = unwrapOk((await postJson(
        port,
        '/api/goal-clash/bet',
        { prediction: 'home', amount: 200 },
        player,
      )).json);
      assert.equal(bet1.myBet.amount, 200);

      const bet2 = unwrapOk((await postJson(
        port,
        '/api/goal-clash/bet',
        { prediction: 'home', amount: 200 },
        player,
      )).json);
      assert.equal(bet2.myBet.amount, 400);
    });
  });

  it('blocks switching team mid-round', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'goal-switch-player';
      unwrapOk((await getJson(port, '/api/goal-clash/init', player)).json);
      await waitPvpBetting(port, '/api/goal-clash', player);

      unwrapOk((await postJson(
        port,
        '/api/goal-clash/bet',
        { prediction: 'away', amount: 200 },
        player,
      )).json);

      const blocked = (await postJson(
        port,
        '/api/goal-clash/bet',
        { prediction: 'home', amount: 200 },
        player,
      )).json;
      assert.notEqual(blocked.code, 0);
      assert.match(blocked.msg, /one team/i);
    });
  });
});

describe('rocket-rush API', () => {
  it('init and place bet during betting phase', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'rocket-player';
      const init = unwrapOk((await getJson(port, '/api/rocket-rush/init', player)).json);
      assert.equal(init.game.id, 'rocket-rush');
      assert.ok(init.balance > 0);

      await waitFor('rocket betting', async () => {
        const data = unwrapOk((await getJson(port, '/api/rocket-rush/state', player)).json);
        if (data.phase === 'betting') return data;
        return null;
      });

      const bet = unwrapOk((await postJson(
        port,
        '/api/rocket-rush/bet',
        { amount: 200 },
        player,
      )).json);
      assert.equal(bet.amount, 200);
      assert.ok(bet.myBet);
    });
  });
});

describe('luck-77 lottery API', () => {
  it('init, bet during open window, and rapid polls avoid wallet balance', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'luck77-player';
      const init = unwrapOk((await getJson(port, '/api/lottery/luck-77/init', player)).json);
      assert.ok(init.sessionId);
      assert.ok(init.balance > 0);
      const sessionId = init.sessionId;

      await waitLotteryBetting(port, sessionId, LUCK77_GAME, player);

      for (let i = 0; i < 6; i++) {
        const { json } = await lotteryBetState(port, sessionId, LUCK77_GAME, player);
        const data = json?.data ?? json;
        if (data?.Stage !== 4) {
          assert.equal(data?.Balance, undefined, 'bet_state should not fetch wallet on poll');
        }
      }

      const before = init.balance;
      const { json: bet } = await postJson(
        port,
        '/bigo/v1/bet',
        {
          TypCode: LUCK77_GAME.typCode,
          LotteryCode: LUCK77_GAME.lotteryCode,
          PlayCode: 'LUCK77_LEMON',
          BetAmount: 200,
          SessionId: sessionId,
        },
        player,
        { 'X-Lottery-Session': sessionId },
      );
      assert.ok(bet.status?.Code === 'ES_1000' || bet.code === 0, bet.msg || bet.status?.Message);
      assert.ok(bet.data.Balance <= before);
    });
  });
});

describe('greedy-feast lottery API', () => {
  it('init and place food bet when betting is open', async () => {
    await withServer(createTestApp(), async (port) => {
      const player = 'greedy-player';
      const init = unwrapOk((await getJson(port, '/api/lottery/greedy-feast/init', player)).json);
      const sessionId = init.sessionId;

      await waitLotteryBetting(port, sessionId, GREEDY_GAME, player);

      const { json: bet } = await postJson(
        port,
        '/bigo/v1/bet',
        {
          TypCode: GREEDY_GAME.typCode,
          LotteryCode: GREEDY_GAME.lotteryCode,
          PlayCode: 'BIGO_GREEDY_TOMATO',
          BetAmount: 200,
          SessionId: sessionId,
        },
        player,
        { 'X-Lottery-Session': sessionId },
      );
      assert.ok(bet.status?.Code === 'ES_1000' || bet.code === 0, bet.msg || bet.status?.Message);
    });
  });
});
