// API client (/api, served by Caddy → e1kart-api). The player's anonymous token lives in localStorage.

const TOKEN_KEY = 'e1kart.token';
let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* storage unavailable */ }

function saveToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* storage unavailable */ }
}

async function call(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['X-Player-Token'] = token;
  let res;
  try {
    res = await fetch('/api' + path, { ...opts, headers });
  } catch (e) {
    const err = new Error('Server unreachable. Check your connection.');
    err.code = 'OFFLINE';
    err.detail = (e && e.message) || '';   // the browser's own reason, e.g. "Load failed"
    throw err;
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { /* response with no JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Something went wrong. Please try again.');
    err.code = data && data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function ensurePlayer() {
  if (token) return;
  const d = await call('/players', { method: 'POST' });
  saveToken(d.token);
}

// If the token is no longer valid (e.g. the database was recreated), we request a new one and retry once.
async function withPlayer(fn) {
  await ensurePlayer();
  try {
    return await fn();
  } catch (e) {
    if (e.code !== 'INVALID_PLAYER') throw e;
    saveToken(null);
    await ensurePlayer();
    return fn();
  }
}

export const getConfig = () => call('/config');

export const getMe = () => withPlayer(() => call('/me'));

/** track: the track the player is uploading for; the server uses it only when the certificate doesn't show its kind. */
export function uploadCertificate(file, track) {
  return withPlayer(() => {
    const fd = new FormData();
    fd.append('file', file);
    if (track) fd.append('track', track);
    return call('/certificates', { method: 'POST', body: fd });
  });
}

export const startRun = (team, track) => withPlayer(() => call('/runs', json({ team, track })));

export const finishRun = (runId, timeMs, position) => call('/runs/' + encodeURIComponent(runId) + '/finish', json({ timeMs, position }));

/** E1 team standings: [{ team, rank }] for the six teams, rank null for a team with no races yet. */
export const getStandings = () => call('/standings');
