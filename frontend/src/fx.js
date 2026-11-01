// Pixel-art burst effects (sprite sheets, billboarded): item boxes, boost pads, pops, bats, parallel world.
// Sheets: "Retro Pixel Effects 32x32" by BDragon1727 (flare, sparkle, ring, swirl) and "Explosion pack 1" by Ansimuz, CC0 (boom).
import * as THREE from 'three';
import { scene } from './engine.js';

const url = (n) => new URL(`./assets/fx/${n}.png`, import.meta.url).href;

// cols × rows of frames, frame count, playback speed.
const DEFS = {
  sparkle: { src: 'sparkle', cols: 6, rows: 2, frames: 11, fps: 22 },
  flare:   { src: 'flare',   cols: 6, rows: 2, frames: 11, fps: 24 },
  ring:    { src: 'ring',    cols: 6, rows: 2, frames: 11, fps: 20 },
  swirl:   { src: 'swirl',   cols: 6, rows: 2, frames: 12, fps: 18 },
  boom:    { src: 'boom',    cols: 16, rows: 1, frames: 16, fps: 26 },
};
const POOL = 6;

const loader = new THREE.TextureLoader();
const pools = {};
Object.entries(DEFS).forEach(([kind, d]) => {
  pools[kind] = { d, i: 0, list: [] };
  for (let k = 0; k < POOL; k++) {
    const map = loader.load(url(d.src));      // own texture per sprite (own frame offset); the browser caches the file
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.repeat.set(1 / d.cols, 1 / d.rows);
    const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.visible = false;
    s.renderOrder = 20;
    scene.add(s);
    pools[kind].list.push({ s, t: 0, on: false });
  }
});

function setFrame(p, d, f) {
  const col = f % d.cols, row = (f / d.cols) | 0;
  p.s.material.map.offset.set(col / d.cols, 1 - (row + 1) / d.rows);
}

/** Plays a one-shot burst at a world position. size = width in world units. */
export function burst(kind, x, y, z, size = 4) {
  const pool = pools[kind];
  if (!pool) return;
  const p = pool.list[pool.i];
  pool.i = (pool.i + 1) % pool.list.length;
  p.s.position.set(x, y, z);
  p.s.scale.set(size, size, 1);
  p.t = 0; p.on = true; p.s.visible = true;
  setFrame(p, pool.d, 0);
}

export function updateFx(dt) {
  for (const k in pools) {
    const { d, list } = pools[k];
    list.forEach((p) => {
      if (!p.on) return;
      p.t += dt;
      const f = (p.t * d.fps) | 0;
      if (f >= d.frames) { p.on = false; p.s.visible = false; return; }
      setFrame(p, d, f);
    });
  }
}
