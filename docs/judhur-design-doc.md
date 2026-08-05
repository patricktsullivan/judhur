# Judhūr — Design Document

**A personal Arabic learning system for a native English speaker with ADHD, built around root-family vocabulary and personally meaningful input.**

Version 0.16 · August 2026 *(0.16 resolves [R-51] — the deck now carries both gendered forms — and settles the register question in favour of MSA for now. 0.15 adds §11.1.1, Egyptian as the primary target with the register plumbed end to end, and §6.7, the verification ladder that closes the gap between how pronunciation and generated text were checked. 0.14 amends [R-24] again — synthetic audio is the shipped path and human recordings move to a later version; adds [R-51], gender coverage in vocabulary; relicenses to AGPL-3.0. 0.6 adds §11.7, the sharing model; 0.7 amends [R-34] — building may run ahead of usage, [R-38] remains the hard stop; 0.8 adds §11.8, Chromium-first platform support; 0.9 adds §11.9, free-first cost policy + Tier 1 ASR choice; 0.10 adds §11.10, letters recognition-only + standalone words-only speaking; 0.11 amends [R-24] — labeled synthetic audio may fill in until a human recording exists; 0.12 adds §7.5.1, measured Azure TTS limits + pausal decision, and refreshes §3 to the current build; 0.13 corrects claims this document made about its own implementation — see below)*

**0.13 is a correction pass, not new design.** An outside review (`docs/review-2026-08.md`) found several places where this document described requirements as met that were not, and one place where it asserted something factually untrue about its own protocol. Those are corrected in place, and where a fix landed in code the section says so. The substantive changes: §3 and §10 no longer overstate what is built; §11.3 and §14 no longer claim that delaying the reviewer search costs no data (it currently costs data, because no audio is retained); §7.5 records the TTS engine actually in use; §2.4 gets the evidence caveat §2.3 already had; §8 and §11.1 are marked descriptive rather than built; the word count is corrected from 146 to 118. **No requirement was weakened to match the implementation.** Where the two disagreed, the requirement stands and the gap is named.

---

## 0. How to use this document

**For an implementing agent (Claude Code or equivalent):**

- **§10 is the work.** It defines build steps in order, each with acceptance criteria. Build one step at a time. Do not begin a step before its predecessor meets its acceptance criteria.
- **Requirements are tagged `[R-n]` and use MUST / MUST NOT / SHOULD.** These are binding. Where a requirement conflicts with a convenient implementation, the requirement wins — or the conflict gets raised, not silently resolved.
- **Sections 2, 6, 7, and 11 are rationale.** They explain why the requirements are what they are. Read them before proposing changes to any decision. Several decisions here look arbitrary and are not; several look like they could be improved by adding capability and would be made worse by it.
- **§14 is the decision index.** If a proposed change contradicts a row in that table, stop and flag it.
- **Do not add features not specified here.** This system's dominant failure mode is scope growth, not missing capability (§11.6).

**Non-engineering tasks are marked `[HUMAN]`.** These are not for an implementing agent to attempt or work around. §12 is entirely `[HUMAN]`.

**Open items are marked `[PENDING]`** with the condition that resolves them. Build around them; do not resolve them by guessing.

---

## 1. Scope

A single-user study system with three components:

1. **Study app** — spaced-repetition drilling of Arabic script, root families, and vocabulary. Daily use, phone and desktop.
2. **Content pipeline** — converts excerpts from media the user already consumes (YouTube, articles) into Arabic study material graded to their current level.
3. **Pronunciation loop** — hear a target, produce it, receive phoneme-level feedback.

Component 2 is why this exists rather than Anki or Duolingo. Generic decks are level-appropriate and boring; authentic Arabic is interesting and far too hard. The pipeline targets the overlap: content the user cares about, rewritten at a level they can currently handle.

Component 3 prevents the system from producing a learner who reads Arabic and cannot speak it — the predictable end state of recognition-only spaced repetition.

### 1.1 Non-goals

- **Not multi-user.** No auth, no accounts, no multi-tenancy. Single learner by design.
- **Not a tutor replacement.** Automated pronunciation feedback has a measured miss rate near 30% (§7.2). It supplements a human ear; it does not substitute for one.
- **Not real-time conversation.** Out of scope for v1.

---

## 2. Research foundations

Each finding below drives a specific requirement. Sources are named so claims can be re-checked; several are weak and flagged as such.

### 2.1 Arabic is FSI Category IV

The Foreign Service Institute places Arabic in its hardest tier for English speakers — roughly 2,200 class hours to professional proficiency, about four times Spanish or French. Lower rungs: ~240 hours for survival phrases, ~360 for conversational ability.

**`[R-1]`** Progress indicators MUST measure consistency — days active, cards retained, streak — and MUST NOT display proximity to fluency. An honest fluency bar reads near zero for months and demotivates.

**`[R-2]`** The system MUST be built for a multi-year horizon. No feature may imply fast progress.

*Sources:* state.gov FSI language training; kalimah-center.com; blog.langtrack.app.

### 2.2 The specific hard parts

| Challenge | Design response |
|---|---|
| Unfamiliar right-to-left script | Phase 0 is script-only, completed before vocabulary volume |
| Guttural sounds absent from English (ح ع خ غ ق) | Flagged on those cards; heard via reference audio and external alphabet resources. Isolated-letter *production* is not automatically assessable (ASR needs words, not bare consonants — §11.10), so Phase 0 gates on recognition, and production is practised at the word level |
| Root-and-pattern morphology | Used as the core organizing principle rather than treated as a hurdle |
| MSA vs. dialect split | Integrated from Phase 1 (§11.1), tagged per card, never blended |
| Verb conjugation complexity | Deferred to Phase 2, after comprehension rewards exist |

*Sources:* livexp.com; madinaharabic.com; earabiclearning.com; arabiclanguagesolutions.co.uk.

### 2.3 Root families are the biggest available lever

Arabic words derive from three-consonant roots carrying a core meaning, reshaped by vowel patterns and affixes. Learn ك-ت-ب ("writing") and كَتَبَ (he wrote), كِتَاب (book), كَاتِب (writer) arrive as a family rather than three separate memorizations.

**Evidence quality:** the qualitative claim — morphological awareness aids acquisition — is well supported in second-language acquisition literature. The specific multipliers in circulation (40–60% faster, 2–3×) trace to vendor blogs citing unnamed studies. Treat the direction as reliable and the numbers as marketing.

**`[R-3]`** Roots MUST be a first-class entity in the data model, not a tag on a word. Vocabulary is browsed, introduced, and reviewed by family.

**`[R-4]`** When selecting new vocabulary to introduce, the system MUST prefer words derived from roots the learner already knows.

### 2.3.1 Gender coverage `[PENDING]` *(added v0.14 — owner note)*

Arabic marks gender pervasively: on verbs, adjectives, pronouns, and many nouns. The current deck cites every verb in the past third-person **masculine** singular — كَتَبَ "he wrote" — because that is the conventional dictionary citation form. That convention is a lexicographer's, and adopting it wholesale has two costs the deck should not silently absorb:

1. **A learner who only ever sees the masculine cannot produce or recognise the feminine**, which is not an edge case — it is half of ordinary speech, and it is how the learner will refer to a great many people including, potentially, themselves.
2. **It is silently a choice.** Nothing on the card says "this is the masculine form"; it just says "he wrote," and the feminine is absent rather than deferred.

**`[R-51]`** Vocabulary MUST cover gendered forms rather than defaulting to the masculine citation form alone, and each card MUST make its own gender explicit rather than leaving it implied by the English gloss.

**Resolved v0.16 (owner decision).**

- **Single words show both forms.** One card, both forms, each labelled `m.` / `f.`, each with its own audio. Not two cards: the deck is capped at 12 reviews a day, doubling it would halve the rate of new material, and the alternation *is* the thing to learn — seeing كَتَبَ next to كَتَبَتْ teaches the pattern in a way two cards met a week apart do not. Review history is untouched, because the pair rides on the existing card rather than replacing it ([R-50]).
- **Sentences and phrases use either gender, equally often.** Generated passages must not default to masculine; the generation prompt now asks for roughly even distribution and correct agreement either way.
- **Generated content keeps the gender it was written with.** The app renders what the generator produced rather than normalising it.

**Coverage as built:** 53 of 118 words carry a feminine counterpart — every past-tense verb, the one present-tense form, and every agent noun, participle and adjective that takes ة. The derivations are fully regular (past 3ms + ـَتْ; agent nouns and adjectives + ة) and are checked mechanically by `tools/sync-content.mjs`.

**Deliberately not derived**, because they are irregular and guessing would teach a wrong form: the elatives أَكْبَر / أَصْغَر / أَجْمَل, whose فُعْلَى feminines are idiomatic only for some adjectives; and مَعْرُوف and مَفْهُوم, glossed here as nouns rather than participles. These need a reviewer, not a rule.

**Still open:**

- **Scope beyond the deck.** Pronouns and full conjugation belong to Phase 2 (§8); this covers vocabulary only.
- **Beyond binary.** Arabic grammatical gender is binary and there is no non-binary verb form to teach; this covers the grammar as it exists rather than implying the language offers a neutral option it doesn't. Separately, where the app writes *about* the learner in English — glosses, coaching, UI copy — it should not assume gender.
- **Not native-reviewed.** These 53 forms are hand-derived from regular morphology and share the same status as the rest of the deck: unreviewed (§12). The morphology is elementary, but that is an argument for low risk, not for no check.

*Sources:* blog.goavena.com; arabify.org; blog.alifbee.com; arabiclearningcentre.com.

### 2.4 ADHD-specific structure

Findings:

- **Distributed practice beats massed practice** for equal total time. Not ADHD-specific; broadly established.
- **Language learning decomposes well** into micro-exposures — short exchanges, individual words, brief drills.
- **End on a win.** Guidance for ADHD learners warns specifically against riding hyperfocus to exhaustion; doing so raises the activation cost of the next session.
- **Immediate feedback and visible progress** work with ADHD reward processing. Delayed payoffs register as less urgent regardless of objective importance.
- **Novelty within repetition.** Repetition is required for retention and accelerates disengagement. The fix is varying surface presentation while holding content constant.

**`[R-5]`** Sessions MUST cap at 12 cards. This is an enforced ceiling, not a default. Sessions end at completion, never at exhaustion.

**`[R-6]`** Every session MUST end on a completion screen. The system MUST NOT prompt to continue.

**`[R-7]`** Feedback MUST be immediate per card. Streak and XP counters MUST remain visible in the header at all times.

