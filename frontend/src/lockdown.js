// Bloody Paradise, second lap only: lockdown in the prison. When the player drives into the hall a siren goes off,
// the lights turn red and the shutter of the far gate starts rolling down. Karts that get out before it is too low
// are rewarded with a boost; the others have to wait in front of it until it rolls back up.
import { N, off, lateral, spacing } from './track.js';
import { G, player, boostFor } from './state.js';
import { GATE, HALL, setLockdown } from './paradise.js';
import { banner, toast } from './hud.js';
import { sfx } from './audio.js';
import { burst } from './fx.js';

const LAP = 1;                  // player.laps on the second lap
const START = HALL[0] + 4;      // the alarm starts just inside the first gate
const STOP = GATE - 5;          // where karts wait when the shutter is down
const PASS = 0.8;               // the shutter still lets a kart under until it is this far down
// The shutter gets too low after CLOSE_T * PASS seconds: enough for a clean run through the hall at about 38 units/s
// (top speed is 46), not for one with a trip on the gravel or a spin.
const CLOSE_T = ((GATE - START) * spacing) / 38 / PASS;
const HOLD_T = 0.7, OPEN_T = 0.9;

let phase = 'idle';   // 'idle' | 'closing' | 'held' | 'opening' | 'over'
let t = 0, closed = 0, alarm = 0, told = false;

export function updateLockdown(dt, now) {
  const p = player;
  if (G.state !== 'race' && G.state !== 'done') { phase = 'idle'; closed = 0; alarm = 0; setLockdown(0, 0, now); return; }
  if (p.laps < LAP) phase = 'idle';

  if (phase === 'idle' && G.state === 'race' && p.laps === LAP && p.idx >= START && p.idx < STOP) {
    phase = 'closing'; t = 0; told = false;
    banner('LOCKDOWN!', 1.4);
    sfx('siren');
    G.cpus.forEach((c) => { c.ldOut = c.prog >= N + GATE; });
  }
  if (phase === 'closing') { t += dt; closed = Math.min(1, t / CLOSE_T); if (closed >= 1) { phase = 'held'; t = 0; sfx('gate'); } }
  else if (phase === 'held') { t += dt; if (t >= HOLD_T) { phase = 'opening'; t = 0; } }
  else if (phase === 'opening') { t += dt; closed = Math.max(0, 1 - t / OPEN_T); if (closed <= 0) phase = 'over'; }
  else closed = 0;

  const live = phase === 'closing' || phase === 'held' || phase === 'opening';
  const shut = live && closed >= PASS;

  if (live) {
    // The player: out in time, or stopped in front of the shutter.
    if (p.laps === LAP && !p.ldOut) {
      if (p.idx >= GATE) {
        p.ldOut = true;
        if (phase === 'closing') { boostFor(p, 1.3); toast('ESCAPED!'); sfx('boost'); burst('flare', p.x, 0.9, p.z, 4.5); }
      } else if (shut && p.idx >= STOP) {
        const o = off(STOP, lateral(p.idx, p.x, p.z));
        p.x = o[0]; p.z = o[1]; p.idx = STOP; p.prevIdx = STOP; p.v = 0; p.boost = 0; p.drifting = false;
        if (p.kart) p.kart.root.position.set(p.x, 0, p.z);
        if (!told) { told = true; toast('LOCKED IN!'); }
      }
    }
    // The other karts play by the same rule.
    G.cpus.forEach((c) => {
      if (c.ldOut || c.prog < N + HALL[0] || c.prog >= 2 * N) return;
      if (c.prog >= N + GATE) { c.ldOut = true; if (!shut) c.boost = Math.max(c.boost, 1); }
      else if (shut && c.prog > N + STOP) c.prog = N + STOP;
    });
  } else if (phase === 'idle') {
    p.ldOut = false;
  }

  // Red lights only where they are: inside the hall.
  const inside = p.idx >= HALL[0] - 6 && p.idx <= GATE + 6;
  alarm += ((live && inside ? 1 : 0) - alarm) * Math.min(1, dt * 6);
  setLockdown(closed, alarm < 0.01 ? 0 : alarm, now);
}
