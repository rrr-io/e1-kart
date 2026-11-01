// Items that interact with the race, for the player and the CPU karts:
//   LIGHTSTICK     boost
//   BLOOD POP      a red popsicle left on the track: whoever steps on it slips and spins out
//   BAT SWARM      a swarm sent backwards: slows whoever is behind (and darkens the player's screen)
//   PARALLEL WORLD comeback boost, with a pale flower: for a moment nothing can touch you
// Also fires the radio lines that react to the race (taking the lead, overtakes).
import * as THREE from 'three';
import { $, scene, toon, outlineMat } from './engine.js';
import { N, off, spacing, lateral, HALF } from './track.js';
import { boxes } from './scenery.js';
import { G, player, playerProgress, boostFor } from './state.js';
import { spawn } from './particles.js';
import { toast, playerPosition } from './hud.js';
import { radio } from './dialogue.js';
import { rollItem, isReady, makeBatSheet, makeFlowerCanvas, SLIP_T, BATS_T, FLOWER_T, STICK_T, FLOWER_BASE } from './itemdefs.js';

const POP_LIFE = 30;        // seconds a popsicle stays on the track
const POP_R2 = 3.8;         // squared hit radius
const BAT_RANGE = 60;       // how far behind (in track samples) the swarm reaches
const BAT_SPEED = 60;       // swarm speed (units/s), used for the hit delay and the visuals
const PETALS = [FLOWER_BASE, '#ffffff', '#DCE7EC'];

let clock = 0;

const racers = () => [player, ...G.cpus];
const progOf = (o) => (o === player ? playerProgress() : o.prog);
const rankOf = (o) => {
  const p = progOf(o);
  return 1 + racers().filter((r) => r !== o && progOf(r) > p).length;
};
const hasTargetBehind = (o) => {
  const p = progOf(o);
  return racers().some((r) => r !== o && r.finish == null && p - progOf(r) > 0 && p - progOf(r) < BAT_RANGE * 0.7);
};

// ---------- BLOOD POP: 3D popsicles on the track ----------

function makePop() {
  const g = new THREE.Group(), body = new THREE.Group();
  // Unlit materials, like the item boxes: the popsicle has to stay bright against the night.
  const red = new THREE.MeshBasicMaterial({ color: 0xff2418 }), hi = new THREE.MeshBasicMaterial({ color: 0xffa090 }), wood = new THREE.MeshBasicMaterial({ color: 0xf0dcb4 });
  const part = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(1.12);
    m.add(o);
    body.add(m);
  };
  part(new THREE.BoxGeometry(1.0, 1.5, 0.45), red, 0, 1.2, 0);
  part(new THREE.BoxGeometry(0.2, 0.9, 0.1), hi, -0.27, 1.25, 0.26);
  part(new THREE.BoxGeometry(0.34, 0.85, 0.2), wood, 0, 0.3, 0);
  body.rotation.z = 0.22;
  body.scale.setScalar(1.3);
  g.add(body);
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc4001c, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  puddle.position.y = 0.13;
  g.add(puddle);
  g.visible = false;
  scene.add(g);
  return { g, body, live: false, age: 0, owner: null };
}
const pops = Array.from({ length: 10 }, makePop);

function dropPop(owner, x, z) {
  const slot = pops.find((p) => !p.live) || pops.reduce((a, b) => (b.age > a.age ? b : a));
  Object.assign(slot, { live: true, age: 0, owner, x, z });
  slot.g.position.set(x, 0, z);
  slot.g.visible = true;
}

function slip(o) {
  if (o.ghost > 0 || o.slip > 0) return;
  o.slip = SLIP_T;
  for (let k = 0; k < 10; k++) spawn(o.x, 0.8, o.z, k % 2 ? '#E10600' : '#ffffff', (Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9, 0.6);
  if (o === player) {
    o.v *= 0.4;
    toast('SLIPPED!');
    radio(o.team, 'slip', true);
  }
}

function updatePops(dt) {
  pops.forEach((p) => {
    if (!p.live) return;
    p.age += dt;
    p.body.position.y = Math.sin(clock * 4 + p.x) * 0.08;
    p.body.rotation.y += dt * 1.2;
    if (p.age > POP_LIFE) { p.live = false; p.g.visible = false; return; }
    for (const o of racers()) {
      if (o === p.owner && p.age < 1) continue;
      if (o.ghost > 0 || o.slip > 0) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      if (dx * dx + dz * dz < POP_R2) { slip(o); p.live = false; p.g.visible = false; break; }
    }
  });
}

// ---------- BAT SWARM: 3D bats + screen overlay for the player ----------

const batMat = new THREE.MeshBasicMaterial({ color: 0x3a2470 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
const batPool = Array.from({ length: 42 }, () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.5), batMat));
  [-0.09, 0.09].forEach((x) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), eyeMat);
    e.position.set(x, 0.05, 0.27);
    g.add(e);
  });
  const wings = [-1, 1].map((s) => {
    const pv = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.5), batMat);
    w.position.x = s * 0.5;
    pv.add(w);
    g.add(pv);
    return pv;
  });
  g.visible = false;
  scene.add(g);
  return { g, wings, life: 0, t: 0 };
});

