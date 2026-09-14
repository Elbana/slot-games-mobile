/**
 * Shared mobile viewport + shell CSS injected into play pages.
 */

export const MOBILE_SHELL_LINK = '<link rel="stylesheet" href="/shared/mobile-shell.css" />';
export const HOST_BRIDGE_SCRIPT = '<script src="/shared/host-bridge.js"></script>';
export const REALTIME_SCRIPT = '<script src="/shared/realtime-client.js"></script>';

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
  if (!out.includes('mobile-shell.css')) {
    out = out.replace('</head>', `${MOBILE_SHELL_LINK}\n${MOBILE_META}\n${HOST_BRIDGE_SCRIPT}\n${REALTIME_SCRIPT}\n${platformScript}</head>`);
  } else if (platformScript) {
    out = out.replace('</head>', `${HOST_BRIDGE_SCRIPT}\n${REALTIME_SCRIPT}\n${platformScript}</head>`);
  }
  return out;
}
