# Judhūr backend — deploy your own

Per design doc §11.7, every learner runs their **own** backend with their **own**
credentials. Nothing here is shared infrastructure. The Cloudflare free tier is far
more than one learner needs.

## Deploy (≈5 minutes, once)

Prerequisites: a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and
Node.js installed.

From the repo root:

```sh
# 1. authenticate wrangler with your Cloudflare account
npx wrangler login

# 2. create the storage namespace; copy the printed id
npx wrangler kv namespace create JUDHUR_KV

# 3. paste that id into wrangler.toml (replace REPLACE_WITH_YOUR_KV_NAMESPACE_ID)

# 4. deploy — the output prints your backend URL, e.g.
#    https://judhur-backend.<your-subdomain>.workers.dev
npx wrangler deploy

# 5. set your private sync token (invent a long random string; you'll paste
#    the same string into the app's sync settings)
npx wrangler secret put SYNC_TOKEN
```

Then open the app → **Progress → Sync**, paste the backend URL and the same token,
and hit **Sync now** on each device you use.

## What it serves

| Endpoint | Method | Purpose |
|---|---|---|
| `/state` | GET | Returns the stored learner profile (or `null`) |
| `/state` | PUT | Stores the learner profile (JSON, ≤512 KB) |
| `/assess` | POST | Tier 1 intelligibility: `{expected, audio(base64)}` → `{understood, heard}` via Workers AI Whisper (`task:"transcribe"`, `language:"ar"`). Free daily allocation; no audio stored. Never returns a score. |
| `/ingest` `/generate` `/verify` `/speak` | — | `501` stubs — arrive in later build steps (design doc §4, §10) |

All requests require `Authorization: Bearer <SYNC_TOKEN>`. An unset token means the
worker refuses everything — it never runs open.

## Notes

- **Merging happens in the app**, not here: each device pulls, merges review
  histories per card, and pushes the result. The worker is deliberately dumb storage
  ([R-42] — running your own stays a fork-deploy-paste operation, not an ops project).
- API keys for later steps (models, TTS, speech assessment) will also live here as
  Worker secrets — never in the app ([R-10], [R-41]).
