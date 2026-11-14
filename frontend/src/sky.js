// Night sky: moonlight, blue moon, halo, stars and a shooting star.
// Bloody Paradise (THEME.sun): a low golden sun with a warm halo instead, and no stars.
// Night Circuit (THEME.redMoon): on the last lap the moon turns red and bats fly across it.
import * as THREE from 'three';
import { scene, camera, canvasTex, redrawTex } from './engine.js';
import moonUrl from './assets/moon.png';
import { THEME, SPACE } from './theme.js';
import { LAPS } from './config.js';
import { G, player } from './state.js';

// Bloody Paradise: night falls on the last lap (THEME.night). night goes from 0 (sunset) to 1 (night) in a few
// seconds; the sky, the fog and the lights blend between the two looks, the sun sinks and the moon and stars come out.
const NIGHT = THEME.night;
let night = 0, alarm = 0;
export const nightAmount = () => night;
/** Red emergency light on everything, 0..1 (the prison lockdown). */
export function setAlarm(a) { alarm = a; }
const mixC = new THREE.Color(), toC = new THREE.Color();
const blend = (a, b, k) => mixC.set(a).lerp(toC.set(b), k);

const skyTex = canvasTex(4, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  [0, 0.45, 0.78, 1].forEach((stop, n) => gr.addColorStop(stop, NIGHT ? '#' + blend(THEME.sky[n], NIGHT.sky[n], night).getHexString() : THEME.sky[n]));
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
});
scene.background = skyTex;

const hemi = new THREE.HemisphereLight(...THEME.hemi);
scene.add(hemi);

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
// The sun: stepped pixel disc, white-hot core to deep orange rim.
const SOFT = THEME.sun === 'soft';
// The winter sun: an almost white disc whose edge melts into the haze (no rings).
const softSunTex = () => canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,253,244,1)'); r.addColorStop(0.62, 'rgba(255,247,226,1)'); r.addColorStop(0.8, 'rgba(255,236,200,.85)'); r.addColorStop(1, 'rgba(255,224,176,0)');
  g.clearRect(0, 0, 64, 64); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const sunTex = () => canvasTex(32, 32, (g) => {
  [[16, '#ff8a2a'], [14, '#ffb03c'], [11, '#ffd46a'], [7, '#fff1c2']].forEach(([r, c]) => {
    g.fillStyle = c;
    for (let y = -r; y < r; y++) {
      const w = Math.round(Math.sqrt(r * r - (y + 0.5) * (y + 0.5)));
      g.fillRect(16 - w, 16 + y, w * 2, 1);
    }
  });
});
const moonTex = SOFT ? softSunTex() : THEME.sun ? sunTex() : new THREE.TextureLoader().load(moonUrl);
moonTex.magFilter = SOFT ? THREE.LinearFilter : THREE.NearestFilter;
moonTex.minFilter = SOFT ? THREE.LinearFilter : THREE.NearestFilter;
moonTex.generateMipmaps = false;

const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
moon.scale.set(THEME.moonScale, THEME.moonScale, 1);
moon.renderOrder = -1;
moon.position.copy(MOON_DIR).multiplyScalar(760);

const glowTex = canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  const [a, b, c] = SOFT ? ['255,240,214', '255,214,170', '255,190,150'] : THEME.sun ? ['255,214,140', '255,140,60', '255,90,40'] : ['170,205,255', '110,160,255', '80,120,255'];
  r.addColorStop(0, `rgba(${a},.8)`);
  r.addColorStop(0.45, `rgba(${b},.3)`);
  r.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
});
glowTex.magFilter = glowTex.minFilter = THREE.LinearFilter;
export const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
moonGlow.scale.set(THEME.moonScale * (SOFT ? 6 : 2.8), THEME.moonScale * (SOFT ? 4.2 : 2.8), 1);   // the soft sun spreads wide along the horizon
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
const stars = THEME.sun && !NIGHT ? null : starField(SPACE ? 2400 : 1300, 1, SPACE ? ['#b9a8ff', '#ffffff', '#ff9be6', '#8fd8ff'] : ['#8fa3d6', '#c9d6ff', '#6f86c4'], NIGHT ? 0.16 : 0.02);
if (SPACE) nebula();
const brightStars = starField(THEME.sun && !NIGHT ? 0 : 140, 2, ['#ffffff', '#bfe0ff', '#9fd0ff'], NIGHT ? 0.2 : 0.08);

// The moon that rises on the last lap of Bloody Paradise, opposite the sun.
let nightMoon = null;
if (NIGHT) {
  const t = new THREE.TextureLoader().load(moonUrl);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  nightMoon = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  nightMoon.scale.set(110, 110, 1);
  nightMoon.renderOrder = -1;
  sky.add(nightMoon);
}
const NIGHT_T = 5;   // seconds from sunset to night
// I Want You (NIGHT.manual): want.js switches between the two worlds itself.
let shift = 0;
export function setShift(v) { shift = v; }
let drawn = -1;
function applyNight() {
  const k = night;
  if (Math.abs(k - drawn) > 0.004 || k === 0 || k === 1) {
    if (k !== drawn) redrawTex(skyTex);
    drawn = k;
  }
  scene.fog.color.copy(blend(THEME.fog[0], NIGHT.fog, k));
  hemi.color.copy(blend(THEME.hemi[0], NIGHT.hemi[0], k));
  hemi.groundColor.copy(blend(THEME.hemi[1], NIGHT.hemi[1], k));
  hemi.intensity = THEME.hemi[2] + (NIGHT.hemi[2] - THEME.hemi[2]) * k;
  moonLight.color.copy(blend(THEME.moonLight, NIGHT.moonLight, k));
  moonLight.intensity = 0.85 - 0.3 * k;
  // The sun sinks behind the clouds and goes out; the moon climbs.
  moon.position.copy(MOON_DIR).multiplyScalar(760).setY(MOON_DIR.y * 760 - k * 230);
  moonGlow.position.copy(MOON_DIR).multiplyScalar(770).setY(MOON_DIR.y * 770 - k * 230);
  moon.material.opacity = 1 - k;
  moonGlow.material.opacity = 1 - k;
  nightMoon.position.set(-0.5 * 760, (0.12 + 0.3 * k) * 760, 0.75 * 760);
  nightMoon.material.opacity = k;
  stars.material.opacity = NIGHT.noStars ? 0 : k;
}

