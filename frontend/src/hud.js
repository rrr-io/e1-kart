// HUD: position, lap, times, item, minimap, live standings, messages and results screen.
import { $ } from './engine.js';
import { TEAMS, LAPS } from './config.js';
import { N, P, spacing } from './track.js';
import { G, player, playerProgress } from './state.js';
import { ITEM_NAMES, isReady, drawItemIcon } from './itemdefs.js';

export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 1100);
}

export function banner(txt, seconds) {
  const b = $('banner');
  b.textContent = txt;
  b.hidden = false;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { b.hidden = true; }, seconds * 1000);
}

export const fmt = (t) => {
  if (t == null) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0');
};
const suffix = (n) => (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

// ---------- Item icon (16×16 pixel) ----------
const itemCtx = $('itemC').getContext('2d');

// ---------- Minimap ----------
const MW = 112, MH = 84;
const mctx = $('mini').getContext('2d');
let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
P.forEach((v) => { bx0 = Math.min(bx0, v.x); bx1 = Math.max(bx1, v.x); bz0 = Math.min(bz0, v.z); bz1 = Math.max(bz1, v.z); });
const ms = Math.min((MW - 14) / (bx1 - bx0), (MH - 14) / (bz1 - bz0));
const mx = (x) => Math.round(MW - 7 - (x - bx0) * ms);
const mz = (z) => Math.round(MH - 7 - (z - bz0) * ms);
const trackPath = new Path2D();
P.forEach((v, i) => (i ? trackPath.lineTo(mx(v.x), mz(v.z)) : trackPath.moveTo(mx(v.x), mz(v.z))));
trackPath.closePath();

function drawMini() {
  mctx.clearRect(0, 0, MW, MH);
  mctx.lineJoin = 'round';
  mctx.strokeStyle = '#5a5a62'; mctx.lineWidth = 6; mctx.stroke(trackPath);
  mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1; mctx.setLineDash([2, 2]); mctx.stroke(trackPath); mctx.setLineDash([]);
  G.cpus.forEach((c) => { mctx.fillStyle = TEAMS[c.team].color; mctx.fillRect(mx(c.x) - 2, mz(c.z) - 2, 4, 4); });
  mctx.fillStyle = TEAMS[player.team].color;
  mctx.fillRect(mx(player.x) - 3, mz(player.z) - 3, 6, 6);
  mctx.strokeStyle = '#ffffff';
  mctx.strokeRect(mx(player.x) - 3.5, mz(player.z) - 3.5, 7, 7);
}

// ---------- Standings ----------
function ranking() {
  const list = [{ me: true, team: player.team, prog: player.finish != null ? LAPS * N + 1e6 - player.finish : playerProgress() }];
  G.cpus.forEach((c) => list.push({ me: false, team: c.team, prog: c.finish != null ? LAPS * N + 1e6 - c.finish : c.prog }));
  list.sort((a, b) => b.prog - a.prog);
  return list;
}

/** The player's current position (1 = in the lead). */
export const playerPosition = () => ranking().findIndex((e) => e.me) + 1;

const row = (cls, cells) => '<div class="' + cls + '">' + cells + '</div>';

let standT = 0, lastStand = '';
export function updateHud(dt) {
  const r = ranking();
  const pos = r.findIndex((e) => e.me) + 1;
  $('posN').textContent = pos;
  $('posS').textContent = suffix(pos);
  $('lap').textContent = 'LAP ' + Math.max(1, Math.min(LAPS, player.laps + 1)) + '/' + LAPS;
  $('time').textContent = fmt(G.raceT);
  $('best').textContent = 'BEST ' + fmt(G.bestLap);
  $('spd').textContent = Math.round(player.v * 4);
  drawItemIcon(itemCtx, player.item);
  const ready = isReady(player.item);
  $('itemName').hidden = !ready;
  if (ready) $('itemName').textContent = ITEM_NAMES[player.item];
  $('bI').classList.toggle('on', ready);

  standT -= dt;
  if (standT <= 0) {
    standT = 0.25;
    const html = r.map((e, k) => row(e.me ? 'me' : '',
      '<span class="n">' + (k + 1) + '</span><span class="chip" style="background:' + TEAMS[e.team].color + '"></span><span>' + TEAMS[e.team].name + '</span>')).join('');
    if (html !== lastStand) { $('stand').innerHTML = html; lastStand = html; }
  }
  drawMini();
}

export function showResults() {
  const rows = [{ me: true, team: player.team, t: player.finish }];
  // For anyone who hasn't finished yet, the time is estimated from the remaining distance.
  G.cpus.forEach((c) => rows.push({
    me: false, team: c.team,
    t: c.finish != null ? c.finish : G.raceT + (LAPS * N - c.prog) / ((c.speed || 30) / spacing),
  }));
  rows.sort((a, b) => a.t - b.t);
  const w = rows[0].t;
  $('resList').innerHTML = rows.map((e, k) => row(e.me ? 'me' : '',
    '<span class="p">' + (k + 1) + '</span><span class="chip" style="background:' + TEAMS[e.team].color + '"></span><span class="nm">' + TEAMS[e.team].name +
    '</span><span class="t">' + (k ? '+' + (e.t - w).toFixed(2) : fmt(e.t)) + '</span>')).join('');
  $('resBest').textContent = 'Fastest lap: ' + fmt(G.bestLap);
  $('results').hidden = false;
  $('controls').hidden = true;
}
