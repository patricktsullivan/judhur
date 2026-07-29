/* Judhūr backend — Cloudflare Worker.
   Step 4 scope: /state (GET/PUT learner profile). Future §4 endpoints are
   501 stubs so the surface is visible but honest.
   Auth: Authorization: Bearer <SYNC_TOKEN>, set as a Worker secret [R-41].
   All configuration is env vars/secrets + wrangler.toml [R-42].
   Storage: Workers KV, single key — single learner by design (§1.1). */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Max-Age': '86400'
};
const MAX_STATE_BYTES = 512 * 1024;

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

    // §4 endpoints arriving in later build steps
    if (['/ingest', '/generate', '/verify', '/speak', '/assess'].includes(url.pathname)) {
      return json({ error: 'not implemented — later build step (design doc §10)' }, 501);
    }

    return json({ error: 'not found' }, 404);
  }
};
