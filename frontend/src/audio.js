// Music and sound effects with Web Audio.
// Race music comes from audio files (public/music): each track has an intro that flows into a seamless loop,
// and a final-lap version of the same loop, 8% faster. The countdown, boost, pickup and final-lap sounds are files too.
// The menu tune, the finish jingle and the other effects are chiptune, synthesised with square / triangle
// oscillators and a noise channel like an 8-bit console. The chiptune race tunes are a fallback when the files
// can't be loaded (e.g. offline before they were ever cached).
// Browsers only allow sound after a tap, so the context starts on the first pointer/key press.
import { settings, saveSettings } from './config.js';
import { TRACK_ID } from './theme.js';

const MUSIC_GAIN = 0.55;
let ctx = null, master = null, musicBus = null, sfxBus = null, trackBus = null, noiseBuf = null;
const waves = {};

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function freq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
}

// ---------- Songs ----------
// Each bar is 16 steps (sixteenth notes). Tokens: a note (A4, C#5), '.' rest, '-' hold the previous note.
// Drums: k kick, s snare, h hat, x kick+hat, o open hat, t hat roll (two 32nds), r riser (one bar of rising noise).
// Dark and charged, in the spirit of ENHYPEN's vampire concept: harmonic minor (the raised 7th gives the gothic edge),
// four-on-the-floor drops, rolling octave bass, snare-roll build-ups. All melodies are original.
const bars = (...b) => b.map((s) => s.trim().split(/\s+/));
const rep = (n, ...b) => Array.from({ length: n }, () => bars(...b)).flat();
const cat = (...parts) => parts.flat();

// Drum patterns shared by the tracks.
const D = {
  build1: 's . . . s . . . s . . . s . . .',
  build2: 's . s . s . s . s . s . s . s .',
  build3: 's s s s s s s s s s s s s s s s',
  build4: 'r s s s s s s s s s s s . . . .',
  drop: 'x . h t s . h . x . h t s . h o',
  dropFill: 'x . h t s . h . x . s s s s s s',
  half: 'k . h . h . h t s . h . h t h .',
  halfFill: 'k . h . h . h t s . h . s s s s',
};

