// E1 Kart GP leaderboard: the six game teams ranked by their Interstellar and Bloody Paradise races (GET /api/standings gives
// only the order, never the points). It's the game's own ranking, separate from the official E1 standings,
// which are based on voting certificates. Shown in "What is E1?" and, after a race on those tracks, in a window
// opened from the results.
import { $ } from './engine.js';
import { TEAMS } from './config.js';
import { nameOf } from './dialogue.js';
import { getStandings } from './api.js';

/** Fills a list with the leaderboard; resolves false when the server can't be reached. */
export function renderStandings(list) {
  return getStandings().then((rows) => {
    if (!Array.isArray(rows) || !rows.length) return false;
    list.innerHTML = rows.map((r) => {
      const t = TEAMS[r.team];
      return t ? '<li><b class="p">' + (r.rank || '–') + '</b><span class="chip" style="background:' + t.color + '"></span>' +
        '<span class="nm">' + t.name + '</span><span class="dr">' + nameOf(r.team) + '</span></li>' : '';
    }).join('');
    return true;
  }).catch(() => false);
}

/** The leaderboard window over the results. */
export function openBoard() {
  $('boardList').innerHTML = '<li class="wait">Loading…</li>';
  $('boardView').hidden = false;
  renderStandings($('boardList')).then((ok) => {
    if (!ok) $('boardList').innerHTML = '<li class="wait">Leaderboard unavailable. Try again later.</li>';
  });
}

$('resBoard').onclick = openBoard;
$('boardClose').onclick = () => { $('boardView').hidden = true; };
