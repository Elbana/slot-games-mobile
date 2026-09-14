# Flutter WebView integration

Your Flutter app already manages user balance. Embed games in a WebView and sync balance when the host bridge fires events.

## Game catalog (original names — license-safe)

| Slug | Display name | WebView path |
|------|--------------|--------------|
| `throne-rush` | Throne Rush | `/play/throne-rush` |
| `feast-spin` | Feast Spin | `/play/feast-spin` |
| `triple-harvest` | Triple Harvest | `/play/triple-harvest` |
| `dice-arena` | Dice Arena | `/play/dice-arena` |
| `goal-showdown` | Goal Showdown | `/play/goal-showdown` |
| `sky-streak` | Sky Streak | `/play/sky-streak` |

## Recommended launch flow

1. Your backend calls the game platform (or builds URL locally after fetching a signed token).
2. Open WebView with the **launch URL** (preferred) or `token` + `player` query params (dev).

### Signed launch URL (production)

```
GET /api/v1/launch?token=YOUR_OPERATOR_TOKEN&player=USER_ID&game=sky-streak
```

Response:

```json
{
  "game": "sky-streak",
  "name": "Sky Streak",
  "launchUrl": "https://games.example.com/play/sky-streak?launch=eyJ...",
  "expiresAt": "2026-09-15T02:00:00.000Z",
  "playerId": "USER_ID"
}
```

Load `launchUrl` in WebView. Token expires in 1 hour.

### Dev / direct URL

```
https://games.example.com/play/sky-streak?token=op_demo_all&player=USER_ID
```

## Flutter WebView (minimal)

```dart
import 'dart:convert';
import 'package:webview_flutter/webview_flutter.dart';

class GameWebView extends StatefulWidget {
  const GameWebView({required this.launchUrl, required this.onWalletEvent});
  final String launchUrl;
  final void Function(Map<String, dynamic> event) onWalletEvent;

  @override
  State<GameWebView> createState() => _GameWebViewState();
}

class _GameWebViewState extends State<GameWebView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'GMHost',
        onMessageReceived: (msg) {
          final event = jsonDecode(msg.message) as Map<String, dynamic>;
          widget.onWalletEvent(event);
          // Refresh balance from YOUR wallet API when type is bet|win|loss|balance
        },
      )
      ..loadRequest(Uri.parse(widget.launchUrl));
  }

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
```

## Host bridge events

Games post JSON to `GMHost` channel:

```json
{
  "source": "games-mobile",
  "type": "bet",
  "game": "sky-streak",
  "amount": 5000,
  "balance": 995000,
  "delta": -5000,
  "ts": 1726358400123
}
```

Types: `bet`, `win`, `loss`, `balance`

When you receive an event, refresh the user's balance from **your** backend (source of truth).

## Production wallet (your backend)

Configure operator in `server/config/operators.json`:

```json
"wallet": {
  "mode": "http",
  "baseUrl": "https://api.yourapp.com/games-wallet",
  "apiKey": "YOUR_SERVER_KEY"
}
```

Game server calls your API on every bet/win:

- `GET /players/:playerId/balance`
- `POST /transactions/debit`
- `POST /transactions/credit`
- `POST /transactions/rollback`

See [MOBILE-WEBVIEW.md](./MOBILE-WEBVIEW.md) for request bodies.

## Environment

```env
NODE_ENV=production
REQUIRE_AUTH=1
WALLET_MOCK=0
LAUNCH_SECRET=long-random-secret
CORS_ORIGINS=https://your-app.com
```

## Notes

- Pass a stable `player` ID from your auth system (user UUID).
- Top-up / purchase stays in Flutter — in-game "+" buttons are demo-only.
- Games use half-screen embed UI — show your app chrome above the WebView.
