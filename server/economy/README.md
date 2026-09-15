# Game economy (server-side)

All six live games share one economy model. **Outcomes and payouts are decided only on the server.** Clients send bets and display results — never trusted for wins.

## Games

| Slug | Type | Config |
|------|------|--------|
| `luck-77` | Lottery wheel | `game-economy.mjs` + `lucky77/config.mjs` |
| `greedy-feast` | Lottery wheel | `game-economy.mjs` + `greedy/config.mjs` |
| `dice-duel` | PvP prediction | `game-economy.mjs` + `dice-dual/config.mjs` |
| `goal-clash` | PvP prediction | `game-economy.mjs` + `football-clash/config.mjs` |
| `rocket-rush` | Crash | `game-economy.mjs` + `rocket/config.mjs` |
| `olympus-rise` | Slot | `game-economy.mjs` + `math-profile.mjs` |

## One place to tune RTP

**Primary file:** `server/economy/game-economy.mjs`

- `targetRtpPercent` — design target per game
- `POOL_RULES.minPoolForJackpot` — pool balance before big wins are allowed
- Per-game odds, multipliers, and high-outcome thresholds

**Operator overrides:** `server/config/operators.json` → `economy` block

- `houseEdgePercent` — your cut on every round (default 3%)
- `poolContributionPercent` — share of net losses that feed the prize pool (default 35%)
- `poolWinTriggerChance` — extra pool bonus win rate when base win was low

**Hard caps:** `server/economy/payout-limits.mjs`

## How the pool works

```
Player bets 1000
  → Wallet debited (operator HTTP / mock)
  → Round runs (server RNG)
  → If win 800: credit 800, recordRound(bet=1000, baseWin=800)
  → If lose: recordRound(bet=1000, baseWin=0)

recordRound:
  → houseTaken += bet × houseEdgePercent
  → poolBalance += (bet - win) × poolContributionPercent
```

**Jackpot rule:** High multipliers (e.g. Rocket 16×, Greedy 27×, Luck 77 eight×) are **blocked until `poolBalance >= minPoolForJackpot`**. Crash points are also capped so total round liability never exceeds `maxPoolPayoutRatio` of the pool.

Players can win and feel lucky, but big wins come from **prior player losses in the pool**, not from app currency.

## Security

| Rule | Module |
|------|--------|
| CSPRNG for money outcomes | `secure-rng.mjs` |
| Never expose future outcomes (e.g. crash point mid-flight) | game engines |
| Bet amount whitelist | `betting/bet-config.mjs` |
| Wallet debit before play, credit after server settlement | routes + wallet adapter |
| Audit log | `audit.mjs` |

## PvP / crash pool gating

**Dice Duel** and **Goal Clash** pick the round outcome on the server after betting closes. The engine:

1. Computes payout liability for each possible outcome (red/blue/draw or home/away/draw).
2. Removes outcomes the prize pool cannot afford.
3. Blocks **draw** (high multiplier) until `poolBalance >= minPoolForJackpot`.
4. If nothing is affordable, picks the **lowest-liability** outcome.

**Rocket Rush** caps the crash multiplier from the same pool rules (see `pool-guard.mjs`).

**Olympus Rise** uses `tightPool` mode when the jackpot pool is unfunded (no planted wins, no ultra multipliers) and `capWinByPool()` as a final payout clamp before wallet credit.

## Pool ledger files

Per operator + game: `data/pools/{operatorId}_{gameSlug}.json`

Inspect via internal stats helper `getPoolStats(operator, gameSlug)` in `prize-pool.mjs`.

## Tuning guide

1. Raise `targetRtpPercent` → increase base win rates / lower house edge (watch pool drain).
2. Raise `minPoolForJackpot` → big wins less frequent until more volume.
3. Raise `poolContributionPercent` → pool fills faster, more budget for jackpots.
4. Lower `houseEdgePercent` → players keep more, you earn less per bet.

Always simulate large samples after changes and confirm `poolBalance` never goes negative.

```bash
npm run simulate                  # 10,000 rounds × 1000 bet per game
npm run simulate -- --rounds=5000 --bet=500
```
