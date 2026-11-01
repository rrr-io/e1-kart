// Everything around the track: start portal, team garages, grandstands,
// banners, barriers, trees, mountains, clouds, lampposts, boost pads and item boxes.
import * as THREE from 'three';
import { scene, toon, canvasTex, redrawTex } from './engine.js';
import { TEAMS, lum } from './config.js';
import { N, NR, HALF, WORLD_K, corner, bend, off, yawAt, placeAt, flat, minTrackDist } from './track.js';

// ---------- Start line and portal ----------
const checker = canvasTex(16, 2, (g) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#0b0b0d' : '#ffffff'; g.fillRect(x, y, 1, 1); }
});
placeAt(flat(HALF * 2, 2, new THREE.MeshBasicMaterial({ map: checker })), 0, 0, 0.11);

const gantry = new THREE.Group();
[-1, 1].forEach((s) => {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), toon(0x1b1b20));
  p.position.set(s * (HALF + 1.6), 4, 0);
  p.castShadow = true;
  gantry.add(p);
});
const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 4, 1.8, 1), toon(0x1b1b20));
beam.position.y = 8.4;
beam.castShadow = true;
gantry.add(beam);

const signTex = canvasTex(128, 16, (g, w, h) => {
  g.fillStyle = '#EE8A1A'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b0b0d';
  g.font = '8px "Press Start 2P", monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('E1 GRAND PRIX', w / 2, h / 2 + 1);
});
[1, -1].forEach((s) => {
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 3, 1.5), new THREE.MeshBasicMaterial({ map: signTex }));
  pl.position.set(0, 8.4, s * 0.51);
  if (s < 0) pl.rotation.y = Math.PI;
  gantry.add(pl);
});

// Starting lights (5 lights).
export const startLights = [];
for (let k = 0; k < 5; k++) {
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.4), new THREE.MeshBasicMaterial({ color: 0x330000 }));
  l.position.set((k - 2) * 2.2, 7.1, -0.6);
  gantry.add(l);
  startLights.push(l);
}
placeAt(gantry, 0, 0, 0);

// ---------- Pit area with the 6 team garages ----------
(function pitBuilding() {
  const g = new THREE.Group();
  const L = 46;
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 6, L), toon(0xf2f2f4));
  body.position.set(-4, 3, 0);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, L + 2), toon(0xE10600));
  roof.position.set(-4, 6.4, 0);
  roof.castShadow = true;
  g.add(roof);
  for (let k = 0; k < TEAMS.length; k++) {
    const z = -L / 2 + 4.5 + k * 7.4;
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 5.6), toon(new THREE.Color(TEAMS[k].color)));
    d.position.set(0.05, 1.8, z);
    g.add(d);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 5.6), toon(0x0b0b0d));
    st.position.set(0.05, 4.1, z);
    g.add(st);
  }
  placeAt(g, 30, -(HALF + 6), 0);
})();

// ---------- Grandstands with crowd and blue lightsticks ----------
const crowdCols = TEAMS.map((t) => new THREE.Color(t.color)).concat([new THREE.Color('#ffffff'), new THREE.Color('#ffd9b8'), new THREE.Color('#2b2b30')]);
const lightsticks = [];
function grandstand(i) {
  const g = new THREE.Group();
  const L = 30, steps = 5;
  for (let s = 0; s < steps; s++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2 + s * 1.2, L), toon(s % 2 ? 0x8c8c96 : 0x9a9aa4));
    b.position.set(s * 2.2 + 1.1, (1.2 + s * 1.2) / 2, 0);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, L + 2), toon(0xE10600));
  roof.position.set(5.6, 9.6, 0);
  roof.castShadow = true;
  g.add(roof);
  [-L / 2, 0, L / 2].forEach((z) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.6, 0.5), toon(0x1b1b20));
    p.position.set(11, 4.8, z);
    g.add(p);
  });
  const per = steps * 24;
  const people = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.7), toon(0xffffff), per);
  const sticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), new THREE.MeshBasicMaterial({ color: 0x9fd4ff }), per);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let s = 0; s < steps; s++) {
    for (let k = 0; k < 24; k++) {
      const x = s * 2.2 + 1.1 + (Math.random() - 0.5) * 0.6, z = -L / 2 + 1 + k * 1.2;
      m.makeTranslation(x, 1.2 + s * 1.2 + 0.5, z);
      people.setMatrixAt(n, m);
      people.setColorAt(n, crowdCols[(Math.random() * crowdCols.length) | 0]);
      m.makeTranslation(x, 1.2 + s * 1.2 + 1.45, z);
      sticks.setMatrixAt(n, m);
      n++;
    }
  }
  people.castShadow = true;
  g.add(people);
  g.add(sticks);
  lightsticks.push(sticks);
  placeAt(g, i, HALF + 5, 0);
}
grandstand(12);
grandstand(N - 34);

