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

- The app's **Audio coverage** view lists every expected filename and which are still
  missing — use it as the recording checklist.
- A card with no audio file shows a muted icon and works normally otherwise.
- Format: mp3 (Safari + Chrome, plays from `file://`). Mono, any reasonable bitrate.
- Suggested sources: a native speaker recording directly, or curated clips from
  Common Voice Arabic (check license attribution if redistributing).

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
