# Rise of Olympus — Mobile Client

PixiJS v8 mobile client for Rise of Olympus with Express spin API.

## Quick start

```powershell
cd games/rise-of-olympus
npm install
npm run dev
```

Or from repo root:

```powershell
npm run dev
```

Open **http://localhost:5180/**

## Project layout

```
games-mobile/
└── games/rise-of-olympus/   # Pixi client + Vite dev + spin API
    ├── src/                 # Scene, Spine, HUD, animations
    ├── server/              # JSON spin API + math
    └── public/assets/       # Spine, sounds, UI art
```

## Stack

- PixiJS v8 + Spine 4.2
- Vite dev + Express JSON spin API
- Server math in `server/games/rise-of-olympus/`

## Production

```powershell
cd games/rise-of-olympus
npm run build
npm start
```
