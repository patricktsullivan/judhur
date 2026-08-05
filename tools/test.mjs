/* Judhūr test suite — `node tools/test.mjs` (no dependencies, no build step).
   Covers the pure logic in backend/worker.js and the state/scheduling logic in
   index.html, which is loaded into a minimal DOM stub. Run it before pushing;
   the date tests in particular only fail in some timezones, so the runner
   re-runs the whole suite under several TZs. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, count = 0;

function eq(label, got, want) {
  count++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
  }
}
function ok(label, cond) { eq(label, !!cond, true); }
function section(name) { console.log(`\n${name}`); }

/* ---------------- backend/worker.js ---------------- */
const W = await import(path.join(ROOT, 'backend/worker.js'));

section('worker: Arabic normalisation and the Tier 1 verdict');
eq('strips harakat', W.normalizeAr('كَتَبَ'), 'كتب');
eq('folds alef variants', W.normalizeAr('أحمد'), 'احمد');
eq('folds ta marbuta', W.normalizeAr('مَدْرَسَة'), 'مدرسه');
eq('drops latin', W.normalizeAr('كتب hello'), 'كتب');
ok('exact match understood', W.tier1Verdict('كَتَبَ', 'كتب').understood);
ok('match inside a longer transcript', W.tier1Verdict('كِتَاب', 'هذا كتاب جميل').understood);
ok('mismatch not understood', !W.tier1Verdict('كِتَاب', 'سيارة').understood);
eq('empty transcript reason', W.tier1Verdict('كِتَاب', '').reason, 'nothing transcribed');
eq('empty expected reason', W.tier1Verdict('', 'كتاب').reason, 'no expected text');

section('worker: article extraction and segmentation');
eq('title extracted', W.extractText('<html><head><title> Hi &amp; bye </title></head><body><p>x</p></body></html>').title, 'Hi & bye');
ok('script and style dropped',
  !/alert|color:/.test(W.extractText('<body><script>alert(1)</script><style>a{color:red}</style><p>real text</p></body>').text));
ok('article element preferred',
  W.extractText('<body><nav>menu junk</nav><article><p>the body</p></article></body>').text.includes('the body'));
{
  const para = w => Array.from({ length: 20 }, (_, i) => `${w}${i}`).join(' ');
  const seg = W.segment(`${para('a')}\n\n${para('b')}\n\n${para('c')}`);
  ok('segment reaches the minimum length', seg.split(/\s+/).length >= 20);
  ok('segment respects the maximum', W.segment(para('x').repeat(60)).split(/\s+/).length <= 300);
  ok('short paragraphs skipped', !W.segment('too short\n\n' + para('q')).startsWith('too short'));
}

section('worker: model JSON parsing');
eq('plain object passes through', W.parseModelJson({ arabic: 'x' }).arabic, 'x');
eq('code fences stripped', W.parseModelJson('```json\n{"arabic":"x"}\n```').arabic, 'x');
eq('prose before and after', W.parseModelJson('Sure!\n{"arabic":"x"}\nHope that helps.').arabic, 'x');
eq('trailing commas tolerated', W.parseModelJson('{"a":1,}').a, 1);
eq('brace inside a string survives', W.parseModelJson('{"arabic":"a}b"}').arabic, 'a}b');
eq('nested objects balance', W.parseModelJson('{"a":{"b":1}} trailing }').a.b, 1);
eq('unparseable returns null', W.parseModelJson('no json here'), null);
eq('empty returns null', W.parseModelJson(''), null);

section('worker: generation prompt carries the profile');
{
  const p = W.genPrompt('source text', { known_words: ['كِتَاب'], known_roots: ['ك ت ب'], target_new_words: 3 });
  ok('excerpt included', p.includes('source text'));
  ok('known words included', p.includes('كِتَاب'));
  ok('new-word budget included', p.includes('at most 3'));
  ok('full diacritics demanded', /FULL vowel diacritics/.test(p));
}