const SONGS = {
  // Menu: "Countdown", 140 bpm, A harmonic minor. Clock ticks over a 3-3-2 bass ostinato build the tension,
  // a snare roll and riser lead into a beat drop: driving drums, rolling octave bass and the hook.
  menu: {
    bpm: 140,
    lead: bars(
      'A4 - - - - - - - - - - - C5 - B4 -',
      'A4 - - - - - - - E4 - - - - - - -',
      'F4 - - - - - - - - - - - A4 - C5 -',
      'D5 - - - - - - - C5 - - - - - - -',
      'D5 - - - - - - - - - - - F5 - E5 -',
      'D5 - - - - - - - A4 - - - - - - -',
      'G#4 - - - B4 - - - D5 - - - E5 - - -',
      'F5 - - - E5 - - - D5 - - - B4 - G#4 -',
      'A5 . A5 . C6 . A5 . E6 - - . D6 . C6 .',
      'B5 . C6 . B5 . A5 . G#5 - - . E5 . . .',
      'A5 . A5 . C6 . A5 . F6 - - . E6 . D6 .',
      'C6 . D6 . C6 . A5 . C6 - - . E6 . . .',
      'F6 . E6 . D6 . A5 . D6 . E6 . F6 . A6 .',
      'F6 - - . E6 - - . D6 . C6 . A5 . . .',
      'G#5 . B5 . E6 . G#6 . B6 - - . A6 . G#6 .',
      'E6 - - . D6 - - . B5 . G#5 . E5 . . .'),
    lead2: bars(
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      'B4 - - - D5 - - - F5 - - - G#5 - - -',
      'A5 - - - G#5 - - - F5 - - - E5 - - -',
      'A4 . A4 . C5 . A4 . E5 - - . D5 . C5 .',
      'B4 . C5 . B4 . A4 . G#4 - - . E4 . . .',
      'A4 . A4 . C5 . A4 . F5 - - . E5 . D5 .',
      'C5 . D5 . C5 . A4 . C5 - - . E5 . . .',
      'F5 . E5 . D5 . A4 . D5 . E5 . F5 . A5 .',
      'F5 - - . E5 - - . D5 . C5 . A4 . . .',
      'G#4 . B4 . E5 . G#5 . B5 - - . A5 . G#5 .',
      'E5 - - . D5 - - . B4 . G#4 . E4 . . .'),
    arp: bars(
      'E6 . . . A5 . . . E6 . . . A5 . . .',
      'E6 . . . A5 . . . E6 . . . A5 . . .',
      'F6 . . . A5 . . . F6 . . . A5 . . .',
      'F6 . . . A5 . . . F6 . . . A5 . . .',
      'F6 . . . D5 . . . F6 . . . D5 . . .',
      'F6 . . . D5 . . . F6 . . . D5 . . .',
      'E6 . . . G#5 . . . E6 . . . G#5 . . .',
      'E6 . . . G#5 . . . E6 . . . G#5 . . .',
      'A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5',
      'A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5',
      'F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4',
      'F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4',
      'D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 F4',
      'D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 F4 D4 F4 A4 F4',
      'E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4',
      'E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4'),
    bass: bars(
      'A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A2',
      'A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A1 A1 A2 A2',
      'F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F2',
      'F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F1 F1 F2 F2',
      'D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D3',
      'D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D2 D2 D3 D3',
      'E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E2',
      'E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E1 E1 E2 E2',
      'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2',
      'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2',
      'F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2',
      'F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2',
      'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3',
      'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3',
      'E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2',
      'E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2'),
    drums: bars(
      'k . . . . . h . k . . . . . h .',
      'k . . . . . h . k . . . . . h .',
      'k . h . s . h . k . h . s . h .',
      'k . h . s . h . k . h . s . h .',
      'x . h t s . h . x . h t s . h t',
      'x . h t s . h . x . h t s . h t',
      'x . s . x . s . x . s . s s s s',
      'r s s s s s s s s s s s s s . .',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . h x s . h o',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . h x s . h t',
      'x . h x s . h . x . s s s s s s'),
  },

  // Backup menu tune (not used): bouncy and playful, F major (I-V-vi-IV), staccato hook, bubbly arpeggios,
  // octave-hopping bass. To use it, call wantMusic('menuPlayful') instead of wantMusic('menu') in menu.js.
  menuPlayful: {
    bpm: 128,
    lead: bars(
      'C5 . F5 . A5 . G5 F5 . . A5 . C6 - . .',
      'G5 . E5 . C5 . E5 G5 . . C6 . G5 - . .',
      'A5 . F5 . D5 . F5 A5 . . D6 . C6 . A5 .',
      'A#5 - A5 - G5 - F5 - G5 . A5 . C6 - - -',
      'C6 . A5 . C6 . A5 . F5 . G5 . A5 . C6 .',
      'D6 . C6 . G5 . E5 . G5 - - - . . . .',
      'F5 . A5 . D6 . A5 . F5 . A5 . D6 . E6 .',
      'F6 - - . E6 - - . D6 . C6 . A#5 . G5 .'),
    lead2: bars(
      '. . . . . . . . . . F6 . . . . .',
      '. . . . . . . . . . E6 . . . . .',
      '. . . . . . . . . . F6 . . . . .',
      '. . . . . . . . . . . . E6 . F6 .',
      'A5 . F5 . A5 . F5 . C5 . E5 . F5 . A5 .',
      'G5 . E5 . C5 . C5 . E5 - - - . . . .',
      'D5 . F5 . A5 . F5 . D5 . F5 . A5 . C6 .',
      'D6 - - . C6 - - . A#5 . A5 . G5 . E5 .'),
    arp: rep(2,
      'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4',
      'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4',
      'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4',
      'A#3 D4 F4 A#4 F4 D4 A#3 D4 C4 E4 G4 C5 G4 E4 C4 E4'),
    bass: rep(2,
      'F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .',
      'C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 .',
      'D2 . D3 . D2 . D3 . D2 . D3 . D2 . D3 .',
      'A#1 . A#2 . A#1 . A#2 . C2 . C3 . C2 . E2 .'),
    drums: rep(2,
      'x . h . s . h . x . h x s . h .',
      'x . h . s . h . x . h x s . h o',
      'x . h . s . h . x . h x s . h .',
      'x . h . s . h . x . s . s s s s'),
  },

  // Night Circuit: A harmonic minor, 158 bpm. Build-up, then an 8-bar drop with the hook.
  night: {
    bpm: 158,
    lead: cat(
      rep(1, '. . . . . . . . . . . . . . . .',
        '. . . . . . . . . . . . . . . .',
        'E5 - - . E5 - . . E5 - . . E5 . E5 .',
        'G#5 - - . G#5 - . . B5 - - - - - - -'),
      rep(2,
        'A5 - - E5 - - A5 - C6 - B5 - A5 - G#5 -',
        'A5 - - - F5 - - - E5 - F5 - A5 - C6 -',
        'D6 - - A5 - - D6 - F6 - E6 - D6 - C6 -',
        'B5 - - G#5 - - E5 - G#5 - B5 - E6 - - -'),
      rep(1, 'A5 - - - - - - - . . . . E5 . A5 .',
        'F5 - - - - - - - . . . . C5 . F5 .',
        'D5 - - - - - - - . . . . F5 . A5 .',
        'G#5 - - - - - - - B5 - - - E6 - - -')),
    lead2: cat(
      rep(1, '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .',
        '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'),
      rep(2,
        'A4 - - E4 - - A4 - C5 - B4 - A4 - G#4 -',
        'A4 - - - F4 - - - E4 - F4 - A4 - C5 -',
        'D5 - - A4 - - D5 - F5 - E5 - D5 - C5 -',
        'B4 - - G#4 - - E4 - G#4 - B4 - E5 - - -'),
      rep(1, '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .',
        '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .')),
    arp: rep(4,
      'A4 C5 E5 A5 E5 C5 A4 C5 E5 A5 E5 C5 A4 C5 E5 C5',
      'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 C5 A4 F4 A4 C5 A4',
      'D4 F4 A4 D5 A4 F4 D4 F4 A4 D5 A4 F4 D4 F4 A4 F4',
      'E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 E5 B4 G#4 E4 G#4 B4 G#4'),
    bass: cat(
      rep(1, 'A1 - - - - - - - - - - - - - - -', 'F1 - - - - - - - - - - - - - - -',
        'E1 . E1 . E1 . E1 . E1 . E1 . E1 . E1 .', 'E1 E1 E1 E1 E1 E1 E1 E1 E1 E1 E1 E1 . . . .'),
      rep(3,
        'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 G1 G2',
        'F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2',
        'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3',
        'E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 G#1 G#2 B1 B2')),
    drums: cat(
      bars(D.build1, D.build2, D.build3, D.build4),
      rep(2, D.drop, D.drop, D.drop, D.dropFill),
      bars(D.half, D.half, D.half, D.build4)),
  },

  // Interstellar: D harmonic minor, 146 bpm, epic and soaring — the road to the Daesang.
  space: {
    bpm: 146,
    lead: cat(
      rep(1, 'D5 - - - - - - - - - - - - - - -', 'A#4 - - - - - - - - - - - - - - -',
        'G4 - - - - - - - A4 - - - C#5 - - -', 'E5 - - - - - - - A5 - - - - - - -'),
      rep(2,
        'D6 - - - A5 - - - F5 - - - A5 - D6 -',
        'D6 - - - C6 - - - A#5 - - - A5 - F5 -',
        'G5 - - - A#5 - - - D6 - - - C6 - A#5 -',
        'A5 - - - C#6 - - - E6 - - - A6 - - -'),
      rep(1, 'F6 - - - E6 - D6 - - - A5 - - - - -', 'F6 - - - E6 - D6 - - - A#5 - - - - -',
        'G6 - - - F6 - E6 - - - D6 - - - C#6 -', 'D6 - - - - - - - - - - - - - - -')),
    lead2: cat(
      rep(1, 'A4 - - - - - - - - - - - - - - -', 'F4 - - - - - - - - - - - - - - -',
        'D4 - - - - - - - E4 - - - A4 - - -', 'C#5 - - - - - - - E5 - - - - - - -'),
      rep(2,
        'A5 - - - F5 - - - D5 - - - F5 - A5 -',
        'A#5 - - - A5 - - - F5 - - - D5 - D5 -',
        'D5 - - - G5 - - - A#5 - - - A5 - G5 -',
        'E5 - - - A5 - - - C#6 - - - E6 - - -'),
      rep(1, 'D6 - - - C6 - A5 - - - F5 - - - - -', 'D6 - - - C6 - A#5 - - - F5 - - - - -',
        'D6 - - - D6 - C#6 - - - A5 - - - A5 -', 'A5 - - - - - - - - - - - - - - -')),
    arp: rep(4,
      'D4 F4 A4 D5 F5 D5 A4 F4 D4 F4 A4 D5 F5 D5 A4 F4',
      'A#3 D4 F4 A#4 D5 A#4 F4 D4 A#3 D4 F4 A#4 D5 A#4 F4 D4',
      'G3 A#3 D4 G4 A#4 G4 D4 A#3 G3 A#3 D4 G4 A#4 G4 D4 A#3',
      'A3 C#4 E4 A4 C#5 A4 E4 C#4 A3 C#4 E4 A4 C#5 A4 E4 C#4'),
    bass: cat(
      rep(1, 'D2 - - - - - - - - - - - - - - -', 'A#1 - - - - - - - - - - - - - - -',
        'G1 - - - - - - - - - - - - - - -', 'A1 . A1 . A1 . A1 . A1 A1 A1 A1 . . . .'),
      rep(3,
        'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3',
        'A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2',
        'G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2 G1 G2',
        'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 C#2 C#3 E2 E3')),
    drums: cat(
      bars(D.half, D.half, D.build2, D.build4),
      rep(2, D.drop, D.drop, D.drop, D.dropFill),
      bars(D.drop, D.drop, D.build3, D.build4)),
  },

  // Finish: a short fanfare, not looped.
  finish: {
    bpm: 150, loop: false,
    lead: bars('A5 . A5 . A5 . C6 - - - B5 . C6 - - -', 'E6 - - - - - - - - - - - . . . .'),
    lead2: bars('E5 . E5 . E5 . A5 - - - G#5 . A5 - - -', 'C#6 - - - - - - - - - - - . . . .'),
    arp: bars('A4 C5 E5 A5 A4 C5 E5 A5 F4 A4 C5 F5 E4 G#4 B4 E5', 'A4 C#5 E5 A5 C#6 E6 A6 - - - - - . . . .'),
    bass: bars('A1 - A2 - A1 - A2 - F1 - F2 - E1 - E2 -', 'A1 - - - - - - - - - - - . . . .'),
    drums: bars('x . h . s . h . x . h . s s s s', 'x . . . o . . . . . . . . . . .'),
  },
};

