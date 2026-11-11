// Bloody Paradise track scenery, after ENHYPEN's "Bloody Paradise" music video, at golden hour:
// - seaside terrace (start straight): the ocean, a low wall with graffiti, an orange and a white building;
// - market street (east side): brick houses, the green EL CAPULLO arch, yellow pickups, crates, wires, bunting;
// - prison courtyard (top straight): tall cream walls with iron balconies and arched windows, warm lamps,
//   iron trusses overhead, an arched gate at each end;
// - west side: pastel houses and graffiti walls; low houses fill the town around the circuit;
// - a sea of sunset clouds all around the horizon. Red, the colour of the video's jumpsuits and bandanas, ties it together.
// Only built when that track is chosen.
// Cloud band: "Free Sky with Clouds Background Pixel Art Set" by CraftPix (craftpix.net free license), cropped.
// Building facades: "Pixel Facades 100" by najjar320 (free commercial license, not to be redistributed as assets).
// Palms, boats, barrels, pier (public/models/bloody): "PSX The Island Pack" by Caliber Creations (not to be redistributed).
import * as THREE from 'three';
import { scene, camera, toon, canvasTex } from './engine.js';
import { N, HALF, WORLD_K, corner, off, yawAt, minTrackDist, P } from './track.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import cloudsUrl from './assets/bloody/clouds.png';

export const paradiseTexts = [];

// Static pieces are collected here, then merged by material (bake) so the many small parts cost a few draw calls.
const bag = new THREE.Group();
const add = (o) => bag.add(o);
// Shared materials by colour, so merged pieces of the same colour end up in one mesh.
const mats = new Map();
const tm = (c) => { const k = 't' + c; if (!mats.has(k)) mats.set(k, toon(c)); return mats.get(k); };
const bm = (c) => { const k = 'b' + c; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: c })); return mats.get(k); };

// Track index ranges of each part (720 samples, see theme.js for the layout).
const SEASIDE = [[650, 720], [0, 112]];
const MARKET = [150, 276];
const PRISON = [298, 472];
const WEST = [492, 636];
const SEA_Z = -40;           // the shore: the ocean starts south of here

// ---------- Graffiti ----------
// Graffiti: our own colourful tags and blobs on a pale wall.
function graffiti(seed, base = '#d8d2cc') {
  let s = seed;
  const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  return canvasTex(64, 16, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = ['#C8110E', '#2f8ad6', '#f2c12e', '#2fae6a', '#f06eb0', '#7a3fd0', '#1b1b20'];
    for (let k = 0; k < 9; k++) {
      g.fillStyle = cols[(r() * cols.length) | 0];
      const x = (r() * w) | 0, y = 3 + ((r() * (h - 8)) | 0), bw = 5 + ((r() * 12) | 0);
      g.fillRect(x, y, bw, 3 + ((r() * 4) | 0));
      g.fillRect(x + 1, y - 1, bw - 2, 1);
    }
    g.fillStyle = '#1b1b20';
    for (let k = 0; k < 14; k++) { const x = (r() * w) | 0, y = 2 + ((r() * (h - 4)) | 0); g.fillRect(x, y, 2 + ((r() * 4) | 0), 1); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 2, w, 2);
  });
}

// ---------- Building blocks ----------

// ---------- Pixel Facades 100: a piece of a facade picture, the size of the building's front ----------
const FACADE_URLS = import.meta.glob('./assets/bloody/facades/*.png', { eager: true, query: '?url', import: 'default' });
const facadeUrl = (id) => Object.entries(FACADE_URLS).find(([k]) => k.includes('/' + id + '_'))[1];
const pictures = new Map(), pieces = new Map();
/**
 * Texture showing the part of facade `id` with the proportions of a building front (ratio = height / width):
 * the bottom (street floor and shops) or, with 'top', the upper floors. The picture loads in the background.
 */
