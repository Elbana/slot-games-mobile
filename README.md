# Games Mobile

Standalone PixiJS mobile clients — one folder per game, each with its own dev server and spin API.

| Game | Folder | Port | Dev |
|------|--------|------|-----|
| Rise of Olympus | `games/rise-of-olympus` | 5180 | `npm run dev:roo` |
| Stadium of Riches | `games/stadium-of-riches` | 5181 | `npm run dev:sor` |
| Temple of Three | `games/temple-of-three` | 5182 | `npm run dev:tot` |
| Spinnin' Records Into the Beat | `games/spinnin-records-into-the-beat` | 5183 | `npm run dev:beat` |

## Quick start

```powershell
cd games/rise-of-olympus
npm install
npm run dev
```

Or from repo root after scaffolding:

```powershell
npm run dev:sor
```

## Scaffolding a game from template

Ported from `slot-games-client` using the Rise of Olympus mobile shell:

```powershell
node tools/scaffold-mobile-game.mjs --game stadium-of-riches
node tools/scaffold-mobile-game.mjs --all
```

Assets are copied from `../slot-games-client/public/assets/`. Run fetch scripts there first if assets are missing.

## Stack (each game)

- PixiJS v8 + Spine (where applicable)
- Vite dev + Express JSON spin API
- Server math from `slot-games-client/server/games/*`