// ---------- Synth ----------
function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = settings.sound ? 0.5 : 0;
  // A compressor glues the mix and makes it louder, like a mastered track.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_GAIN; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  trackBus = ctx.createGain(); trackBus.gain.value = 0.9; trackBus.connect(master);
  // Pulse waves with NES-like duty cycles.
  [['p12', 0.125], ['p25', 0.25], ['p50', 0.5]].forEach(([k, d]) => {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * d);
    waves[k] = ctx.createPeriodicWave(re, im);
  });
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  Object.keys(FILE_SFX).forEach((k) => decode(k).then((b) => { if (b) sfxBufs[k] = b; }));
  return ctx;
}

function tone(bus, wave, f, t, dur, vol, slideTo, detune = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (waves[wave]) o.setPeriodicWave(waves[wave]); else o.type = wave;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.03));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(bus, t, dur, vol, hp) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

// One bar of white noise sweeping up, before a drop.
function riser(t, dur) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = 'bandpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
  g.gain.setValueAtTime(0.02, t); g.gain.linearRampToValueAtTime(0.22, t + dur * 0.95); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f); f.connect(g); g.connect(musicBus);
  src.start(t); src.stop(t + dur + 0.02);
}

function drum(c, t) {
  if (c === 'k' || c === 'x') { tone(musicBus, 'sine', 160, t, 0.16, 1, 38); noise(musicBus, t, 0.015, 0.25, 2000); }
  if (c === 'h' || c === 'x') noise(musicBus, t, 0.04, 0.18, 7000);
  if (c === 'o') noise(musicBus, t, 0.16, 0.16, 6000);
  if (c === 't') { const h = 60 / (song.bpm * tempo) / 8; noise(musicBus, t, 0.03, 0.15, 8000); noise(musicBus, t + h, 0.03, 0.12, 8000); }
  if (c === 'r') riser(t, 60 / (song.bpm * tempo) * 4);
  if (c === 's') { noise(musicBus, t, 0.14, 0.35, 1800); tone(musicBus, 'triangle', 220, t, 0.06, 0.25, 120); }
}