function facadePiece(id, ratio, from = 'bottom') {
  const key = id + ':' + ratio.toFixed(3) + ':' + from;
  if (pieces.has(key)) return pieces.get(key);
  const t = new THREE.Texture();
  // Crisp pixels up close; mipmaps far away, or the small windows shimmer into moiré at the game's low resolution.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  pieces.set(key, t);
  const url = facadeUrl(id);
  if (!pictures.has(url)) pictures.set(url, new THREE.ImageLoader().loadAsync(url));
  pictures.get(url).then((img) => {
    const rep = Math.min(1, (img.width * ratio) / img.height);
    t.image = img;
    t.repeat.set(1, rep);
    t.offset.set(0, from === 'top' ? 1 - rep - 0.015 : 0);
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}

/** A box building on one side of the track at sample i, its facade on every side (so buildings merge by facade). */
const facadeMats = new Map();
function building(i, side, { w = 14, d = 10, h = 12, facade, gap = 6 }) {
  if (!facadeMats.has(facade)) facadeMats.set(facade, toon(0xffffff, { map: facade }));
  const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), facadeMats.get(facade));
  const o = off(i, side * (HALF + gap + d / 2));
  m.position.set(o[0], h / 2, o[1]);
  m.rotation.y = yawAt(i);
  m.castShadow = true;
  add(m);
  return m;
}

/** Row of buildings along both sides of a range, skipping tight corners. */
function street(range, step, make) {
  let k = 0;
  for (let i = range[0]; i < range[1]; i += step) {
    if (corner[i % N]) continue;
    [-1, 1].forEach((side) => make(i % N, side, k++));
  }
}

// ---------- Seaside: ocean, sun glitter, wall with graffiti ----------
let sea = null, glitter = null;
function ocean() {
  const tex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#3a4a86'; g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 26; k++) {
      g.fillStyle = k % 3 ? '#4f63a3' : '#e7966a';
      g.fillRect((k * 11) % 32, (k * 7) % 32, 3 + (k % 4), 1);
    }
  }, true);
  tex.repeat.set(120, 50);
  // No fog on the sea, so it stays blue out to the clouds.
  sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1000), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(48, 0.06, SEA_Z - 500);
  scene.add(sea);
  // Sunset glitter: a warm path on the water toward the low sun, kept in line with the camera.
  const gt = canvasTex(16, 64, (g) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) {
      const edge = Math.abs(x - 7.5) / 8, far = y / 64;
      if (((x * 7 + y * 13) % 5) === 0 && Math.random() > edge * 0.9) {
        g.fillStyle = far > 0.6 ? '#fff0b8' : '#ffb35c'; g.fillRect(x, y, 2, 1);
      }
    }
  });
  glitter = new THREE.Mesh(new THREE.PlaneGeometry(90, 900), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, fog: false }));
  glitter.rotation.x = -Math.PI / 2;
  glitter.position.set(48, 0.1, SEA_Z - 460);
  scene.add(glitter);
}

function seaWall() {
  const wallMats = [1, 2, 3, 4].map((k) => new THREE.MeshBasicMaterial({ map: graffiti(k * 977) }));
  SEASIDE.forEach((r) => {
    for (let i = r[0]; i < r[1]; i += 6) {
      const j = i % N, o = off(j, HALF + 9);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 13), wallMats[(i / 6) % 4 | 0]);
      wall.position.set(o[0], 0.9, o[1]);
      wall.rotation.y = yawAt(j);
      wall.castShadow = true;
      add(wall);
    }
  });
  // Buildings on the land side of the terrace: the orange one, a white one covered in graffiti.
  building(40, -1, { w: 26, d: 14, h: 16, facade: facadePiece('049', 16 / 26), gap: 10 });
  building(80, -1, { w: 22, d: 12, h: 10, facade: graffiti(4242, '#ece6e0'), gap: 9 });
  building(690, -1, { w: 24, d: 12, h: 13, facade: facadePiece('014', 13 / 24), gap: 10 });
}

// ---------- Market street ----------
// Brick houses with shop fronts on the street floor; pastel houses on the west side.
const MARKET_FACADES = ['004', '022', '091', '009', '025', '094'];
const WEST_FACADES = ['044', '074', '049', '079', '054'];

