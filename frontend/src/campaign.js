// Time-limited push for ENHYPEN's "Bloody Paradise" in MAMA's FAVORITE MCD STAGE vote. Until UNTIL every driver adds
// these lines after their end-of-race dialogue, on every track, with VOTE and WATCH links under the last one. After it
// it all disappears by itself.
import { track } from './stats.js';
import { MNET_URL } from './mnet.js';
import { mcdOn } from './theme.js';
export { mcdOn };   // the deadline lives in theme.js: Bloody Paradise's own vote/watch parts follow it too

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

// Until the end of the MAMA AWARDS live voting (Nov 20, KST) every driver adds these lines after their end-of-race
// dialogue, on every track, with YOUTUBE and SPOTIFY links for "I Want You" under the last one. After it they
// disappear by themselves.
export const LIVE_UNTIL = Date.parse('2026-11-21T00:00:00+09:00');
export const liveOn = () => Date.now() < LIVE_UNTIL;
export const LIVE_LINES = [
  'Next stop: Nov 20, 18:00 KST. MAMA AWARDS live voting on Mnet Plus. Full throttle for ENHYPEN!',
  'Warm-up laps: stream "I Want You" on YouTube and Spotify!',
];
export const IWY_YOUTUBE = 'https://www.youtube.com/watch?v=dE_Ro8Sac2M';
export const IWY_SPOTIFY = 'https://open.spotify.com/track/2I0KhdsSLmv9Px8vfumOdn';

/** Turns the links box under the driver's last line into YOUTUBE and SPOTIFY links for "I Want You". */
export function wireLiveLinks(el, trackId) {
  const [yt, sp] = el.querySelectorAll('a');
  yt.href = IWY_YOUTUBE; yt.textContent = 'YOUTUBE ▶';
  sp.href = IWY_SPOTIFY; sp.textContent = 'SPOTIFY ▶'; sp.hidden = false;
  yt.onclick = () => track('stream', 'youtube:' + trackId);
  sp.onclick = () => track('stream', 'spotify:' + trackId);
}

// After the MAMA AWARDS (ENHYPEN won a Daesang) the drivers thank the ENGENEs and ask to stream the new album
// "THE SIN : PARALLEL WORLD", one line each after their end-of-race dialogue, with a Spotify link under it.
// Set ALBUM_ON to false to stop it.
const ALBUM_ON = true;
export const albumOn = () => ALBUM_ON && !liveOn() && !mcdOn();
export const ALBUM_NAME = 'THE SIN : PARALLEL WORLD';
export const ALBUM_SPOTIFY = 'https://open.spotify.com/album/2Gv2qKwrKxUZ025POfeOmT';
// In TEAMS order: Jay, Jake, Sunghoon, Sunoo, Jungwon, Ni-ki.
export const ALBUM_LINES = [
  'Data check: one Daesang, one new album. Streaming it now is the logical next lap.',
  'We won, Engenes! No pressure, but THE SIN : PARALLEL WORLD sounds great on repeat 😎',
  "Thank you for the Daesang. Now go listen to the album. That's all.",
  'A Daesang AND a new album?! Put it on and dance with me! 💖',
  "We did it together. Next mission: stream the album, team. I'm counting on you.",
  "We won. New album's out. You know what to do.",
];

/** Opens the album on Spotify (the app when it's installed). Must run inside a tap. */
export function openAlbum(where) {
  track('stream', 'album:' + where);
  try {
    window.open(ALBUM_SPOTIFY, '_blank', 'noopener');
  } catch (e) { /* nothing to do */ }
}

/** Turns the links box under the driver's last line into a single Spotify link to the album. */
export function wireAlbumLinks(el, trackId) {
  const [sp, other] = el.querySelectorAll('a');
  sp.href = ALBUM_SPOTIFY; sp.textContent = 'STREAM ON SPOTIFY ▶';
  sp.onclick = () => track('stream', 'album-dlg:' + trackId);
  other.hidden = true;
}
