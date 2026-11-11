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
import atlasUrl from './assets/bloody/facade-atlas.png';
import ATLAS from './assets/bloody/facade-atlas.json';
import adsUrl from './assets/bloody/billboards.png';
import shoreUrl from './assets/bloody/shore.png';
import ADS from './assets/bloody/billboards.json';

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
const SEA_Z = -24;           // the coast: the beach starts south of here
const BEACH = 22;            // metres of dry sand before the shore strip (whose wet sand and water start ~15 m in)

// ---------- Graffiti: our own colourful tags and blobs on a pale wall.
function graffiti(seed, base = '#d8d2cc') {
  let s = seed;
  const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const t = canvasTex(64, 16, (g, w, h) => {
    s = seed;   // the same picture when redrawn
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
    // The tag: ENHYPEN in a bright colour with a dark outline, a little off-centre and tilted.
    s = seed;
    const tag = ['#C8110E', '#f2c12e', '#f06eb0', '#2fae6a', '#2f8ad6'][(r() * 5) | 0];
    g.save();
    g.translate(w / 2 + (r() - 0.5) * 6, h / 2 + 1);
    g.rotate((r() - 0.5) * 0.18);
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#1b1418';
    [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]].forEach(([dx, dy]) => g.fillText('ENHYPEN', dx, dy));
    g.fillStyle = tag;
    g.fillText('ENHYPEN', 0, 0);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 2, w, 2);
  });
  paradiseTexts.push(t);   // redrawn once the pixel font has loaded
  return t;
}

// ---------- Buildings: one facade atlas, every building a different piece of it ----------
// 38 facades of "Pixel Facades 100" packed in one texture (facade-atlas.json gives each one's rectangle), so all the
// buildings of the track merge into a single mesh. Each building takes a piece of a facade the size of its front,
// at a fixed scale (PX facade pixels per metre, so floors have the same height everywhere), from a seeded random
// facade and offset: the town looks the same for every player, but no two neighbours match.
const atlasTex = new THREE.TextureLoader().load(atlasUrl);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.LinearMipmapLinearFilter;   // far away: mipmaps, or the small windows turn into moiré
const facadeM = toon(0xffffff, { map: atlasTex });
const AW = ATLAS.size[0], AH = ATLAS.size[1], PX = 12;
const STYLES = {};
Object.entries(ATLAS.rects).forEach(([id, r]) => { (STYLES[r[4]] = STYLES[r[4]] || []).push(id); });
const ids = (...styles) => styles.flatMap((st) => STYLES[st] || []);
const MARKET_IDS = ids('brownstone', 'warehouse', 'shop_terrace');
const WEST_IDS = ids('mediterranean', 'art_nouveau', 'half_timber', 'limestone');
const TOWN_IDS = Object.keys(ATLAS.rects);
const PRISON_IDS = ids('mediterranean');

// Seeded random numbers: the same town on every device.
let seed = 20261111;
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
const pick = (arr) => arr[(rand() * arr.length) | 0];

/** Atlas UVs [u0, v0, u1, v1] of a fw × fh metre piece of facade id: from the bottom (street floor) or the top. */
function facadeUV(id, fw, fh, from = 'bottom') {
  const [x, y, w, h] = ATLAS.rects[id];
  const cw = Math.min(w, fw * PX), ch = Math.min(h, fh * PX);
  const cx = x + (w - cw) * rand(), cy = from === 'top' ? y + 3 : y + h - ch;
  return [cx / AW, 1 - (cy + ch) / AH, (cx + cw) / AW, 1 - cy / AH];
}
function roofUV(kind) {
  const [x, y, w, h] = ATLAS.roofs[kind];
  return [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
}
/** A box d (across) × h × w (along) whose four walls show facade pieces and whose top is a roof swatch. */
function facadeBox(d, h, w, id, from = 'bottom') {
  const g = new THREE.BoxGeometry(d, h, w);
  const uv = g.attributes.uv;
  const roof = roofUV(pick(['concrete', 'concrete', 'terracotta', 'tar']));
  // Face order: +x, -x, +y, -y, +z, -z. ±x are the long fronts (w wide), ±z the sides (d wide).
  const faces = [facadeUV(id, w, h, from), facadeUV(id, w, h, from), roof, roof, facadeUV(id, d, h, from), facadeUV(id, d, h, from)];
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = faces[f];
    for (let k = f * 4; k < f * 4 + 4; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
  }
  return g;
}

/** Roof clutter of a flat roof (Lima style): water tanks, AC units, antennas, rebar left for the next floor. */
const tankG = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 8), acG = new THREE.BoxGeometry(1.2, 0.8, 0.9);
const rebarG = new THREE.BoxGeometry(0.12, 1.6, 0.12), antG = new THREE.BoxGeometry(0.08, 3, 0.08), shackG = new THREE.BoxGeometry(1, 1, 1);
function roofTop(grp, d, h, w) {
  const at = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
  const rx = () => (rand() - 0.5) * (d - 2), rz = () => (rand() - 0.5) * (w - 2);
  if (rand() < 0.55) at(tankG, tm(pick([0x2a2a30, 0x2f5fa8, 0xd8d2cc])), rx(), h + 0.7, rz());
  if (rand() < 0.5) at(acG, tm(0xb8b4ae), rx(), h + 0.4, rz());
  if (rand() < 0.25) at(antG, tm(0x2a2024), rx(), h + 1.5, rz());
  if (rand() < 0.3) for (let k = 0; k < 4; k++) at(rebarG, tm(0x5a4038), (k % 2 - 0.5) * (d - 1), h + 0.8, ((k >> 1) - 0.5) * (w - 1));
  if (rand() < 0.2) at(shackG, tm(pick([0xd8cfc4, 0xc98a5a])), rx(), h + 1.2, rz()).scale.set(3, 2.4, 3);
}

