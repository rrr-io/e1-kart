// Controls: analog steering zone (left half of the screen), drift/brake/item buttons, keyboard.
import { $ } from './engine.js';
import { G, input } from './state.js';

function hold(id, key) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input[key] = true;
    el.classList.add('on');
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
  });
  const release = () => { input[key] = false; el.classList.remove('on'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, release));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// "Floating" steering: tap anywhere in the zone and drag; R px = full lock.
function steerZone() {
  const zone = $('steerZone'), knob = $('steerKnob');
  const R = 55;
  let id = null, x0 = 0;
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    id = e.pointerId;
    x0 = e.clientX;
    input.ax = 0;
    zone.classList.add('on');
    try { zone.setPointerCapture(id); } catch (_) { /* fine */ }
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - x0;
    if (Math.abs(dx) > R) { x0 = e.clientX - Math.sign(dx) * R; dx = Math.sign(dx) * R; }
    const d = dx / R;
    input.ax = -d;
    knob.style.transform = 'translateX(' + Math.round(d * 58) + 'px)';
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input.ax = 0;
    knob.style.transform = '';
    zone.classList.remove('on');
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => zone.addEventListener(ev, end));
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
}

const KEYS = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
  ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'drift', KeyE: 'item', Enter: 'item',
};

export function initInput() {
  steerZone();
  hold('bD', 'drift');
  hold('bB', 'brake');
  $('bI').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.item = true;
    setTimeout(() => { input.item = false; }, 120);
  });
  window.addEventListener('keydown', (e) => {
    if (G.state === 'menu') return;
    const k = KEYS[e.code];
    if (k) { input[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.code];
    if (k) input[k] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(input).forEach((k) => { input[k] = k === 'ax' ? 0 : false; });
  });
}
