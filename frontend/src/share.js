// Result card: a 1080×1350 image (fits Instagram, X and stories) with the race scene, position,
// driver portrait, times and the game's link, shared with the phone's share sheet.
// The card is drawn as soon as the results appear, so the SHARE tap can open the share sheet
// right away (iOS only allows it straight from the tap). Where sharing files isn't possible
// (desktop, some in-app browsers), the card opens in a window to long-press or download.
import { $, renderer, scene, camera } from './engine.js';
import { TEAMS } from './config.js';
import { TRACK } from './theme.js';
import { portraitImage, nameOf } from './dialogue.js';
import { fmt } from './hud.js';
import { TRACK_ID } from './theme.js';
import { track } from './stats.js';

const W = 1080, H = 1350;
const URL_TEXT = 'e1kart.rrriooo.com';
const LINK = 'https://e1kart.rrriooo.com';
// The next action for ENHYPEN: the live voting during the MAMA AWARDS broadcast. Until it ends the card
// reminds it; afterwards it falls back to the general call to vote. Update for the next event.
const LIVE_VOTE = { until: Date.parse('2026-11-21T00:00:00+09:00'), card: ['NOV 20 · MAMA AWARDS LIVE VOTING', 'VOTE ENHYPEN ON MNET PLUS'],
  post: 'Nov 20: vote ENHYPEN live on Mnet Plus during the MAMA AWARDS!' };
const liveVote = () => Date.now() < LIVE_VOTE.until;
const logoUrl = new URL('./assets/brand/e1-logo-pixel.png', import.meta.url).href;

let ready = null;   // { blob, file, text, url } of the last results, or null while drawing
let token = 0;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const ordinal = (n) => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

/** Text with a hard 1-pixel-art shadow (scaled), like the HUD. */
function text(g, s, x, y, font, color, shadow = 6, align = 'left') {
  g.font = font;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#0b0b0d';
  g.fillText(s, x + shadow, y + shadow);
  g.fillStyle = color;
  g.fillText(s, x, y);
}

/**
 * Row where the drawing is cut, at mid-leg: the belt (the longest dark run across the middle of the
 * lower body) plus 17% of its height, since bigger drawings have longer legs. Some drawings already end
 * at mid-leg, others show the feet: this way every card cuts the driver at the same point.
 */
function legCut(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let belt = -1, longest = 0;
  for (let y = Math.round(h * 0.67); y < h; y++) {
    let run = 0;
    for (let x = Math.round(w * 0.2); x < Math.round(w * 0.8); x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0 && d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) {
        run++;
        if (run > longest) { longest = run; belt = y; }
      } else run = 0;
    }
  }
  if (belt < 0 || longest < w * 0.2) return h; // no belt found: the whole drawing
  return Math.min(h, belt + Math.round(belt * 0.17));
}

