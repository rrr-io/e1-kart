// Track selection: a box after the team choice (START), with a pixel preview of each track.
// Swipe, arrows or the keyboard move between tracks; GO starts (free track) or opens the entry ticket.
// The 3D scene is built for one track, so choosing a different one saves it and reloads the page,
// then carries on from here (sessionStorage flag).
import * as THREE from 'three';
import { $ } from './engine.js';
import { settings, saveSettings, LAPS } from './config.js';
import { TRACKS, TRACK_IDS, TRACK_ID, isLocked, UNLOCK_LABEL } from './theme.js';

const GO_FLAG = 'e1kart-go';
let idx = Math.max(0, TRACK_IDS.indexOf(TRACK_ID));
let onGo = null;

// ---------- Preview: a shot rendered from the game itself, plus a small map of the layout ----------
const SHOTS = {
  night: new URL('./assets/tracks/night.png', import.meta.url).href,
  space: new URL('./assets/tracks/space.png', import.meta.url).href,
  bloody: new URL('./assets/tracks/bloody.png', import.meta.url).href,
  want: new URL('./assets/tracks/want.png', import.meta.url).href,
};
const MAP = { night: ['#E10600', '#ffffff'], space: ['#ff4fd8', '#4fe6ff'], bloody: ['#C8110E', '#ffd23a'] };
// What one run costs, on the card.
const COST = { space: '1 FANS\' CHOICE certificate = 1 run', bloody: '1 MCD STAGE certificate = 1 run' };

function drawMap(c, id) {
  const g = c.getContext('2d'), W = c.width, H = c.height, t = TRACKS[id], [k1, k2] = MAP[id] || MAP.night;
  const curve = new THREE.CatmullRomCurve3(t.raw.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'catmullrom', 0.5);
  const pts = curve.getSpacedPoints(200);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
  const s = Math.min((W - 8) / (x1 - x0), (H - 8) / (z1 - z0));
  const P = pts.map((p) => [W / 2 + (p.x - (x0 + x1) / 2) * s, H / 2 + (p.z - (z0 + z1) / 2) * s]);
  const path = (w, col, dash) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.setLineDash(dash || []);
    g.beginPath(); P.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  };
  path(5, '#0b0b0d'); path(3, k1, [2, 2]); path(3, k2, [0, 2, 2, 0]); path(1, '#ffffff');
  g.setLineDash([]);
  const [sx, sy] = P[0];
  g.fillStyle = '#0b0b0d'; g.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 5, 5);
  g.fillStyle = '#ffffff'; g.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
}

function buildCards() {
  $('tpStrip').replaceChildren(...TRACK_IDS.map((id) => {
    const t = TRACKS[id];
    const card = document.createElement('div');
    card.className = 'tp-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', t.name);
    const c = document.createElement('div');
    c.className = 'tp-preview';
    const img = document.createElement('img');
    img.src = SHOTS[id]; img.alt = ''; img.draggable = false;
    const map = document.createElement('canvas');
    map.width = 64; map.height = 44; map.className = 'tp-map';
    drawMap(map, id);
    c.append(img, map);
    const locked = isLocked(id);
    if (locked) {
      card.classList.add('locked');
      const ban = document.createElement('span'); ban.className = 'tp-lock'; ban.textContent = '🔒 ' + UNLOCK_LABEL;
      c.append(ban);
    }
    const head = document.createElement('div'); head.className = 'tp-head';
    const nm = document.createElement('b'); nm.textContent = t.name;
    const badge = document.createElement('span'); badge.className = 'tp-badge' + (locked ? ' lock' : t.cost ? '' : ' free'); badge.textContent = locked ? 'LOCKED' : t.cost ? '1 RUN' : 'FREE';
    head.append(nm, badge);
    const desc = document.createElement('p'); desc.className = 'tp-desc'; desc.textContent = t.desc;
    const meta = document.createElement('p'); meta.className = 'tp-meta';
    meta.textContent = `${LAPS} LAPS` + (t.cost ? ' · ' + (COST[id] || '1 certificate = 1 run') : (t.mv ? ' · 1 min of the MV = 3 races' : ' · unlimited races'));
    card.append(c, head, desc);
    if (t.note) {
      const note = document.createElement('p'); note.className = 'tp-note'; note.textContent = t.note;
      card.append(note);
    }
    card.append(meta);
    return card;
  }));
  $('tpDots').replaceChildren(...TRACK_IDS.map(() => document.createElement('i')));
}

function show(i, animate = true) {
  idx = (i + TRACK_IDS.length) % TRACK_IDS.length;
  const strip = $('tpStrip');
  strip.style.transition = animate ? '' : 'none';
  strip.style.transform = `translateX(${-idx * 100}%)`;
  [...$('tpDots').children].forEach((d, k) => d.classList.toggle('on', k === idx));
  [...strip.children].forEach((c, k) => c.setAttribute('aria-hidden', String(k !== idx)));
  const t = TRACKS[TRACK_IDS[idx]], locked = isLocked(TRACK_IDS[idx]);
  $('trackGo').textContent = locked ? 'LOCKED' : t.cost ? 'NEXT ▶' : 'RACE ▶';
  $('trackGo').disabled = locked;
}

// Swipe: follow the finger, then snap to the nearest track.
function swipe() {
  const view = $('tpView'), strip = $('tpStrip');
  let x0 = null, dx = 0;
  view.addEventListener('pointerdown', (e) => { x0 = e.clientX; dx = 0; strip.style.transition = 'none'; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    strip.style.transform = `translateX(calc(${-idx * 100}% + ${dx}px))`;
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    const w = view.clientWidth || 1;
    show(Math.abs(dx) > w * 0.18 ? idx + (dx < 0 ? 1 : -1) : idx);
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}

export function openTrackBox(cb) {
  onGo = cb;
  show(Math.max(0, TRACK_IDS.indexOf(TRACK_ID)), false);
  $('trackBox').hidden = false;
  $('trackGo').focus();
}
export function closeTrackBox() { $('trackBox').hidden = true; }

/** After a reload caused by a track change: carry on as if GO had been pressed. */
export function takeGoFlag() {
  try { const v = sessionStorage.getItem(GO_FLAG); sessionStorage.removeItem(GO_FLAG); return v === TRACK_ID; } catch (e) { return false; }
}

function go() {
  const id = TRACK_IDS[idx];
  if (isLocked(id)) return;
  if (id !== TRACK_ID) {
    settings.track = id;
    saveSettings();
    try { sessionStorage.setItem(GO_FLAG, id); } catch (e) { /* the player just presses START again */ }
    $('trackGo').disabled = true;
    $('trackGo').textContent = 'LOADING…';
    location.reload();
    return;
  }
  closeTrackBox();
  if (onGo) onGo(TRACKS[id]);
}

buildCards();
swipe();
$('tpPrev').onclick = () => show(idx - 1);
$('tpNext').onclick = () => show(idx + 1);
$('trackGo').onclick = go;
$('trackBack').onclick = closeTrackBox;
$('trackClose').onclick = closeTrackBox;
$('trackBox').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') show(idx - 1);
  else if (e.key === 'ArrowRight') show(idx + 1);
  else if (e.key === 'Escape') closeTrackBox();
});
