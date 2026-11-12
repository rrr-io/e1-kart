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
import { nightAmount, setAlarm } from './sky.js';
import { N, HALF, WORLD_K, corner, off, yawAt, minTrackDist, P, ground } from './track.js';
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
// Unlit surfaces that have to dim when night falls: [material, its colour at sunset, how dark it gets].
const dims = [];
const dim = (mat, k = 0.3) => { dims.push([mat, mat.color.clone(), k]); return mat; };

const SEASIDE = [[650, 720], [0, 112]];
const MARKET = [150, 276];
const PRISON = [298, 472];
const WEST = [492, 636];
const SEA_Z = -36;           // the edge of the terrace: the cliff drops to the sea south of here
const CLIFF = 12;            // how far below the terrace the beach and the sea are
const BEACH = 14;            // metres of dry sand at the foot of the cliff before the shore strip

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

// ---------- Casas: low Barranco / Lima houses drawn here, one or two floors (4 m each), 12 m wide ----------
// Painted plaster in strong colours, barred windows, wooden doors, shop shutters with a painted sign, wooden
// balconies, an unfinished brick upper floor, a mural. All in one canvas, so every casa merges into one mesh.
const CASA_N = 12, CW = 96, CH = 64;   // 8 px per metre
const CASA_COL = ['#e7a23a', '#d9685a', '#3fa7a0', '#ece6da', '#e8c9a0', '#7fa6d9', '#d98ab0', '#b9623c', '#c9a27e', '#8fbf7a', '#f2e9dc', '#e2b23a'];
const SHOP_SIGNS = ['BODEGA', 'FRUTAS', 'POLLO', 'CAFE', 'TIENDA', 'JUGOS'];
const casaTex = canvasTex(CW * (CASA_N + 1), CH, (g) => {
  for (let k = 0; k < CASA_N; k++) {
    let s = 977 + k * 131;
    const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    const x0 = k * CW, base = CASA_COL[k], F = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x0 + x, y, w, h); };
    F(base, 0, 0, CW, CH);
    const brick = (y, h) => { F('#b9623c', 0, y, CW, h); for (let yy = y; yy < y + h; yy += 3) for (let xx = (yy % 6 ? 0 : 3); xx < CW; xx += 6) F('#8f4428', xx, yy + 2, 5, 1); };
    if (k === 7) brick(0, CH);
    if (k % 4 === 1) brick(0, 30);                                  // upper floor left in bare brick
    for (let n = 0; n < 40; n++) F('rgba(0,0,0,.06)', (r() * CW) | 0, (r() * CH) | 0, 2 + ((r() * 3) | 0), 1);   // stains
    F('rgba(0,0,0,.22)', 0, CH - 5, CW, 5);                           // darker plinth
    F('rgba(255,255,255,.25)', 0, 0, CW, 2);                          // cornice
    F('rgba(0,0,0,.2)', 0, 31, CW, 1);                                // floor line
    const win = (x, y, w = 11, h = 12) => {
      F('#f3e6d6', x - 1, y - 1, w + 2, h + 2); F(r() < 0.4 ? '#ffcf7a' : '#27303f', x, y, w, h);
      for (let b = 2; b < w; b += 3) F('#1b1418', x + b, y, 1, h);    // iron bars
      F('#1b1418', x, y + (h >> 1), w, 1);
    };
    const door = (x) => { F('#3a2418', x - 1, CH - 21, 11, 21); F('#6b4226', x, CH - 20, 9, 20); F('#3a2418', x + 4, CH - 20, 1, 20); F('#e6c02e', x + 6, CH - 11, 1, 1); };
    const shop = k % 3 === 0;
    if (shop) {
      const sx = 34 + ((r() * 8) | 0), band = ['#C8110E', '#2f9a52', '#2f6fa8', '#e6c02e'][k % 4];
      F('#5a5f6a', sx, CH - 22, 44, 22); for (let yy = CH - 21; yy < CH; yy += 2) F('#7a808c', sx, yy, 44, 1);   // roller shutter
      F(band, sx - 2, CH - 30, 48, 7);
      g.fillStyle = band === '#e6c02e' ? '#1b1418' : '#fff6e0';
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(SHOP_SIGNS[k % SHOP_SIGNS.length].slice(0, 6), x0 + sx + 22, CH - 26);
      door(8 + ((r() * 10) | 0));
    } else {
      const dx = 12 + ((r() * 60) | 0);
      door(dx);
      [8, 34, 60, 78].forEach((wx) => { if (Math.abs(wx - dx) > 14 && r() < 0.75) win(wx, CH - 22); });
    }
    if (k === 10) {                                                  // a mural across the upper floor
      ['#C8110E', '#2f8ad6', '#f2c12e', '#2fae6a', '#f06eb0', '#7a3fd0'].forEach((c, n) => { F(c, 6 + n * 14, 6 + ((n * 7) % 12), 16, 10); F(c, 10 + n * 14, 3 + ((n * 5) % 9), 8, 18); });
    } else {
      [10, 42, 74].forEach((wx) => { if (r() < 0.8) win(wx, 8, 11, 13); });
      if (k % 2 === 0) { F('#3a2418', 4, 24, CW - 8, 2); for (let b = 5; b < CW - 5; b += 3) F('#3a2418', b, 19, 1, 6); F('#3a2418', 4, 18, CW - 8, 1); }   // wooden balcony
    }
  }
  g.fillStyle = '#9a8f84'; g.fillRect(CASA_N * CW, 0, CW, CH);       // roof tile: concrete
  g.fillStyle = '#8a7f74'; for (let yy = 0; yy < CH; yy += 8) g.fillRect(CASA_N * CW, yy, CW, 1);
});
paradiseTexts.push(casaTex);
const casaM = toon(0xffffff, { map: casaTex });
/** A casa: floors 1 or 2, w along the street (up to 12 m shows a whole tile), its walls from tile k. */
function casaBox(d, floors, w, k) {
  const h = floors * 4, g = new THREE.BoxGeometry(d, h, w), uv = g.attributes.uv, T = CASA_N + 1;
  const piece = (fw) => { const cw = Math.min(1, fw / 12), o = (1 - cw) * rand(); return [(k + o) / T, 0, (k + o + cw) / T, floors === 2 ? 1 : 0.5]; };
  const roof = [(CASA_N + 0.1) / T, 0.1, (CASA_N + 0.9) / T, 0.9];
  const faces = [piece(w), piece(w), roof, roof, piece(d), piece(d)];
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = faces[f];
    for (let n = f * 4; n < f * 4 + 4; n++) uv.setXY(n, u0 + uv.getX(n) * (u1 - u0), v0 + uv.getY(n) * (v1 - v0));
  }
  return [g, h];
}