/** Clutter on the street front of a building: AC units on the wall, an awning and a hanging sign over the shop. */
const awnColors = [0xC8110E, 0x2f8a4a, 0x2f6fa8, 0xe8a23a, 0xf3e6d6];
function shopFront(grp, d, h, w, front) {
  const fx = front * (d / 2);
  for (let k = 0; k < Math.floor(w / 6); k++) if (rand() < 0.45) {
    const ac = new THREE.Mesh(acG, tm(0xb8b4ae)); ac.position.set(fx + front * 0.45, 4 + ((rand() * Math.max(1, h - 6)) | 0), (rand() - 0.5) * (w - 2)); grp.add(ac);
  }
  if (rand() < 0.6) {
    const aw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, Math.min(w - 1, 6 + rand() * 6)), tm(pick(awnColors)));
    aw.position.set(fx + front * 0.9, 3.1, (rand() - 0.5) * 2); aw.rotation.z = front * 0.35; grp.add(aw);
  }
  if (rand() < 0.4) {
    const sg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.2), tm(pick([0xC8110E, 0xf2c12e, 0x2f9a52, 0xf3e6d6])));
    sg.position.set(fx + front * 0.9, 4.6, (rand() - 0.5) * (w - 3)); sg.rotation.y = Math.PI / 2; grp.add(sg);
  }
}

// ---------- Billboards: the video's fake ads (Midnight Bank, Dormant, Noomax, Route, Haven, Centuries, Pearl Bite),
// pixelated into one small texture (billboards.json gives each ad's rectangle). ----------
const adsTex = new THREE.TextureLoader().load(adsUrl);
adsTex.magFilter = adsTex.minFilter = THREE.NearestFilter;
adsTex.generateMipmaps = false;
const adsM = new THREE.MeshBasicMaterial({ map: adsTex, side: THREE.DoubleSide });
const AD_NAMES = Object.keys(ADS.rects);
let adTurn = 0;
const nextAd = () => AD_NAMES[adTurn++ % AD_NAMES.length];
/** The ad as a plane sized to its picture (height hgt metres), and its width. */
function adBoard(name, hgt) {
  const [x, y, w, h] = ADS.rects[name], [AW2, AH2] = ADS.size;
  const g = new THREE.PlaneGeometry((hgt * w) / h, hgt), uv = g.attributes.uv;
  for (let n = 0; n < 4; n++) uv.setXY(n, (x + uv.getX(n) * w) / AW2, 1 - (y + (1 - uv.getY(n)) * h) / AH2);
  return [new THREE.Mesh(g, adsM), (hgt * w) / h];
}
const frameM = tm(0x1b1418);
/** A billboard on two legs beside the road at sample i, angled toward the oncoming karts. */
function roadsideAd(i, side, name = nextAd()) {
  const g = new THREE.Group();
  const [board, bw] = adBoard(name, name === 'route' ? 9 : 7);
  const y = 8 + (name === 'route' ? 1 : 0);
  board.position.y = y; g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, (name === 'route' ? 9 : 7) + 0.8, 0.3), frameM);
  frame.position.set(0, y, -0.2); g.add(frame);
  // Seen from behind: a grey steel back with a grid of struts, so it reads as a billboard and not a black slab.
  const backM = tm(0x7a726c), bh = name === 'route' ? 9 : 7;
  const back = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, bh + 0.6, 0.1), backM); back.position.set(0, y, -0.4); g.add(back);
  for (let k = -1; k <= 1; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, 0.25, 0.25), frameM); st.position.set(0, y + k * bh / 3, -0.55); g.add(st); }
  const footM = tm(0xb8ada0);
  [-bw / 3, bw / 3].forEach((x) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, y, 0.8), frameM); l.position.set(x, y / 2, -0.75); l.castShadow = true; g.add(l);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.6), footM); f.position.set(x, 0.3, -0.75); g.add(f);   // concrete footing
  });
  const cross = new THREE.Mesh(new THREE.BoxGeometry((bw * 2) / 3, 0.3, 0.3), frameM); cross.position.set(0, y * 0.45, -0.75); g.add(cross);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.12, 0.8), frameM); walk.position.set(0, y - (name === 'route' ? 4.6 : 3.6), 0.25); g.add(walk);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, 0.3, 0.6), bm(0xffe0a0));
  lamp.position.set(0, y + (name === 'route' ? 4.9 : 3.9), 0.4); g.add(lamp);
  const o = off(i, side * (HALF + 7 + bw / 4));
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i) + Math.PI - side * 0.3;
  add(g);
}
/** A billboard hung over the road from a gantry at sample i, facing the oncoming karts: impossible to miss. */
function overheadAd(i, name) {
  const g = new THREE.Group(), hgt = name === 'route' ? 8 : 6;
  const [board, bw] = adBoard(name, hgt);
  const y = 6.5 + hgt / 2;
  board.position.y = y; g.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.8, hgt + 0.8, 0.3), frameM);
  frame.position.set(0, y, -0.2); g.add(frame);   // behind the picture (the group faces the karts)
  const span = HALF * 2 + 6;
  [-1, 1].forEach((sx) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, y + hgt / 2 + 1, 0.7), frameM); p.position.set(sx * span / 2, (y + hgt / 2 + 1) / 2, -0.4); p.castShadow = true; g.add(p);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), tm(0xb8ada0)); f.position.set(sx * span / 2, 0.25, -0.4); g.add(f); });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.6, 0.6), frameM); beam.position.set(0, y + hgt / 2 + 0.7, -0.4); g.add(beam);
  // From behind (after passing under it, or on the way back): a grey steel back, not a black slab.
  const back = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, hgt + 0.6, 0.1), tm(0x7a726c)); back.position.set(0, y, -0.4); g.add(back);
  const o = off(i, 0);
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i) + Math.PI;
  add(g);
}
/**
 * A billboard standing on a building's roof, parallel to its street front and facing the road: never wider than the
 * roof, on legs and braces down to the roof, with a catwalk and two lamps, so it sits on the building.
 */
