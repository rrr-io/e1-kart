// "Watch the MV" gate for tracks with `mv` (a YouTube video id) in theme.js: the official video plays in YouTube's own
// embedded player, the player starts it (no autoplay, so the play is theirs), and once its first minute has really
// played the track unlocks for the next RACES races. Seeking ahead doesn't count: only seconds that actually played do.
import { $ } from './engine.js';
import { track } from './stats.js';

const KEY = 'e1kart-mv';
export const RACES = 3;     // races unlocked by one watch
const NEED = 60;            // seconds of the video that have to play
let mem = 0;                // races left when localStorage isn't available (private mode)
const left = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && Number.isInteger(v.left) ? v.left : mem; } catch { return mem; } };
const setLeft = (n) => { mem = n; try { localStorage.setItem(KEY, JSON.stringify({ left: n })); } catch { /* kept in memory */ } };

/** Races left before the MV has to be watched again, on this device. */
export const mvRacesLeft = () => left();
export const mvUnlocked = () => left() > 0;
/** One race used (called when a race on the track starts). */
export const useMvRace = () => setLeft(Math.max(0, left() - 1));

let api = null;
function loadApi() {
  if (api) return api;
  api = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { api = null; reject(new Error('offline')); };
    document.head.appendChild(s);
  });
  return api;
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let player = null, timer = null;

function close() {
  clearInterval(timer); timer = null;
  if (player) { try { player.destroy(); } catch { /* already gone */ } player = null; }
  $('mvBox').hidden = true;
}

export function openMvGate(videoId, onUnlocked) {
  const box = $('mvBox'), info = $('mvInfo'), go = $('mvGo'), bar = $('mvBar');
  box.hidden = false;
  go.disabled = true;
  bar.style.width = '0%';
  info.textContent = 'Loading the video…';
  $('mvPlayer').replaceChildren(Object.assign(document.createElement('div'), { id: 'mvFrame' }));
  $('mvClose').onclick = close;
  go.onclick = () => { close(); onUnlocked(); };
  let watched = 0, last = null, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    setLeft(RACES);
    track('mv', 'unlock');
    bar.style.width = '100%';
    info.textContent = `Unlocked for ${RACES} races. Keep watching if you like!`;
    go.disabled = false;
  };
  loadApi().then((YT) => {
    if (box.hidden) return;
    player = new YT.Player('mvFrame', {
      videoId, width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => { info.textContent = `Press play and watch the first minute of the MV to unlock ${RACES} races.`; },
        onError: () => { info.textContent = 'The video could not be played here. Try again later.'; },
      },
    });
    timer = setInterval(() => {
      if (!player || !player.getPlayerState || done) return;
      const dur = player.getDuration() || 0, st = player.getPlayerState(), t = player.getCurrentTime();
      if (st === YT.PlayerState.PLAYING) {
        if (last !== null) { const d = t - last; if (d > 0 && d < 1.5) watched += d; }   // a jump is a seek: not counted
        last = t;
      } else last = null;
      if (dur > 0) {
        const need = Math.min(NEED, dur - 1);
        bar.style.width = Math.min(100, (watched / need) * 100) + '%';
        if (watched > 0 && !done) info.textContent = `Watched ${mmss(Math.min(watched, need))} of ${mmss(need)}`;
        if (watched >= need) finish();
      }
    }, 500);
  }).catch(() => { info.textContent = 'YouTube could not be reached. Check your connection and try again.'; });
}
