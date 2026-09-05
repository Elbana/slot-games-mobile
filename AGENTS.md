# AGENTS.md — games-mobile

Read this before changing **server math**, **economy**, or **operator config**.

## What this repo is

**games-mobile** is a multi-game **platform server** plus **WebView clients** for mobile/host apps (e.g. voice chat with embedded games).

| Layer | Path | Role |
|-------|------|------|
| Game server (authoritative) | `server/` | Bets, wins, odds, prize pools, audit |
| WebView clients (visual only) | `games/*/` | Replay server `events[]`; never decide outcomes |
| Operator config | `server/config/operators.json` | Per-app tokens, enabled games, wallet, economy |

The UI host (Express + static/Vite) serves pages. **Math and money logic live in `server/`**, not in Pixi/lottery HTML clients.

## Read order

1. [docs/GAME-SERVER-VISION.md](docs/GAME-SERVER-VISION.md) — architecture, APIs, game types
2. [docs/ECONOMY-AND-PRIZE-POOL.md](docs/ECONOMY-AND-PRIZE-POOL.md) — prize pool, house edge, operator economy
3. [docs/MOBILE-WEBVIEW.md](docs/MOBILE-WEBVIEW.md) — WebView URLs, wallet integration

## Hard rules

1. **Amounts are integer units** — never hardcode “coins”, “diamonds”, or currency symbols in server math. The host app owns wallet and display.
2. **Operator wallet is external** — debit/credit via `server/wallet/`; server does not store authoritative balance in production (mock wallet is dev-only).
3. **Client is not authoritative** — clients call APIs; they do not compute wins or RTP.
4. **Per-operator config** — each operator token has its own `enabledGames`, `wallet`, and `economy` in `operators.json`.
5. **Prize pool model** — net player losses feed a pool; house takes a configured edge; occasional **pool-funded wins** reward some players. See economy doc.
6. **Do not edit plan files** in `.cursor/plans/` unless asked.

## Key server paths

```
server/
  routes/slot-v2.mjs      # POST /api/v2/spin
  routes/lottery.mjs      # /api/lottery/*, /bigo/v1/*
  economy/prize-pool.mjs  # Pool ledger per operator+game
  economy/operator-economy.mjs
  math-profile.mjs        # Slot RTP profiles (social, voice_social, …)
  config/operators.json
  games/rise-of-olympus/  # Slot math
  games/lottery/          # Shared lottery engine
```

## Commands

```powershell
npm run dev      # Platform on :5180
npm test         # Unit tests
npm run smoke    # API smoke (server must be running)
```

## Goal for host apps (e.g. voice chat)

Players should **enjoy** games: some sessions win, some lose, population roughly neutral over time — not a wallet drain. Tune via operator `economy` config, not by giving away unlimited units.