function roofAd(grp, d, h, w, side) {
  const name = nextAd(), [,, pw, ph] = ADS.rects[name];
  const hgt = Math.min(name === 'route' ? 6 : 4.5, ((Math.min(w, d) - 1.6) * ph) / pw);
  const [board, bw] = adBoard(name, hgt);
  // Raised well above the roof, so it clears the neighbouring buildings.
  const b = new THREE.Group(), base = h + 3.2, cy = base + hgt / 2;
  board.position.y = cy; b.add(board);
  const box = (sx, sy, sz, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), frameM); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; b.add(m); return m; };
  box(bw + 0.4, hgt + 0.4, 0.2, 0, cy, -0.15);                                   // frame behind the picture
  [-bw / 2 + 0.4, 0, bw / 2 - 0.4].forEach((x) => {
    box(0.22, base - h + hgt * 0.7, 0.22, x, h + (base - h + hgt * 0.7) / 2, -0.35);   // leg from the roof
    box(0.16, 2.6, 0.16, x, h + 1.1, -1.1, 0.62);                                 // brace back to the roof
  });
  box(bw + 0.2, 0.12, 0.8, 0, base - 0.1, 0.35);                                  // catwalk
  [-bw / 4, bw / 4].forEach((x) => {
    box(0.1, 0.1, 0.9, x, base + hgt + 0.25, 0.3);                                // lamp arm
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), bm(0xffe0a0)); l.position.set(x, base + hgt + 0.2, 0.75); b.add(l);
  });
  // The picture faces the road and turns ~30° toward the oncoming karts (local -side x, -z), so it isn't seen edge-on;
  // it fits in the roof square, legs and braces on the roof.
  b.rotation.y = Math.atan2(-side, -0.6);
  b.position.x = -side * Math.max(0, d / 2 - bw * 0.45 - 0.8);
  grp.add(b);
  if (import.meta.env.DEV) (window.__roofAds = window.__roofAds || []).push(b);   // for checking them in tests
}

/** A building on one side of the track at sample i (front facing the road). */
function building(i, side, { w = 14, d = 10, h = 12, ids: pool = TOWN_IDS, id, gap = 6, from = 'bottom', shop = true, roof = true }) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(facadeBox(d, h, w, id || pick(pool), from), facadeM);
  m.position.y = h / 2; m.castShadow = true; grp.add(m);
  if (roof && h < 16 && w > 11 && rand() < 0.16) roofAd(grp, d, h, w, side);
  else if (roof) roofTop(grp, d, h, w);
  if (shop) shopFront(grp, d, h, w, -side);
  const o = off(i, side * (HALF + gap + d / 2));
  grp.position.set(o[0], 0, o[1]);
  grp.rotation.y = yawAt(i);
  add(grp);
  return grp;
}

