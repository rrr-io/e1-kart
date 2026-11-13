// The tracks and their look. The track is chosen in the menu and applied by reloading the page,
// so every module can build its scene once, at import, for the chosen track.
import { settings } from './config.js';

// MAMA's FAVORITE MCD STAGE vote closes on 13 November 2026 at 15:59 KST (UTC+9). Until then the game asks to vote and
// stream Bloody Paradise (campaign.js); after it, everything on Bloody Paradise that says to vote or watch disappears.
const MCD_UNTIL = Date.UTC(2026, 10, 13, 6, 59);
export const mcdOn = () => Date.now() < MCD_UNTIL;
const MCD_VOTE_URL = 'https://mnetplus.onelink.me/TRa8/xd22hep2?custom_link_value=vote%2Ftemplates%2Fmama-favorite-mcd-stage%2F6ae064af0c8a27ff60ed92b6%3Furl_fallback_type%3Dupdate';

export const TRACKS = {
  night: {
    name: 'NIGHT CIRCUIT',
    cost: false,   // free to play
    desc: 'Night race under the blue moon, between pine woods and grandstands.',
    raw: [[0, 0], [70, -14], [130, 6], [158, 58], [128, 108], [70, 104], [36, 146], [-30, 150], [-84, 112], [-74, 58], [-118, 20], [-80, -34], [-30, -30]],
    scale: 2.25,
  },
  // MAMA 2026 "A Music Interstellar": neon skyline, giant moon, nebula, floating glass cubes, MAMA billboards.
  space: {
    name: 'INTERSTELLAR',
    cost: true,    // needs a run from a MAMA voting certificate
    desc: 'MAMA 2026 "A Music Interstellar": neon skyline, giant moon, floating glass cubes.',
    note: 'Your race results count for your team in the global E1 Kart GP leaderboard.',
    cert: 'MAMA FANS\' CHOICE voting certificate',
    mnet: true,    // after the race, off to Mnet Plus (every view counts)
    raw: [[0, 0], [80, -10], [150, -6], [190, 30], [170, 80], [110, 86], [70, 120], [90, 170], [40, 200], [-30, 180], [-60, 130], [-120, 120], [-150, 70], [-110, 20], [-50, -10]],
    scale: 1.9,
  },
  // ENHYPEN "Bloody Paradise" music video: sunset over a sea of clouds, the prison courtyard with iron balconies,
  // the market street with the green EL CAPULLO arch and the yellow pickup, the seaside terrace with graffiti.
  bloody: {
    name: 'BLOODY PARADISE',
    cost: true,    // needs a run from a FAVORITE MCD STAGE certificate
    desc: 'Sunset race from the seaside terrace through the market street and the prison courtyard.',
    note: 'Your race results count for your team in the global E1 Kart GP leaderboard.',
    cert: 'FAVORITE MCD STAGE voting certificate',
    // Where to vote to get one (Mnet Plus, FAVORITE MCD STAGE): linked under the upload button.
    // Both only while the vote is open (getters, so a page left open past the deadline follows it too).
    get vote() { return mcdOn() ? MCD_VOTE_URL : null; },
    get mnet() { return mcdOn(); },
    raw: [[0, 0], [70, -6], [140, -4], [184, 22], [190, 74], [186, 124], [164, 164], [112, 180], [50, 174], [-12, 180], [-72, 172], [-122, 142], [-142, 92], [-132, 42], [-92, 8], [-42, -2]],
    scale: 2.0,
  },
};
// Until 13 November 2026, 23:59 KST, only Bloody Paradise can be raced: it comes first in the track box and the
// other two are shown greyed out with the unlock time. After that everything is back to normal by itself.
const OPEN_AT = Date.UTC(2026, 10, 13, 14, 59);   // 23:59 KST (UTC+9)
export const UNLOCK_LABEL = 'UNLOCKS NOV 13 · 23:59 KST';
export const isLocked = (id) => id !== 'bloody' && Date.now() < OPEN_AT;
const BLOODY_ONLY = Date.now() < OPEN_AT;
export const TRACK_IDS = BLOODY_ONLY ? ['bloody', 'night', 'space'] : Object.keys(TRACKS);
export const TRACK_ID = TRACKS[settings.track] && !isLocked(settings.track) ? settings.track : BLOODY_ONLY ? 'bloody' : 'night';
export const TRACK = TRACKS[TRACK_ID];
export const SPACE = TRACK === TRACKS.space;
export const BLOODY = TRACK === TRACKS.bloody;

// Bloody Paradise: golden hour. sun* replaces the moon with a low sun; ground is warm paving.
const SUNSET = {
  fog: [0xd98a66, 220, 950],
  sky: ['#2c1638', '#8e3141', '#e06a3a', '#ffbe6a'],
  hemi: [0xffd6b0, 0x3a2a3a, 0.6],
  moonLight: 0xffc490,
  moonScale: 120, moonDir: [0.1, 0.2, -0.97],
  sun: true,
  // The last lap is driven at night: the look the sunset blends into (sky.js).
  night: {
    fog: 0x1a1836,
    sky: ['#03040e', '#0a0e2a', '#1d1a48', '#4a2a52'],
    hemi: [0x8088d0, 0x120e22, 0.42],
    moonLight: 0xa9c0ff,
  },
  ground: ['#8c8078', '#857970', '#6f655e', '#a39488'],   // stone paving, like the seaside terrace
  asphalt: ['#3a3236', '#363034'],
  line: '#f3e6d6',
  kerb: ['#C8110E', '#f3e6d6'],
  gravel: ['#9a8a7c', '#918274'],
  sign: 'BLOODY PARADISE',
  lamp: [0xffd27a, 0xff9a3c],
};

export const THEME = BLOODY ? SUNSET : SPACE ? {
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
