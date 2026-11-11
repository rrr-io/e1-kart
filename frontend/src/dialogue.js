// Driver dialogue: box with nameplate and portrait, in-race radio, menu preview.
// Portraits are PNGs in public/drivers/ (see drivers.js); a pixel silhouette is used until they're added.
import { $ } from './engine.js';
import { TEAMS, lum } from './config.js';
import { DRIVERS, pickLines } from './drivers.js';

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_MS = 28;

// ---------- Portraits ----------

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// Small 5×5 icons for the silhouette's expression.
const GLYPHS = {
  happy: { color: '#ff6fae', rows: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'] },
  sad: { color: '#6fb6ff', rows: ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'] },
  hype: { color: '#ffd23a', rows: ['..X..', '..X..', 'XXXXX', '..X..', '..X..'] },
};
const QMARK = ['.XXX.', 'X...X', '...X.', '..X..', '.....', '..X..'];

/** 32×32 sticker-style silhouette: dark bust tinted with the team's color, white then black outline. */
function drawSilhouette(canvas, color, mood) {
  const S = 32;
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, S, S);

  const inside = (x, y) => {
    const hx = (x + 0.5 - 16) / 6.6, hy = (y + 0.5 - 11.5) / 7.2;
    if (hx * hx + hy * hy <= 1) return true;                       // head
    if (y >= 17 && y <= 21 && x >= 13 && x <= 18) return true;     // neck
    if (y >= 21) {                                                 // shoulders
      const half = Math.min(14, 5 + (y - 21) * 2.2);
      return Math.abs(x + 0.5 - 16) <= half;
    }
    return false;
  };
  const near = (x, y, test) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => test(x + dx, y + dy));
  const white = (x, y) => !inside(x, y) && near(x, y, inside);

  const body = mix(color, '#0b0b0d', 0.72);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (inside(x, y)) {
        g.fillStyle = y >= 23 && y <= 24 ? color : body;           // stripe in the team's color
      } else if (white(x, y)) {
        g.fillStyle = '#ffffff';
      } else if (near(x, y, white)) {
        g.fillStyle = '#0b0b0d';
      } else {
        continue;
      }
      g.fillRect(x, y, 1, 1);
    }
  }
  // Question mark on the face: it's a placeholder.
  g.fillStyle = 'rgba(255,255,255,.85)';
  QMARK.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') g.fillRect(14 + x, 8 + y, 1, 1); }));
  // Expression.
  const gl = GLYPHS[mood];
  if (gl) {
    g.fillStyle = '#0b0b0d';
    g.fillRect(24, 1, 7, 7);
    g.fillStyle = gl.color;
    gl.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') g.fillRect(25 + x, 2 + y, 1, 1); }));
  }
}

const imgCache = new Map(); // url -> Promise<HTMLImageElement|null>
function loadImage(url) {
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return imgCache.get(url);
}

/** The full drawing of the driver for a moment ('neutral', 'win', 'podium', 'end'), or null (no drawings). */
export async function portraitImage(teamIdx, slot = 'neutral', pick = Math.random()) {
  const set = DRIVERS[teamIdx] && DRIVERS[teamIdx].portrait;
  if (!set) return null;
  const list = set[slot] || (slot === 'win' && (set.podium || set.end)) || (slot === 'podium' && set.end) || set.neutral;
  if (!list || !list.length) return null;
  const file = list[Math.min(list.length - 1, Math.floor(pick * list.length))];
  return loadImage(import.meta.env.BASE_URL + 'drivers/' + file);
}

/** Draws the driver's portrait on the canvas: one of the driver's drawings for that moment
 *  ('neutral', 'win', 'podium' or 'end', see drivers.js), otherwise a silhouette with the mood glyph.
 *  pick (0..1) chooses among the drawings of the moment. The dialogue portrait (behind the box)
 *  is shown at the drawing's own size (× portrait.scale, default 1). */
export async function drawPortrait(canvas, teamIdx, mood, slot = 'neutral', pick = Math.random()) {
  const color = TEAMS[teamIdx].color;
  const twice = canvas.classList.contains('dlg-portrait');
  drawSilhouette(canvas, color, mood);
  if (twice) canvas.style.width = '';
  const set = DRIVERS[teamIdx] && DRIVERS[teamIdx].portrait;
  if (!set) return;
  const list = set[slot] || (slot === 'win' && (set.podium || set.end)) || (slot === 'podium' && set.end) || set.neutral;
  if (!list || !list.length) return;
  const token = (canvas._token = (canvas._token || 0) + 1);
  const file = list[Math.min(list.length - 1, Math.floor(pick * list.length))];
  const img = await loadImage(import.meta.env.BASE_URL + 'drivers/' + file);
  if (!img || canvas._token !== token) return;
  const g = canvas.getContext('2d');
  if (twice) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = img.naturalWidth * (set.scale || 1) + 'px';
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    return;
  }
  // Small square portraits (menu bubble, radio): drop the empty columns beside the head, so every
  // driver's head fills the square the same way whatever the drawing's canvas width;
  // thumb (drivers.js) widens the square around the head to show the driver a little farther away.
  const [x0, w] = headSpan(img);
  const W = Math.round(w * (set.thumb || 1)), pad = Math.round((W - w) / 2);
  canvas.width = W;
  canvas.height = Math.round(img.naturalHeight * (set.thumb || 1));
  g.imageSmoothingEnabled = false;
  g.drawImage(img, x0, 0, w, img.naturalHeight, pad, Math.round(pad * 0.5), w, img.naturalHeight);
}

