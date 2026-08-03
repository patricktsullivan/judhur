# Backend — developer reference

> End users turning on syncing or speech should read **[SETUP.md](SETUP.md)**. This file
> is the technical reference.

A single Cloudflare Worker (`worker.js`) provides the app's optional cloud features. The
study app in `index.html` is fully usable without it. Each learner deploys their own
Worker; there is no shared infrastructure, key, or data (design doc §11.7).

## Endpoints

All requests require `Authorization: Bearer <SYNC_TOKEN>` (timing-safe compare). With
`SYNC_TOKEN` unset, the Worker rejects everything — it never runs open ([R-41]). State
merging is done in the client; the Worker is deliberately dumb storage ([R-42]).

| Endpoint | Method | Purpose |
|---|---|---|
| `/state` | GET / PUT | Read or store the learner profile (JSON, ≤512 KB). Single key, single learner by design. |
| `/assess` | POST | Pronunciation. `{expected, audio(base64), coach?}`. With Azure configured: per-phoneme scoring via Azure Pronunciation Assessment (`ar-SA`), returning `PronScore` plus phonemes scored below threshold, and optional LLM articulatory coaching from the flagged list only. Without Azure: Workers AI Whisper intelligibility, `{understood, heard}`, never a score ([R-23]). Output is provisional ([R-20][R-31]). |
| `/tts` | POST | `{text}` → MP3 of the word in a neural Arabic voice (Azure). `501` when Azure isn't configured; the client then uses the device's own voice. |
| `/ingest` | POST | `{url}` or `{text}` → `{title, excerpt, source_ref}`. Extracts article text. Extraction failures return a specific `reason` ([R-13]). |
| `/generate` | POST | `{excerpt, profile}` → graded, fully-diacritized MSA `{arabic, transliteration, english_gloss, new_words[], grammar_notes}`. Single-model pass; no cross-vendor verification yet (§6.3). |
| `/verify` `/speak` | — | `501` — later build steps (§4, §10). |

## Deploy

One-click, from the repo: the **Deploy to Cloudflare** button (see SETUP.md) copies the
repo to the user's GitHub, connects Workers Builds for auto-deploy on every push, reads
`wrangler.jsonc` to provision the KV namespace and Workers AI binding, and exposes the
`*.workers.dev` URL. It does **not** set `SYNC_TOKEN`; that one post-deploy step is
unavoidable (see below).

From the command line:

```sh
npx wrangler login
npx wrangler kv namespace create JUDHUR_KV     # paste the id into wrangler.jsonc
npx wrangler secret put SYNC_TOKEN             # encrypted secret
npx wrangler deploy                            # prints the https://…workers.dev URL
```

## Configuration and the reasoning behind it

- **`SYNC_TOKEN` is a Secret, not a config variable, and is not declared `required`.**
  The deploy wizard's "variable" fields are build-time variables — they feed the build
  container, not the Worker's runtime `env`, so a token entered there yields a 401 at
  runtime. It must be set as a runtime Secret on the Worker after deploy. Declaring it
  `required` only made the build fail before the user could reach that step.

- **One KV namespace per learner, reused across their redeploys.** It holds their
  progress. A second deploy on the same account collides on the namespace name; select the
  existing one rather than creating a new one, or the old progress is orphaned.

- **`workers_dev: true`, `preview_urls: false`.** Keep the public URL on for fresh
  deploys; per-version preview URLs aren't needed for a personal backend.

- **Generation model (`/generate`).** Defaults to Workers AI (free, uses the `ai` binding),
  model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Workers AI model ids are retired
  periodically; if generation returns a "model deprecated" error, set `GEN_WAI_MODEL` to a
  current id (no code change). `@cf/qwen/qwen3-30b-a3b-fp8` is a stronger-Arabic option. To
  use a non-Cloudflare model, set `GEN_BASE_URL` (any OpenAI-compatible endpoint),
  `GEN_MODEL`, and `GEN_API_KEY`. Keys live here as Secrets, never in the client
  ([R-10][R-41]).

- **Pronunciation (`/assess`).** Off unless `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`
  are set (then Tier 2; otherwise Tier 1 Whisper). Optional `AZURE_SPEECH_LOCALE` (`ar-SA`
  default, `ar-EG` also valid — §7.6.1). The client sends **16 kHz mono PCM WAV**;
  MediaRecorder's WebM/Opus reached Azure with broken duration metadata and produced
  garbage scores, so WAV is required. `ar-SA` returns per-phoneme scores but empty phoneme
  labels (no SAPI/IPA phone set for Arabic), so flagged sounds are named positionally from
  the reference word's consonant/long-vowel skeleton; when Azure's segment count doesn't
  match the skeleton, the sound is left unnamed rather than guessed. Azure's F0 free tier
  covers single-learner volume.

- **Speech (`/tts`).** Uses the same Azure key. Voice: `AZURE_TTS_VOICE` (default
  `ar-SA-HamedNeural`). The response is `Cache-Control: no-store` because it varies by POST
  body. Azure's `ar-*` neural voices ignore harakat, `<phoneme>`, and `<prosody volume>`,
  and read an isolated word in pausal form (final short vowel dropped: كَتَبَ → "katab").
  That is the natural isolation pronunciation and is accepted as-is; synthetic audio is a
  stopgap until human recordings exist ([R-24]).

## Client behavior worth knowing

- **Audio priority.** Human recording (`audio/words/<a>.mp3`, `audio/letters/<key>.mp3`)
  first; on miss, synthetic voice — Azure `/tts` when the backend is configured (cached
  per word in-session), else the device's Web Speech voice. All synthetic audio is labeled
  synthetic in the UI.
- **Ingested content.** `/generate` output is saved to the client's **Library**, not the
  review deck. New words enter daily reviews only when the learner opts them in
  (per word or per passage).
- Existing deployments are point-in-time copies with auto-deploy on push. Re-sync from
  `patricktsullivan/judhur` to pick up new endpoints; the app served by GitHub Pages
  updates on reload (the service worker is network-first for the page).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `404` from the Worker URL | `*.workers.dev` route disabled | Worker → Settings → Domains & Routes → enable `*.workers.dev` |
| `401` on every request | `SYNC_TOKEN` unset, or app token ≠ Worker secret | Set/align the Secret |
| `required secrets have not been set` at deploy | Old config declared `SYNC_TOKEN` required | Pull latest `wrangler.jsonc` |
| KV name "already exists" at deploy | Namespace exists on this account | Select the existing namespace; don't create a new one |
| Generation: "model was deprecated" | Workers AI retired the default model | Set `GEN_WAI_MODEL` to a current id |
