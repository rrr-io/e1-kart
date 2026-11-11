// After an Interstellar or Bloody Paradise race the player is sent to the video on Mnet Plus: every view counts.
// The link opens the Mnet Plus app when it's installed (OneLink), the website otherwise.
import { track } from './stats.js';

export const MNET_URL = 'https://mnetplus.onelink.me/TRa8/eftibvb4?custom_link_value=play%2Fvideo%2F6ae06ea55ab4a1852d3c5058';

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
