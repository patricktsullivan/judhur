/* Judhūr backend — Cloudflare Worker.
   Step 4: /state (GET/PUT learner profile).
   Step 5: /assess — Tier 1 intelligibility via Workers AI Whisper
     (task:"transcribe", language:"ar" — §11.9). Returns understood/not
     understood, never a score [R-23]. Free at one-learner volume.
   Step 6: /ingest (URL/text → excerpt) + /generate (excerpt+profile →
     graded diacritized MSA). Tier-1 verification = single pass, no
     cross-vendor check (§6.3); that's Step 10. Generation is
     provider-agnostic: Workers AI by default (free, zero-config), or any
     OpenAI-compatible provider via GEN_BASE_URL/GEN_MODEL/GEN_API_KEY (§11.9).
   Remaining §4 endpoints are 501 stubs so the surface is visible but honest.
   Auth: Authorization: Bearer <SYNC_TOKEN>, set as a Worker secret [R-41].
   All configuration is env vars/secrets + wrangler.jsonc [R-42].
   Storage: Workers KV, single key — single learner by design (§1.1). */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Max-Age': '86400'
};
const MAX_STATE_BYTES = 512 * 1024;
const MAX_AUDIO_B64 = 2 * 1024 * 1024;   // ~1.5 MB of audio — plenty for one word

/* Arabic comparison for the Tier 1 verdict. Strips what ASR won't reliably
   echo back (harakat, tatweel), folds letters ASR confuses (alef variants,
   final yā/alef maqṣūra, tā marbūṭa/hā), drops non-Arabic characters. */