async function drawCard(r) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const team = TEAMS[r.team], color = team.color;

  // Background: the race scene as it is now, cropped to the top of the card, then night fading in.
  g.fillStyle = '#0b0b0d';
  g.fillRect(0, 0, W, H);
  try {
    renderer.render(scene, camera);
    const src = renderer.domElement, top = 820;
    const k = Math.max(W / src.width, top / src.height);
    const sw = W / k, sh = top / k;
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, top);
  } catch (e) { /* no scene: plain night */ }
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(11,11,13,.55)');
  fade.addColorStop(0.35, 'rgba(11,11,13,.15)');
  fade.addColorStop(0.6, 'rgba(11,11,13,.92)');
  fade.addColorStop(1, '#0b0b0d');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  // team glow behind the driver
  const glow = g.createRadialGradient(780, 760, 40, 780, 760, 520);
  glow.addColorStop(0, color + 'aa');
  glow.addColorStop(1, color + '00');
  g.fillStyle = glow;
  g.fillRect(0, 200, W, 1000);

  const [logo, portrait] = await Promise.all([
    loadImage(logoUrl),
    portraitImage(r.team, r.pos === 1 ? 'win' : r.pos <= 3 ? 'podium' : 'end', 0),
  ]);

  // Logo and title
  if (logo) g.drawImage(logo, 56, 56, logo.width * 4, logo.height * 4);
  text(g, 'MAMA GRAND PRIX 2026', 60, 290, '24px "Press Start 2P"', '#ffffff', 4);

  // Driver drawing, large, cut at mid-leg by the panel (the same cut for every driver)
  if (portrait) {
    const s = Math.max(1, Math.floor(640 / portrait.naturalHeight));
    const cut = legCut(portrait);
    const pw = portrait.naturalWidth * s, ph = cut * s;
    g.drawImage(portrait, 0, 0, portrait.naturalWidth, cut, W - pw - 30, 960 - ph, pw, ph);
  }

  // Position and verdict
  text(g, ordinal(r.pos), 60, 560, '136px "Press Start 2P"', color, 10);
  text(g, r.pos === 1 ? 'YOU WIN!' : r.pos <= 3 ? 'PODIUM!' : 'FINISHED!', 64, 650, '40px "Press Start 2P"', '#ffffff', 5);

  // Panel with the details
  g.fillStyle = 'rgba(7,13,30,.92)';
  g.fillRect(40, 960, W - 80, 250);
  g.fillStyle = color;
  g.fillRect(40, 960, W - 80, 8);
  const rows = [
    ['DRIVER', nameOf(r.team) + ' · ' + team.name],
    ['TRACK', TRACK.name],
    ['TIME', fmt(r.time)],
    ['FASTEST LAP', fmt(r.best)],
  ];
  rows.forEach(([k, v], i) => {
    const y = 1030 + i * 50;
    text(g, k, 76, y, '22px "Press Start 2P"', '#7c8fc2', 0);
    text(g, v, W - 76, y + 4, '52px "VT323"', '#ffffff', 0, 'right');
  });

  // Footer: what E1 is about, the link, and a tiny signature
  if (liveVote()) {
    // a red band, like a race flag, with the date of the live voting
    g.fillStyle = '#E10600';
    g.fillRect(40, 1222, W - 80, 76);
    text(g, LIVE_VOTE.card[0], W / 2, 1253, '20px "Press Start 2P"', '#ffffff', 3, 'center');
    text(g, LIVE_VOTE.card[1], W / 2, 1285, '20px "Press Start 2P"', '#ffffff', 3, 'center');
  } else {
    text(g, 'VOTE ENHYPEN AT THE MAMA AWARDS', W / 2, 1268, '24px "Press Start 2P"', '#ffffff', 4, 'center');
  }
  text(g, URL_TEXT, W / 2, 1334, '36px "VT323"', '#9fd0ff', 0, 'center');
  text(g, 'by rrr.i.ooo', W - 24, H - 14, '22px "VT323"', '#4a5578', 0, 'right');

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

/** Called when the results appear: draws the card in the background and enables SHARE. */
export async function prepareShare(r) {
  track('race_finish', TRACK_ID + ':' + (r.pos === 1 ? 'win' : r.pos <= 3 ? 'podium' : 'finished'));
  const my = ++token;
  ready = null;
  const btn = $('share');
  btn.disabled = true;
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load('24px "Press Start 2P"'), document.fonts.load('40px "VT323"')]);
    }
    const blob = await drawCard(r);
    if (my !== token || !blob) return;
    const team = TEAMS[r.team];
    const text = (r.pos === 1 ? 'I won' : 'I finished ' + ordinal(r.pos).toLowerCase()) + ' the ' + TRACK.name.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) +
      ' with ' + nameOf(r.team) + ' (' + team.name + ') in ' + fmt(r.time) + ' 🏁 Can you beat me in E1 Kart GP? ' +
      (liveVote() ? LIVE_VOTE.post : 'Vote ENHYPEN at the MAMA AWARDS!') + ' #EMGP2026 #2026MAMAVOTE #ENHYPEN';
    ready = { blob, file: new File([blob], 'e1-kart-gp.png', { type: 'image/png' }), text, url: LINK };
    btn.disabled = false;
  } catch (e) {
    console.warn('[share] card not drawn', e);
  }
}

function showCard() {
  const url = URL.createObjectURL(ready.blob);
  const old = $('shareImg').src;
  if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
  $('shareImg').src = url;
  $('shareDl').href = url;
  $('shareView').hidden = false;
}

$('share').onclick = async () => {
  if (!ready) return;
  const data = { files: [ready.file], text: ready.text + ' ' + ready.url };
  if (navigator.canShare && navigator.canShare(data)) {
    try {
      await navigator.share(data);
      track('share', 'sheet');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // the player closed the share sheet
    }
  }
  track('share', 'window');
  showCard();
};
$('shareClose').onclick = () => { $('shareView').hidden = true; };
$('shareCopy').onclick = async () => {
  const btn = $('shareCopy'), s = ready ? ready.text + ' ' + ready.url : LINK;
  try {
    await navigator.clipboard.writeText(s);
    track('share', 'copy-link');
    btn.textContent = 'COPIED ✓';
  } catch (e) {
    btn.textContent = URL_TEXT; // no clipboard: at least show the address
  }
  setTimeout(() => { btn.textContent = 'COPY LINK'; }, 1600);
};
