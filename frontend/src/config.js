// Teams, race rules and settings saved on the device.

// The six teams, in the members' age order (Jay, Jake, Sunghoon, Sunoo, Jungwon, Ni-ki): menu, leaderboard ties
// and the team index the server stores all follow it. DRIVERS in drivers.js is in the same order.
export const TEAMS = [
  { name: 'JAYBULL RACING', color: '#F5D21E' },
  { name: 'MCJAKEY', color: '#EE8A1A' },
  { name: 'HOONRARI', color: '#C8110E' },
  { name: 'ALPINOO', color: '#F06EB0' },
  { name: 'MEOWCEDES', color: '#12A09C' },
  { name: 'RIKSTON DRIFT', color: '#0E8040' },
];
// Team order before Nov 2026, to read a team saved by number in an older version.
const OLD_ORDER = ['MCJAKEY', 'JAYBULL RACING', 'ALPINOO', 'HOONRARI', 'MEOWCEDES', 'RIKSTON DRIFT'];

export const LAPS = 3;

// Perceived brightness of a hex color (0..1), used to pick light or dark text.
export const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

const KEY = 'e1kart';

// freePlay: the menu's "Play without a certificate" flag.
// pixelScale is fixed at 2× (the sharpest pixel look); it is no longer a menu option.
export const settings = { teamIdx: 3, pixelScale: 2, assist: true, freePlay: true, track: 'night', sound: true };

try {
  const s = JSON.parse(localStorage.getItem(KEY) || '{}');
  // Saved by name now; an older save has only the number, in the old order.
  const name = s.teamName || OLD_ORDER[s.team];
  const k = TEAMS.findIndex((t) => t.name === name);
  if (k >= 0) settings.teamIdx = k;
  if (typeof s.assist === 'boolean') settings.assist = s.assist;
  if (typeof s.free === 'boolean') settings.freePlay = s.free;
  if (s.track === 'night' || s.track === 'space') settings.track = s.track;
  if (typeof s.sound === 'boolean') settings.sound = s.sound;
} catch (e) { /* storage unavailable */ }

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ teamName: TEAMS[settings.teamIdx].name, assist: settings.assist, free: settings.freePlay, track: settings.track, sound: settings.sound }));
  } catch (e) { /* storage unavailable */ }
}
