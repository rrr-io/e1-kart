// Anonymous usage stats, counted by the game's own server (no cookies, no third parties).
// Each event is a name and one detail: the server keeps only daily totals. See /stats.html.

export function track(name, dim) {
  try {
    const body = JSON.stringify({ name, dim: String(dim || '-') });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (e) { /* stats must never break the game */ }
}

// Where the visit comes from: ?utm_source=..., otherwise the app's built-in browser, otherwise the referring site.
function source() {
  try {
    const utm = new URLSearchParams(location.search).get('utm_source');
    if (utm) return utm;
  } catch (e) { /* old browser */ }
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/Twitter/i.test(ua)) return 'x';
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return 'tiktok';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/\bLine\//i.test(ua)) return 'line';
  if (/Weverse/i.test(ua)) return 'weverse';
  let host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { /* no referrer */ }
  if (!host || host === location.hostname) return 'direct';
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(host)) return 'x';
  if (/instagram\.com$/.test(host)) return 'instagram';
  if (/tiktok\.com$/.test(host)) return 'tiktok';
  if (/discord(app)?\.com$/.test(host)) return 'discord';
  if (/google\./.test(host)) return 'google';
  if (/weverse\.io$/.test(host)) return 'weverse';
  return host;
}

/** Once per browser session: the visit with its source, the device and how the game is opened. */
export function trackVisit() {
  try {
    if (sessionStorage.getItem('e1kart.visit')) return;
    sessionStorage.setItem('e1kart.visit', '1');
  } catch (e) { /* no storage: count anyway */ }
  const ua = navigator.userAgent || '';
  track('visit', source());
  track('device', /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop');
  const installed = (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || navigator.standalone;
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok|musical_ly|KAKAOTALK|\bLine\/|Weverse/i.test(ua);
  track('mode', installed ? 'installed' : inApp ? 'in-app' : 'browser');
  window.addEventListener('appinstalled', () => track('install', 'pwa'));
}