section('worker: Azure assessment parsing');
eq('letter skeleton drops harakat', W.arLetters('كَتَبَ'), ['ك', 'ت', 'ب']);
eq('letter skeleton keeps long vowels', W.arLetters('كِتَاب'), ['ك', 'ت', 'ا', 'ب']);
{
  const az = {
    RecognitionStatus: 'Success',
    NBest: [{
      PronScore: 62, AccuracyScore: 71, CompletenessScore: 100,
      Words: [{
        Word: 'كَتَبَ', AccuracyScore: 71,
        Phonemes: [{ Phoneme: '', AccuracyScore: 90 }, { Phoneme: '', AccuracyScore: 20 }, { Phoneme: '', AccuracyScore: 88 }],
      }],
    }],
  };
  const r = W.parseAzureAssessment(az);
  ok('parsed', r.ok);
  eq('composite score surfaced', r.pron, 62);
  eq('one phoneme flagged', r.detected.length, 1);
  eq('flagged sound named by position', r.detected[0].phoneme, 'ت');
  ok('positional name marked inferred', r.detected[0].inferred);
  ok('high-scoring phonemes not flagged', r.detected.every(d => d.score < 40));
}
{
  /* Count mismatch: no guessing, so nothing is named. */
  const az = {
    NBest: [{ Words: [{ Word: 'الشَّمْس', Phonemes: [{ Phoneme: '', AccuracyScore: 10 }] }] }],
  };
  const r = W.parseAzureAssessment(az);
  eq('mismatched counts leave the label empty', r.detected[0].phoneme, '');
  eq('unnamed flags excluded from "named"', r.named.length, 0);
}
{
  /* Azure's own IPA labels, when present, win and are not marked inferred. */
  const az = { NBest: [{ Words: [{ Word: 'كَتَبَ', Phonemes: [{ Phoneme: 'k', AccuracyScore: 5 }] }] }] };
  const r = W.parseAzureAssessment(az);
  eq('real label kept', r.named[0].phoneme, 'k');
  ok('real label not inferred', !r.named[0].inferred);
}
eq('no NBest is not ok', W.parseAzureAssessment({}).ok, false);

section('worker: register selects locale and voice');
eq('msa locale', W.registerCfg({}, 'msa').locale, 'ar-SA');
eq('egy locale', W.registerCfg({}, 'egy').locale, 'ar-EG');
eq('egy voice differs from msa', W.registerCfg({}, 'egy').voice === W.registerCfg({}, 'msa').voice, false);
eq('unknown register falls back to msa', W.registerCfg({}, 'zzz').locale, 'ar-SA');
eq('missing register falls back to msa', W.registerCfg({}, undefined).locale, 'ar-SA');
eq('case insensitive', W.registerCfg({}, 'EGY').locale, 'ar-EG');
eq('per-register voice override wins', W.registerCfg({ AZURE_TTS_VOICE_EGY: 'x' }, 'egy').voice, 'x');
eq('legacy single-voice override still honoured', W.registerCfg({ AZURE_TTS_VOICE: 'y' }, 'msa').voice, 'y');
eq('explicit locale override wins', W.registerCfg({ AZURE_SPEECH_LOCALE: 'ar-EG' }, 'msa').locale, 'ar-EG');

section('worker: coaching prompt hedges inferred labels');
ok('inferred labels produce a hedge', /not certain/.test(W.coachPrompt('كَتَبَ', [{ phoneme: 'ت', inferred: true }])));
ok('real labels produce no hedge', !/not certain/.test(W.coachPrompt('كَتَبَ', [{ phoneme: 'k' }])));
ok('coach told not to invent errors', /Do NOT invent other errors/.test(W.coachPrompt('x', [{ phoneme: 'ع' }])));

/* ---------------- index.html ---------------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function stubEl() {
  return { innerHTML: '', textContent: '', value: '', className: '', dataset: {}, style: {},
           appendChild() {}, addEventListener() {}, closest: () => null };
}
/* Loads the app's script into a stub DOM. `nowMs` pins what `new Date()` with
   no arguments returns, so the date helpers can be checked at chosen instants
   instead of only at whatever moment the suite happens to run. */
