/**
 * Smoke test — verify all games reach the platform server.
 * Run with server up: node tools/smoke-games.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:5180';
const TOKEN = process.env.TOKEN || 'op_demo_all';
const PLAYER = process.env.PLAYER || 'smoke-test';

async function get(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}token=${TOKEN}&player=${PLAYER}`;
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function post(path, body) {
  const url = `${BASE}${path}?token=${TOKEN}&player=${PLAYER}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

let failed = 0;

function pass(label) {
  console.log(`  ok  ${label}`);
}

function fail(label, detail) {
  failed++;
  console.error(`  FAIL ${label}: ${detail}`);
}

console.log(`Smoke test ${BASE} token=${TOKEN}\n`);

const health = await get('/health');
if (health.ok && health.json?.ok) pass('GET /health');
else fail('GET /health', health.status);

const catalog = await get('/api/v1/games');
if (catalog.ok && catalog.json?.games?.length >= 3) pass('GET /api/v1/games');
else fail('GET /api/v1/games', catalog.status);

const rooSession = await get('/api/v2/session?game=rise-of-olympus');
if (rooSession.ok && rooSession.json?.balance != null) pass('GET /api/v2/session (rise-of-olympus)');
else fail('GET /api/v2/session', rooSession.json?.error || rooSession.status);

const rooSpin = await post('/api/v2/spin?game=rise-of-olympus&bet=20', {});
if (rooSpin.ok && rooSpin.json?.symbols) pass('POST /api/v2/spin (rise-of-olympus)');
else fail('POST /api/v2/spin', rooSpin.json?.error || rooSpin.status);

const greedyInit = await get('/api/lottery/greedy/init');
if (greedyInit.ok && greedyInit.json?.data?.sessionId) pass('GET /api/lottery/greedy/init');
else fail('GET /api/lottery/greedy/init', greedyInit.json?.msg || greedyInit.status);

const economy = await get('/api/v1/economy?game=rise-of-olympus');
if (economy.ok && economy.json?.poolBalance != null) pass('GET /api/v1/economy');
else fail('GET /api/v1/economy', economy.json?.error || economy.status);

const petsInit = await get('/api/lottery/pets-beasts/init');
if (petsInit.ok && petsInit.json?.data?.sessionId) pass('GET /api/lottery/pets-beasts/init');
else fail('GET /api/lottery/pets-beasts/init', petsInit.json?.msg || petsInit.status);

const greedyPage = await get('/play/greedy');
if (greedyPage.ok && greedyPage.text.includes('greedy.js')) pass('GET /play/greedy');
else fail('GET /play/greedy', greedyPage.status);

const petsPage = await get('/play/pets-beasts');
if (petsPage.ok && petsPage.text.includes('pets-beasts.js')) pass('GET /play/pets-beasts');
else fail('GET /play/pets-beasts', petsPage.status);

const rooPage = await get('/play/rise-of-olympus');
if (rooPage.ok && (rooPage.text.includes('main.js') || rooPage.text.includes('Rise of Olympus'))) {
  pass('GET /play/rise-of-olympus');
} else fail('GET /play/rise-of-olympus', rooPage.status);

if (greedyInit.json?.data?.sessionId) {
  const odd = await post('/bigo/v1/odd_list', {
    TypCode: 'BIGO_GREEDY',
    LotteryCode: 'BIGO_GREEDY_001',
  });
  if (odd.ok && (odd.json?.data || odd.json?.status?.Code === 'ES_1000')) pass('POST /bigo/v1/odd_list');
  else fail('POST /bigo/v1/odd_list', odd.json?.msg || odd.status);
}

console.log('');
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All game server connections OK');
