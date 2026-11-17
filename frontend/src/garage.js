// The 3D pit garage behind the multiplayer lobby: built with the same low-poly toon look as the rest of the game,
// far away from the track (nothing of the track is visible from inside). Six boxes, one per team: the shutter goes up
// and the box lights up for the players in the room; the CPU karts wait behind half-closed shutters.
// While the lobby is open the camera looks at the garage instead of the menu kart (camera.js).
import * as THREE from 'three';
import { scene, toon, outlineMat, canvasTex, redrawTex } from './engine.js';
import { TEAMS } from './config.js';
import { makeKart } from './kart.js';

const ORIGIN = new THREE.Vector3(6000, 0, 6000);
const BW = 5.6, BD = 7.5, BH = 4.2;      // one box: width, depth, height
const N = TEAMS.length, TOTAL = N * BW;
const X0 = -TOTAL / 2;

const root = new THREE.Group();
root.position.copy(ORIGIN);
root.visible = false;
scene.add(root);

let active = false, shifted = false, built = false, t = 0, shift = 0;
const cam = new THREE.Vector3(0, 5.5, 22), aim = new THREE.Vector3(0, 2.4, -2);
const bays = [];
const texts = [];

function part(geo, mat, x, y, z, parent = root, outline = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  if (outline) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(1.03);
    m.add(o);
  }
  parent.add(m);
  return m;
}

const PIX = (size) => size + 'px "Press Start 2P", monospace';