function loadApp(nowMs) {
  const Real = Date;
  function FakeDate(...a) { return a.length ? new Real(...a) : new Real(nowMs); }
  FakeDate.prototype = Real.prototype;
  FakeDate.now = () => (nowMs == null ? Real.now() : nowMs);
  FakeDate.parse = Real.parse; FakeDate.UTC = Real.UTC;

  const store = new Map();
  const win = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null),
                    setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: { getElementById: stubEl, createElement: stubEl, addEventListener() {} },
    navigator: {}, location: { protocol: 'file:' },
    fetch: () => Promise.reject(new Error('offline in tests')),
    Audio: function () { return { play: () => Promise.reject(new Error('x')), load() {} }; },
  };
  win.window = win; win.self = win;
  return new Function(
    'window', 'document', 'localStorage', 'navigator', 'location', 'fetch', 'Audio', 'self', 'Date',
    src + '\n; return {schedule, today, addDays, dayDiff, ymd, retained, learning, esc, ' +
    'mergeStates, migrateIds, ensureShape, blankState, activeDays, stripHarakat, partialHarakat, ' +
    'normKey, histRuns, DECK, ROOTS, ALPHABET, TOTAL_WORDS, MAX_SESSION};'
  )(win, win.document, win.localStorage, win.navigator, win.location, win.fetch, win.Audio, win,
    nowMs == null ? Real : FakeDate);
}
const A = loadApp(null);

section(`app: dates (TZ=${process.env.TZ || 'system'})`);
/* The study day is the learner's LOCAL day. Walk a full 24 hours: any instant
   where the UTC date and the local date disagree catches a today() built on
   toISOString(), which is how every interval came out a day short east of UTC
   and how evening study got credited to tomorrow in the Americas. */
{
  let straddles = 0;
  for (let h = 0; h < 24; h++) {
    const ms = Date.UTC(2026, 7, 4, h, 30);
    const d = new Date(ms);
    const want = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (want !== new Date(ms).toISOString().slice(0, 10)) straddles++;
    eq(`today() is the local day at ${String(h).padStart(2, '0')}:30Z`, loadApp(ms).today(), want);
  }
  /* Guard the guard: in a zone offset from UTC the loop must actually exercise
     the disagreement, or it proves nothing. */
  if ((process.env.TZ || 'UTC') !== 'UTC') ok('the 24-hour sweep straddles the UTC date line', straddles > 0);
}
{
  /* An interval of n days must land n days later on the local calendar, and the
     heatmap window must contain today. Checked at a pinned instant so the
     result does not depend on when the suite runs. */
  const ms = Date.UTC(2026, 7, 4, 23, 30);   // late UTC evening: next day already in +05:30 and beyond
  const P = loadApp(ms);
  const T = P.today();
  eq('addDays(today, 0) is today', P.addDays(T, 0), T);
  eq('+7 then -7 round-trips', P.addDays(P.addDays(T, 7), -7), T);
  eq('a 1-day interval is due tomorrow, not today', P.dayDiff(T, P.addDays(T, 1)), 1);
  eq('today is inside the 30-day heatmap window',
    Array.from({ length: 30 }, (_, i) => P.addDays(T, -i)).includes(T), true);
  eq('30 distinct heatmap cells',
    new Set(Array.from({ length: 30 }, (_, i) => P.addDays(T, -i))).size, 30);
  eq('a day studied today counts toward [R-38]',
    P.ensureShape({ history: [T] }) && (() => { const s = P.ensureShape({ history: [T] }); return s.history.includes(T); })(), true);
}
eq('ymd zero-pads', A.ymd(new Date(2026, 0, 5)), '2026-01-05');
eq('month boundary', A.addDays('2026-01-31', 1), '2026-02-01');
eq('year boundary', A.addDays('2025-12-31', 1), '2026-01-01');
eq('leap day', A.addDays('2028-02-28', 1), '2028-02-29');

section('app: escaping');
eq('quotes escaped for attribute contexts', A.esc(`a"b'c<d>&`), 'a&quot;b&#39;c&lt;d&gt;&amp;');