function pickup(i, lat, back) {
  const g = new THREE.Group();
  const yel = tm(0xe8c13a), dark = tm(0x1b1b20), glass = bm(0x2a3446);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 5), yel); body.position.y = 0.95; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.9), yel); cab.position.set(0, 1.95, 0.9); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.05), glass); ws.position.set(0, 2.05, 1.86); g.add(ws);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 2.6), dark); bed.position.set(0, 1.42, -1.1); g.add(bed);
  [[-1.1, 1.6], [1.1, 1.6], [-1.1, -1.6], [1.1, -1.6]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 8), dark);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w);
  });
  const lights = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.05), bm(0xfff0c0));
  lights.position.set(0, 1.1, 2.52); g.add(lights);
  const o = off(i, lat);
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i) + (back ? Math.PI : 0);
  g.traverse((m) => { m.castShadow = true; });
  add(g);
}

function stall(i, side) {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 4), tm(0x6b4a32)); table.position.y = 0.45; g.add(table);
  const cols = [0xe0782f, 0x2fae6a, 0xC8110E, 0xf2c12e];
  for (let k = 0; k < 4; k++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), tm(cols[(k + i) % 4]));
    c.position.set((k % 2) * 0.9 - 0.45, 1.15, (k >> 1) * 1.6 - 0.8); g.add(c);
  }
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 4.6), tm(0xC8110E)); awning.position.y = 2.6; g.add(awning);
  const o = off(i, side * (HALF + 4.2));
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i);
  add(g);
}

// The green arch over the road with yellow letters, like the shop sign in the video.
function capulloArch(i) {
  const tex = canvasTex(128, 64, (g, w, h) => {
    const cx = w / 2, cy = h - 6;
    for (let r = 58; r > 36; r--) {
      g.fillStyle = r > 55 || r < 39 ? '#e6c02e' : '#2f9a52';
      for (let a = 0; a <= 180; a += 0.5) {
        const t = (a * Math.PI) / 180;
        g.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy - Math.sin(t) * r * 0.95), 1, 1);
      }
    }
    // Lettering along the arch.
    const text = 'EL CAPULLO';
    g.fillStyle = '#ffe14d';
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < text.length; k++) {
      const t = Math.PI * (0.86 - (0.72 * k) / (text.length - 1));
      g.save();
      g.translate(cx + Math.cos(t) * 47, cy - Math.sin(t) * 47 * 0.95);
      g.rotate(Math.PI / 2 - t);
      g.fillText(text[k], 0, 1);
      g.restore();
    }
  });
  paradiseTexts.push(tex);
  const grp = new THREE.Group();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 8, (HALF * 2 + 8) / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  sign.position.y = 6 + (HALF * 2 + 8) / 4;
  grp.add(sign);
  const postM = tm(0x2f9a52);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), postM);
    p.position.set(s * (HALF + 3.4), 3.5, 0); p.castShadow = true; grp.add(p);
  });
  // The arch faces along the road: rotate the plane to stand across it.
  sign.rotation.y = 0;
  const o = off(i, 0);
  grp.position.set(o[0], 0, o[1]);
  grp.rotation.y = yawAt(i);
  add(grp);
}

// Bunting across the road: little red and cream flags (the bandana red).
const buntTex = canvasTex(32, 8, (g) => {
  g.fillStyle = '#2a2024'; g.fillRect(0, 0, 32, 1);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = k % 2 ? '#f3e6d6' : '#C8110E';
    for (let y = 1; y < 7; y++) g.fillRect(k * 4 + Math.floor(y / 2), y, Math.max(1, 4 - y), 1);
  }
});
buntTex.wrapS = THREE.RepeatWrapping;
function bunting(i, y, span) {
  const t = buntTex.clone(); t.needsUpdate = true; t.repeat.set(span / 4, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  const o = off(i, 0);
  m.position.set(o[0], y, o[1]);
  m.rotation.y = yawAt(i);
  add(m);
}

// Overhead wires across the street, sagging a little.
function wires() {
  const pos = [];
  for (let i = MARKET[0]; i < MARKET[1]; i += 9) {
    const a = off(i, -(HALF + 6)), b = off((i + 5) % N, HALF + 6), y0 = 9 + (i % 3), y1 = 10 - (i % 2);
    let prev = [a[0], y0, a[1]];
    for (let k = 1; k <= 6; k++) {
      const t = k / 6, sag = Math.sin(t * Math.PI) * 1.4;
      const p = [a[0] + (b[0] - a[0]) * t, y0 + (y1 - y0) * t - sag, a[1] + (b[1] - a[1]) * t];
      pos.push(...prev, ...p);
      prev = p;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1b1418 })));
}

