# Judhūr — Design Document

**A personal Arabic learning system for a native English speaker with ADHD, built around root-family vocabulary and personally meaningful input.**

Version 0.7 · July 2026 *(0.6 adds §11.7, the sharing model; 0.7 amends [R-34] — building may run ahead of usage, [R-38] remains the hard stop)*

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
| Guttural sounds absent from English (ح ع خ غ ق) | Flagged on those cards; Phase 0 gates on *producing* them, not reading them (§7) |
| Root-and-pattern morphology | Used as the core organizing principle rather than treated as a hurdle |
| MSA vs. dialect split | Integrated from Phase 1 (§11.1), tagged per card, never blended |
| Verb conjugation complexity | Deferred to Phase 2, after comprehension rewards exist |

*Sources:* livexp.com; madinaharabic.com; earabiclearning.com; arabiclanguagesolutions.co.uk.

### 2.3 Root families are the biggest available lever

Arabic words derive from three-consonant roots carrying a core meaning, reshaped by vowel patterns and affixes. Learn ك-ت-ب ("writing") and كَتَبَ (he wrote), كِتَاب (book), كَاتِب (writer) arrive as a family rather than three separate memorizations.

**Evidence quality:** the qualitative claim — morphological awareness aids acquisition — is well supported in second-language acquisition literature. The specific multipliers in circulation (40–60% faster, 2–3×) trace to vendor blogs citing unnamed studies. Treat the direction as reliable and the numbers as marketing.

**`[R-3]`** Roots MUST be a first-class entity in the data model, not a tag on a word. Vocabulary is browsed, introduced, and reviewed by family.

**`[R-4]`** When selecting new vocabulary to introduce, the system MUST prefer words derived from roots the learner already knows.

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

*Sources:* abblino.com; en.wikipedia.org distributed practice; lifeskillsadvocate.com; tiimoapp.com; adhdcentre.co.uk.

---

## 3. Current state (v0)

Working prototype: `judhur-arabic-study.html`, single self-contained file.

**Implemented:** 28 letter cards (name, transliteration, sound description, example word) · 10 root families / 30 words, browsable by root · SM-2-style scheduler with 4-point grading · session runner with 12-card cap and completion screen · streak, XP, level, 30-day heatmap · 5-phase roadmap reference · `localStorage` persistence with in-memory fallback · keyboard shortcuts (space reveals, 1–4 grades, Esc exits).

**Absent by design:** audio, letter-form variants (initial/medial/final/isolated), grammar content, AI features, network calls beyond web fonts.

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

**`[R-24]`** The 28 letters and core vocabulary MUST use recorded human audio, not TTS. Pharyngeal and uvular consonants are where synthesis is least trustworthy and what the learner most needs to imitate. Source from Common Voice Arabic or record with a native speaker. TTS covers generated content only, where recording is impossible.

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

Advancement gates on evidence, not elapsed time.

| Phase | Focus | Advancement criterion |
|---|---|---|
| 0 | Script & sound | 28/28 letters at ≥3 successful reps, interval ≥7 days, **and each produced aloud at Tier 2 pass** |
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

**`[R-33]`** Audio MUST be retained indefinitely where `in_calibration_pool` is true, and expired on the normal schedule otherwise. The pool is a stratified reservoir sample balanced across flagged/passed attempts and over-weighted toward the pharyngeals and ق. Target 200 items. See §11.3.

---

## 10. Build sequence

Each step must be independently usable. Nothing depends on a later step to deliver value.

**`[R-34]`** *(amended v0.7, July 2026 — owner decision)* Building MAY proceed ahead of usage. The original rule — no step begins until its predecessor has 14 consecutive days of daily use — was retired three days into Step 2's usage window, on the owner's judgment that ADHD momentum cuts both ways: the activation cost of *resuming* a shelved build is the same cost the rest of this document works to avoid, so finishing the app while motivation is high is the better long-run bet. `[R-38]` remains fully binding and is now the sole usage safeguard: if the 30-day heatmap drops below 15 active days, all building stops. The original rule's intent — a system nobody studies with has failed — stands unchanged; only the enforcement mechanism moved.