// ---------- Sequencer (look-ahead scheduling) ----------
// [part, wave, volume, detune in cents]. The lead is doubled with a detuned copy for a fat, supersaw-like sound.
const VOICES = [
  ['lead', 'p25', 0.13, -9], ['lead', 'p12', 0.08, 9], ['lead2', 'p50', 0.07, 0],
  ['arp', 'p12', 0.05, 0], ['bass', 'triangle', 0.36, 0], ['bass', 'p50', 0.05, 0],
];
let song = null, songName = '', step = 0, nextT = 0, timer = null, tempo = 1;

function lengthAt(part, bar, i) {
  let n = 1;
  for (let j = i + 1; j < 16 && part[bar][j] === '-'; j++) n++;
  return n;
}

function schedule() {
  if (!song) return;
  const sp = 60 / (song.bpm * tempo) / 4;
  const total = Math.max(...['lead', 'lead2', 'arp', 'bass', 'drums'].map((k) => (song[k] || []).length)) * 16;
  while (nextT < ctx.currentTime + 0.12) {
    if (song.loop === false && step >= total) { stopMusic(); return; }
    const s = step % total;
    VOICES.forEach(([k, wave, vol, det]) => {
      const part = song[k];
      if (!part) return;
      const bar = Math.floor(s / 16) % part.length, i = s % 16, tok = part[bar][i];
      if (tok && tok !== '.' && tok !== '-') tone(musicBus, wave, freq(tok), nextT, sp * lengthAt(part, bar, i) * 0.95, vol, 0, det);
    });
    const dpart = song.drums, db = Math.floor(s / 16) % dpart.length, dt = dpart[db][s % 16];
    if (dt && dt !== '.') drum(dt, nextT);
    step++;
    nextT += sp;
  }
}