export function normalizeAr(s) {
  return (s || '')
    .replace(/[ً-ْٰـ]/g, '')  // harakat, dagger alif, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^؀-ۿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Understood iff the normalized expected form appears in the normalized
   transcript (Whisper may add stray tokens around a correct word). */
export function tier1Verdict(expected, heard) {
  const e = normalizeAr(expected);
  const h = normalizeAr(heard);
  if (!e) return { understood: false, reason: 'no expected text' };
  if (!h) return { understood: false, reason: 'nothing transcribed' };
  const understood = h === e || h.indexOf(e) >= 0 ||
                     h.replace(/ /g, '') === e.replace(/ /g, '');
  return { understood };
}

const MAX_INGEST_TEXT = 200 * 1024;
const SEG_MIN = 60, SEG_MAX = 300;   // words per adapted excerpt (§5.1)

/* Pragmatic readability: strip HTML to text. Not a full Readability port —
   §5.1 says naive extraction is acceptable initially. */
function decodeEntities(s) {
  return (s || '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&rsquo;|&apos;/gi, "'");
}
export function extractText(html) {
  const title = decodeEntities(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim()).trim();
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const main = h.match(/<article[\s\S]*?<\/article>/i) || h.match(/<main[\s\S]*?<\/main>/i);
  if (main) h = main[0];
  const text = decodeEntities(h
    .replace(/<\/(p|div|h[1-6]|li|section|article|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim();
  return { title, text };
}

/* First coherent 60–300 word passage (§5.2 naive selection). */
export function segment(text) {
  const paras = (text || '').split(/\n\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.split(' ').length >= 15);
  let chunk = '';
  for (const p of paras) {
    if ((chunk + ' ' + p).trim().split(' ').length > SEG_MAX && chunk) break;
    chunk = (chunk ? chunk + '\n\n' : '') + p;
    if (chunk.split(/\s+/).length >= SEG_MIN) break;
  }
  if (!chunk) chunk = paras[0] || (text || '').replace(/\s+/g, ' ').trim();
  const words = chunk.split(/\s+/);
  if (words.length > SEG_MAX) chunk = words.slice(0, SEG_MAX).join(' ');
  return chunk;
}

/* Extract the JSON object from a model reply — tolerant of code fences, prose
   before/after, and trailing commas. Uses brace-balancing (not lastIndexOf) so
   trailing prose containing a '}' doesn't corrupt the slice. */
export function parseModelJson(txt) {
  if (!txt) return null;
  if (typeof txt === 'object') return txt;   // provider already parsed the JSON for us
  const s = String(txt).replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = (end >= 0 ? s.slice(start, end + 1) : s.slice(start)).replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(body); } catch (e) { return null; }
}

/* The §5.4 generation prompt. The prompt carries the load. */
export function genPrompt(excerpt, profile) {
  const p = profile || {};
  const knownWords = (p.known_words || []).join('، ') || '(none yet)';
  const knownRoots = (p.known_roots || []).join(' / ') || '(none yet)';
  const target = p.target_new_words || 5;
  const register = p.register || 'MSA';
  return 'You adapt text into graded ' + register + ' Arabic for a beginner learner.\n\n' +
    'SOURCE EXCERPT (any language):\n"""\n' + excerpt + '\n"""\n\n' +
    'LEARNER PROFILE:\n' +
    '- Known words (reuse where possible): ' + knownWords + '\n' +
    '- Known roots (prefer new words from these): ' + knownRoots + '\n' +
    '- Introduce at most ' + target + ' new words.\n\n' +
    'RULES (all mandatory):\n' +
    '- Write in ' + register + '. Put FULL vowel diacritics (harakat) on every Arabic word.\n' +
    '- Preserve the meaning of the source; simplify the language, not the substance.\n' +
    '- Reuse known words wherever natural; at most ' + target + ' new words, preferring the known roots.\n' +
    '- Keep it to 2–4 short sentences.\n' +
    'Return ONLY valid JSON (no prose, no code fences) in exactly this shape:\n' +
    '{"arabic":"...","transliteration":"...","english_gloss":"...",' +
    '"new_words":[{"ar":"","translit":"","en":"","root":"","root_meaning":""}],"grammar_notes":"..."}';
}

/* Provider-agnostic model call. Configured OpenAI-compatible provider wins
   (Gemini/Groq/OpenAI/…); otherwise Workers AI (free, zero-config). */
async function callModel(env, prompt) {
  const messages = [
    { role: 'system', content: 'You output ONLY valid minified JSON in the exact shape requested — no prose, no markdown, no code fences.' },
    { role: 'user', content: prompt }
  ];
  if (env.GEN_BASE_URL && env.GEN_API_KEY) {
    const res = await fetch(env.GEN_BASE_URL.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.GEN_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.GEN_MODEL || 'gpt-4o-mini', temperature: 0.3, messages })
    });
    if (!res.ok) throw new Error('model provider HTTP ' + res.status);
    const j = await res.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  }
  if (env.AI) {
    // Default Workers AI model. IDs get deprecated periodically (this one replaced
    // llama-3.1-8b-instruct, retired 2026-05-30); override with GEN_WAI_MODEL when
    // Cloudflare rotates them, or to try a stronger-Arabic model (e.g.
    // @cf/qwen/qwen3-30b-a3b-fp8). Diacritized Arabic is token-heavy, so keep the
    // budget generous to avoid truncated (unparseable) JSON.
    const out = await env.AI.run(env.GEN_WAI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      { messages, max_tokens: 2048 });
    return out.response || '';
  }
  throw new Error('no generation model configured');
}

/* ---------- Tier 2 pronunciation (Azure) + Tier 3 coaching (§7.6) ---------- */
const MDD_FLAG_THRESHOLD = 40;   // conservative: flag a phoneme only if clearly low,
                                 // tuned toward precision so false rejects stay rare [R-19]

function b64utf8(str) {          // base64 of UTF-8 bytes (btoa alone breaks on Arabic)
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Reduce Azure's assessment JSON to per-word/phoneme scores + a flagged list.
   Only clearly-low phonemes are flagged (precision over recall [R-19]). */
function pickScore(o) {   // scores sit directly on the node (live shape) or nested (docs)
  if (!o) return null;
  if (o.AccuracyScore != null) return o.AccuracyScore;
  if (o.PronunciationAssessment && o.PronunciationAssessment.AccuracyScore != null) return o.PronunciationAssessment.AccuracyScore;
  return null;
}
/* The Arabic letters of a word, minus harakat/tatweel — i.e. the consonant +
   long-vowel skeleton. Azure scores exactly this sequence (short vowels dropped),
   so its per-phoneme scores line up with these letters positionally [Option B]. */
export function arLetters(s) {
  return (s || '').replace(/[ً-ْٰـ]/g, '').split('').filter(ch => /[ء-ي]/.test(ch));
}
export function parseAzureAssessment(j, threshold) {
  const t = threshold == null ? MDD_FLAG_THRESHOLD : threshold;
  const nb = j && j.NBest && j.NBest[0];
  if (!nb) return { ok: false };
  const words = (nb.Words || []).map(w => {
    const phonemes = (w.Phonemes || []).map(p => ({ phoneme: p.Phoneme || '', score: pickScore(p) }));
    /* Azure (ar-SA + default SAPI alphabet) returns empty phoneme labels. When its
       segment count matches the word's letter skeleton, name each score by position
       so Tier 2 can say *which* sound was off even without Azure's own label. If the
       counts diverge (e.g. sun-letter assimilation), we don't guess — labels stay
       empty and the client falls back to a word-level score. IPA labels, if present,
       are kept as-is (more precise than our letter map). */
    const letters = arLetters(w.Word);
    if (letters.length === phonemes.length && phonemes.some(p => !p.phoneme)) {
      phonemes.forEach((p, i) => { if (!p.phoneme) p.phoneme = letters[i]; });
    }
    return { word: w.Word, accuracy: pickScore(w), errorType: w.ErrorType || null, phonemes };
  });
  const detected = [];
  words.forEach(w => w.phonemes.forEach(p => {
    if (p.score != null && p.score < t) detected.push({ phoneme: p.phoneme, score: p.score, word: w.word });
  }));
  /* named = flagged sounds Azure actually labelled (ar-SA often returns empty labels) */
  const named = detected.filter(d => d.phoneme);
  return {
    ok: true, overall: pickScore(nb), pron: nb.PronScore != null ? nb.PronScore : null,
    completeness: nb.CompletenessScore != null ? nb.CompletenessScore : null,
    status: j.RecognitionStatus || null, words, detected, named
  };
}

/* Tier 3: the phoneme model said WHERE/WHAT; the LLM only says HOW to fix it —
   it never receives audio, only this structured list [R-22][R-25]. */
export function coachPrompt(word, detected) {
  const list = detected.map(d => d.phoneme).join(', ');
  return 'An Arabic learner said the word "' + word + '". A pronunciation checker flagged these sounds as possibly off: ' + list + '. ' +
    'For each flagged sound, give ONE short, physical tip on how to produce it (tongue/throat/lip position). ' +
    'Be brief and encouraging. Do NOT invent other errors — address only the listed sounds. Plain text, one line per sound.';
}

async function azureAssess(env, expected, audioBytes, contentType) {
  const region = env.AZURE_SPEECH_REGION;
  const cfg = b64utf8(JSON.stringify({
    ReferenceText: expected, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
    // Ask for IPA symbols. Confirmed: ar-SA returns empty phoneme labels regardless
    // (neither SAPI nor IPA populates them), so per-sound naming comes from the letter
    // skeleton instead (Option B). Kept because it's harmless and ar-EG/future locales
    // may honor it, in which case those real labels take precedence (§7.6).
    PhonemeAlphabet: 'IPA'
  }));
  const url = 'https://' + region + '.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=' +
    (env.AZURE_SPEECH_LOCALE || 'ar-SA') + '&format=detailed';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'Pronunciation-Assessment': cfg,
      'Content-Type': contentType || 'audio/webm; codecs=opus',
      'Accept': 'application/json'
    },
    body: audioBytes
  });
  /* Return status + raw text (don't throw) so we can see exactly what Azure said. */
  const text = await res.text();
  return { status: res.status, text };
}

