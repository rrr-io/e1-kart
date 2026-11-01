// CPU opponents: follow the center line with a lateral offset that changes over time,
// with light rubber banding to stay close to the player.
import { LAPS } from './config.js';
import { N, P, T, NR, HALF, WORLD_K, bend, spacing } from './track.js';
import { pads } from './scenery.js';
import { G, player, playerProgress } from './state.js';
import { spawn } from './particles.js';
import { SLIP_T } from './itemdefs.js';

function cpuPos(c) {
  const f = ((c.prog % N) + N) % N;
  const i = Math.floor(f), j = (i + 1) % N, t = f - i;
  const x = P[i].x + (P[j].x - P[i].x) * t, z = P[i].z + (P[j].z - P[i].z) * t;
  return { i, x: x + NR[i].x * c.lat, z: z + NR[i].z * c.lat };
}

export function updateCpus(dt) {
  const pp = playerProgress();
  G.cpus.forEach((c) => {
    if (G.state === 'race' || G.state === 'done') {
      const diff = c.prog - pp;
      const want = diff > 45 / WORLD_K ? -3 : diff < -60 / WORLD_K ? 2.6 : 0;
      c.band += (want - c.band) * Math.min(1, dt * 0.8);
      let s = c.spd + c.band;
      if (c.boost > 0) { s += 8; c.boost -= dt; }
      if (c.slip > 0) s *= 0.25;  // BLOOD POP
      if (c.bats > 0) s *= 0.8;   // BAT SWARM
      if (c.finish !== null) s = Math.min(s, 20);
      c.prog += (s / spacing) * dt;
      c.timer -= dt;
      if (c.timer <= 0) { c.timer = 1.5 + Math.random() * 2.5; c.latT = (Math.random() * 2 - 1) * (HALF - 2.4); }
      c.lat += (c.latT - c.lat) * Math.min(1, dt * 0.9);
      const ii = Math.floor(((c.prog % N) + N) % N);
      pads.forEach((pd) => { if (Math.abs(ii - pd[0]) < 3 && Math.abs(c.lat - pd[1]) < 2.4) c.boost = Math.max(c.boost, 0.8); });
      if (c.finish === null && c.prog >= LAPS * N) c.finish = G.raceT;
      c.speed = s;
    }

    const pos = cpuPos(c);

    // Contact with the player: a soft lateral push.
    const dx = pos.x - player.x, dz = pos.z - player.z, d2 = dx * dx + dz * dz;
    if (d2 < 5.8 && d2 > 0.0001 && G.state === 'race') {
      const d = Math.sqrt(d2), push = (2.4 - d) / 2;
      player.x -= (dx / d) * push;
      player.z -= (dz / d) * push;
      const side = dx * NR[pos.i].x + dz * NR[pos.i].z;
      c.lat += Math.sign(side || 1) * push;
      player.v *= 0.985;
    }

    const k = c.kart, i = pos.i;
    const yaw = Math.atan2(T[(i + 2) % N].x, T[(i + 2) % N].z);
    k.root.position.set(pos.x, 0, pos.z);
    k.root.rotation.y = yaw;
    const drift = Math.max(-0.3, Math.min(0.3, bend[i] * 0.9));
    k.body.rotation.y += (drift - k.body.rotation.y) * Math.min(1, dt * 6);
    if (c.slip > 0) { k.body.rotation.y = (1 - c.slip / SLIP_T) * Math.PI * 4; c.spun = true; }
    else if (c.spun) { k.body.rotation.y = 0; c.spun = false; }
    k.flame.visible = c.boost > 0;
    k.wheels.forEach((w) => { w.rotation.x += ((c.speed || 0) * dt) / 0.45; });
    if (Math.abs(drift) > 0.18 && Math.random() < 0.25 && dt > 0) {
      spawn(pos.x - Math.sin(yaw) * 1.3, 0.25, pos.z - Math.cos(yaw) * 1.3, '#ffffff', (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, 0.25);
    }
    c.x = pos.x;
    c.z = pos.z;
  });
}