/** A building on one side of the track at sample i (front facing the road). */
function building(i, side, { w = 14, d = 10, h = 12, ids: pool = TOWN_IDS, id, gap = 6, from = 'bottom', shop = true, roof = true, casa = 0 }) {
  const grp = new THREE.Group();
  let m;
  if (rand() < casa) {   // a low painted casa instead of a facade from the atlas
    w = Math.min(w, 12);
    const [geo, ch] = casaBox(d, h > 6 ? 2 : 1, w, (rand() * CASA_N) | 0);
    h = ch; shop = shop && rand() < 0.4;
    m = new THREE.Mesh(geo, casaM);
  } else m = new THREE.Mesh(facadeBox(d, h, w, id || pick(pool), from), facadeM);
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
        building(j, side, { w, d: 8 + rand() * 6, h: floors * 3.6 + 0.8, gap: o.gap + rand() * 2.5, ids: o.ids, shop: o.shop, casa: o.casa || 0 });
      }
      i += step + (rand() < 0.15 ? 2 : 0);   // now and then an alley
    }
  });
}

// ---------- People: little pixel figures. The inmates wear the video's red tracksuit: jacket open on a white tee,
// a white number tag on the chest, red trousers with a white stripe. ----------
const PEOPLE = ['inmate', 'inmate-tee', 'tee-jeans', 'pink-jeans', 'hoodie', 'dancer'];
const peopleTex = canvasTex(8 * PEOPLE.length, 16, (g) => {
  PEOPLE.forEach((kind, k) => {
    const x = k * 8, px = (c, a, b, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + a, b, w, h); };
    const skin = ['#e0b08a', '#c98f68', '#f0c8a0'][k % 3], hair = k % 2 ? '#1b1418' : '#3a2a22';
    const red = '#B8141A', dark = '#7d0c10', white = '#f3eee8';
    const inmate = kind === 'inmate' || kind === 'dancer', tee = kind === 'inmate-tee';
    const top = inmate ? red : tee ? white : { 'tee-jeans': white, 'pink-jeans': '#f06eb0', hoodie: '#8a8a94' }[kind];
    const legs = inmate || tee ? red : { 'tee-jeans': '#3a5a9a', 'pink-jeans': '#4a6aa8', hoodie: '#2a2a30' }[kind];
    px(hair, 2, 0, 4, 2); px(skin, 2, 2, 4, 3); px(hair, 2, 2, 1, 2);
    px(top, 1, 5, 6, 5);
    if (inmate) { px(white, 3, 5, 2, 5); px(white, 5, 6, 2, 1); px(dark, 1, 9, 2, 1); px(dark, 5, 9, 2, 1); }   // open jacket, tee, number tag
    if (tee) px(dark, 2, 9, 4, 1);                                                                           // jacket tied at the waist
    if (kind === 'dancer') { px(top, 0, 2, 1, 4); px(top, 7, 2, 1, 4); px(skin, 0, 1, 1, 1); px(skin, 7, 1, 1, 1); } // arms up
    else { px(tee ? skin : top, 0, 5, 1, 4); px(tee ? skin : top, 7, 5, 1, 4); px(skin, 0, 9, 1, 1); px(skin, 7, 9, 1, 1); }
    px(legs, 2, 10, 2, 5); px(legs, 4, 10, 2, 5);
    if (inmate || tee) { px(white, 2, 10, 1, 5); px(white, 5, 10, 1, 5); }                                    // side stripes
    px(white, 1, 15, 3, 1); px(white, 4, 15, 3, 1);
  });
});
const peopleM = dim(new THREE.MeshBasicMaterial({ map: peopleTex, alphaTest: 0.5, side: THREE.DoubleSide }), 0.6);
/** A figure of kind k standing at sample i, lateral lat, facing the karts coming toward it. */
function person(i, lat, k, y = 0) {
  const g = new THREE.PlaneGeometry(0.95, 1.9);
  const uv = g.attributes.uv, u0 = k / PEOPLE.length, u1 = (k + 1) / PEOPLE.length;
  for (let n = 0; n < 4; n++) uv.setX(n, u0 + uv.getX(n) * (u1 - u0));
  const m = new THREE.Mesh(g, peopleM);
  const o = off(i % N, lat);
  m.position.set(o[0], y + 0.95, o[1]);
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
function sidewalk(range, outer = HALF + 6, tones = ['#a89a8c', '#a09284']) {
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
      const a = s * (HALF + 1.7), b = s * (HALF + 2.2), e = s * outer;
      quad(i % N, Math.min(a, b), Math.max(a, b), '#d8cfc4');
      quad(i % N, Math.min(b, e), Math.max(b, e), tones[(i >> 2) % 2]);
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
    else if (kind === 'cart') {            // fruit cart with an umbrella
      at(new THREE.BoxGeometry(1.4, 0.7, 2.2), tm(0x6b4a32), 0.9);
      [0xf2c12e, 0xe0782f, 0x2fae6a].forEach((c, n) => { at(crateG, tm(c), 1.45).position.z = (n - 1) * 0.7; });
      [-0.9, 0.9].forEach((z) => { const w = at(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 8), tm(0x1b1b20), 0.4); w.rotation.z = Math.PI / 2; w.position.set(0.75, 0.4, z); });
      at(poleG, tm(0x2a2024), 1.9); at(umbG, tm(pick([0xC8110E, 0xe8a23a, 0x2f8ad6])), 3.1);
    } else if (kind === 'sacks') { [0, 1, 2].forEach((n) => { const m = at(bushG, tm(pick([0xd8c9a8, 0xc9b08a])), 0.4 + (n === 2 ? 0.55 : 0)); m.scale.set(1, 0.6, 0.8); m.position.x = n === 2 ? 0.3 : n * 0.9; }); }
    else if (kind === 'chairs') { [0, 1].forEach((n) => { const c = pick([0xC8110E, 0xf3eee8, 0x2f6fa8]); at(new THREE.BoxGeometry(0.5, 0.08, 0.5), tm(c), 0.5).position.x = n; at(new THREE.BoxGeometry(0.5, 0.5, 0.08), tm(c), 0.78).position.set(n, 0.78, -0.22); at(new THREE.BoxGeometry(0.4, 0.5, 0.4), tm(0x8a8a94), 0.25).position.x = n; }); }
    else if (kind === 'redcrates') { for (let n = 0; n < 3; n++) at(new THREE.BoxGeometry(0.8, 0.5, 0.6), tm(n === 1 ? 0xf2c12e : 0xC8110E), 0.25 + n * 0.5); }
    else if (kind === 'telescope') { at(lampPostG, tm(0x5a6a7a), 0.7).scale.set(1.4, 0.35, 1.4); at(new THREE.BoxGeometry(0.35, 0.35, 0.9), tm(0x5a6a7a), 1.55); }
    else if (kind === 'tree') { at(lampPostG, tm(0x6b4a32), 1.4).scale.set(1.6, 0.7, 1.6); at(bushG, tm(0x2f7a46), 3.2).scale.set(2, 1.8, 2); at(bushG, tm(0x3a8a4a), 4.2).scale.set(1.3, 1.2, 1.3); at(planterG, tm(0xb0603a), 0.4); }
    else if (kind === 'bucket') { at(binG, tm(pick([0x8a8a94, 0x2f5fa8])), 0.3).scale.set(0.8, 0.55, 0.8); }
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
  // Like the video's mirador, the terrace is on top of a cliff: the ground ends at SEA_Z, a rock face drops to a
  // beach (sand, wet sand and shallow water with ripples, shore.png seen from above), then the open sea out to the
  // clouds, with breakwaters and a headland across the bay.
  ground.position.z = SEA_Z + 1100;
  const SL = -CLIFF + 0.04;
  const rock = canvasTex(32, 16, (g) => {
    g.fillStyle = '#8a6a4e'; g.fillRect(0, 0, 32, 16);
    for (let k = 0; k < 40; k++) { g.fillStyle = ['#7a5a40', '#9a7a5a', '#6f8a4a'][k % 3 === 2 && k % 5 ? 0 : k % 3]; g.fillRect((k * 13) % 32, (k * 5) % 16, 2 + (k % 5), 1); }
  }, true);
  rock.repeat.set(2400 / 32, 1);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2400, CLIFF + 1), dim(new THREE.MeshBasicMaterial({ map: rock, side: THREE.DoubleSide })));
  face.position.set(48, -(CLIFF + 1) / 2 + 0.5, SEA_Z);
  scene.add(face);
  const st = new THREE.TextureLoader().load(shoreUrl);
  st.magFilter = st.minFilter = THREE.NearestFilter;
  st.generateMipmaps = false;
  st.wrapS = THREE.RepeatWrapping;
  const PXM = 0.25, depth = 224 * PXM;            // 4 texture pixels per metre
  st.repeat.set(2400 / (96 * PXM), 1);
  shore = new THREE.Mesh(new THREE.PlaneGeometry(2400, depth), dim(new THREE.MeshBasicMaterial({ map: st, fog: false, color: 0xfff0e6 }), 0.32));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(48, SL, SEA_Z - BEACH - depth / 2);
  scene.add(shore);
  // Dry sand from the coast down to where the shore texture starts, the same colour as its top rows.
  const sand = canvasTex(32, 32, (g) => {
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 30; k++) { g.fillStyle = k % 3 ? '#f0dfbe' : '#e6cfa8'; g.fillRect((k * 13) % 32, (k * 7) % 32, 1 + (k % 2), 1); }
  }, true);
  sand.repeat.set(2400 / 8, BEACH / 8);
  const dry = new THREE.Mesh(new THREE.PlaneGeometry(2400, BEACH), dim(new THREE.MeshBasicMaterial({ map: sand, color: 0xfff0e6 }), 0.32));
  dry.rotation.x = -Math.PI / 2;
  dry.position.set(48, SL, SEA_Z - BEACH / 2);
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
  sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1000), dim(new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0xfff0e6 }), 0.22));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(48, SL, SEA_Z - BEACH - depth - 500);
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
  glitter.position.set(48, SL + 0.06, SEA_Z - 500);
  scene.add(glitter);
  // Breakwaters: lines of dark rocks running out from the beach.
  [-220, -20, 200, 420].forEach((x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 70), tm(0x4a4038)); b.position.set(x, SL + 0.5, SEA_Z - BEACH - 40); add(b);
  });
  // The headland across the bay, to the east: dusty flat-topped hills with the lights of a town on them.
  for (let k = 0; k < 9; k++) {
    const r = 60 + rand() * 50, h = 22 + rand() * 34, x = 640 + k * 30 + rand() * 20, z = SEA_Z - 70 - k * 52;
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, h, 7), tm(k % 2 ? 0x8a6248 : 0x7a563e));
    hill.position.set(x, SL + h / 2, z); hill.rotation.y = rand() * 3; add(hill);
    for (let n = 0; n < 10; n++) {
      const a = Math.PI * (0.9 + rand() * 0.9), rr = r * (0.62 + rand() * 0.3), l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), bm(rand() < 0.8 ? 0xffd27a : 0xfff0c0));
      l.position.set(x + Math.cos(a) * rr, SL + h * (0.2 + rand() * 0.75), z + Math.sin(a) * rr * 0.8); add(l);
    }
  }
}

