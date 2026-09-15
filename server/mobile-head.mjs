/**
 * Shared mobile viewport + shell CSS injected into play pages.
 */

export const MOBILE_SHELL_LINK = '<link rel="stylesheet" href="/shared/mobile-shell.css" />';
export const HOST_BRIDGE_SCRIPT = '<script src="/shared/host-bridge.js"></script>';
export const REALTIME_SCRIPT = '<script src="/shared/realtime-client.js"></script>';
export const STANDALONE_SCRIPT = '<script src="/shared/standalone-mode.js"></script>';

/** Runs synchronously in <head> before paint — host / standalone layout. */
export const STANDALONE_BOOT = `<script>
(function(){
  var p=new URLSearchParams(location.search);
  if(p.get('host')==='riko'||p.get('embed')==='host')document.documentElement.dataset.gmHostEmbed='1';
  if(p.get('standalone')==='1')document.documentElement.dataset.gmStandalone='1';
})();
</script>`;

export const MOBILE_META = `
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#0a1028" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
`.trim();

/** @param {string} html @param {string} [platformScript] */
export function injectMobilePlayHead(html, platformScript = '') {
  let out = html.replace(/<meta\s+name="viewport"[\s\S]*?\/>/gi, '');

  const parts = [];
  if (!out.includes('mobile-shell.css')) parts.push(MOBILE_SHELL_LINK);
  if (!out.includes('name="viewport"')) parts.push(MOBILE_META);
  parts.push(STANDALONE_BOOT);
  if (!out.includes('standalone-mode.js')) parts.push(STANDALONE_SCRIPT);
  if (!out.includes('host-bridge.js')) parts.push(HOST_BRIDGE_SCRIPT);
  if (!out.includes('realtime-client.js')) parts.push(REALTIME_SCRIPT);
  if (platformScript) parts.push(platformScript);

  if (parts.length) {
    out = out.replace('</head>', `${parts.join('\n')}\n</head>`);
  }
  return out;
}
