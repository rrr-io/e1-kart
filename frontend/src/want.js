// "I Want You" track scenery, after ENHYPEN's "I Want You" music video. Two worlds on the same road:
// - A, the one we know: a village of wooden houses with lit windows in warm afternoon light (start straight, with the
//   clock tower), a busy city street (tall buildings, shop signs, parked cars, people on the pavements, the bus, the
//   billboard THE LIFE WE LEFT ELSEWHERE), then a snowy pine forest with a few cabins, mountains all around;
// - B, the parallel one: the same places after a catastrophe, deserted. A cold starless night, fog and grey ash instead of snow, the
//   city on fire with burnt cars, rubble and fallen poles, no one in the streets, signs dead, the clock running
//   backwards, embers on the road (they slow the karts down).
// Lap 1 is world A. On lap 2 the world glitches at the gates of the city and stays B. On lap 3 the two worlds keep
// swapping, faster and faster, and the fire has reached the village and the forest. Only built when the track is chosen.
// Flames: "Pixel Fire Asset Pack" (v2.2). City facades: "Pixel Facades 100" by najjar320 (the Bloody Paradise atlas).
// Neither to be redistributed as assets.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene, camera, canvas, toon, canvasTex } from './engine.js';
import { THEME } from './theme.js';
import { N, HALF, P, NR, off, yawAt, minTrackDist } from './track.js';
import { G, player } from './state.js';
import { setShift } from './sky.js';
import { banner } from './hud.js';
import { sfx, musicGlitch } from './audio.js';
import fireUrl from './assets/want/fire.png';
import xmasUrl from './assets/want/xmas.png';   // stall, cart, lamp, wreath: "Cozy Christmas Exteriors" demo by MattIAco Studio
import atlasUrl from './assets/bloody/facade-atlas.png';
import bigUrl from './assets/want/bighouse.png';   // front of the big house, built from the "RowHouseTileSet" (non-commercial use)
import rowUrl from './assets/want/rowhouses.png';   // brick row houses: the examples of "Modular Pixel Houses"
import FACADE from './assets/bloody/facade-atlas.json';
const ATLAS = FACADE;

export const wantTexts = [];

// The same village for everyone.
let seed = 20261113;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[(rand() * a.length) | 0];

const GLITCH_AT = 150;   // lap 2: the world breaks here, in front of the big house, at the gates of the city
const CITY = [178, 460], WALL = [464, 488], FOREST = [490, 640], FIELD = [650, 712];
const FAIR = [CITY[0], CITY[0] + 38], FAIR_SIDE = -1;   // the funfair, on one side of the first stretch of the city
const inZone = (i, z) => i >= z[0] && i < z[1];
// Lap 3: [from index, world]. The swaps come closer together towards the finish.
const LAP3 = [[0, 1], [110, 0], [230, 1], [330, 0], [410, 1], [480, 0], [540, 1], [590, 0], [630, 1]];

const mats = {};
const tm = (c) => mats['t' + c] || (mats['t' + c] = toon(c));
const bag = new THREE.Group();
const add = (m) => { bag.add(m); return m; };
const pixel = (t) => { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
const load = (url) => pixel(new THREE.TextureLoader().load(url));

// Windows: lit and warm in world A. In world B the ordinary ones are dark; those of burning houses flicker orange.
const WARM = new THREE.Color(0xffd98a), DARK = new THREE.Color(0x10142c), FLAME = new THREE.Color(0xff7a1c);
const winM = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: WARM.clone() }));   // [never burns, burns from lap 2, burns on lap 3]
const emberM = new THREE.MeshBasicMaterial({ color: 0xff7a1c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

// Brick, like the houses of the video: courses 4 px high, joints staggered.
const plankTex = (base, dark) => canvasTex(16, 16, (g) => {
  g.fillStyle = dark; g.fillRect(0, 0, 16, 16);
  g.fillStyle = base;
  for (let r = 0; r < 4; r++) for (let x = -8; x < 16; x += 8) g.fillRect(x + (r % 2) * 4 + 1, r * 4 + 1, 7, 3);
}, true);
const WALLS = [['#9c4a3c', '#6e3329'], ['#a8523f', '#7a3a2c'], ['#8a4438', '#5f2e26'], ['#b0604a', '#7f4032'], ['#d8cdbb', '#b3a691']];
const bulbM = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
let wallMats = null;

const fires = [];    // { s: sprite, level }
const embers = [];   // { x, z, level, m }
let level = 0, world = 0;

function house(i, side, big, burn) {
  const lat = side * (HALF + (big ? 15 : 10 + rand() * 6));
  const o = off(i, lat);
  if (minTrackDist(o[0], o[1]) < HALF + (big ? 9 : 6.5)) return null;
  const w = big ? 14.4 : 8 + rand() * 3, d = big ? 11 : 7 + rand() * 2, h = big ? 8.8 : 4.6 + rand() * 1.6, rh = big ? 5.5 : 3 + rand() * 1.2;
  const g = new THREE.Group();
  const wall = big ? wallMats[0] : pick(wallMats);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2; body.castShadow = true;
  // box UVs repeat the planks every 2 m
  const uv = body.geometry.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 2), uv.getY(k) * (h / 2));
  g.add(body);
  // pitched roof under snow, with an overhang
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 - 0.7, 0); sh.lineTo(0, rh); sh.lineTo(w / 2 + 0.7, 0); sh.lineTo(-w / 2 - 0.7, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d + 1.2, bevelEnabled: false }), tm(0xf4f7fc));
  roof.position.set(0, h, -d / 2 - 0.6); roof.castShadow = true;
  g.add(roof);
  const gable = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 0.35, d + 1.3), tm(0x5a3d2a));
  gable.position.y = h; g.add(gable);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(1, rh + 1.2, 1), tm(0x8a4a3a));
  ch.position.set(w * 0.25, h + rh / 2 + 0.3, 0); g.add(ch);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), tm(0xf4f7fc));
  cap.position.set(w * 0.25, h + rh + 1, 0); g.add(cap);
  // door and windows on the side facing the road
  if (!big) { const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), tm(0x5a3d2a)); door.position.set(-w * 0.22, 1.3, d / 2 + 0.05); g.add(door); }
  const wm = winM[burn];
  const win = (x, y, ww = 1.5, hh = 1.5) => {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.4, hh + 0.4, 0.15), tm(0xfdf6e6)); fr.position.set(x, y, d / 2 + 0.04); g.add(fr);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), wm); p.position.set(x, y, d / 2 + 0.14); g.add(p);
  };
  if (big) {
    // its front is drawn: red brick, white corner stones and cornice, curtained windows (288 x 176 px, 20 px per metre)
    const ft = load(bigUrl), front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(0xd9c6c0, { map: ft }));   // toned down to sit with the other bricks
    front.position.set(0, h / 2, d / 2 + 0.04); g.add(front);
    // the white porch with its pediment, and a potted conifer on each side of the door
    const white = tm(0xeae6de);
    [-1.7, 1.7].forEach((x) => { const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 0.4), white); col.position.set(x, 1.8, d / 2 + 1.6); g.add(col); });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 2.2), white); slab.position.set(0, 3.8, d / 2 + 1); g.add(slab);
    const ps = new THREE.Shape(); ps.moveTo(-2.4, 0); ps.lineTo(0, 1.5); ps.lineTo(2.4, 0); ps.lineTo(-2.4, 0);
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 2.3, bevelEnabled: false }), white); ped.position.set(0, 4, d / 2 - 0.1); g.add(ped);
    [-2.9, 2.9].forEach((x) => {
      const pot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), tm(0xb5714a)); pot.position.set(x, 0.4, d / 2 + 1.8); g.add(pot);
      const con = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 6), tm(0x2f6b4f)); con.position.set(x, 2.1, d / 2 + 1.8); g.add(con);
    });
  }
  else { win(w * 0.2, 2.4); if (h > 5.4) win(-w * 0.22, h - 1.3, 1.2, 1.1); }
  // a side window too, so the houses don't look blind from the road ahead
  [-1, 1].forEach((sx) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), wm); p.position.set(sx * (w / 2 + 0.03), 2.5, 0); p.rotation.y = sx * Math.PI / 2; g.add(p); });
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = Math.atan2(-side * NR[i].x, -side * NR[i].z);
  add(g);
  if (burn) {
    // flames on the roof and at the windows (sprites, not baked), and embers that fall on the road in front
    const n = big ? 9 : 5;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(fireMat[k % fireMat.length]);
      const sc = (big ? 8 : 6) * (0.75 + rand() * 0.6);
      s.scale.set(sc, sc * 2, 1);
      const lx = (rand() - 0.5) * w * 0.9, onRoof = k % 3 !== 2;
      const v = new THREE.Vector3(lx, onRoof ? h + rh * 0.4 + sc * 0.8 : 2 + sc * 0.8, onRoof ? (rand() - 0.5) * d * 0.6 : d / 2 + 0.6).applyEuler(g.rotation).add(g.position);
      s.position.copy(v); s.visible = false; s.renderOrder = 3;
      scene.add(s);
      fires.push({ s, level: burn });
    }
    // the glow of the fire in the air above the house
    const gl = new THREE.Sprite(glowMat);
    gl.scale.set(big ? 60 : 38, big ? 46 : 30, 1); gl.position.set(o[0], h + rh + 4, o[1]); gl.visible = false; gl.renderOrder = 2;
    scene.add(gl);
    fires.push({ s: gl, level: burn });
    for (let k = 0; k < (big ? 5 : 3); k++) {
      const eo = off((i + Math.round((rand() - 0.5) * 10) + N) % N, (rand() - 0.5) * (HALF * 2 - 3));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), emberM);
      m.rotation.x = -Math.PI / 2; m.position.set(eo[0], 0.13, eo[1]); m.visible = false;
      scene.add(m);
      embers.push({ x: eo[0], z: eo[1], level: burn, m });
    }
  }
  return { x: o[0], z: o[1], r: Math.max(w, d) * 0.75 };
}

