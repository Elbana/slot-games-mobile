/**
 * Avoid flashing "0" before wallet balance loads in WebView embeds.
 */
(function initGmBalanceHud() {
  let lastBalance = null;

  function node() {
    return document.getElementById('balance');
  }

  function formatDefault(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toLocaleString();
  }

  window.gmBalancePending = function gmBalancePending() {
    const el = node();
    if (!el) return;
    el.classList.add('gm-balance--pending');
    el.textContent = '…';
    el.setAttribute('aria-busy', 'true');
  };

  window.gmSetBalance = function gmSetBalance(value, formatter) {
    const el = node();
    if (!el || value == null) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    lastBalance = n;
    el.classList.remove('gm-balance--pending');
    el.removeAttribute('aria-busy');
    el.textContent = typeof formatter === 'function' ? formatter(n) : formatDefault(n);
  };

  window.gmGetBalance = function gmGetBalance() {
    if (Number.isFinite(lastBalance)) return lastBalance;
    const el = node();
    if (!el) return null;
    const text = el.textContent?.trim();
    if (!text || text === '…') return null;
    const n = Number(String(text).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  function boot() {
    const el = node();
    if (!el) return;
    const text = el.textContent?.trim();
    if (text === '0' || text === '') gmBalancePending();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