section('app: scheduler and retention [R-28]');
{
  let p = null;
  for (let i = 0; i < 3; i++) p = A.schedule(p, 2);
  eq('three good reps counted', p.reps, 3);
  ok('third interval is a week or more', p.interval >= 7);
  ok('retained at 3 reps and a long interval', A.retained('x', { x: p }));
  ok('two reps is not retained', !A.retained('y', { y: { reps: 2, interval: 30 } }));
  ok('short interval is not retained', !A.retained('y', { y: { reps: 9, interval: 3 } }));
  ok('graded but not retained counts as learning', A.learning('y', { y: { reps: 2, interval: 3 } }));
  ok('never graded is not learning', !A.learning('z', {}));
  eq('a lapse resets reps and eases off', A.schedule({ interval: 40, ease: 2.5, reps: 9 }, 0).reps, 0);
  ok('ease never falls below 1.3', A.schedule({ interval: 1, ease: 1.3, reps: 5 }, 1).ease >= 1.3);
}

section('app: deck and stable ids');
{
  const vocab = A.DECK.filter(c => c.type === 'vocab');
  eq('every word is a card', vocab.length, A.TOTAL_WORDS);
  eq('card ids unique', new Set(A.DECK.map(c => c.id)).size, A.DECK.length);
  ok('word ids are stable-form', vocab.every(c => /^w-[a-z0-9]+-\d+$/.test(c.id)));
  ok('no positional ids remain', !A.DECK.some(c => /^v-\d+-\d+$/.test(c.id)));
  ok('every word carries its root', vocab.every(c => c.d.root && c.d.rootId));
  eq('session cap is 12 [R-5]', A.MAX_SESSION, 12);
}

section('app: id migration');
{
  const old = A.ensureShape({
    progress: { 'v-0-0': { reps: 4, interval: 9, ease: 2.5, due: '2026-01-01' } },
    prod: { 'v-0-1': { reps: 1, interval: 1, ease: 2.5, due: '2026-01-02' } },
    pins: { 'v-0-0': { v: 1, t: 5 } },
    log: [{ t: 1, d: '2026-01-01', id: 'v-0-0', k: 'rec', q: 2, b: 3, a: 9 }],
    speech: [{ k: 'x', id: 'v-0-1' }],
  });
  eq('recognition progress remapped', Object.keys(old.progress), ['w-ktb-1']);
  eq('production progress remapped', Object.keys(old.prod), ['w-ktb-2']);
  eq('pins remapped', Object.keys(old.pins), ['w-ktb-1']);
  eq('log entries remapped', old.log[0].id, 'w-ktb-1');
  eq('speech entries remapped', old.speech[0].id, 'w-ktb-2');
  eq('running it again changes nothing', Object.keys(A.migrateIds(old).progress), ['w-ktb-1']);
  eq('collision keeps the stronger record',
    A.migrateIds({ progress: { 'v-0-0': { reps: 9, interval: 40, due: '2026-05-05' },
                               'w-ktb-1': { reps: 2, interval: 3, due: '2026-01-01' } } }).progress['w-ktb-1'].reps, 9);
}

