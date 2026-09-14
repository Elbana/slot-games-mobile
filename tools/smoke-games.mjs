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

const launch = await get('/api/v1/launch?game=sky-streak');
if (launch.ok && launch.json?.launchUrl?.includes('sky-streak')) pass('GET /api/v1/launch');
else fail('GET /api/v1/launch', launch.json?.error || launch.status);

const rooSession = await get('/api/v2/session?game=throne-rush');
if (rooSession.ok && rooSession.json?.balance != null) pass('GET /api/v2/session (throne-rush)');
else fail('GET /api/v2/session', rooSession.json?.error || rooSession.status);

const rooSpin = await post('/api/v2/spin?game=throne-rush&bet=200', {});
if (rooSpin.ok && rooSpin.json?.symbols) pass('POST /api/v2/spin (throne-rush)');
else fail('POST /api/v2/spin', rooSpin.json?.error || rooSpin.status);

const feastInit = await get('/api/lottery/feast-spin/init');
if (feastInit.ok && feastInit.json?.data?.sessionId) pass('GET /api/lottery/feast-spin/init');
else fail('GET /api/lottery/feast-spin/init', feastInit.json?.msg || feastInit.status);

const harvestInit = await get('/api/lottery/triple-harvest/init');
if (harvestInit.ok && harvestInit.json?.data?.sessionId) pass('GET /api/lottery/triple-harvest/init');
else fail('GET /api/lottery/triple-harvest/init', harvestInit.json?.msg || harvestInit.status);

const skyInit = await get('/api/sky-streak/init');
if (skyInit.ok && skyInit.json?.data?.game?.id === 'sky-streak') pass('GET /api/sky-streak/init');
else fail('GET /api/sky-streak/init', skyInit.json?.msg || skyInit.status);

const diceInit = await get('/api/dice-arena/init');
if (diceInit.ok && diceInit.json?.data) pass('GET /api/dice-arena/init');
else fail('GET /api/dice-arena/init', diceInit.json?.msg || diceInit.status);

const goalInit = await get('/api/goal-showdown/init');
if (goalInit.ok && goalInit.json?.data) pass('GET /api/goal-showdown/init');
else fail('GET /api/goal-showdown/init', goalInit.json?.msg || goalInit.status);

const feastPage = await get('/play/feast-spin');
if (feastPage.ok && feastPage.text.includes('greedy.js')) pass('GET /play/feast-spin');
else fail('GET /play/feast-spin', feastPage.status);

const rooPage = await get('/play/throne-rush');
if (rooPage.ok && (rooPage.text.includes('main.js') || rooPage.text.includes('Throne'))) {
  pass('GET /play/throne-rush');
} else fail('GET /play/throne-rush', rooPage.status);

console.log('');
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All game server connections OK');
