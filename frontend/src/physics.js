// Player driving: assisted analog steering, drift and mini-turbo, off-road, laps, pads and items.
import { wrapAngle } from './engine.js';
import { LAPS, settings } from './config.js';
import { N, P, HALF, KERB, off, yawAt, lateral, nearestIdx } from './track.js';
import { pads, boxes } from './scenery.js';
import { G, input, player, boostFor } from './state.js';
import { spawn } from './particles.js';
import { burst } from './fx.js';
import { toast, banner, playerPosition } from './hud.js';
import { radio } from './dialogue.js';
import { rollFor, isReady, SLIP_T } from './itemdefs.js';
import { useItem } from './items.js';
import { sfx, setTempo, wantMusic } from './audio.js';

// Driving parameters: tweak these to change the feel.
export const TUNING = {
  topSpeed: 46,          // units/s (×4 = on-screen km/h)
  offroadFactor: 0.64,   // top speed on grass
  boostFactor: 1.48,
  steerRate: 2.9,        // rad/s at low speed
  steerHighSpeedLoss: 0.9,
  assistStrength: 2.4,   // how fast the assist realigns the kart with the track
  driftSlide: 0.2,       // how much the kart slides outward while drifting
  miniTurbo: [0.9, 1.9], // seconds of drift for blue / orange mini-turbo
  wallLimit: HALF + 16,
};