/**
 * Buildings along both sides of a range: random widths, heights in whole floors, set-backs and the odd alley,
 * so the street doesn't repeat. opts(side) gives the per-building options.
 */
function street(range, opts) {
  [-1, 1].forEach((side) => {
    let i = range[0];
    while (i < range[1]) {
      const w = 8 + rand() * 9, step = Math.max(3, Math.round(w / 2.6));
      const j = (i + Math.round(step / 2)) % N;
      if (!corner[j]) {
        const o = opts(side);
        if (!o) { i += step; continue; }
        const floors = o.floors[0] + ((rand() * (o.floors[1] - o.floors[0] + 1)) | 0);
        building(j, side, { w, d: 8 + rand() * 6, h: floors * 3.6 + 0.8, gap: o.gap + rand() * 2.5, ids: o.ids, shop: o.shop });
      }
      i += step + (rand() < 0.15 ? 2 : 0);   // now and then an alley
    }
  });
}

// ---------- People: little pixel figures (red jumpsuits and bandanas, like the video) ----------
const PEOPLE = ['jumpsuit-bandana', 'jumpsuit', 'tee-jeans', 'pink-jeans', 'hoodie', 'dancer'];
const peopleTex = canvasTex(8 * PEOPLE.length, 16, (g) => {
  PEOPLE.forEach((kind, k) => {
    const x = k * 8, px = (c, a, b, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + a, b, w, h); };
    const skin = ['#e0b08a', '#c98f68', '#f0c8a0'][k % 3], hair = '#1b1418';
    const red = '#C8110E', top = { 'tee-jeans': '#f3eee8', 'pink-jeans': '#f06eb0', hoodie: '#8a8a94' }[kind] || red;
    const legs = { 'tee-jeans': '#3a5a9a', 'pink-jeans': '#4a6aa8', hoodie: '#2a2a30' }[kind] || red;
    px(hair, 2, 0, 4, 2); px(skin, 2, 2, 4, 3); px(hair, 2, 2, 1, 2);
    if (kind === 'jumpsuit-bandana' || kind === 'dancer') { px(red, 1, 1, 6, 1); px('#f3e6d6', 3, 1, 1, 1); }
    px(top, 1, 5, 6, 5);
    if (kind === 'dancer') { px(top, 0, 2, 1, 4); px(top, 7, 2, 1, 4); px(skin, 0, 1, 1, 1); px(skin, 7, 1, 1, 1); } // arms up
    else { px(top, 0, 5, 1, 4); px(top, 7, 5, 1, 4); px(skin, 0, 9, 1, 1); px(skin, 7, 9, 1, 1); }
    if (kind.startsWith('jumpsuit') || kind === 'dancer') px('#8a0c0a', 1, 9, 6, 1);   // belt shadow
    px(legs, 2, 10, 2, 5); px(legs, 4, 10, 2, 5);
    px('#1b1418', 1, 15, 3, 1); px('#1b1418', 4, 15, 3, 1);
  });
});
const peopleM = new THREE.MeshBasicMaterial({ map: peopleTex, alphaTest: 0.5, side: THREE.DoubleSide });
/** A figure of kind k standing at sample i, lateral lat, facing the karts coming toward it. */
function person(i, lat, k) {
  const g = new THREE.PlaneGeometry(0.95, 1.9);
  const uv = g.attributes.uv, u0 = k / PEOPLE.length, u1 = (k + 1) / PEOPLE.length;
  for (let n = 0; n < 4; n++) uv.setX(n, u0 + uv.getX(n) * (u1 - u0));
  const m = new THREE.Mesh(g, peopleM);
  const o = off(i % N, lat);
  m.position.set(o[0], 0.95, o[1]);
  m.rotation.y = yawAt(i % N) + Math.PI + (rand() - 0.5) * 0.6;
  add(m);
}
/** A crowd along a range: n figures, on one or both sides, kinds drawn from `kinds`. */
function crowd(range, n, kinds, lat0, lat1, sides = [-1, 1]) {
  for (let k = 0; k < n; k++) {
    const i = range[0] + Math.floor(rand() * (range[1] - range[0]));
    if (corner[i % N]) continue;
    person(i, pick(sides) * (lat0 + rand() * (lat1 - lat0)), pick(kinds));
  }
}