function seaWall() {
  const wallMats = [1, 2, 3, 4].map((k) => new THREE.MeshBasicMaterial({ map: graffiti(k * 977, '#b8b0a8') }));
  SEASIDE.forEach((r) => {
    for (let i = r[0]; i < r[1]; i += 6) {
      const j = i % N, o = off(j, HALF + 9);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 15.2), wallMats[(i / 6) % 4 | 0]);
      wall.position.set(o[0], 0.7, o[1]);
      wall.rotation.y = yawAt(j);
      wall.castShadow = true;
      add(wall);
    }
  });
  // The land side of the terrace: a row of pastel houses and a white one covered in graffiti, cafe tables, people
  // leaning on the sea wall.
  SEASIDE.forEach((r) => street(r, (side) => (side < 0 ? { floors: [1, 3], gap: 8, ids: WEST_IDS, shop: true, casa: 0.6 } : null)));
  const white = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 22), new THREE.MeshBasicMaterial({ map: graffiti(4242, '#ece6e0') }));
  const wo = off(80, -(HALF + 16));
  white.position.set(wo[0], 5, wo[1]); white.rotation.y = yawAt(80);
  add(white);
  SEASIDE.forEach((r) => {
    furniture(r, 26, HALF + 2.5, HALF + 7.5, ['cafe', 'bench', 'lamp', 'telescope', 'cart', 'chairs', 'redcrates', 'pot', 'lamp']);
    crowd(r, 22, [2, 3, 4, 2, 3, 1], HALF + 6.5, HALF + 8, [1]);   // leaning on the parapet, looking at the sea
    crowd(r, 12, [2, 3, 4, 0], HALF + 3, HALF + 6, [-1]);
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
    if (rand() < 0.45) mototaxi(i, pick([-1, 1]) * (HALF + 3), pick([0xC8110E, 0x2f6fa8, 0xe8c13a, 0x2f8a4a]));
    else car(i, pick([-1, 1]) * (HALF + 3.1), pick(CAR_COLOURS));
  }
}
/** A mototaxi: the three-wheeled taxi of Lima's side streets, with a canopy. */
function mototaxi(i, lat, colour) {
  const g = new THREE.Group(), body = tm(colour), dark = tm(0x1b1b20);
  const at = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  at(new THREE.BoxGeometry(1.5, 1, 1.6), body, 0, 0.95, -0.5);
  at(new THREE.BoxGeometry(1.6, 0.1, 2.9), dark, 0, 2.05, 0);
  [[-0.7, -1.2], [0.7, -1.2], [-0.7, 1.2], [0.7, 1.2]].forEach(([x, z]) => at(new THREE.BoxGeometry(0.08, 1.2, 0.08), dark, x, 1.45, z));
  at(new THREE.BoxGeometry(0.5, 0.6, 0.9), body, 0, 0.8, 0.9);
  at(new THREE.BoxGeometry(1.3, 0.5, 0.05), bm(0x2a3446), 0, 1.6, 1.25);
  [[-0.75, -0.6], [0.75, -0.6], [0, 1.25]].forEach(([x, z]) => { const w = at(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 8), dark, x, 0.38, z); w.rotation.z = Math.PI / 2; });
  const o = off(i % N, lat);
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i % N) + (rand() < 0.5 ? Math.PI : 0);
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
  // The market's sign in the video: a green half-sun with yellow rays, the name around it.
  const tex = canvasTex(128, 64, (g, w, h) => {
    const cx = w / 2, cy = h - 2, disc = (r, c, ky = 0.95) => {
      g.fillStyle = c;
      for (let y = 0; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - hw, Math.round(cy - y * ky), hw * 2, 1); }
    };
    disc(62, '#e6c02e'); disc(59, '#2f9a52');
    disc(38, '#e6c02e'); disc(36, '#2f9a52');
    g.strokeStyle = '#e6c02e'; g.lineWidth = 2;
    for (let a = 12; a <= 168; a += 13) { const t = (a * Math.PI) / 180; g.beginPath(); g.moveTo(cx + Math.cos(t) * 10, cy - Math.sin(t) * 10); g.lineTo(cx + Math.cos(t) * 35, cy - Math.sin(t) * 35 * 0.95); g.stroke(); }
    disc(10, '#e6c02e');
    const text = 'EL CAPULLO';
    g.fillStyle = '#ffe14d';
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < text.length; k++) {
      const t = Math.PI * (0.86 - (0.72 * k) / (text.length - 1));
      g.save();
      g.translate(cx + Math.cos(t) * 48, cy - Math.sin(t) * 48 * 0.95);
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
    // The market's green gates, swung open against the posts.
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 4.2), tm(0x2a8a48));
    leaf.position.set(s * (HALF + 4.6), 2.6, 1.6); leaf.rotation.y = s * 0.5; grp.add(leaf);
  });
  const beamY = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 7.6, 0.7, 0.6), tm(0xe6c02e));
  beamY.position.y = 6.3; grp.add(beamY);
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
  street(MARKET, () => ({ floors: [1, 3], gap: 5.5, ids: MARKET_IDS, shop: true, casa: 0.5 }));
  sidewalk(MARKET);
  furniture(MARKET, 60, HALF + 2.6, HALF + 5.5, ['bin', 'crate', 'cart', 'sacks', 'chairs', 'redcrates', 'cart', 'lamp', 'kiosk', 'barrel', 'crate', 'pot']);
  parked(MARKET, 10);
  crowd(MARKET, 40, [0, 1, 2, 3, 4], HALF + 2.6, HALF + 5.5);
  wires();
  [MARKET[0] + 30, MARKET[0] + 92].forEach((i) => bunting(i, 8.4, HALF * 2 + 12));
  capulloArch(MARKET[0] + 60);
  pickup(MARKET[0] + 20, HALF + 3.2, false);
  pickup(MARKET[0] + 75, -(HALF + 3.2), true);
  pickup(MARKET[0] + 108, HALF + 3.2, false);
  [12, 46, 84, 116].forEach((d, k) => stall(MARKET[0] + d, k % 2 ? 1 : -1));
}

