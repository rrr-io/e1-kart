// Teams, race rules and settings saved on the device.

export const TEAMS = [
  { name: 'MCJAKEY', color: '#EE8A1A' },
  { name: 'JAYBULL RACING', color: '#F5D21E' },
  { name: 'ALPINOO', color: '#F06EB0' },
  { name: 'HOONRARI', color: '#C8110E' },
  { name: 'MEOWCEDES', color: '#12A09C' },
  { name: 'RIKSTON DRIFT', color: '#0E8040' },
];

export const LAPS = 3;

// Perceived brightness of a hex color (0..1), used to pick light or dark text.
export const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

const KEY = 'e1kart';

// freePlay: the menu's "Play without a certificate" flag.
// pixelScale is fixed at 2× (the sharpest pixel look); it is no longer a menu option.
export const settings = { teamIdx: 2, pixelScale: 2, assist: true, freePlay: true, track: 'night' };

try {
  const s = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (s.team >= 0 && s.team < TEAMS.length) settings.teamIdx = s.team;
  if (typeof s.assist === 'boolean') settings.assist = s.assist;
  if (typeof s.free === 'boolean') settings.freePlay = s.free;
  if (s.track === 'night' || s.track === 'space') settings.track = s.track;
} catch (e) { /* storage unavailable */ }

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ team: settings.teamIdx, assist: settings.assist, free: settings.freePlay, track: settings.track }));
  } catch (e) { /* storage unavailable */ }
}