// ---------- Street furniture ----------
function sidewalk(range) {
  // Pavement and curb between the road and the buildings, on the straights.
  const pos = [], col = [], c = new THREE.Color();
  const quad = (i, a, b, colour) => {
    const j = (i + 1) % N, A = off(i, a), B = off(i, b), C = off(j, a), D = off(j, b), y = 0.05;
    pos.push(A[0], y, A[1], C[0], y, C[1], B[0], y, B[1], B[0], y, B[1], C[0], y, C[1], D[0], y, D[1]);
    c.set(colour); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  };
  for (let i = range[0]; i < range[1]; i++) {
    if (corner[i % N]) continue;
    [-1, 1].forEach((s) => {
      const a = s * (HALF + 1.7), b = s * (HALF + 2.2), e = s * (HALF + 6);
      quad(i % N, Math.min(a, b), Math.max(a, b), '#d8cfc4');
      quad(i % N, Math.min(b, e), Math.max(b, e), (i >> 2) % 2 ? '#a89a8c' : '#a09284');
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  scene.add(m);
}
const binG = new THREE.CylinderGeometry(0.4, 0.35, 1, 8), potG = new THREE.CylinderGeometry(0.45, 0.35, 0.7, 8), bushG = new THREE.IcosahedronGeometry(0.7, 0);
const benchG = new THREE.BoxGeometry(0.8, 0.12, 2.4), benchBackG = new THREE.BoxGeometry(0.1, 0.7, 2.4), benchLegG = new THREE.BoxGeometry(0.7, 0.5, 2.2);
const planterG = new THREE.BoxGeometry(1.4, 0.8, 1.4), lampPostG = new THREE.CylinderGeometry(0.1, 0.12, 4, 6), globeG = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const kioskG = new THREE.BoxGeometry(1.8, 2.4, 1.8), kioskRoofG = new THREE.BoxGeometry(2.4, 0.3, 2.4);
const crateG = new THREE.BoxGeometry(0.9, 0.7, 0.9), umbG = new THREE.ConeGeometry(1.6, 0.7, 8), poleG = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), tableG = new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10);
function furniture(range, n, lat0, lat1, kinds = ['bin', 'pot', 'crate']) {
  for (let k = 0; k < n; k++) {
    const i = (range[0] + Math.floor(rand() * (range[1] - range[0]))) % N;
    if (corner[i]) continue;
    const o = off(i, pick([-1, 1]) * (lat0 + rand() * (lat1 - lat0))), g = new THREE.Group();
    const kind = pick(kinds);
    const at = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
    if (kind === 'bin') at(binG, tm(pick([0x2f6a46, 0x2a2a30, 0x2f5fa8])), 0.5);
    else if (kind === 'pot') { at(potG, tm(0xb0603a), 0.35); at(bushG, tm(0x2f7a46), 1.1); }
    else if (kind === 'crate') { at(crateG, tm(0x9a6a42), 0.35); if (rand() < 0.5) at(crateG, tm(pick([0xe0782f, 0x2fae6a, 0xf2c12e])), 1.05); }
    else if (kind === 'bench') { at(benchG, tm(0x8a5a36), 0.55); at(benchBackG, tm(0x8a5a36), 0.95).position.x = -0.35; at(benchLegG, tm(0x2a2024), 0.25); }
    else if (kind === 'planter') { at(planterG, tm(0xc9b8a2), 0.4); at(bushG, tm(0x3a8a4a), 1.1).scale.set(1.4, 1, 1.4); }
    else if (kind === 'lamp') { at(lampPostG, tm(0x2a2024), 2); at(globeG, bm(0xffe0a0), 4.1); }
    else if (kind === 'barrel') { at(binG, tm(pick([0x9a6a42, 0xC8110E, 0x2f5fa8])), 0.5).scale.set(1.2, 1.1, 1.2); }
    else if (kind === 'kiosk') { at(kioskG, tm(pick([0x2f8a4a, 0xC8110E, 0x2f6fa8])), 1.2); at(kioskRoofG, tm(0xf3e6d6), 2.55); }
    else if (kind === 'cafe') { at(tableG, tm(0xf3e6d6), 0.75); at(poleG, tm(0x2a2024), 1.2); at(umbG, tm(pick([0xC8110E, 0xf3e6d6, 0xe8a23a])), 2.5); }
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = rand() * 6.28;
    add(g);
  }
}

// ---------- Seaside: ocean, sun glitter, wall with graffiti ----------
let sea = null, glitter = null;
let shore = null;
function ocean() {
  // The beach: a strip of sand, wet sand and shallow turquoise water with ripples (shore.png, seen from above),
  // tiled along the coast, then the deep sea out to the clouds.
  const st = new THREE.TextureLoader().load(shoreUrl);
  st.magFilter = st.minFilter = THREE.NearestFilter;
  st.generateMipmaps = false;
  st.wrapS = THREE.RepeatWrapping;
  const PXM = 0.25, depth = 224 * PXM;            // 4 texture pixels per metre
  st.repeat.set(2400 / (96 * PXM), 1);
  shore = new THREE.Mesh(new THREE.PlaneGeometry(2400, depth), new THREE.MeshBasicMaterial({ map: st, fog: false, color: 0xfff0e6 }));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(48, 0.04, SEA_Z - BEACH - depth / 2);
  scene.add(shore);
  // Dry sand from the coast down to where the shore texture starts, the same colour as its top rows.
  const sand = canvasTex(32, 32, (g) => {
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 30; k++) { g.fillStyle = k % 3 ? '#f0dfbe' : '#e6cfa8'; g.fillRect((k * 13) % 32, (k * 7) % 32, 1 + (k % 2), 1); }
  }, true);
  sand.repeat.set(2400 / 8, BEACH / 8);
  const dry = new THREE.Mesh(new THREE.PlaneGeometry(2400, BEACH), new THREE.MeshBasicMaterial({ map: sand, color: 0xfff0e6 }));
  dry.rotation.x = -Math.PI / 2;
  dry.position.set(48, 0.04, SEA_Z - BEACH / 2);
  scene.add(dry);
  const tex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#006f89'; g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 22; k++) {
      g.fillStyle = k % 4 ? '#0a8099' : '#e7966a';
      g.fillRect((k * 11) % 32, (k * 7) % 32, 3 + (k % 4), 1);
    }
  }, true);
  tex.repeat.set(120, 50);
  // No fog on the sea, so it stays blue out to the clouds.
  sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1000), new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0xfff0e6 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(48, 0.04, SEA_Z - BEACH - depth - 500);
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
  glitter.position.set(48, 0.1, SEA_Z - 500);
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
  // The land side of the terrace: a row of pastel houses and a white one covered in graffiti, cafe tables, people
  // leaning on the sea wall.
  SEASIDE.forEach((r) => street(r, (side) => (side < 0 ? { floors: [1, 4], gap: 8, ids: WEST_IDS, shop: true } : null)));
  const white = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 22), new THREE.MeshBasicMaterial({ map: graffiti(4242, '#ece6e0') }));
  const wo = off(80, -(HALF + 16));
  white.position.set(wo[0], 5, wo[1]); white.rotation.y = yawAt(80);
  add(white);
  SEASIDE.forEach((r) => {
    furniture(r, 14, HALF + 2.5, HALF + 6, ['cafe']);
    crowd(r, 22, [0, 1, 2, 3, 4], HALF + 6.5, HALF + 8.2, [1]);   // along the sea wall
    crowd(r, 10, [0, 1, 2, 3], HALF + 3, HALF + 6, [-1]);
  });
}