// ---------- The prison: the track runs inside the cell block ----------
// The video's hall: two floors of cells behind iron walkways, yellow tiles along the bottom of the walls, arched
// barred doors, warm wall lamps, plants, a glazed roof on iron trusses, and at each end a wall with the big arched
// window over the gate the karts drive through. Inmates in red tracksuits everywhere.
const HALL_W = HALF + 7, HALL_H = 16;   // half width between the walls, height of the walls
// One bay of wall, 8.7 m wide and 16 m tall (6 px per metre): cell floor above, arched doors and tiles below.
const cellTex = canvasTex(48, 96, (g) => {
  const F = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  F('#cfc4ae', 0, 0, 48, 96);
  for (let k = 0; k < 60; k++) F(k % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)', (k * 17) % 48, (k * 29) % 96, 2 + (k % 4), 1);   // worn plaster
  F('#8a7f70', 0, 0, 48, 3);
  // Upper floor: a cell door with bars, its number plate, a lamp.
  F('#22262e', 17, 18, 13, 26); for (let x = 18; x < 30; x += 3) F('#4a505c', x, 19, 1, 25); F('#4a505c', 17, 30, 13, 1);
  F('#f3eee8', 33, 24, 5, 3); F('#ffd98a', 9, 16, 2, 3); F('#fff1c0', 9, 17, 2, 1); F('#2a2428', 9, 14, 2, 2);
  F('#2a2428', 0, 44, 48, 4);                                         // the walkway slab's edge
  // Ground floor: an arched barred door, a lamp, the yellow tiles with their teal trim.
  F('#d6a032', 0, 78, 48, 18); for (let y = 78; y < 96; y += 3) F('#b8842a', 0, y, 48, 1); for (let x = 0; x < 48; x += 3) F('#b8842a', x, 78, 1, 18);
  F('#3a7a78', 0, 77, 48, 1); F('#3a7a78', 0, 94, 48, 2);
  F('#8a7f70', 14, 56, 20, 40); F('#22262e', 16, 60, 16, 36); F('#22262e', 17, 58, 14, 2); F('#22262e', 19, 57, 10, 1);
  for (let x = 18; x < 31; x += 3) F('#4a505c', x, 59, 1, 37); F('#4a505c', 16, 72, 16, 1);
  F('#2a2428', 39, 56, 2, 2); F('#ffd98a', 39, 58, 2, 3); F('#fff1c0', 39, 59, 2, 1);
  F('#f3eee8', 5, 64, 6, 4); F('#B8141A', 6, 65, 4, 1);                // a notice on the wall
}, true);
const cellM = toon(0xffffff, { map: cellTex });
// Walkway railing: iron, with the ring pattern of the video.
const railTex = canvasTex(32, 8, (g) => {
  g.fillStyle = '#231c20';
  g.fillRect(0, 0, 32, 1); g.fillRect(0, 7, 32, 1); g.fillRect(0, 3, 32, 1);
  for (let x = 0; x < 32; x += 4) g.fillRect(x, 0, 1, 8);
  [[14, 1], [13, 2], [17, 2], [13, 5], [17, 5], [14, 6], [15, 6], [16, 6], [15, 1], [16, 1], [12, 3], [12, 4], [18, 3], [18, 4]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
}, true);
const railM = new THREE.MeshBasicMaterial({ map: railTex, alphaTest: 0.5, side: THREE.DoubleSide });
/** A stretch of railing len metres long, 1.3 m high. */
function railing(len) {
  const g = new THREE.PlaneGeometry(len, 1.3), uv = g.attributes.uv;
  for (let n = 0; n < 4; n++) uv.setX(n, uv.getX(n) * Math.max(1, Math.round(len / 5)));
  return new THREE.Mesh(g, railM);
}
// The arched window of the end walls, glowing with the evening light.
const windowTex = canvasTex(32, 32, (g) => {
  for (let y = 0; y < 32; y++) {
    const hw = y < 14 ? Math.round(Math.sqrt(Math.max(0, 196 - (14 - y) * (14 - y)))) : 14;
    g.fillStyle = '#2a2428'; g.fillRect(16 - hw - 2, y, hw * 2 + 4, 1);
    g.fillStyle = y < 12 ? '#ffe9c4' : '#f6d6a8'; g.fillRect(16 - hw, y, hw * 2, 1);
  }
  g.fillStyle = '#2a2428';
  for (let x = 4; x < 32; x += 5) g.fillRect(x, 0, 1, 32);
  for (let y = 8; y < 32; y += 6) g.fillRect(0, y, 32, 1);
  g.clearRect(0, 0, 1, 32); g.clearRect(31, 0, 1, 32);
});
// The painted wall of the video: a coast of cliffs and sea.
const muralTex = canvasTex(48, 24, (g) => {
  const F = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  F('#e8a05a', 0, 0, 48, 9); F('#f2c27a', 0, 6, 48, 4); F('#3f7f8f', 0, 10, 48, 14); F('#5a9aa6', 0, 10, 48, 2);
  [[0, 8, 16, 16, '#8a6248'], [10, 11, 14, 13, '#7a563e'], [30, 9, 18, 15, '#96704f'], [36, 13, 12, 11, '#6f4f3a']].forEach(([x, y, w, h, c]) => { F(c, x, y, w, h); F('#5f8a4a', x, y, w, 1); });
  for (let k = 0; k < 10; k++) F('#f3eee8', (k * 11) % 44 + 2, 20 + (k % 3), 3, 1);
});

// The hall's lamps and their pools of light have their own materials: they turn red during the lockdown.
const hallLampM = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
const hallPoolM = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
// The shutter of the far gate: iron bars that roll down from inside the wall during the lockdown (lockdown.js).
export const GATE = PRISON[1], GATE_R = HALF + 2.4;
export const HALL = PRISON;
const gateTex = canvasTex(16, 16, (g) => {
  g.fillStyle = '#1b1418'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 8, 16, 1);
  for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 2, 16);
  g.fillStyle = '#4a505c'; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  g.fillStyle = '#C8110E'; g.fillRect(0, 14, 16, 2);
}, true);
gateTex.repeat.set(1 / 3, 1 / 3);   // ShapeGeometry UVs are in metres: one tile every 3 m
let gate = null;
/** closed 0 (rolled up, hidden in the wall) .. 1 (down to the road); alarm 0..1 for the red lights. */
export function setLockdown(closed, alarmK, now) {
  if (!gate) return;
  gate.visible = closed > 0.001;
  gate.position.y = (1 - closed) * GATE_R;
  setAlarm(alarmK);
  const p = alarmK * (0.5 + 0.5 * Math.sin(now / 110));
  hallLampM.color.set(0xffe2a0).lerp(redC, alarmK * 0.4 + p * 0.6);
  hallPoolM.color.set(0xff9a3c).lerp(redC, alarmK);
  hallPoolM.opacity = 0.2 + p * 0.35;
}
const redC = new THREE.Color(0xff1a10);

