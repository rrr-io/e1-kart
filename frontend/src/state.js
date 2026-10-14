// Shared game state.
import { N } from './track.js';

export const input = { l: false, r: false, ax: 0, drift: false, brake: false, item: false };

// state: 'menu' | 'intro' (pre-race dialogue) | 'count' (lights) | 'race' | 'done' (crossed the finish line)
// runId: race paid for with a run (null in free-play mode).
// ending: end-of-race dialogue already started.
export const G = { state: 'menu', raceT: 0, countT: 0, lapStart: 0, bestLap: null, doneT: 0, cpus: [], karts: [], runId: null, ending: false };

export const player = {
  x: 0, z: 0, h: 0, v: 0,
  idx: 0, prevIdx: undefined, laps: -1, half: true,
  drifting: false, ddir: 0, dT: 0,
  boost: 0, item: null, rollT: 0,
  hop: 0, steerS: 0, steerVis: 0,
  finish: null, kart: null, team: 0,
};

// Total player progress in track samples (laps × N + index).
export const playerProgress = () => player.laps * N + player.idx;

export function boostFor(o, t) {
  o.boost = Math.max(o.boost, t);
}
