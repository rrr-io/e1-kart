// The two tracks and their look. The track is chosen in the menu and applied by reloading the page,
// so every module can build its scene once, at import, for the chosen track.
import { settings } from './config.js';

export const TRACKS = {
  night: {
    name: 'NIGHT CIRCUIT',
    cost: false,   // free to play
    raw: [[0, 0], [70, -14], [130, 6], [158, 58], [128, 108], [70, 104], [36, 146], [-30, 150], [-84, 112], [-74, 58], [-118, 20], [-80, -34], [-30, -30]],
    scale: 2.25,
  },
  // MAMA 2026 "A Music Interstellar": neon skyline, giant moon, nebula, floating glass cubes, MAMA billboards.
  space: {
    name: 'INTERSTELLAR',
    cost: true,    // needs a run from a MAMA voting certificate
    raw: [[0, 0], [80, -10], [150, -6], [190, 30], [170, 80], [110, 86], [70, 120], [90, 170], [40, 200], [-30, 180], [-60, 130], [-120, 120], [-150, 70], [-110, 20], [-50, -10]],
    scale: 1.9,
  },
};
export const TRACK_IDS = Object.keys(TRACKS);
export const TRACK = TRACKS[settings.track] || TRACKS.night;
export const SPACE = TRACK === TRACKS.space;

export const THEME = SPACE ? {
  fog: [0x1a1140, 170, 820],
  sky: ['#05030f', '#140a33', '#2a1660', '#46308f'],
  hemi: [0x9a86ff, 0x120a24, 0.7],
  moonLight: 0xd6c8ff,
  moonScale: 300, moonDir: [-0.15, 0.24, 0.96],
  ground: ['#0c0a1f', '#100d28', '#2b2370', '#3f34a8'],   // base, alt, grid line, grid dot
  asphalt: ['#262338', '#23202f'],
  line: '#7fe9ff',
  kerb: ['#ff4fd8', '#4fe6ff'],
  gravel: ['#2a2350', '#251f48'],
  sign: 'MAMA 2026',
  lamp: [0xff8bf0, 0xc85cff],
} : {
  fog: [0x101c3e, 150, 760],
  sky: ['#03050f', '#08102a', '#13224d', '#1f3570'],
  hemi: [0x7290d6, 0x0b1320, 0.6],
  moonLight: 0xb3cbff,
  moonScale: 150, moonDir: [-0.45, 0.34, 0.83],
  ground: null,
  asphalt: ['#2e3140', '#2b2e3c'],
  line: '#e9e9ee',
  kerb: ['#E10600', '#ffffff'],
  gravel: ['#5f5f74', '#57576b'],
  sign: 'E1 GRAND PRIX',
  lamp: [0xd8ecff, 0x5f8fff],
};