function market() {
  street(MARKET, 9, (i, side, k) => {
    const h = 9 + ((k * 5) % 3) * 3.5;
    building(i, side, { w: 16, d: 10, h, facade: facadePiece(MARKET_FACADES[k % MARKET_FACADES.length], h / 16) });
  });
  wires();
  [MARKET[0] + 30, MARKET[0] + 92].forEach((i) => bunting(i, 8.4, HALF * 2 + 12));
  capulloArch(MARKET[0] + 60);
  pickup(MARKET[0] + 20, HALF + 3.2, false);
  pickup(MARKET[0] + 75, -(HALF + 3.2), true);
  pickup(MARKET[0] + 108, HALF + 3.2, false);
  [12, 46, 84, 116].forEach((d, k) => stall(MARKET[0] + d, k % 2 ? 1 : -1));
}

// ---------- Prison courtyard ----------
function prison() {
  // Cream walls with iron balconies on every floor (the upper floors of two Mediterranean facades).
  const facs = [facadePiece('048', 1, 'top'), facadePiece('041', 1, 'top')];
  for (let i = PRISON[0], k = 0; i < PRISON[1]; i += 8, k++) {
    [-1, 1].forEach((side) => building(i, side, { w: 18, d: 4, h: 18, facade: facs[(k + (side > 0 ? 1 : 0)) % 2], gap: 7 }));
  }
  // Iron trusses across the courtyard, and warm lamps hanging from them.
  const ironM = tm(0x2a2024), bulbM = bm(0xffd27a);
  const poolM = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolG = new THREE.CircleGeometry(5, 12).rotateX(-Math.PI / 2);
  for (let i = PRISON[0] + 12; i < PRISON[1] - 6; i += 22) {
    const g = new THREE.Group();
    const span = (HALF + 7) * 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.6, 0.6), ironM); beam.position.y = 17; g.add(beam);
    const low = new THREE.Mesh(new THREE.BoxGeometry(span, 0.3, 0.3), ironM); low.position.y = 15.2; g.add(low);
    for (let x = -span / 2 + 2; x < span / 2; x += 3) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), ironM);
      d.position.set(x, 16.1, 0); d.rotation.z = (x / 3) % 2 ? 0.6 : -0.6; g.add(d);
    }
    [-4, 4].forEach((x) => {
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), ironM); cord.position.set(x, 13.2, 0); g.add(cord);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), bulbM); lamp.position.set(x, 11, 0); g.add(lamp);
      const pool = new THREE.Mesh(poolG, poolM); pool.position.set(x, 0.12, 0); g.add(pool);
    });
    const o = off(i, 0);
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = yawAt(i);
    add(g);
  }
  // Arched gates at both ends.
  [PRISON[0] - 2, PRISON[1] - 2].forEach((i) => {
    const g = new THREE.Group(), stoneM = tm(0xe6cfa3), r = HALF + 3;
    [-1, 1].forEach((s) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), stoneM); p.position.set(s * (r + 1), 6, 0); p.castShadow = true; g.add(p);
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 1, 1.5, 4, 14, Math.PI), stoneM);
    arch.position.y = 12; g.add(arch);
    const top = new THREE.Mesh(new THREE.BoxGeometry(r * 2 + 8, 3, 3.2), stoneM); top.position.y = 12 + r + 2.4; g.add(top);
    const o = off(i, 0);
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = yawAt(i);
    add(g);
  });
}

