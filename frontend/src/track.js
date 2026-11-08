// Track: closed curve sampled into N points, plus asphalt, curbs and gravel.
import * as THREE from 'three';
import { scene, toon, canvasTex } from './engine.js';
import { TRACK, THEME } from './theme.js';

// Track control points (x, z) and size come from the chosen track (theme.js). Raising the scale makes each lap
// longer: the index-based things (boost pads, item boxes, scenery) stay in the same relative spots, just further
// apart. WORLD_K is the factor compared to the original size (1.5).
const RAW = TRACK.raw;
const SCALE = TRACK.scale;
export const WORLD_K = SCALE / 1.5;

export const N = 720;      // samples along the track
export const HALF = 8;     // half the width of the road
export const KERB = 1.7;   // curb width

const curve = new THREE.CatmullRomCurve3(RAW.map((p) => new THREE.Vector3(p[0] * SCALE, 0, p[1] * SCALE)), true, 'catmullrom', 0.5);
export const P = curve.getSpacedPoints(N).slice(0, N); // center points
export const T = [];  // tangents
export const NR = []; // normals (toward the "positive" side)
for (let i = 0; i < N; i++) {
  const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
  const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  T.push(t);
  NR.push(new THREE.Vector3(t.z, 0, -t.x));
}
export const spacing = curve.getLength() / N;

export const corner = [], bend = [];
for (let i = 0; i < N; i++) {
  const a = T[(i - 5 + N) % N], b = T[(i + 5) % N];
  const ang = Math.acos(Math.min(1, a.dot(b)));
  corner.push(ang > 0.17);
  bend.push(Math.sign(a.x * b.z - a.z * b.x) * ang);
}

export const off = (i, d) => [P[i].x + NR[i].x * d, P[i].z + NR[i].z * d];
export const yawAt = (i) => Math.atan2(T[i].x, T[i].z);

// Signed lateral distance of (x, z) from the track's center at sample i.
export const lateral = (i, x, z) => (x - P[i].x) * NR[i].x + (z - P[i].z) * NR[i].z;

export function nearestIdx(x, z, guess, win) {
  let best = guess, bd = 1e12;
  for (let k = -win; k <= win; k++) {
    const i = (guess + k + N * 4) % N;
    const dx = P[i].x - x, dz = P[i].z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function minTrackDist(x, z) {
  let b = 1e9;
  for (let i = 0; i < N; i += 3) {
    const dx = P[i].x - x, dz = P[i].z - z, d = dx * dx + dz * dz;
    if (d < b) b = d;
  }
  return Math.sqrt(b);
}

export function placeAt(obj, i, lat, y) {
  const o = off(i, lat);
  obj.position.set(o[0], y || 0, o[1]);
  obj.rotation.y = yawAt(i);
  scene.add(obj);
  return obj;
}

export function flat(w, l, mat, y) {
  const g = new THREE.PlaneGeometry(w, l);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// Strip parallel to the track's center between lateral distances a and b; colorFn(i) returns a color or null to skip.
function strip(a, b, y, colorFn) {
  const pos = [], col = [];
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const cc = colorFn(i);
    if (!cc) continue;
    c.set(cc);
    const j = (i + 1) % N;
    const A = off(i, a), B = off(i, b), C = off(j, a), D = off(j, b);
    pos.push(A[0], y, A[1], C[0], y, C[1], B[0], y, B[1], B[0], y, B[1], C[0], y, C[1], D[0], y, D[1]);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// Striped night-time grass, or (interstellar) a dark glass floor with a neon grid.
const grass = THEME.ground ? canvasTex(32, 32, (g) => {
  const [base, alt, line, dot] = THEME.ground;
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  g.fillStyle = alt; g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
  g.fillStyle = line; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
  g.fillStyle = dot; g.fillRect(0, 0, 1, 1);
}, true) : canvasTex(32, 32, (g) => {
  g.fillStyle = '#1d3a33'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#1a342e'; g.fillRect(0, 0, 32, 16);
  for (let k = 0; k < 40; k++) { g.fillStyle = k % 2 ? '#152c27' : '#25463c'; g.fillRect((k * 13) % 32, (k * 7) % 32, 1, 1); }
}, true);
grass.repeat.set(70, 70);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), toon(0xffffff, { map: grass }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

strip(-HALF, HALF, 0.03, (i) => (Math.floor(i / 12) % 2 ? THEME.asphalt[0] : THEME.asphalt[1]));
strip(HALF - 0.7, HALF - 0.3, 0.08, () => THEME.line);
strip(-HALF + 0.3, -HALF + 0.7, 0.08, () => THEME.line);
strip(-0.22, 0.22, 0.08, (i) => (i % 10 < 5 ? '#d9d9de' : null));
const kerbC = (i) => (corner[i] ? THEME.kerb[Math.floor(i / 2) % 2 ? 0 : 1] : null);
strip(HALF, HALF + KERB, 0.07, kerbC);
strip(-HALF - KERB, -HALF, 0.07, kerbC);
const gravC = (i) => (corner[i] ? THEME.gravel[i % 3 ? 0 : 1] : null);
strip(HALF + KERB, HALF + 8, 0.03, gravC);
strip(-HALF - 8, -HALF - KERB, 0.03, gravC);