export function updatePlayer(dt) {
  const p = player;
  const racing = G.state === 'race' || G.state === 'done';
  const auto = G.state === 'done'; // drives on its own after the finish line

  let steer = Math.max(-1, Math.min(1, (input.l ? 1 : 0) - (input.r ? 1 : 0) + (input.ax || 0)));
  p.steerS += (steer - p.steerS) * Math.min(1, dt * 14);
  steer = p.steerS;
  if (auto) {
    const tgt = (p.idx + 12) % N;
    const d = wrapAngle(Math.atan2(P[tgt].x - p.x, P[tgt].z - p.z) - p.h);
    steer = Math.max(-1, Math.min(1, d * 2));
  }
  p.steerVis += (steer - p.steerVis) * Math.min(1, dt * 10);

  // BLOOD POP: while spinning out you steer very little and can't drift.
  if (p.slip > 0) { steer *= 0.3; p.drifting = false; }

  // Drift: activated by holding DRIFT while steering; releasing it grants the mini-turbo.
  if (racing && !auto && p.slip <= 0 && input.drift && !p.drifting && Math.abs(steer) > 0.3 && p.v > 14) {
    p.drifting = true; p.ddir = Math.sign(steer); p.dT = 0; p.hop = 0.45;
  }
  if (p.drifting && (!input.drift || p.v < 9 || auto)) {
    if (p.dT > TUNING.miniTurbo[1]) { boostFor(p, 1.35); toast('SUPER MINI-TURBO'); sfx('turbo'); radio(p.team, 'miniTurbo'); }
    else if (p.dT > TUNING.miniTurbo[0]) { boostFor(p, 0.75); toast('MINI-TURBO'); sfx('turbo'); }
    p.drifting = false;
  }

  const lat = lateral(p.idx, p.x, p.z);
  const offroad = Math.abs(lat) > HALF + KERB;
  let target = racing ? TUNING.topSpeed : 0;
  if (offroad) target *= TUNING.offroadFactor;
  if (p.slip > 0) target *= 0.25;   // BLOOD POP
  if (p.bats > 0) target *= 0.8;    // BAT SWARM
  if (p.boost > 0) { target *= TUNING.boostFactor; p.boost -= dt; }
  if (input.brake && !auto) target = Math.min(target, 6);
  if (auto) target = Math.min(target, 22);
  p.v += (target - p.v) * (p.v < target ? 1.35 : 2.4) * dt;

  let turnIn = steer;
  if (p.drifting) { p.dT += dt; turnIn = p.ddir * (0.72 + 0.5 * steer * p.ddir); }
  p.h += turnIn * (TUNING.steerRate - TUNING.steerHighSpeedLoss * Math.min(1, p.v / 60)) * Math.min(1, p.v / 6) * (p.drifting ? 1.15 : 1) * dt;

  // Steering assist: if the steering isn't touched, the kart gently realigns with the track.
  if (settings.assist && racing && !auto && !p.drifting && Math.abs(steer) < 0.15 && p.v > 4) {
    const d = wrapAngle(yawAt((p.idx + 2) % N) - lat * 0.025 - p.h);   // looks a little ahead: needed at top speed
    if (Math.abs(d) < 0.8) p.h += d * Math.min(1, dt * TUNING.assistStrength);
  }

  const md = p.h - (p.drifting ? p.ddir * TUNING.driftSlide : 0);
  p.x += Math.sin(md) * p.v * dt;
  p.z += Math.cos(md) * p.v * dt;

  // Invisible wall: slides along the edge instead of stopping.
  p.idx = nearestIdx(p.x, p.z, p.idx, 40);
  const lat2 = lateral(p.idx, p.x, p.z);
  if (Math.abs(lat2) > TUNING.wallLimit) {
    const o = off(p.idx, Math.sign(lat2) * TUNING.wallLimit);
    p.x = o[0]; p.z = o[1]; p.v *= 0.88;
    const d = wrapAngle(yawAt(p.idx) - p.h);
    if (Math.abs(d) < 1.6) p.h += d * 0.35;
  }

  // Laps: counts a lap when crossing from the end to the start after passing the track's halfway point.
  const i = p.idx;
  if (i > N * 0.4 && i < N * 0.6) p.half = true;
  if (p.half && p.prevIdx !== undefined && p.prevIdx > N * 0.85 && i < N * 0.15) {
    p.half = false;
    p.laps++;
    if (p.laps >= 1 && G.state === 'race') {
      const lt = G.raceT - G.lapStart;
      if (G.bestLap === null || lt < G.bestLap) G.bestLap = lt;
    }
    G.lapStart = G.raceT;
    if (p.laps >= LAPS && G.state === 'race') { G.state = 'done'; p.finish = G.raceT; G.doneT = 0; banner('FINISH!', 1.8); setTempo(1); wantMusic('finish'); }
    else if (p.laps === LAPS - 1 && G.state === 'race') { banner('FINAL LAP', 1.4); radio(p.team, 'lastLap', true); sfx('finalLap'); setTempo(1.08); }
    else if (p.laps >= 1 && G.state === 'race') sfx('lap');
  }
  p.prevIdx = i;

  if (racing) {
    pads.forEach((pd) => {
      let d = Math.abs(i - pd[0]);
      d = Math.min(d, N - d);
      if (d < 5 && Math.abs(lat2 - pd[1]) < 2.4) { if (p.boost < 0.6) { toast('BOOST!'); sfx('boost'); burst('flare', p.x, 0.9, p.z, 4.5); } boostFor(p, 0.9); }
    });
  }

  boxes.forEach((b) => {
    if (!b.m.visible) return;
    const dx = b.m.position.x - p.x, dz = b.m.position.z - p.z;
    if (dx * dx + dz * dz < 5.5) {
      b.m.visible = false; b.t = 4;
      burst('sparkle', b.m.position.x, 1.4, b.m.position.z, 4);
      for (let k = 0; k < 8; k++) spawn(b.m.position.x, 1.3, b.m.position.z, k % 2 ? '#E10600' : '#ffffff', (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, 0.6);
      if (racing) sfx('pickup');
      if (!p.item && racing) { p.item = 'roll'; p.rollT = 0.9; }
    }
  });
  // The item depends on the position: whoever leads gets the traps, whoever trails gets the comeback.
  if (p.item === 'roll') { p.rollT -= dt; if (p.rollT <= 0) rollFor(p, playerPosition()); }
  if (input.item && isReady(p.item) && G.state === 'race') { useItem(p); input.item = false; }

  // Particles
  const rx = p.x - Math.sin(p.h) * 1.2, rz = p.z - Math.cos(p.h) * 1.2;
  if (p.drifting && p.v > 8) {
    const c = p.dT > TUNING.miniTurbo[1] ? '#ff8a1f' : p.dT > TUNING.miniTurbo[0] ? '#4fc3ff' : '#ffffff';
    for (let s = -1; s <= 1; s += 2) {
      spawn(rx + Math.cos(p.h) * s * 1.05, 0.25, rz - Math.sin(p.h) * s * 1.05, c, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3, 0.32);
    }
  }
  if (offroad && p.v > 6 && Math.random() < 0.6) spawn(rx, 0.3, rz, '#8a6b3e', (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.5);
  if (p.boost > 0 && Math.random() < 0.8) spawn(p.x - Math.sin(p.h) * 2, 0.55, p.z - Math.cos(p.h) * 2, Math.random() < 0.5 ? '#ffd23a' : '#ff6a1a', (Math.random() - 0.5) * 1.5, 0.5, (Math.random() - 0.5) * 1.5, 0.28);

  placePlayer(dt);
}

export function placePlayer(dt) {
  const p = player, k = p.kart;
  if (!k) return;
  k.root.position.set(p.x, 0, p.z);
  k.root.rotation.y = p.h;
  p.hop = Math.max(0, p.hop - dt * 2.2);
  const targetYaw = p.drifting ? p.ddir * 0.32 : 0;
  k.body.rotation.y += (targetYaw - k.body.rotation.y) * Math.min(1, dt * 10);
  // BLOOD POP: two full spins.
  if (p.slip > 0) { k.body.rotation.y = (1 - p.slip / SLIP_T) * Math.PI * 4; p.spun = true; }
  else if (p.spun) { k.body.rotation.y = 0; p.spun = false; }
  k.body.rotation.z += ((p.drifting ? -p.ddir * 0.07 : -p.steerVis * 0.04) - k.body.rotation.z) * Math.min(1, dt * 8);
  k.body.position.y = Math.sin((p.hop / 0.45) * Math.PI) * 0.45 + (p.v > 1 ? Math.sin(G.raceT * 40) * 0.02 : 0);
  k.flame.visible = p.boost > 0;
  k.flame.scale.z = 0.8 + Math.random() * 0.6;
  k.wheels.forEach((w) => { w.rotation.x += (p.v * dt) / 0.45; });
  k.pivots.forEach((pv) => { pv.rotation.y = p.steerVis * 0.4; });
}