function prison() {
  const step = 7, plaster = tm(0xcfc4ae), iron = tm(0x2a2024), roofM = tm(0x5a3a32);
  const glass = new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const tube = hallLampM;
  const poolM = hallPoolM;
  const poolG = new THREE.CircleGeometry(5, 12).rotateX(-Math.PI / 2);
  for (let i = PRISON[0], k = 0; i < PRISON[1]; i += step, k++) {
    const a = off(i, 0), b = off(Math.min(i + step, PRISON[1]) % N, 0), len = Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.5;
    const mid = (i + Math.round(step / 2)) % N, o = off(mid, 0), g = new THREE.Group();
    [-1, 1].forEach((sd) => {
      // The wall: two bays of cells per segment.
      const wg = new THREE.BoxGeometry(1, HALL_H, len), uv = wg.attributes.uv;
      for (let n = 0; n < 8; n++) uv.setX(n, uv.getX(n) * 2);
      const wall = new THREE.Mesh(wg, cellM); wall.position.set(sd * (HALL_W + 0.5), HALL_H / 2, 0); wall.castShadow = true; g.add(wall);
      // The walkway of the upper floor, its railing and a strip light under it.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, len), iron); slab.position.set(sd * (HALL_W - 1.3), 8.3, 0); g.add(slab);
      const rail = railing(len); rail.rotation.y = Math.PI / 2; rail.position.set(sd * (HALL_W - 2.55), 9.1, 0); g.add(rail);
      const lt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 3.2), tube); lt.position.set(sd * (HALL_W - 1.3), 8.05, 0); g.add(lt);
      [-len / 2 + 0.4, len / 2 - 0.4].forEach((z) => { const br = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.2), iron); br.position.set(sd * (HALL_W - 1.3), 7.75, z); g.add(br); });
      // The roof: a pitched slab from the wall up to the glazed ridge.
      const rs = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.3, len), roofM);
      rs.position.set(sd * 9.6, HALL_H + 2.25, 0); rs.rotation.z = -sd * 0.395; rs.castShadow = true; g.add(rs);
    });
    const sky = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.12, len), glass); sky.position.y = HALL_H + 4.6; g.add(sky);
    if (k % 3 === 1) {   // an iron truss with two hanging lamps and their pools of light
      const beam = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2, 0.5, 0.5), iron); beam.position.y = HALL_H; g.add(beam);
      for (let x = -HALL_W + 2; x < HALL_W; x += 3.5) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.4, 0.2), iron); d.position.set(x, HALL_H + 1.6, 0); d.rotation.z = (Math.round(x / 3.5) % 2 ? 1 : -1) * 0.75; g.add(d); }
      [-4, 4].forEach((x) => {
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), iron); cord.position.set(x, HALL_H - 2, 0); g.add(cord);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), hallLampM); lamp.position.set(x, HALL_H - 4.2, 0); g.add(lamp);
        const pool = new THREE.Mesh(poolG, poolM); pool.position.set(x, 0.12, 0); g.add(pool);
      });
    }
    if (k === 4 || k === 15) {   // the painted wall
      const sd = k === 4 ? 1 : -1, mu = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: muralTex }));
      mu.position.set(sd * (HALL_W - 0.06), 4.2, 0); mu.rotation.y = -sd * Math.PI / 2; g.add(mu);
    }
    if (k === 8 || k === 19) {   // iron stairs up to the walkway
      const sd = k === 8 ? -1 : 1;
      for (let n = 0; n < 10; n++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.9), iron); st.position.set(sd * (HALL_W - 3.6), 0.8 + n * 0.8, -4 + n * 0.9); g.add(st); }
    }
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = yawAt(mid);
    add(g);
  }
  // End walls: the gate under an arch, the big arched window in the gable, a walkway across just inside.
  [[PRISON[0], 1], [PRISON[1], -1]].forEach(([i, inward]) => {
    const g = new THREE.Group(), W = HALL_W + 1, R = HALF + 2.4;
    const sh = new THREE.Shape();
    sh.moveTo(-W, 0); sh.lineTo(-R, 0); sh.absarc(0, 0, R, Math.PI, 0, true); sh.lineTo(W, 0); sh.lineTo(W, HALL_H); sh.lineTo(0, HALL_H + 6.4); sh.lineTo(-W, HALL_H); sh.lineTo(-W, 0);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }), plaster);
    wall.position.z = -0.6; wall.castShadow = true; g.add(wall);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 4, 16, Math.PI), tm(0xd6a032)); g.add(trim);
    [-0.75, 0.75].forEach((z) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 7.5), new THREE.MeshBasicMaterial({ map: windowTex, alphaTest: 0.5 }));
      win.position.set(0, HALL_H + 0.3, z); if (z < 0) win.rotation.y = Math.PI; g.add(win);
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(HALL_W * 2, 0.3, 2.6), iron); deck.position.set(0, 11.4, inward * 3); g.add(deck);
    [-1.3, 1.3].forEach((dz) => { const r = railing(HALL_W * 2); r.position.set(0, 12.2, inward * 3 + dz); g.add(r); });
    const o = off(i % N, 0);
    g.position.set(o[0], 0, o[1]);
    g.rotation.y = yawAt(i % N);
    add(g);
    if (i === GATE) {   // not baked: it moves
      const gs = new THREE.Shape();
      gs.moveTo(-GATE_R, 0); gs.absarc(0, 0, GATE_R, Math.PI, 0, true); gs.lineTo(-GATE_R, 0);
      gate = new THREE.Mesh(new THREE.ShapeGeometry(gs, 10), new THREE.MeshBasicMaterial({ map: gateTex, alphaTest: 0.5, side: THREE.DoubleSide }));
      gate.position.set(o[0], GATE_R, o[1]);
      gate.rotation.y = yawAt(i % N);
      gate.visible = false;
      scene.add(gate);
    }
  });
  // The concrete floor of the hall, and what stands on it.
  sidewalk(PRISON, HALL_W, ['#8f8a84', '#878279']);
  furniture(PRISON, 70, HALF + 2.8, HALL_W - 1, ['tree', 'pot', 'bench', 'bucket', 'redcrates', 'chairs', 'planter', 'tree', 'pot', 'bucket']);
  crowd(PRISON, 80, [0, 0, 1, 5, 5], HALF + 2.6, HALL_W - 3.2);
  for (let n = 0; n < 46; n++) {   // inmates on the walkways
    const i = PRISON[0] + 2 + Math.floor(rand() * (PRISON[1] - PRISON[0] - 4));
    person(i, pick([-1, 1]) * (HALL_W - 1.5), pick([0, 1, 5]), 8.45);
  }
}