/* Azure Neural TTS (§7, amended [R-24]) — synthetic preview audio, clearly labeled
   client-side. Returns MP3 bytes. ar-SA neural voice; region/key reuse the Speech
   resource. Free F0 tier covers single-learner volume. */
function xmlEscape(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
async function azureTTS(env, text, voiceOverride, ipa, tail) {
  const region = env.AZURE_SPEECH_REGION;
  const voice = (/^ar-[A-Z]{2}-\w+Neural$/.test(voiceOverride || '') ? voiceOverride : null)
    || env.AZURE_TTS_VOICE || 'ar-SA-HamedNeural';
  const locale = (env.AZURE_SPEECH_LOCALE || 'ar-SA');
  let inner = ipa
    ? "<phoneme alphabet='ipa' ph='" + xmlEscape(ipa) + "'>" + xmlEscape(text) + "</phoneme>"
    : xmlEscape(text);
  /* A trailing filler would put the word in connected speech (final vowel voiced), but
     this voice ignores <prosody volume='silent'> and speaks the filler aloud — so it's
     OFF by default (tail:true only for the diagnostic). Isolated words stay pausal. */
  if (tail === true) inner += "<prosody volume='silent'> شَيْء</prosody>";
  const ssml = "<speak version='1.0' xml:lang='" + locale + "'><voice name='" + voice + "'>" +
    inner + "</voice></speak>";
  const res = await fetch('https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1', {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'judhur-tts'
    },
    body: ssml
  });
  return res;
}

