// Real-time multiplayer: up to six friends in a room with a code (server: RoomService on /api/mp).
// Whoever creates the room picks the track; every player needs a different team; the free teams are CPU karts.
// The races don't count for the standings.
//
// Each game drives its own kart and sends its state ~15 times a second; the host also drives the CPU karts and
// sends theirs. The other karts are drawn slightly in the past (INTERP), between the last two states received.
// Items that touch other karts travel as events: a popsicle dropped on the track, a bat swarm released.
import { $ } from './engine.js';
import { TEAMS, settings, saveSettings } from './config.js';
import { TRACKS, TRACK, TRACK_ID } from './theme.js';
import { G, MP, player, playerProgress } from './state.js';
import { spacing } from './track.js';
import { paintKart } from './kart.js';
import { setupRace } from './race.js';
import { banner, toast, showResults } from './hud.js';
import { netEvent } from './items.js';
import { openTrackBox, closeTrackBox } from './trackpick.js';
import { mvUnlocked, openMvGate, useMvRace } from './mvgate.js';
import { nameOf, drawPortrait, portraitImage } from './dialogue.js';
import { sfx } from './audio.js';
import { SLIP_T } from './itemdefs.js';
import { track } from './stats.js';
import { liveOn } from './campaign.js';
import { toMenu } from './menu.js';
import { setGarage, showGarage } from './garage.js';

// Before going live the MULTIPLAYER button shows only on devices that opened the preview link (?preview=mp,
// ?preview=off hides it again) or an invite link. Set MP_PUBLIC to true to show it to everyone.
const MP_PUBLIC = false;
const PREVIEW_KEY = 'e1kart-mp-preview';

const SEND_MS = 66;      // own state, ~15 per second
const INTERP = 0.11;     // the other karts are drawn this many seconds in the past
const JOIN_FLAG = 'e1kart-mpjoin';
const ERRORS = {
  notfound: 'No room with that code. Check it and try again.',
  full: 'That room is full (6 players).',
  started: 'That room is already racing. Try again when they finish.',
  busy: 'Too many rooms right now. Try again in a minute.',
  badtrack: "This track can't be used for multiplayer.",
  team: 'That team is taken: pick a free one.',
  alone: 'Invite at least one friend: the race starts with 2 players or more.',
  teams: 'Everyone needs a team before the start.',
  offline: "Can't reach the server. Check your connection and try again.",
};

const joined = new Map();   // player id → when they joined (for the light-up animation)
let ws = null, room = null, pingT = null, sendT = 0, wantJoin = null, goResolve = null, savedButtons = null;

const inviteUrl = (code) => location.origin + '/?room=' + code;
export function inviteText(code) {
  return '🏎️ Race me in E1 Kart GP! Room code: ' + code + ' 👉 ' + inviteUrl(code) +
    (liveOn() ? '\n🗳️ Nov 20, 18:00 KST: MAMA live voting. Vote ENHYPEN on Mnet Plus!' : '');
}

// ---------- Connection ----------

function connect() {
  if (ws && ws.readyState <= 1) {
    return ws.readyState === 1 ? Promise.resolve() : new Promise((ok, ko) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('close', ko, { once: true }); });
  }
  return new Promise((ok, ko) => {
    const s = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/mp');
    ws = s;
    let opened = false;
    s.onopen = () => {
      opened = true;
      clearInterval(pingT);
      pingT = setInterval(() => send({ t: 'ping' }), 20000);
      ok();
    };
    s.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMessage(m); };
    s.onclose = () => {
      clearInterval(pingT);
      if (ws === s) ws = null;
      if (!opened) ko(new Error('offline'));
      else onDrop();
    };
  });
}

function send(o) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
}

// Kart states and race events, from the race code (items, finish line).
MP.send = (o) => { if (MP.on && room && room.state === 'race') send(o); };

function onDrop() {
  const racing = MP.on && G.state !== 'menu';
  room = null;
  MP.host = false;
  if (racing) {
    toast('CONNECTION LOST');
    G.remotes.forEach((r) => { r.left = true; });
  } else {
    leaveUi();
    if (!$('mpBox').hidden) message(ERRORS.offline, 'err');
  }
}

// ---------- Messages from the server ----------