// ---------- Market street ----------

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

/** A parked car by the curb: a little boxy sedan in a street colour. */
function car(i, lat, colour) {
  const g = new THREE.Group(), body = tm(colour), dark = tm(0x1b1b20), glass = bm(0x2a3446);
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 4.4), body); b.position.y = 0.8; g.add(b);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 2.4), body); top.position.set(0, 1.55, -0.2); g.add(top);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.05), glass); ws.position.set(0, 1.58, 1.02); g.add(ws);
  [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 8), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); g.add(w);
  });
  const o = off(i % N, lat);
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i % N) + (rand() < 0.5 ? Math.PI : 0);
  g.traverse((m) => { m.castShadow = true; });
  add(g);
}
const CAR_COLOURS = [0xe8c13a, 0xf3eee8, 0xC8110E, 0x2f6fa8, 0x3a8a4a, 0x8a8a94, 0xe0782f];
/** Cars parked along both curbs of a range, now and then. */
function parked(range, n) {
  for (let k = 0; k < n; k++) {
    const i = range[0] + Math.floor(rand() * (range[1] - range[0]));
    if (corner[i % N]) continue;
    car(i, pick([-1, 1]) * (HALF + 3.1), pick(CAR_COLOURS));
  }
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
  // Stands across the road, its lettering facing the karts that drive toward it (local -z).
  sign.rotation.y = Math.PI;
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
  street(MARKET, () => ({ floors: [2, 4], gap: 5.5, ids: MARKET_IDS, shop: true }));
  sidewalk(MARKET);
  furniture(MARKET, 40, HALF + 2.6, HALF + 5.5, ['bin', 'pot', 'crate', 'bench', 'lamp', 'kiosk', 'barrel', 'crate']);
  parked(MARKET, 8);
  crowd(MARKET, 40, [0, 1, 2, 3, 4], HALF + 2.6, HALF + 5.5);
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
  // Cream walls with iron balconies on every floor (the upper floors of the Mediterranean facades), the inmates
  // in red jumpsuits dancing in the yard, like the video.
  for (let i = PRISON[0], k = 0; i < PRISON[1]; i += 7, k++) {
    [-1, 1].forEach((side) => building(i, side, { w: 18, d: 4, h: 18, ids: PRISON_IDS, from: 'top', gap: 7, shop: false, roof: false }));
  }
  sidewalk(PRISON);
  // Props along the yard so the walls don't run on alone: lamps, benches, planters, barrels, a guard kiosk.
  furniture(PRISON, 52, HALF + 2.6, HALF + 5.8, ['lamp', 'bench', 'planter', 'barrel', 'lamp', 'planter', 'kiosk']);
  crowd(PRISON, 46, [0, 1, 5, 5], HALF + 2.4, HALF + 5.8);
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
    // A keystone at the top of the arch (no lintel above it).
    const key = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 3.4), stoneM); key.position.y = 12 + r + 1.2; g.add(key);
    const o = off(i, 0);
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = yawAt(i);
    add(g);
  });
}

