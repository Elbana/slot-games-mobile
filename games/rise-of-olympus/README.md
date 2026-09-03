# Rise of Olympus — PixiJS Visual Client

Native PixiJS recreation of Rise of Olympus 1000 mobile UI and animations using the original Spine assets.

## Run

```powershell
cd d:\projects\slot\games-mobile\games\rise-of-olympus
npm install
npm run dev
```

Open **http://localhost:5180/**

## Stack

- PixiJS v8 + `@esotericsoftware/spine-pixi-v8`
- Vite dev server + Express spin API (for animated spins)
- Original RoO1000 Spine skeletons, atlases, HUD sprites, and **sound sprites** (mp3 atlases)

## Sounds

First run (or if audio is silent):

```powershell
npm run fetch-sounds
```

This downloads the three RoO1000 mp3 sound atlases (~8 MB) from the Play'n GO CDN.

## Notes

- Visual-only focus: full grid animations, cascades, free spins, big win, hyperspin
- Spin math reuses the cluster engine from `slot-games-client`
- Assets live in `public/assets/rise-of-olympus/`