function onMessage(m) {
  switch (m.t) {
    case 'info': return onInfo(m);
    case 'room': return onRoom(m);
    case 'intro': return onIntro();
    case 'go': if (goResolve) { goResolve(); goResolve = null; } return;
    case 's': return onState(m);
    case 'ev': { const r = remote(m.id); if (r) netEvent(m, r); return; }
    case 'fin': return onFinish(m);
    case 'left': { const r = remote(m.id); if (r) { r.left = true; r.kart.root.visible = false; } return; }
    case 'closed': room = null; return onDrop();
    case 'err': return message(ERRORS[m.e] || 'Something went wrong.', 'err');
    default: return undefined;
  }
}

function onInfo(m) {
  if (!wantJoin || m.code !== wantJoin) return;
  if (m.state !== 'lobby') { wantJoin = null; message(ERRORS.started, 'err'); return; }
  if (m.track !== TRACK_ID) {
    // The scene is built for one track: load the room's, then join after the reload.
    settings.track = m.track;
    saveSettings();
    try { sessionStorage.setItem(JOIN_FLAG, m.code); } catch { /* the player types the code again */ }
    message('Loading ' + TRACKS[m.track].name + '…');
    location.reload();
    return;
  }
  const code = wantJoin;
  withMv(() => send({ t: 'join', code, team: settings.teamIdx }));
}

function onRoom(m) {
  const first = !room;
  // Somebody new in the room: a sound, a toast, and their tile lights up (renderRoom).
  if (!first) {
    const before = new Set(room.players.map((p) => p.id));
    m.players.filter((p) => !before.has(p.id) && p.id !== m.you).forEach((p) => {
      joined.set(p.id, performance.now());
      notice('P' + (m.players.indexOf(p) + 1) + ' JOINED THE ROOM!');
      try { sfx('pickup'); } catch { /* no sound yet */ }
    });
    room.players.filter((p) => !m.players.some((q) => q.id === p.id)).forEach(() => notice('A PLAYER LEFT THE ROOM'));
    // A friend picked a driver: their tile lights up.
    m.players.forEach((p) => {
      const old = room.players.find((q) => q.id === p.id);
      if (old && old.team == null && p.team != null && p.id !== m.you) {
        joined.set(p.id, performance.now());
        notice('P' + (m.players.indexOf(p) + 1) + ' PICKED ' + nameOf(p.team) + '!');
      }
    });
  }
  room = m;
  MP.me = m.you;
  MP.host = m.host === m.you;
  wantJoin = null;
  const mine = m.players.find((p) => p.id === m.you);
  if (mine && mine.team != null && mine.team !== settings.teamIdx) {
    settings.teamIdx = mine.team;
    saveSettings();
  }
  if (first) { track('mp', MP.host ? 'create' : 'join'); message(''); }
  renderRoom();
}

function onIntro() {
  if (!room) return;
  closeBox();
  $('trackBox').hidden = true;
  MP.on = true;
  MP.roster = room.players.filter((p) => p.team != null).map((p) => ({ id: p.id, team: p.team })).sort((a, b) => a.id - b.id);
  if (TRACK.mv) useMvRace();
  raceButtons();
  sendT = 0;
  setupRace();
  track('race_start', 'mp:' + TRACK_ID + ':' + MP.roster.length);
}

// After the pre-race dialogue: tell the server, wait for everyone, then the lights.
MP.afterIntro = () => new Promise((resolve) => {
  if (!MP.on || !room) { resolve(); return; }
  goResolve = resolve;
  send({ t: 'ready' });
  banner('WAITING FOR RIVALS…', 40);
});

const remote = (id) => G.remotes.find((r) => r.id === id);

function onState(m) {
  const r = remote(m.id);
  if (!r || r.left) return;
  const now = performance.now() / 1000;
  r.buf.push({ t: now, x: m.x, z: m.z, h: m.h, v: m.v, p: m.p });
  if (r.buf.length > 12) r.buf.shift();
  r.boost = m.b ? 0.3 : 0;
  r.slip = m.sl || 0;
  r.bats = m.bt || 0;
  r.ghost = m.g || 0;
  r.pal = m.pl || 0;
  // From the host: the CPU karts.
  if (m.c && !MP.host) {
    m.c.forEach((a, k) => {
      const c = G.cpus[k];
      if (!c) return;
      c.netProg = a[0] + (a[2] / spacing) * 0.08; // a little ahead: the message took a moment to arrive
      c.netLat = a[1];
      c.speed = a[2];
      c.boost = a[3] ? 0.3 : 0;
      c.slip = a[4];
      c.bats = a[5];
      c.ghost = a[6];
      c.finish = a[7] >= 0 ? a[7] : null;
      c.pal = a[8] || 0;
    });
  }
}

