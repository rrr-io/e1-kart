// After an Interstellar or Bloody Paradise race the player is sent to the video on Mnet Plus: every view counts.
// The link opens the Mnet Plus app when it's installed (OneLink), the website otherwise.
import { track } from './stats.js';

// The Mnet Plus app on the App Store (iPhone, iPad) or Google Play (everything else): the live voting happens there.
export const MNET_APP_IOS = 'https://apps.apple.com/app/mnet-plus/id6443405421';
export const MNET_APP_ANDROID = 'https://play.google.com/store/apps/details?id=world.mnetplus';
const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Opens the app's page on the store. Must run inside a tap. */
export function openMnetApp(where) {
  track('mnet', 'app:' + where);
  try {
    window.open(isIos() ? MNET_APP_IOS : MNET_APP_ANDROID, '_blank', 'noopener');
  } catch (e) { /* nothing to do */ }
}

export const MNET_URL = 'https://mnetplus.onelink.me/TRa8/eftibvb4?custom_link_value=play%2Fvideo%2F6ae06ea55ab4a1852d3c5058%3Fsi%3DoMH%252F4DTADfhGs2eVevb8ZQPuA0CIoUZ3cAB%252BUF6KRTyIG9SVAg%253D%253D';

/**
 * Opens the video in a new tab or the app. Must run inside a tap or key handler, or the browser blocks it.
 * how: 'auto' (closing the end-of-race dialogue) or 'button' (WATCH ON MNET PLUS on the results).
 */
export function openMnet(how, trackId) {
  track('mnet', how + ':' + trackId);
  try {
    return !!window.open(MNET_URL, '_blank', 'noopener');
  } catch (e) {
    return false;
  }
}