function spawnBats(x, z, dx, dz) {
  const px = -dz, pz = dx; // perpendicular
  for (let k = 0; k < 14; k++) {
    const b = batPool.find((q) => q.life <= 0);
    if (!b) return;
    const along = Math.random() * 5, side = (Math.random() - 0.5) * 6;
    Object.assign(b, {
      life: 2.4 + Math.random() * 0.5, t: 0, ph: Math.random() * 6.28,
      x0: x - dx * along + px * side, z0: z - dz * along + pz * side,
      vx: -dx * BAT_SPEED * (0.9 + Math.random() * 0.3), vz: -dz * BAT_SPEED * (0.9 + Math.random() * 0.3),
      px, pz, y0: 1.3 + Math.random() * 1.6,
    });
    b.g.visible = true;
  }
}

function updateBats(dt) {
  batPool.forEach((b) => {
    if (b.life <= 0) return;
    b.life -= dt; b.t += dt;
    if (b.life <= 0) { b.g.visible = false; return; }
    const wob = Math.sin(b.t * 5 + b.ph) * 1.6;
    b.g.position.set(b.x0 + b.vx * b.t + b.px * wob, b.y0 + Math.sin(b.t * 7 + b.ph) * 0.5, b.z0 + b.vz * b.t + b.pz * wob);
    b.g.rotation.y = Math.atan2(b.vx, b.vz);
    const f = Math.sin(clock * 24 + b.ph) * 0.8;
    b.wings[0].rotation.z = f;
    b.wings[1].rotation.z = -f;
  });
}

// Screen overlay: darkened edges and pixel bats flying across (only the player's screen).
const fx = $('batFx');
(function buildFx() {
  fx.style.setProperty('--bat', 'url(' + makeBatSheet().toDataURL() + ')');
  for (let k = 0; k < 14; k++) {
    const b = document.createElement('i');
    b.className = 'bat' + (k % 2 ? ' r' : '');
    b.style.top = 4 + Math.random() * 80 + '%';
    b.style.animationDuration = '.24s, ' + (0.9 + Math.random() * 1.1).toFixed(2) + 's';
    b.style.animationDelay = '0s, ' + (-Math.random() * 2).toFixed(2) + 's';
    b.style.transform = 'scale(' + (0.7 + Math.random() * 0.9).toFixed(2) + ')';
    fx.append(b);
  }
})();

const pending = []; // { o, at }: karts the swarm will reach, and when

function releaseBats(user) {
  const dir = user === player ? user.h : user.kart.root.rotation.y;
  const dx = Math.sin(dir), dz = Math.cos(dir), u = progOf(user);
  spawnBats(user.x, user.z, dx, dz);
  racers().forEach((o) => {
    const d = u - progOf(o);
    if (o !== user && o.finish == null && d > 0 && d < BAT_RANGE) pending.push({ o, at: clock + 0.3 + (d * spacing) / BAT_SPEED });
  });
}

function hitBats(o) {
  if (o.ghost > 0) return;
  o.bats = BATS_T;
  if (o === player) {
    toast('BATS!');
    radio(o.team, 'batsHit', true);
  }
}

function updateBatEffects() {
  for (let k = pending.length - 1; k >= 0; k--) {
    if (pending[k].at <= clock) { hitBats(pending[k].o); pending.splice(k, 1); }
  }
  const b = player.bats || 0;
  fx.hidden = b <= 0;
  if (b > 0) fx.style.opacity = Math.min(1, b / 0.6, (BATS_T - b) / 0.25 + 0.05).toFixed(2);
}

// ---------- PARALLEL WORLD: floating pixel flowers ----------

const flowerTex = new THREE.CanvasTexture(makeFlowerCanvas());
flowerTex.magFilter = THREE.NearestFilter;
flowerTex.minFilter = THREE.NearestFilter;
flowerTex.generateMipmaps = false;
const flowers = Array.from({ length: 24 }, () => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerTex, transparent: true, depthWrite: false }));
  sp.visible = false;
  scene.add(sp);
  return { sp, life: 0, max: 1 };
});

function spawnFlower(o) {
  const f = flowers.find((q) => q.life <= 0);
  if (!f) return;
  f.life = f.max = 0.9 + Math.random() * 0.4;
  f.vy = 1.6 + Math.random() * 1.4;
  f.sp.position.set(o.x + (Math.random() - 0.5) * 4.4, 0.6 + Math.random() * 1.4, o.z + (Math.random() - 0.5) * 4.4);
  f.sp.scale.setScalar(1 + Math.random() * 0.8);
  f.sp.material.rotation = (Math.random() - 0.5) * 1.2;
  f.sp.visible = true;
}

