// Controls: analog slider (anywhere on the left half of the screen), drift/brake/item buttons, keyboard.
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

// Pixel slider, "floating": touch anywhere in the zone, the slider appears under the thumb and you slide left/right.
// Sliding past the end drags the slider along, so reversing is instant.
const DEAD = 0.08; // ignore tiny wobbles around the centre

// Pixel shapes drawn on small canvases, scaled up with crisp pixels like the rest of the HUD.
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function shape(g, w, h, inside) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) g.fillRect(x, y, 1, 1);
}
// Signed distance to a horizontal capsule (rounded ends): negative inside.
function capsule(w, h, inset) {
  const r = h / 2 - inset;
  return (x, y) => Math.hypot(Math.max(Math.abs(x - w / 2) - (w / 2 - h / 2), 0), y - h / 2) - r;
}
function drawBase(cv) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  const cap = capsule(w, h, 0.5);
  g.fillStyle = 'rgba(11,11,13,.55)'; shape(g, w, h, (x, y) => cap(x, y) < 0);                       // glass
  g.fillStyle = css('--paper') || '#fff'; shape(g, w, h, (x, y) => cap(x, y) < 0 && cap(x, y) >= -2); // outline
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(Math.floor(w / 2), 5, 1, h - 10);               // centre mark
  g.fillStyle = css('--mute') || '#b9b9c2';                                                           // ◀ ▶
  const c = Math.floor(h / 2);
  for (let i = 0; i < 4; i++) {
    g.fillRect(5 + i, c - i - 1, 1, i * 2 + 2);
    g.fillRect(w - 6 - i, c - i - 1, 1, i * 2 + 2);
  }
}
function drawKnob(cv, on) {
  const g = cv.getContext('2d'), c = cv.width / 2;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = css('--ink') || '#0b0b0d'; shape(g, cv.width, cv.height, (x, y) => Math.hypot(x - c, y - c) < c);
  g.fillStyle = on ? (css('--red') || '#E10600') : (css('--paper') || '#fff');
  shape(g, cv.width, cv.height, (x, y) => Math.hypot(x - c, y - c) < c - 1.5);
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(c - 3, c - 4, 2, 2);                            // shine
}

function steerZone() {
  const zone = $('steerZone'), pad = $('steerPad'), knob = $('steerKnob');
  drawBase($('steerBase')); drawKnob(knob, false);
  let id = null, cx = 0, R = 55, travel = 60;
  const show = (k) => { knob.style.transform = 'translate(calc(-50% + ' + Math.round(k * travel) + 'px),-50%)'; };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (id !== null) return;
    id = e.pointerId;
    const w = pad.offsetWidth, h = pad.offsetHeight, zr = zone.getBoundingClientRect();
    travel = (w - knob.offsetWidth) / 2 - 2;
    R = Math.max(44, travel); // finger distance for full lock
    // Put the slider under the thumb, kept fully inside the zone.
    cx = Math.min(Math.max(e.clientX, zr.left + w / 2), zr.right - w / 2);
    const cy = Math.min(Math.max(e.clientY, zr.top + h), zr.bottom - h);
    pad.style.left = (cx - zr.left - w / 2) + 'px';
    pad.style.top = (cy - zr.top - h / 2) + 'px';
    pad.style.bottom = 'auto';
    input.ax = 0;
    zone.classList.add('on');
    drawKnob(knob, true);
    show(0);
    try { zone.setPointerCapture(id); } catch (_) { /* fine */ }
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx;
    if (Math.abs(dx) > R) { cx = e.clientX - Math.sign(dx) * R; dx = Math.sign(dx) * R; } // drag the centre along
    const k = dx / R;
    input.ax = Math.abs(k) < DEAD ? 0 : -Math.sign(k) * (Math.abs(k) - DEAD) / (1 - DEAD);
    show(k);
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
