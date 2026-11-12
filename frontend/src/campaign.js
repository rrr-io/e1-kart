// Time-limited push for ENHYPEN's "Bloody Paradise" in MAMA's FAVORITE MCD STAGE vote. Until UNTIL every driver adds
// these lines after their end-of-race dialogue, on every track, with VOTE and WATCH links under the box. After UNTIL
// it all disappears by itself.
import { track } from './stats.js';
import { MNET_URL } from './mnet.js';

const UNTIL = Date.UTC(2026, 10, 13, 6, 59);   // 13 November 2026, 15:59 KST (UTC+9)
export const mcdOn = () => Date.now() < UNTIL;

export const MCD_VOTE = 'https://mnetplus.onelink.me/TRa8/xd22hep2?custom_link_value=vote%2Ftemplates%2Fmama-favorite-mcd-stage%2F6ae064af0c8a27ff60ed92b6%3Furl_fallback_type%3Dupdate';
export const MCD_WATCH = MNET_URL;

export const MCD_LINES = [
  "Vote ENHYPEN's Bloody Paradise for FAVORITE MCD STAGE!",
  'And stream it on Mnet Plus. Turn on loop ↻ so it plays again and again!',
];

/** Fills the VOTE and WATCH links of a container and counts the taps. */
export function wireMcdLinks(el, trackId) {
  const [vote, watch] = el.querySelectorAll('a');
  vote.href = MCD_VOTE;
  watch.href = MCD_WATCH;
  vote.onclick = () => track('mnet', 'mcd-vote:' + trackId);
  watch.onclick = () => track('mnet', 'mcd-watch:' + trackId);
}