function updateFlowers(dt) {
  flowers.forEach((f) => {
    if (f.life <= 0) return;
    f.life -= dt;
    if (f.life <= 0) { f.sp.visible = false; return; }
    f.sp.position.y += f.vy * dt;
    f.sp.material.rotation += dt * 1.5;
    f.sp.material.opacity = Math.min(1, f.life / (f.max * 0.5));
  });
}

// ---------- Using items (player and CPU) ----------

export function useItem(o) {
  const kind = o.item;
  o.item = null;
  const me = o === player;
  if (kind === 'stick') {
    boostFor(o, STICK_T);
    if (me) { toast('LIGHTSTICK BOOST!'); radio(o.team, 'lightstick'); }
  } else if (kind === 'pop') {
    if (me) dropPop(o, o.x - Math.sin(o.h) * 3.4, o.z - Math.cos(o.h) * 3.4);
    else {
      // The CPU drops it where the closest kart behind is driving.
      const i = (((Math.floor(o.prog) - 3) % N) + N) % N, p = progOf(o);
      let near = null;
      racers().forEach((r) => { if (r !== o && p - progOf(r) > 0 && (!near || progOf(r) > progOf(near))) near = r; });
      const lat = near ? Math.max(-(HALF - 2), Math.min(HALF - 2, lateral(i, near.x, near.z))) : o.lat;
      const e = off(i, lat);
      dropPop(o, e[0], e[1]);
    }
    if (me) { toast('BLOOD POP!'); radio(o.team, 'attack', true); }
  } else if (kind === 'bats') {
    releaseBats(o);
    if (me) { toast('BAT SWARM!'); radio(o.team, 'attack', true); }
  } else if (kind === 'flower') {
    o.ghost = FLOWER_T;
    boostFor(o, FLOWER_T);
    if (me) { toast('PARALLEL WORLD!'); radio(o.team, 'comeback', true); }
  }
}

// ---------- CPU karts: pick up and use items ----------

function updateCpuItems(dt) {
  G.cpus.forEach((c) => {
    if (c.finish !== null) return;
    c.pickCd = Math.max(0, (c.pickCd || 0) - dt);
    if (!c.item && c.pickCd === 0) {
      // The boxes stay in place for the CPUs, so they never leave the player without any.
      for (const b of boxes) {
        const dx = b.m.position.x - c.x, dz = b.m.position.z - c.z;
        if (b.m.visible && dx * dx + dz * dz < 6.5) { c.item = 'roll'; c.itemT = 0.9; c.pickCd = 5; break; }
      }
    }
    if (c.item === 'roll') {
      c.itemT -= dt;
      if (c.itemT <= 0) { c.item = rollItem(rankOf(c)); c.hold = c.item === 'flower' ? 0.3 : 1 + Math.random() * 3; }
    } else if (isReady(c.item)) {
      c.hold -= dt;
      if (c.hold <= 0 && (c.item === 'stick' || c.item === 'flower' || hasTargetBehind(c))) useItem(c);
    }
  });
}

// ---------- Race-reactive radio ----------

let confirmed = 0, cand = 0, candT = 0, evT = 0;

function updateRadioEvents(dt) {
  if (G.state !== 'race' || G.raceT < 5) { confirmed = 0; return; } // the first seconds are grid shuffling
  evT -= dt;
  if (evT > 0) return;
  evT = 0.15;
  const pos = playerPosition();
  if (!confirmed) { confirmed = cand = pos; candT = 0; return; }
  if (pos !== cand) { cand = pos; candT = 0; } else candT += 0.15;
  if (candT >= 0.6 && cand !== confirmed) {
    const prev = confirmed;
    confirmed = cand;
    radio(player.team, cand === 1 ? 'takeLead' : cand < prev ? 'overtake' : 'overtaken');
  }
}

// ---------- Frame update ----------

export function updateItems(dt) {
  clock += dt;
  const racing = G.state === 'race';
  racers().forEach((o) => {
    ['slip', 'bats', 'ghost'].forEach((k) => { if (o[k] > 0) o[k] = Math.max(0, o[k] - dt); });
    // PARALLEL WORLD: flowers and petals around the kart.
    if (o.ghost > 0 && Math.random() < 0.55) spawnFlower(o);
    if (o.ghost > 0 && Math.random() < 0.8) {
      spawn(o.x + (Math.random() - 0.5) * 2.4, 0.5 + Math.random() * 1.6, o.z + (Math.random() - 0.5) * 2.4, PETALS[(Math.random() * 3) | 0], (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.7);
    }
  });
  if (racing) updateCpuItems(dt);
  updatePops(dt);
  updateBats(dt);
  updateFlowers(dt);
  updateBatEffects();
  updateRadioEvents(dt);
}

/** Clears everything on the track and the effects (new race or back to the menu). */
export function resetItems() {
  pops.forEach((p) => { p.live = false; p.g.visible = false; });
  batPool.forEach((b) => { b.life = 0; b.g.visible = false; });
  flowers.forEach((f) => { f.life = 0; f.sp.visible = false; });
  pending.length = 0;
  fx.hidden = true;
  confirmed = cand = candT = evT = 0;
}