// Horizontal extent of the opaque pixels in the head band (top ~45% of the drawing), cached per image.
const spans = new WeakMap();
function headSpan(img) {
  if (spans.has(img)) return spans.get(img);
  const W = img.naturalWidth, H = Math.round(img.naturalHeight * 0.45);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  let a = W, b = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) { if (x < a) a = x; if (x > b) b = x; }
  const span = b < a ? [0, W] : [a, b - a + 1];
  spans.set(img, span);
  return span;
}

export function applyTeam(el, teamIdx) {
  const c = TEAMS[teamIdx].color;
  el.style.setProperty('--team', c);
  el.style.setProperty('--team-ink', lum(c) > 0.55 ? '#0b0b0d' : '#ffffff');
}

export const nameOf = (teamIdx) => (DRIVERS[teamIdx] && DRIVERS[teamIdx].driver) || TEAMS[teamIdx].name;

// ---------- Typewriter ----------

function typewriter(el, text, onDone) {
  let i = 0, timer = null, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    el.textContent = text;
    if (onDone) onDone();
  };
  if (REDUCED) {
    finish();
  } else {
    el.textContent = '';
    timer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) finish();
    }, TYPE_MS);
  }
  return { finish, typing: () => !done, cancel: () => { done = true; clearInterval(timer); } };
}

// ---------- On-screen dialogue ----------

const dlg = $('dialog');
const dlgText = $('dlgText');
const dlgLive = $('dlgLive');
let current = null; // { lines, index, tw, resolve, onClose }

function showLine() {
  const { lines, index, teamIdx } = current;
  const line = lines[index];
  $('dlgNext').hidden = true;
  // After the finish: podium or end drawings; before the start: neutral. Same drawing for the whole dialogue.
  const key = current.key;
  const slot = key === 'win' ? 'win' : key === 'podium' ? 'podium' : key === 'lose' ? 'end' : 'neutral';
  drawPortrait($('dlgPortrait'), teamIdx, line.mood, slot, current.pick);
  dlgLive.textContent = line.t;
  current.tw = typewriter(dlgText, line.t, () => { $('dlgNext').hidden = false; });
}

// byPlayer: closed by the player's tap or key (onClose runs then, still inside that gesture, so it may open a link).
function close(byPlayer = false) {
  if (!current) return;
  const { resolve, tw, onClose } = current;
  if (tw) tw.cancel();
  current = null;
  dlg.hidden = true;
  $('game').classList.remove('talking');
  if (byPlayer && onClose) onClose();
  resolve();
}

function advance() {
  if (!current) return;
  if (current.tw && current.tw.typing()) { current.tw.finish(); return; }
  current.index++;
  if (current.index >= current.lines.length) close(true);
  else showLine();
}

/**
 * Shows the driver's dialogue for a race moment. Resolves once the player closes it.
 * opts.onClose runs right in the closing tap or key press (not when another dialogue replaces this one).
 */
export function talk(teamIdx, key, opts = {}) {
  const lines = pickLines(teamIdx, key);
  if (!lines.length) return Promise.resolve();
  if (current) close();
  hideRadio();
  return new Promise((resolve) => {
    current = { lines, index: 0, teamIdx, key, pick: Math.random(), tw: null, resolve, onClose: opts.onClose };
    applyTeam(dlg, teamIdx);
    $('dlgName').textContent = nameOf(teamIdx);
    dlg.hidden = false;
    $('game').classList.add('talking');
    showLine();
  });
}

export const isTalking = () => current !== null;

dlg.addEventListener('click', (e) => {
  if (e.target.closest('#dlgSkip')) return;
  advance();
});
$('dlgSkip').addEventListener('click', (e) => { e.stopPropagation(); close(true); });
// Keyboard: Enter/Space to advance, Esc to skip. Captured so it never reaches the driving controls.
window.addEventListener('keydown', (e) => {
  if (!current) return;
  if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
  else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(true); }
}, true);

// ---------- In-race radio ----------

const radioEl = $('radio');
let radioTimer = null, radioTw = null, lastRadio = -1e9;

function hideRadio() {
  clearTimeout(radioTimer);
  if (radioTw) radioTw.cancel();
  radioEl.hidden = true;
}

/** Short radio message that doesn't pause the race. force ignores the minimum gap between radios. */
export function radio(teamIdx, key, force = false) {
  const now = performance.now();
  if (current || (!force && now - lastRadio < 6000)) return;
  const [line] = pickLines(teamIdx, key);
  if (!line) return;
  lastRadio = now;
  applyTeam(radioEl, teamIdx);
  $('radioName').textContent = nameOf(teamIdx);
  drawPortrait($('radioPortrait'), teamIdx, line.mood);
  radioEl.hidden = false;
  if (radioTw) radioTw.cancel();
  radioTw = typewriter($('radioText'), line.t);
  clearTimeout(radioTimer);
  radioTimer = setTimeout(hideRadio, 1400 + line.t.length * 45);
}

export { hideRadio };

// ---------- Menu preview ----------

let introTeam = -1, introTw = null;

/** Shows the driver's line under the team selection (only redrawn when the team changes). */
export function showTeamIntro(teamIdx) {
  if (teamIdx === introTeam) return;
  introTeam = teamIdx;
  const box = $('teamIntro');
  applyTeam(box, teamIdx);
  $('introName').textContent = nameOf(teamIdx);
  const [line] = pickLines(teamIdx, 'select');
  drawPortrait($('introPortrait'), teamIdx, line ? line.mood : 'normal');
  if (introTw) introTw.cancel();
  introTw = typewriter($('introText'), line ? line.t : '');
}