// ---------- The night street: strings of lights and the footbridge ----------
const bulbTex = canvasTex(32, 4, (g) => {
  g.fillStyle = '#1b1418'; g.fillRect(0, 0, 32, 1);
  for (let k = 0; k < 8; k++) { g.fillStyle = ['#ffd27a', '#ff6a4a', '#fff0c0', '#ffb03c'][k % 4]; g.fillRect(k * 4 + 1, 1, 2, 2); }
}, true);
function stringLights(i, y, span) {
  const t = bulbTex.clone(); t.needsUpdate = true; t.repeat.set(span / 6, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.8), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
  const o = off(i, 0);
  m.position.set(o[0], y, o[1]); m.rotation.y = yawAt(i);
  add(m);
}
/** The steel footbridge over the road, with stairs at both ends, lights along it and people crossing. */
function footbridge(i) {
  const g = new THREE.Group(), steel = tm(0x3a4656), span = HALF * 2 + 16, Y = 7.4;
  const at = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  at(new THREE.BoxGeometry(span, 0.4, 3.2), steel, 0, Y, 0);
  at(new THREE.BoxGeometry(span, 0.5, 0.3), tm(0xC8110E), 0, Y - 0.5, 1.6); at(new THREE.BoxGeometry(span, 0.5, 0.3), tm(0xC8110E), 0, Y - 0.5, -1.6);
  [-1.6, 1.6].forEach((z) => { const r = railing(span); r.position.set(0, Y + 0.85, z); g.add(r); });
  for (let x = -span / 2 + 1; x < span / 2; x += 2.2) at(new THREE.BoxGeometry(0.35, 0.35, 0.35), bm(Math.round(x) % 2 ? 0xffd27a : 0xff6a4a), x, Y + 1.7, 1.6);
  [-1, 1].forEach((sd) => {
    const x = sd * (span / 2 - 0.4);
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([dx, dz]) => at(new THREE.BoxGeometry(0.35, Y, 0.35), steel, x + dx, Y / 2, dz));
    for (let n = 0; n < 9; n++) at(new THREE.BoxGeometry(2.4, 0.2, 0.9), steel, x, 0.7 + n * 0.8, 2.2 + (8 - n) * 0.9);   // stairs down along the road
  });
  const o = off(i, 0);
  g.position.set(o[0], 0, o[1]);
  g.rotation.y = yawAt(i);
  add(g);
  for (let n = 0; n < 9; n++) {   // people on the bridge, looking down at the race
    const pg = new THREE.PlaneGeometry(0.95, 1.9), uv = pg.attributes.uv, k = pick([2, 3, 4, 0]);
    for (let q = 0; q < 4; q++) uv.setX(q, (k + uv.getX(q)) / PEOPLE.length);
    const m = new THREE.Mesh(pg, peopleM), p = off(i, -span / 2 + 3 + n * ((span - 6) / 8));
    m.position.set(p[0], Y + 1.15, p[1]); m.rotation.y = yawAt(i) + Math.PI; add(m);
  }
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
    building(i, side, { w, d: 8 + rand() * 5, h: (1 + ((rand() * 3) | 0)) * 3.6 + 0.8, ids: WEST_IDS, gap: 6.5 + rand() * 2, casa: 0.65 });
    if (rand() < 0.6) building(i, -side, { w: 8 + rand() * 6, d: 8 + rand() * 5, h: (1 + ((rand() * 3) | 0)) * 3.6 + 0.8, ids: WEST_IDS, gap: 6.5 + rand() * 2, casa: 0.65 });
  }
  sidewalk(WEST);
  furniture(WEST, 40, HALF + 2.6, HALF + 5.5, ['bin', 'pot', 'planter', 'bench', 'lamp', 'kiosk', 'tree', 'chairs', 'tree', 'sacks']);
  parked(WEST, 9);
  // The night street of the video: strings of lights across the road, and the footbridge over it.
  for (let i = WEST[0] + 10; i < WEST[1]; i += 18) if (!corner[i]) stringLights(i, 8.6, HALF * 2 + 14);
  let bi = 566; while (corner[bi] && bi < WEST[1]) bi++;
  footbridge(bi);
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
        const w = 9 + rand() * 8, dd = 8 + rand() * 4, h = (1 + ((rand() * 3) | 0)) * 3.6 + 0.8;
        const qx = (k % 2 ? 1 : -1) * (CELL / 2 - dd / 2 - 2.5), qz = (k >> 1 ? 1 : -1) * (CELL / 4) + (rand() - 0.5) * 3;
        if (minTrackDist(x + qx, z + qz) < HALF + 18) continue;
        const grp = new THREE.Group();
        let m, hh = h;
        if (rand() < 0.55) { const [geo, ch] = casaBox(dd, h > 6 ? 2 : 1, Math.min(w, 12), (rand() * CASA_N) | 0); m = new THREE.Mesh(geo, casaM); hh = ch; }
        else m = new THREE.Mesh(facadeBox(dd, h, w, pick(TOWN_IDS)), facadeM);
        m.position.y = hh / 2; m.castShadow = true; grp.add(m);
        roofTop(grp, dd, hh, w);
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
      b.position.set(x, -CLIFF + 0.3, z - 20); b.rotation.y = r; b.scale.setScalar(2.2);
      b.userData.phase = Math.random() * 6;
      scene.add(b); floating.push(b);
    })).catch(() => {});
  });
  model('SM_TI_Wood_0_Pier_0').then((parts) => parts.forEach(({ geometry, material }) => {
    const p = new THREE.Mesh(geometry, material);
    p.position.set(80, -CLIFF + 0.9, SEA_Z - BEACH - 18); p.rotation.y = Math.PI; p.scale.setScalar(1.2);
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
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), dim(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }), 0.22));
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
  // Billboards: each of the seven ads beside a straight, facing the karts, and two over the road in the prison yard.
  [['pearl', 72, 1], ['route', 188, -1], ['haven', 548, 1], ['dormant', 602, -1], ['noomax', 692, 1]]
    .forEach(([name, i, side]) => roadsideAd(i, side, name));
  overheadAd(30, 'midnight');
  overheadAd(228, 'centuries');
  overheadAd(98, 'noomax');
  overheadAd(524, 'haven');
  overheadAd(262, 'route');
  bake();
  props();
}

export function updateParadise(dt, now) {
  // Night on the last lap: the unlit surfaces (sea, beach, clouds, people) dim with the light.
  const nk = nightAmount();
  dims.forEach(([m, c, k]) => m.color.copy(c).multiplyScalar(1 - nk * (1 - k)));
  if (sea) sea.material.map.offset.x = (now / 60000) % 1;
  if (shore) shore.material.map.offset.x = (now / 90000) % 1;   // the ripples drift along the coast
  floating.forEach((b) => { b.position.y = -CLIFF + 0.3 + Math.sin(now / 700 + b.userData.phase) * 0.15; b.rotation.z = Math.sin(now / 900 + b.userData.phase) * 0.05; });
  if (glitter) {
    // On the line from the camera toward the sun (moonDir in theme.js: x 0.1, z -0.97).
    glitter.position.x = camera.position.x - (0.1 / 0.97) * (glitter.position.z - camera.position.z);
    glitter.material.opacity = (0.65 + Math.sin(now / 500) * 0.15) * (1 - nk);
  }
}
