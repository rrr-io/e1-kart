// Interstellar track scenery (MAMA 2026 "A Music Interstellar"): neon city skyline on the horizon,
// floating glass cubes, MAMA billboards on the straights. Only built when that track is chosen.
// Skyline: "Neon City" by Kelench (itch.io), recoloured — free for commercial use, not to be redistributed as an asset pack.
import * as THREE from 'three';
import { scene, canvasTex } from './engine.js';
import { N, HALF, WORLD_K, corner, off, yawAt, minTrackDist, P } from './track.js';
import farUrl from './assets/space/skyline-far.png';
import nearUrl from './assets/space/skyline-near.png';

export const spaceTexts = [];
let cubes = null;
const signs = [];

function skyline(url, radius, height, repeat, y) {
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(repeat, 1);
  const g = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.position.y = y + height / 2;
  m.renderOrder = 1;   // drawn after the moon and the nebula, so the towers stand in front of them
  return m;
}

// Glass cubes (wireframe, like the poster's floating frames): one merged line geometry, a single draw call.
function glassCubes() {
  const K = WORLD_K, pos = [], col = [];
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)).attributes.position.array;
  const cols = [new THREE.Color('#9fe8ff'), new THREE.Color('#d6b8ff'), new THREE.Color('#ff9be6'), new THREE.Color('#ffffff')];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  let n = 0, tries = 0;
  while (n < 70 && tries < 20000) {
    tries++;
    const x = (-280 + Math.random() * 600) * K, z = (-140 + Math.random() * 460) * K;
    const d = minTrackDist(x, z);
    if (d < HALF + 16 || d > 220) continue;
    const k = 3 + Math.random() * 9;
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    q.setFromEuler(e); s.set(k, k, k); v.set(x, 6 + Math.random() * 40, z);
    m.compose(v, q, s);
    const c = cols[n % cols.length];
    for (let i = 0; i < edges.length; i += 3) {
      const p = new THREE.Vector3(edges[i], edges[i + 1], edges[i + 2]).applyMatrix4(m);
      pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b);
    }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
}

// MAMA billboards: pixel text, neon frame (our own lettering, not the official logo).
const BOARDS = [
  { top: 'MAMA', bottom: '2026', bg: ['#2a1670', '#5b2fd6'], fg: '#ffffff', accent: '#ff5fc8' },
  { top: 'A MUSIC', bottom: 'INTERSTELLAR', bg: ['#0d1a52', '#2a59d6'], fg: '#ffffff', accent: '#4fe6ff' },
  { top: 'MAMA', bottom: 'AWARDS', bg: ['#3a0f5c', '#a02fd6'], fg: '#ffffff', accent: '#ffd23a' },
  { top: 'VOTE', bottom: 'ENHYPEN', bg: ['#14113a', '#3b2a8f'], fg: '#ffffff', accent: '#E10600' },
];
function boardTex(b) {
  const t = canvasTex(112, 44, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, b.bg[0]); gr.addColorStop(1, b.bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = b.accent; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = b.fg;
    g.font = (b.top.length > 5 ? 8 : 16) + 'px "Press Start 2P", monospace';
    g.fillText(b.top, w / 2, b.top.length > 5 ? 15 : 16);
    g.fillStyle = b.accent;
    g.font = '8px "Press Start 2P", monospace';
    g.fillText(b.bottom, w / 2, 33);
  });
  spaceTexts.push(t);
  return t;
}
function billboards() {
  const mats = BOARDS.map((b) => new THREE.MeshBasicMaterial({ map: boardTex(b), fog: false }));
  const legM = new THREE.MeshBasicMaterial({ color: 0x1b1438 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0x9f7bff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  let k = 0;
  for (let i = 45; i < N - 30; i += 70) {
    // straights only, alternating sides, well off the track
    let j = i; while (corner[j % N] && j < i + 30) j++;
    if (corner[j % N]) continue;
    const side = k % 2 ? 1 : -1;
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), mats[k % mats.length]);
    board.position.y = 10;
    g.add(board);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), legM);
    back.position.set(0, 10, -0.05); back.rotation.y = Math.PI;
    g.add(back);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), glowM);
    halo.position.set(0, 10, -0.1);
    g.add(halo);
    [-5, 5].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), legM); l.position.set(x, 3, -0.3); g.add(l); });
    const o = off(j % N, side * (HALF + 14));
    g.position.set(o[0], 0, o[1]);
    // face the oncoming karts, angled toward the track
    g.rotation.y = yawAt(j % N) + Math.PI - side * 0.45;
    scene.add(g);
    signs.push(board);
    k++;
  }
}

export function buildSpace() {
  const c = new THREE.Vector3(0, 0, 0);
  P.forEach((p) => c.add(p)); c.divideScalar(P.length);
  const far = skyline(farUrl, 760, 210, 6, -40), near = skyline(nearUrl, 700, 200, 7, -45);
  far.position.x = near.position.x = c.x;
  far.position.z = near.position.z = c.z;
  near.renderOrder = 2;
  scene.add(far); scene.add(near);
  cubes = glassCubes();
  scene.add(cubes);
  billboards();
}

export function updateSpace(dt, now) {
  if (cubes) { cubes.position.y = Math.sin(now / 1400) * 1.5; cubes.material.opacity = 0.7 + Math.sin(now / 600) * 0.15; }
}