// ---------- Team banners ----------
const bannerTexs = TEAMS.map((t) => canvasTex(48, 8, (g, w, h) => {
  g.fillStyle = t.color; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1);
  g.fillStyle = lum(t.color) > 0.55 ? '#0b0b0d' : '#ffffff';
  g.font = '8px "Press Start 2P", monospace';
  g.textBaseline = 'middle';
  g.fillText('E1', 3, h / 2 + 1);
  g.fillText('E1', 30, h / 2 + 1);
  for (let x = 17; x < 27; x += 2) g.fillRect(x, 2, 1, 4);
}));
const bannerMats = bannerTexs.map((map) => new THREE.MeshBasicMaterial({ map }));
{
  let bi = 0;
  for (let i = 60; i < N - 50; i += 26) {
    if (corner[i]) continue;
    const side = bi % 2 ? 1 : -1;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 6.4), bannerMats[bi % bannerMats.length]);
    const o = off(i, side * (HALF + 3.2));
    b.position.set(o[0], 0.9, o[1]);
    b.rotation.y = yawAt(i);
    scene.add(b);
    bi++;
  }
}

// ---------- Tire barriers on the outside of corners ----------
(function tyreBarriers() {
  const pts = [];
  for (let i = 0; i < N; i += 3) {
    if (!corner[i]) continue;
    const s = bend[i] > 0 ? -1 : 1;
    pts.push([i, s * (HALF + 8.8)]);
  }
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 8), toon(0xffffff), pts.length * 2);
  const m = new THREE.Matrix4();
  let n = 0;
  pts.forEach((p, k) => {
    const o = off(p[0], p[1]);
    for (let h = 0; h < 2; h++) {
      m.makeTranslation(o[0], 0.25 + h * 0.47, o[1]);
      im.setMatrixAt(n, m);
      im.setColorAt(n, new THREE.Color((k + h) % 3 === 0 ? '#E10600' : '#1a1a1e'));
      n++;
    }
  });
  im.castShadow = true;
  scene.add(im);
})();

// ---------- Trees and bushes ----------
(function vegetation() {
  const K = WORLD_K, cnt = Math.round(260 * K), bushCnt = Math.round(120 * K);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 2, 5), toon(0x3d2c2a), cnt);
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 5.5, 6), toon(0xffffff), cnt);
  const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 0), toon(0xffffff), bushCnt);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const greens = ['#1c4a3c', '#235645', '#173f35'].map((c) => new THREE.Color(c));
  let n = 0, tries = 0;
  while (n < cnt && tries < 30000) {
    tries++;
    const x = (-260 + Math.random() * 560) * K, z = (-150 + Math.random() * 440) * K;
    const d = minTrackDist(x, z);
    if (d < HALF + 14 || d > 170) continue;
    const k = 0.7 + Math.random() * 0.8;
    q.setFromAxisAngle(up, Math.random() * 6);
    s.set(k, k, k);
    v.set(x, k, z); m.compose(v, q, s); trunks.setMatrixAt(n, m);
    v.set(x, 2 + k * 2.8, z); m.compose(v, q, s); cones.setMatrixAt(n, m);
    cones.setColorAt(n, greens[n % 3]);
    n++;
  }
  trunks.count = cones.count = n;
  trunks.castShadow = cones.castShadow = true;
  scene.add(trunks);
  scene.add(cones);
  let b = 0;
  tries = 0;
  while (b < bushCnt && tries < 30000) {
    tries++;
    const x = (-240 + Math.random() * 520) * K, z = (-130 + Math.random() * 400) * K;
    const d = minTrackDist(x, z);
    if (d < HALF + 10 || d > 120) continue;
    const k = 0.6 + Math.random() * 0.7;
    q.setFromAxisAngle(up, Math.random() * 6);
    s.set(k * 1.3, k, k * 1.3);
    v.set(x, k * 0.8, z);
    m.compose(v, q, s);
    bush.setMatrixAt(b, m);
    bush.setColorAt(b, greens[(b + 1) % 3]);
    b++;
  }
  bush.count = b;
  bush.castShadow = true;
  scene.add(bush);
})();

