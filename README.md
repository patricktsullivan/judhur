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
| 2 | Content expansion: positional letter forms, ~30 root families, recorded core audio | ◑ 28 letters × 4 forms, 118 words / 37 roots · **🎙 no recordings yet** |
| 3 | PWA: installable, offline study loop | ✅ code · needs hosting enabled (below) |
| 4 | Backend skeleton + `/state` cross-device sync | ✅ code · needs your own deploy ([SETUP.md](backend/SETUP.md)) |
| 5 | Tier 1 speech: say it, hear back understood / not understood | ✅ code · live ASR needs your deploy (free, §11.9) |
| 6 | Content pipeline: URL/text → graded Arabic passage, new words into reviews | ✅ code · article + pasted text (YouTube deferred); needs your deploy |
| 7 | Azure per-phoneme pronunciation diagnosis | ◑ built and provisional · **calibration pool not built** (no audio is kept) |
| 8 | LLM articulatory coaching | ✅ code · needs an Azure key |
| 9 | Diacritic fade (full / fade-with-mastery / bare) + register display | ✅ built ahead of 7–8 (client-only, no accounts) |
| 10 | Cross-vendor generation verification + dictionary-grounded roots | not started (needs a 2nd model vendor, and something measuring error rates) |

Not built, and named here because the design doc used to imply otherwise: core audio
(`[R-12]`), the §11.3 calibration pool (`[R-33]`), grapheme↔phoneme alignment
(`[R-21]`), phase tracking (§8), and Egyptian content (§11.1). Design doc v0.13 marks
each in place; `docs/review-2026-08.md` is the review that prompted it.

Building may run ahead of usage per `[R-34]` as amended (design doc v0.7); the hard
stop is `[R-38]` — if the 30-day heatmap drops below 15 active days, building halts.
**Progress → Last 30 days** states that count and says when the floor is breached, so
it is a number to read rather than dots to count.

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

**Offline:** everything except syncing and bringing in content works with no network
— cards, grading, streaks, and the whole session loop, from the first install.

**Audio is the exception, today.** There are no recordings yet, so words are read by
a synthetic voice: your backend's Azure voice if you set one up, otherwise your
device's own Arabic voice, which needs no network but does need your device to have
one installed. Once recordings land in `audio/`, open **Settings → Audio coverage →
Check recordings** once while online to pull them onto your device, and audio works
in airplane mode too. (Design doc `[R-12]` wants those clips shipped rather than
fetched — see its §4.2.)

### Storage & sync

- **This repo is the source of truth** for the app and recordings; each device holds a
  cache (`[R-12]` requires core audio on-device — hearing words is part of the offline
  loop). Deployed updates arrive on the next online visit (navigation is network-first).
- **Cross-device sync is opt-in.** Deploy your own free backend once — simple,
  no-terminal, step-by-step setup is in **[backend/SETUP.md](backend/SETUP.md)**
  (~10 minutes); maintainers, see [backend/README.md](backend/README.md). Then on each
  device open **Settings → Sync across devices** and paste your backend's web address +
  password. Devices merge review histories per card — the higher rep count wins, streaks
  recompute from the union of study days. Unconfigured or offline, nothing changes:
  progress stays local and the app never blocks on the network.

## Audio: drop-in clip convention

**Synthetic clips are the shipped path** (design doc `[R-24]`, amended v0.14). The
146 letter and word clips are meant to be generated once and committed, clearly
labeled synthetic. Human recordings are **deferred to a later version** — they're still
wanted, because synthesis is least trustworthy on exactly the throat consonants a
learner most needs to imitate, but nothing in the build waits on finding a speaker.

Either way the convention is the same: a file at the right path wins. Drop a human
recording in later and it replaces the synthetic clip with no code change.

Files go here (next to the HTML file):

