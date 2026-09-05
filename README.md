# games-mobile

Multi-game platform for mobile WebView clients: slots + lottery games with operator token enablement and wallet integration.

## Quick start

```powershell
cd games-mobile
npm install
npm run dev
```

Open **http://localhost:5180/**

## Games

| Slug | Type | Play URL |
|------|------|----------|
| `rise-of-olympus` | Slot (PixiJS) | `/play/rise-of-olympus` |
| `greedy` | Lottery wheel | `/play/greedy` |
| `pets-beasts` | Lottery wheel | `/play/pets-beasts` |

Demo: `?token=op_demo_all&player=demo`

## API

| Route | Purpose |
|-------|---------|
| `GET /api/v1/games?token=` | Enabled games for operator |
| `GET /api/v1/economy?token=&game=` | Prize pool stats and economy config |
| `GET /api/v2/session?game=&token=&player=` | Slot session |
| `POST /api/v2/spin?game=&token=&player=` | Slot spin |
| `GET /api/lottery/:id/init?token=&player=` | Lottery bootstrap |
| `POST /bigo/v1/bet`, `/bet_state`, … | Lottery round API |

See [docs/MOBILE-WEBVIEW.md](docs/MOBILE-WEBVIEW.md) for mobile integration and [docs/ECONOMY-AND-PRIZE-POOL.md](docs/ECONOMY-AND-PRIZE-POOL.md) for prize pool tuning.

**AI agents:** read [AGENTS.md](AGENTS.md) before changing server math or economy.

## Project layout

```
games-mobile/
├── server/                 # Unified platform server
│   ├── index.mjs           # HTTP entry
│   ├── auth/               # Operator token + player context
│   ├── wallet/             # Operator wallet adapter
│   ├── registry/           # Game catalog
│   ├── routes/             # API handlers
│   └── games/              # Per-game math (slot + lottery)
├── games/
│   ├── rise-of-olympus/    # Pixi slot client
│   ├── greedy/             # Lottery client
│   ├── pets-beasts/        # Lottery client
│   └── shared/lottery/     # Shared lottery API client
└── data/                   # Sessions + audit (gitignored)
```

## Configuration

Copy `.env.example` to `.env` and edit operator tokens in `server/config/operators.json`.

## Production

```powershell
npm run build    # builds rise-of-olympus client
set NODE_ENV=production
set REQUIRE_AUTH=1
npm start
```

## Tests

```powershell
npm test
```