| Step | Deliverable | Acceptance criteria |
|---|---|---|
| **1** | v0 HTML in daily use | ✅ Complete |
| **2** | Content expansion: all letter forms (initial/medial/final/isolated), ~30 root families, recorded core audio | All 28 letters show 4 positional forms; ≥90 words across ≥30 roots; every letter and core word has recorded human audio playable offline |
| **3** | PWA | Installs to home screen on iOS and Android; study loop fully functional in airplane mode; audio plays offline |
| **4** | Backend skeleton + `/state` | No key in client bundle (grep-verifiable); profile syncs across two devices; client degrades gracefully when backend unreachable; backend deploys from the repo as a template with keys as env vars, and the client's only credentials are backend URL + access token (§11.7) |
| **5** | `/speak` + Tier 1 intelligibility | Mic capture works on iOS Safari and desktop Chrome; ASR round-trip returns understood/not-understood; result never displayed as a score |
| **6** | `/ingest` + `/generate`, verification Tier 1 | YouTube URL and article URL both produce a graded passage; output is fully diacritized; new words enter the review queue with provenance; extraction failures report a specific reason |
| **7** | Tier 2a Azure assessment + calibration pool | Per-phoneme results returned against `ar-SA`; pool populates with correct flagged/passed stratification; all output marked provisional; phase advancement unaffected |
| **8** | Tier 3 LLM coaching | Receives structured MDD output only, never raw audio; produces articulatory guidance; inherits the provisional label |
| **9** | Diacritic fade + register tagging UI | Three display stages selectable and phase-linked; per-card override works; stored data remains fully diacritized (verifiable); register visible on every card |
| **10** | Cross-vendor verification + dictionary grounding | Verifier is a different vendor than the generator; root claims validated by lookup; only if measured error rates warrant |
| **—** | *Contingency:* Tier 2b self-hosted MDD | Not scheduled. Trigger defined in §11.4. |

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

**Evidence caveat.** Al-Batal's own volume notes little empirical research exists on integration effectiveness. This rests on expert consensus and one comparative study. **What would change it:** interference rather than reinforcement, detectable by comparing retention curves across the two register tags — which `[R-30]` makes measurable.

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

**Interim protocol, active from the day Tier 2 ships:**

1. Every attempt writes to `speech_attempt`.
2. The calibration pool maintains a stratified reservoir sample per `[R-33]`.
3. Pool audio persists indefinitely; everything else expires normally.
4. `human_verdict` stays null.

**On reviewer arrival:** export 20 items per session — blind, unlabeled, randomized, balanced between flagged and passed. Four sessions clears the backlog and yields per-phoneme precision and recall on this learner's actual voice, which beats any published benchmark for this purpose.

Sampling the *passed* items is the point. Reviewing only flagged items measures false rejects and reveals nothing about false accepts — the failure mode the benchmark says will dominate at ~30%.

**Interim costs:**

- Tier 2 output is unvalidated. Per `[R-31]` it cannot gate advancement, and per `[R-20]` it is labeled provisional. A learner acting on unverified feedback can drill an error into permanence.
- §11.4 stays `[PENDING]`. Neither branch triggers.
- Prosody remains unaddressed (§11.5).

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

**`[R-38]`** If the 30-day activity heatmap drops below 15 active days, all building stops until it recovers. A system under active development and not in use has failed at its only purpose, and adding features is the most appealing way to avoid noticing.

**`[R-39]` `[HUMAN]`** When the calibration pool reaches 200 items, the reviewer search stops being a background task. At that point the system generates unvalidated feedback at full rate with nothing checking it, the pool has stopped growing usefully, and no further engineering improves the situation. Building continues; the search moves to the top of the non-engineering list.

All three are checkable from data the app already tracks.

### 11.7 Sharing model → Replicable single-user deployments

*(Added v0.6, July 2026 — decided when classmates in an introductory Arabic course asked to use the system.)*

The §1.1 non-goal stands: **no multi-tenancy, ever.** No accounts, no shared infrastructure, no learner's data or API spend on another learner's stack. Sharing works by **replication**: each learner runs the entire system for themselves.

- **Through Step 3 this is already free.** The client is a static PWA; state is per-browser `localStorage`. Anyone with the URL (or the file) gets independent progress with zero engineering.
- **From Step 4, the backend is a template.** The repo is structured so a new learner can fork (or "Use this template"), one-click deploy the serverless backend (Cloudflare Workers / Vercel free tier), and enter **their own API keys as environment variables** in their own deployment. Keys never enter client code — `[R-16]`-style vendor choices and billing stay per-learner, and `[R-10]` is preserved exactly.
- **The client gains one settings surface at Step 4:** the URL of the learner's own backend plus a private access token. Nothing else. (The token was implicit anyway — a keyed backend reachable from the open web needs one, or anyone with the URL can spend the owner's credits.)

