# E1 Kart GP

Mobile single-player kart racer inspired by E1 / Enhypen MAMA Grand Prix: a night race under the blue moon, 6 teams, drift mini-turbos, boost pads and lightstick boost.

The **NIGHT CIRCUIT** is free to play. The **INTERSTELLAR** track costs one run per race: runs are earned by uploading a screenshot of a MAMA voting certificate (**1 certificate = 1 run**, each certificate can only be used once). When the server allows it (`E1KART_FREE_PLAY`), OPTIONS shows **PLAY WITHOUT A CERTIFICATE** to race the Interstellar track for free, for testing.

## Tech stack

| Part | Built with |
|---|---|
| Game | JavaScript (ES modules), [three.js](https://threejs.org) 0.128, HTML + CSS for HUD and menus |
| Build | [Vite](https://vitejs.dev) 5, [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (installable, offline-capable) |
| API | Java 21, Spring Boot 3.3 (web, data-jpa, validation), package-by-layer |
| Database | SQLite (file in a Docker volume) |
| Certificate reading | Tesseract OCR 5 (CLI inside the container), regex over the text |
| CI/CD | GitHub Actions: one workflow for the game, one for the API |
| Hosting | rio-server (Oracle, arm64): Caddy serves the game and proxies `/api` to the `e1kart-api` container |

## Structure

```
e1-kart-gp/
├─ frontend/                     the game (Vite)
│  ├─ index.html
│  ├─ vite.config.js             build, PWA, /api proxy in dev
│  └─ src/
│     ├─ main.js                 entry point and game loop
│     ├─ account.js              free-play flag, run balance, certificate upload, START
│     ├─ drivers.js              drivers, portraits and dialogue lines
│     ├─ dialogue.js             dialogue box, in-race radio, menu preview, silhouette
│     ├─ api.js                  API calls and the player token
│     ├─ config.js               teams, laps, saved settings
│     ├─ engine.js  sky.js  track.js  scenery.js  kart.js
│     ├─ physics.js              player driving (parameters in TUNING)
│     ├─ items.js  itemdefs.js   items (player and CPU), reactive radio; names, drop odds, pixel icons
│     ├─ ai.js  camera.js  hud.js  race.js  menu.js  input.js  particles.js
│     └─ style.css
├─ backend/                      the API (Spring Boot)
│  ├─ pom.xml
│  ├─ Dockerfile                 runtime: Java 21 + Tesseract
│  ├─ docker-compose.yml         e1kart-api container on the "web" network
│  ├─ .env.example
│  └─ src/main/java/com/rrriooo/e1kart/
│     ├─ controller/             Config, Player, Certificate, Run, ApiExceptionHandler
│     ├─ service/                CertificateService, CertificateParser, CertificateIdHasher,
│     │                          OcrService, RunService, PlayerService, RateLimiter
│     ├─ repository/             Player, Certificate, Run
│     ├─ model/                  JPA entities
│     ├─ dto/                    requests and responses
│     ├─ config/                 E1KartProperties, AppConfig
│     └─ exception/              ErrorCode, ApiException
├─ deploy/Caddyfile.snippet
└─ .github/workflows/
   ├─ deploy.yml                 game → /srv/e1-kart-gp
   └─ deploy-api.yml             API → /opt/e1kart-api + docker compose
```

## Driver dialogue

Each team has a driver (inspired by an ENHYPEN member) who speaks at these moments:
- **menu**: a portrait and a line appear when you select the team (`select`);
- **before the start**: an on-screen dialogue (tap to advance, SKIP to close it), then the lights go out (`start`);
- **during the race**: short radio messages that don't pause the game:
  - `miniTurbo`, `lightstick`, `lastLap`;
  - `takeLead`, `overtake`, `overtaken`: the race position changed (it has to hold for a moment, so a brief swap doesn't trigger it);
  - `attack` (you used BLOOD POP or BAT SWARM), `slip` (you stepped on a BLOOD POP), `batsHit` (the swarm reached you), `comeback` (you used PARALLEL WORLD);
- **after the finish**: a different line for a win, podium or loss, then the results (`win`, `podium`, `lose`).

Everything is configured in `frontend/src/drivers.js`:
- `driver`: the name shown on the nameplate (empty = the team's name);
- `lines`: the lines for each moment. Each moment has one or more variants chosen at random; a variant can be a single line or a sequence. To change the expression on a line: `{ t: 'text', mood: 'happy' }`;
- `COMMON`: fallback lines for moments a team doesn't have its own for.

### Portraits

Until real portraits are added, the game draws a pixel silhouette tinted in the team's color, with a small icon for the mood (heart = happy, teardrop = sad, spark = hype).

To use real portraits:
1. Put transparent PNGs in `frontend/public/drivers/`, at native size (e.g. 64×64 or 96×96: the game scales them up with crisp pixels), named like this:
   ```
   alpinoo-normal.png   alpinoo-happy.png   alpinoo-sad.png   alpinoo-hype.png
   ```
   `-normal.png` alone is enough: missing expressions fall back to it.
2. In `drivers.js` set `portrait: 'alpinoo'` for that team.

## Track length

The lap length is `SCALE` in `frontend/src/track.js`. Boost pads, item boxes and scenery are placed by track index, so they keep the same relative spots when the track is made longer or shorter.

## Items

Driving through an item box gives you an item, picked at random with odds that depend on your race position: whoever leads gets the "hit the ones behind" items, whoever trails gets the comeback. The CPU karts pick up and use items too.

| Item | Effect | Mostly for |
|---|---|---|
| **LIGHTSTICK** | boost | everyone |
| **BLOOD POP** (red popsicle) | dropped behind you: whoever steps on it slips and spins out for about a second | the leaders |
| **BAT SWARM** | sent backwards: slows whoever is behind for a few seconds; when a CPU sends it at you, the screen darkens and bats fly across it | the leaders |
| **PARALLEL WORLD** (flower) | strong boost, and nothing can hit you while it lasts; the flower comes out in a different color each time (the PARALLEL WORLD album versions) | the last positions |

Odds, durations, flower colors and icons live in `frontend/src/itemdefs.js`; the effects and the CPU behavior in `frontend/src/items.js`.

## Tracks

Two tracks, chosen with the TRACK button in the menu (the choice is saved and the page reloads):

- **NIGHT CIRCUIT**: the original night track under the blue moon. Always free.
- **INTERSTELLAR**: needs a run (1 MAMA voting certificate = 1 run; the server's free-play flag still overrides it for testing). MAMA 2026 "A Music Interstellar" theme — neon skyline, giant moon, nebula, floating glass cubes, MAMA billboards.

Layouts and colours live in `frontend/src/theme.js`; the interstellar scenery is in `frontend/src/space.js`.

## Credits

Skyline of the INTERSTELLAR track (`frontend/src/assets/space/`): "Neon City" by Kelench, recoloured; free for free and commercial projects, not to be redistributed or resold as an asset pack.


Pixel-art effects (`frontend/src/assets/fx/`):

- `boom.png`: "Explosion pack 1" by Luis Zuno (Ansimuz), CC0.
- `flare.png`, `sparkle.png`, `ring.png`, `swirl.png`: "Retro Pixel Effects 32x32" (free version) by BDragon1727, free for non-commercial games, not to be resold or redistributed as an asset pack.

## How certificate redemption works

1. The game sends the screenshot to `POST /api/certificates`.
2. `OcrService` resizes it to 1000px wide, converts it to grayscale, and reads it with Tesseract. The image is never saved: the temp file is deleted right after.
3. `CertificateParser` checks that it's a certificate (`VOTING CERTIFICATE`, `MAMA`, `Mnet Plus`) and extracts:
   - the ID after `No.` (16 alphanumeric A-Z/0-9 characters),
   - the `Participation Date` (Korean time),
   - the category, e.g. `FANS' CHOICE CATEGORY 1ST VOTE`.
4. The date must fall inside one of the voting windows (`e1kart.vote-windows` in `application.yml`).
5. The ID is normalized (O→0, I→1) and stored only as an **HMAC-SHA256** keyed with a server secret, under a `UNIQUE` constraint: the same certificate can never be redeemed twice, and the plain ID never touches the database.
6. The balance is always `runs granted by certificates − runs started`, so it can never drift out of sync.

### API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/config` | `freePlayAllowed`, runs per certificate, voting windows |
| POST | `/api/players` | creates an anonymous player and returns the token |
| GET | `/api/me` | run balance, uploaded certificates, games played |
| POST | `/api/certificates` | multipart `file`: redeems a certificate |
| POST | `/api/runs` | `{team}`: consumes a run and returns `runId` |
| POST | `/api/runs/{id}/finish` | `{timeMs}`: final time, for a future leaderboard |

The token goes in the `X-Player-Token` header. Errors are JSON `{code, message}` with a message already meant to be shown as-is (e.g. `ALREADY_USED` 409, `NO_RUNS` 402, `ID_NOT_FOUND` 422, `RATE_LIMITED` 429).

### Main settings (`backend/src/main/resources/application.yml`)

- `e1kart.free-play-allowed` (env `E1KART_FREE_PLAY`): if `false` the flag disappears from the menu and the game can only be played with runs.
- `e1kart.runs-per-certificate`: runs per certificate (currently 1).
- `e1kart.vote-windows`: valid voting periods. Add future rounds here.
- `e1kart.upload-rate-limit-per-minute`: uploads per minute, per player and per IP.

## Local development

Requires Node 20+, Java 21, Maven and Tesseract (`brew install tesseract` / `sudo apt install tesseract-ocr`).

```bash
# API on :8080 (database in backend/data/)
cd backend
mvn spring-boot:run

# Game on :5173, with /api forwarded to the backend
cd frontend
npm install
npm run dev
```

If the API isn't reachable the game still works, just in free-play mode.

API tests: `cd backend && mvn test`. `CertificateParserTest` uses the real OCR text of a certificate (`src/test/resources/certificate-ocr.txt`).

## Deploying to rio-server

Example subdomain: `e1kart.rrriooo.com`. To change it, just update the DNS record and the Caddy block.

### 1. One-time, on the server

```bash
# Game folder (served by Caddy)
sudo mkdir -p /srv/e1-kart-gp && sudo chown ubuntu:ubuntu /srv/e1-kart-gp

# API folder (outside /srv, so .env isn't visible to Caddy)
sudo mkdir -p /opt/e1kart-api && sudo chown ubuntu:ubuntu /opt/e1kart-api

# Secret for the ID hash: generate it once and never rotate it
echo "E1KART_ID_SECRET=$(openssl rand -base64 48)" > /opt/e1kart-api/.env
echo "E1KART_FREE_PLAY=true" >> /opt/e1kart-api/.env
chmod 600 /opt/e1kart-api/.env
```

The `ubuntu` user needs to be able to run `docker` without sudo (member of the `docker` group).

Add the contents of `deploy/Caddyfile.snippet` to `/srv/caddy/Caddyfile`, then:

```bash
docker exec caddy caddy reload --config /srv/caddy/Caddyfile
```

### 2. DNS

An `A` record for `e1kart` (or whatever name you chose) pointing at the server's IP. Caddy gets the HTTPS certificate on its own.

```bash
ssh-keygen -t ed25519 -f e1kart_deploy -C "github-actions e1-kart-gp" -N ""
# e1kart_deploy.pub → into ~/.ssh/authorized_keys on the server
# e1kart_deploy     → into the SSH_KEY secret
```

### 4. Publishing

- Push with changes in `frontend/` → builds the game and uploads to `/srv/e1-kart-gp`.
- Push with changes in `backend/` → runs tests, builds the jar, uploads to `/opt/e1kart-api` and runs `docker compose up -d --build`.

Both can also be triggered manually from Actions → Run workflow.

The API's first startup on the server downloads the Java image and installs Tesseract: it takes a few minutes. After that it's cached.

Quick check:

```bash
curl https://e1kart.rrriooo.com/api/config
docker logs e1kart-api --tail 50
```

## First push

```bash
git init
git add .
git commit -m "E1 Kart GP: game and certificate API"
git branch -M main
git remote add origin git@github.com:rrr-io/e1-kart-gp.git
git push -u origin main
```

## Notes

- The game doesn't use any official MAMA, Mnet, or sponsor logos.
- Certificate images are never stored, and the ID is kept only as a hash.
- OCR makes certificates hard to reuse or forge, but a carefully edited screenshot could still get through: it's a deterrent suited to a fan game, not a cryptographic guarantee.
