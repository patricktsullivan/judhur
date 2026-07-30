# Setting up syncing and speaking practice

**You do not need this to study.** Letters, words, and spaced-repetition practice all
work with nothing set up here. This adds two optional extras:

- your progress **following you between phone and computer**, and
- the **"say it out loud" check** in practice sessions.

Both run on a small free helper (a "backend") that **you host on your own account** — so
nobody shares a bill and nobody sees anyone else's data. It costs **$0** and takes about
ten minutes, once.

---

## Before you start

You'll need **two free accounts** (no credit card for either) and **one password you
make up**.

1. **A GitHub account.** Not everyone has one — if you don't, sign up at
   [github.com/signup](https://github.com/signup) (two minutes). This is where your own
   copy of the project will live.
2. **A Cloudflare account.** Sign up with your email at
   [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). This is what runs
   the helper.
   - *Tip:* after your email account exists, Cloudflare lets you turn on **"Sign in with
     GitHub"** so you're not remembering a second password. You can't create the account
     with GitHub alone — email first, then link it if you like.
3. **A password you invent**, for linking your devices (its name is `SYNC_TOKEN`).
   Write it down — you'll type it on each device, and once into Cloudflare.

The setup below connects these two accounts for you (it asks Cloudflare for permission to
create the copy on your GitHub). You only sign up once each.

---

## What the one-click button actually does

Clicking **Deploy to Cloudflare** isn't magic — it makes a handful of specific choices on
your behalf. In plain terms, it:

- **Copies this project into your own GitHub** as a new repository called
  `judhur-backend`. You own that copy. *(This is the whole sharing model: everyone runs
  their own, nobody pays for or sees anyone else — design doc §11.7.)*
- **Connects that copy to Cloudflare** so it deploys automatically now, and re-deploys by
  itself whenever the copy changes.
- **Reads the project's settings file** (`wrangler.jsonc`) and sets up exactly what it
  asks for, nothing more:
  - a **KV store** — a tiny database holding your progress (one learner, one record);
  - the **Workers AI** connection — the free speech engine for the "say it out loud" check;
  - your **password** (`SYNC_TOKEN`), stored as an encrypted secret;
  - a free **web address** ending in `.workers.dev`, switched on.
- **Publishes** the helper and shows you that web address.

Why these particular choices: KV is the simplest free storage for a single person's data;
Workers AI gives speech with no second account to create; a separate copy per person keeps
your data and spending entirely yours; and the password stops anyone else from using (and
billing) your helper.

---

## Method 1 — the one-click button (easiest)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/patricktsullivan/judhur)

1. **Click the button above.** Sign in to Cloudflare (or make the free account from
   *Before you start*).
2. **Authorize GitHub** when asked, and pick your account, so Cloudflare can create your
   `judhur-backend` copy.
3. **Set your password now — this is what makes it build the first time.** On the setup
   screen, open **advanced options / environment variables / secrets**, and add one:
   - **name:** `SYNC_TOKEN`
   - **value:** the password you invented
   - if it offers an **encrypt / secret** choice for the value, pick that.

   (The helper refuses to run without a password, so setting it here lets the very first
   build succeed instead of failing and making you retry.)
4. **Finish deploying.** It shows a **web address** ending in `.workers.dev`
   (like `https://judhur-backend.yourname.workers.dev`). **Copy it.**
5. In the app, open **Progress → Sync across devices**, paste the **web address** and your
   **password**, and tap **Save & sync**.
6. On your **other device**, do step 5 again with the **same web address and password**.
   That's what links them.

> ⚠️ **Always store `SYNC_TOKEN` as an encrypted _secret_, never a plain-text variable.**
> A plain variable is printed in your build logs *and* gets erased the next time the
> project auto-deploys — which silently breaks syncing later. A secret stays hidden and
> survives every deploy. If the setup only gave you a plain "variable" field, fix it
> afterward: Worker → **Settings → Variables and Secrets**, delete the plain one, re-add
> `SYNC_TOKEN` as a **Secret**.

> **If the build fails saying `SYNC_TOKEN` is required**, you skipped step 3. Add it as a
> Secret the way the warning above describes, then hit **Retry deploy**.

---

## Method 2 — command line (for developers)

<details>
<summary>Expand if you're comfortable in a terminal.</summary>

Prerequisites: the two accounts above, plus Node.js. This deploys straight from your
local clone — no GitHub copy or auto-deploy involved.

```sh
npx wrangler login                              # authenticate with Cloudflare
npx wrangler kv namespace create JUDHUR_KV      # copy the printed id...
#   ...paste it into wrangler.jsonc, replacing REPLACE_WITH_YOUR_KV_NAMESPACE_ID
npx wrangler secret put SYNC_TOKEN              # paste your password when prompted
npx wrangler deploy                             # prints your https://...workers.dev URL
```

Notes:
- Set the secret **before** the first deploy (as ordered above). `SYNC_TOKEN` is declared
  required in `wrangler.jsonc`, so a deploy without it fails on purpose rather than
  running open.
- `wrangler secret put` always stores an encrypted secret — the safe kind.
- `workers_dev: true` in the config keeps the public `.workers.dev` address on, so the URL
  works immediately.
- Then paste the URL + token into **Progress → Sync across devices** on each device.

</details>

---

## Troubleshooting

| The app says… | What it means | Fix |
|---|---|---|
| **backend error 404** | The Worker's `*.workers.dev` address is turned off, so requests never reach it. | Worker → **Settings → Domains & Routes** → enable the `*.workers.dev` route. (Fresh deploys from this project keep it on automatically; a Worker created earlier may need the toggle once.) Also confirm the pasted address ends in `.workers.dev` with nothing after it. |
| **token rejected by backend** (401) | The password in the app doesn't match the `SYNC_TOKEN` secret on the Worker. | Re-enter the same password in the app on every device; if unsure, set a fresh secret and use that. |
| **sync unavailable** | Usually just offline, or the web address is mistyped. | Check the address, and that you have a connection. Progress is safe locally regardless. |

---

## What the helper serves

| Endpoint | Method | Purpose |
|---|---|---|
| `/state` | GET | Returns the stored learner profile (or `null`) |
| `/state` | PUT | Stores the learner profile (JSON, ≤512 KB) |
| `/assess` | POST | Tier 1 intelligibility: `{expected, audio(base64)}` → `{understood, heard}` via Workers AI Whisper (`task:"transcribe"`, `language:"ar"`). Free daily allowance; no audio stored. Never returns a score. |
| `/ingest` `/generate` `/verify` `/speak` | — | `501` stubs — arrive in later build steps (design doc §4, §10) |

Every request needs your password (`Authorization: Bearer <SYNC_TOKEN>`). With no password
set, the helper refuses everything — it never runs open.

## Notes

- **Merging happens in the app**, not here: each device pulls, merges its study history,
  and pushes back. The helper is deliberately simple storage ([R-42]).
- Later features (content generation, pronunciation) will add their own API keys here as
  Cloudflare secrets — never in the app itself ([R-10], [R-41]).
- **This is per-person.** You, and each classmate, run a separate copy. Nobody pays for or
  can see anyone else (design doc §11.7).
