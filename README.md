# E1 Kart GP

Mobile single-player kart racer inspired by E1 / Enhypen MAMA Grand Prix: a night race under the blue moon, 6 teams, drift mini-turbos, boost pads and lightstick boost.

The **NIGHT CIRCUIT** is free to play. The **INTERSTELLAR** track costs one run per race: runs are earned by uploading a screenshot of a MAMA FANS' CHOICE voting certificate (**1 certificate = 1 run**, each certificate can only be used once). The **BLOODY PARADISE** track works the same way with FAVORITE MCD STAGE certificates, which have their own runs. When the server allows it (`E1KART_FREE_PLAY`), OPTIONS shows **PLAY WITHOUT A CERTIFICATE** to race those tracks for free, for testing.

**Where things are**

- Game: https://e1-kart.ensite.org (official) · https://e1kart.rrriooo.com (debug, same game and data)
- **Stats: https://e1kart.rrriooo.com/stats.html** (or `/stats.html` on the official domain). The token is `E1KART_STATS_TOKEN` in `/opt/e1kart-api/.env` on rio-server; the page remembers it in that browser.

## Tech stack

| Part | Built with |
|---|---|
| Game | JavaScript (ES modules), [three.js](https://threejs.org) 0.128, HTML + CSS for HUD and menus |
| Build | [Vite](https://vitejs.dev) 5, [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (installable, offline-capable) |
| API | Java 21, Spring Boot 3.3 (web, data-jpa, validation), package-by-layer |
| Database | SQLite (file in a Docker volume) |
| Certificate reading | Tesseract OCR 5 (CLI inside the container); card detection, ENHYPEN photo check and ID voting ported from the collab verifier |
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
│     │                          CertificateImage, PixelImage, EnhypenMatcher, IdReader, IdVotes,
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

Three tracks, chosen after START (the choice is saved and the page reloads):

- **NIGHT CIRCUIT**: the original night track under the blue moon. Always free.
- **INTERSTELLAR**: needs a run (1 MAMA voting certificate = 1 run; the server's free-play flag still overrides it for testing). MAMA 2026 "A Music Interstellar" theme — neon skyline, giant moon, nebula, floating glass cubes, MAMA billboards.
- **BLOODY PARADISE**: needs a run from a FAVORITE MCD STAGE certificate (1 certificate = 1 run, separate from the Interstellar runs). After ENHYPEN's "Bloody Paradise" music video (shot in Barranco, Lima), at sunset. The start straight is the mirador: a terrace on top of a cliff, a stone parapet with ENHYPEN graffiti, the sea below with breakwaters, boats and a headland across the bay. The market street has the green half-sun sign of EL CAPULLO over the road with its green gates, the yellow pickup, fruit carts, sacks, crates, mototaxis, wires and red bunting. Then the track runs inside the prison: two floors of cells behind iron walkways, yellow tiles, arched barred doors, a glazed roof on trusses, the big arched window over the gate at each end, a painted wall, plants, and inmates in the red tracksuits with number tags on the floor and on the walkways. The west side is the night street: strings of lights and a steel footbridge with people on it. Low painted casas (drawn in `paradise.js`) mix with the facade atlas everywhere. Races to the music Night Circuit used to have (`bloody-race.mp3` / `bloody-final.mp3`, loop points in `TRACK_MUSIC.bloody` in `audio.js`); Night Circuit now has its own new instrumental. Two things happen during the race. On the second lap only, driving into the prison sets off a **lockdown** (`frontend/src/lockdown.js`): a siren, red lights, and the shutter of the far gate rolling down; karts that get out before it is too low get a boost, the others wait in front of it until it rolls back up (the same rule applies to the CPU karts). On the last lap **night falls**: in about five seconds the sunset blends into a starry night with the moon up (`night` in the track's theme in `theme.js`, blended in `sky.js`).

While the FAVORITE MCD STAGE vote was open (until 13 November 2026, 23:59 KST), closing the driver's end-of-race line opened the video on Mnet Plus (the OneLink opens the app when installed) and the results had **WATCH ON MNET PLUS**. It is off now on every track; `mnet: true` on a track in `theme.js` turns it back on (link: `MNET_URL` in `frontend/src/mnet.js`).

Layouts and colours live in `frontend/src/theme.js`; the interstellar scenery is in `frontend/src/space.js`, the Bloody Paradise scenery in `frontend/src/paradise.js` (every building takes a different piece of the facade atlas at the same scale, with roof clutter, awnings, signs and AC units; the town around the circuit is laid out on a street grid; little pixel people, many in the video's red jumpsuits, line the streets, the terrace and the corners, and dance in the prison yard. Graffiti on the sea wall and the west side say ENHYPEN. A beach runs between the sea wall and the water, with umbrellas, towels, lifeguard towers and people. Billboards beside the road, over the road in the prison yard and on some roofs show the video's fake ads (Midnight Bank, Dormant Sleep, Noomax, Route, Haven, Centuries, Pearl Bite), pixelated in `frontend/src/assets/bloody/billboards.png` (rectangles in `billboards.json`). A seeded random makes the town the same for everyone. All static pieces are merged by material, so the whole town costs about as many draw calls as the other tracks). Its 3D models load in the background from `public/models/bloody/` and are cached by the service worker once loaded.

## Credits

E1, the ENHYPEN MAMA Grand Prix, is a fan-organized campaign to promote voting for ENHYPEN at the MAMA AWARDS ([e1.ensite.org](https://e1.ensite.org), [@ENMamaGrandPrix](https://x.com/ENMamaGrandPrix)). The menu's WHAT IS E1? button explains it and links there.

A fan game by **rrr.i.ooo**: game, code, pixel art, driver portraits, music and sound. In the game the credits are in OPTIONS → CREDITS, and the splash screen has "a fan game by rrr.i.ooo" as a small footer. Unofficial: not affiliated with ENHYPEN, BELIFT LAB, Mnet or the MAMA AWARDS.

Fonts: Press Start 2P and VT323 (SIL Open Font License). 3D engine: three.js (MIT).

Skyline of the INTERSTELLAR track (`frontend/src/assets/space/`): "Neon City" by Kelench, recoloured; free for free and commercial projects, not to be redistributed or resold as an asset pack.

Sunset clouds of the BLOODY PARADISE track (`frontend/src/assets/bloody/clouds.png`): from "Free Sky with Clouds Background Pixel Art Set" by CraftPix (craftpix.net, free license), cropped and made tileable; not to be redistributed as an asset pack.

Building facades of the BLOODY PARADISE track (`frontend/src/assets/bloody/facade-atlas.png`, 38 facades packed in one texture, rectangles in `facade-atlas.json`): "Pixel Facades 100" by najjar320, free commercial license; not to be redistributed as standalone assets.

Shore of the BLOODY PARADISE track (`frontend/src/assets/bloody/shore.png`: sand, wet sand and shallow water seen from above, the first frame of `spr_Beach.aseprite`). Source and license to be confirmed before release.

Palms, fishing boats, barrels and the pier of the BLOODY PARADISE track (`frontend/public/models/bloody/`): "PSX The Island Pack" by Caliber Creations; usable in games, not to be redistributed as standalone files.


Pixel-art effects (`frontend/src/assets/fx/`):

- `boom.png`: "Explosion pack 1" by Luis Zuno (Ansimuz), CC0.
- `flare.png`, `sparkle.png`, `ring.png`, `swirl.png`: "Retro Pixel Effects 32x32" (free version) by BDragon1727, free for non-commercial games, not to be resold or redistributed as an asset pack.

## Sharing

- **Link preview**: `index.html` has Open Graph and Twitter Card tags with `frontend/public/og-image.jpg` (1200×630), so a link to the game shows the E1 logo, the red kart on the Night Circuit and "ENGENEs racing as one for ENHYPEN · vote ENHYPEN at the MAMA AWARDS" on X, Instagram, Discord, KakaoTalk and WhatsApp. The tags use the absolute address `https://e1-kart.ensite.org/`: change it there if the domain changes.
- **Result card** (`frontend/src/share.js`): on the results screen, SHARE RESULT opens the phone's share sheet with a 1080×1350 image (race scene, position, driver drawing cut at mid-leg, track, times, the call to vote, link and a tiny signature) and a ready-made text. The card is drawn as soon as the results appear, because iOS only opens the share sheet straight from a tap. Where files can't be shared (desktop, some in-app browsers) the card opens in a window to long-press or download, with COPY LINK.
- **Call to vote**: until the end of Nov 20 (KST) the card has a red band "NOV 20 · MAMA AWARDS LIVE VOTING / VOTE ENHYPEN ON MNET PLUS" for the live voting during the MAMA broadcast, and the post text says the same; then both go back to "VOTE ENHYPEN AT THE MAMA AWARDS" on their own. `LIVE_VOTE` at the top of `share.js` sets the text and the end date for the next event.

## Stats

Anonymous usage stats are counted by the API itself, in its database: no external service, no cookies, no IPs stored.

- The game sends a few events (`frontend/src/stats.js`): the visit with its source (Instagram, X, TikTok, KakaoTalk… from the app's built-in browser, the referring site or `?utm_source=`), the device, how it is opened (browser, in-app browser, installed app), races started (track and team), races finished (win, podium, finished), shares, app installs and trips to Mnet Plus (`mnet`, automatic or from the button, per track). The API counts certificate uploads by outcome (accepted, accepted MCD, not ENHYPEN, already used…).
- Only daily totals are stored (`stat_counter`). Unique visitors are counted with a hash of IP + browser + day and a random salt kept in memory that changes every day: nobody can be recognised from one day to the next, and nothing personal reaches the disk.
- **The stats page** is `https://e1-kart.ensite.org/stats.html` (or on the debug domain) (not linked anywhere, not indexed). It asks for the token set in `.env` as `E1KART_STATS_TOKEN` (generate it with `openssl rand -hex 24`, then `docker compose up -d`). Without a token the page is off; the events are still counted.
- To see which post brings players, share links with a source, e.g. `https://e1-kart.ensite.org/?utm_source=x-launch`.

## E1 Kart GP leaderboard

The game's own team leaderboard, from the Interstellar and Bloody Paradise races (the ones paid for with a run). It is separate from the official E1 standings, which are based on voting certificates.

- At the finish the game sends the race's position with its time (`POST /api/runs/{id}/finish`). Each race gives its team points by position, F1-style, and teams are ranked by points, then by number of races.
- `GET /api/standings` returns only the order (`[{ team, rank }]`, `rank` null for a team with no races yet): the points never leave the server.
- Players see it in **WHAT IS E1?** (E1 KART GP LEADERBOARD) and, after a race on those tracks, from "CHECK THE GLOBAL E1 KART GP LEADERBOARD" on the results. Nothing on the share card.
- `E1KART_STANDINGS_SINCE` in `.env` (e.g. `2026-11-12`, Korean date) counts only races from that day on, to start from zero at launch after the tests. Empty: all races.

## How certificate redemption works

The checks are those of the collab verifier (`e1-social-race`, `/collab-verify`), ported to Java, but **lenient**: when in doubt the certificate is accepted. It is refused only when it is surely not an ENHYPEN certificate, or surely a duplicate. The cases the verifier sends to manual review are accepted here.

1. The game sends the screenshot to `POST /api/certificates`. The image stays in memory only for the call, it is never saved.
2. **The card** (`CertificateImage`): an exported certificate (930×1410 proportions) is used as it is; a phone screenshot (status bar, ad banner, *Save Image* button) is cut down to the certificate card, found as the large tinted area with the certificate proportions or, when the card is drawn plain white, from its row of three thumbnails.
3. **ENHYPEN** (`EnhypenMatcher`): the last thumbnail is compared with the ENHYPEN references (24×24 colour vectors; ≥ 0.85 is ENHYPEN); screenshots are tried at small offsets, and thumbnails drawn wider or moved by other devices are searched for. Refused only when the layout is standard and the last image is clearly something else (< 0.60): `NOT_ENHYPEN`, or `ENHYPEN_NOT_LAST` when ENHYPEN is on it but not last. An unclear photo, a cropped screenshot or a card that can't be found is accepted.
4. `OcrService` reads the whole image with Tesseract. Refused as `NOT_A_CERTIFICATE` only when nothing looks like a certificate: no certificate layout, none of the words `VOTING CERTIFICATE` / `MAMA` / `Mnet Plus`, no ENHYPEN photo. `CertificateParser` extracts the `Participation Date` (Korean time) and the category, e.g. `FANS' CHOICE CATEGORY 1ST VOTE`. An unreadable date (the upload time is stored instead) or a date outside `e1kart.vote-windows` is only logged.
5. **The ID** (`IdReader`, `IdVotes`): the `No. <ID>` line of the card is read 3 times (up to 8 when the readings disagree) at different sizes, plain and binarised, in single-line mode with no dictionaries. Each reading votes for every 16-character ID it can stand for (the `No.` prefix and stray characters the OCR inserts are voted away). Without agreement: the best guess (a leader, or candidates differing only in look-alike characters), then the candidate with the most votes, then the full-page reading. With no readable ID at all, the file itself is the key: the same file can't be used twice.
6. **Unique**: the ID is normalized (O→0, I→1) and stored only as an **HMAC-SHA256** keyed with a server secret, under a `UNIQUE` constraint: the same certificate can never be redeemed twice (`ALREADY_USED`), whether it arrives as an export or a screenshot.
7. The balance is always `runs granted by certificates − runs started`, so it can never drift out of sync. Each kind of certificate has its own balance (`/api/me`: `balance` for Interstellar, `mcdBalance` for Bloody Paradise).

**FAVORITE MCD STAGE certificates** (Bloody Paradise) go through the same steps, with these differences:

- **The kind** comes from the text (`FAVORITE MCD STAGE` → MCD, `FANS' CHOICE` / `Category` → FANS' CHOICE), then from the layout (one framed photo in the middle and no side thumbnails → MCD), then from the track the player is uploading for. A certificate of the other kind is still accepted, and its run goes to the track it unlocks ("+1 run for Interstellar!").
- **ENHYPEN** (`McdMatcher`): the middle stage photo is compared with the MCD references (≥ 0.80 is ENHYPEN). Very lenient: refused (`MCD_NOT_ENHYPEN`) only when the card has the standard MCD layout and the photo is clearly another one (< 0.45). With no references the check is off.
- **The ID**: its first five characters are the vote date (year's last digit, month, day: a vote on 2026.11.09 gives `61109…`); when the date was read, OCR slips in that prefix are corrected from it.
- **Unique within its kind**: MCD IDs are hashed with an `MCD:` prefix, so they are only compared with other MCD IDs.

### ENHYPEN references

The ENHYPEN check needs references in the folder `e1kart.enhypen-refs-dir` (env `E1KART_ENHYPEN_REFS`, default `/data/enhypen-refs`, inside the `e1kart-data` volume). They are loaded at startup; with no references the check is off and the log says so (`certificates are NOT checked for ENHYPEN`).

- **Certificate images**: PNG/JPG of a correct certificate (an export, or a screenshot showing the whole card). Its last image becomes a reference. Add one per version if the photo changes between rounds.
- **The verifier's references**, exported as JSON (the same vectors the verifier uses):

```bash
# on the server, in the e1-social-race folder
docker compose -f deploy/compose.production.yaml exec -T social-pulse python -c "import json,sqlite3; c=sqlite3.connect('/app/data/pulse.sqlite3'); print(json.dumps([{'label': l, 'vec': json.loads(v)} for l, v in c.execute('SELECT label, vec FROM collab_refs WHERE collab_id IS NULL')]))" > enhypen-refs.json

# into the game's volume, then restart the API
docker exec -u 0 e1kart-api mkdir -p /data/enhypen-refs
docker cp enhypen-refs.json e1kart-api:/data/enhypen-refs/
docker exec -u 0 e1kart-api chown -R e1kart /data/enhypen-refs
docker restart e1kart-api
```

The startup log lists what was loaded (`ENHYPEN references: N vectors from enhypen-refs.json`).

**MCD references** go in `e1kart.mcd-refs-dir` (env `E1KART_MCD_REFS`, default `/data/mcd-refs`): one or more FAVORITE MCD STAGE certificate images of the ENHYPEN stage (an export, or a screenshot showing the whole card); the middle photo becomes the reference. Add one more if Mnet changes the photo.

```bash
docker exec -u 0 e1kart-api mkdir -p /data/mcd-refs
docker cp mcd-enhypen.jpg e1kart-api:/data/mcd-refs/
docker exec -u 0 e1kart-api chown -R e1kart /data/mcd-refs
docker restart e1kart-api
```

The log says `MCD reference: mcd-enhypen.jpg`.

### API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/config` | `freePlayAllowed`, runs per certificate, voting windows |
| POST | `/api/players` | creates an anonymous player and returns the token |
| GET | `/api/me` | run balances (`balance` Interstellar, `mcdBalance` Bloody Paradise), uploaded certificates, games played |
| POST | `/api/certificates` | multipart `file` (+ optional `track`): redeems a certificate; the answer says its `kind` and `track` |
| POST | `/api/runs` | `{team, track}`: consumes a run of that track's kind and returns `runId` |
| POST | `/api/runs/{id}/finish` | `{timeMs, position}`: final time and position, for the leaderboard |

The token goes in the `X-Player-Token` header. Errors are JSON `{code, message}` with a message already meant to be shown as-is (e.g. `ALREADY_USED` 409, `NO_RUNS` / `NO_MCD_RUNS` 402, `NOT_ENHYPEN` / `MCD_NOT_ENHYPEN` 422, `RATE_LIMITED` 429).

### Main settings (`backend/src/main/resources/application.yml`)

- `e1kart.free-play-allowed` (env `E1KART_FREE_PLAY`): if `false` the flag disappears from the menu and the game can only be played with runs.
- `e1kart.runs-per-certificate`: runs per certificate (currently 1).
- `e1kart.vote-windows`: voting periods. With the lenient check a date outside them is only logged, not refused.
- `e1kart.upload-rate-limit-per-minute`: uploads per minute, per player and per IP.
- `e1kart.enhypen-refs-dir` (env `E1KART_ENHYPEN_REFS`): folder of the ENHYPEN references (see above).
- `e1kart.mcd-refs-dir` (env `E1KART_MCD_REFS`): folder of the MCD references (see above).

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

API tests: `cd backend && mvn test`. `CertificateParserTest` uses the real OCR text of a certificate (`src/test/resources/certificate-ocr.txt`). The image checks run on the synthetic certificates and screenshots of the verifier's tests (`src/test/resources/certificates/`) and expect the verifier's own results; `IdReaderTest` uses the real Tesseract and is skipped where it isn't installed.

## Deploying to rio-server

The game answers on two addresses, same files and same API (`deploy/Caddyfile.snippet`):

- **`e1-kart.ensite.org`**: the official one. Share card, post text, link preview and canonical link all point here. DNS: an `A` record to the server's IP (or a `CNAME` to `e1kart.rrriooo.com`) in the ensite.org zone; if the zone is on Cloudflare, keep it "DNS only" (grey cloud) so Caddy can get the certificate.
- **`e1kart.rrriooo.com`**: debug, for testing where ensite.org is blocked. Not indexed (`X-Robots-Tag`).

Each address is its own site for the browser: the player token (and so the runs from certificates), settings and the installed app are separate on the two. The database is the same: certificates already used, leaderboard and stats are shared.

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
curl https://e1-kart.ensite.org/api/config
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
