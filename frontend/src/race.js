// Starting grid and lights.
import { $ } from './engine.js';
import { TEAMS, settings } from './config.js';
import { N, off, yawAt } from './track.js';
import { startLights, resetBoxes, crowdCheers } from './scenery.js';
import { paintKart } from './kart.js';
import { G, player } from './state.js';
import { updateCpus } from './ai.js';
import { placePlayer } from './physics.js';
import { banner } from './hud.js';
import { talk } from './dialogue.js';
import { resetItems } from './items.js';
import { wantMusic, prepareMusic, fadeOutMusic, setTempo, sfx } from './audio.js';

const FADE = 0.7; // seconds of menu-music fade between the dialogue and the countdown
import { TRACK_ID } from './theme.js';
import { track } from './stats.js';

const COUNTDOWN = 3.6;
const PLAYER_SLOT = 3;

export function setupRace() {
  track('race_start', TRACK_ID + ':' + TEAMS[settings.teamIdx].name.split(' ')[0]);
  const others = [...TEAMS.keys()].filter((k) => k !== settings.teamIdx);
  G.cpus = [];
  let ck = 0;
  for (let slot = 0; slot < TEAMS.length; slot++) {
    const idx = (N - 4 - slot * 3 + N) % N, lat = slot % 2 ? -3.2 : 3.2;
    if (slot === PLAYER_SLOT) {
      const o = off(idx, lat);
      Object.assign(player, {
        x: o[0], z: o[1], h: yawAt(idx), v: 0, idx, prevIdx: undefined, laps: -1, half: true,
        drifting: false, dT: 0, boost: 0, item: null, hop: 0, steerS: 0, finish: null, team: settings.teamIdx,
        slip: 0, bats: 0, ghost: 0, spun: false,
      });
      player.kart = G.karts[0];
      paintKart(G.karts[0], TEAMS[settings.teamIdx].color);
    } else {
      const t = others[ck], kart = G.karts[ck + 1];
      paintKart(kart, TEAMS[t].color);
      G.cpus.push({
        kart, team: t, prog: idx - N, lat, latT: lat,
        spd: 40 + ck * 0.9 + Math.random() * 1.1, band: 0, boost: 0,
        item: null, slip: 0, bats: 0, ghost: 0, pickCd: 0, spun: false,
        timer: 1 + Math.random() * 2, finish: null, speed: 0, x: 0, z: 0,
      });
      ck++;
    }
  }
  resetBoxes();
  resetItems();
  // 'intro': the driver talks before the lights; the countdown starts once the dialogue closes.
  Object.assign(G, { raceT: 0, countT: COUNTDOWN, lapStart: 0, bestLap: null, state: 'intro', ending: false });
  startLights.forEach((l) => l.material.color.set(0x330000));
  $('hud').hidden = false;
  $('controls').hidden = true;
  $('menu').hidden = true;
  $('results').hidden = true;
  updateCpus(0);
  placePlayer(0);
  setTempo(1);
  // The menu tune carries on under the drivers' dialogue, fades out before the 3-2-1 beeps,
  // and the race music starts on the GO.
  wantMusic('menu');
  prepareMusic(TRACK_ID);
  talk(settings.teamIdx, 'start').then(() => {
    fadeOutMusic(FADE);
    setTimeout(startCountdown, FADE * 1000);
  });
}

export function startCountdown() {
  if (G.state !== 'intro') return;
  G.state = 'count';
  $('controls').hidden = false;
  sfx('countdown');
}

export function tickCountdown(dt) {
  G.countT -= dt;
  const lit = Math.min(5, Math.floor((COUNTDOWN - G.countT) / 0.6) + 1);
  startLights.forEach((l, k) => l.material.color.set(k < lit ? 0xff1a0a : 0x330000));
  const n = Math.ceil(G.countT - 0.6);
  const txt = n >= 1 && n <= 3 ? String(n) : '';
  if (txt && $('banner').textContent !== txt) { banner(txt, 0.7); sfx('count'); }
  if (G.countT <= 0.6) {
    G.state = 'race';
    startLights.forEach((l) => l.material.color.set(0x29ff5a));
    banner('GO!', 0.8);
    sfx('go');
    if (crowdCheers()) sfx('cheer');
    wantMusic(TRACK_ID);
  }
}
