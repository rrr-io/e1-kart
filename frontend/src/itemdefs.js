// Item definitions shared by the HUD and the race logic: names, who gets what, and the 16×16 pixel icons.
// No imports on purpose, so any module can use it without creating import cycles.

export const ITEM_NAMES = { stick: 'LIGHTSTICK', pop: 'BLOOD POP', bats: 'BAT SWARM', flower: 'PARALLEL WORLD' };
const KINDS = ['stick', 'pop', 'bats', 'flower'];

/** True when the value is an item that can be used (not null, not the "rolling" animation). */
export const isReady = (k) => !!k && k in ITEM_NAMES;

// Effect durations (seconds).
export const SLIP_T = 1.1;     // spin-out after stepping on a BLOOD POP
export const BATS_T = 3.2;     // slowed down (and blinded, for the player) by the BAT SWARM
export const FLOWER_T = 2.4;   // PARALLEL WORLD: boost + ghost (nothing can hit you)
export const STICK_T = 1.7;    // LIGHTSTICK boost

// Item roll weights by race position (index 0 = 1st place): [lightstick, blood pop, bat swarm, parallel world].
// Whoever leads gets the "hit the ones behind" items, whoever trails gets the comeback.
const WEIGHTS = [
  [20, 40, 40, 0],
  [25, 35, 35, 5],
  [35, 25, 20, 20],
  [35, 15, 15, 35],
  [25, 10, 5, 60],
  [20, 5, 0, 75],
];

export function rollItem(position) {
  const w = WEIGHTS[Math.max(0, Math.min(WEIGHTS.length - 1, position - 1))];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return KINDS[i]; }
  return 'stick';
}

// ---------- Pixel art ----------

// Parallel-world flower, rasterized from the 5-petal SVG (16×16).
const FLOWER = [
  '......XXXX......',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '...XXXXXXXXXX...',
  '.XXXXXXXXXXXXXX.',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXX..XXXXXXX',
  'XXXXXXX..XXXXXXX',
  '.XXXXXX..XXXXXX.',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '....XXX..XXX....',
];
export const FLOWER_BASE = '#A7B8C2';
const FLOWER_LIGHT = '#DCE7EC';
const FLOWER_DARK = '#74899A';

function drawFlower(g) {
  const on = (x, y) => FLOWER[y] && FLOWER[y][x] === 'X';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!on(x, y)) continue;
      // Light edge on the top/left, dark edge on the bottom/right.
      const dark = !on(x, y + 1) || !on(x + 1, y), light = !on(x, y - 1) || !on(x - 1, y);
      g.fillStyle = dark ? FLOWER_DARK : light ? FLOWER_LIGHT : FLOWER_BASE;
      g.fillRect(x, y, 1, 1);
    }
  }
}

function drawPop(g) {
  g.fillStyle = '#E10600'; g.fillRect(5, 1, 6, 1); g.fillRect(4, 2, 8, 9);
  g.fillStyle = '#FF7A6A'; g.fillRect(5, 3, 1, 5);
  g.fillStyle = '#8E0A0A'; g.fillRect(10, 2, 1, 9); g.fillRect(4, 10, 8, 1);
  g.fillStyle = '#E10600'; g.fillRect(10, 11, 1, 2);                // drip
  g.fillStyle = '#E9D3A8'; g.fillRect(7, 11, 2, 4);                 // stick
}

const BAT_A = ['XX.........XX', 'XXX.X...X.XXX', 'XXXXXXXXXXXXX', '.XXXXXXXXXXX.', '..XX.XXX.XX..', '...X.....X...'];
const BAT_B = ['....X...X....', '....XXXXX....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXX.XXXXX.XXX', 'XX.........XX'];

function drawBatFrame(g, rows, ox, oy, color, eyeRow) {
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c !== 'X') return;
    g.fillStyle = y === eyeRow && (x === 5 || x === 7) ? '#FF3B3B' : color;
    g.fillRect(ox + x, oy + y, 1, 1);
  }));
}

function drawStick(g) {
  g.save();
  g.translate(2, 2);
  g.fillStyle = '#E10600'; g.fillRect(4, 0, 4, 4);
  g.fillStyle = '#ffffff'; g.fillRect(5, 1, 2, 2); g.fillRect(5, 4, 2, 1);
  g.fillStyle = '#9a9aa4'; g.fillRect(5, 5, 2, 7);
  g.fillStyle = '#ffffff'; g.fillRect(1, 1, 1, 1); g.fillRect(10, 2, 1, 1);
  g.fillStyle = '#E10600'; g.fillRect(1, 5, 1, 1); g.fillRect(10, 6, 1, 1);
  g.restore();
}

/** Draws an item on a 16×16 canvas context. 'roll' cycles through all of them. */
export function drawItemIcon(g, kind) {
  g.clearRect(0, 0, 16, 16);
  if (!kind) return;
  if (kind === 'roll') kind = KINDS[((performance.now() / 90) | 0) % KINDS.length];
  if (kind === 'stick') drawStick(g);
  else if (kind === 'pop') drawPop(g);
  else if (kind === 'bats') drawBatFrame(g, BAT_A, 1, 5, '#C9B6FF', 2);
  else if (kind === 'flower') drawFlower(g);
}

/** The flower on its own canvas, with a dark outline so it reads as a flower against the night (18×18). */
export function makeFlowerCanvas() {
  const c = document.createElement('canvas');
  c.width = 18; c.height = 18;
  const g = c.getContext('2d');
  const on = (x, y) => FLOWER[y] && FLOWER[y][x] === 'X';
  g.fillStyle = '#0b1328';
  for (let y = -1; y <= 16; y++) {
    for (let x = -1; x <= 16; x++) {
      if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  g.translate(1, 1);
  drawFlower(g);
  return c;
}

/** Two-frame sprite sheet (13×6 each) for the bats that fly across the screen. */
export function makeBatSheet() {
  const c = document.createElement('canvas');
  c.width = 26; c.height = 6;
  const g = c.getContext('2d');
  drawBatFrame(g, BAT_A, 0, 0, '#150a2a', 2);
  drawBatFrame(g, BAT_B, 13, 0, '#150a2a', 1);
  return c;
}