**`[R-41]`** The client MUST NOT accept or store third-party API keys. The only credentials it holds are the learner's own backend URL and its access token.

**`[R-42]`** Backend configuration MUST be limited to environment variables plus a documented deploy path, so that "run your own" stays a fork-deploy-paste operation, not an ops project.

**What "run everything from your own device" means here:** the study loop is fully on-device (`[R-11]`); generation, verification, and speech assessment are calls from your backend to your own cloud accounts (§10.1 keeps ML off the critical path, so there is no local-model fallback). The "installer" is the Step 3 PWA install.

---

## 12. `[HUMAN]` The reviewer role

Not an engineering task. Included because the role is unusual enough that screening for it with ordinary tutor criteria will fail.

### 12.1 Two jobs, possibly two people

| Job | What it is | Frequency |
|---|---|---|
| **Labeler** | Blind judgment on recorded clips: was this phoneme correct? No teaching, no encouragement. | Monthly, ~30 min |
| **Teacher** | Conventional tutoring: Egyptian conversation, prosody, correcting things the system cannot see | Whatever cadence suits |

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
- **Willing to record audio**, if core recordings are still needed for `[R-24]`

### 12.6 Cost

Arabic community tutors on italki run roughly $5–15/hour, professional teachers $15–40, with Arabic on the lower end of the platform's range. A monthly half-hour labeling session is $10–20. Asynchronous annotation via a general freelance marketplace may cost less.

The engineering time this validates is worth substantially more than the fee, which is the reason to conclude the search rather than let it lapse.

---

## 13. Remaining unknowns

Not pending decisions — questions only answerable by running the system.

1. **Does the learner speak aloud into a phone mid-session?** Build step 5 exists to find out. If no, the entire pronunciation branch needs a different interaction model.
2. **Does MSA/Egyptian integration reinforce or interfere?** §11.1 bets on reinforce. Retention curves across register tags will show it within months.
3. **Does pipeline-generated content get studied,** or is ingestion more appealing than the resulting cards? Measurable: compare review completion rates for generated versus core-deck cards.
4. **What is Azure's real per-phoneme accuracy on this voice?** Unknowable from published benchmarks. §11.3 is designed to produce it.

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
| Assessment tuned toward precision | False rejects destroy trust and compound with `[R-8]` |
| Phoneme model detects, LLM explains | A text model asked to judge audio confabulates fluently |
| Recorded audio for core, TTS for generated | Synthesis is least trustworthy on the pharyngeals |
| Automated feedback limited to segmental accuracy | Corpora are recitation-register; prosody would not transfer |
| Tier 1 speech before Tier 2 | Prove the learner will speak aloud before investing further |
| Egyptian integrated from Phase 1 | Integration appears not to cost MSA outcomes; media footprint; Azure covers `ar-EG` |
| Machine assesses MSA, human assesses dialect | No automated path exists for dialect speech |
| Register tagged on every card | The risk is not learning two registers — it is not knowing which is which |
| Diacritics fade at display layer only | Data must stay diacritized; fading stays free and reversible |
| Fade triggered by retention, not calendar | Tracks mastery rather than elapsed time |
| Commercial API before any fine-tuning | Azure covers `ar-SA`/`ar-EG`; removes ML from the critical path |
| Calibration sample blind and two-sided | One-sided sampling misses the dominant failure mode |
| Calibration pool accumulates before a reviewer exists | Labels apply retroactively; delay costs time-to-answer, not data |
| Duplicate clips seeded into every batch | Measures the measurement instrument; noisy labels are worse than none |
| Labeler and teacher may be different people | Different aptitudes; labeling is async annotation work |
| Reviewer search parallel, with a 200-item checkpoint | Unblocks the build without letting "not blocking" become "not happening" |
| Provisional feedback cannot gate phases | Acting on unverified feedback drills errors into permanence |
| Building may run ahead of usage; heatmap floor ([R-38]) is the hard stop | Amended v0.7: ride motivation while it's high; a heatmap below 15/30 active days still halts all building |
| Sharing by replication, never multi-tenancy | Each learner forks and deploys their own backend with their own keys; the client never holds API keys (§11.7) |
