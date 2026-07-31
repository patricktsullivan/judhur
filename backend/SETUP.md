# Turn on syncing and speaking practice

The study app works fine on its own. This adds two extras:

- your progress on **all your devices**, and
- the **"say it out loud"** microphone check in practice.

It's **free** and takes about **ten minutes**, once.

## What you need

- A free **GitHub account**. Don't have one? Make one at
  [github.com/signup](https://github.com/signup) — about two minutes. You'll use it to
  sign in everywhere below, so there's nothing else to sign up for.
- A **password you make up** and write down. You'll type it a few times.

## Steps

**1. Click this button** to start:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/patricktsullivan/judhur)

When it asks you to sign in, **sign in with your GitHub account**. That signs you into
Cloudflare too — you don't need a separate Cloudflare account.

**2. Let it set up.** It makes your own copy of the helper and gets it ready. Accept the
options it suggests and keep going.

> If the setup offers **"variable"** boxes along the way, **leave them blank.** They don't
> set your password — you'll do that in the next step, on the helper itself. (Putting the
> password there looks like it works but won't.)

When it finishes, it shows a **web address that ends in `.workers.dev`**. **Copy it and
keep it somewhere** — you'll need it in step 4.

**3. Set your password.** This is the one spot it has to go. In Cloudflare, find your list
of Workers (look for **"Workers & Pages"**, possibly under a **"Compute"** menu) and open
the one called **`judhur-backend`**. Then:

- Go to **Settings**, then **Variables and Secrets**.
- Click **Add**.
- Name: type exactly **`SYNC_TOKEN`**
- Value: type **your password**.
- Turn on the **Encrypt** / **Secret** option.
- Click **Save**.

**4. Turn on syncing in the app.** Open the study app → **Progress** → **Sync across
devices**. Paste in the **web address** and your **password**, then tap **Save & sync**.

**5. Repeat step 4 on your other device**, using the same web address and password.
That's what links them together.

Done. Your progress now travels with you, and practice sessions have a microphone button
for the "say it out loud" check.

## If something isn't working

- **It says "backend error 404."** Your web address is switched off. In Cloudflare, open
  **`judhur-backend` → Settings → Domains & Routes**, and turn **on** the address that
  ends in `.workers.dev`. Then try **Save & sync** again.
- **It says "token rejected."** The password in the app doesn't match the one you set in
  Cloudflare. Type the **same** password in both places.
- **It says a storage name is "already taken."** You've set this up before. Just pick the
  existing one from the dropdown list and keep going.
- **Still stuck?** Nothing is lost — your progress is always safe on each device even
  without this. You can try again anytime.

---

## Optional: sharper pronunciation feedback (Azure)

**You do not need this.** Speaking practice already works — it tells you whether a word
came through clearly. This *extra* adds per-sound scoring ("your ح was off") and a tip for
fixing each sound. It's the most involved setup here, and the only piece with a paid tier —
so read the safety note first.

> **Cost, honestly:** use the **free "F0" tier**. It needs **no credit card**, and it
> **cannot bill you** — it's capped at 5 audio-hours a month (far more than one learner
> uses) and simply stops at the cap instead of charging. The *only* way to be charged is to
> pick the **"S0"** tier by mistake. Choose **F0** and you are safe.

1. Make a **free Azure account** at [azure.microsoft.com/free](https://azure.microsoft.com/free)
   (sign in with a Microsoft account).
2. In the [Azure portal](https://portal.azure.com) → **Create a resource** → search
   **"Speech"** → **Create**.
3. **Pricing tier: choose Free F0** (this is the one choice that matters — *not* S0). Pick a
   region near you (e.g. **East US**) and note it down.
4. When it finishes, open the resource → **Keys and Endpoint** → copy **KEY 1** and the
   **Location/Region** (like `eastus`).
5. In Cloudflare → your Worker → **Settings → Variables and Secrets**, add two **Secrets**
   (encrypted, like your password):
   - `AZURE_SPEECH_KEY` = the key
   - `AZURE_SPEECH_REGION` = the region (e.g. `eastus`)

   Save. (No redeploy needed.)
6. In speaking practice, you'll now see which sounds to work on and a tip for each.

Notes:
- **One F0 Speech resource per region** per account.
- If your first recording errors with an audio-format complaint, tell the developer — Azure
  may need the audio converted (a known, small fix).
- Feedback here is **provisional** until a native speaker has checked it (design doc §11.3),
  so treat it as a helpful hint, not a verdict.
