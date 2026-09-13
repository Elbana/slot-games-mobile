# Lucky 77 — replaceable assets

Drop-in art for the Lucky 77 client. **Keep filenames identical** when swapping your own files.

## Symbol icons (wheel + bet panels + history)

| File | Used for |
|------|----------|
| `lemon.png` | Lemon wedge & bet zone |
| `watermelon.png` | Watermelon wedge & bet zone |
| `seven.png` | Lucky 77 wedge & bet zone |

Recommended: **512×512 PNG** with transparent background.

## UI chrome

| File | Used for |
|------|----------|
| `coin.png` | Balance coin icon |
| `pointer.png` | Wheel winner pointer (top) |
| `wheel-ring.png` | Decorative frame behind wheel (optional overlay) |
| `stage-bg.jpg` | Main stage background |
| `statue.png` | Left/right stage decorations |
| `bet-panel.png` | Bet card frame (optional; CSS fallback if missing) |

## Betting chips

| File | Value |
|------|-------|
| `chip-100.png` | 100 |
| `chip-1k.png` | 1,000 |
| `chip-10k.png` | 10,000 |
| `chip-100k.png` | 100,000 |

Recommended: **128×128 PNG**, circular poker chip.

## Manifest

Paths are listed in `manifest.json`. The game loads that file at startup — update it only if you add new asset keys.

After replacing files, hard-refresh the browser (`Ctrl+F5`).
