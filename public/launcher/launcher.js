(function () {
  const form = document.getElementById('session-form');
  if (!form) return;

  const tokenInput = form.querySelector('[name="token"]');
  const playerInput = form.querySelector('[name="player"]');

  try {
    const saved = JSON.parse(localStorage.getItem('gm-launcher') || '{}');
    if (saved.token && tokenInput && !new URLSearchParams(location.search).has('token')) {
      tokenInput.value = saved.token;
    }
    if (saved.player && playerInput && !new URLSearchParams(location.search).has('player')) {
      playerInput.value = saved.player;
    }
  } catch {
    /* ignore */
  }

  form.addEventListener('submit', () => {
    try {
      localStorage.setItem(
        'gm-launcher',
        JSON.stringify({
          token: tokenInput?.value?.trim() || '',
          player: playerInput?.value?.trim() || '',
        })
      );
    } catch {
      /* ignore */
    }
  });
})();