**`[R-8]`** The system MUST NOT implement punishment mechanics — no streak-loss shaming, no progress penalties, no guilt messaging. Missed days are expected. Returning must be frictionless.

**`[R-9]`** The media pipeline serves as the novelty engine: repetition of known vocabulary stays fresh because surrounding content changes. Content variety is a functional requirement, not a nicety.

**Evidence quality** *(added v0.13)*. This section carries the heaviest requirements in the document — the hard session cap, the no-punishment rule, the always-visible counters — on the thinnest sources in it: ADHD-coaching vendors and one Wikipedia article. §2.3 gets an explicit warning about vendor blogs citing unnamed studies; the same warning belongs here and was missing. Treat the *directions* as reliable — distributed practice, immediate feedback, and ending before exhaustion are all defensible on broader grounds, and spacing in particular has real literature behind it (Cepeda et al., *Psychological Bulletin* 132(3), 2006) — and treat any specific number as unsupported.

**The 12 in `[R-5]` is a guess.** Nothing in this section produces it. It became a MUST with an enforced ceiling because a ceiling had to be *some* number, and a number that is never revisited is worse than one that is arbitrary and known to be. **What would revise it:** the review log ([R-32]) now records every grade with its interval before and after, so completion rate and next-day retention can be compared across session lengths once there is enough history. Until that comparison is run, 12 stands — not because it is right, but because changing it on intuition would be no better.

*Sources:* abblino.com; en.wikipedia.org distributed practice; lifeskillsadvocate.com; tiimoapp.com; adhdcentre.co.uk. **These are hostnames, not citations** — the opening claim that "sources are named so claims can be re-checked" does not hold for §2.2 through §2.4, where no titles, URLs, or dates were recorded. Anything load-bearing from these should be re-sourced before it is relied on again.

---

## 3. Current state

Two files: `index.html` (the self-contained study app) and `backend/worker.js` (the optional Cloudflare Worker). The app runs fully offline; the Worker adds cloud features when a learner deploys and connects it.

**Built:**

- **Content.** 28 letters with all four positional forms; **118 words across 37 root families**, browsable by family. (Earlier drafts said "~146 words" — 146 is the *clip* count, 28 letters plus 118 words.) Cards are keyed on stable ids, so families and words can be reordered or corrected without disturbing saved progress. Recorded human audio is wired in but **no clip files exist yet** (the HUMAN track, §12); every word currently falls back to synthetic audio.
- **Study loop.** SM-2-style scheduler, 4-point grading, 12-card session cap, completion screen, streak/XP/level, 30-day heatmap with the `[R-38]` active-day count computed and displayed. Session selection shuffles within a due date so the same cards don't dominate. Recognition and production are separate tracks ([R-29]). Grades append to a review log ([R-32]).
- **PWA.** Installable, offline study, service worker (network-first for the page), self-hosted fonts.
- **Backend.** `/state` sync across devices; `/assess` (Azure Tier 2 pronunciation, Whisper Tier 1 fallback); `/tts`; `/ingest` + `/generate`. Keys live only on the Worker.
- **Pronunciation.** Azure per-phoneme scoring with positional sound-naming, **marked as inferred** wherever the label came from the letter skeleton rather than from Azure; LLM articulatory coaching from the flagged list; all provisional ([R-20][R-31]).
- **Content pipeline.** Article/text ingestion → graded diacritized MSA passage + new words, saved to a **Library**; new words enter reviews on opt-in.
- **Display.** Three-stage diacritic fade (retention-linked), per-card vowel pinning, register tags, romanization hidden by default.
- **Navigation.** Today · Vocab · Library · Progress (with Alphabet and Roadmap sub-pages) · Settings (sync, harakat, romanization default, synthetic voice, audio coverage).

**Not yet built — and each of these was previously described here or in §10 as done or nearly done:**

- **Core audio ([R-12]).** No human recordings, and nothing is pre-generated. Synthetic speech is fetched live per word or spoken by the device. Offline, on a device with no Arabic system voice, there is **no audio at all**. `[R-12]` says hearing a word is part of the study loop, not an enhancement; it is unmet.
- **Calibration pool ([R-33], §11.3).** Speech attempts are logged with their structured verdict, but **the audio is discarded**. Without audio there is nothing for a reviewer to label. See the corrected §11.3.
- **Grapheme↔phoneme alignment ([R-21]).** Not computed, not stored, not requested by the generation prompt. This is §7.3's own named mitigation and its absence was not recorded anywhere.
- **Phase state (§8).** No phase is tracked, so `[R-27]` and the level-appropriateness half of `[R-15]` have no state to work from, and the `/generate` profile omits `phase`, `grammar_cleared`, `grammar_pending`, and `recent_failures`. §8 is currently descriptive. §10 has no step for it — see the note there.
- **Egyptian content (§11.1, [R-30]).** Every word is tagged `msa`; there is no dialect material at all. The register tag is real machinery with nothing to distinguish. See the corrected §11.1.
- **Generation accuracy measurement.** Step 10 is gated on "measured error rates" and nothing measures them. See §6.6.
- Cross-vendor generation verification and dictionary-grounded roots (Step 10). The self-hosted MDD contingency (§11.4) remains `[PENDING]` and unlikely.

**Human track, not code:** native-speaker recordings for the letters and core words; native review of generated content and of pronunciation feedback (§12).

---

## 4. Target architecture

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT (PWA — phone + desktop, installable)            │
│  study UI · session runner · scheduler · progress state  │
│  audio playback · mic capture                            │
└───────────────┬─────────────────────────────────────────┘
                │  HTTPS
┌───────────────▼─────────────────────────────────────────┐
│  BACKEND (serverless functions)                          │
│  ├─ /ingest      accept URL, extract text                │
│  ├─ /generate    produce graded Arabic content            │
│  ├─ /verify      multi-model check                        │
│  ├─ /speak       text → audio (cached; diacritized in)    │
│  ├─ /assess      audio → phoneme-level pronunciation dx   │
│  └─ /state       read/write learner profile               │
│  Holds all API keys.                                     │
└───────────────┬─────────────────────────────────────────┘
                │
   ┌────────────┼───────────┬────────────┬───────────────┐
Model APIs  Transcript/    TTS        Pronunciation   Datastore
(multi-     article      (Arabic,    assessment      (learner state,
 vendor)    extract      tashkeel-   (Azure;          content,
                         aware)      §7.6)            audio pool)
```

### 4.1 Backend is mandatory

**`[R-10]`** API keys MUST NOT appear in client-delivered code. Any key in browser-delivered JavaScript is extractable via devtools. For a single-user app this is a billing risk rather than a breach risk — it remains unacceptable.

Two valid patterns:

- **Serverless functions** with keys in environment variables (Cloudflare Workers, Vercel, Netlify, Deno Deploy). **Preferred** — one deployable project.
- **Automation platform as backend** (n8n, Make, Gumloop). Client posts to a webhook and polls. Less engineering, less control, more vendors.

Default to the first unless there is a specific reason otherwise.

### 4.2 Client is a PWA

A progressive web app delivers a home-screen icon, full-screen chrome, and offline study across phone and desktop from one codebase. Native would add push notifications and better offline audio at the cost of two toolchains and store review. Not justified for one user.

**`[R-11]`** The study loop MUST function with no network connection.

**`[R-12]`** TTS audio for fixed core content (letters, known vocabulary) MUST be pre-generated and cached on device. Hearing a word is part of the study loop, not an enhancement.

> **Unmet, and now the top of the build queue** *(v0.14)*. Nothing is pre-generated. Synthetic speech is either fetched live from the backend per word or spoken by the device's own voice — so offline, on a device with no Arabic system voice, there is no audio at all.
>
> With `[R-24]` amended, this is no longer waiting on anyone. Generate the 146 clips once against the maintainer's Azure account, commit them as ordinary files labeled synthetic, ship them. That satisfies this requirement, un-degrades the free path under `[R-45]` (§11.9), and makes the offline claim true — a few MB and no new architecture. The clips are fixed content generated once, not a per-learner runtime cost, which is exactly what this requirement asks for. `[R-24b]`'s drop-in override means a human recording can replace any clip later without a code change.

Network is required only for ingestion, generation, and assessment of the learner's own speech.

---

## 5. The media pipeline

```
 URL or pasted text
        │
        ▼
 [1] EXTRACT  ── transcript / article body → plain text
        │
        ▼
 [2] SEGMENT  ── select an excerpt worth adapting (100–300 words)
        │
        ▼
 [3] PROFILE  ── load learner state: known roots, known words,
                 grammar phases cleared, recent error patterns
        │
        ▼
 [4] GENERATE ── graded Arabic adaptation + new-word list
        │
        ▼
 [5] VERIFY   ── independent check (§6)
        │
        ├── pass ──▶ [6] MATERIALIZE → cards + reading passage
        └── fail ──▶ regenerate with critique appended (max 2 retries)