/** Plays a song by name ('menu', 'night', 'space', 'finish'); the same song keeps playing. */
export function playMusic(name) {
  if (!SONGS[name]) return;
  if (name === songName && song) return;
  stopMusic();
  stopRace();
  songName = name;
  if (!ensure()) return;
  fadeTok++; // cancel a fade-out still in progress
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(MUSIC_GAIN, ctx.currentTime);
  song = SONGS[name]; step = 0; tempo = 1;
  nextT = ctx.currentTime + 0.06;
  timer = setInterval(schedule, 25);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null; song = null; songName = '';
}

/** Final lap: the music speeds up a little (the race files switch to their faster final-lap version). */
export function setTempo(k) {
  tempo = k;
  if (k > 1) toFinal();
}

// ---------- Race music from files ----------
// Times in seconds inside each file, found by analysing the audio:
// race.loop is the seamless loop region (the intro plays once before it), race.gara0 is where time 0 of the
// original race loop falls in the race file, final.loop is the final-lap loop region. The final-lap file is the
// same music 8% faster, so a position p in the race loop is position p / ratio in the final-lap file.
const TRACK_MUSIC = {
  night: {
    race: { len: 90.66196, intro: 37.15419, gara0: 30.55596, loop: [42.35921, 90.16196] },
    final: { len: 55.69073, loop: [10.92894, 55.19074] },
    ratio: 1.08,
  },
  space: {
    race: { len: 108.0834, intro: 26.241, gara0: 21.3444, loop: [58.60804, 107.5834] },
    final: { len: 80.35092, loop: [34.50192, 79.85093] },
    ratio: 1.08,
  },
};
// Bloody Paradise races to the Night Circuit music for now (same files, same loop points).
TRACK_MUSIC.bloody = { ...TRACK_MUSIC.night, file: 'night' };
SONGS.bloody = SONGS.night;
/** File name prefix of a track's race music: its own id unless it borrows another track's music. */
const fileOf = (id) => (TRACK_MUSIC[id] && TRACK_MUSIC[id].file) || id;
const FILE_SFX = { countdown: 'countdown', boost: 'boost', pickup: 'pickup', finalLap: 'final-lap' };

