/**
 * Layout modes for games-mobile in host apps:
 *   ?host=riko     — Riko room bottom sheet (keep embed scalers, strip duplicate chrome)
 *   ?standalone=1  — dedicated full-screen WebView page
 */
(function initShellLayout() {
  const params = new URLSearchParams(location.search);
  const hostEmbed = params.get('host') === 'riko' || params.get('embed') === 'host';
  const standalone = params.get('standalone') === '1';
  if (!hostEmbed && !standalone) return;

  if (hostEmbed) document.documentElement.dataset.gmHostEmbed = '1';
  if (standalone) document.documentElement.dataset.gmStandalone = '1';

  function applyLayout() {
    if (hostEmbed) {
      // Flutter shows the room above — only remove in-page backdrop/handle.
      // Keep gm-shell--embed so Greedy/Rocket embed scalers still run.
      document.querySelectorAll('.gm-backdrop').forEach((el) => el.remove());
      document.querySelectorAll('.gm-handle').forEach((el) => {
        el.style.display = 'none';
      });
      return;
    }

    document.querySelectorAll('.gm-shell--embed').forEach((el) => {
      el.classList.remove('gm-shell--embed');
      el.classList.add('gm-shell--standalone');
    });
    document.querySelectorAll('.gm-backdrop').forEach((el) => el.remove());
    document.querySelectorAll('.gm-handle').forEach((el) => {
      el.style.display = 'none';
    });
  }

  const observer = new MutationObserver(() => applyLayout());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  applyLayout();

  document.addEventListener('DOMContentLoaded', () => {
    applyLayout();
    observer.disconnect();
  });
})();