```

### 5.1 Stage detail

**[1] Extract.** YouTube captions via a transcript API or `yt-dlp`; articles via a readability extractor (Readability.js, Trafilatura).

**`[R-13]`** Extraction failures MUST surface a specific reason — no captions, captions too garbled, paywalled, no text content — and MUST NOT proceed with degraded input.

**[2] Segment.** One coherent 100–300 word chunk, not the whole source. Naive selection (first substantive paragraph) is acceptable initially; model-assisted selection ("choose the most self-contained passage") is a later refinement.

**[3] Profile.** This step is what makes output personal rather than generic:

```json
{
  "known_roots":      ["ك ت ب", "د ر س", "ع ل م"],
  "known_words":      ["كِتَاب", "مَدْرَسَة", "..."],
  "phase":            1,
  "register":         "MSA",
  "grammar_cleared":  ["definite article", "gender agreement"],
  "grammar_pending":  ["past tense conjugation"],
  "recent_failures":  ["ع vs ء distinction", "broken plurals"],
  "target_new_words": 5
}
```

**[4] Generate.** The prompt carries the load. Constraints, all mandatory:

- Modern Standard Arabic unless the card is explicitly tagged dialect (§11.1)
- Full vowel diacritics (harakat) on all output — required downstream for TTS and phoneme alignment
- Reuse `known_words` wherever possible
- Introduce at most `target_new_words` new items, preferring derivations from `known_roots`
- Use no grammar from `grammar_pending` or later
- Preserve the substance of the source excerpt; simplify language, not meaning
- Return structured JSON:

```json
{
  "arabic": "...",
  "transliteration": "...",
  "english_gloss": "...",
  "new_words": [{"ar":"","translit":"","en":"","root":"","root_meaning":""}],
  "grammar_notes": "..."
}
```

**[5] Verify.** §6.

**[6] Materialize.** New words become cards entering the review queue, tagged with provenance ("from *[video title]*"). The passage is stored as a reading exercise.

**`[R-14]`** Generated cards MUST retain a reference to their source. Provenance is part of what makes the vocabulary stick.

---

## 6. Multi-model verification

Mixture-of-Agents (parallel generation, judge selects) and multi-agent debate (agents critique before a judge decides) are documented techniques. They are also expensive and routinely over-applied. This design uses them narrowly.

### 6.1 What the research supports

Ensemble gains come from **diversity across model families, scales, and prompting strategies** — not from call volume. Three calls to one model share that model's blind spots. Debate outperforms single-round voting because agents correct each other across rounds. Neither guarantees correctness: models converge confidently on the same wrong answer with some regularity.

*Sources:* arXiv 2605.24048 (Mixture of Complementary Agents); arXiv 2510.12697 (Multi-Agent Debate for LLM Judges, NeurIPS 2025); arXiv 2605.04523 (SemEval-2026); arXiv 2508.02994 (agent-as-a-judge survey).

### 6.2 Where it applies

**Translation and vocabulary accuracy — good fit.** Errors are inconsistent across models. A verifier from a different vendor performs genuinely independent work.

**Level-appropriate progression — bad fit.** Not a factual question agents can cross-check. Whether content suits *this* learner depends on tracked state. Three agents guessing a curriculum in the abstract converge on generic assumptions.

**`[R-15]`** Level-appropriateness MUST be checked by grounding against learner state, never by model consensus.

### 6.3 Escalation tiers

| Tier | Trigger | Process |
|---|---|---|
| **1 — Single pass** | Routine content | One strong model generates. No verification. |
| **2 — Cross-vendor verify** | Content introducing new vocabulary | Generator (vendor A) → verifier (vendor B) against explicit checklist |
| **3 — Ensemble + judge** | Verifier flagged a substantive problem | 3 generators across 3 vendors → judge selects or synthesizes, with written rationale |
| **4 — Human review** | Judge low-confidence, or verifiers contradict | Surface the disagreement to the learner |

**`[R-16]`** The verifier MUST be from a different vendor than the generator. Same-model verification shares blind spots and produces agreement rather than checking.

### 6.4 The verifier checklist

Generic "does this look right?" verification produces agreement and is worthless. The verifier receives a named checklist:

1. Is every Arabic word correctly spelled with correct diacritics?
2. Does each transliteration match its Arabic?
3. Is register consistent — MSA throughout, no unmarked dialect leakage?
4. Are the stated roots actually the roots of the given words?
5. Does any word use grammar outside the declared learner phase?
6. Does the English gloss accurately reflect the Arabic?
7. Does the Arabic preserve the source excerpt's meaning?

**`[R-17]`** Verifier output MUST be per-item pass/fail with specific corrections. It MUST NOT be a score.

### 6.5 Grounding beats ensembling

Where an authoritative source exists, check against it rather than asking another model. Root claims validate against a root-indexed dictionary — Hans Wehr is organized by root by design. A lookup is cheaper, faster, and definitive.

**`[R-18]`** Root correctness MUST be validated by dictionary lookup, not model consensus. Reserve model verification for judgments no lookup can make: naturalness, register, level-appropriateness.

### 6.6 Measuring generation accuracy `[PENDING]` *(added v0.13)*

§11.3 designs a careful blind, two-sided, duplicate-seeded protocol before a single pronunciation verdict is trusted. Generated content — which writes to permanent state — has no equivalent, and the asymmetry was not deliberate.

Step 10 (§10) is gated on "do only if measured error rates warrant." **Nothing measures generation error rates.** There is no correction log, no flagged-word affordance, no `[HUMAN]` review job for generated content in §12, and §13 did not list it as an unknown. The trigger condition therefore cannot fire, which makes the gate a way of never doing the work rather than a way of deciding whether to.

The stakes are higher here than for pronunciation, not lower. §11.3 warns that "a learner acting on unverified feedback can drill an error into permanence" — but pronunciation feedback is transient, and a wrong diacritic on a card entering spaced repetition is drilled by design. Generated words also arrive with a model-asserted root displayed next to hand-curated roots with nothing distinguishing them, which is precisely what `[R-18]` forbids.

**`[R-47]`** Model-asserted roots on generated words MUST be visually distinguished from curated roots until validated by dictionary lookup ([R-18]).

**`[R-48]`** The Library MUST offer a way to mark a generated item as wrong, and MUST record it. This is the measurement Step 10 is gated on; without it the gate cannot open.

*(v0.15: both are now built. Model-asserted roots render with an unverified marker; a flag button records an append-only report and pulls the word out of the review deck, because the cost of a wrong card is that spaced repetition makes it permanent.)*

### 6.7 Closing the gap with pronunciation — the verification ladder *(added v0.15)*

The reviewed asymmetry was real: pronunciation feedback, which is transient, had a five-requirement protocol; generated vocabulary, which spaced repetition makes permanent, had a warning banner. The fix is **not** to run every generated item through an ensemble. §6.1 is explicit that ensemble gains come from diversity across model families rather than call volume, and that models "converge confidently on the same wrong answer with some regularity" — and Arabic diacritisation is close to a worst case for that. Every major model has learned from the same undiacritized corpora and shares the same weak spots, so three of them voting on the harakat of a rare word will agree, cheaply and wrongly, and the agreement will read as confidence. §6.5's rule stands: **grounding beats ensembling**, and ensembling is the fallback for judgments no lookup can make.

The ladder, cheapest and most definitive first. Each rung only sees what the rung above could not settle:

| Rung | Check | Catches | Cost |
|---|---|---|---|
| **0 — Deterministic** | Is every word diacritized? Is the register tag consistent? Does the transliteration's consonant skeleton match the Arabic? Is the JSON shape right? | Malformed and truncated output, silently undiacritized words, transliteration/Arabic mismatch | Free, no model, runs on every generation |
| **1 — Dictionary grounding** (`[R-18]`) | Is the stated root real, and is this word actually derived from it? | Wrong roots — which corrupt the family structure, the organizing principle of the whole system | One lookup. Definitive. **MSA only — this rung disappears for Egyptian (§11.1.1)** |
| **2 — Cross-vendor verifier** (`[R-16]`) | One model from a *different vendor*, against the §6.4 checklist, returning per-item pass/fail with corrections — never a score (`[R-17]`) | Naturalness, register leakage, meaning drift, level | One call per generation |
| **3 — Ensemble + judge** | Only when rung 2 flags something substantive: three generators across three vendors, a judge with written rationale | Genuinely contested cases | Expensive; rare by construction |
| **4 — Human** | The §12 content checker, 20 items a month, and the learner's own `[R-48]` flags | Everything the machine shares a blind spot on | ~20 min/month |

Two properties worth naming, because they are what make this different from "add more agents":

- **Rungs 0 and 1 are not opinions.** A word either carries diacritics or it doesn't; a root either appears in the dictionary or it doesn't. No amount of model consensus is worth one deterministic check, and these two rungs cover the failure modes that matter most for a beginner's deck.
- **Rung 4 is the only rung that can measure the others.** Flags and spot-checks are what tell you whether rungs 0–3 are working. Without them, adding rungs is faith. This is the same argument §11.3 makes for pronunciation, applied where it was missing.

**Ensembling has no analogue for audio.** The learner's own speech cannot be checked by text models voting — `[R-25]` forbids exactly that, because a text model asked to judge audio it cannot hear invents fluent, confident feedback. For *synthetic* audio there is a real check that is not ensembling: **round-trip the generated speech through ASR and compare the transcript to the source text.** It catches gross synthesis failures (wrong word, dropped syllables, a voice reading the wrong language) for the cost of one Whisper call the project already has free. It does not catch subtle mispronunciation, and must not be presented as though it does.

**Build order:** rung 0, then rung 4's flag button *(both done in v0.15)*, then rung 1 for MSA, then rung 2. Rung 3 last, if the flag data ever justifies it — which is what Step 10 was always gated on.

---

## 7. Pronunciation

Reading, listening, and recognition are all trainable by the components above. Production is not, and recognition-only study plateaus. This section covers producing model audio and assessing learner speech.

### 7.1 Field and current state

The discipline is **Computer-Assisted Pronunciation Training (CAPT)**; its core technical component is **Mispronunciation Detection and Diagnosis (MDD)**. Modern systems build on self-supervised speech representations — wav2vec2, HuBERT — rather than HMM-based Goodness-of-Pronunciation scoring.

Arabic lacked standardized benchmarks and open annotated data until the **IQRA shared task**. Its 2026 Interspeech edition is the most useful artifact available for this project.

Why Arabic is harder than most CAPT targets:

- 34 phonemes (28 consonants, 6 vowels with distinct short and long forms)
- Uvular and pharyngeal consonants rare in other languages
- The emphatic/non-emphatic distinction (/t/ vs /T/, /s/ vs /S/) is **semantically critical** — one substitution changes the word
- Diglossia: MSA is a second register for native speakers, so training data mixes L1-dialect interference with foreign-learner error

*Sources:* El Kheir et al., IQRA 2026 (arXiv 2603.29087); El Kheir et al., Automatic Pronunciation Assessment review (arXiv 2310.13974); Rogerson-Revell, RELC Journal 52(1), 2021.

### 7.2 Benchmark results and their consequences

| Finding | Consequence |
|---|---|
| Best system F1 = 0.7201, up from ~0.30 in the prior edition; 13 of 19 beat baseline | Newly viable. This section would have been speculative a year ago. |
| Winning architecture: frozen `wav2vec2-xls-r-300m` + learnable layer fusion + TCN, CTC loss, two-stage curriculum, n-gram rescoring | Reproducible from public components if ever needed |
| Open corpora: Iqra_train (79h real), Iqra_TTS (52h synthetic), Iqra_Extra_IS26 (1,333 real mispronounced), QuranMB.v2 | Fine-tuning data exists and is public |
| Systems using the small authentic mispronunciation set beat those relying on larger synthetic corpora | Synthetic errors do not substitute for real ones. Real learner audio is the scarce input. |
| Top system: false reject 0.0175, false accept 0.30 | See below — the number that shapes the UI |

**The precision/recall asymmetry.** The best system almost never flags a correct production as wrong (FR ≈ 1.8%) and misses roughly 30% of genuine errors (FA ≈ 30%). Weaker systems inverted this; one submission scored recall 0.865 against precision 0.123.

Preserve this asymmetry deliberately. A false reject — telling the learner their correct ع was wrong — destroys trust in every later judgment, and compounds with `[R-8]`. A missed error is recoverable; a later session or a human catches it.

**`[R-19]`** Pronunciation assessment MUST be tuned toward precision over recall.

**`[R-20]`** Feedback MUST be presented as "here is what was detected." The system MUST NOT imply it caught everything.

### 7.3 The phoneme-to-character gap

The IQRA organizers name this as the most pressing unsolved problem in Arabic CAPT:

> Models output phoneme sequences. Learners read Arabic script. There is no universal mapping from a predicted erroneous phoneme back to the corresponding character or diacritic, because Arabic grapheme-to-phoneme correspondence is many-to-one and context-dependent. Until that mapping is solved, practical utility for learner-facing applications is limited.

Raw MDD output reads *"phoneme 14 substituted: /ʕ/ → /ʔ/"* — correct and useless.

Two mitigations, used together:

1. **Constrain the problem.** This system generates fully diacritized text with known grapheme-phoneme alignment at generation time. Content whose phonemization you produced yourself sidesteps most of the ambiguity.

   **`[R-21]`** Grapheme-to-phoneme alignment MUST be computed and stored at content generation time, not reconstructed at assessment time.

2. **Use an LLM as the feedback layer.** The organizers note that generative audio-language models can produce natural-language feedback directly; one team placed 6th doing MDD this way. This system does not need generative MDD — it runs a detector and passes structured output to an LLM for explanation.

**`[R-22]`** The phoneme model determines *where* and *what*. The LLM determines *how to explain it*. Neither performs the other's function.

### 7.4 ASR is not pronunciation assessment

ASR answers *what the learner said*, not *how they pronounced it*. Round-tripping through a transcriber catches only errors large enough to change the word. That is a real intelligibility signal — intelligibility is the actual goal of communication — but it is not diagnosis.

Arabic ASR is also weaker than English ASR. As of July 2026, Cohere's open-source Arabic model reports 25.87 average WER on the Open Universal Arabic ASR leaderboard — best open-source, ~11 points ahead of Whisper Large V3 — against English real-world figures of 8–12%. Whisper has documented Arabic failure modes including emitting English translations or Latin transliteration.

**`[R-23]`** ASR disagreement MUST NOT be used as a silent error signal. A failed transcription may be the model's failure, not the learner's. Tier 1 output is labeled "understood / not understood," never scored.

### 7.5 Text-to-speech

**Diacritization is the gating factor.** Written Arabic omits short vowels; undiacritized words are visually identical and pronounced differently. TTS quality depends on having them. This system generates fully diacritized content by design, so the hard preprocessing is already solved for pipeline output. Imported or legacy text requires a diacritization pass (Sadeed, CATT-Whisper).

| Option | Assessment |
|---|---|
| **ElevenLabs** | Easiest commercial path; handles tashkeel. Competitor marketing claims its Arabic is structurally weak — those sources sell Arabic-first alternatives. Verify by ear. |
| **Habibi** (open source) | Unified dialectal synthesis, MSA plus six dialects; reported to match or surpass ElevenLabs v3 alpha on most metrics. Best option if dialect coverage matters. |
| **ArTST** (open source) | SpeechT5-style unified text/speech transformer, MSA-focused |
| **MMS-TTS-Ara** (Meta, open source) | VITS-based, weakly supervised. A baseline, not a best option. |

**None of the four was adopted** *(recorded v0.13; the table above had been left standing as though the choice were open)*. The build uses **Azure Neural TTS (`ar-SA-HamedNeural`)**, on §11.9's reasoning rather than this table's: the synthetic voice is a stopgap until human recordings exist, and reusing the Speech resource the learner already needs for Tier 2 beats adding a vendor for a stopgap. The four options above remain the shortlist if synthetic audio ever becomes something other than a placeholder — Habibi in particular, if dialect coverage arrives with §11.1. Measured behavior of the voice actually in use is §7.5.1.

**`[R-24]`** *(amended v0.14 — owner decision)* **Synthetic audio is the shipped path.** Every letter and core word MUST have a pre-generated clip committed to the repository, clearly labeled synthetic. Recorded human audio is **deferred to a later version** and is no longer a dependency of any current build step.

The v0.11 wording had this backwards. It made human recordings the requirement and synthetic speech a temporary fallback "until a human recording exists" — which meant every day without a native speaker was a day the audio requirement went unmet, and 146 empty slots sat in the repo waiting on a person nobody had found yet. Sourcing a speaker is a months-scale task with no committed timeline; making the audio loop depend on it was a standing bet that the project could not collect on.

What is unchanged is *why* human recordings are wanted: pharyngeal and uvular consonants (ح ع خ غ ق) are where synthesis is least trustworthy and where imitation matters most, and §7.5.1 records real limits in the voice actually available. Those remain true. They are reasons to schedule recordings later, not reasons to ship nothing now.

**`[R-24a]`** Synthetic clips MUST be labeled synthetic wherever they play, and MUST NOT be sent to the tutor calibration pool (§11.3) as a reference.

**`[R-24b]`** The audio layer MUST keep the drop-in override: a human recording at the same path supersedes the synthetic clip with no code change. Deferring recordings must not mean designing them out.

**When to revisit:** when a native speaker is actually engaged (§12), or when a materially better Arabic voice is available — the §7.5 shortlist, re-tested. Not before; and no build step blocks on it.

#### 7.5.1 Implemented behavior and its limits (v0.12)

The synthetic fallback uses Azure Neural TTS (`ar-SA-HamedNeural`) via the backend, reusing the Speech key. Measured facts about this voice, established by testing:

- It **ignores the harakat you supply**: diacritized and undiacritized input produce byte-identical audio. The "diacritization is the gating factor" premise above holds for TTS engines generally but not for this voice. *(v0.13 caveat: byte-identical output shows the supplied marks make no difference, not that the voice is vowel-blind. Azure almost certainly runs its own diacritizer upstream and reached the same reading for these test words. That distinction matters for a genuinely ambiguous form, where its guess and our stored diacritics could disagree with nothing to signal it — worth a spot check before synthetic audio is ever treated as more than a placeholder.)*
- It **ignores `<phoneme>` (IPA and SAPI) and `<prosody volume>`**. This is consistent with §7.6.1's finding that Azure exposes no Arabic phone set.
- It reads an isolated word in **pausal form**, dropping the final short vowel (كَتَبَ → "katab"). This is the natural way a word is pronounced on its own and is accepted as-is.

**Approaches tried and set aside** (recorded so they are not re-attempted): stripping harakat (no effect, and it removes the ending); IPA `<phoneme>` built from the stored transliteration (ignored); a silent-volume trailing filler to force connected-speech vowelling (the voice spoke the filler aloud). Forcing citation forms would require trimming audio using Azure's word-boundary stream or a different vendor — out of scope for a stopgap. Human recordings, which can be citation or pausal by choice, are the intended resolution.

### 7.6 Tiered assessment

| Tier | Function | Cost | Capability |
|---|---|---|---|
| **1 — Intelligibility** | Arabic ASR round-trip | Low | Gross errors only. "Understood / not understood." |
| **2a — Commercial MDD** | Azure pronunciation assessment, `ar-SA` or `ar-EG` | Per-call, cheap | **Default.** No ML work. MSA accuracy unverified — §7.6.1. |
| **2b — Self-hosted MDD** | Fine-tuned wav2vec2+CTC against known phoneme sequence | High (GPU training + inference) | **Contingency only.** Triggered per §11.4. |
| **3 — LLM coaching** | Structured MDD output → articulatory guidance | Low per call | Explains; does not detect. |
| **4 — Human review** | Blind-sampled batch labeled by a native speaker | ~$10–20/month once running | Ground truth and calibration source. `[PENDING]` — see §11.3, §12. |

**`[R-25]`** The LLM MUST NOT be asked to judge pronunciation. It receives a phoneme-level diagnosis and translates it to advice. A text model asked to assess audio it cannot hear produces fluent, confident, invented feedback — the worst failure mode for a learner who cannot yet tell the difference.

#### 7.6.1 Azure locale coverage — verified

Azure pronunciation assessment covers 33 locales. The Arabic entries are exactly two: **`ar-EG`** and **`ar-SA`**. Verified against the published locale table, July 2026.

There is **no MSA locale.** Consequences:

- Assessment scores against a regional model. For most segmental targets this is immaterial — ع is ع in Cairo and Riyadh. For ق (glottal stop in Egyptian, /g/ across much of the Gulf) it is a real mismatch that could penalize a correct MSA production.
- **`ar-SA` is the default** as the closer proxy for formal register. `ar-EG` is relevant given §11.1.
- The mismatch is measurable, not theoretical. The §11.3 calibration protocol will show whether specific phonemes produce false rejects. If so, exclude those phonemes from automated scoring rather than escalating to a self-hosted build.

Speechace and ELSA were evaluated and rejected: both target English and standardized exam prep (IELTS/TOEFL/PTE).

### 7.7 Corpus register limitation

Open Arabic MDD corpora are weighted toward Qur'anic recitation — a distinct performance register with codified norms (tajwīd), deliberate elongations, and specific assimilations unlike conversational MSA.

For **segmental accuracy** this is largely immaterial; a correct ع is a correct ع. For **prosody, rhythm, and naturalness** it is not representative.

**`[R-26]`** Automated speech feedback MUST be scoped to segmental accuracy. Prosody, rhythm, and stress are out of scope for automation (§11.5).

---

## 8. Curriculum progression

> **Status (v0.13): descriptive, not implemented.** No phase is tracked anywhere. The Roadmap tab renders this table as static text; nothing computes which phase the learner is in, nothing gates on the advancement criteria, and the `/generate` profile omits `phase`, `grammar_cleared`, `grammar_pending`, and `recent_failures` — so `[R-27]` and the level-appropriateness half of `[R-15]` have no state to work from. §10 has no step that would build it, which is a gap in the build sequence rather than an oversight in this section; see the note at the end of §10.
>
> `[R-28]` and `[R-29]` *are* implemented: retention (not exposure) is what the app counts as known, at the Phase 0 bar below — 3+ reps at an interval of a week or more — and recognition and production schedule independently.

Advancement gates on evidence, not elapsed time.

| Phase | Focus | Advancement criterion |
|---|---|---|
| 0 | Script & sound | 28/28 letters at ≥3 successful reps, interval ≥7 days (recognition; letter *production* is not gated — §11.10) |
| 1 | Root vocabulary + survival phrases; **Egyptian layered in for listening** | ~150 MSA words retained; 30 root families with ≥2 words each; ~40 dialect items recognized by ear |
| 2 | Core grammar | Grammar checklist cleared; parses unseen simple sentences |
| 3 | Conversation, both registers | Sustained basic exchange in Egyptian; MSA reading unaided |
| 4 | Immersion | Ongoing; no exit criterion |

**`[R-27]`** Phases MUST overlap. Advancement unlocks new material and closes nothing. Phase 0 letter cards continue resurfacing on schedule during Phase 2.

**`[R-28]`** Retention gates advancement, not exposure. A word counts as known when it survives a long interval, not when it has been seen.

**`[R-29]`** Recognition and production MUST be tracked as separate maturity states with independent scheduling. They are different skills and decay at different rates — a learner can lose the ability to produce ع while retaining the ability to read it.

**`[R-30]`** Every card MUST be tagged MSA or Egyptian, and the tag MUST be visible to the learner. The risk in integration is not learning two registers; it is learning two registers without knowing which is which.

**`[R-31]`** Provisional pronunciation feedback (§11.3) MUST NOT gate phase advancement.

---

## 9. Data model

```
learner_profile
  phase, dialect_register, created_at, settings

