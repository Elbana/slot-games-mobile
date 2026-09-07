/**
 * Platform home / game launcher.
 */

import { requireOperator, isGameEnabled } from '../auth/operator-auth.mjs';
import { extractPlayerId } from '../auth/player-context.mjs';
import { listGames } from '../registry/games.mjs';

/** @type {Record<string, { tagline: string, badge: string, theme: string, icon: string }>} */
const DISPLAY = {
  'rise-of-olympus': {
    tagline: 'Cluster pays, god multipliers & free spins',
    badge: 'Video Slot',
    theme: 'olympus',
    icon: '⚡',
  },
  greedy: {
    tagline: 'Bet on the food wheel — 30s live rounds',
    badge: 'Lottery',
    theme: 'greedy',
    icon: '🍕',
  },
  'pets-beasts': {
    tagline: 'Pets vs beasts — spin the animal wheel',
    badge: 'Lottery',
    theme: 'pets',
    icon: '🦁',
  },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderGameCard(game, token, player) {
  const meta = DISPLAY[game.slug] ?? {
    tagline: game.type === 'slot' ? 'Video slot game' : 'Live lottery game',
    badge: game.type === 'slot' ? 'Slot' : 'Lottery',
    theme: 'default',
    icon: '🎮',
  };
  const href = `${game.playPath}?token=${encodeURIComponent(token)}&player=${encodeURIComponent(player)}`;
  return `
    <a class="game-card game-card--${meta.theme}" href="${escapeHtml(href)}">
      <div class="game-card__glow" aria-hidden="true"></div>
      <div class="game-card__icon">${meta.icon}</div>
      <div class="game-card__body">
        <span class="game-card__badge">${escapeHtml(meta.badge)}</span>
        <h2 class="game-card__title">${escapeHtml(game.name)}</h2>
        <p class="game-card__tagline">${escapeHtml(meta.tagline)}</p>
      </div>
      <span class="game-card__play">Play →</span>
    </a>`;
}

export function handleGetLauncher(req, res) {
  const q = { ...req.query, ...req.body };
  const token = q.token || 'op_demo_all';
  const player = q.player || extractPlayerId(req);

  const operator = requireOperator({ ...req, query: { ...req.query, token }, body: req.body }, res);
  if (!operator) return;

  const games = listGames().filter((g) => isGameEnabled(operator, g.slug));
  const cards = games.map((g) => renderGameCard(g, token, player)).join('\n');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#070b1a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>Games Mobile</title>
  <link rel="stylesheet" href="/shared/mobile-shell.css" />
  <link rel="stylesheet" href="/launcher/launcher.css" />
</head>
<body>
  <div class="gm-shell gm-shell--launcher">
  <div class="launcher">
    <header class="launcher__header">
      <div class="launcher__brand">
        <span class="launcher__logo" aria-hidden="true">◆</span>
        <div>
          <p class="launcher__eyebrow">Mobile game platform</p>
          <h1 class="launcher__title">Games Mobile</h1>
        </div>
      </div>
      <p class="launcher__subtitle">Pick a title to launch in WebView. Access is controlled by your operator token.</p>
    </header>

    <section class="launcher__panel" aria-label="Session">
      <form class="session-form" id="session-form" method="get" action="/">
        <label class="field">
          <span class="field__label">Operator token</span>
          <input class="field__input" name="token" type="text" value="${escapeHtml(token)}" autocomplete="off" spellcheck="false" />
        </label>
        <label class="field">
          <span class="field__label">Player ID</span>
          <input class="field__input" name="player" type="text" value="${escapeHtml(player)}" autocomplete="off" />
        </label>
        <button class="btn btn--ghost" type="submit">Apply token</button>
      </form>
      <div class="session-meta">
        <span class="pill pill--ok">${escapeHtml(operator.name)}</span>
        <span class="pill">${games.length} game${games.length === 1 ? '' : 's'} enabled</span>
      </div>
    </section>

    <section class="launcher__games" aria-label="Games">
      <h2 class="section-title">Available games</h2>
      <div class="game-grid">
        ${cards || '<p class="empty">No games enabled for this operator token.</p>'}
      </div>
    </section>

    <footer class="launcher__footer">
      <p>API catalog: <code>GET /api/v1/games?token=…</code></p>
      <p class="muted">Demo tokens: <code>op_demo_all</code> · <code>op_lottery_only</code> · <code>op_slots_only</code></p>
    </footer>
  </div>
  </div>
  <script src="/launcher/launcher.js"></script>
</body>
</html>`);
}