// ---------- West side: pastel houses and graffiti walls ----------
function westSide() {
  const westWalls = [31, 132, 233].map((seed) => new THREE.MeshBasicMaterial({ map: graffiti(seed) }));
  street(WEST, 14, (i, side, k) => {
    if (k % 3 === 2) {   // a graffiti wall instead of a house
      const o = off(i, side * (HALF + 6));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 14), westWalls[k % westWalls.length]);
      m.position.set(o[0], 1.5, o[1]);
      m.rotation.y = yawAt(i);
      add(m);
      return;
    }
    const h = 8 + (k % 2) * 4;
    building(i, side, { w: 15, d: 10, h, facade: facadePiece(WEST_FACADES[k % WEST_FACADES.length], h / 15), gap: 7 });
  });
}

// ---------- The town around the circuit: low flat-roofed houses (one draw call) ----------
function town() {
  // Four kinds of house, each a facade on an instanced box: four draw calls for the whole town.
  const K = WORLD_K, cnt = Math.round(240 * K), kinds = ['091', '044', '022', '079'];
  const ims = kinds.map((id) => new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff, { map: facadePiece(id, 0.8) }), Math.ceil(cnt / kinds.length)));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let n = 0, tries = 0;
  while (n < cnt && tries < 40000) {
    tries++;
    const x = (-300 + Math.random() * 680) * K, z = (-20 + Math.random() * 440) * K;
    if (z < SEA_Z + 14) continue;
    const d = minTrackDist(x, z);
    if (d < HALF + 26 || d > 260) continue;
    const w = 10 + Math.random() * 6, h = w * (0.7 + Math.random() * 0.2);
    q.setFromAxisAngle(up, (Math.random() < 0.5 ? 0 : Math.PI / 2) + 0.1);
    s.set(w, h, w); v.set(x, h / 2, z);
    m.compose(v, q, s);
    ims[n % kinds.length].setMatrixAt(Math.floor(n / kinds.length), m);
    n++;
  }
  ims.forEach((im, k) => {
    im.count = Math.floor(n / kinds.length) + (k < n % kinds.length ? 1 : 0);
    im.castShadow = true;
    scene.add(im);
  });
}

// ---------- PSX models: palms by the sea and in the town, boats, a pier, barrels by the stalls ----------
const loader = new GLTFLoader();
/** The meshes of a model in public/models/bloody, each as { geometry, material } with our toon look. */
function model(name) {
  return loader.loadAsync('/models/bloody/' + name + '.gltf').then((gltf) => {
    const parts = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const map = o.material.map;
      if (map) { map.encoding = THREE.LinearEncoding; map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; }
      const leaves = o.material.transparent;
      parts.push({ geometry: o.geometry, material: toon(0xffffff, { map, side: THREE.DoubleSide, alphaTest: leaves ? 0.5 : 0 }) });
    });
    return parts;
  });
}

/** Many copies of a model in one draw call per part: spots are [x, z, rotation, scale]. */
function scatter(parts, spots, y = 0) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  parts.forEach(({ geometry, material }) => {
    const im = new THREE.InstancedMesh(geometry, material, spots.length);
    spots.forEach(([x, z, r, k], n) => { q.setFromAxisAngle(up, r); s.set(k, k, k); v.set(x, y, z); m.compose(v, q, s); im.setMatrixAt(n, m); });
    im.castShadow = true;
    scene.add(im);
  });
}