const raw = {}, decoded = {}, sfxBufs = {};
function fetchFile(name) {
  if (!raw[name]) {
    raw[name] = fetch('/music/' + name + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  }
  return raw[name];
}
function decode(key) {
  const name = FILE_SFX[key] || key;
  if (!decoded[name]) {
    decoded[name] = fetchFile(name).then((ab) => ab && new Promise((res) => {
      // Callback form: older Safari doesn't return a promise.
      try { ctx.decodeAudioData(ab, res, () => res(null)); } catch (e) { res(null); }
    }));
  }
  return decoded[name];
}
// Download the current track's music in the background soon after the game opens.
if (TRACK_MUSIC[TRACK_ID]) {
  setTimeout(() => {
    fetchFile(fileOf(TRACK_ID) + '-race');
    fetchFile(fileOf(TRACK_ID) + '-final');
    Object.values(FILE_SFX).forEach(fetchFile);
  }, 1500);
}

// Some decoders keep the MP3 encoder delay (about 23 ms of silence) at the start; shift the loop points to match.
function gapShift(buf, len) {
  const extra = buf.duration - len;
  return extra > 0.005 ? Math.min(extra, 0.03) : 0;
}

let race = null, raceId = '', raceToken = 0;
function position(p) {
  const [a, b] = p.meta.loop;
  let pos = ctx.currentTime - p.t0;
  if (pos >= b) pos = a + ((pos - a) % (b - a));
  return pos;
}
function startSource(which, buf, meta, offset, fade) {
  const src = ctx.createBufferSource(), g = ctx.createGain(), sh = gapShift(buf, meta.len);
  const [a, b] = meta.loop;
  if (offset >= b) offset = a + ((offset - a) % (b - a));
  src.buffer = buf;
  src.loop = true; src.loopStart = a + sh; src.loopEnd = b + sh;
  src.connect(g); g.connect(trackBus);
  const t = ctx.currentTime + 0.03;
  if (fade) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade); }
  src.start(t, offset + sh);
  return { which, src, g, meta, t0: t - offset };
}
function fadeOut(p, sec) {
  const t = ctx.currentTime;
  p.g.gain.cancelScheduledValues(t);
  p.g.gain.setValueAtTime(p.g.gain.value, t);
  p.g.gain.linearRampToValueAtTime(0, t + sec);
  try { p.src.stop(t + sec + 0.05); } catch (e) { /* already stopped */ }
}
function stopRace() {
  raceToken++;
  if (race) fadeOut(race, 0.3);
  race = null; raceId = '';
}

