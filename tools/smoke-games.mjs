/**
 * Live smoke test — verify all games on a running games-mobile server.
 * Run: npm run test:live   (spawns server)  or  BASE_URL=... node tools/smoke-games.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:5180';
const TOKEN = process.env.TOKEN || 'op_demo_all';
const PLAYER = process.env.PLAYER || 'smoke-test';

const ALL_GAMES = [
  'olympus-rise',
  'greedy-feast',
  'luck-77',
  'dice-duel',
  'goal-clash',
  'rocket-rush',
];

const PLAY_PAGES = [
  '/play/olympus-rise',
  '/play/greedy-feast',
  '/play/luck-77',
  '/play/dice-duel',
  '/play/goal-clash',
  '/play/rocket-rush',
];

async function get(path, headers = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}token=${TOKEN}&player=${encodeURIComponent(PLAYER)}`;
  const res = await fetch(url, { headers: { ...headers } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function post(path, body, headers = {}) {
  const url = `${BASE}${path}?token=${TOKEN}&player=${encodeURIComponent(PLAYER)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operator-Token': TOKEN,
      'X-Player-Id': PLAYER,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

let failed = 0;

function pass(label) {
  console.log(`  ok  ${label}`);
}

function fail(label, detail) {
  failed++;
  console.error(`  FAIL ${label}: ${detail}`);
}

function apiOk(json) {
  return json?.code === 0 || json?.status?.Code === 'ES_1000';
}

console.log(`Smoke test ${BASE} token=${TOKEN}\n`);

const health = await get('/health');
if (health.ok && health.json?.ok && health.json.games?.length >= 6) pass('GET /health (6 games)');
else fail('GET /health', health.status);

const catalog = await get('/api/v1/games');
if (catalog.ok && catalog.json?.games?.length >= 6) pass('GET /api/v1/games');
else fail('GET /api/v1/games', catalog.status);

for (const slug of ALL_GAMES) {
  const launch = await get(`/api/v1/launch?game=${slug}`);
  if (launch.ok && launch.json?.launchUrl?.includes(slug)) pass(`GET /api/v1/launch (${slug})`);
  else fail(`GET /api/v1/launch (${slug})`, launch.json?.error || launch.status);
}

const sharedHud = await get('/shared/balance-hud.js');
if (sharedHud.ok && sharedHud.text.includes('gmSetBalance')) pass('GET /shared/balance-hud.js');
else fail('GET /shared/balance-hud.js', sharedHud.status);

for (const page of PLAY_PAGES) {
  const res = await get(page);
  if (res.ok && res.text.length > 200) pass(`GET ${page}`);
  else fail(`GET ${page}`, res.status);
}

const rooSession = await get('/api/v2/session?game=olympus-rise');
if (rooSession.ok && rooSession.json?.balance != null) pass('GET /api/v2/session (olympus-rise)');
else fail('GET /api/v2/session', rooSession.json?.error || rooSession.status);

const rooSpin = await post('/api/v2/spin?game=olympus-rise&bet=200', {});
if (rooSpin.ok && rooSpin.json?.symbols) pass('POST /api/v2/spin (olympus-rise)');
else fail('POST /api/v2/spin', rooSpin.json?.error || rooSpin.status);

const greedyInit = await get('/api/lottery/greedy-feast/init');
if (greedyInit.ok && greedyInit.json?.data?.sessionId) pass('GET /api/lottery/greedy-feast/init');
else fail('GET /api/lottery/greedy-feast/init', greedyInit.json?.msg || greedyInit.status);

const luckyInit = await get('/api/lottery/luck-77/init');
if (luckyInit.ok && luckyInit.json?.data?.sessionId) pass('GET /api/lottery/luck-77/init');
else fail('GET /api/lottery/luck-77/init', luckyInit.json?.msg || luckyInit.status);

const rocketInit = await get('/api/rocket-rush/init');
if (rocketInit.ok && rocketInit.json?.data?.game?.id === 'rocket-rush') pass('GET /api/rocket-rush/init');
else fail('GET /api/rocket-rush/init', rocketInit.json?.msg || rocketInit.status);

const diceInit = await get('/api/dice-duel/init');
if (diceInit.ok && diceInit.json?.data?.balance != null) pass('GET /api/dice-duel/init');
else fail('GET /api/dice-duel/init', diceInit.json?.msg || diceInit.status);

const goalInit = await get('/api/goal-clash/init');
if (goalInit.ok && goalInit.json?.data?.balance != null) pass('GET /api/goal-clash/init');
else fail('GET /api/goal-clash/init', goalInit.json?.msg || goalInit.status);

async function waitDiceBetting(maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await get('/api/dice-duel/state');
    if (res.json?.data?.phase === 'betting') return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

if (await waitDiceBetting()) {
  const bet1 = await post('/api/dice-duel/bet', { prediction: 'blue', amount: 200 });
  const bet2 = await post('/api/dice-duel/bet', { prediction: 'blue', amount: 200 });
  if (apiOk(bet1.json) && apiOk(bet2.json) && bet2.json?.data?.myBet?.amount === 400) {
    pass('POST /api/dice-duel/bet stack (200+200=400)');
  } else {
    fail('POST /api/dice-duel/bet stack', bet2.json?.msg || bet2.status);
  }
} else {
  fail('POST /api/dice-duel/bet stack', 'betting phase timeout');
}

async function waitGoalBetting(maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await get('/api/goal-clash/state');
    if (res.json?.data?.phase === 'betting') return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

if (await waitGoalBetting()) {
  const bet1 = await post('/api/goal-clash/bet', { prediction: 'home', amount: 200 });
  const bet2 = await post('/api/goal-clash/bet', { prediction: 'home', amount: 200 });
  if (apiOk(bet1.json) && apiOk(bet2.json) && bet2.json?.data?.myBet?.amount === 400) {
    pass('POST /api/goal-clash/bet stack (200+200=400)');
  } else {
    fail('POST /api/goal-clash/bet stack', bet2.json?.msg || bet2.status);
  }
} else {
  fail('POST /api/goal-clash/bet stack', 'betting phase timeout');
}

const luckySession = luckyInit.json?.data?.sessionId;
if (luckySession) {
  let bettingOpen = false;
  for (let i = 0; i < 40; i++) {
    const st = await post('/bigo/v1/bet_state', {
      TypCode: 'LUCK77_HALF',
      LotteryCode: 'luck77_2_half',
      SessionId: luckySession,
    }, { 'X-Lottery-Session': luckySession });
    if (st.json?.data?.Stage === 1) {
      bettingOpen = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (bettingOpen) {
    const bet = await post('/bigo/v1/bet', {
      TypCode: 'LUCK77_HALF',
      LotteryCode: 'luck77_2_half',
      PlayCode: 'LUCK77_LEMON',
      BetAmount: 200,
      SessionId: luckySession,
    }, { 'X-Lottery-Session': luckySession });
    if (apiOk(bet.json)) pass('POST /bigo/v1/bet (luck-77)');
    else fail('POST /bigo/v1/bet (luck-77)', bet.json?.msg || bet.json?.status?.Message);
  } else {
    fail('POST /bigo/v1/bet (luck-77)', 'betting window timeout');
  }
}

console.log('');
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All game server smoke checks passed');
