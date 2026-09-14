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
if (health.ok && health.json?.ok && health.json.games?.length >= 6) pass('GET /health');
else fail('GET /health', health.status);

const catalog = await get('/api/v1/games');
if (catalog.ok && catalog.json?.games?.length >= 6) pass('GET /api/v1/games');
else fail('GET /api/v1/games', catalog.status);

const launch = await get('/api/v1/launch?game=rocket-rush');
if (launch.ok && launch.json?.launchUrl?.includes('rocket-rush')) pass('GET /api/v1/launch');
else fail('GET /api/v1/launch', launch.json?.error || launch.status);

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
if (diceInit.ok && diceInit.json?.data) pass('GET /api/dice-duel/init');
else fail('GET /api/dice-duel/init', diceInit.json?.msg || diceInit.status);

const goalInit = await get('/api/goal-clash/init');
if (goalInit.ok && goalInit.json?.data) pass('GET /api/goal-clash/init');
else fail('GET /api/goal-clash/init', goalInit.json?.msg || goalInit.status);

const greedyPage = await get('/play/greedy-feast');
if (greedyPage.ok && greedyPage.text.includes('greedy.js')) pass('GET /play/greedy-feast');
else fail('GET /play/greedy-feast', greedyPage.status);

const rooPage = await get('/play/olympus-rise');
if (rooPage.ok && (rooPage.text.includes('main.js') || rooPage.text.includes('Olympus'))) {
  pass('GET /play/olympus-rise');
} else fail('GET /play/olympus-rise', rooPage.status);

console.log('');
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All game server connections OK');