async function handleIngest(body) {
  if (body.text && body.text.trim()) {
    const text = body.text.trim().slice(0, MAX_INGEST_TEXT);
    return { ok: true, title: (body.title || 'Pasted text'), source_ref: (body.source_ref || 'pasted text'),
             excerpt: segment(text) || text };
  }
  const u = (body.url || '').trim();
  if (!u) return { error: 'no-input', reason: 'Provide a URL or paste some text.' };
  if (/(youtube\.com|youtu\.be)/i.test(u)) {
    return { error: 'youtube-unsupported', reason: 'YouTube captions aren’t supported yet — paste the transcript, or use an article URL.' };
  }
  let res;
  try { res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Judhur content ingest)' }, redirect: 'follow' }); }
  catch (e) { return { error: 'fetch-failed', reason: 'Could not reach that URL: ' + (e.message || 'network error') + '.' }; }
  if (!res.ok) return { error: 'fetch-failed', reason: 'That URL returned HTTP ' + res.status + '.' };
  if (!/text|html/i.test(res.headers.get('content-type') || '')) {
    return { error: 'not-text', reason: 'That link isn’t a text/article page.' };
  }
  const { title, text } = extractText(await res.text());
  if (!text || text.split(/\s+/).length < 40) {
    return { error: 'too-little-text', reason: 'Couldn’t find enough readable text (it may be paywalled or built with JavaScript). Try pasting the text directly.' };
  }
  const excerpt = segment(text);
  if (!excerpt) return { error: 'no-excerpt', reason: 'Couldn’t select a passage from that page.' };
  return { ok: true, title: title || u, source_ref: u, excerpt };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

async function authorized(req, env) {
  if (!env.SYNC_TOKEN) return false;           // unset secret = locked, never open
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const enc = new TextEncoder();
  const a = enc.encode(header.slice(7));
  const b = enc.encode(env.SYNC_TOKEN);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (!(await authorized(req, env))) return json({ error: 'unauthorized' }, 401);

    if (url.pathname === '/state') {
      if (req.method === 'GET') {
        const state = await env.JUDHUR_KV.get('state');
        return new Response(state || 'null', {
          headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }
      if (req.method === 'PUT') {
        const body = await req.text();
        if (body.length > MAX_STATE_BYTES) return json({ error: 'state too large' }, 413);
        try { JSON.parse(body); } catch (e) { return json({ error: 'invalid json' }, 400); }
        await env.JUDHUR_KV.put('state', body);
        return json({ ok: true, bytes: body.length }, 200);
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (url.pathname === '/assess' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      if (!body.expected || !body.audio) return json({ error: 'expected and audio are required' }, 400);
      if (body.audio.length > MAX_AUDIO_B64) return json({ error: 'audio too large' }, 413);

      /* Tier 2a — Azure per-phoneme assessment when configured (§7.6). All output
         is provisional [R-20][R-31] and precision-tuned [R-19]. */
      if (env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION) {
        let az;
        try {
          az = await azureAssess(env, body.expected, b64ToBytes(body.audio),
                                  body.contentType || 'audio/webm; codecs=opus');
        } catch (e) {
          return json({ error: 'pronunciation assessment call failed: ' + (e.message || 'unknown') }, 502);
        }
        /* A non-2xx from Azure is a configuration/format failure (bad key, wrong
           region, unsupported audio) — surface it honestly, don't pass it off as an
           unrecognized recording. */
        if (az.status < 200 || az.status >= 300) {
          return json({ error: 'Azure pronunciation service returned ' + az.status +
            ' — check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.' }, 502);
        }
        let azure = null;
        try { azure = JSON.parse(az.text); } catch (e) { /* non-JSON body */ }
        const parsed = azure ? parseAzureAssessment(azure) : { ok: false };
        if (!parsed.ok) {
          /* 200 but no usable assessment — Azure heard nothing matchable (a mumble). */
          return json({ tier: 2, provisional: true, notRecognized: true,
            note: 'Couldn’t make out the word from the recording.' }, 200);
        }

        /* Tier 3 — LLM turns the flagged phonemes into articulatory tips [R-22][R-25].
           The model never sees audio, only the flagged list. ar-SA returns no phoneme
           labels, so the flagged sounds are named positionally from the word's letter
           skeleton (parseAzureAssessment, Option B) before they reach the coach. */
        let coaching = null;
        if (body.coach && parsed.named.length && (env.AI || (env.GEN_BASE_URL && env.GEN_API_KEY))) {
          try { coaching = (await callModel(env, coachPrompt(body.expected, parsed.named))).trim(); }
          catch (e) { coaching = null; }
        }
        return json({
          tier: 2, provisional: true,
          note: 'Here is what the checker detected — it does not catch everything.',
          overall: parsed.overall, pron: parsed.pron, completeness: parsed.completeness,
          words: parsed.words, detected: parsed.detected, named: parsed.named, coaching
        }, 200);
      }

      /* Tier 1 — Whisper intelligibility fallback (no Azure). Never a score [R-23]. */
      if (!env.AI) return json({ error: 'speech not configured — deploy with the "ai" binding, or set AZURE_SPEECH_KEY' }, 503);
      let heard = '';
      try {
        const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
          audio: body.audio, task: 'transcribe', language: 'ar'
        });
        heard = (out && out.text) || '';
      } catch (e) {
        return json({ error: 'ASR call failed: ' + (e.message || 'unknown') }, 502);
      }
      const verdict = tier1Verdict(body.expected, heard);
      return json({ tier: 1, understood: verdict.understood, heard: heard.trim(), reason: verdict.reason || null }, 200);
    }

    if (url.pathname === '/tts' && req.method === 'POST') {
      if (!(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)) {
        return json({ error: 'tts not configured — set AZURE_SPEECH_KEY/REGION (client falls back to the device voice)' }, 501);
      }
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      let text = (body.text || '').toString().slice(0, 400);   // one word/phrase, not an essay
      if (!text.trim()) return json({ error: 'text is required' }, 400);
      /* Keep the diacritics by default — they carry the final short vowel a learner
         needs to hear (كَتَبَ → "kataba", not "katab"). Strip only when explicitly asked
         (diagnostic A/B), since stripping removes exactly that ending. */
      if (body.strip === true) text = text.replace(/[ً-ْٰـ]/g, '');
      const ipa = (body.ipa || '').toString().slice(0, 200) || null;
      let res;
      try { res = await azureTTS(env, text, body.voice, ipa, body.tail); }
      catch (e) { return json({ error: 'tts call failed: ' + (e.message || 'unknown') }, 502); }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return json({ error: 'Azure TTS returned ' + res.status, detail: detail.slice(0, 300) }, 502);
      }
      /* no-store: the response varies by POST body (the word), so it must never be
         cached by URL — doing so would replay one word's audio for every word. */
      return new Response(res.body, {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }
      });
    }

    if (url.pathname === '/ingest' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      const out = await handleIngest(body);
      /* [R-13]: extraction failures surface a specific reason, don't proceed */
      return json(out, out.error ? (out.error === 'no-input' ? 400 : 422) : 200);
    }

    if (url.pathname === '/generate' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      if (!body.excerpt) return json({ error: 'excerpt is required' }, 400);
      let raw;
      try { raw = await callModel(env, genPrompt(body.excerpt, body.profile)); }
      catch (e) { return json({ error: 'generation failed: ' + (e.message || 'unknown') }, 502); }
      const parsed = parseModelJson(raw);
      if (!parsed || !parsed.arabic) {
        const shown = (raw && typeof raw === 'object') ? JSON.stringify(raw) : String(raw);
        return json({ error: 'the model did not return usable JSON', raw: shown.slice(0, 600) }, 502);
      }
      /* Tier 1: single strong model, no cross-vendor verification (§6.3) */
      return json({
        arabic: parsed.arabic, transliteration: parsed.transliteration || '',
        english_gloss: parsed.english_gloss || '', new_words: parsed.new_words || [],
        grammar_notes: parsed.grammar_notes || '', tier: 1
      }, 200);
    }

    // §4 endpoints arriving in later build steps
    if (['/verify', '/speak'].includes(url.pathname)) {
      return json({ error: 'not implemented — later build step (design doc §10)' }, 501);
    }

    return json({ error: 'not found' }, 404);
  }
};