let fireMat = [];
// The glow around a fire. Computed pixel by pixel instead of drawn on a canvas: on iPhone the almost transparent pixels
// of a canvas gradient came out as green squares (premultiplied alpha), all over the sky behind the fires.
const glowTex = (() => {
  const S = 32, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.min(1, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2)), k = (1 - r) * (1 - r), i = (y * S + x) * 4;
    d[i] = 255; d[i + 1] = Math.round(70 + 90 * k); d[i + 2] = Math.round(20 * k); d[i + 3] = Math.round(190 * k);
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
})();
const glowMat = new THREE.SpriteMaterial({ map: glowTex, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const taken = [];
function village() {
  wallMats = WALLS.map(([b, k]) => toon(0xffffff, { map: plankTex(b, k) }));
  const fireTex = [0, 1].map(() => { const t = load(fireUrl); t.repeat.set(1 / 14, 1); return t; });
  fireMat = fireTex.map((t) => new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
  fireMat.forEach((m, k) => { m.userData.ph = k * 5; });
  // the big house where the world breaks, then houses on both sides of the road
  const big = house(GLITCH_AT + 14, 1, true, 1);
  if (big) taken.push(big);
  const BURN2 = new Set([24, 44, 74, 104, 124, 414, 454, 474, 504, 544, 564, 594, 614, 644, 664, 694]);   // houses that have caught fire by lap 3
  for (let i = 4; i < N; i += 10) {
    if (inZone(i, [CITY[0] - 8, WALL[1]]) || inZone(i, [FIELD[0] - 6, FIELD[1]])) continue;
    for (const side of [-1, 1]) {
      if (rand() < (inZone(i, FOREST) ? 0.8 : 0.25)) continue;
      const near = Math.abs(i - (GLITCH_AT + 14)) < 22;
      const burn = near && side === 1 ? 0 : near ? 1 : BURN2.has(i) ? 2 : 0;
      const o = off(i, side * (HALF + 13));
      if (taken.some((t) => Math.hypot(t.x - o[0], t.z - o[1]) < t.r + 7)) continue;
      const h = house(i, side, false, burn);
      if (h) taken.push(h);
    }
  }
}

// Pieces that only exist in one of the two worlds: people in A; rubble, wrecks and fallen poles in B.
const aliveBag = new THREE.Group(), ruinBag = new THREE.Group();
let alive = null, ruin = null;

const flame = (x, y, z, sc, lvl, k = 0) => {
  const s = new THREE.Sprite(fireMat[k % fireMat.length]);
  s.scale.set(sc, sc * 2, 1); s.position.set(x, y + sc * 0.8, z); s.visible = false; s.renderOrder = 3;
  scene.add(s); fires.push({ s, level: lvl });
};
const glow = (x, y, z, w, lvl) => {
  const s = new THREE.Sprite(glowMat);
  s.scale.set(w, w * 0.78, 1); s.position.set(x, y, z); s.visible = false; s.renderOrder = 2;
  scene.add(s); fires.push({ s, level: lvl });
};
const smokes = [];
const smokeMat = new THREE.SpriteMaterial({ map: canvasTex(16, 32, (g) => {
  for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(${20 + k * 3},${16 + k * 2},${18 + k * 2},${0.75 - k * 0.07})`; g.fillRect(4 - (k % 3), 30 - k * 3.4, 8 + (k % 4) * 2, 4); }
}), fog: false, transparent: true, depthWrite: false });
const smoke = (x, y, z, lvl) => {
  const s = new THREE.Sprite(smokeMat);
  s.scale.set(16, 44, 1); s.position.set(x, y + 22, z); s.visible = false; s.renderOrder = 1;
  s.userData = { y: y + 22, ph: rand() * 6 };
  scene.add(s); fires.push({ s, level: lvl }); smokes.push(s);
};
const ember = (i, lvl) => {
  const eo = off((i + N) % N, (rand() - 0.5) * (HALF * 2 - 3));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), emberM);
  m.rotation.x = -Math.PI / 2; m.position.set(eo[0], 0.13, eo[1]); m.visible = false;
  scene.add(m); embers.push({ x: eo[0], z: eo[1], level: lvl, m });
};

// ----- City: the 38 facades of the Bloody Paradise atlas, 12 px per metre -----
// no art nouveau fronts: they are green, and look wrong in a brick town (and worse behind the flames)
const PX = 12, AW = ATLAS.size[0], AH = ATLAS.size[1], FACADES = Object.keys(ATLAS.rects).filter((id) => ATLAS.rects[id][4] !== 'art_nouveau');
const BRICK = FACADES.filter((id) => ['brownstone', 'warehouse'].includes(ATLAS.rects[id][4]));   // the city of the video is red brick
// Row houses (rowhouses.png): whole fronts, bottom-aligned; the last cell is the roof colour.
const ROW = { size: [671, 367], rects: { navy: [0, 0, 124, 367], green: [124, 170, 174, 197], red: [298, 58, 182, 309], sage: [480, 94, 175, 273] }, roofs: { concrete: [655, 0, 16, 16] } };
// Drawn at 30 px per metre (the door is 3 m): each house is 4 to 6 m wide, so a plot takes two of them side by side.
const ROW_PX = 30, ROW_PAIRS = [['navy', 'red'], ['red', 'navy'], ['red', 'sage'], ['sage', 'red'], ['red', 'red'], ['green', 'red'], ['navy', 'sage']];
function facadeBox(d, h, w, id, ATLAS = FACADE, AW = ATLAS.size[0], AH = ATLAS.size[1]) {
  const g = new THREE.BoxGeometry(d, h, w), uv = g.attributes.uv;
  const cut = (fw) => { const [x, y, rw, rh] = ATLAS.rects[id]; const side = ATLAS !== FACADE && fw !== w, cw = ATLAS === FACADE ? Math.min(rw, fw * PX) : side ? 6 : rw, ch = ATLAS === FACADE ? Math.min(rh, h * PX) : rh, cx = side ? x + 1 : x + (rw - cw) * rand(), cy = y + rh - ch; return [cx / AW, 1 - (cy + ch) / AH, (cx + cw) / AW, 1 - cy / AH]; };
  const [rx, ry, rw, rh] = ATLAS.roofs.concrete, roof = [rx / AW, 1 - (ry + rh) / AH, (rx + rw) / AW, 1 - ry / AH];
  [cut(w), cut(w), roof, roof, cut(d), cut(d)].forEach(([u0, v0, u1, v1], f) => { for (let k = f * 4; k < f * 4 + 4; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0)); });
  return g;
}
const SIGNS = ['CAFE', '24H', 'MART', 'NOODLES', 'PC ROOM', 'KARAOKE', 'BOOKS', 'BAKERY', 'FLOWERS', 'PHARMACY', 'LAUNDRY', 'RECORDS'];
// painted boards in the colours of a brick street: [board, lettering]
const SIGN_COLS = [['#efe4cf', '#3a2420'], ['#6e2a22', '#f3ead8'], ['#8fae8c', '#2a3a2c'], ['#d9a441', '#3a2420'], ['#9db4c4', '#26324a'], ['#f3ead8', '#8a2a22']];
const signM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const lightM = new THREE.MeshBasicMaterial({ color: 0x3aff7a });   // traffic lights
const boardM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const CAR_COLS = [0xd8d8dc, 0x2a2a30, 0xc8110e, 0x2f5fa8, 0xe8c04a, 0x5f8f8a];
let carM = null, peopleM = null;

function car(i, lat, burnt) {
  const o = off(i, lat), g = new THREE.Group(), m = pick(carM);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), m); body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), tm(0x20242c)); cab.position.set(0, 1.5, -0.2); g.add(cab);
  [[-0.95, -1.3], [0.95, -1.3], [-0.95, 1.3], [0.95, 1.3]].forEach(([x, z]) => { const wh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.7), tm(0x121216)); wh.position.set(x, 0.35, z); g.add(wh); });
  g.position.set(o[0], 0, o[1]); g.rotation.y = yawAt(i) + (rand() - 0.5) * 0.12;
  add(g);
  if (burnt) { flame(o[0], 0.6, o[1], 3.2, 1, i); ember(i, 1); }
}

function city() {
  const atlas = new THREE.TextureLoader().load(atlasUrl);
  atlas.magFilter = THREE.NearestFilter; atlas.minFilter = THREE.LinearMipmapLinearFilter;
  const facM = toon(0xffffff, { map: atlas });
  const rowTex = new THREE.TextureLoader().load(rowUrl);
  rowTex.magFilter = THREE.NearestFilter; rowTex.minFilter = THREE.LinearMipmapLinearFilter;
  const rowM = toon(0xffffff, { map: rowTex });
  carM = CAR_COLS.map((c) => toon(c));
  // shop signs: one texture, 4 x 3 names
  const signTex = canvasTex(256, 96, (g) => {
    SIGNS.forEach((t, k) => {
      const x = (k % 4) * 64, y = ((k / 4) | 0) * 32;
      const [bg, ink] = SIGN_COLS[k % SIGN_COLS.length];
      g.fillStyle = bg; g.fillRect(x, y, 64, 32);
      g.fillStyle = ink; g.fillRect(x + 1, y + 1, 62, 1); g.fillRect(x + 1, y + 30, 62, 1); g.fillRect(x + 1, y + 1, 1, 30); g.fillRect(x + 62, y + 1, 1, 30);
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const parts = t.split(' ');
      parts.forEach((w, n) => g.fillText(w.slice(0, 7), x + 32, y + 17 + (n - (parts.length - 1) / 2) * 11));
    });
  });
  signM.map = signTex; wantTexts.push(signTex);
  const signGeo = (k) => { const g = new THREE.PlaneGeometry(5, 2.5), uv = g.attributes.uv, u0 = (k % 4) / 4, v1 = 1 - ((k / 4) | 0) / 3; for (let n = 0; n < 4; n++) uv.setXY(n, u0 + uv.getX(n) / 4, v1 - (1 - uv.getY(n)) / 3); return g; };
  // people for the pavements: 6 figures in winter coats
  const COATS = ['#c8110e', '#2a3a6a', '#e8d9b8', '#3a7a58', '#1b1b20', '#d9a05a'];
  peopleM = new THREE.MeshBasicMaterial({ map: canvasTex(48, 16, (g) => {
    COATS.forEach((c, k) => {
      const x = k * 8;
      g.fillStyle = '#f0c8a0'; g.fillRect(x + 3, 1, 3, 3);
      g.fillStyle = k % 2 ? '#1b1b20' : '#5a3d2a'; g.fillRect(x + 3, 0, 3, 1); g.fillRect(x + 2, 1, 1, 2);
      g.fillStyle = c; g.fillRect(x + 2, 4, 5, 7); g.fillRect(x + 1, 5, 1, 4); g.fillRect(x + 7, 5, 1, 4);
      g.fillStyle = k % 3 ? '#C8110E' : '#f3ead8'; g.fillRect(x + 3, 4, 3, 1);   // scarf
      g.fillStyle = '#20242c'; g.fillRect(x + 3, 11, 1, 5); g.fillRect(x + 5, 11, 1, 5);
    });
  }), alphaTest: 0.5, side: THREE.DoubleSide });
  const person = (i, lat) => {
    const o = off(i, lat), k = (rand() * 6) | 0, g = new THREE.PlaneGeometry(1.1, 2.2), uv = g.attributes.uv;
    for (let n = 0; n < 4; n++) uv.setX(n, (k + uv.getX(n)) / 6);
    const m = new THREE.Mesh(g, peopleM); m.position.set(o[0], 1.1, o[1]); m.rotation.y = yawAt(i) + (rand() < 0.5 ? 0 : Math.PI) + (rand() - 0.5);
    aliveBag.add(m);
  };

  const STEP = 6;
  for (let i = CITY[0]; i < CITY[1]; i += STEP) {
    for (const side of [-1, 1]) {
      // front row on the pavement, a taller row behind it
      let lat = HALF + 5.5;
      for (let row = 0; row < 2; row++) {
        const d = 8 + rand() * 4, w = STEP * 1.9 + (row ? 3 : 0);
        let h = row ? 22 + rand() * 18 : 9 + rand() * 16;
        // half of the plots on the street are a pair of brick row houses, each at the size of its drawing
        const pair = !row && rand() < 0.5 ? pick(ROW_PAIRS) : null;
        if (pair) h = Math.max(...pair.map((id) => ROW.rects[id][3] / ROW_PX));
        const o = off(i + STEP / 2, side * (lat + d / 2));
        lat += d + 1.5;
        if (minTrackDist(o[0], o[1]) < HALF + 4.5 + (row ? 8 : 0)) continue;
        if (side === FAIR_SIDE && inZone(i, FAIR)) continue;   // the funfair is here
        if (pair) {
          const yw = yawAt(i + STEP / 2), ws = pair.map((id) => ROW.rects[id][2] / ROW_PX), tot = ws[0] + ws[1];
          let at = -tot / 2;
          pair.forEach((id, k) => {
            const hh = ROW.rects[id][3] / ROW_PX, c = at + ws[k] / 2; at += ws[k];
            const m = new THREE.Mesh(facadeBox(d, hh, ws[k], id, ROW), rowM);
            m.position.set(o[0] + Math.sin(yw) * c, hh / 2, o[1] + Math.cos(yw) * c); m.rotation.y = yw; m.castShadow = true; add(m);
          });
        } else {
          const b = new THREE.Mesh(facadeBox(d, h, w, rand() < 0.75 ? pick(BRICK) : pick(FACADES)), facM);
          b.position.set(o[0], h / 2, o[1]); b.rotation.y = yawAt(i + STEP / 2); b.castShadow = !row;
          add(b);
        }
        taken.push({ x: o[0], z: o[1], r: 9 });
        if (row) continue;
        // a shop sign, flat on the front of the building over the shop window
        if (rand() < 0.7 && !pair) {
          const c = off(i + STEP / 2, 0), dx = c[0] - o[0], dz = c[1] - o[1], len = Math.hypot(dx, dz) || 1;
          const sg = new THREE.Mesh(signGeo((rand() * 12) | 0), signM);
          sg.position.set(o[0] + (dx / len) * (d / 2 + 0.2), 4.6, o[1] + (dz / len) * (d / 2 + 0.2)); sg.rotation.y = Math.atan2(dx, dz); add(sg);
        }
        // and, here and there, the poster of the exhibition by the door
        if (((i - CITY[0]) / STEP + (side > 0 ? 1 : 0)) % 3 === 0) {
          const c = off(i + STEP / 2, 0), dx = c[0] - o[0], dz = c[1] - o[1], len = Math.hypot(dx, dz) || 1, yw = yawAt(i + STEP / 2);
          const ps = new THREE.Mesh(lifeGeo(LIFE.poster, 2.2, 3.3), lifeM);
          ps.position.set(o[0] + (dx / len) * (d / 2 + 0.2) + Math.sin(yw) * 3.4, 2.3, o[1] + (dz / len) * (d / 2 + 0.2) + Math.cos(yw) * 3.4); ps.rotation.y = Math.atan2(dx, dz); add(ps);
        }
        // the city burns from the moment the world breaks
        if (rand() < 0.45) {
          const n = 2 + ((rand() * 3) | 0);
          for (let k = 0; k < n; k++) { const fo = off(i + ((rand() * STEP) | 0), side * (HALF + 6 + rand() * d)); flame(fo[0], k ? h * rand() * 0.6 : h, fo[1], 6 + rand() * 6, 1, k); }
          glow(o[0], h + 4, o[1], 50, 1);
          if (rand() < 0.6) smoke(o[0], h, o[1], 1);
          ember(i + 2, 1); ember(i + 4, 1);
        }
      }
      // pavement life: people, parked cars
      for (let k = 0; k < 4; k++) person(i + ((rand() * STEP) | 0), side * (HALF + 2.6 + rand() * 2.2));
      if (rand() < 0.55) car(i + 2, side * (HALF + 0.4), rand() < 0.35);
      // world B: rubble on the pavements
      for (let k = 0; k < 3; k++) {
        const ro = off(i + ((rand() * STEP) | 0), side * (HALF + 1.8 + rand() * 3.5)), sz = 0.5 + rand() * 1.1;
        const r = new THREE.Mesh(new THREE.BoxGeometry(sz * 1.6, sz, sz * 1.2), tm(pick([0x2a2628, 0x3a3436, 0x1c1a1c])));
        r.position.set(ro[0], sz * 0.35, ro[1]); r.rotation.set(rand() * 0.6, rand() * 3, rand() * 0.6); ruinBag.add(r);
      }
      if (rand() < 0.3) {   // a fallen pole across the pavement
        const po = off(i, side * (HALF + 2.5)), pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 8), tm(0x1c1a1c));
        pole.position.set(po[0], 0.8, po[1]); pole.rotation.set(0.2, yawAt(i) + 1 + rand(), 0); ruinBag.add(pole);
      }
    }
    // wires over the street, and a traffic light now and then
    if ((i - CITY[0]) % 18 === 0) {
      const a = off(i, -(HALF + 3)), b = off(i, HALF + 3);
      [a, b].forEach((p) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), tm(0x2a2a30)); post.position.set(p[0], 4.5, p[1]); add(post); });
      const wire = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, Math.hypot(b[0] - a[0], b[1] - a[1])), tm(0x121216));
      wire.position.set((a[0] + b[0]) / 2, 8.6, (a[1] + b[1]) / 2); wire.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); add(wire);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), tm(0x121216)); tl.position.set(a[0] * 0.75 + b[0] * 0.25, 7.6, a[1] * 0.75 + b[1] * 0.25); tl.rotation.y = yawAt(i); add(tl);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.1), lightM); lamp.position.copy(tl.position); lamp.position.y -= 0.4;
      lamp.position.x -= Math.sin(yawAt(i)) * 0.26; lamp.position.z -= Math.cos(yawAt(i)) * 0.26; lamp.rotation.y = yawAt(i); add(lamp);
    }
  }

  // The billboard over the street at the entrance of the city, and the same line on the side of the bus.
  const boardTex = canvasTex(160, 48, (g) => {
    // like the wall of the exhibition in the video: white, the title in black, a few lines of small print
    g.fillStyle = '#eef1f2'; g.fillRect(0, 0, 160, 48);
    g.fillStyle = '#1b1c20';
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('THE LIFE', 8, 11); g.fillText('WE LEFT ELSEWHERE', 8, 23);
    g.fillStyle = '#8a9096'; [32, 36, 40].forEach((y, k) => g.fillRect(8, y, 120 - k * 22, 1));
  });
  boardM.map = boardTex; wantTexts.push(boardTex);
  const bi = FAIR[1] + 20, a = off(bi, -(HALF + 2.5)), b = off(bi, HALF + 2.5);
  [a, b].forEach((p) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13, 0.5), tm(0x1b1b20)); leg.position.set(p[0], 6.5, p[1]); add(leg); });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), boardM);
  board.position.set((a[0] + b[0]) / 2, 10.5, (a[1] + b[1]) / 2); board.rotation.y = yawAt(bi) + Math.PI; add(board);

  const ui = 300, uo = off(ui, -(HALF + 1.2));
  const bus = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.7, 10), tm(0x5f8f8a)); body.position.y = 1.95; body.castShadow = true; bus.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.3, 10.1), tm(0xf4f7fc)); top.position.y = 3.4; bus.add(top);
  [-1, 1].forEach((sx) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.8), winM[0]); w.position.set(sx * 1.42, 2.7, 0); w.rotation.y = sx * Math.PI / 2; bus.add(w);
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.8), boardM); ad.position.set(sx * 1.43, 1.4, 0); ad.rotation.y = sx * Math.PI / 2; bus.add(ad);
  });
  [[-1.3, -3.4], [1.3, -3.4], [-1.3, 3.4], [1.3, 3.4]].forEach(([x, z]) => { const wh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.9), tm(0x121216)); wh.position.set(x, 0.45, z); bus.add(wh); });
  bus.position.set(uo[0], 0, uo[1]); bus.rotation.y = yawAt(ui);
  add(bus);
  for (let k = 0; k < 7; k++) person(ui + 7 + (k % 3), -(HALF + 2.4 + (k % 2)));   // the queue at the stop
  const stopTex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#eef1f2'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#2a5bd0'; g.fillRect(0, 0, 32, 14);
    g.fillStyle = '#ffffff'; g.font = '6px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUS', 16, 4); g.fillText('STOP', 16, 10);
    g.fillStyle = '#8a9096'; for (let y = 18; y < 30; y += 3) g.fillRect(4, y, 24, 1);
  });
  wantTexts.push(stopTex);
  const so = off(ui + 6, -(HALF + 2)), pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), tm(0x8a9096)); pole.position.set(so[0], 1.6, so[1]); add(pole);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: stopTex, side: THREE.DoubleSide })); plate.position.set(so[0], 3, so[1]); plate.rotation.y = yawAt(ui) + Math.PI; add(plate);
  const bo = off(ui + 9, -(HALF + 4)), bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 3), tm(0x6a6e74)); bench.position.set(bo[0], 0.5, bo[1]); bench.rotation.y = yawAt(ui + 9); add(bench);
}

// THE LIFE WE LEFT ELSEWHERE, the title of the exhibition in the video, in other shapes than the board over the
// street: a cloth banner, a stencil on the concrete wall, a wooden road sign, a poster. One texture, cells in px.
const LIFE = { banner: [0, 0, 256, 16], stencil: [0, 16, 256, 16], wood: [0, 32, 128, 32], poster: [128, 32, 64, 96] };
const lifeM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, alphaTest: 0.5 });
const lifeGeo = ([x, y, w, h], gw, gh) => {
  const g = new THREE.PlaneGeometry(gw, gh), uv = g.attributes.uv;
  for (let n = 0; n < 4; n++) uv.setXY(n, (x + uv.getX(n) * w) / 256, 1 - (y + (1 - uv.getY(n)) * h) / 128);
  return g;
};
function lifeSigns() {
  const tex = canvasTex(256, 128, (g) => {
    g.clearRect(0, 0, 256, 128);
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#8a2a22'; g.fillRect(0, 0, 256, 16); g.fillStyle = '#f3ead8'; g.fillRect(0, 1, 256, 1); g.fillRect(0, 14, 256, 1);
    g.fillText('THE LIFE WE LEFT ELSEWHERE', 128, 8);
    g.fillStyle = '#2a2420'; g.fillText('THE LIFE WE LEFT ELSEWHERE', 128, 24);   // stencil: letters only
    g.fillStyle = '#f3ead8';
    g.fillStyle = '#8a6a4f'; g.fillRect(0, 32, 128, 32); g.fillStyle = '#6b513b'; g.fillRect(0, 47, 128, 1); g.fillRect(0, 32, 128, 1); g.fillRect(0, 63, 128, 1);
    g.fillStyle = '#f3ead8'; g.fillText('THE LIFE WE', 64, 41); g.fillText('LEFT ELSEWHERE', 64, 56);
    g.fillStyle = '#eef1f2'; g.fillRect(128, 32, 64, 96); g.fillStyle = '#c8110e'; g.fillRect(134, 38, 20, 2);
    g.fillStyle = '#1b1c20'; g.textAlign = 'left';
    ['THE', 'LIFE', 'WE', 'LEFT', 'ELSE', 'WHERE'].forEach((t, k) => g.fillText(t, 134, 50 + k * 12));
    g.fillStyle = '#8a9096'; g.fillRect(134, 120, 40, 1);
  });
  lifeM.map = tex; wantTexts.push(tex);
  // cloth banners across the road: in the village and deep in the city
  [60, 352, 436].forEach((i) => {
    const a = off(i, -(HALF + 2.4)), b = off(i, HALF + 2.4);
    [a, b].forEach((p) => { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), tm(0x1b1b20)); pole.position.set(p[0], 4.5, p[1]); add(pole); });
    const m = new THREE.Mesh(lifeGeo(LIFE.banner, 2 * HALF + 4.8, (2 * HALF + 4.8) / 16), lifeM);
    m.position.set((a[0] + b[0]) / 2, 8.2, (a[1] + b[1]) / 2); m.rotation.y = yawAt(i) + Math.PI; add(m);
  });
  // stencilled on the concrete walls, one side and then the other
  [[WALL[0] + 6, -1], [WALL[0] + 16, 1]].forEach(([i, side]) => {
    const o = off(i, side * (HALF + 3.2)), m = new THREE.Mesh(lifeGeo(LIFE.stencil, 18, 1.125), lifeM);
    m.position.set(o[0], 1.9, o[1]); m.rotation.y = yawAt(i) - side * Math.PI / 2; add(m);
  });
  // wooden road signs: in the forest, at the camp, by the flower field
  [[506, 1], [548, -1], [668, 1]].forEach(([i, side]) => {
    const o = off(i, side * (HALF + 3)), post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), tm(0x5a3d2a)); post.position.set(o[0], 1.5, o[1]); add(post);
    const m = new THREE.Mesh(lifeGeo(LIFE.wood, 6, 1.5), lifeM); m.position.set(o[0], 2.9, o[1]); m.rotation.y = yawAt(i) + Math.PI + side * 0.5; add(m);
    taken.push({ x: o[0], z: o[1], r: 3 });
  });
}

const TREE_COLS = [0xb9d0de, 0xa7c2d4, 0xc9dce6], treeM = [];
let fieldM = null, xmasM = null, fairM = null;

// The camp in the forest: the grey car with its awning, two chairs and a table.
function camp() {
  const i = 540, o = off(i, -(HALF + 9)), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 4.8), tm(0xb8bcc0)); body.position.y = 1.3; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 3.4), tm(0x20242c)); cab.position.set(0, 2.4, -0.4); g.add(cab);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 3.5), tm(0xb8bcc0)); top.position.set(0, 2.9, -0.4); g.add(top);
  [[-1.1, -1.5], [1.1, -1.5], [-1.1, 1.5], [1.1, 1.5]].forEach(([x, z]) => { const wh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.95), tm(0x121216)); wh.position.set(x, 0.48, z); g.add(wh); });
  const aw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 3.4), tm(0x8a5a4a)); aw.position.set(2.8, 2.8, -0.4); aw.rotation.z = -0.08; g.add(aw);
  [[4.4, -2], [4.4, 1.2]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.08), tm(0x121216)); p.position.set(x, 1.35, z); g.add(p); });
  [[3, 3.2], [4.4, 3.4]].forEach(([x, z]) => { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), tm(0x9a7a5a)); ch.position.set(x, 0.45, z); g.add(ch); });
  const tb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.8), tm(0xd8cdbb)); tb.position.set(3.6, 0.3, 4.6); g.add(tb);
  g.position.set(o[0], 0, o[1]); g.rotation.y = yawAt(i) + 0.5;
  add(g);
  taken.push({ x: o[0], z: o[1], r: 7 });
}

// A field of orange flowers, from the summer of the video, on both sides of the road before the village.
function field() {
  const tex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#7a9a4a'; g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 90; k++) { g.fillStyle = ['#f2a61e', '#f7c23a', '#e88a18', '#5f8238'][k % 4]; g.fillRect((k * 13) % 32, (k * 29 + ((k * k) % 7)) % 32, 2, k % 3 ? 1 : 2); }
  }, true);
  fieldM = toon(0xffffff, { map: tex });
  for (const side of [-1, 1]) {
    const pos = [], uv = [], idx = [];
    for (let i = FIELD[0], n = 0; i <= FIELD[1]; i += 2, n++) {
      const a = off(i % N, side * (HALF + 2.4)), b = off(i % N, side * (HALF + 46));
      pos.push(a[0], 0.07, a[1], b[0], 0.07, b[1]); uv.push(a[0] / 7, a[1] / 7, b[0] / 7, b[1] / 7);
      if (n) { const k = n * 2; if (side > 0) idx.push(k - 2, k, k - 1, k - 1, k, k + 1); else idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, fieldM); m.receiveShadow = true; scene.add(m);
  }
}

// The concrete block wall of the night street, between the city and the forest.
function blockWall() {
  const tex = canvasTex(16, 16, (g) => {
    g.fillStyle = '#b8b2a6'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#8a857c';
    g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(7, 0, 1, 7); g.fillRect(15, 8, 1, 7);
    g.fillStyle = '#a39d92'; g.fillRect(2, 2, 3, 2); g.fillRect(10, 11, 3, 2);
  }, true);
  const m = toon(0xffffff, { map: tex });
  for (let i = WALL[0]; i < WALL[1]; i += 2) for (const side of [-1, 1]) {
    const a = off(i, side * (HALF + 3.6)), b = off(i + 2, side * (HALF + 3.6)), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const geo = new THREE.BoxGeometry(0.5, 3.2, len + 0.1), uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (len / 1.6), uv.getY(k) * 2);
    const w = new THREE.Mesh(geo, m); w.position.set((a[0] + b[0]) / 2, 1.6, (a[1] + b[1]) / 2); w.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); w.castShadow = true; add(w);
  }
}

// The funfair at the gates of the city, the only Christmas of the track: BUMPER CARS in bulbs over the road, the
// SHOOTING BALLOONS stall, the carousel, a tree with lights, stalls and lamps, strings of bulbs across the street.
function fair() {
  const S = FAIR_SIDE, toRoad = (i, x, z) => Math.atan2(P[i].x - x, P[i].z - z);
  const fairTex = canvasTex(128, 48, (g) => {
    g.fillStyle = '#2a1014'; g.fillRect(0, 0, 128, 24);
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffe2a0'; g.fillText('BUMPER CARS', 64, 13);
    for (let x = 3; x < 128; x += 6) { g.fillRect(x, 2, 2, 2); g.fillRect(x, 20, 2, 2); }
    g.fillStyle = '#f3ead8'; g.fillRect(0, 24, 128, 24);
    g.fillStyle = '#C8110E'; g.fillRect(0, 24, 128, 2); g.fillRect(0, 46, 128, 2);
    g.font = '6px "Press Start 2P", monospace'; g.fillStyle = '#d98a2a'; g.fillText('SHOOTING BALLOONS', 64, 37);
  });
  wantTexts.push(fairTex);
  fairM = new THREE.MeshBasicMaterial({ map: fairTex, side: THREE.DoubleSide });
  const half = (top, w, h) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let k = 0; k < 4; k++) uv.setY(k, (top ? 0.5 : 0) + uv.getY(k) / 2); return g; };
  const stripe = toon(0xffffff, { map: canvasTex(16, 4, (g) => { g.fillStyle = '#f3ead8'; g.fillRect(0, 0, 16, 4); g.fillStyle = '#C8110E'; g.fillRect(0, 0, 4, 4); g.fillRect(8, 0, 4, 4); }, true) });
  // BUMPER CARS over the road
  const bi = FAIR[0] + 5, a = off(bi, -(HALF + 2.4)), b = off(bi, HALF + 2.4);
  [a, b].forEach((p) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.5), stripe); leg.position.set(p[0], 5.5, p[1]); add(leg); });
  const arch = new THREE.Mesh(half(true, 21, 4), fairM); arch.position.set((a[0] + b[0]) / 2, 10, (a[1] + b[1]) / 2); arch.rotation.y = yawAt(bi) + Math.PI; add(arch);
  // strings of bulbs across the street
  for (let i = FAIR[0]; i < FAIR[1]; i += 7) {
    const p = off(i, -(HALF + 2.4)), q = off(i, HALF + 2.4);
    for (let k = 0; k <= 12; k++) { const t = k / 12, bl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), bulbM); bl.position.set(p[0] + (q[0] - p[0]) * t, 7.6 - Math.sin(t * Math.PI) * 1.5, p[1] + (q[1] - p[1]) * t); add(bl); }
  }
  // SHOOTING BALLOONS
  const si = FAIR[0] + 16, so = off(si, S * (HALF + 8)), stall = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 4), stripe); box.position.y = 1.8; box.castShadow = true; stall.add(box);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.2), tm(0x3a1418)); inside.position.set(0, 2.2, 2.02); stall.add(inside);
  for (let k = 0; k < 10; k++) { const bal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), tm([0xc8110e, 0xe8c04a, 0x2f5fa8, 0x3a7a58][k % 4])); bal.position.set(-3.2 + (k % 5) * 1.6, 1.7 + ((k / 5) | 0) * 0.9, 2.1); stall.add(bal); }
  const sgn = new THREE.Mesh(half(false, 9.6, 1.8), fairM); sgn.position.set(0, 4.6, 2.05); stall.add(sgn);
  stall.position.set(so[0], 0, so[1]); stall.rotation.y = toRoad(si, so[0], so[1]); add(stall);
  taken.push({ x: so[0], z: so[1], r: 7 });
  // the carousel
  const ci = FAIR[0] + 28, co = off(ci, S * (HALF + 13)), car = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.6, 12), tm(0xd8cdbb)); base.position.y = 0.3; car.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.2, 12), stripe); roof.position.y = 6.6; roof.castShadow = true; car.add(roof);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), tm(0xe8c04a)); mast.position.y = 2.8; car.add(mast);
  for (let k = 0; k < 8; k++) {
    const an = (k / 8) * Math.PI * 2, x = Math.cos(an) * 4.6, z = Math.sin(an) * 4.6;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 4.6, 0.15), tm(0xe8c04a)); pole.position.set(x, 2.8, z); car.add(pole);
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 1.5), tm(k % 2 ? 0xf3ead8 : 0x8a5a4a)); horse.position.set(x, 1.8 + (k % 2) * 0.5, z); horse.rotation.y = -an; car.add(horse);
    for (let j = 0; j < 2; j++) { const a2 = an + j * 0.39, bl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bulbM); bl.position.set(Math.cos(a2) * 6.9, 5.05, Math.sin(a2) * 6.9); car.add(bl); }
  }
  car.position.set(co[0], 0, co[1]); add(car);
  taken.push({ x: co[0], z: co[1], r: 9 });
  // the tree with its lights
  const ti = FAIR[0] + 7, to = off(ti, S * (HALF + 12)), tree = new THREE.Group();
  [[3.6, 4.4, 3], [2.8, 3.8, 5.6], [1.9, 3.2, 7.9], [1, 2.4, 9.8]].forEach(([r, h, y]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), tm(0x2f6b4f)); c.position.y = y; c.castShadow = true; tree.add(c);
    for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2 + y, bl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), bulbM); bl.position.set(Math.cos(an) * r * 0.75, y - h * 0.3, Math.sin(an) * r * 0.75); tree.add(bl); }
  });
  const star = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bulbM); star.position.y = 11.4; star.rotation.set(0.8, 0.6, 0); tree.add(star);
  tree.position.set(to[0], 0, to[1]); add(tree);
  taken.push({ x: to[0], z: to[1], r: 5 });
  // stalls, carts, lamps and wreaths from the Christmas pack, along the pavement
  xmasM = new THREE.MeshBasicMaterial({ map: load(xmasUrl), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const sprite = (k, i, lat, size) => {
    const o = off(i, lat), g = new THREE.PlaneGeometry(size, size), uv = g.attributes.uv;
    for (let n = 0; n < 4; n++) uv.setX(n, (k + uv.getX(n)) / 4);
    const m = new THREE.Mesh(g, xmasM); m.position.set(o[0], size / 2, o[1]); m.rotation.y = toRoad(i, o[0], o[1]); add(m);
  };
  [[0, 3, 5], [1, 10, 4], [2, 13, 4.5], [1, 22, 4], [0, 34, 5], [2, 25, 4.5], [2, 36, 4.5]].forEach(([k, di, size]) => sprite(k, FAIR[0] + di, S * (HALF + 4.2), size));
  [[2, 8], [2, 20], [2, 32]].forEach(([k, di]) => sprite(k, FAIR[0] + di, -S * (HALF + 3.2), 4.5));
}

// Snowy pine forest, thick along the road, with trees scattered over the rest of the valley.
function forest() {
  // frosted, like the forest of the video: pale blue-white trees (their own materials: they die in the other world)
  const trunk = tm(0x4a3a34), green = TREE_COLS.map((c) => { const m = toon(c); treeM.push(m); return m; }), snowM = toon(0xffffff); treeM.push(snowM);
  const pine = (x, z) => {
    const s = 0.8 + rand() * 1.1, g = new THREE.Group(), gm = pick(green);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), trunk); t.position.y = 0.7; g.add(t);
    [[2.6, 3.2, 2.6], [2, 2.8, 4.4], [1.3, 2.4, 6]].forEach(([r, hh, y]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 6), gm); c.position.y = y; g.add(c);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.62, hh * 0.5, 6), snowM); cap.position.y = y + hh * 0.27; g.add(cap);
    });
    g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rand() * 3;
    add(g);
  };
  const inField = (x, z) => { for (let i = FIELD[0]; i < FIELD[1]; i += 4) if (Math.hypot(P[i].x - x, P[i].z - z) < 50) return true; return false; };
  const free = (x, z, gap) => minTrackDist(x, z) > HALF + gap && !inField(x, z) && !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 3);
  for (let i = FOREST[0]; i < FOREST[1]; i += 2) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const o = off(i, side * (HALF + 5 + rand() * rand() * 60));
    if (free(o[0], o[1], 4.5)) pine(o[0], o[1]);
    if (k === 0 && rand() < 0.07) { flame(o[0], 2, o[1], 7, 2, i); glow(o[0], 8, o[1], 34, 2); ember(i, 2); }   // lap 3: the forest burns too
  }
  let n = 0;
  for (let k = 0; k < 1500 && n < 130; k++) {
    const x = (rand() - 0.5) * 760 + 20, z = (rand() - 0.5) * 760 + 190, d = minTrackDist(x, z);
    if (d < HALF + 9 || d > 150 || !free(x, z, 9)) continue;
    pine(x, z); n++;
  }
}

function mountains() {
  const c = new THREE.Vector3(); P.forEach((p) => c.add(p)); c.divideScalar(P.length);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2 + rand() * 0.2, r = 640 + rand() * 120, h = 110 + rand() * 130, w = 90 + rand() * 70;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), tm(k % 2 ? 0x8a9cc4 : 0x7d90ba));
    m.position.set(c.x + Math.cos(a) * r, h / 2 - 6, c.z + Math.sin(a) * r); m.rotation.y = rand() * 3; add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.5, h * 0.5, 5), tm(0xf6f9fd));
    cap.position.set(m.position.x, h * 0.75 - 5.5, m.position.z); cap.rotation.y = m.rotation.y; add(cap);
  }
}

// Clock tower by the start line: it keeps time in world A and runs backwards, fast, in world B.
const hands = [];
function clockTower() {
  const i = 10, o = off(i, -(HALF + 8));
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.5, 15, 4.5), tm(0xe8d9b8)); tower.position.y = 7.5; tower.castShadow = true; g.add(tower);
  const top = new THREE.Mesh(new THREE.ConeGeometry(4, 4.5, 4), tm(0xf4f7fc)); top.position.y = 17.2; top.rotation.y = Math.PI / 4; g.add(top);
  g.position.set(o[0], 0, o[1]); g.rotation.y = Math.atan2(NR[i].x, NR[i].z);
  add(g);
  const face = canvasTex(32, 32, (c) => {
    c.fillStyle = '#5a3326'; c.beginPath(); c.arc(16, 16, 15, 0, 7); c.fill();
    c.fillStyle = '#f3ead8';
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.fillRect(Math.round(15.5 + Math.sin(a) * 12), Math.round(15.5 - Math.cos(a) * 12), k % 3 ? 1 : 2, k % 3 ? 1 : 2); }
  });
  const fm = new THREE.MeshBasicMaterial({ map: face, transparent: true, alphaTest: 0.5 });
  const hm = new THREE.MeshBasicMaterial({ color: 0xf3ead8 });
  // one face towards the road, one towards the karts coming down the straight
  [[0, 2.3, 0], [-2.3, 0, -Math.PI / 2]].forEach(([lx, lz, ry]) => {
    const fg = new THREE.Group();
    fg.add(new THREE.Mesh(new THREE.CircleGeometry(1.9, 20), fm));
    [[0.16, 1.5], [0.2, 1]].forEach(([w, l], k) => {
      const piv = new THREE.Group(), hnd = new THREE.Mesh(new THREE.PlaneGeometry(w, l), hm);
      hnd.position.y = l / 2; piv.position.z = 0.02 + k * 0.01; piv.add(hnd); fg.add(piv);
      hands.push({ piv, k });
    });
    fg.position.set(lx, 12, lz); fg.rotation.y = ry;
    const holder = new THREE.Group(); holder.position.copy(g.position); holder.rotation.copy(g.rotation); holder.add(fg);
    scene.add(holder);
  });
}

// Falling snow: a box of flakes that follows the camera.
let snow = null;
const SNOW_N = 420, BOX = [70, 34, 70];
function snowfall() {
  const pos = new Float32Array(SNOW_N * 3);
  for (let k = 0; k < SNOW_N * 3; k++) pos[k] = Math.random() * BOX[k % 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
  snow.frustumCulled = false;
  scene.add(snow);
}

/** Merges the collected pieces: one mesh per material. */
function bake() {
  scene.add(merged(bag));
}
function merged(src) {
  const out = new THREE.Group();
  src.updateMatrixWorld(true);
  const groups = new Map();
  src.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    const e = groups.get(o.material) || { geos: [], shadow: false };
    e.geos.push(g); e.shadow = e.shadow || o.castShadow;
    groups.set(o.material, e);
  });
  groups.forEach((e, mat) => {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(e.geos), mat);
    m.castShadow = e.shadow;
    out.add(m);
    e.geos.forEach((g) => g.dispose());
  });
  return out;
}

let fx = null;
export function buildWant() {
  village();
  city();
  fair();
  blockWall();
  lifeSigns();
  camp();
  field();
  forest();
  mountains();
  clockTower();
  bake();
  alive = merged(aliveBag); scene.add(alive);
  ruin = merged(ruinBag); ruin.visible = false; scene.add(ruin);
  snowfall();
  fx = document.createElement('div');
  fx.className = 'glitch-fx';
  document.body.appendChild(fx);
  // the line that opens the video, over the start of every race
  quote = document.createElement('div');
  quote.className = 'want-quote';
  (document.getElementById('hud') || document.body).appendChild(quote);
}

/** Embers on the road slow the karts, in the burning world only. */
export function emberHit(x, z) {
  if (!world) return false;
  for (const e of embers) if (e.level <= level && Math.abs(e.x - x) < 2.2 && Math.abs(e.z - z) < 2.2) return true;
  return false;
}

let glitchT = 0, told = false, quote = null, quoteT = 0, quoteN = -1, lastState = '';
const QUOTE = 'If we were just human, this is how we would have loved each other.', QUOTE_T = 9;
/** 1 in the parallel world, 0 in the one we know. */
export const wantWorld = () => world;
function glitch() {
  glitchT = 0.6;
  canvas.classList.remove('glitch'); fx.classList.remove('on');
  void canvas.offsetWidth;   // restart the CSS animation
  canvas.classList.add('glitch'); fx.classList.add('on');
  sfx('glitch');
  musicGlitch();
}

const tmpC = new THREE.Color();
let fogK = 0;
export function updateWant(dt, now) {
  const racing = G.state === 'race' || G.state === 'done';
  if (G.state !== lastState) {
    if (G.state === 'count') { quoteT = QUOTE_T; quoteN = -1; }   // through the countdown and the first seconds of the race
    else if (G.state !== 'race') quoteT = 0;
    lastState = G.state;
  }
  if (quoteT > 0) {
    quoteT -= dt;
    // typed out, 30 letters a second; "human," a shade lighter, as in the video
    const n = Math.min(QUOTE.length, Math.floor((QUOTE_T - quoteT) * 30));
    if (n !== quoteN) {
      quoteN = n;
      const a = QUOTE.indexOf('human,'), b = a + 6, t = QUOTE.slice(0, n);
      quote.innerHTML = n <= a ? t : t.slice(0, a) + '<i>' + t.slice(a, b) + '</i>' + t.slice(b);
    }
  }
  quote.classList.toggle('on', quoteT > 0.01);
  let w = 0;
  level = 0;
  if (racing && player.laps === 1) { level = 1; w = player.idx >= GLITCH_AT ? 1 : 0; }
  else if (racing && player.laps >= 2) {
    level = 2;
    if (G.state === 'done') w = 1;
    else for (const [from, ww] of LAP3) if (player.idx >= from) w = ww;
  }
  if (!racing) told = false;
  if (w !== world) {
    world = w;
    setShift(w);
    if (racing) {
      glitch();
      if (w && !told) { told = true; banner('PARALLEL WORLD', 1.4); }
    }
  }
  if (glitchT > 0) { glitchT -= dt; if (glitchT <= 0) { canvas.classList.remove('glitch'); fx.classList.remove('on'); } }

  // windows
  const flick = 0.75 + Math.sin(now / 70) * 0.15 + Math.sin(now / 23) * 0.1;
  winM.forEach((m, k) => {
    if (!world) m.color.copy(WARM);
    else if (k && k <= level) m.color.copy(tmpC.copy(FLAME).multiplyScalar(flick));
    else m.color.copy(DARK);
  });
  // fire
  const f = Math.floor(now / 80);
  fireMat.forEach((m) => { m.map.offset.x = ((f + m.userData.ph) % 14) / 14; });
  // only the fires near the player are drawn: each flame is a draw call
  fires.forEach((e) => { e.s.visible = !!world && e.level <= level && Math.abs(e.s.position.x - player.x) + Math.abs(e.s.position.z - player.z) < 230; });
  emberM.opacity = world ? 0.5 + Math.sin(now / 120) * 0.2 : 0;
  embers.forEach((e) => { e.m.visible = !!world && e.level <= level; });
  // who and what is there
  if (alive) { alive.visible = !world; ruin.visible = !!world; }
  if (carM) carM.forEach((m, k) => m.color.setHex(world ? 0x1a1614 : CAR_COLS[k]));
  lifeM.color.setHex(world ? (Math.sin(now / 67) > 0.5 ? 0xc8110e : 0x3a1010) : 0xffffff);   // in the other world the line is still there, in red
  signM.color.setHex(world ? (Math.sin(now / 53) > 0.93 ? 0x8a8a9a : 0x0c0a10) : 0xffffff);
  boardM.color.setHex(world ? (Math.sin(now / 71) > 0.6 ? 0x7a4038 : 0x2a1a1a) : 0xffffff);
  treeM.forEach((m, k) => m.color.setHex(world ? (k < 3 ? 0x14161a : 0x4a4e56) : (k < 3 ? TREE_COLS[k] : 0xffffff)));   // dead and bare
  if (fieldM) fieldM.color.setHex(world ? 0x3a3a3c : 0xffffff);
  bulbM.color.setHex(world ? (Math.sin(now / 47) > 0.96 ? 0x8a8a9a : 0x0c0c12) : 0xffe2a0);
  if (xmasM) xmasM.color.setHex(world ? 0x1c1c22 : 0xffffff);
  if (fairM) fairM.color.setHex(world ? (Math.sin(now / 61) > 0.9 ? 0x6a5a4a : 0x100c0e) : 0xffffff);
  lightM.color.setHex(world ? (Math.floor(now / 500) % 2 ? 0xff2a1a : 0x1a0808) : 0x3aff7a);
  smokes.forEach((sm) => { const u = sm.userData; sm.position.y = u.y + ((now / 900 + u.ph) % 1) * 10; sm.material.rotation = 0; });
  // smoke closes in on the burning world
  fogK = world ? Math.min(1, fogK + dt * 3) : Math.max(0, fogK - dt * 3);
  const fk = fogK;
  scene.fog.near = THEME.fog[1] + (40 - THEME.fog[1]) * fk; scene.fog.far = THEME.fog[2] + (460 - THEME.fog[2]) * fk;
  // clock, snow
  const t = now / 1000;
  hands.forEach((h) => { h.piv.rotation.z = world ? t * (h.k ? 3 : 9) : -t * (h.k ? 0.02 : 0.25); });
  if (snow) {
    // snow in A; in B grey ash, slower
    snow.material.opacity = world ? 0.7 : 0.55;
    snow.material.color.setHex(world ? 0x8a8a90 : 0xffffff);
    const a = snow.geometry.attributes.position, fall = (world ? 2.2 : 4) * dt;
    for (let k = 0; k < SNOW_N; k++) {
      let y = a.getY(k) - fall; if (y < 0) y += BOX[1]; else if (y > BOX[1]) y -= BOX[1];
      a.setY(k, y); a.setX(k, (a.getX(k) + dt * (world ? 3 : 0.8)) % BOX[0]);
    }
    a.needsUpdate = true;
    snow.position.set(camera.position.x - BOX[0] / 2, 0, camera.position.z - BOX[2] / 2);
  }
}
