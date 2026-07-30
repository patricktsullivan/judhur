# Setting up syncing and speaking practice

**You do not need this to study.** Letters, words, and spaced-repetition practice all
work with nothing set up here. This adds two optional extras:

- your progress **following you between phone and computer**, and
- the **"say it out loud" check** in practice sessions.

Both need a small free helper (a "backend") that **you run on your own account** — so
nobody shares a bill and nobody sees anyone else's data. Setting it up costs **$0** and
takes about ten minutes, once.

## What you'll end up with

Four things. No matter which method below you pick, these are what's really happening:

1. A **free Cloudflare account** (an email and password — no credit card).
2. Your **own copy of the helper** running on it.
3. A **password you make up** — write it down. You'll type it on each device to link
   them. (It's called `SYNC_TOKEN`. Treat it like any password: long-ish, private,
   memorable to you.)
4. **Two things pasted into the app**: a web address, and that password.

Pick **one** of the three methods below. The first is easiest.

---

## Method 1 — the one-click button (easiest)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/patricktsullivan/judhur)

1. **Click the button above.** Sign in to Cloudflare, or make a free account (no card).
2. Cloudflare makes its own copy of this project on your account and **sets up the
   storage for you**. Follow the on-screen steps — the suggested defaults are fine.
3. When it asks for **`SYNC_TOKEN`**, type the **password** from step 3 above.
   Write it down now if you haven't.
4. When it finishes, it shows a **web address** ending in `.workers.dev`
   (like `https://judhur-backend.yourname.workers.dev`). **Copy it.**
5. In the app, open **Progress → Sync across devices**, paste the **web address** and
   your **password**, and tap **Save & sync**.
6. On your **other device**, do step 5 again with the **same web address and password**.
   That's what links them.

> If the button never asks you for a password, that's fine — finish the deploy, then add
> it the way Method 2 describes in its last step ("Set your password"), and continue.

---

## Method 2 — Cloudflare's website (no button, no typing commands)

Use this if the button gives you trouble, or you'd rather click through the site
yourself. Cloudflare occasionally renames things, so match the nearest wording you see.

1. **Make a free account** at [dash.cloudflare.com](https://dash.cloudflare.com) (no card).
2. **Connect this project.** Go to **Workers & Pages → Create → Import a repository**,
   and choose your copy of this repo (fork it on GitHub first if needed). Deploy it —
   the storage and speech pieces are described in the project's config and set up for you.
3. **Set your password.** Open the new Worker → **Settings → Variables and Secrets** →
   add a **Secret** named exactly `SYNC_TOKEN`, with your made-up password as the value.
   Save, and if prompted, redeploy.
4. **Copy the web address** shown for the Worker (ends in `.workers.dev`).
5. In the app: **Progress → Sync across devices**, paste the web address and password,
   **Save & sync** — then repeat on your other device with the same two values.

---

## Method 3 — command line (for developers)

<details>
<summary>Expand if you're comfortable in a terminal.</summary>

Prerequisites: a free Cloudflare account and Node.js.

```sh
npx wrangler login                              # authenticate
npx wrangler kv namespace create JUDHUR_KV      # copy the printed id...
#   ...paste it into wrangler.jsonc, replacing REPLACE_WITH_YOUR_KV_NAMESPACE_ID
npx wrangler deploy                             # prints your https://...workers.dev URL
npx wrangler secret put SYNC_TOKEN              # paste your password when prompted
```

`SYNC_TOKEN` is declared as a required secret in `wrangler.jsonc`, so if the first
deploy complains it's missing, set it with the last command and run `deploy` again.
Then paste the URL + token into **Progress → Sync across devices** on each device.

</details>

---

## What the helper serves

| Endpoint | Method | Purpose |
|---|---|---|
| `/state` | GET | Returns the stored learner profile (or `null`) |
| `/state` | PUT | Stores the learner profile (JSON, ≤512 KB) |
| `/assess` | POST | Tier 1 intelligibility: `{expected, audio(base64)}` → `{understood, heard}` via Workers AI Whisper (`task:"transcribe"`, `language:"ar"`). Free daily allowance; no audio stored. Never returns a score. |
| `/ingest` `/generate` `/verify` `/speak` | — | `501` stubs — arrive in later build steps (design doc §4, §10) |

Every request needs your password (`Authorization: Bearer <SYNC_TOKEN>`). With no
password set, the helper refuses everything — it never runs open.

## Notes

- **Merging happens in the app**, not here: each device pulls, merges its study history,
  and pushes back. The helper is deliberately simple storage ([R-42]).
- Later features (content generation, pronunciation) will add their own API keys here as
  Cloudflare secrets — never in the app itself ([R-10], [R-41]).
- **This is per-person.** You, and each classmate, run a separate copy. Nobody pays for
  or can see anyone else (design doc §11.7).