// ---------- Mountains and clouds ----------
const clouds = [];
(function backdrop() {
  const K = WORLD_K, c = new THREE.Vector3(10 * K, 0, 90 * K);
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2, r = (430 + Math.random() * 60) * K, h = 60 + Math.random() * 90;
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(45 + Math.random() * 40, h, 5), toon(k % 2 ? 0x16224a : 0x1c2a56));
    mtn.position.set(c.x + Math.cos(a) * r, h / 2 - 4, c.z + Math.sin(a) * r);
    mtn.rotation.y = Math.random() * 3;
    scene.add(mtn);
  }
  const cm = new THREE.MeshBasicMaterial({ color: 0x2b3d70, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(14 + j * 4, 4, 8), cm);
      b.position.set(j * 8 - 8, j === 1 ? 2 : 0, (j % 2) * 3);
      g.add(b);
    }
    const a = Math.random() * Math.PI * 2, r = (200 + Math.random() * 180) * K;
    g.position.set(c.x + Math.cos(a) * r, 70 + Math.random() * 40, c.z + Math.sin(a) * r);
    g.userData.v = 1 + Math.random() * 2;
    scene.add(g);
    clouds.push(g);
  }
})();

// ---------- Lampposts with pools of light ----------
(function lampPosts() {
  const postM = toon(0x1b1f2c), bulbM = new THREE.MeshBasicMaterial({ color: 0xd8ecff });
  const poolM = new THREE.MeshBasicMaterial({ color: 0x5f8fff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolG = new THREE.CircleGeometry(5.5, 12).rotateX(-Math.PI / 2);
  let k = 0;
  for (let i = 8; i < N; i += 34) {
    const s = k++ % 2 ? 1 : -1;
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7, 0.35), postM);
    post.position.set(0, 3.5, 0);
    post.castShadow = true;
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 0.3), postM);
    arm.position.set(-1.2, 7, 0);
    g.add(arm);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.6), bulbM);
    bulb.position.set(-2.3, 6.8, 0);
    g.add(bulb);
    const o = off(i, s * (HALF + 2.6));
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = Math.atan2(NR[i].x * s, NR[i].z * s) - Math.PI / 2;
    scene.add(g);
    const pool = new THREE.Mesh(poolG, poolM);
    const po = off(i, s * (HALF - 1.5));
    pool.position.set(po[0], 0.12, po[1]);
    scene.add(pool);
  }
})();

// ---------- Boost pads: [track index, lateral offset] ----------
const padTex = canvasTex(16, 32, (g) => {
  g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, 16, 32);
  for (let r = 0; r < 3; r++) {
    const y = 4 + r * 10;
    g.fillStyle = r === 1 ? '#ffb000' : '#ffe14d';
    for (let x = 0; x < 8; x++) { g.fillRect(x, (y + x / 2) | 0, 1, 3); g.fillRect(15 - x, (y + x / 2) | 0, 1, 3); }
  }
});
export const pads = [[100, 0], [402, -3], [402, 3], [600, 0]];
const padMat = new THREE.MeshBasicMaterial({ map: padTex });
pads.forEach((p) => placeAt(flat(4, 7, padMat, 0.11), p[0], p[1], 0.11));

// ---------- Item boxes ----------
const qTex = canvasTex(12, 12, (g) => {
  g.fillStyle = '#E10600'; g.fillRect(0, 0, 12, 12);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 12, 1); g.fillRect(0, 11, 12, 1); g.fillRect(0, 0, 1, 12); g.fillRect(11, 0, 1, 12);
  const q = ['..XXXX..', '.X....X.', '......X.', '....XX..', '...X....', '........', '...X....'];
  q.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') g.fillRect(2 + x, 2 + y, 1, 1); }));
});
const boxMat = new THREE.MeshBasicMaterial({ map: qTex });
export const boxes = [];
[[150, -4], [150, 0], [150, 4], [330, -4], [330, 0], [330, 4], [520, -4], [520, 0], [520, 4]].forEach((p) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), boxMat);
  const o = off(p[0], p[1]);
  m.position.set(o[0], 1.3, o[1]);
  m.castShadow = true;
  scene.add(m);
  boxes.push({ m, t: 0 });
});

export function resetBoxes() {
  boxes.forEach((b) => { b.t = 0; b.m.visible = true; });
}

export function updateScenery(dt, now) {
  boxes.forEach((b) => {
    b.m.rotation.y += dt * 1.6;
    b.m.rotation.x += dt * 0.7;
    b.m.position.y = 1.3 + Math.sin(now / 300 + b.m.position.x) * 0.15;
    if (!b.m.visible) { b.t -= dt; if (b.t <= 0) b.m.visible = true; }
  });
  clouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 500 * WORLD_K) c.position.x = -480 * WORLD_K; });
  lightsticks.forEach((s, k) => { s.position.y = Math.max(0, Math.sin(now / 170 + k * 2)) * 0.35; });
}

// Redraws the text once the pixel font has loaded.
export function redrawText() {
  [signTex, ...bannerTexs].forEach(redrawTex);
}