function onFinish(m) {
  const r = remote(m.id);
  if (r) r.finish = m.time;
  if (!$('results').hidden) showResults();
}

// ---------- Every frame, during a multiplayer race ----------

MP.tick = (dt) => {
  if (!MP.on) return;
  const now = performance.now() / 1000;
  // Own state (and the CPU karts', from the host) while racing, and for a few seconds after the finish.
  sendT -= dt;
  const live = G.state === 'count' || G.state === 'race' || (G.state === 'done' && G.doneT < 4);
  if (live && sendT <= 0 && room && room.state === 'race') {
    sendT = SEND_MS / 1000;
    const o = {
      t: 's', x: r2(player.x), z: r2(player.z), h: r3(player.h), v: r2(player.v), p: r2(playerProgress()),
      b: player.boost > 0 ? 1 : 0, sl: r2(player.slip || 0), bt: r2(player.bats || 0), g: r2(player.ghost || 0), pl: player.pal || 0,
    };
    if (MP.host) {
      o.c = G.cpus.map((c) => [r2(c.prog), r2(c.lat), r2(c.speed || 0), c.boost > 0 ? 1 : 0, r2(c.slip || 0), r2(c.bats || 0), r2(c.ghost || 0), c.finish == null ? -1 : r2(c.finish), c.pal || 0]);
    }
    send(o);
  }
  G.remotes.forEach((r) => drawRemote(r, now - INTERP, dt));
};

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const angLerp = (a, b, t) => a + (((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

function drawRemote(r, at, dt) {
  const k = r.kart;
  if (r.left) { k.root.visible = false; return; }
  const b = r.buf;
  if (b.length) {
    let s;
    if (at <= b[0].t) s = b[0];
    else {
      let i = b.length - 1;
      while (i > 0 && b[i - 1].t > at) i--;
      const p = b[i - 1], q = b[i];
      if (p && q && at < q.t) {
        const t = (at - p.t) / Math.max(0.001, q.t - p.t);
        s = { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, h: angLerp(p.h, q.h, t), v: q.v, p: p.p + (q.p - p.p) * t };
      } else {
        // Nothing newer yet: carry on along the heading for a moment.
        const l = b[b.length - 1], e = Math.min(0.25, at - l.t);
        s = { x: l.x + Math.sin(l.h) * l.v * e, z: l.z + Math.cos(l.h) * l.v * e, h: l.h, v: l.v, p: l.p };
      }
    }
    r.x = s.x; r.z = s.z; r.h = s.h; r.v = s.v; r.prog = s.p;
  }
  k.root.visible = true;
  k.root.position.set(r.x, 0, r.z);
  k.root.rotation.y = r.h;
  if (r.slip > 0) k.body.rotation.y = (1 - r.slip / SLIP_T) * Math.PI * 4;
  else k.body.rotation.y *= 0.8;
  k.flame.visible = r.boost > 0;
  k.wheels.forEach((w) => { w.rotation.x += ((r.v || 0) * dt) / 0.45; });
  // Bumping into a friend's kart pushes ours aside (theirs is pushed on their screen).
  if (G.state === 'race') {
    const dx = r.x - player.x, dz = r.z - player.z, d2 = dx * dx + dz * dz;
    if (d2 < 5.8 && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (2.4 - d) / 2;
      player.x -= (dx / d) * push;
      player.z -= (dz / d) * push;
      player.v *= 0.985;
    }
  }
}

// ---------- Results buttons during a multiplayer session ----------

function raceButtons() {
  if (!savedButtons) savedButtons = { again: $('again').onclick, againTxt: $('again').textContent, menu: $('toMenu').onclick };
  $('again').textContent = 'LOBBY ▶';
  $('again').onclick = () => {
    // Back to the room: no longer racing (MP.on comes back with the next start), friends' karts reset by the menu.
    MP.on = false;
    G.remotes = [];
    $('results').hidden = true;
    toMenu();
    openBox();
  };
  $('toMenu').onclick = () => { leaveRoom(); toMenu(); };
}

function restoreButtons() {
  if (!savedButtons) return;
  $('again').onclick = savedButtons.again;
  $('again').textContent = savedButtons.againTxt;
  $('toMenu').onclick = savedButtons.menu;
  savedButtons = null;
}

// ---------- Lobby box ----------

// Just the face: the top of the driver's drawing (head and headset), like on the infographics.
const heads = new Map();
function headBox(img) {
  if (heads.has(img)) return heads.get(img);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  const solid = (x, y) => px[(y * w + x) * 4 + 3] > 0;
  const row = Math.round(h * 60 / 157); // the height of the ear cups
  let l = 0, r = w - 1, top = 0;
  while (l < r && !solid(l, row)) l++;
  while (r > l && !solid(r, row)) r--;
  search: for (; top < row; top++) for (let x = 0; x < w; x++) if (solid(x, top)) break search;
  const box = r - l > w / 3 ? { l, r, top } : { l: 0, r: w - 1, top: 0 };
  heads.set(img, box);
  return box;
}

function drawFace(canvas, k) {
  canvas.width = 120;
  canvas.height = 100;
  portraitImage(k, 'neutral', 0).then((img) => {
    if (!img) { drawPortrait(canvas, k, 'happy'); return; }
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    // The head filling the tile on the team colour, like the driver grid of the share cards.
    // The drawings are not all the same size, so every head is measured across the ear cups
    // and scaled to the same width, centred, with the top of the hair just under the edge.
    const { l, r, top } = headBox(img);
    const z = 92 / (r - l + 1), w = img.naturalWidth, h = img.naturalHeight;
    g.clearRect(0, 0, 120, 100);
    g.drawImage(img, Math.round(60 - (l + r + 1) / 2 * z), Math.round(4 - top * z), Math.round(w * z), Math.round(h * z));
  });
}

// A short notice at the top of the room box (a friend joined or left), or a toast during the race.
let noticeT = null;
function notice(txt) {
  if (G.state !== 'menu') { toast(txt); return; }
  const el = $('mpNotice');
  el.textContent = txt;
  el.hidden = false;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  clearTimeout(noticeT);
  noticeT = setTimeout(() => { el.hidden = true; }, 5000);
}

function message(txt, kind) {
  const el = $('mpMsg');
  el.textContent = txt || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

export function openBox() {
  $('mpBox').hidden = false;
  renderRoom();
}
function closeBox() { $('mpBox').hidden = true; showGarage(false); }

function renderRoom() {
  const inRoom = !!room;
  $('mpStartView').hidden = inRoom;
  $('mpRoomView').hidden = !inRoom;
  $('mpBox').classList.toggle('in-room', inRoom);
  renderGarage();
  if (!inRoom) return;
  $('mpRoomCode').textContent = room.code;
  $('mpTrack').textContent = TRACKS[room.track] ? TRACKS[room.track].name : room.track;
  $('mpInviteText').textContent = inviteText(room.code);
  const byTeam = new Map(room.players.filter((p) => p.team != null).map((p) => [p.team, p]));
  const hostNo = (p) => room.players.indexOf(p) + 1;
  // One tile per team with the driver's face: dark while free, lit up when a player takes it.
  $('mpTeams').replaceChildren(...TEAMS.map((t, k) => {
    const p = byTeam.get(k), mine = p && p.id === room.you;
    const b = document.createElement('button');
    const fresh = p && joined.has(p.id) && performance.now() - joined.get(p.id) < 1500;
    b.className = 'team mp-team' + (mine ? ' mine' : p ? ' taken' : ' free') + (fresh ? ' fresh' : '');
    b.style.setProperty('--tc', t.color);
    b.disabled = !!p && !mine;
    b.innerHTML = '<canvas class="face"></canvas><span class="who"></span><span class="nm"><span class="drv"></span></span>';
    drawFace(b.querySelector('.face'), k);
    b.querySelector('.who').textContent = mine ? 'YOU' : p ? 'P' + hostNo(p) + (p.id === room.host ? ' · HOST' : '') : 'FREE';
    b.querySelector('.drv').textContent = nameOf(k);
    b.title = t.name;
    b.onclick = () => {
      if (p || room.state !== 'lobby') return;
      send({ t: 'team', team: k });
      settings.teamIdx = k;
      saveSettings();
      paintKart(G.karts[0], t.color);
    };
    return b;
  }));
  const me = room.players.find((p) => p.id === room.you);
  // You and at least one friend, everyone with a team; the free teams race as CPU karts.
  const ready = room.players.length >= 2 && room.players.every((p) => p.team != null);
  $('mpCount').textContent = room.players.length + '/6 PLAYERS';
  $('mpGo').hidden = !MP.host;
  $('mpGo').disabled = !ready || room.state !== 'lobby';
  $('mpWait').hidden = MP.host;
  $('mpWait').textContent = room.state !== 'lobby' ? 'Race in progress… back here when everyone finishes.'
    : me && me.team == null ? 'Pick a free team.' : 'Waiting for the host to start…';
  if (MP.host && room.state === 'lobby') {
    message(room.players.length < 2 ? 'Invite at least one friend to start the race.' : !ready ? 'Waiting for everyone to pick a team…' : '');
  }
}

// The 3D garage behind the box (garage.js): the players' karts in open boxes, the CPU karts half hidden.
function renderGarage() {
  const humans = new Map(room ? room.players.filter((p) => p.team != null).map((p) => [p.team, p]) : []);
  setGarage(TEAMS.map((t, k) => {
    const p = humans.get(k);
    if (!room) return k === settings.teamIdx ? { state: 'you', label: 'YOU' } : { state: 'cpu', label: 'CPU' };
    if (p && p.id === room.you) return { state: 'you', label: 'YOU' };
    if (p) return { state: 'friend', label: 'P' + (room.players.indexOf(p) + 1) };
    return { state: 'cpu', label: 'CPU' };
  }));
  showGarage(!$('mpBox').hidden, false); // the room box is wide and covers the middle: front view
}

function leaveUi() {
  room = null;
  MP.on = false;
  MP.host = false;
  G.remotes.forEach((r) => { r.kart.root.visible = true; });
  G.remotes = [];
  restoreButtons();
  renderRoom();
}

export function leaveRoom() {
  send({ t: 'leave' });
  if (ws) { const s = ws; ws = null; s.onclose = null; s.close(); }
  clearInterval(pingT);
  leaveUi();
}

// Parallel World: the first minute of the MV is watched before entering a room (mvgate.js).
function withMv(fn) {
  if (TRACK.mv && !mvUnlocked()) { openMvGate(TRACK.mv, fn); return; }
  fn();
}

function createRoom() {
  openBox();
  withMv(() => {
    message('Creating the room…');
    connect().then(() => send({ t: 'create', track: TRACK_ID, team: settings.teamIdx }))
      .catch(() => message(ERRORS.offline, 'err'));
  });
}

function joinRoom(code) {
  code = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { message('Room codes have 5 letters and numbers.', 'err'); return; }
  openBox();
  message('Looking for room ' + code + '…');
  wantJoin = code;
  connect().then(() => send({ t: 'peek', code })).catch(() => { wantJoin = null; message(ERRORS.offline, 'err'); });
}

async function invite() {
  const text = inviteText(room.code);
  track('mp', 'invite');
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message('Invite copied! Paste it to your friends.', 'ok');
  } catch {
    message('Copy the code and send it: ' + room.code);
  }
}

/** After a reload for a track change (CREATE ROOM, then a different track): carries on with creating the room. */
export function resumeCreate() {
  createRoom();
}

function previewAccess() {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('preview');
    if (q === 'mp') localStorage.setItem(PREVIEW_KEY, '1');
    else if (q === 'off') localStorage.removeItem(PREVIEW_KEY);
    on = localStorage.getItem(PREVIEW_KEY) === '1';
  } catch { /* private mode: only the link opened now */ }
  return MP_PUBLIC || on;
}

export function initMp() {
  $('mpBtn').hidden = !previewAccess();
  $('mpBtn').onclick = () => { openBox(); message(''); };
  $('mpLive').hidden = !liveOn();
  $('mpClose').onclick = closeBox;
  // The track box opens in front of the garage (which stays on screen); closing it goes back to this box.
  $('mpCreate').onclick = () => {
    $('mpBox').hidden = true;
    showGarage(true, false);
    openTrackBox(() => createRoom(), 'mp');
    const back = () => { closeTrackBox(); openBox(); };
    $('trackBack').onclick = back;
    $('trackClose').onclick = back;
  };
  $('mpJoin').onclick = () => joinRoom($('mpCode').value);
  $('mpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('mpCode').value); });
  $('mpInvite').onclick = invite;
  $('mpGo').onclick = () => send({ t: 'start' });
  $('mpLeave').onclick = () => { leaveRoom(); message(''); };
  // An invite link (?room=CODE) or a reload to load the room's track: join right away.
  let code = null;
  try { code = sessionStorage.getItem(JOIN_FLAG); sessionStorage.removeItem(JOIN_FLAG); } catch { /* no storage */ }
  const q = new URLSearchParams(location.search).get('room');
  if (q) {
    code = code || q;
    try { localStorage.setItem(PREVIEW_KEY, '1'); } catch { /* fine */ }
    $('mpBtn').hidden = false;
    history.replaceState(null, '', location.pathname);
  }
  if (code) {
    $('mpCode').value = code;
    joinRoom(code);
  }
}
