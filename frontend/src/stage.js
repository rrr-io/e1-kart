// Menu "pole position": a glowing pad in the team colour under the selected kart, and its idle engine wobble.
import * as THREE from 'three';
import { scene } from './engine.js';

const pad = new THREE.Group();
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  // Stepped radial glow, so it stays pixel-art once upscaled.
  for (let r = 16; r > 0; r -= 2) {
    g.fillStyle = `rgba(255,255,255,${(0.08 + (1 - r / 16) * 0.5).toFixed(2)})`;
    g.beginPath(); g.arc(16, 16, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
})();
const disc = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
const ring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.45, 24), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
[disc, ring].forEach((m) => { m.rotation.x = -Math.PI / 2; pad.add(m); });
disc.position.y = 0.04;
ring.position.y = 0.05;
pad.visible = false;
scene.add(pad);

let t = 0;

/** Shows the pad under the kart (menu only) and animates it. Pass null to hide it. */
export function updateStage(dt, kart, color) {
  if (!kart) { pad.visible = false; return; }
  t += dt;
  pad.visible = true;
  pad.position.set(kart.root.position.x, 0, kart.root.position.z);
  disc.material.color.set(color);
  ring.material.color.set(color);
  const pulse = Math.floor(t * 4) % 2;                      // two-step blink, arcade style
  ring.material.opacity = pulse ? 0.95 : 0.5;
  ring.scale.setScalar(1 + (Math.floor(t * 4) % 4) * 0.04);
  kart.body.position.y = Math.sin(t * 42) > 0.3 ? 0.03 : 0; // engine idling
}
