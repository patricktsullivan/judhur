/* Judhūr backend — Cloudflare Worker.
   Step 4: /state (GET/PUT learner profile).
   Step 5: /assess — Tier 1 intelligibility via Workers AI Whisper
     (task:"transcribe", language:"ar" — §11.9). Returns understood/not
     understood, never a score [R-23]. Free at one-learner volume.
   Remaining §4 endpoints are 501 stubs so the surface is visible but honest.
   Auth: Authorization: Bearer <SYNC_TOKEN>, set as a Worker secret [R-41].
   All configuration is env vars/secrets + wrangler.toml [R-42].
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
      if (!env.AI) return json({ error: 'ASR not configured — deploy with the [ai] binding in wrangler.toml' }, 503);
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      if (!body.expected || !body.audio) return json({ error: 'expected and audio are required' }, 400);
      if (body.audio.length > MAX_AUDIO_B64) return json({ error: 'audio too large' }, 413);
      let heard = '';
      try {
        const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
          audio: body.audio,          // base64
          task: 'transcribe',         // pin against the translate-to-English failure mode (§7.4)
          language: 'ar'
        });
        heard = (out && out.text) || '';
      } catch (e) {
        return json({ error: 'ASR call failed: ' + (e.message || 'unknown') }, 502);
      }
      const verdict = tier1Verdict(body.expected, heard);
      /* understood / not understood only — never a score [R-23] */
      return json({ understood: verdict.understood, heard: heard.trim(), reason: verdict.reason || null }, 200);
    }

    // §4 endpoints arriving in later build steps
    if (['/ingest', '/generate', '/verify', '/speak'].includes(url.pathname)) {
      return json({ error: 'not implemented — later build step (design doc §10)' }, 501);
    }

    return json({ error: 'not found' }, 404);
  }
};
