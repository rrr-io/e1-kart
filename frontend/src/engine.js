// Renderer, scene, camera and shared helpers (pixel textures, toon materials).
import * as THREE from 'three';
import { settings } from './config.js';

export const $ = (id) => document.getElementById(id);

export const game = $('game');
export const canvas = $('c');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x101c3e, 130, 560);

export const camera = new THREE.PerspectiveCamera(68, 1, 0.5, 1000);

// Texture drawn on a canvas with nearest filtering (pixel look). draw(g, w, h) can be called again to redraw.
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData = { draw, g, w, h };
  return t;
}

export function redrawTex(t) {
  const u = t.userData;
  u.g.clearRect(0, 0, u.w, u.h);
  u.draw(u.g, u.w, u.h);
  t.needsUpdate = true;
}

// 3-tone ramp for toon shading.
const ramp = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.LuminanceFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const toon = (c, extra) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: ramp }, extra || {}));
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide });

// The canvas is rendered at (screen / pixelScale) and scaled up via CSS: this is what creates the pixel effect.
export function resize() {
  const w = game.clientWidth, h = game.clientHeight, s = settings.pixelScale;
  renderer.setSize(Math.max(1, Math.round(w / s)), Math.max(1, Math.round(h / s)), false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

export const wrapAngle = (d) => {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};