// ---------- West side: pastel houses and graffiti walls ----------
function westSide() {
  const westWalls = [31, 132, 233].map((seed) => new THREE.MeshBasicMaterial({ map: graffiti(seed) }));
  let k = 0;
  for (let i = WEST[0]; i < WEST[1]; i += 6) {
    if (corner[i]) continue;
    const side = k % 2 ? 1 : -1;
    k++;
    if (rand() < 0.25) {   // a graffiti wall instead of a house
      const o = off(i, side * (HALF + 6));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 14), pick(westWalls));
      m.position.set(o[0], 1.5, o[1]);
      m.rotation.y = yawAt(i);
      add(m);
      continue;
    }
    const w = 9 + rand() * 7;
    building(i, side, { w, d: 8 + rand() * 5, h: (1 + ((rand() * 3) | 0)) * 3.6 + 0.8, ids: WEST_IDS, gap: 6.5 + rand() * 2 });
    if (rand() < 0.6) building(i, -side, { w: 8 + rand() * 6, d: 8 + rand() * 5, h: (1 + ((rand() * 3) | 0)) * 3.6 + 0.8, ids: WEST_IDS, gap: 6.5 + rand() * 2 });
  }
  sidewalk(WEST);
  furniture(WEST, 34, HALF + 2.6, HALF + 5.5, ['bin', 'pot', 'planter', 'bench', 'lamp', 'kiosk']);
  parked(WEST, 7);
  crowd(WEST, 14, [1, 2, 3, 4], HALF + 2.6, HALF + 5.5);
}