/** Starts the race music of a track from the beginning of its intro. */
function playRace(id) {
  stopMusic();
  stopRace();
  if (!ensure()) return;
  const token = raceToken, asked = ctx.currentTime, m = TRACK_MUSIC[id];
  raceId = id; songName = id;
  decode(fileOf(id) + '-final');
  decode(fileOf(id) + '-race').then((buf) => {
    if (token !== raceToken) return;
    if (!buf) { console.warn('[audio] race music not loaded, using chiptune'); raceId = ''; songName = ''; playMusic(id); return; }
    // If loading took a while, start where the music would be by now.
    race = startSource('race', buf, m.race, Math.max(0, ctx.currentTime - asked), 0);
  });
}

// Final lap: crossfade to the faster version at the same point of the song, so the beat carries on.
function toFinal() {
  if (!race || race.which !== 'race') return;
  const token = raceToken, m = TRACK_MUSIC[raceId];
  decode(fileOf(raceId) + '-final').then((buf) => {
    if (!buf || token !== raceToken || !race || race.which !== 'race') return;
    const pos = position(race);
    const u = pos < m.race.intro ? 0 : (pos - m.race.gara0) / m.ratio;
    const old = race;
    race = startSource('final', buf, m.final, u, 0.25);
    fadeOut(old, 0.25);
  });
}

// At the finish the race music drops to the background for the results.
function finishRace() {
  if (!race) return;
  const t = ctx.currentTime;
  race.g.gain.cancelScheduledValues(t);
  race.g.gain.setValueAtTime(race.g.gain.value, t);
  race.g.gain.linearRampToValueAtTime(0.35, t + 1.2);
}

// ---------- Sound effects ----------
const SFX = {
  count: (t) => tone(sfxBus, 'p50', 440, t, 0.14, 0.25),
  go: (t) => tone(sfxBus, 'p50', 880, t, 0.4, 0.25),
  boost: (t) => { noise(sfxBus, t, 0.35, 0.25, 900); tone(sfxBus, 'p25', 220, t, 0.3, 0.12, 880); },
  turbo: (t) => tone(sfxBus, 'p25', 330, t, 0.22, 0.14, 1320),
  pickup: (t) => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(sfxBus, 'p12', freq(n), t + i * 0.045, 0.06, 0.16)),
  item: (t) => tone(sfxBus, 'p25', 660, t, 0.12, 0.18, 990),
  slip: (t) => tone(sfxBus, 'p50', 700, t, 0.5, 0.18, 110),
  bats: (t) => { for (let i = 0; i < 5; i++) tone(sfxBus, 'p12', 1200 - i * 90, t + i * 0.06, 0.05, 0.12); },
  lap: (t) => ['E5', 'A5'].forEach((n, i) => tone(sfxBus, 'p50', freq(n), t + i * 0.1, 0.12, 0.18)),
};

