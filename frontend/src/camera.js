// Camera: fixed shot behind the kart in the menu, smooth chase in-race with FOV widening on boost.
import * as THREE from 'three';
import { camera } from './engine.js';
import { G, player } from './state.js';
import { TEAMS, settings } from './config.js';
import { updateStage } from './stage.js';

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const want = new THREE.Vector3(), look = new THREE.Vector3();
let menuA = 0;

// On very wide screens a fixed vertical FOV makes the horizontal angle huge (≈118° at 2.5:1),
// so the scene looks squashed and the kart tiny. Above WIDE_ASPECT we keep the horizontal angle
// of a WIDE_ASPECT screen instead, narrowing the vertical FOV to match.
const WIDE_ASPECT = 1.8;
const fitFov = (vfov) => {
  const k = Math.min(1, WIDE_ASPECT / camera.aspect);
  return (2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * k) * 180) / Math.PI;
};

export function updateCamera(dt) {
  if (G.state === 'menu') {
    // Fixed shot from behind the selected kart (like the race camera, a bit lower), with a slow breath.
    menuA += dt;
    const kart = G.karts[0], k = kart.root.position, h = kart.root.rotation.y;
    const fx = Math.sin(h), fz = Math.cos(h);
    const port = camera.aspect < 1, d = port ? 8.5 : 9;
    camera.position.set(k.x - fx * d, 2.9 + Math.sin(menuA * 1.3) * 0.06, k.z - fz * d);
    camera.lookAt(k.x + fx * 6, 0.6, k.z + fz * 6);
    // Portrait: move the kart up, above the team list. Landscape: a bit up too, between the driver's line and the bottom bar.
    camera.setViewOffset(camera.aspect, 1, 0, port ? 0.12 : 0.07, camera.aspect, 1);
    camera.fov = fitFov(port ? 62 : 42);
    camera.updateProjectionMatrix();
    updateStage(dt, kart, TEAMS[settings.teamIdx].color);
    return;
  }
  updateStage(dt, null);
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const p = player, fx = Math.sin(p.h), fz = Math.cos(p.h);
  want.set(p.x - fx * 7.6, 3.5, p.z - fz * 7.6);
  look.set(p.x + fx * 5, 1.3, p.z + fz * 5);
  if (camPos.lengthSq() === 0 || G.state === 'count') { camPos.copy(want); camLook.copy(look); }
  camPos.lerp(want, 1 - Math.exp(-dt * 7));
  camLook.lerp(look, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  const f = 68 + (p.boost > 0 ? 12 : 0) + Math.min(6, (p.v / 46) * 6);
  camera.fov += (fitFov(f) - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();
}