// ---------- The town around the circuit: blocks of houses on a street grid ----------
// Every house is a facade box from the atlas (all merged with the track's buildings into one mesh), in rows along
// a grid of little streets, with roof clutter. Nothing within reach of the track, nothing on the beach.
function town() {
  const CELL = 30;
  for (let x = -360; x <= 480; x += CELL) {
    for (let z = -10; z <= 440; z += CELL) {
      const d = minTrackDist(x, z);
      if (z < SEA_Z + 30 || d < HALF + 24 || d > 240) continue;
      // Two to four houses around the block, back to back.
      const n = 2 + ((rand() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const w = 9 + rand() * 8, dd = 8 + rand() * 4, h = (1 + ((rand() * 4) | 0)) * 3.6 + 0.8;
        const qx = (k % 2 ? 1 : -1) * (CELL / 2 - dd / 2 - 2.5), qz = (k >> 1 ? 1 : -1) * (CELL / 4) + (rand() - 0.5) * 3;
        if (minTrackDist(x + qx, z + qz) < HALF + 18) continue;
        const grp = new THREE.Group();
        const m = new THREE.Mesh(facadeBox(dd, h, w, pick(TOWN_IDS)), facadeM);
        m.position.y = h / 2; m.castShadow = true; grp.add(m);
        roofTop(grp, dd, h, w);
        grp.position.set(x + qx, 0, z + qz);
        grp.rotation.y = rand() < 0.5 ? 0 : Math.PI / 2;
        add(grp);
      }
    }
  }
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
  [['SM_TI_Wood_0_Boat_0', 120, -88, 0.4], ['SM_TI_Wood_1_Boat_0', 160, -80, 2.2], ['SM_TI_Wood_0_Boat_0', -60, -96, 1.3], ['SM_TI_Wood_1_Boat_0', 260, -104, 0.9]].forEach(([name, x, z, r]) => {
    model(name).then((parts) => parts.forEach(({ geometry, material }) => {
      const b = new THREE.Mesh(geometry, material);
      b.position.set(x, 0.3, z); b.rotation.y = r; b.scale.setScalar(1.6);
      b.userData.phase = Math.random() * 6;
      scene.add(b); floating.push(b);
    })).catch(() => {});
  });
  model('SM_TI_Wood_0_Pier_0').then((parts) => parts.forEach(({ geometry, material }) => {
    const p = new THREE.Mesh(geometry, material);
    p.position.set(80, 0.9, SEA_Z - BEACH - 18); p.rotation.y = Math.PI; p.scale.setScalar(0.7);
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

// The beach between the sea wall and the water: umbrellas, towels, a lifeguard tower, people.
function beach() {
  const xs = [-170, 330], z0 = SEA_Z - 6, z1 = SEA_Z - BEACH - 10;
  const at = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; add(m); return m; };
  const towel = new THREE.BoxGeometry(1.1, 0.05, 2.1);
  for (let k = 0; k < 34; k++) {
    const x = xs[0] + rand() * (xs[1] - xs[0]), z = z0 + rand() * (z1 - z0);
    at(poleG, tm(0x2a2024), x, 1.2, z);
    at(umbG, tm(pick([0xC8110E, 0xf3e6d6, 0xe8a23a, 0x2f8ad6, 0xf06eb0])), x, 2.5, z);
    at(towel, tm(pick([0xC8110E, 0xf2c12e, 0x2fae6a, 0xf06eb0, 0xf3e6d6])), x + 1.3, 0.08, z + (rand() - 0.5)).rotation.y = rand() - 0.5;
  }
  // Lifeguard tower: red box on stilts.
  [40, 220].forEach((x) => {
    const z = SEA_Z - BEACH - 6;
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([dx, dz]) => at(new THREE.BoxGeometry(0.2, 3, 0.2), tm(0xf3e6d6), x + dx, 1.5, z + dz));
    at(new THREE.BoxGeometry(2.4, 1.6, 2.4), tm(0xC8110E), x, 3.8, z);
    at(new THREE.BoxGeometry(2.8, 0.2, 2.8), tm(0xf3e6d6), x, 4.7, z);
  });
  // People on the sand, facing the sea and the road.
  for (let k = 0; k < 40; k++) {
    const x = xs[0] + rand() * (xs[1] - xs[0]), z = z0 + rand() * (z1 - z0 - 2);
    const kk = pick([0, 1, 2, 3, 4, 2, 3]), g = new THREE.PlaneGeometry(0.95, 1.9), uv = g.attributes.uv;
    for (let n = 0; n < 4; n++) uv.setX(n, kk / PEOPLE.length + uv.getX(n) / PEOPLE.length);
    const m = new THREE.Mesh(g, peopleM); m.position.set(x, 0.95, z); m.rotation.y = rand() * 6.28; add(m);
  }
}

// The turns between the parts: people watching from behind the tyres, street lamps and clutter.
function corners() {
  const person2 = (i, lat, k) => {   // like person(), but allowed on the turns
    const g = new THREE.PlaneGeometry(0.95, 1.9), uv = g.attributes.uv, u0 = k / PEOPLE.length, u1 = (k + 1) / PEOPLE.length;
    for (let n = 0; n < 4; n++) uv.setX(n, u0 + uv.getX(n) * (u1 - u0));
    const m = new THREE.Mesh(g, peopleM), o = off(i % N, lat);
    m.position.set(o[0], 0.95, o[1]); m.rotation.y = yawAt(i % N) + Math.PI + (rand() - 0.5) * 0.8;
    add(m);
  };
  [[112, 150], [276, 298], [472, 492], [636, 650]].forEach(([a, b]) => {
    for (let k = 0; k < (b - a) * 0.9; k++) {
      const i = a + Math.floor(rand() * (b - a)), side = rand() < 0.5 ? -1 : 1;
      person2(i, side * (HALF + 10.5 + rand() * 3), pick([0, 0, 1, 2, 3, 4, 5]));
    }
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
  corners();
  beach();
  // Billboards: each of the seven ads beside a straight, facing the karts, and two over the road in the prison yard.
  [['pearl', 72, 1], ['route', 188, -1], ['haven', 548, 1], ['dormant', 602, -1], ['noomax', 692, 1]]
    .forEach(([name, i, side]) => roadsideAd(i, side, name));
  overheadAd(30, 'midnight');
  overheadAd(228, 'centuries');
  overheadAd(344, 'noomax');
  overheadAd(410, 'haven');
  overheadAd(262, 'route');
  bake();
  props();
}

export function updateParadise(dt, now) {
  if (sea) sea.material.map.offset.x = (now / 60000) % 1;
  if (shore) shore.material.map.offset.x = (now / 90000) % 1;   // the ripples drift along the coast
  floating.forEach((b) => { b.position.y = 0.3 + Math.sin(now / 700 + b.userData.phase) * 0.15; b.rotation.z = Math.sin(now / 900 + b.userData.phase) * 0.05; });
  if (glitter) {
    // On the line from the camera toward the sun (moonDir in theme.js: x 0.1, z -0.97).
    glitter.position.x = camera.position.x - (0.1 / 0.97) * (glitter.position.z - camera.position.z);
    glitter.material.opacity = 0.65 + Math.sin(now / 500) * 0.15;
  }
}
