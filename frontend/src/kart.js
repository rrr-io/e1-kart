// Low-poly kart model with a black outline, headlights and the boost flame.
import * as THREE from 'three';
import { scene, toon, outlineMat } from './engine.js';

function addPart(parent, geo, mat, x, y, z, outline) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (outline !== false) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(1.09);
    m.add(o);
  }
  parent.add(m);
  return m;
}

// The kart faces +z; root rotates on the y axis with heading, body tilts while drifting.
export function makeKart(color) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const paint = toon(new THREE.Color(color)), dark = toon(0x141418), white = toon(0xf4f4f6), grey = toon(0x5a5a62);

  addPart(body, new THREE.BoxGeometry(1.6, 0.36, 2.6), paint, 0, 0.48, 0);          // chassis
  addPart(body, new THREE.BoxGeometry(0.7, 0.26, 1.05), paint, 0, 0.42, 1.7);       // nose
  addPart(body, new THREE.BoxGeometry(2.1, 0.1, 0.4), dark, 0, 0.24, 2.2);          // front wing
  addPart(body, new THREE.BoxGeometry(0.42, 0.32, 1.2), white, 0.96, 0.46, -0.1);   // side pods
  addPart(body, new THREE.BoxGeometry(0.42, 0.32, 1.2), white, -0.96, 0.46, -0.1);
  addPart(body, new THREE.BoxGeometry(0.85, 0.3, 0.8), dark, 0, 0.76, -0.3, false); // seat
  addPart(body, new THREE.BoxGeometry(0.62, 0.5, 0.42), paint, 0, 1.0, -0.38);      // driver
  addPart(body, new THREE.SphereGeometry(0.38, 8, 6), white, 0, 1.42, -0.3);        // helmet
  addPart(body, new THREE.BoxGeometry(0.52, 0.15, 0.12), dark, 0, 1.45, -0.02, false); // visor
  addPart(body, new THREE.BoxGeometry(2.1, 0.13, 0.45), dark, 0, 1.15, -1.38);      // rear wing
  addPart(body, new THREE.BoxGeometry(0.1, 0.5, 0.1), dark, 0.5, 0.85, -1.3, false);
  addPart(body, new THREE.BoxGeometry(0.1, 0.5, 0.1), dark, -0.5, 0.85, -1.3, false);
  addPart(body, new THREE.CylinderGeometry(0.13, 0.13, 0.4, 6).rotateX(Math.PI / 2), grey, 0, 0.5, -1.45, false); // exhaust

  // Headlights, taillights and the cone of light on the asphalt.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c4 }), tl = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  [-0.32, 0.32].forEach((x) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), hl);
    h.position.set(x, 0.48, 2.23);
    body.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), tl);
    t.position.set(x * 2.2, 0.52, -1.32);
    body.add(t);
  });
  const lightCone = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  lightCone.position.set(0, 0.14, 6.6);
  root.add(lightCone);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa21a }));
  flame.position.set(0, 0.5, -2.1);
  flame.visible = false;
  body.add(flame);

  const wheels = [], pivots = [];
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 10).rotateZ(Math.PI / 2);
  const wgr = new THREE.CylinderGeometry(0.5, 0.5, 0.52, 10).rotateZ(Math.PI / 2);
  [[0.98, 0.42, 0.95, wg, true], [-0.98, 0.42, 0.95, wg, true], [1.04, 0.5, -0.95, wgr, false], [-1.04, 0.5, -0.95, wgr, false]].forEach((w) => {
    const piv = new THREE.Group();
    piv.position.set(w[0], w[1], w[2]);
    root.add(piv);
    wheels.push(addPart(piv, w[3], dark, 0, 0, 0));
    if (w[4]) pivots.push(piv);
  });

  scene.add(root);
  return { root, body, paint, flame, wheels, pivots };
}

export function paintKart(k, color) {
  k.paint.color.set(color);
}