function build() {
  built = true;
  const wall = toon(0x3a4468), wallDark = toon(0x1c2238), white = toon(0xf0f0f4), dark = toon(0x18181c);
  // Floor with the pit lane line and a red/white kerb at the front, back wall with ribs, side walls, ceiling.
  const floorTex = canvasTex(32, 32, (g) => {
    g.fillStyle = '#525868'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#474d5c'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
    g.fillStyle = '#444a5c'; g.fillRect(9, 13, 2, 1); g.fillRect(22, 25, 3, 1);
  }, true);
  floorTex.repeat.set((TOTAL + 16) / 4, 34 / 4);
  part(new THREE.BoxGeometry(TOTAL + 16, 0.2, 34), toon(0xffffff, { map: floorTex }), 0, -0.1, 6, root, false);
  part(new THREE.BoxGeometry(TOTAL + 16, 0.04, 0.4), white, 0, 0.02, 7.5, root, false);
  for (let k = 0; k < 26; k++) part(new THREE.BoxGeometry(1.6, 0.06, 0.8), toon(k % 2 ? 0xffffff : 0xe10600), X0 - 8 + k * 1.75, 0.03, 13, root, false);
  const ribs = canvasTex(8, 8, (g) => { g.fillStyle = '#3a4468'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#2c3456'; g.fillRect(0, 0, 2, 8); }, true);
  ribs.repeat.set((TOTAL + 16) / 1.2, 4);
  part(new THREE.BoxGeometry(TOTAL + 16, 9, 0.4), toon(0xffffff, { map: ribs }), 0, 4.5, -BD - 0.2, root, false);
  part(new THREE.BoxGeometry(0.4, 9, 34), wall, -TOTAL / 2 - 8, 4.5, 6, root, false);
  part(new THREE.BoxGeometry(0.4, 9, 34), wall, TOTAL / 2 + 8, 4.5, 6, root, false);
  part(new THREE.BoxGeometry(TOTAL + 16, 0.4, 34), wallDark, 0, 9, 6, root, false);
  for (let k = 0; k < 4; k++) part(new THREE.BoxGeometry(TOTAL + 16, 0.4, 0.5), dark, 0, 8.6, -4 + k * 6, root, false);
  // Outside the boxes: tyre stacks and a red tool cart on each side.
  [[-TOTAL / 2 - 2.5, 3], [-TOTAL / 2 - 4.2, 2], [TOTAL / 2 + 2.3, 4]].forEach(([x, n]) => {
    for (let k = 0; k < n; k++) part(new THREE.CylinderGeometry(0.62, 0.62, 0.44, 10), dark, x, 0.24 + k * 0.46, -2, root, false).castShadow = true;
  });
  const red = toon(0xc8110e);
  part(new THREE.BoxGeometry(1.8, 1.6, 1), red, TOTAL / 2 + 4.6, 0.8, -1.8).castShadow = true;
  for (let k = 0; k < 3; k++) part(new THREE.BoxGeometry(0.6, 0.08, 0.04), white, TOTAL / 2 + 4.6, 0.45 + k * 0.45, -1.28, root, false);
  // The sign over the boxes.
  const signTex = canvasTex(192, 16, (g, w, h) => {
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e10600'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1);
    g.font = PIX(8); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText('E1 KART GP  PIT GARAGE', w / 2, h / 2 + 1);
  });
  texts.push(signTex);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(TOTAL * 0.7, TOTAL * 0.7 / 12), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, BH + 2.4, -0.2);
  root.add(sign);

  TEAMS.forEach((team, k) => {
    const g = new THREE.Group();
    g.position.x = X0 + BW * (k + 0.5);
    root.add(g);
    // dividers, header in the team colour with the box number
    part(new THREE.BoxGeometry(0.3, BH + 1.2, BD), wall, -BW / 2, (BH + 1.2) / 2, -BD / 2, g);
    if (k === N - 1) part(new THREE.BoxGeometry(0.3, BH + 1.2, BD), wall, BW / 2, (BH + 1.2) / 2, -BD / 2, g);
    part(new THREE.BoxGeometry(BW, 1.2, 0.5), toon(new THREE.Color(team.color)), 0, BH + 0.6, 0, g);
    const numTex = canvasTex(32, 8, (c, w, h) => {
      c.fillStyle = team.color; c.fillRect(0, 0, w, h);
      c.font = PIX(8); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#0b0b0d'; c.fillText(String(k + 1).padStart(2, '0'), w / 2, h / 2 + 1);
    });
    texts.push(numTex);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: numTex }));
    num.position.set(0, BH + 0.6, 0.27);
    g.add(num);
    // inside: the back panel, the lamp, a tyre stack
    part(new THREE.BoxGeometry(BW - 0.3, BH, 0.2), toon(0x46507a), 0, BH / 2, -BD + 0.1, g, false);
    const lampM = new THREE.MeshBasicMaterial({ color: 0x3a3a44 });
    part(new THREE.BoxGeometry(BW * 0.55, 0.15, 0.7), lampM, 0, BH - 0.15, -BD / 2, g, false);
    for (let n = 0; n < 3; n++) part(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10), dark, -BW / 2 + 0.8, 0.2 + n * 0.38, -BD + 0.9, g, false);
    // light pool on the floor, bright when the box is open
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.5, BD + 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(0, 0.03, -BD / 2 + 1);
    g.add(pool);
    // the kart, nose out, slightly turned
    const kart = makeKart(team.color);
    scene.remove(kart.root);
    kart.root.position.set(0.15, 0, -BD / 2 + 0.6);
    kart.root.rotation.y = 0.3;
    kart.root.scale.setScalar(1.2);
    kart.root.children.forEach((c) => { if (c.material && c.material.blending === THREE.AdditiveBlending) c.visible = false; }); // no headlight cone
    g.add(kart.root);
    // the shutter hangs from the header; its height animates
    const shTex = canvasTex(8, 8, (c) => { c.fillStyle = '#6c7590'; c.fillRect(0, 0, 8, 8); c.fillStyle = '#525b75'; c.fillRect(0, 0, 8, 2); c.fillRect(0, 4, 8, 2); }, true);
    shTex.repeat.set(2, 6);
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.3, 1, 0.14).translate(0, -0.5, 0), toon(0xffffff, { map: shTex }));
    shutter.position.set(0, BH, -0.15);
    shutter.castShadow = true;
    g.add(shutter);
    const handle = part(new THREE.BoxGeometry(1.2, 0.12, 0.1), dark, 0, 0, 0, shutter, false);
    handle.position.z = 0.1;
    // label on the floor in front of the box: YOU / P2 / CPU
    const lab = { text: '', color: '#8a93a8' };
    const labTex = canvasTex(32, 8, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = PIX(8); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#0b0b0d'; c.fillText(lab.text, w / 2 + 1, h / 2 + 2);
      c.fillStyle = lab.color; c.fillText(lab.text, w / 2, h / 2 + 1);
    });
    texts.push(labTex);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1).rotateX(-1.1), new THREE.MeshBasicMaterial({ map: labTex, transparent: true, depthWrite: false }));
    label.position.set(0, 0.5, 2.6);
    g.add(label);
    bays.push({ kart, shutter, handle, pool, lampM, lab, labTex, open: 0, target: 0.5, state: 'cpu' });
  });
}

