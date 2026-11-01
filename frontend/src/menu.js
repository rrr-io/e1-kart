// Main menu: team selection, pixelation and steering assist.
import { $ } from './engine.js';
import { TEAMS, settings, saveSettings } from './config.js';
import { N, off, yawAt } from './track.js';
import { paintKart } from './kart.js';
import { G } from './state.js';
import { renderAccount } from './account.js';
import { showTeamIntro, hideRadio, applyTeam } from './dialogue.js';
import { resetItems } from './items.js';

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
    const sw = document.createElement('i');
    sw.style.background = t.color;
    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = t.name;
    const btn = chip('team', 'team' + k, [sw, name], k === settings.teamIdx, () => {
      settings.teamIdx = k;
      saveSettings();
      buildMenu();
      paintKart(G.karts[0], TEAMS[k].color);
    });
    btn.style.setProperty('--tc', t.color);
    return btn;
  }));
  applyTeam($('game'), settings.teamIdx);
  $('ast').replaceChildren(...[[true, 'ON'], [false, 'OFF']].map(([v, l]) => chip('chipbtn', 'ast' + l, l, v === settings.assist, () => {
    settings.assist = v;
    saveSettings();
    buildMenu();
  })));
  showTeamIntro(settings.teamIdx);
  renderAccount();
}

export function toMenu() {
  G.state = 'menu';
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
