// Runs and certificates: "free play" flag, balance, certificate upload and starting a race.
import { $ } from './engine.js';
import { settings, saveSettings } from './config.js';
import { SPACE } from './theme.js';
import { G } from './state.js';
import * as api from './api.js';
import { setupRace } from './race.js';
import { toMenu, openRunBox, closeRunBox } from './menu.js';
import { openTrackBox, takeGoFlag } from './trackpick.js';

export const wallet = {
  online: false,          // the server has responded
  error: '',              // why the server couldn't be used, shown in the menu
  freePlayAllowed: true,  // the server allows playing without a certificate
  balance: null,          // runs available
  busy: false,
  checked: false,         // the first /config + /me answer (or failure) arrived
};

// NIGHT CIRCUIT is always free. INTERSTELLAR costs a run (one MAMA voting certificate = one run),
// unless the server allows free play and the player turned it on (testing).
export const isFreePlay = () => !SPACE || (wallet.online && wallet.freePlayAllowed && settings.freePlay);

function message(text, kind) {
  const el = $('certMsg');
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

const fmtVoteDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]} (KST)` : '';
};

export function renderAccount() {
  const free = isFreePlay();
  $('freeRow').hidden = !SPACE || !wallet.online || !wallet.freePlayAllowed;
  $('free').replaceChildren(...[[true, 'ON'], [false, 'OFF']].map(([v, l]) => {
    const b = document.createElement('button');
    b.className = 'chipbtn';
    b.id = 'free' + l;
    b.textContent = l;
    b.setAttribute('aria-pressed', String(v === settings.freePlay));
    b.onclick = () => { settings.freePlay = v; saveSettings(); message(''); renderAccount(); };
    return b;
  }));
  $('certBox').hidden = free;
  $('runs').textContent = wallet.balance == null ? '–' : String(wallet.balance);
  $('uploadBtn').classList.toggle('busy', wallet.busy);
  $('start').disabled = wallet.busy;
  $('runGo').disabled = wallet.busy || !wallet.online || wallet.balance === 0;
  // Offline warning (cleared once the server answers; before the first answer we don't know yet).
  const off = wallet.checked && !wallet.online && SPACE;
  if (off) message((wallet.error || 'Server unreachable') + ' — the Interstellar track needs a certificate run: play the Night Circuit for now.', 'err');
  else if ($('certMsg').dataset.offline) message('');
  $('certMsg').dataset.offline = off ? '1' : '';
}

export async function initAccount() {
  try {
    const cfg = await api.getConfig();
    wallet.online = true;
    wallet.freePlayAllowed = !!cfg.freePlayAllowed;
    const me = await api.getMe();
    wallet.balance = me.balance;
  } catch (e) {
    wallet.online = false;
    // Say what actually failed: no network, or the server answered with an error.
    wallet.error = e.code === 'OFFLINE'
      ? 'Server unreachable' + (e.detail ? ' (' + e.detail + ')' : '')
      : 'Server error' + (e.status ? ' ' + e.status : '') + ': ' + e.message;
  }
  wallet.checked = true;
  renderAccount();
}

async function onCertificate(file) {
  if (!file || wallet.busy) return;
  wallet.busy = true;
  message('Reading the certificate…');
  renderAccount();
  try {
    const r = await api.uploadCertificate(file);
    wallet.balance = r.balance;
    message(`+${r.runsAdded} run${r.runsAdded === 1 ? '' : 's'}! Vote from ${fmtVoteDate(r.participationAt)}.`, 'ok');
  } catch (e) {
    message(e.message, 'err');
  } finally {
    wallet.busy = false;
    renderAccount();
  }
}

/** Menu START: choose the track, then free tracks start right away and the certificate track opens the entry ticket. */
export function menuStart() {
  openTrackBox(afterTrack);
}
function afterTrack() {
  if (isFreePlay()) startGame();
  else { renderAccount(); openRunBox(); }
}
/** Called once at startup: if the page was reloaded to switch track, carry on to the race / entry ticket. */
export function resumeTrackChoice() {
  if (takeGoFlag()) afterTrack();
}

/** RACE (entry ticket) and PLAY AGAIN: in certificate mode, asks the server to consume a run before starting. */
export async function startGame() {
  if (isFreePlay()) {
    G.runId = null;
    setupRace();
    return;
  }
  if (wallet.busy) return;
  wallet.busy = true;
  renderAccount();
  try {
    const r = await api.startRun(settings.teamIdx);
    G.runId = r.runId;
    wallet.balance = r.balance;
    message('');
    closeRunBox();
    setupRace();
  } catch (e) {
    if (!$('results').hidden) toMenu();
    openRunBox();
    message(e.message, 'err');
    if (e.code === 'NO_RUNS') wallet.balance = 0;
  } finally {
    wallet.busy = false;
    renderAccount();
  }
}

/**
 * Reports the time and position of the race just finished (only for races paid for with a run: Interstellar,
 * the races that count for the E1 Kart GP leaderboard), then offers the leaderboard on the results.
 */
export function reportFinish(timeSeconds, position) {
  $('resBoard').hidden = true;
  if (!G.runId) return;
  const id = G.runId;
  G.runId = null;
  api.finishRun(id, Math.round(timeSeconds * 1000), position)
    .then(() => { $('resBoard').hidden = false; })
    .catch(() => { /* non-blocking */ });
}

export function runsLeftText() {
  return isFreePlay() || wallet.balance == null ? '' : `Runs left: ${wallet.balance}`;
}

export function initAccountUi() {
  const input = $('certFile');
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    onCertificate(f);
  });
}
