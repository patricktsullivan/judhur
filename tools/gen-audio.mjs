/* Generates the app's audio clips with Azure Neural TTS and writes them into audio/.
 *
 *   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=eastus node tools/gen-audio.mjs
 *
 * Flags:
 *   --force     re-generate clips that already exist (default: skip them)
 *   --voice X   override the voice (default per register, see REGISTER_VOICE)
 *   --limit N   stop after N clips — useful for a cheap first look
 *   --dry-run   list what would be generated, call nothing
 *
 * Why this exists: [R-12] says core audio must be pre-generated and on-device,
 * because hearing a word is part of the study loop rather than an enhancement.
 * Until v0.14 that requirement was parked behind finding a native speaker, so it
 * went unmet indefinitely and offline learners with no Arabic system voice got no
 * audio at all. [R-24] now makes synthetic clips the shipped path.
 *
 * These are NOT human recordings and must not be passed off as such. Every file
 * generated here is listed in audio/synthetic.json, which the app reads to label
 * them synthetic in the UI ([R-24a]). Drop a human recording at the same path and
 * it wins automatically; remove its entry from the manifest so the label goes away
 * ([R-24b]).
 *
 * Cost: Azure's free F0 tier covers this comfortably — the whole run is a few
 * hundred short requests, well inside the monthly allowance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
const DRY = flag('dry-run');
if (!DRY && !(KEY && REGION)) {
  console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (the same values your Worker uses).\n' +
                'Use --dry-run to see what would be generated without them.');
  process.exit(1);
}

/* Keep in step with backend/worker.js REGISTERS. */
const REGISTER_VOICE = { msa: 'ar-SA-HamedNeural', egy: 'ar-EG-ShakirNeural' };
const REGISTER_LOCALE = { msa: 'ar-SA', egy: 'ar-EG' };
const VOICE_OVERRIDE = opt('voice', null);

/* ---------- what to generate, read from the app itself ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const grab = (name, o, c) => {
  const m = html.match(new RegExp(`var ${name} = (\\${o}[\\s\\S]*?\\n\\${c});`));
  if (!m) throw new Error('could not find ' + name + ' in index.html');
  return eval(`(${m[1]})`);
};
const ALPHABET = grab('ALPHABET', '[', ']');
const LETTER_META = grab('LETTER_META', '{', '}');
const ROOTS = grab('ROOTS', '[', ']');

const jobs = [];
/* A letter card teaches the letter's NAME and then its bare sound; the name is
   what a speaker says, and it is what the app's own recording list asks for. */
for (const a of ALPHABET) {
  jobs.push({ rel: `audio/letters/${LETTER_META[a.id].key}.mp3`, text: LETTER_META[a.id].an, register: 'msa', label: a.letter });
}
for (const r of ROOTS) {
  for (const w of r.words) {
    jobs.push({ rel: `audio/words/${w.a}.mp3`, text: w.ar, register: w.reg || 'msa', label: w.ar });
    if (w.f) jobs.push({ rel: `audio/words/${w.f.a}.mp3`, text: w.f.ar, register: w.reg || 'msa', label: w.f.ar });
  }
}

const limit = parseInt(opt('limit', '0'), 10) || 0;
const force = flag('force');
const todo = jobs.filter(j => force || !fs.existsSync(path.join(ROOT, j.rel)));
const run = limit ? todo.slice(0, limit) : todo;

console.log(`${jobs.length} clips total · ${jobs.length - todo.length} already present · ${run.length} to generate`);
if (DRY) {
  run.slice(0, 20).forEach(j => console.log(`  ${j.rel.padEnd(34)} ${j.text}`));
  if (run.length > 20) console.log(`  … and ${run.length - 20} more`);
  process.exit(0);
}
if (!run.length) { console.log('nothing to do'); process.exit(0); }

fs.mkdirSync(path.join(ROOT, 'audio/letters'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'audio/words'), { recursive: true });

const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function synth(job) {
  const voice = VOICE_OVERRIDE || REGISTER_VOICE[job.register] || REGISTER_VOICE.msa;
  const locale = REGISTER_LOCALE[job.register] || 'ar-SA';
  const ssml = `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'>${xmlEscape(job.text)}</voice></speak>`;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'judhur-gen-audio',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  /* A "successful" empty body means the voice name was wrong or the text was
     rejected. Writing it would leave a silent file that looks like a real clip. */
  if (buf.length < 1000) throw new Error(`suspiciously small response (${buf.length} bytes) — check the voice name`);
  return { buf, voice };
}

const manifestPath = path.join(ROOT, 'audio/synthetic.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { note: 'Files listed here are synthetic, not human recordings. The app labels them as such [R-24a]. Replace a file with a human recording and delete its line here.', voice: {}, files: [] };
const files = new Set(manifest.files || []);

let done = 0, failed = 0;
for (const job of run) {
  try {
    const { buf, voice } = await synth(job);
    fs.writeFileSync(path.join(ROOT, job.rel), buf);
    files.add(job.rel);
    manifest.voice[job.register] = voice;
    done++;
    process.stdout.write(`\r  ${done}/${run.length}  ${job.rel.padEnd(34)}`);
  } catch (e) {
    failed++;
    console.error(`\n  FAILED ${job.rel} (${job.label}): ${e.message}`);
    /* One bad voice name fails every clip — stop rather than burn the quota. */
    if (failed >= 3 && done === 0) { console.error('\nGiving up after 3 consecutive failures with nothing succeeding.'); break; }
  }
  await new Promise(r => setTimeout(r, 60));   // stay well under the F0 rate limit
}

manifest.generated = new Date().toISOString().slice(0, 10);
manifest.files = [...files].sort();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n\n${done} written, ${failed} failed · manifest: audio/synthetic.json (${manifest.files.length} synthetic clips)`);
if (done) console.log('These are synthetic and labelled as such in the app. Commit them so they follow the repo.');