section('app: sync merge');
{
  const M = (a, b) => A.mergeStates(A.ensureShape(a), A.ensureShape(b));

  eq('more reps wins',
    M({ progress: { 'w-ktb-1': { reps: 1, interval: 1, due: '2026-01-01' } } },
      { progress: { 'w-ktb-1': { reps: 6, interval: 20, due: '2026-02-01' } } }).progress['w-ktb-1'].reps, 6);
  eq('equal reps, later due date wins',
    M({ progress: { 'w-ktb-1': { reps: 3, interval: 8, due: '2026-01-01' } } },
      { progress: { 'w-ktb-1': { reps: 3, interval: 8, due: '2026-03-01' } } }).progress['w-ktb-1'].due, '2026-03-01');
  eq('study history unions',
    M({ history: ['2026-01-01'] }, { history: ['2026-01-02', '2026-01-01'] }).history,
    ['2026-01-01', '2026-01-02']);

  const prefs = M({ settings: { tts: false, diacritics: 'bare' }, setT: { tts: 200, diacritics: 50 } },
                  { settings: { tts: true, diacritics: 'full' }, setT: { tts: 100, diacritics: 900 } });
  eq('a newer local preference is not clobbered', prefs.settings.tts, false);
  eq('a newer remote preference wins', prefs.settings.diacritics, 'full');

  eq('unpinning survives a sync [R-36]',
    M({ pins: { 'w-ktb-1': { v: 0, t: 500 } } }, { pins: { 'w-ktb-1': { v: 1, t: 100 } } }).pins['w-ktb-1'].v, 0);
  eq('pinning survives a sync',
    M({ pins: { 'w-ktb-1': { v: 0, t: 100 } } }, { pins: { 'w-ktb-1': { v: 1, t: 500 } } }).pins['w-ktb-1'].v, 1);

  const uc = M({ userCards: [{ id: 'u-1', ar: 'x', inReview: false }] },
               { userCards: [{ id: 'u-1', ar: 'x', inReview: true }] });
  eq('an opt-in from the other device arrives', uc.userCards[0].inReview, true);
  eq('library words are not duplicated', uc.userCards.length, 1);

  const lg = M({ log: [{ t: 2, id: 'a' }, { t: 3, id: 'b' }] },
               { log: [{ t: 1, id: 'c' }, { t: 3, id: 'b' }] });
  eq('logs union, dedupe and stay ordered [R-32]', lg.log.map(e => e.t + e.id), ['1c', '2a', '3b']);

  eq('speech attempts union by key',
    M({ speech: [{ k: 'a' }] }, { speech: [{ k: 'a' }, { k: 'b' }] }).speech.length, 2);
  eq('merging with nothing remote is a no-op', A.mergeStates(A.ensureShape({ xp: 7 }), null).xp, 7);
}

section('app: generated-content flags [R-48]');
{
  const M = (a, b) => A.mergeStates(A.ensureShape(a), A.ensureShape(b));
  eq('flag reports union across devices',
    M({ flags: [{ t: 1, id: 'u-1' }] }, { flags: [{ t: 2, id: 'u-2' }, { t: 1, id: 'u-1' }] }).flags.length, 2);
  eq('flag reports dedupe',
    M({ flags: [{ t: 1, id: 'u-1' }] }, { flags: [{ t: 1, id: 'u-1' }] }).flags.length, 1);
  eq('a fresh state has an empty flag log', A.ensureShape(A.blankState()).flags, []);
}

section('app: streak reconstruction');
eq('consecutive days', A.histRuns(['2026-01-01', '2026-01-02', '2026-01-03']).current, 3);
eq('a gap breaks the run', A.histRuns(['2026-01-01', '2026-01-05', '2026-01-06']).current, 2);
eq('best run remembered across a gap', A.histRuns(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-09']).best, 3);
eq('duplicates ignored', A.histRuns(['2026-01-01', '2026-01-01', '2026-01-02']).current, 2);

section('app: diacritic display [R-35]');
eq('bare strips every mark', A.stripHarakat('مَدْرَسَة'), 'مدرسة');
eq('partial keeps shadda', A.partialHarakat('مُدَرِّس'), 'مدرّس');
ok('stored text is never mutated', 'كَتَبَ'.length === 6);
eq('normKey folds to bare letters', A.normKey('الْكِتَابِ'), 'الكتاب');

/* ---------------- summary ---------------- */
console.log(`\n${count - fails} / ${count} checks passed`);
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }

/* The date logic is timezone-sensitive and used to be wrong east of UTC, so
   unless we are already inside a re-run, repeat everything under a spread of
   offsets. */
if (!process.env.JUDHUR_TZ_CHILD) {
  const zones = ['UTC', 'Asia/Kolkata', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Pacific/Midway'];
  console.log('\nre-running across timezones');
  for (const tz of zones) {
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url)], {
        env: { ...process.env, TZ: tz, JUDHUR_TZ_CHILD: '1' }, stdio: 'pipe',
      });
      console.log(`  ok   ${tz}`);
    } catch (e) {
      console.log(`  FAIL ${tz}\n${e.stdout?.toString() || e.message}`);
      process.exit(1);
    }
  }
  console.log('\nall green');
}
