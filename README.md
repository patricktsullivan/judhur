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
| 1 | v0 single-file HTML in daily use | ✅ (see `judhur-arabic-study.html`) |
| 2 | Content expansion: positional letter forms, ~30 root families, recorded core audio | 🔨 in progress |
| 3+ | PWA, backend, pipeline, pronunciation | not started — gated by `[R-34]` (14 days of daily use per step) |

## Using the app

Open `judhur-arabic-study.html` in any browser — directly from disk (`file://`) works;
no server, no network, no build step. Progress persists in `localStorage`.

Keyboard shortcuts: **Space** reveals a card, **1–4** grades it, **Esc** exits the session.

### How storage works at the current stage (pre-PWA)

- **The app**: the HTML file alone is the complete app. Audio is looked up by relative
  path, so for sound a device also needs the `audio/` folder sitting next to the file.
  Without it, everything works and play buttons show muted — nothing breaks.
- **Authoritative copies**: this git repo is the source of truth for the app *and* the
  recordings. A device's copy (including audio) is a cache. Per `[R-12]`, core audio
  *must* end up cached on-device — hearing a word is part of the offline study loop —
  so "audio on the device" is by design, not an accident of the current stage.
- **Progress is per-browser.** Phone and desktop do not sync yet, and won't until build
  step 4 (`/state`). Until then, study on one primary device — the `[R-34]` 14-day gate
  only needs one — or accept independent streaks.
- **What changes at step 3 (PWA)**: the app gets hosted at a URL; visiting it installs
  it, and a service worker caches the app and audio automatically. Manually copying
  files to a device stops being a thing. Step 4 then adds cross-device progress sync.

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

## Content accuracy note `[HUMAN]`

The Step 2 vocabulary (≥30 root families, ≥90 fully diacritized MSA words) was
hand-curated from standard high-frequency vocabulary **without** the design doc's §6
verification pipeline, which doesn't exist yet (build step 10). A native-speaker review
pass over `content/` belongs on the `[HUMAN]` track alongside the reviewer search (§12).

## Repository layout

```
judhur-arabic-study.html    the app — single self-contained file, embedded data
docs/judhur-design-doc.md   the spec of record
content/                    content authoring source (JSON), embedded into the HTML
audio/                      recorded human audio (drop-in; commit recordings so they follow the repo)
```
