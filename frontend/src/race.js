// Starting grid and lights.
import { $ } from './engine.js';
import { TEAMS, settings } from './config.js';
import { N, off, yawAt } from './track.js';
import { startLights, resetBoxes, crowdCheers } from './scenery.js';
import { paintKart } from './kart.js';
import { G, MP, player } from './state.js';
import { updateCpus } from './ai.js';
import { placePlayer } from './physics.js';
import { banner } from './hud.js';
import { talk } from './dialogue.js';
import { resetItems } from './items.js';
import { wantMusic, prepareMusic, fadeOutMusic, setTempo, sfx } from './audio.js';

const FADE = 0.7; // seconds of menu-music fade between the dialogue and the countdown
import { TRACK_ID } from './theme.js';
import { track } from './stats.js';
import { liveOn } from './campaign.js';

const COUNTDOWN = 3.6;
const PLAYER_SLOT = 3;

// Who starts where. Alone: the player in the middle of the grid. In a room: the human players by join order
// from pole position, then the CPU karts with the free teams (the same order on every player's screen).
function grid() {
  if (!MP.on) {
    const cpus = [...TEAMS.keys()].filter((k) => k !== settings.teamIdx);
    return [...TEAMS.keys()].map((slot) => (slot === PLAYER_SLOT ? { me: true, team: settings.teamIdx } : { team: cpus.shift() }));
  }
  const taken = MP.roster.map((p) => p.team);
  return [
    ...MP.roster.map((p) => ({ me: p.id === MP.me, id: p.id, team: p.team, human: true })),
    ...[...TEAMS.keys()].filter((k) => !taken.includes(k)).map((team) => ({ team })),
  ];
}

export function setupRace() {
  const order = grid();
  const myTeam = order.find((e) => e.me).team;
  if (!MP.on) track('race_start', TRACK_ID + ':' + TEAMS[myTeam].name.split(' ')[0]);
  G.cpus = [];
  G.remotes = [];
  G.karts.forEach((k) => { k.root.visible = true; k.body.rotation.set(0, 0, 0); });
  let ck = 0;
  for (let slot = 0; slot < order.length; slot++) {
    const idx = (N - 4 - slot * 3 + N) % N, lat = slot % 2 ? -3.2 : 3.2, e = order[slot];
    if (e.me) {
      const o = off(idx, lat);
      Object.assign(player, {
        x: o[0], z: o[1], h: yawAt(idx), v: 0, idx, prevIdx: undefined, laps: -1, half: true,
        drifting: false, dT: 0, boost: 0, item: null, hop: 0, steerS: 0, finish: null, team: myTeam,
        slip: 0, bats: 0, ghost: 0, spun: false,
      });
      player.kart = G.karts[0];
      paintKart(G.karts[0], TEAMS[myTeam].color);
    } else if (e.human) {
      // A friend's kart: placed on the grid, then moved by the states their game sends (mp.js).
      const kart = G.karts[ck + 1], o = off(idx, lat);
      paintKart(kart, TEAMS[e.team].color);
      G.remotes.push({
        remote: true, id: e.id, team: e.team, kart, x: o[0], z: o[1], h: yawAt(idx), v: 0, prog: idx - N,
        finish: null, left: false, boost: 0, slip: 0, bats: 0, ghost: 0, pal: 0, item: null, buf: [],
      });
      kart.root.position.set(o[0], 0, o[1]);
      kart.root.rotation.y = yawAt(idx);
      ck++;
    } else {
      const t = e.team, kart = G.karts[ck + 1];
      paintKart(kart, TEAMS[t].color);
      G.cpus.push({
        kart, team: t, prog: idx - N, lat, latT: lat,
        spd: 40 + ck * 0.9 + Math.random() * 1.1, band: 0, boost: 0,
        item: null, slip: 0, bats: 0, ghost: 0, pickCd: 0, spun: false,
        timer: 1 + Math.random() * 2, finish: null, speed: 0, x: 0, z: 0, netProg: idx - N, netLat: lat,
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
  // In a room the lights go when everyone has closed the dialogue (MP.afterIntro waits for the server's GO).
  // The multiplayer lines remind the MAMA live voting: until it's over, then the usual ones.
  talk(myTeam, MP.on && liveOn() ? 'mpStart' : 'start').then(() => (MP.on ? MP.afterIntro() : null)).then(() => {
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