```
audio/
  letters/<letter-key>.mp3     e.g. audio/letters/alif.mp3, audio/letters/ba.mp3
  words/<audio-stem>.mp3       e.g. audio/words/kataba.mp3, audio/words/madrasa.mp3
```

The stem is the word's transliteration, not its card id — the exact filename for every
clip is in the recording list below.

**What to record: 146 clips — one per letter (28) and one per word (118).** Roots
themselves are not recorded; each *word* in a family gets its own clip. The full list
with exact filenames is [`content/recording-list.md`](content/recording-list.md) —
hand it to the speaker as-is. It is generated from the app by
`node tools/sync-content.mjs`, so it stays right as content grows.

These notes apply when a human eventually records them:

- **Letters**: the letter's name, then its bare sound — "بَاء … بْ". Phase 0 gates on
  *recognising* letters and their sounds, not on producing them (design doc §11.10) —
  but the isolated sound is what a learner imitates, so it matters as much as the name.
- **Words**: the word once, clearly, in careful MSA, exactly as diacritized.
- The app's **Settings → Audio coverage** view probes which files are present and
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

The Step 2 vocabulary (37 root families, 118 fully diacritized MSA words) was
hand-curated from standard high-frequency vocabulary **without** the design doc's §6
verification pipeline, which doesn't exist yet (build step 10). A native-speaker review
pass over `content/` belongs on the `[HUMAN]` track alongside the reviewer search (§12).

## Repository layout

```
index.html                  the app — single self-contained page, source of record for content
sw.js                       service worker: offline app shell + audio cache
manifest.webmanifest        PWA manifest
icons/                      app icons
fonts/                      self-hosted webfonts (OFL) — no CDN, so offline is really offline
backend/                    optional self-hosted helper (sync + speech); setup guide inside
wrangler.jsonc              Cloudflare Worker config for the backend
docs/judhur-design-doc.md   the spec of record
docs/review-2026-08.md      outside review that prompted design doc v0.13
content/                    GENERATED export of the app's content — do not hand-edit
audio/                      word and letter clips (drop-in; commit them so they follow the repo)
tools/                      test suite and generators (see below)
LICENSE                     GNU AGPL v3; bundled fonts are OFL 1.1 (fonts/OFL.txt)
```

## Working on it

```sh
node tools/test.mjs             # 120 checks; re-runs across five timezones
node tools/sync-content.mjs     # regenerate content/ + the recording list from index.html
node tools/sync-content.mjs --check   # CI: fail if content/ is stale
node tools/sync-fonts.mjs       # refetch the webfonts (the only tool needing network)
```

No build step and no dependencies — the app is one file you can open from disk. The
content lives in `index.html`; `content/*.json` is generated from it, which is why
editing those files does nothing. CI runs the tests and the content check on push.

Deploy note: when a change lands that should update installed clients' cached shell,
bump `VERSION` in `sw.js` (navigations are network-first anyway, so the app page
itself refreshes on the next online visit regardless).

## Licence

**GNU Affero General Public License v3.0 or later** — see [LICENSE](LICENSE).

The intent is that this stays free for everyone, permanently. In practice that means:

- Use it, copy it, change it, run it — for anything, including teaching.
- **If you publish a changed version you must publish its source under this same
  licence.** The AGPL closes the loophole that lets someone host a modified copy as a
  website without releasing anything: §13 makes running it for others count as
  distributing it.
- Nobody can take this closed. Every fork, and every fork of a fork, stays free.

One honest caveat: no free-software licence can forbid charging money — the AGPL's own
preamble says you may "charge for them if you wish." What it guarantees is that anyone
who pays immediately receives the source with the right to give it away, so there is no
version of this that someone can lock up and sell. If you fork and deploy it, point
`SOURCE_URL` in `index.html` at your own repository so your users can find your source.

The bundled fonts are SIL OFL 1.1 and keep their own terms
([fonts/OFL.txt](fonts/OFL.txt)); the OFL is compatible with distributing them
alongside AGPL software.
