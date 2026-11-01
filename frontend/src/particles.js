// Pool of cube particles: drift sparks, off-road dust, boost flames.
import * as THREE from 'three';
import { scene } from './engine.js';

const parts = [];
const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
for (let k = 0; k < 150; k++) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  m.visible = false;
  scene.add(m);
  parts.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
}
let next = 0;

export function spawn(x, y, z, color, vx, vy, vz, life) {
  const p = parts[next];
  next = (next + 1) % parts.length;
  p.m.material.color.set(color);
  p.m.position.set(x, y, z);
  p.m.visible = true;
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.life = life; p.max = life;
}

export function updateParticles(dt) {
  parts.forEach((p) => {
    if (p.life <= 0) return;
    p.life -= dt;
    p.vy -= 14 * dt;
    p.m.position.x += p.vx * dt;
    p.m.position.y = Math.max(0.1, p.m.position.y + p.vy * dt);
    p.m.position.z += p.vz * dt;
    p.m.scale.setScalar(Math.max(0.1, p.life / p.max));
    if (p.life <= 0) p.m.visible = false;
  });
}
