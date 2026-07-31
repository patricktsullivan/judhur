# Backend — developer reference

> **Just want to turn on syncing/speech as a user? → [SETUP.md](SETUP.md).**
> This file is the technical reference for maintainers and contributors.

A single Cloudflare Worker (`worker.js`) providing the optional cloud features. The study
app is fully usable without it; it adds cross-device state sync (`/state`) and Tier 1
speech intelligibility (`/assess`). Per design doc §11.7, each learner deploys their own —
no shared infrastructure, keys, or data.

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/state` | GET | Return the stored learner profile (or `null`) |
| `/state` | PUT | Store the learner profile (JSON, ≤512 KB) |
| `/assess` | POST | Tier 1 intelligibility: `{expected, audio(base64)}` → `{understood, heard}` via Workers AI Whisper (`task:"transcribe"`, `language:"ar"`). Free daily allowance; no audio stored. Never a score ([R-23]). |
| `/ingest` | POST | `{url}` or `{text}` → `{title, excerpt, source_ref}`. Extracts article text (paste + article URLs; YouTube not yet). Extraction failures return a specific `reason` ([R-13]). |
| `/generate` | POST | `{excerpt, profile}` → graded fully-diacritized MSA `{arabic, transliteration, english_gloss, new_words[], grammar_notes}`. Tier-1 verification = single pass, no cross-vendor check yet (§6.3). |
| `/verify` `/speak` | — | `501` stubs — later build steps (§4, §10) |

Auth on every request: `Authorization: Bearer <SYNC_TOKEN>` (timing-safe compare). If
`SYNC_TOKEN` is unset the Worker refuses everything — it never runs open ([R-41]).
Merging is done client-side; the Worker is deliberately dumb storage ([R-42]).

## What the one-click deploy button does

`https://deploy.workers.cloudflare.com/?url=<repo>` — on click it:

1. Copies this repo into the user's GitHub as `judhur-backend` and connects it for
   auto-deploy (Workers Builds).
2. Reads `wrangler.jsonc` and provisions declared resources: a **KV namespace**
   (`JUDHUR_KV`, progress storage) and the **Workers AI** binding (`AI`, speech).
3. Deploys and exposes the `*.workers.dev` URL (kept on via `workers_dev: true`).

It does **not** set the runtime secret. Confirmed by testing: the deploy wizard's
"variable name / value" fields (even with encrypt on) are **build-time** variables — they
feed the build container, not the Worker's runtime `env`, so a `SYNC_TOKEN` entered there
yields a 401 at runtime. The token must be set as a runtime secret **on the Worker**
(Settings → Variables and Secrets, or `wrangler secret put`) *after* deploy. This is why
`SYNC_TOKEN` is not declared `required` in config — doing so only made the build fail
before the user could reach that step. One post-deploy step is unavoidable through the
button.

## Deploy from the command line

Prerequisites: a Cloudflare account and Node.js.

```sh
npx wrangler login
npx wrangler kv namespace create JUDHUR_KV      # paste the id into wrangler.jsonc
npx wrangler secret put SYNC_TOKEN              # encrypted secret; the safe way
npx wrangler deploy                             # prints the https://...workers.dev URL
```

## Configuration notes (`wrangler.jsonc`)

- **`kv_namespaces`** — one namespace per learner, **reused across their redeploys** (the
  same store holds their progress). The button provisions it named after the Worker; a
  second deploy on the same account collides on that name — select the existing namespace
  from the dropdown rather than creating a new one, or you orphan the data.
- **`ai`** — Workers AI binding; no resource to provision.
- **`workers_dev: true` / `preview_urls: false`** — keep the public URL on for fresh
  deploys; skip per-version preview URLs (unneeded for a personal backend).
- **`SYNC_TOKEN`** — set as a Secret (dashboard or `wrangler secret put`), **not** declared
  in config. Storing it as a plain variable is unsafe: it appears in build logs and is
  wiped when a repo auto-deploy uploads config with no matching var. A Secret is hidden
  and survives every deploy.
- **Generation model (`/generate`)** — defaults to **Workers AI** (free, zero-config; uses
  the `ai` binding). Its Arabic/diacritics are the roughest of the options, so generated
  content especially warrants the native-speaker review (README content note). To use a
  stronger model, set these Worker secrets/vars and no code changes are needed:
  `GEN_BASE_URL` (any OpenAI-compatible endpoint, e.g. Gemini's or Groq's), `GEN_MODEL`,
  and `GEN_API_KEY`. Optionally `GEN_WAI_MODEL` overrides the Workers AI model id. Keys
  live here as secrets, never in the client ([R-10], [R-41]).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `404` from the Worker URL | `*.workers.dev` route disabled on an existing Worker | Worker → Settings → Domains & Routes → enable `*.workers.dev` (fresh deploys keep it on via config) |
| `401` on every request | `SYNC_TOKEN` unset, or app token ≠ Worker secret | Set/align the secret |
| Deploy: `required secrets have not been set` | An older config still declared `SYNC_TOKEN` required | Pull latest `wrangler.jsonc` (requirement removed), or set the secret and redeploy |
| KV name "already exists" on deploy | Re-deploying on an account that already has the namespace | Select the existing namespace; do not create a new one |

## Notes

- Later features (generation, pronunciation) add their own API keys here as Cloudflare
  secrets — never in the client ([R-10], [R-41]).
- Existing deployments are point-in-time copies; they don't auto-receive changes pushed to
  this source repo. Re-sync from `patricktsullivan/judhur` to pick up new endpoints.
