# Judhūr (جذور)

A personal Arabic learning system for a native English speaker with ADHD, built around
root-family vocabulary and personally meaningful input.

**The spec of record is [`docs/judhur-design-doc.md`](docs/judhur-design-doc.md).**
Its §10 defines the build sequence; requirements are tagged `[R-n]` and are binding.
Do not add features that are not in the doc — scope growth is this project's dominant
failure mode (§11.6).

## Current build step

| Step | Deliverable | Status |
|---|---|---|
| 1 | v0 single-file HTML in daily use | ✅ |
| 2 | Content expansion: positional letter forms, ~30 root families, recorded core audio | ✅ code · 🎙 recordings in progress |
| 3 | PWA: installable, offline study loop, offline audio | ✅ code · needs hosting enabled (below) |
| 4 | Backend skeleton + `/state` cross-device sync | ✅ code · needs your own deploy ([backend/README.md](backend/README.md)) |
| 5 | Tier 1 speech: say it, hear back understood / not understood | ✅ code · live ASR needs your deploy (free, §11.9) |
| 6+ | Content pipeline, pronunciation diagnosis | not started |

Building may run ahead of usage per `[R-34]` as amended (design doc v0.7); the hard
stop is `[R-38]` — if the 30-day heatmap drops below 15 active days, building halts.

## Using the app

Two ways to run it:

1. **Hosted (recommended, enables install + offline):** enable GitHub Pages once —
   repo **Settings → Pages → Deploy from a branch → `main` / `/ (root)`** — then visit
   `https://<user>.github.io/judhur/`.
2. **From disk:** open `index.html` in any browser (`file://` works). No server, no
   build step. The service worker is skipped on `file://`, so audio needs the `audio/`
   folder alongside the file and there's no home-screen install — fine as a fallback.

Progress persists in `localStorage` either way.

Keyboard shortcuts: **Space** reveals a card, **1–4** grades it, **Esc** exits the session.

### Which devices does this work on?

There is **one app for everything** — no "Android version" or "iPhone version." It's a
web app you install from a link, so it runs anywhere a modern browser runs. That said,
platforms are not all equal (design doc §11.8):

| Your device | How well it works | How to install |
|---|---|---|
| **Android phone** (Chrome) | ✅ Fully supported & tested | Open the app link in Chrome → tap the ⋮ menu → **Add to Home screen** |
| **Windows / Mac / Linux** (Chrome, Edge, Brave) | ✅ Fully supported & tested | Just use the link — or click the install icon in the address bar for a windowed app |
| **iPhone / iPad** | ⚠️ Should work, but untested | Open the link **in Safari** → Share button → **Add to Home Screen** |
| Firefox (any platform) | ⚠️ Should work, but untested | Use the link directly; install support varies |

**A note for iPhone users:** installing Chrome from the App Store won't change your
tier — Apple requires every browser on iOS, Chrome included, to run on Safari's engine
underneath, and installing to the home screen goes through Safari regardless. The app
sticks to web standards, so it will most likely work fine — it just isn't part of the
tested platforms, and quirks get fixed as they're reported rather than hunted in
advance.

**After installing (any platform):** open **Progress → Audio coverage → Check
recordings** once while online — that pulls every available audio clip onto your
device. From then on the whole study loop, audio included, works in airplane mode.

### Storage & sync

- **This repo is the source of truth** for the app and recordings; each device holds a
  cache (`[R-12]` requires core audio on-device — hearing words is part of the offline
  loop). Deployed updates arrive on the next online visit (navigation is network-first).
- **Cross-device sync is opt-in.** Deploy your own free backend once — there's a
  one-click button and a plain-language, no-terminal guide in
  **[backend/README.md](backend/README.md)** (~10 minutes). Then on each device open
  **Progress → Sync across devices** and paste your backend's web address + password.
  Devices merge review histories per card — the higher rep count wins, streaks recompute
  from the union of study days. Unconfigured or offline, nothing changes: progress stays
  local and the app never blocks on the network.