// Effects that use a file when it's loaded: [file, volume, playback rate]. The rest stay chiptune.
const SFX_FILES = {
  countdown: ['countdown', 0.9, 1],
  boost: ['boost', 0.9, 1],
  turbo: ['boost', 0.6, 1.25],
  pickup: ['pickup', 0.8, 1],
  finalLap: ['finalLap', 0.9, 1],
};
export function sfx(name) {
  if (!ctx || !settings.sound) return;
  // The countdown file already says 3-2-1-GO in time with the start lights.
  if ((name === 'count' || name === 'go') && sfxBufs.countdown) return;
  const f = SFX_FILES[name], buf = f && sfxBufs[f[0]];
  if (buf) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = f[2]; g.gain.value = f[1];
    src.connect(g); g.connect(sfxBus);
    src.start(ctx.currentTime + 0.01);
    return;
  }
  const fn = SFX[name] || (name === 'finalLap' && SFX.lap);
  if (fn) fn(ctx.currentTime + 0.01);
}

// ---------- On/off ----------
export function setSound(on) {
  settings.sound = on;
  saveSettings();
  if (ctx) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
  if (on) playbackSession();
  else {
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* not supported */ }
    if (keepAlive) keepAlive.pause();
  }
}

// The first tap or key press unlocks audio (browser rule) and starts the music that should be playing.
let wanted = 'menu', current = '';
let fadeTok = 0;
function start(name) {
  current = name;
  if (!name) { stopMusic(); stopRace(); }
  else if (TRACK_MUSIC[name]) playRace(name);
  else if (name === 'finish' && raceId) finishRace();
  else playMusic(name);
}
function resume() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}
/** Fades out whatever music is playing (chiptune or race file) over `sec` seconds, then stays silent. */
export function fadeOutMusic(sec = 0.7) {
  wanted = ''; current = '';
  if (!ctx) return;
  if (race) { fadeOut(race, sec); race = null; raceId = ''; raceToken++; }
  if (!song) return;
  const t = ctx.currentTime, tok = ++fadeTok;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(0, t + sec);
  setTimeout(() => {
    if (tok !== fadeTok) return;
    stopMusic();
    // Notes already scheduled ahead are still silent; then the bus is ready for the next tune.
    musicBus.gain.setValueAtTime(MUSIC_GAIN, ctx.currentTime + 0.2);
  }, sec * 1000 + 30);
}
/** Decodes a track's race music ahead of time, so it starts right on the GO. */
export function prepareMusic(id) {
  if (ctx && TRACK_MUSIC[id]) { decode(fileOf(id) + '-race'); decode(fileOf(id) + '-final'); }
}
/** Asks for a piece of music: 'menu', a track id (race music from its intro), 'finish', or '' for silence. */
export function wantMusic(name) {
  wanted = name;
  // Start it even if the audio is still locked: it is scheduled and plays as soon as the first tap unlocks it.
  if (ctx) start(name);
}
// 0.1 s of silence (8 kHz, 8-bit WAV), built here so there's no file to download.
function silence() {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
// iPhone: with the ring/silent switch on silent, iOS mutes Web Audio (games included) unless the page says it
// plays media. iOS 17+: audioSession 'playback'. Older iOS: a silent <audio> loop puts the page in the same mode.
// Only with the sound on: 'playback' also pauses other apps' music, so with the sound off the game stays 'ambient'.
let keepAlive = null;
function playbackSession() {
  if (!settings.sound) return;
  try {
    if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
  } catch (e) { /* not supported */ }
  if (!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
  if (!keepAlive) {
    keepAlive = new Audio(silence());
    keepAlive.loop = true;
    keepAlive.setAttribute('playsinline', '');
    keepAlive.setAttribute('x-webkit-airplay', 'deny');
  }
  if (keepAlive.paused) keepAlive.play().catch(() => {});
}
function unlock() {
  playbackSession();
  if (!ensure()) return;
  resume();
  if (current !== wanted) start(wanted);
}
// On phones a touch only counts as a user gesture when the finger lifts (touchend / pointerup / click),
// so listen to those as well as the first contact.
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
// Pause when the app goes to the background.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) {
    ctx.suspend().catch(() => {});
    if (keepAlive) keepAlive.pause();
  } else {
    resume();
    if (keepAlive && settings.sound) keepAlive.play().catch(() => {});
  }
});
