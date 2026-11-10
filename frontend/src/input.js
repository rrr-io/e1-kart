// Controls: round analog stick (anywhere on the left half of the screen), drift/brake/item buttons, keyboard.
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

// Round pixel joystick, "floating": touch anywhere in the zone, the stick appears under the thumb and you drag it.
// Only the horizontal part steers; pulling past the edge drags the stick along, so reversing is instant.
const DEAD = 0.08; // ignore tiny wobbles around the centre

// Pixel circles drawn on small canvases, scaled up with crisp pixels like the rest of the HUD.
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function disk(g, c, r, inside) {
  for (let y = 0; y < c * 2; y++) for (let x = 0; x < c * 2; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (inside(d, r)) g.fillRect(x, y, 1, 1);
  }
}
function drawBase(cv) {
  const g = cv.getContext('2d'), c = cv.width / 2;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(11,11,13,.55)'; disk(g, c, c - 1, (d, r) => d < r);           // glass
  g.fillStyle = css('--paper') || '#fff'; disk(g, c, c - 1, (d, r) => d < r && d >= r - 2); // ring
  g.fillStyle = 'rgba(255,255,255,.22)'; disk(g, c, c - 9, (d, r) => d < r && d >= r - 1); // inner guide
  // ◀ ▶ arrows
  g.fillStyle = css('--mute') || '#b9b9c2';
  for (let i = 0; i < 4; i++) {
    g.fillRect(4 + i, c - i - 1, 1, i * 2 + 2);
    g.fillRect(cv.width - 5 - i, c - i - 1, 1, i * 2 + 2);
  }
}
function drawKnob(cv, on) {
  const g = cv.getContext('2d'), c = cv.width / 2;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = css('--ink') || '#0b0b0d'; disk(g, c, c, (d, r) => d < r);
  g.fillStyle = on ? (css('--red') || '#E10600') : (css('--paper') || '#fff'); disk(g, c, c - 1.5, (d, r) => d < r);
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(c - 3, c - 4, 2, 2);            // shine
}

function steerZone() {
  const zone = $('steerZone'), pad = $('steerPad'), knob = $('steerKnob');
  drawBase($('steerBase')); drawKnob(knob, false);
  let id = null, cx = 0, cy = 0, R = 50, travel = 34;
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (id !== null) return;
    id = e.pointerId;
    const size = pad.offsetWidth, zr = zone.getBoundingClientRect();
    R = size * 0.37; travel = size * 0.27;
    // Centre the stick under the thumb, kept fully inside the zone.
    cx = Math.min(Math.max(e.clientX, zr.left + size / 2), zr.right - size / 2);
    cy = Math.min(Math.max(e.clientY, zr.top + size / 2), zr.bottom - size / 2);
    pad.style.left = (cx - zr.left - size / 2) + 'px';
    pad.style.top = (cy - zr.top - size / 2) + 'px';
    pad.style.bottom = 'auto';
    input.ax = 0;
    zone.classList.add('on');
    drawKnob(knob, true);
    try { zone.setPointerCapture(id); } catch (_) { /* fine */ }
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { // drag the centre along so the thumb never leaves the stick
      cx = e.clientX - dx / len * R; cy = e.clientY - dy / len * R;
      dx = dx / len * R; dy = dy / len * R;
    }
    let d = dx / R;
    d = Math.abs(d) < DEAD ? 0 : Math.sign(d) * (Math.abs(d) - DEAD) / (1 - DEAD);
    input.ax = -d;
    knob.style.transform = 'translate(' + Math.round(dx / R * travel) + 'px,' + Math.round(dy / R * travel) + 'px)';
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input.ax = 0;
    knob.style.transform = '';
    pad.style.left = pad.style.top = pad.style.bottom = '';
    zone.classList.remove('on');
    drawKnob(knob, false);
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