cards
  id, type (letter | word | passage), content (JSON),
  register (msa | egy),
  source_ref (nullable — provenance),
  root_id (nullable),
  phoneme_seq (canonical phonemization, 68-symbol MSA inventory),
  grapheme_align (character ↔ phoneme map, stored at generation time)

roots
  id, consonants, core_meaning, notes

review_log
  card_id, timestamp, grade, interval_before, interval_after,
  track (recognition | production)
  ── append-only

speech_attempt
  id, card_id, timestamp, audio_ref,
  tier_reached (1–4),
  asr_transcript (nullable),
  mdd_result (JSON: per-phoneme TA/FR/FA/TR + predicted substitutions),
  llm_feedback (text, nullable),
  human_verdict (nullable — set only on Tier 4 review),
  in_calibration_pool (bool)
  ── append-only

audio_asset
  id, card_id, source (recorded | tts), voice_id, path, created_at

ingested_content
  id, source_url, source_title, excerpt_raw,
  generated (JSON), verification_result (JSON),
  tier_used, created_at
```

**`[R-32]`** `review_log` and `speech_attempt` MUST be append-only, never overwritten. This makes scheduler changes safe to experiment with — any new algorithm can be replayed against real history rather than tested blind.

> *(v0.13)* `review_log` did not exist until now — grading overwrote the card's scheduler state in place, so no history was retained and the stated benefit was unavailable. It is implemented as of v0.13, with card id, local study day, track, grade, and interval before/after. **Nothing before v0.13 can be recovered**, which is the general shape of this requirement's cost: a log not written today is not a log that can be written later. `speech_attempt` is append-only and now carries the structured verdict, but see `[R-33]`.

**`[R-33]`** Audio MUST be retained indefinitely where `in_calibration_pool` is true, and expired on the normal schedule otherwise. The pool is a stratified reservoir sample balanced across flagged/passed attempts and over-weighted toward the pharyngeals and ق. Target 200 items. See §11.3.

> *(v0.13)* **Unmet.** No audio is retained at all. See the correction box in §11.3 for what this costs and what it would take.

**`[R-50]`** *(added v0.13)* Card ids MUST be stable identifiers, not positions in a content array. Ids are permanent once issued: append, never renumber.

> Card ids were `v-<rootIndex>-<wordIndex>`, which made saved progress depend on the content's array order — the source carried the comment "LOAD-BEARING… never reorder." That froze the content permanently: no regrouping a family, no fixing a misassigned root, ever. It also contradicted `[R-3]`, since a root identified only by its array index is not a first-class entity. Migrated in v0.13 to the stable ids the content export already carried, while the history was short enough for the remap to be derivable rather than guessed.

---

## 10. Build sequence

Each step must be independently usable. Nothing depends on a later step to deliver value.

**`[R-34]`** *(amended v0.7, July 2026 — owner decision)* Building MAY proceed ahead of usage. The original rule — no step begins until its predecessor has 14 consecutive days of daily use — was retired three days into Step 2's usage window, on the owner's judgment that ADHD momentum cuts both ways: the activation cost of *resuming* a shelved build is the same cost the rest of this document works to avoid, so finishing the app while motivation is high is the better long-run bet. `[R-38]` remains fully binding and is now the sole usage safeguard: if the 30-day heatmap drops below 15 active days, all building stops. The original rule's intent — a system nobody studies with has failed — stands unchanged; only the enforcement mechanism moved.

| Step | Deliverable | Status |
|---|---|---|
| **1** | v0 HTML in daily use | ✅ Built |
| **2** | Content expansion: all letter forms, ~30 root families, **pre-generated core audio** | ◑ Partial — 28 letters × 4 forms, 118 words across 37 roots. **No audio files exist**, so `[R-12]` is unmet. Step title amended v0.14: the deliverable is 146 committed clips, synthetic per `[R-24]`, which depends on nobody. Gender coverage (`[R-51]`) is open content work under this step. |
| **3** | PWA | ✅ Built — installable, offline study, service worker, self-hosted fonts. iOS best-effort per §11.8. *Offline **audio** depends on step 2's missing clips.* |
| **4** | Backend skeleton + `/state` | ✅ Built — no key in client (grep-verifiable); cross-device sync; graceful offline degradation; deploys from the repo with keys as Secrets ([R-41]). |
| **5** | Tier 1 intelligibility | ✅ Built — WAV mic capture on Chrome; Whisper round-trip; understood/not-understood, never a score. |
| **6** | `/ingest` + `/generate`, verification Tier 1 | ✅ Built for article/paste; fully-diacritized output with provenance; specific extraction failures. **YouTube not supported** (returns a reason). |
| **7** | Tier 2a Azure assessment + calibration pool | ◑ Partial — Azure per-phoneme assessment built (provisional, advancement-safe; positional sound labels marked inferred). **Calibration pool ([R-33]) not built, and no audio is retained — §11.3.** |
| **8** | Tier 3 LLM coaching | ✅ Built — structured flagged list in, articulatory text out, never raw audio; provisional, and hedged when the flagged sound was named positionally. |
| **9** | Diacritic fade + register tagging UI | ✅ Built — three stages, per-card pin, register on every card, stored data stays diacritized. *Register tagging has no dialect content to distinguish — §11.1.* |
| **10** | Cross-vendor verification + dictionary grounding | ⬜ Not built — needs a second model vendor; gated on "measured error rates," **which nothing measures** ([R-48], §6.6). |
| **—** | *Contingency:* Tier 2b self-hosted MDD | Not scheduled. Trigger in §11.4 — currently unreachable, since the ~80-item threshold needs the pool. |

**Two gaps in this sequence itself** *(added v0.13)*:

1. **No step builds phase tracking**, so §8 will still be unimplemented when step 10 is done. Either add one or accept §8 as descriptive; the current state — a section written as binding curriculum with no step that delivers it — is the worst of the three.
2. **No step is "use the app."** Ten steps sequence engineering; §11.6's three conditions are the only counterweight, and one of them was amended away (§11.6). A recurring row belongs in this table, because this table is what a reader treats as the work list:

| Step | Deliverable | Status |
|---|---|---|
| **0** *(recurring)* | 15+ active days in the trailing 30, per `[R-38]` | Computed and shown in the app since v0.13 — check it before starting any step above |

**`[HUMAN]` Parallel track: find a native-speaker reviewer.** Runs alongside the sequence, blocks nothing. Screening criteria and protocol in §12.

**Step 2 before step 6.** A generation pipeline feeding a thin content base produces impressive demos and poor studying. Content depth compounds; pipeline sophistication does not.

**Step 5 before step 7.** Tier 1 costs an afternoon and answers the question that matters most: does the learner actually speak into their phone mid-session, or silently skip every production card? If the answer is no, everything downstream is wasted regardless of accuracy.

### 10.1 Tooling

Steps 2–10 are ordinary application development against documented APIs and suit an agentic coding harness (Claude Code, or the Claude Agent SDK for pipeline steps, which supplies the tool-execution loop).

Multi-agent orchestration frameworks (LangGraph, CrewAI) are **not** required at this scale. A four-stage pipeline with a conditional retry is a script, not a graph, and a script is far easier to debug.

There is no machine-learning work on the critical path. The one ML task in this document (Tier 2b) is a contingency that will likely never trigger.

---

## 11. Resolved decisions

Each entry states the decision, the evidence, and — where evidence is thin — what would change it.

### 11.1 Dialect timing → Integrate Egyptian from Phase 1

MSA-only-until-month-6 reflects the traditional approach; the field has moved away from it. The consensus position is the **integrated approach** — MSA and one dialect taught side by side from early on (Younes 2014; Al-Batal, *Arabic as One Language*, 2018).

Integration appears close to free. Huntley's comparative study (MESA 2020) found integrated curricula produce MSA outcomes roughly as robust as MSA-only curricula. Related work finds MSA-dialect lexical overlap considerably higher than commonly assumed once regular sound correspondences count as overlap rather than difference. If integration costs nothing on MSA and adds conversational ability, it dominates.

**Egyptian, for three converging reasons:**

1. Widest media footprint — directly feeds the ingestion pipeline (§5)
2. Broad passive comprehension across the region
3. One of only two Arabic locales Azure will assess (§7.6.1). Levantine is not.

**Implementation.** Automated assessment stays MSA-only; the MDD corpora and `ar-SA` are formal-register. Dialect enters as listening comprehension and conversational vocabulary, tagged per `[R-30]`. Neither needs a live speaker, so this proceeds unblocked. Dialect *speaking* has no automated path and waits for a reviewer (§12).

> **Status (v0.13): decided, not implemented — there is no Egyptian content.** All 118 words are tagged `msa`; the string `egy` appears in the app exactly once, in the function that renders the tag. Consequences worth stating plainly, because §3 previously listed register tags under "Built":
>
> - The register tag renders "MSA" on every card. It is real machinery with nothing to distinguish.
> - Phase 1's gate ("~40 dialect items recognized by ear") is unreachable.
> - The evidence caveat below is unfalsifiable as built: retention curves across two register tags need two register tags with content behind them. §13's unknown #2 cannot be answered.
> - Reason 3 for choosing Egyptian — that Azure will assess `ar-EG` — is load-bearing on nothing, since this section's own implementation note keeps assessment MSA-only. It should not count toward the decision.
>
> The decision itself still looks right; nothing here argues against it. But "integrate Egyptian from Phase 1" and "tag every card" are a content commitment (~40 listening items) that no build step owns, and until that content exists this section describes an intention.

#### 11.1.1 Egyptian as the primary target *(added v0.15 — owner direction)*

**Direction: the project targets Egyptian Arabic**, on the media-pool argument — Egyptian has by far the largest body of film, television, music, and online video, which is the supply the whole ingestion pipeline (§5) draws on, and §1 says that pipeline is the reason this project exists rather than Anki.

The plumbing is done: register is now a per-request parameter end to end. `/tts` picks the voice by register, `/assess` picks the locale by register, `/generate` receives the learner's chosen target, and Settings exposes the choice. Both registers work; picking one is configuration.

**What the shift does not do is improve generation accuracy, and this needs stating because it points the other way.** MSA and Egyptian are asymmetric in the written channel:

| | MSA | Egyptian |
|---|---|---|
| Written training data | Enormous — news, books, encyclopaedias, formal web | Thin and informal — subtitles, social media, some fiction |
| Spelling | Standardised | **Not standardised.** Common words have several accepted spellings |
| Diacritics | Conventional, with real tooling | Not conventional. `[R-35]`'s full-harakat requirement has far less to imitate |
| Root-indexed dictionary | Hans Wehr — the grounding `[R-18]` depends on | **No equivalent.** Colloquial dictionaries exist; a root-indexed authority of that standing does not |
| Azure assessment | `ar-SA` | `ar-EG` — equally supported |
| TTS | `ar-SA` voices | `ar-EG` voices exist, but they read *MSA orthography with an Egyptian accent*; how they handle colloquial spelling is **untested — verify by ear before trusting it** |

So the register shift **helps** media supply, listening relevance, and eventual conversation, and **hurts** generated-text reliability, diacritisation confidence, and — most sharply — verifiability, because `[R-18]`'s dictionary lookup is the one check in §6 that is cheap and definitive, and it does not exist for colloquial. Shifting register removes the cheapest verification tool at the same moment it makes the output harder to verify.

**Decision (v0.16, owner): MSA stays the generation register for now.** The deciding argument is §6.7 rung 1 — root correctness by dictionary lookup is the one check in the whole verification ladder that is cheap, mechanical and definitive, and Hans Wehr is an MSA reference. Moving to Egyptian would delete that rung at the same moment it made output harder to verify and pointed more volume at it. Verification first, register second.

Egyptian is not abandoned: it remains the eventual target for the reasons above, it is one tap away in Settings, and every card, voice and assessment call already carries its own register (`[R-52]`), so the switch stays a configuration change rather than a rewrite. **What would flip it:** rung 1 built for MSA and flag data (`[R-48]`) showing a tolerable error rate — at which point the cost of losing the dictionary is measurable instead of hypothetical. §11.1's original plan for Egyptian as *listening* content is unaffected and still unbuilt.

**`[R-52]`** Every content-producing and speech-consuming call MUST carry the register of the content it concerns, rather than reading a single global locale. A card's register determines its voice and its assessment locale.

**What would settle the TTS half:** an A/B of `ar-EG-ShakirNeural` against `ar-SA-HamedNeural` on the same diacritized words, using the existing voice-check button. If the Egyptian voice honours harakat where the Saudi one ignores them (§7.5.1), that is a real gain and should be recorded there. It is a ten-minute test and nobody has run it.

**Evidence caveat.** Al-Batal's own volume notes little empirical research exists on integration effectiveness. This rests on expert consensus and one comparative study. **What would change it:** interference rather than reinforcement, detectable by comparing retention curves across the two register tags — which `[R-30]` makes measurable *(once dialect content exists; see above)*.

### 11.2 Diacritics → Three-stage fade at the display layer

The research conflicts. Several studies find vowelization *reduces* reading fluency through added visual load (Ibrahim 2013; Asadi 2017; Saiegh-Haddad & Schiff 2016); others find the opposite; Abu-Rabia's 2019 review exists to summarize the contradiction. Most of this work studies native-speaking children — a different population from an adult L2 beginner, which constrains the answer rather than determining it.

Actionable findings: a 2026 *Journal of Psycholinguistic Research* review recommends careful scaffolding through the vowelized-to-unvowelized transition, and an established NLP line on **partial diacritization** restores short vowels only where they resolve genuine ambiguity.

| Stage | Phase | Display |
|---|---|---|
| Full | 0–1 | Every harakat shown |
| Partial | 2–3 | Only where disambiguating; predictable vowels dropped |
| Bare | 4+ | Undiacritized, tap-to-reveal |

**`[R-35]`** Stored content MUST remain fully diacritized regardless of display stage. Fading is a rendering decision. TTS and phoneme alignment both require full diacritics.

**`[R-36]`** Any card MUST be pinnable to full harakat regardless of phase. New or difficult vocabulary does not inherit the global setting.

**`[R-37]`** Fade MUST trigger on retention, not calendar. A card moves to partial display after surviving a long interval.

### 11.3 Trust calibration → Accumulate now, label later

Verification against a live speaker is not optional; nothing else establishes whether automated feedback is trustworthy. But the search for a reviewer has an unpredictable timeline, and blocking the build on it trades a certain delay for an uncertain benefit.

**Calibration data does not have to be labeled when produced.** Every speech attempt is logged with its audio. If a representative sample is retained, a reviewer arriving in month six can label material from month one.

> **Correction (v0.13): the interim protocol below is not running, and the delay is now costing data.**
>
> Tier 2 shipped, so the protocol's own trigger ("active from the day Tier 2 ships") fired some time ago. Steps 1 and 4 hold — attempts are logged, `human_verdict` stays null — and the log now keeps the structured verdict: what was heard, the composite score, and which sounds were flagged. **Steps 2 and 3 do not hold. The audio is discarded the moment `/assess` returns.**
>
> A reviewer cannot label a score they cannot listen to, so every Tier 2 attempt made so far is unlabelable and always will be. The §14 index row read "delay costs time-to-answer, not data" — that was true as designed and false as built, and it made the reviewer search look less urgent than it is.
>
> **What it takes to make it true:** audio retention on the learner's own backend — an R2 bucket on the same Cloudflare account, with the stratified reservoir sample of `[R-33]` maintained client-side and the sampled clips uploaded. That is a genuine build step, not a patch, and it is not in §10's sequence. Until it is done, `[R-33]` is unmet and §11.4's ~80-item threshold is unreachable, which means the Azure-vs-fine-tune decision stays pending indefinitely rather than pending on reviewer availability.

**Interim protocol, active from the day Tier 2 ships:**

1. Every attempt writes to `speech_attempt`. *(done)*
2. The calibration pool maintains a stratified reservoir sample per `[R-33]`. *(not built)*
3. Pool audio persists indefinitely; everything else expires normally. *(not built — no audio is retained at all)*
4. `human_verdict` stays null. *(done)*

**On reviewer arrival:** export 20 items per session — blind, unlabeled, randomized, balanced between flagged and passed. Four sessions clears the backlog and yields per-phoneme precision and recall on this learner's actual voice, which beats any published benchmark for this purpose.

Sampling the *passed* items is the point. Reviewing only flagged items measures false rejects and reveals nothing about false accepts — the failure mode the benchmark says will dominate at ~30%.

**Interim costs:**

- Tier 2 output is unvalidated. Per `[R-31]` it cannot gate advancement, and per `[R-20]` it is labeled provisional. A learner acting on unverified feedback can drill an error into permanence.
- §11.4 stays `[PENDING]`. Neither branch triggers.
- Prosody remains unaddressed (§11.5).
- *(v0.13)* Every Tier 2 attempt made before audio retention exists is permanently unlabelable. This cost compounds daily and is the one item on this list that gets worse rather than merely staying constant.
- *(v0.13)* Because `ar-SA` returns no phoneme labels, the sound named to the learner is matched positionally onto the word's letter skeleton — a guess that equal segment counts make plausible, not correct. It is now marked as a guess in the UI and hedged in the coaching prompt, but validating it is exactly what the pool would do, and cannot.

**There is no adequate substitute.** Free exchange platforms (HelloTalk, Tandem, ConversationExchange) supply real ears and are worth using for practice, but will not produce structured blind labels. Self-assessment fails at exactly the phonemes that matter — a beginner cannot hear their own ع error. Cross-checking Azure against a second engine measures agreement, not correctness; §6.1's warning about confident convergence applies unchanged.

### 11.4 Fine-tuned MDD model → No. `[PENDING]` confirmation.

This was the largest engineering risk in the document; §7.6.1 removes it. Azure covers `ar-EG` and `ar-SA`, so an off-the-shelf option exists and the ML project leaves the critical path.

Build Tier 2a against Azure. Accumulate the pool. Once **~80 labeled items exist** — a data threshold, not a calendar one, since labeling depends on reviewer availability — decide:

- **Azure performs acceptably** → done. No training ever happens. Most likely outcome.
- **Azure fails on specific phonemes** (plausible for ق) → exclude those from automated scoring, route to human review. Targeted fix.
- **Azure fails broadly on MSA** → consider the IQRA fine-tune, with labeled data already in hand.

Until then the decision is pending: neither branch triggers, Azure stays, output stays provisional. The contingency is better positioned than before — if the fine-tune ever happens, it starts with real labeled data from this learner's voice.

### 11.5 Prosody → Out of scope for automation

No available tool assesses MSA prosody for learners, and the open corpora are recitation-register (§7.7), so a system trained on them would judge rhythm against a performance style the learner is not attempting. Building this means building from scratch, for one user, with no benchmark.

Prosody, rhythm, and stress go to a human ear and are **unaddressed until one is available**. This is a real gap, and the strongest single argument for concluding the reviewer search. Exchange partners can partially cover it in the interim — impressions rather than structured feedback, which for prosody is more useful than it would be for segmental accuracy. Revisit at Phase 3.

### 11.6 Sustainability → Three conditions, not intentions

The risk is that building the system becomes the project and Arabic never gets learned. §11.4 helps — the most seductive engineering task is now a contingency. The general failure mode remains, so it is mechanized.

**Usage bounds building** — `[R-34]` as amended (v0.7): building may run ahead of usage while motivation is high, but `[R-38]`'s heatmap floor is a hard stop, not advice.

> **On the v0.7 amendment** *(added v0.13, prompted by outside review)*. The safeguard aimed at this section's own stated failure mode was retired three days into the first usage window it applied to, by the person it constrains, using §2.4's research to justify removing a §2.4-motivated constraint. That may well have been the right call — but this section is titled "Three conditions, not intentions," and the v0.7 note's framing ("only the enforcement mechanism moved") understates what happened: for `[R-34]`, the enforcement mechanism *was* the requirement, and what remains is an intention. Recorded here so the amendment is legible as what it is rather than as a neutral clarification. `[R-38]` carries the whole load now, which is why its automation below is not optional.

**`[R-38]`** If the 30-day activity heatmap drops below 15 active days, all building stops until it recovers. A system under active development and not in use has failed at its only purpose, and adding features is the most appealing way to avoid noticing.

> **`[R-38]` is now computed, not eyeballed** *(v0.13)*. It was thirty dots to count by hand — which is exactly the check that stops happening at the moment it starts mattering. The Progress tab now states the active-day count outright and says plainly when the floor is breached. The wording addresses the build, not the learner: missed days carry no penalty or reproach, per `[R-8]`.
>
> **`[R-49]`** A requirement whose purpose is to fire when the owner is least inclined to check it MUST be computed and surfaced by the app, never left as a manual inspection. `[R-38]` satisfies this; `[R-39]`'s 200-item checkpoint does not yet.

**`[R-39]` `[HUMAN]`** When the calibration pool reaches 200 items, the reviewer search stops being a background task. At that point the system generates unvalidated feedback at full rate with nothing checking it, the pool has stopped growing usefully, and no further engineering improves the situation. Building continues; the search moves to the top of the non-engineering list.

All three are checkable from data the app already tracks — *and "checkable" is not "checked," which is the point of `[R-49]`*. `[R-38]` is now surfaced by the app. `[R-39]`'s 200-item pool checkpoint cannot be, because the pool does not exist (§11.3); as things stand it will never trigger, which is the failure mode `[R-39]` was written to prevent.

### 11.7 Sharing model → Replicable single-user deployments

*(Added v0.6, July 2026 — decided when classmates in an introductory Arabic course asked to use the system.)*

The §1.1 non-goal stands: **no multi-tenancy, ever.** No accounts, no shared infrastructure, no learner's data or API spend on another learner's stack. Sharing works by **replication**: each learner runs the entire system for themselves.

- **Through Step 3 this is already free.** The client is a static PWA; state is per-browser `localStorage`. Anyone with the URL (or the file) gets independent progress with zero engineering.
- **From Step 4, the backend is a template.** The repo is structured so a new learner can fork (or "Use this template"), one-click deploy the serverless backend (Cloudflare Workers / Vercel free tier), and enter **their own API keys as environment variables** in their own deployment. Keys never enter client code — `[R-16]`-style vendor choices and billing stay per-learner, and `[R-10]` is preserved exactly.
- **The client gains one settings surface at Step 4:** the URL of the learner's own backend plus a private access token. Nothing else. (The token was implicit anyway — a keyed backend reachable from the open web needs one, or anyone with the URL can spend the owner's credits.)

**`[R-41]`** The client MUST NOT accept or store third-party API keys. The only credentials it holds are the learner's own backend URL and its access token.

**`[R-42]`** Backend configuration MUST be limited to environment variables plus a documented deploy path, so that "run your own" stays a fork-deploy-paste operation, not an ops project.

**What "run everything from your own device" means here:** the study loop is fully on-device (`[R-11]`); generation, verification, and speech assessment are calls from your backend to your own cloud accounts (§10.1 keeps ML off the critical path, so there is no local-model fallback). The "installer" is the Step 3 PWA install.

### 11.8 Platform support → Chromium-first, tested; iOS/WebKit best-effort

*(Added v0.8, July 2026 — owner decision. The owner's devices are Android + desktop.)*

**Supported and tested:** Chromium browsers — Chrome/Edge/Brave on Android and desktop. All automated verification runs on Chromium; acceptance criteria are met when they pass there.

**Best-effort:** iOS. Not because iOS users are excluded, but because iOS cannot be brought into the Chromium tier at all: Apple requires every iOS browser, including Chrome-branded ones, to run Safari's WebKit engine, and true home-screen PWA install on iOS goes through Safari's Add to Home Screen. "Use Chrome on iPhone" does not escape Safari — it *is* Safari underneath. The app follows web standards WebKit supports, and iOS users may well find everything works; nothing is tested there and nothing blocks on it.

**Consequences:**

- Web-standard APIs only; no Chromium-proprietary features, so the best-effort tier stays plausible for free.
- Platform-specific bugs on iOS are accepted as reported-when-reported; they never block a build step.
- If a future co-learner on iOS hits a wall, the fix is scoped and deliberate, not an ambient support obligation.

**`[R-43]`** Acceptance criteria MUST NOT require verification on non-Chromium platforms. Step 5's mic-capture criterion is amended accordingly (Android Chrome + desktop Chrome).

### 11.9 Cost & accessibility → Free-first, paid as documented upgrade

*(Added v0.9, July 2026 — owner decision, prompted by sharing with classmates.)*

Free is weighted extremely high: anyone copying this project should be able to run all of it without paying. Better-but-paid options remain legitimate — as **documented, optional upgrades**, never as the only path.

**`[R-44]`** The core study loop (letters, vocabulary, spaced repetition, recorded audio, offline PWA — Steps 1–3 scope) MUST remain free **and account-less**: open the URL, study. No signup may ever be added in front of it.

**`[R-45]`** Every cloud-dependent feature MUST have a documented path that costs $0 at single-learner volume, and SHOULD avoid requiring a new vendor account where an already-required account can serve. Paid alternatives are permitted only as optional upgrades documented alongside the free path; the free path must stay functional, not a degraded stub.

**Verified free-tier ladder (July 2026):**

| Layer | Free path | Verified allowance | Paid upgrade (optional) |
|---|---|---|---|
| Study (Steps 1–3) | Static PWA, recorded audio | Unlimited; no account | — |
| Sync (Step 4) | Cloudflare Workers free plan | KV + requests far beyond one learner | Workers Paid ($5/mo) if ever needed |
| Tier 1 ASR (Step 5) | **Workers AI Whisper** (`@cf/openai/whisper-large-v3-turbo`, `task:"transcribe"`, `language:"ar"`) — same Cloudflare account as Step 4, zero new vendors | 10,000 neurons/day, resets daily | Azure Speech STT, or any commercial ASR |
| Tier 2a MDD (Step 7) | Azure Speech **F0** | 5 audio-hours/month — ample for single-word drills | Azure S0 pay-as-you-go |
| Generation (Step 6) | Free-tier model APIs (choose at build time; verify then) | — | Paid model APIs |

> **`[R-45]` is currently violated on audio** *(added v0.13)*. The requirement says the free path must stay "functional, not a degraded stub." With no human recordings, what a learner actually hears is: on the paid path, an Azure neural voice; on the free path, whatever Arabic voice their OS happens to have — and the app's own Settings copy warns that when there is none, "words may sound wrong (a non-Arabic voice reading Arabic)." For a system whose §2.2 names guttural consonants as the central difficulty, a non-Arabic voice reading Arabic is not a degraded stub, it is anti-teaching. Committing pre-generated clips ([R-12], §4.2) closes this: both paths then get the same audio, and Azure's remaining advantage is Tier 2 assessment, which is a genuine upgrade rather than a paywall on the basics.

**Tier 1 ASR decision (supersedes an implicit Azure-first assumption):** Workers AI Whisper wins on the two criteria that now dominate — $0 and zero additional signup (the learner's Cloudflare account already exists from Step 4). Whisper's documented Arabic weaknesses (§7.4) are acceptable at Tier 1 *because* Tier 1 is a yes/no intelligibility probe whose failure mode is explicitly "may be the model's fault" (`[R-23]`), and `task:"transcribe"` pins it against the translate-to-English failure. If it proves too weak even for the probe, Azure STT is the documented escalation — and arrives at Step 7 regardless.

### 11.10 Speaking is a standalone words-only activity; letters are recognition-only

*(Added v0.10, July 2026 — owner decision after live testing.)*

Testing Tier 1 on **isolated letters failed by construction.** ASR transcribes words, not bare phonemes: saying ف is transcribed as ف, never the letter's name فاء, so a correct production reads as "not understood." The grapheme-to-phoneme gap (§7.3) is worst exactly here. A learner also can't tell whether they mispronounced or the model failed — the trust-corroding case `[R-20]`/`[R-23]` warn about.

The decision:

- **The alphabet is a recognition target.** Phase 0 gates on recognising letters and their sounds, not on automated production scoring. Learners hear the sound via reference audio (`[R-24]`) and the abundant external alphabet resources; there is no automated letter-pronunciation feedback.
- **Speaking practice is its own activity, over words only.** It is separated from recognition review (the review loop has no microphone), honouring `[R-29]`'s separate-tracks requirement with an independent production schedule.
- **The Tier 1 verdict is advisory, never a gate.** In speaking practice the learner self-grades; the understood/not-understood result is information, not an auto-grade — consistent with `[R-31]` (provisional feedback must not gate) and the precision-over-recall posture.

**`[R-46]`** Automated pronunciation feedback MUST operate at the word level, never on isolated letters. Letter cards MUST NOT present production assessment.

**What would change it:** a genuine phoneme-level MDD path (Tier 2b, §11.4) could assess isolated sounds — but that contingency is not scheduled, and word-level production plus human review (§12) covers the need meanwhile.

---

## 12. `[HUMAN]` The reviewer role

Not an engineering task. Included because the role is unusual enough that screening for it with ordinary tutor criteria will fail.

### 12.1 Two jobs, possibly two people

| Job | What it is | Frequency |
|---|---|---|
| **Labeler** | Blind judgment on recorded clips: was this phoneme correct? No teaching, no encouragement. | Monthly, ~30 min |
| **Teacher** | Conventional tutoring: Egyptian conversation, prosody, correcting things the system cannot see | Whatever cadence suits |
| **Content checker** *(added v0.13)* | Spot-check 20 generated Arabic words a month: spelling, diacritics, and whether the stated root is the real root | Monthly, ~20 min |

The content checker is the missing counterpart to the labeler. §11.3 is meticulous about not trusting pronunciation feedback before a human has verified it, while generated vocabulary — which enters spaced repetition and gets drilled — has never been checked by anyone (§6.6, and the README's content accuracy note). It needs no blinding and no protocol: it is proofreading, it suits the same person as either other job, and 20 items a month is enough to tell whether Step 10's cross-vendor verification is worth building. `[R-48]` gives it somewhere to record the answer.

These need different aptitudes and **do not have to be the same person.** Splitting them is often easier: labeling is mechanical annotation work that suits a marketplace like Upwork as readily as italki, and it can be asynchronous — send audio files and a form, no scheduling required. Teaching is conventional and easy to source.

If one person does both, keep the sessions separate. A labeling pass that drifts into a lesson stops producing usable labels.

### 12.2 Screening the labeler

**Requirements:**

1. **Native or near-native MSA competence.** Not merely a native Arabic speaker. MSA is a second register for native speakers too, and a fluent Egyptian speaker is not automatically a reliable MSA judge. Ask directly: how much formal MSA do they use, and in what context?
2. **Willingness to work blind.** They will not be told the system's verdict, and they will not see whether their judgment agrees with it. Some people find this uncomfortable.
3. **Tolerance for repetitive mechanical work.** Twenty clips, mark each correct or incorrect, no coaching, done. This is annotation, not teaching, and many good tutors will find it unrewarding.
4. **Willingness to render a binary verdict.** "Was this ع correct — yes or no?" not "how did that sound?"
5. **Consistency over credentials.** The same person over time matters more than qualifications, because the measurement is a signal against a fixed reference. Changing labelers mid-stream contaminates the comparison.

**Disqualifying signals:**

- Reframes the task as a lesson despite instruction
- Substitutes encouragement for judgment — "good try, keep going" produces no label
- Cannot judge without hearing the intended word first (this leaks the answer and biases the verdict)
- Confident only in dialect
- Inconsistent on repeated items — see the reliability test below

### 12.3 The reliability test

**`[R-40]` `[HUMAN]`** Seed every labeling batch with 2–3 duplicate clips drawn from earlier batches, unmarked.

If the same clip receives different verdicts across sessions, the labeler is noisy and the calibration built on their labels is worthless — potentially worse than no calibration, because it produces a confident and wrong picture of the system's accuracy. This is a measurement of the measurement instrument, and it costs almost nothing.

Target: ≥90% agreement with their own prior verdicts. Below that, retrain the labeler on the task definition or find another.

### 12.4 How to make the ask

The request is unusual and will be misread as a normal tutoring booking. Be explicit up front:

> I'm learning Arabic and using software that gives automated pronunciation feedback. I need to check whether the software is actually correct. The task is: I send you 20 short recordings of myself saying single words. For each one, you mark whether a specific sound was pronounced correctly — just yes or no, no explanation needed unless you want to add one. You won't be told what the software concluded, because I need your independent judgment.
>
> It's about 30 minutes a month and it's more like proofreading than teaching. Separately, I'd also be interested in regular conversation practice if that's something you offer.

Two things this accomplishes: it filters out anyone who will reflexively convert the task into a lesson, and it makes the blind condition a stated requirement rather than a surprise.

### 12.5 Screening the teacher

Ordinary criteria, plus:

- **Egyptian dialect** (§11.1), with enough MSA to explain the relationship between the two
- **Comfortable with a self-directed learner** — the curriculum is set; they supplement it rather than replacing it
- **Willing to work on prosody explicitly** (§11.5), since no automated path exists and this is where a human is most valuable
- **Willing to record audio** — *nice to have, not a screening criterion since v0.14. The app ships synthetic clips ([R-24]), so recordings are an upgrade to schedule once someone is engaged, not a gap to hire against.*

### 12.6 Cost

Arabic community tutors on italki run roughly $5–15/hour, professional teachers $15–40, with Arabic on the lower end of the platform's range. A monthly half-hour labeling session is $10–20. Asynchronous annotation via a general freelance marketplace may cost less.

The engineering time this validates is worth substantially more than the fee, which is the reason to conclude the search rather than let it lapse.

---

## 13. Remaining unknowns

Not pending decisions — questions only answerable by running the system.

1. **Does the learner speak aloud into a phone mid-session?** Build step 5 exists to find out. If no, the entire pronunciation branch needs a different interaction model.
2. **Does MSA/Egyptian integration reinforce or interfere?** §11.1 bets on reinforce. Retention curves across register tags will show it within months.
3. **Does pipeline-generated content get studied,** or is ingestion more appealing than the resulting cards? Measurable: compare review completion rates for generated versus core-deck cards.
4. **What is Azure's real per-phoneme accuracy on this voice?** Unknowable from published benchmarks. §11.3 is designed to produce it — *and currently does not, because no audio is retained. As built this is not an open question but an unanswerable one.*
5. **Is the generated Arabic correct?** *(added v0.13)* Nobody knows, and nothing is set up to find out (§6.6). Generated words enter spaced repetition, where being wrong is drilled rather than forgotten. `[R-48]` is the smallest thing that would start answering it.
6. **Is 12 the right session cap?** *(added v0.13)* `[R-5]`'s number is a guess (§2.4). The review log now records what would settle it.

---

## 14. Decision index

| Decision | Rationale |
|---|---|
| Roots as first-class entity, not a tag | Largest available lever on Arabic vocabulary acquisition |
| Hard 12-card session cap | Sessions end at completion, not exhaustion |
| Consistency metrics, never fluency percentage | An honest fluency bar reads ~0 for months |
| PWA rather than native | One codebase, both platforms, no store review |
| Backend mandatory | API keys cannot ship in client code |
| Offline study loop, audio cached on device | 5-minute windows appear where there is no network |
| Tiered verification, escalating | Ensembling is expensive; most content does not need it |
| Cross-vendor verifiers | Same-model verification shares blind spots |
| Dictionary grounding over model voting | Lookup is definitive where a source exists |
| No orchestration framework | A 4-stage pipeline is a script, not a graph |
| Append-only review and speech logs | Scheduler changes can be replayed against real history |
| Content depth before pipeline sophistication | A thin deck with a smart pipeline is a demo |
| Production tracked separately from recognition | Different skills, different decay rates |
| Speaking is a standalone, words-only activity; letters recognition-only | Isolated letters don't round-trip through ASR; recognition is the goal for the alphabet (§11.10) |
| Assessment tuned toward precision | False rejects destroy trust and compound with `[R-8]` |
| Phoneme model detects, LLM explains | A text model asked to judge audio confabulates fluently |
| Ship synthetic clips now; human recordings later | Amended v0.14. Synthesis is still least trustworthy on the pharyngeals, but making the audio loop wait on a speaker nobody had found meant shipping no audio at all ([R-24]) |
| Vocabulary covers gendered forms, not just the masculine citation form | The dictionary convention makes half of ordinary speech invisible, and does so silently ([R-51]) |
| One card shows both gendered forms, rather than two cards | The alternation is the thing to learn, and splitting it would halve the rate of new material against a 12-card cap (§2.3.1) |
| Synthetic clips are committed and labelled, not fetched per learner | [R-12] wants fixed core audio on-device; a manifest keeps "synthetic" honest and lets a human recording win later ([R-24a][R-24b]) |
| AGPL-3.0, not a permissive licence | Every fork and every hosted copy stays free and open; §13 closes the host-it-without-releasing loophole (§11.7) |
| Automated feedback limited to segmental accuracy | Corpora are recitation-register; prosody would not transfer |
| Tier 1 speech before Tier 2 | Prove the learner will speak aloud before investing further |
| Egyptian integrated from Phase 1 | Integration appears not to cost MSA outcomes; media footprint; Azure covers `ar-EG` |
| Machine assesses MSA, human assesses dialect | No automated path exists for dialect speech |
| MSA stays the generation register; Egyptian remains the eventual target | Egyptian has the media the pipeline needs, but deletes §6.7's one definitive check — Hans Wehr is MSA. Verification first, register second (§11.1.1) |
| Register travels with the content, not as a global setting | A card's own register has to pick its voice and its assessment locale (`[R-52]`) |
| Verification is a ladder, not an ensemble | Deterministic checks and dictionary lookups beat model votes; models converge confidently on the same wrong diacritics (§6.7) |
| Register tagged on every card | The risk is not learning two registers — it is not knowing which is which |
| Diacritics fade at display layer only | Data must stay diacritized; fading stays free and reversible |
| Fade triggered by retention, not calendar | Tracks mastery rather than elapsed time |
| Commercial API before any fine-tuning | Azure covers `ar-SA`/`ar-EG`; removes ML from the critical path |
| Calibration sample blind and two-sided | One-sided sampling misses the dominant failure mode |
| Calibration pool accumulates before a reviewer exists | Labels apply retroactively — **but only if audio is kept, and it isn't; as built, delay costs data too (§11.3)** |
| Duplicate clips seeded into every batch | Measures the measurement instrument; noisy labels are worse than none |
| Labeler and teacher may be different people | Different aptitudes; labeling is async annotation work |
| Reviewer search parallel, with a 200-item checkpoint | Unblocks the build without letting "not blocking" become "not happening" |
| Provisional feedback cannot gate phases | Acting on unverified feedback drills errors into permanence |
| Building may run ahead of usage; heatmap floor ([R-38]) is the hard stop | Amended v0.7: ride motivation while it's high; a heatmap below 15/30 active days still halts all building |
| Sharing by replication, never multi-tenancy | Each learner forks and deploys their own backend with their own keys; the client never holds API keys (§11.7) |
| Chromium-first; iOS/WebKit best-effort | All testing and acceptance runs on Chromium (Android + desktop). iOS cannot join that tier — every iOS browser is WebKit underneath (§11.8) |
| Free-first: core account-less, cloud features $0 at one-learner volume | Accessibility for co-learners; paid options only as documented optional upgrades (§11.9) |
| Tier 1 ASR on Workers AI Whisper, not Azure | $0 and zero new vendor beats accuracy for a yes/no intelligibility probe; Azure is the escalation and arrives at Step 7 anyway (§11.9) |
| Synthetic voice on Azure, not the §7.5 shortlist | A stopgap should reuse an account already required, not add a vendor (§7.5, §11.9) |
| Card ids are stable identifiers, never array positions | Positional ids froze the content order permanently and made a root an index, not an entity (`[R-50]`) |
| A study day is the learner's local day | UTC dates shortened every interval east of UTC and mis-credited evening study in the Americas (§9, v0.13) |
| Retention, not exposure, is what "known" means | Two reps is two days; `[R-28]` asks for survival across a long interval, and an inflated "known" list also mis-levels generated content |
| Requirements that fire when the owner isn't looking must be computed by the app | "Checkable from data the app tracks" is not the same as checked (`[R-49]`, §11.6) |
| Fonts ship with the repo | A CDN font link left Arabic in a fallback face on a cold offline start, against `[R-11]` |
| Content lives in the app; content/ is a generated export | The single-file design has no build step, so a hand-maintained "authoring source" silently drifted from what shipped |
