# Turn on syncing and speaking practice

The study app works on its own with nothing to set up. This guide adds two things:

- your progress on **all your devices**, kept in step, and
- the **microphone check** in speaking practice, which listens to a word you say and
  tells you whether it came through clearly.

It's **free** and takes about **ten minutes**, once.

## What you need

- A **GitHub account** — free to create at [github.com/signup](https://github.com/signup)
  if you don't have one. You'll sign in with it everywhere below, so there's nothing else
  to sign up for.
- A **password you choose** and write down. You'll type it a few times.

## Steps

**1. Start the setup.** Click this button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/patricktsullivan/judhur)

When it asks you to sign in, **sign in with GitHub**. That also signs you into Cloudflare,
the service that runs your helper — there's no separate account to make.

**2. Let it build.** It makes your own private copy of the helper and gets it running.
Accept the options it suggests and continue.

> If it offers boxes for **variables** along the way, **leave them empty.** Your password
> goes in during the next step, directly on the helper. A password entered here looks
> accepted but won't take effect.

When it finishes, it shows a web address ending in **`.workers.dev`**. **Copy it and keep
it somewhere** — you'll need it in step 4.

**3. Set your password.** In Cloudflare, open **Workers & Pages** (it may sit under a
**Compute** menu) and open the worker named **`judhur-backend`**. Then:

- Open **Settings → Variables and Secrets**.
- Click **Add**.
- Name: type exactly **`SYNC_TOKEN`**.
- Value: type **your password**.
- Turn on the **Encrypt** (Secret) option.
- Click **Save**.

**4. Connect the app.** Open the study app → **Settings → Sync across devices**. Paste in
the **web address** and your **password**, then tap **Save & sync**.

**5. Repeat step 4 on your other device**, using the same web address and password. That's
what links them.

Done. Your progress now travels with you, and speaking practice has a microphone button.

## If something isn't working

- **"backend error 404."** The web address is switched off. In Cloudflare, open
  **`judhur-backend` → Settings → Domains & Routes** and switch **on** the address ending
  in `.workers.dev`. Then tap **Save & sync** again.
- **"token rejected."** The password in the app doesn't match the one set in Cloudflare.
  Use the same password in both places.
- **A storage name is "already taken."** You've set this up before. Pick the existing name
  from the list and continue.
- **Still stuck?** Nothing is lost — your progress is always safe on each device even
  without syncing. You can try again anytime.

---

## Optional: spoken words and sharper pronunciation feedback (Azure)

Everything above works without this. Two extras become available when you add a Microsoft
Azure speech key:

- **A spoken voice** for words that don't have a human recording yet. It's marked
  *synthetic*, and a real recording replaces it later. A word on its own is read the way
  it's said in isolation, so a final short vowel isn't sounded (كَتَبَ is read "katab").
- **Per-sound pronunciation scoring** in speaking practice — a 0–100 score for a word and,
  when a sound comes out weak, which sound it was.

**About cost.** Azure asks for a credit card to open the account, for identity checks. The
**Free (F0)** speech tier does not charge that card: it's capped well above one learner's
use and simply stops at the cap. The only way to be billed is to pick the paid **S0** tier
by mistake. Choose **F0** and there is no charge. If a required card is a dealbreaker, skip
this section — speaking practice still works without it.

Steps (pair these with Microsoft's illustrated quickstart:
<https://learn.microsoft.com/azure/ai-services/speech-service/get-started>):

1. Create an Azure account at [azure.microsoft.com/free](https://azure.microsoft.com/free)
   (a credit card is required to verify it).
2. In the [Azure portal](https://portal.azure.com): **Create a resource** → search for
   **Speech** → **Create**.
3. On the form:
   - **Resource group:** Create new, name it e.g. `judhur`.
   - **Region:** one near you, e.g. **East US** — note it down.
   - **Name:** any unique name, e.g. `judhur-speech`.
   - **Pricing tier:** **Free F0** — this is the choice that matters, not S0. (One F0 per
     region per account; if it's taken, pick another region.)
4. **Review + create → Create**, wait about a minute, then **Go to resource**.
5. Open **Keys and Endpoint** and copy:
   - **KEY 1** → your `AZURE_SPEECH_KEY`.
   - the region from the endpoint (`https://eastus.api…` → `eastus`) → your
     `AZURE_SPEECH_REGION`. Use the short lowercase form, not "East US".
6. In Cloudflare → **`judhur-backend` → Settings → Variables and Secrets**, add two
   **Secrets** (encrypted, like your password): `AZURE_SPEECH_KEY` and
   `AZURE_SPEECH_REGION`. Save.
7. Reload the app. Words now speak, and speaking practice shows which sounds to work on.

Pronunciation feedback is a helpful hint, not a verdict — it's marked provisional until a
native speaker has confirmed it.
