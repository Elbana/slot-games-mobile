# Mobile WebView integration

games-mobile serves slot and lottery games from one host. Mobile apps embed games in a WebView and pass an **operator token** plus **player id**.

## URLs

| Game | WebView URL |
|------|-------------|
| Rise of Olympus | `/play/rise-of-olympus?token=YOUR_OP_TOKEN&player=PLAYER_ID` |
| Greedy | `/play/greedy?token=YOUR_OP_TOKEN&player=PLAYER_ID` |
| Pets & Beasts | `/play/pets-beasts?token=YOUR_OP_TOKEN&player=PLAYER_ID` |

## Operator tokens

Configured in [`server/config/operators.json`](server/config/operators.json):

| Token | Enabled games |
|-------|----------------|
| `op_demo_all` | All games |
| `op_lottery_only` | Greedy, Pets & Beasts |
| `op_slots_only` | Rise of Olympus |
| `op_voice_chat` | All games (voice chat economy tuning) |

## Catalog API

```
GET /api/v1/games?token=YOUR_OP_TOKEN
```

Returns the list of games enabled for that operator.

## Wallet

All bets and wins go through the operator wallet adapter:

- **Mock mode** (dev): balance stored in platform session files under `data/sessions/`
- **HTTP mode** (production): configure `wallet.baseUrl` and `wallet.apiKey` per operator in `operators.json`

The game server treats all amounts as **integer units** — it does not know your currency name (coins, diamonds, etc.). See [GAME-SERVER-VISION.md](GAME-SERVER-VISION.md) and [ECONOMY-AND-PRIZE-POOL.md](ECONOMY-AND-PRIZE-POOL.md).

## Economy and prize pool

Per-operator tuning (house edge, prize pool, slot math profile) lives in `server/config/operators.json` under `economy`.

```
GET /api/v1/economy?token=YOUR_OP_TOKEN&game=rise-of-olympus
```

Details: [ECONOMY-AND-PRIZE-POOL.md](ECONOMY-AND-PRIZE-POOL.md). AI agents: start with [AGENTS.md](../AGENTS.md).

Expected operator wallet endpoints:

- `GET /players/:playerId/balance`
- `POST /transactions/debit`
- `POST /transactions/credit`
- `POST /transactions/rollback` (optional)

## Error codes

| HTTP | Meaning |
|------|---------|
| 401 | Missing operator token (when `REQUIRE_AUTH=1`) |
| 403 | Invalid token or game not enabled for operator |
| 400 | Insufficient balance / invalid bet |
| 502 | Operator wallet unreachable |

## Local dev

```powershell
cd games-mobile
npm install
npm run dev
```

Open http://localhost:5180/ for the game launcher, or use demo URLs above with `token=op_demo_all&player=demo`.
