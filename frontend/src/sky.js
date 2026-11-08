// Night sky: moonlight, blue moon, halo, stars and a shooting star.
import * as THREE from 'three';
import { scene, camera, canvasTex } from './engine.js';
import moonUrl from './assets/moon.png';
import { THEME, SPACE } from './theme.js';

scene.background = canvasTex(4, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, THEME.sky[0]);
  gr.addColorStop(0.45, THEME.sky[1]);
  gr.addColorStop(0.78, THEME.sky[2]);
  gr.addColorStop(1, THEME.sky[3]);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
});

scene.add(new THREE.HemisphereLight(...THEME.hemi));

// Moonlight: follows the player to keep shadows crisp.
export const moonLight = new THREE.DirectionalLight(THEME.moonLight, 0.85);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
const sc = moonLight.shadow.camera;
sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 320;
scene.add(moonLight);
scene.add(moonLight.target);

// The sky group follows the camera, so the moon and stars appear infinitely far away.
const sky = new THREE.Group();
scene.add(sky);

const MOON_DIR = new THREE.Vector3(...THEME.moonDir).normalize();
const moonTex = new THREE.TextureLoader().load(moonUrl);
moonTex.magFilter = THREE.NearestFilter;
moonTex.minFilter = THREE.NearestFilter;
moonTex.generateMipmaps = false;

const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
moon.scale.set(THEME.moonScale, THEME.moonScale, 1);
moon.renderOrder = -1;
moon.position.copy(MOON_DIR).multiplyScalar(760);

const glowTex = canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, 'rgba(170,205,255,.75)');
  r.addColorStop(0.45, 'rgba(110,160,255,.25)');
  r.addColorStop(1, 'rgba(80,120,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
});
glowTex.magFilter = glowTex.minFilter = THREE.LinearFilter;
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
moonGlow.scale.set(THEME.moonScale * 2.8, THEME.moonScale * 2.8, 1);
moonGlow.renderOrder = -2;
moonGlow.position.copy(MOON_DIR).multiplyScalar(770);
sky.add(moonGlow);
sky.add(moon);

// Interstellar: soft nebula clouds in the MAMA 2026 poster colours (deep blue, violet, pink, white swirl).
function nebula() {
  const tex = canvasTex(64, 64, (g) => {
    for (let k = 0; k < 7; k++) {
      const x = 16 + Math.random() * 32, y = 16 + Math.random() * 32, r = 10 + Math.random() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
  });
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  const cols = [0x3d5bff, 0x9b4dff, 0xff5fc8, 0x4fc3ff, 0x6a3dff, 0xffffff];
  for (let k = 0; k < 9; k++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: cols[k % cols.length], fog: false, depthWrite: false, transparent: true, opacity: k === 5 ? 0.25 : 0.5, blending: THREE.AdditiveBlending }));
    const a = (k / 9) * Math.PI * 2 + Math.random() * 0.4, y = 0.18 + Math.random() * 0.45;
    m.position.set(Math.cos(a) * 700, y * 700, Math.sin(a) * 700);
    const sz = 380 + Math.random() * 320;
    m.scale.set(sz * 1.6, sz, 1);
    m.renderOrder = -3;
    sky.add(m);
  }
}

function starField(n, size, colors, minY) {
  const pos = [], col = [];
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const u = Math.random() * Math.PI * 2, y = minY + Math.random() * (1 - minY), r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(u) * r * 800, y * 800, Math.sin(u) * r * 800);
    c.set(colors[k % colors.length]);
    col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }));
  sky.add(p);
  return p;
}
starField(SPACE ? 2400 : 1300, 1, SPACE ? ['#b9a8ff', '#ffffff', '#ff9be6', '#8fd8ff'] : ['#8fa3d6', '#c9d6ff', '#6f86c4'], 0.02);
if (SPACE) nebula();
const brightStars = starField(140, 2, ['#ffffff', '#bfe0ff', '#9fd0ff'], 0.08);

const shoot = new THREE.Mesh(
  new THREE.BoxGeometry(26, 0.9, 0.9),
  new THREE.MeshBasicMaterial({ color: 0xdcecff, fog: false, transparent: true, opacity: 0, depthWrite: false }),
);
sky.add(shoot);
let shootT = 3;
let shot = null;

export function updateSky(dt, now, focus) {
  moonLight.position.set(focus.x - 40, 70, focus.z + 75);
  moonLight.target.position.copy(focus);
  sky.position.copy(camera.position);
  brightStars.material.opacity = 0.75 + Math.sin(now / 400) * 0.25;

  shootT -= dt;
  if (shootT < 0) {
    shootT = 5 + Math.random() * 6;
    const a = Math.random() * Math.PI * 2;
    shot = { t: 0, x: Math.cos(a) * 600, z: Math.sin(a) * 600, dx: -Math.sin(a), dz: Math.cos(a) };
    shoot.rotation.set(0, -a + Math.PI / 2, -0.25);
  }
  if (shot && shot.t < 1) {
    shot.t += dt * 1.4;
    shoot.position.set(shot.x + shot.dx * shot.t * 260, 420 - shot.t * 90, shot.z + shot.dz * shot.t * 260);
    shoot.material.opacity = Math.sin(Math.min(1, shot.t) * Math.PI);
  } else {
    shoot.material.opacity = 0;
  }
}