const floating = [];
function props() {
  // Palms: along the land side of the seaside terrace, and around the town.
  const spots = [];
  for (let i = 0; i < 60; i += 4) {
    const o = off((650 + i * 3) % N, -(HALF + 5 + (i % 3) * 4));
    spots.push(o);
  }
  for (let k = 0; k < 22; k++) spots.push([(-200 + Math.random() * 520) * WORLD_K, (40 + Math.random() * 260) * WORLD_K]);
  const ok = spots.filter(([x, z]) => minTrackDist(x, z) >= HALF + 4).map(([x, z]) => [x, z, Math.random() * 6.28, 0.9 + Math.random() * 0.35]);
  ['SM_TI_Palm_Tree_0', 'SM_TI_Palm_Tree_3', 'SM_TI_Palm_Tree_6'].forEach((name, v) => {
    model(name).then((parts) => scatter(parts, ok.filter((_, n) => n % 3 === v))).catch(() => {});
  });
  // Barrels by the market stalls.
  model('SM_TI_Wood_1_Barrel_0').then((parts) => {
    const b = [];
    [10, 44, 82, 114].forEach((d, k) => {
      const side = k % 2 ? 1 : -1;
      [[0, 0], [1.6, 0.4]].forEach(([dz, dl]) => { const o = off((MARKET[0] + d + 3 + dz) % N, side * (HALF + 4.6 + dl)); b.push([o[0], o[1], k, 1.1]); });
    });
    scatter(parts, b);
  }).catch(() => {});
  // Fishing boats bobbing off the terrace, and a wooden pier into the sea.
  [['SM_TI_Wood_0_Boat_0', 120, -70, 0.4], ['SM_TI_Wood_1_Boat_0', 150, -64, 2.2], ['SM_TI_Wood_0_Boat_0', -60, -82, 1.3], ['SM_TI_Wood_1_Boat_0', 260, -90, 0.9]].forEach(([name, x, z, r]) => {
    model(name).then((parts) => parts.forEach(({ geometry, material }) => {
      const b = new THREE.Mesh(geometry, material);
      b.position.set(x, 0.3, z); b.rotation.y = r; b.scale.setScalar(1.6);
      b.userData.phase = Math.random() * 6;
      scene.add(b); floating.push(b);
    })).catch(() => {});
  });
  model('SM_TI_Wood_0_Pier_0').then((parts) => parts.forEach(({ geometry, material }) => {
    const p = new THREE.Mesh(geometry, material);
    p.position.set(80, 0.9, SEA_Z - 2); p.rotation.y = Math.PI; p.scale.setScalar(1.3);
    scene.add(p);
  })).catch(() => {});
}

// The sea of sunset clouds on the horizon.
function cloudBand() {
  const tex = new THREE.TextureLoader().load(cloudsUrl);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(5, 1);
  const r = 860, h = 150;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  const c = new THREE.Vector3();
  P.forEach((p) => c.add(p)); c.divideScalar(P.length);
  m.position.set(c.x, h / 2 - 4, c.z);
  m.renderOrder = 1;
  scene.add(m);
}

/** Merges the collected pieces: one mesh per material; pieces with several materials (buildings) stay as they are. */
function bake() {
  bag.updateMatrixWorld(true);
  const groups = new Map(), keep = [];
  bag.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) { keep.push(o); return; }
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const e = groups.get(o.material) || { geos: [], shadow: false };
    e.geos.push(g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]));
    e.shadow = e.shadow || o.castShadow;
    groups.set(o.material, e);
  });
  groups.forEach((e, mat) => {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(e.geos), mat);
    m.castShadow = e.shadow;   // casts on the road, but doesn't receive: walls would get shadow acne stripes
    scene.add(m);
    e.geos.forEach((g) => g.dispose());
  });
  keep.forEach((o) => {
    o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
    scene.add(o);
  });
}

export function buildParadise() {
  cloudBand();
  ocean();
  seaWall();
  market();
  prison();
  westSide();
  town();
  bake();
  props();
}

export function updateParadise(dt, now) {
  if (sea) sea.material.map.offset.x = (now / 60000) % 1;
  floating.forEach((b) => { b.position.y = 0.3 + Math.sin(now / 700 + b.userData.phase) * 0.15; b.rotation.z = Math.sin(now / 900 + b.userData.phase) * 0.05; });
  if (glitter) {
    // On the line from the camera toward the sun (moonDir in theme.js: x 0.1, z -0.97).
    glitter.position.x = camera.position.x - (0.1 / 0.97) * (glitter.position.z - camera.position.z);
    glitter.material.opacity = 0.65 + Math.sin(now / 500) * 0.15;
  }
}