/** list: one entry per team, { state: 'you' | 'friend' | 'cpu', label }. */
export function setGarage(list) {
  if (!built) build();
  list.forEach((b, k) => {
    const bay = bays[k];
    bay.state = b.state;
    bay.target = b.state === 'cpu' ? 0.45 : 1;
    const color = b.state === 'you' ? '#ffffff' : b.state === 'friend' ? TEAMS[k].color : '#8a93a8';
    if (bay.lab.text !== b.label || bay.lab.color !== color) {
      bay.lab.text = b.label;
      bay.lab.color = color;
      redrawTex(bay.labTex);
    }
  });
}

/** Shows or hides the garage; side: the lobby box is on the right, so the picture moves the boxes to the left. */
export function showGarage(on, side = false) {
  if (on && !built) build();
  active = on;
  shifted = side;
  root.visible = on;
  // Only the lobby box stays on screen in front of the garage.
  const menu = document.getElementById('menu');
  if (menu) menu.classList.toggle('mp-lobby', on);
}
export const garageActive = () => active;
export const garageFocus = () => ORIGIN;

/** Redraws the text textures once the pixel font is in. */
export function redrawGarageText() { texts.forEach(redrawTex); }

/** Animates shutters and lamps and places the camera (called by camera.js while the garage is shown). */
export function updateGarage(dt, camera, fitFov) {
  t += dt;
  bays.forEach((b, k) => {
    b.open += (b.target - b.open) * Math.min(1, dt * 4);
    const lit = Math.max(0, (b.open - 0.45) / 0.55);
    b.shutter.scale.y = Math.max(0.15, BH * (1 - b.open));
    b.handle.scale.y = 1 / b.shutter.scale.y;
    b.handle.position.y = -1 + 0.15 / b.shutter.scale.y;
    b.pool.material.opacity = 0.3 * lit;
    b.lampM.color.setRGB(0.23 + 0.77 * lit, 0.23 + 0.72 * lit, 0.27 + 0.52 * lit);
    // the players' karts idle (engine wobble), the CPU ones sit still
    b.kart.body.position.y = b.state === 'cpu' ? 0 : Math.abs(Math.sin(t * 22 + k)) * 0.03;
  });
  const port = camera.aspect < 1, side = shifted && !port;
  // Front view on the menu; in a room (box on the right) a three-quarter view from the right, so the boxes run
  // in perspective across the free left part of the screen.
  const k = Math.min(1, dt * 3);
  const [px, py, pz, lx, ly, lz] = port ? [0, 7, 44, 0, 2.4, -2] : side ? [-3, 6.5, 37, -1, 2.2, -3] : [0, 5.5, 22, 0, 2.4, -2];
  cam.x += (px - cam.x) * k; cam.y += (py - cam.y) * k; cam.z += (pz - cam.z) * k;
  aim.x += (lx - aim.x) * k; aim.y += (ly - aim.y) * k; aim.z += (lz - aim.z) * k;
  shift += ((side ? 0.245 : 0) - shift) * k;
  camera.position.set(ORIGIN.x + cam.x + Math.sin(t * 0.3) * 0.4, ORIGIN.y + cam.y, ORIGIN.z + cam.z);
  camera.lookAt(ORIGIN.x + aim.x, ORIGIN.y + aim.y, ORIGIN.z + aim.z);
  camera.setViewOffset(camera.aspect, 1, camera.aspect * shift, port ? 0.16 : 0, camera.aspect, 1);
  camera.fov = fitFov(port ? 58 : 50);
  camera.updateProjectionMatrix();
}