## Audio: recorded human audio drop-in convention

Per `[R-24]`, the 28 letters and core vocabulary must use **recorded human audio, never
TTS** — pharyngeal and uvular consonants are where synthesis is least trustworthy and
exactly what the learner most needs to imitate. Recording is a `[HUMAN]` task; the app
ships with the playback slots wired and empty.

To add recordings, drop files here (next to the HTML file):

```
audio/
  letters/<letter-key>.mp3     e.g. audio/letters/alif.mp3, audio/letters/ba.mp3
  words/<card-id>.mp3          e.g. audio/words/w-ktb-1.mp3
```

**What to record: 146 clips — one per letter (28) and one per word (118).** Roots
themselves are not recorded; each *word* in a family gets its own clip. The full list
with exact filenames is [`content/recording-list.md`](content/recording-list.md) —
hand it to the speaker as-is.

- **Letters**: the letter's name, then its bare sound — "بَاء … بْ". Phase 0 gates on
  *producing* sounds, so the isolated sound matters as much as the name.
- **Words**: the word once, clearly, in careful MSA, exactly as diacritized.
- The app's **Progress → Audio coverage** view probes which files are present and
  lists what's missing — use it to track the recording effort.
- A card with no audio file shows a muted icon and works normally otherwise.
- Format: mp3 (Safari + Chrome, plays from `file://`). Mono, any reasonable bitrate.
- Suggested sources: a native speaker recording directly (a tutor hired per design doc
  §12.5 can do this), or curated clips from Common Voice Arabic (check license
  attribution if redistributing).
- **Commit finished recordings to this repo** — that's what makes them authoritative
  and shared with every copy of the project.

## Sharing / running your own copy

The system is **single-learner by design, shared by replication** (design doc §11.7).
Progress lives in each browser's `localStorage`, so today anyone can open the HTML file
(or a hosted copy) and get fully independent streaks, XP, and review schedules.

From build step 4 onward, the cloud features (content pipeline, pronunciation
assessment, cross-device sync) require a personal backend: fork this repo, one-click
deploy the serverless backend, and enter **your own API keys** as environment variables
in your deployment. The app itself never holds API keys — only the URL and access token
of *your* backend. No accounts, no shared infrastructure, no one else's bill.

## Speaking practice (Tier 1)

With a backend configured, every revealed card in a session shows a **mic button**:
tap, say the word (or the letter's name), tap again — the app answers **understood**
or **not understood**, with what the listener heard. Notes:

- It is a *yes/no intelligibility check*, deliberately never a score or percentage.
  A "not understood" can be the speech model's fault, not yours — the wording says so.
- Audio goes **only to your own backend**, which runs Whisper on Cloudflare's free
  daily allocation (design doc §11.9). Nothing is stored; nothing goes to a third
  party you didn't deploy.
- No mic button appears until you configure sync + backend; declining mic permission
  turns the feature off and affects nothing else.

## Content accuracy note `[HUMAN]`

The Step 2 vocabulary (≥30 root families, ≥90 fully diacritized MSA words) was
hand-curated from standard high-frequency vocabulary **without** the design doc's §6
verification pipeline, which doesn't exist yet (build step 10). A native-speaker review
pass over `content/` belongs on the `[HUMAN]` track alongside the reviewer search (§12).

## Repository layout

```
index.html                  the app — single self-contained page, embedded data
sw.js                       service worker: offline app shell + audio cache
manifest.webmanifest        PWA manifest
icons/                      app icons
backend/                    optional self-hosted helper (sync + speech); setup guide inside
wrangler.jsonc              Cloudflare Worker config for the backend
docs/judhur-design-doc.md   the spec of record
content/                    content authoring source (JSON), embedded into the HTML
audio/                      recorded human audio (drop-in; commit recordings so they follow the repo)
```

Deploy note: when a change lands that should update installed clients' cached shell,
bump `VERSION` in `sw.js` (navigations are network-first anyway, so the app page
itself refreshes on the next online visit regardless).
