// Entry point: loads fonts and styles, builds the scene and starts the game loop.
import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './style.css';

import * as THREE from 'three';
import { registerSW } from 'virtual:pwa-register';
import { $, renderer, scene, camera, resize } from './engine.js';
import { TEAMS } from './config.js';
import { updateSky } from './sky.js';
import './track.js';
import { updateScenery, redrawText } from './scenery.js';
import { makeKart } from './kart.js';
import { updateParticles } from './particles.js';
import { G, player } from './state.js';
import { updatePlayer } from './physics.js';
import { updateCpus } from './ai.js';
import { updateItems } from './items.js';
import { updateCamera } from './camera.js';
import { updateHud, showResults, playerPosition } from './hud.js';
import { talk } from './dialogue.js';
import { tickCountdown } from './race.js';
import { toMenu } from './menu.js';
import { initInput } from './input.js';
import { trackVisit } from './stats.js';
import { initAccount, initAccountUi, startGame, menuStart, reportFinish, runsLeftText, resumeTrackChoice } from './account.js';

G.karts = TEAMS.map((t) => makeKart(t.color));

$('start').onclick = menuStart;
$('runGo').onclick = startGame;
$('again').onclick = startGame;
$('toMenu').onclick = toMenu;
initInput();
initAccountUi();

window.addEventListener('resize', resize);
if (document.fonts && document.fonts.load) {
  document.fonts.load('8px "Press Start 2P"').then(redrawText).catch(() => {});
}

const focus = new THREE.Vector3();
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.state === 'count') tickCountdown(dt);
  if (G.state === 'race' || G.state === 'done') G.raceT += dt;
  if (G.state !== 'menu') {
    updatePlayer(dt);
    updateCpus(dt);
    updateItems(dt);
    updateHud(dt);
  }
  if (G.state === 'done') {
    G.doneT += dt;
    // After the finish line: the driver's line, then the results window.
    if (G.doneT > 2 && !G.ending) {
      G.ending = true;
      $('controls').hidden = true;
      const pos = playerPosition();
      reportFinish(player.finish, pos);
      talk(player.team, pos === 1 ? 'win' : pos <= 3 ? 'podium' : 'lose').then(() => {
        showResults();
        $('resRuns').textContent = runsLeftText();
      });
    }
  }

  updateScenery(dt, now);
  updateParticles(dt);
  updateCamera(dt);
  if (G.state === 'menu') focus.copy(G.karts[0].root.position); else focus.set(player.x, 0, player.z);
  updateSky(dt, now, focus);

  renderer.render(scene, camera);
  if (!splashGone) hideSplash();
  requestAnimationFrame(frame);
}

// The splash in index.html goes away once the first frame is drawn and the pixel fonts are in,
// staying at least ~0.8 s so it doesn't just flash.
let splashGone = false;
function hideSplash() {
  splashGone = true;
  const el = document.getElementById('splash');
  if (!el) return;
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const minTime = new Promise((r) => setTimeout(r, Math.max(0, 800 - performance.now())));
  Promise.all([fonts, minTime]).then(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  });
}

resize();
toMenu();
initAccount();
resumeTrackChoice();
requestAnimationFrame(frame);
trackVisit();

registerSW({ immediate: true });
