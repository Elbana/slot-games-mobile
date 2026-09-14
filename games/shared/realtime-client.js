/**
 * Subscribe to shared round updates (SSE). Games call gmOnRealtimeState when phase changes.
 */
(function initGmRealtime() {
  const slug = (location.pathname.match(/\/play\/([^/?#]+)/) || [])[1];
  if (!slug || slug === 'bet-advisor') return;

  const params = new URLSearchParams(location.search);
  const token = params.get('token') || window.__PLATFORM__?.token || '';
  const player = params.get('player') || window.__PLATFORM__?.player || '';
  const qs = new URLSearchParams({ token, player });

  let es;
  function connect() {
    es = new EventSource(`/api/v1/realtime/${slug}/events?${qs}`);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        window.__GM_REALTIME__ = payload.state;
        window.dispatchEvent(new CustomEvent('gm-realtime', { detail: payload.state }));
        window.gmOnRealtimeState?.(payload.state);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es.close();
      setTimeout(connect, 2000);
    };
  }

  connect();
})();
