/**
 * Shared mobile viewport + shell CSS injected into play pages.
 */

export const MOBILE_SHELL_LINK = '<link rel="stylesheet" href="/shared/mobile-shell.css" />';

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
    out = out.replace('</head>', `${MOBILE_SHELL_LINK}\n${MOBILE_META}\n${platformScript}</head>`);
  } else if (platformScript) {
    out = out.replace('</head>', `${platformScript}</head>`);
  }
  return out;
}
