/**
 * Notify native host app (Flutter WebView) about wallet / game events.
 * Flutter: JavascriptChannel name "GMHost" or flutter_inappwebview callHandler('GMHost', message).
 */
(function initGmHostBridge() {
  function notifyHost(event) {
    const payload = JSON.stringify({
      source: 'games-mobile',
      ts: Date.now(),
      ...event,
    });

    try {
      if (window.GMHost?.postMessage) {
        window.GMHost.postMessage(payload);
        return;
      }
    } catch {
      /* ignore */
    }

    try {
      if (window.flutter_inappwebview?.callHandler) {
        window.flutter_inappwebview.callHandler('GMHost', payload);
        return;
      }
    } catch {
      /* ignore */
    }

    try {
      window.parent?.postMessage(payload, '*');
    } catch {
      /* ignore */
    }
  }

  window.gmNotifyHost = notifyHost;
  window.gmNotifyWallet = function gmNotifyWallet(type, detail) {
    notifyHost({ type, ...detail });
  };
})();
