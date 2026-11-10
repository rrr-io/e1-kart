// Main menu: team selection, pixelation and steering assist.
import { $ } from './engine.js';
import { TEAMS, settings, saveSettings } from './config.js';
import { N, off, yawAt } from './track.js';
import { paintKart } from './kart.js';
import { G } from './state.js';
import { renderAccount } from './account.js';
import { showTeamIntro, hideRadio, applyTeam, nameOf } from './dialogue.js';
import { resetItems } from './items.js';
import { closeTrackBox } from './trackpick.js';
import { wantMusic, setTempo, setSound } from './audio.js';
import { renderStandings } from './standings.js';

$('logoE1').src = new URL('./assets/brand/e1-logo-pixel.png', import.meta.url).href;
$('logoE1sm').src = new URL('./assets/brand/e1-logo-pixel-sm.png', import.meta.url).href;

// Options panel (assist, free play, how to play, credits) and the "What is E1?" panel:
// two buttons top right, one panel open at a time.
function setPanel(id, open) {
  $(id + 'Panel').hidden = !open;
  $(id + 'Btn').setAttribute('aria-expanded', String(open));
}
function setOptions(open) {
  setPanel('opt', open);
  setPanel('e1', false); // closing the options (START, back to menu) closes "What is E1?" too
}
function setE1(open) {
  setPanel('e1', open);
  if (open) { setPanel('opt', false); loadStandings(); }
}

// E1 Kart GP leaderboard inside "What is E1?": hidden when the server can't be reached.
function loadStandings() {
  renderStandings($('e1StandList')).then((ok) => { if (ok) $('e1Stand').hidden = false; });
}
$('optBtn').onclick = () => setOptions($('optPanel').hidden);
$('optClose').onclick = () => setOptions(false);
$('e1Btn').onclick = () => setE1($('e1Panel').hidden);
$('e1Close').onclick = () => setE1(false);

// Entry ticket: in certificate mode START opens this box (runs, upload, RACE) after the team is chosen.
export function openRunBox() {
  setOptions(false);
  $('runTeam').textContent = TEAMS[settings.teamIdx].name;
  $('runDriver').textContent = nameOf(settings.teamIdx);
  $('runBox').hidden = false;
  $('runGo').focus();
}
export function closeRunBox() {
  $('runBox').hidden = true;
}
$('runClose').onclick = closeRunBox;
$('runBack').onclick = closeRunBox;

function chip(cls, id, label, pressed, onClick) {
  const b = document.createElement('button');
  b.className = cls;
  b.id = id;
  b.setAttribute('aria-pressed', String(pressed));
  if (typeof label === 'string') b.textContent = label; else b.append(...label);
  b.onclick = onClick;
  return b;
}

export function buildMenu() {
  $('teams').replaceChildren(...TEAMS.map((t, k) => {
    const no = document.createElement('i');
    no.className = 'no';
    no.textContent = String(k + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = t.name;
    const drv = document.createElement('span');
    drv.className = 'drv';
    drv.textContent = nameOf(k);
    const btn = chip('team', 'team' + k, [no, name, drv], k === settings.teamIdx, () => {
      settings.teamIdx = k;
      saveSettings();
      buildMenu();
      paintKart(G.karts[0], TEAMS[k].color);
    });
    btn.style.setProperty('--tc', t.color);
    return btn;
  }));
  applyTeam($('game'), settings.teamIdx);
  $('heroNo').textContent = String(settings.teamIdx + 1).padStart(2, '0');
  $('heroTeam').textContent = TEAMS[settings.teamIdx].name;
  $('ast').replaceChildren(...[[true, 'ON'], [false, 'OFF']].map(([v, l]) => chip('chipbtn', 'ast' + l, l, v === settings.assist, () => {
    settings.assist = v;
    saveSettings();
    buildMenu();
  })));
  $('snd').replaceChildren(...[[true, 'ON'], [false, 'OFF']].map(([v, l]) => chip('chipbtn', 'snd' + l, l, v === settings.sound, () => {
    setSound(v);
    buildMenu();
  })));
  showTeamIntro(settings.teamIdx);
  renderAccount();
}

export function toMenu() {
  G.state = 'menu';
  setTempo(1);
  wantMusic('menu');
  setOptions(false);
  closeRunBox();
  closeTrackBox();
  $('menu').hidden = false;
  $('results').hidden = true;
  $('hud').hidden = true;
  $('controls').hidden = true;
  hideRadio();
  resetItems();

  // The player's kart stopped near the finish line, the others in grid behind it.
  const k = G.karts[0];
  const o = off(4, 0);
  paintKart(k, TEAMS[settings.teamIdx].color);
  k.root.position.set(o[0], 0, o[1]);
  k.root.rotation.y = yawAt(4);
  k.body.rotation.set(0, 0, 0);
  const others = [...TEAMS.keys()].filter((x) => x !== settings.teamIdx);
  G.karts.slice(1).forEach((kk, n) => {
    const ii = (N - 7 - n * 4) % N, oo = off(ii, n % 2 ? -3 : 3);
    kk.root.position.set(oo[0], 0, oo[1]);
    kk.root.rotation.y = yawAt(ii);
    paintKart(kk, TEAMS[others[n]].color);
  });
  buildMenu();
}