// Night Circuit, last lap: the moon turns red in a few seconds and, every so often, a few bats fly across it.
const RED = THEME.redMoon;
let red = 0;
const bats = [];
let batT = 2;
if (RED) {
  const batTex = (up) => canvasTex(9, 5, (g) => {
    g.fillStyle = '#0a0610';
    g.fillRect(3, 2, 3, 2); g.fillRect(4, 1, 1, 1);           // body and head
    if (up) { g.fillRect(0, 0, 3, 1); g.fillRect(1, 1, 2, 1); g.fillRect(6, 0, 3, 1); g.fillRect(6, 1, 2, 1); }
    else { g.fillRect(0, 3, 3, 1); g.fillRect(1, 2, 2, 1); g.fillRect(6, 3, 3, 1); g.fillRect(6, 2, 2, 1); }
  });
  const wings = [batTex(true), batTex(false)];
  wings.forEach((t) => { t.magFilter = t.minFilter = THREE.NearestFilter; });
  for (let k = 0; k < 5; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wings[0], fog: false, depthWrite: false, transparent: true }));
    s.scale.set(34, 19, 1);
    s.visible = false;
    s.renderOrder = 0;
    s.userData = { wings, t: 1, dx: 0, dy: 0, ph: Math.random() * 6 };
    sky.add(s);
    bats.push(s);
  }
}
const moonBase = new THREE.Color(1, 1, 1);
function applyRed(dt, now) {
  const want = (G.state === 'race' || G.state === 'done') && player.laps >= LAPS - 1 ? 1 : 0;
  red = want ? Math.min(1, red + dt / 4) : 0;
  moon.material.color.copy(moonBase).lerp(toC.set(RED.moon), red);
  moonGlow.material.color.copy(moonBase).lerp(toC.set(RED.glow), red);
  moonLight.color.set(THEME.moonLight).lerp(toC.set(RED.moonLight), red * 0.7);
  scene.fog.color.set(THEME.fog[0]).lerp(toC.set(RED.fog), red * 0.6);
  // Bats: a small flock crosses the moon from one side to the other, flapping.
  batT -= dt;
  if (red === 1 && batT < 0) {
    batT = 9 + Math.random() * 6;
    const side = Math.random() < 0.5 ? -1 : 1;
    const right = new THREE.Vector3().crossVectors(MOON_DIR, new THREE.Vector3(0, 1, 0)).normalize();
    bats.forEach((b, k) => {
      const u = b.userData;
      u.t = -k * 0.08;
      u.from = MOON_DIR.clone().multiplyScalar(740).addScaledVector(right, side * 230).add(new THREE.Vector3(0, (k % 3) * 18 - 10, 0));
      u.dir = right.clone().multiplyScalar(-side * 460).add(new THREE.Vector3(0, 40 + k * 6, 0));
    });
  }
  bats.forEach((b) => {
    const u = b.userData;
    if (!u.from || u.t >= 1) { b.visible = false; if (u.from) u.t = Math.min(u.t, 1); return; }
    u.t += dt / 4.5;
    if (u.t < 0) { b.visible = false; return; }
    b.visible = true;
    b.position.copy(u.from).addScaledVector(u.dir, u.t).setY(u.from.y + u.dir.y * u.t + Math.sin(u.t * 14 + u.ph) * 6);
    b.material.map = u.wings[Math.floor(now / 110 + u.ph) % 2];
  });
}

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
  brightStars.material.opacity = (0.75 + Math.sin(now / 400) * 0.25) * (NIGHT ? (NIGHT.noStars ? 0 : night) : 1);
  if (NIGHT) {
    const want = (G.state === 'race' || G.state === 'done') && player.laps >= LAPS - 1 ? 1 : 0;
    if (NIGHT.manual) night = shift > night ? Math.min(shift, night + dt / NIGHT.time) : Math.max(shift, night - dt / NIGHT.time);
    else night = want ? Math.min(1, night + dt / NIGHT_T) : 0;   // back to sunset at once when a new race is set up
    applyNight();
    // Lockdown: everything pulses red.
    if (alarm > 0) {
      const a = alarm * (0.45 + 0.4 * Math.sin(now / 110));
      hemi.color.lerp(toC.set(0xff2a1a), a);
      hemi.groundColor.lerp(toC.set(0x5a0a08), a);
      moonLight.color.lerp(toC.set(0xff3a2a), a);
    }
  }

  if (RED) applyRed(dt, now);

  shootT -= dt;
  if (shootT < 0 && (!THEME.sun || night === 1)) {
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
