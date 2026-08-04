/* Refetches the self-hosted webfonts and rewrites the @font-face block in
 * index.html.  `node tools/sync-fonts.mjs`
 *
 * The app used to <link> Google Fonts, which meant Arabic rendered in a
 * fallback face on a cold offline start or from file:// — a broken study loop
 * under [R-11], not a cosmetic downgrade — and put one third-party request on
 * every install. Fonts now ship with the repo.
 *
 * Only the latin and arabic subsets are kept; the rest of what Google serves
 * (cyrillic, greek, vietnamese, math, symbols) is dead weight here. All three
 * families are SIL OFL 1.1 — fonts/OFL.txt.
 *
 * Run this to pick up upstream font updates. Needs network; nothing else does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS_URL = 'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:opsz,wght@9..144,500;9..144,600' +
  '&family=Inter:wght@400;500;600;700' +
  '&family=Noto+Naskh+Arabic:wght@400;700&display=swap';
/* A modern desktop UA, so Google serves woff2 rather than an older format. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const KEEP = new Set(['latin', 'arabic']);
/* family|subset -> local filename, and the weight range the single variable
   file covers (Google returns one URL per family+subset for these). */
const FILES = {
  'Fraunces|latin':          ['fraunces-latin.woff2',     '500 600'],
  'Inter|latin':             ['inter-latin.woff2',        '400 700'],
  'Noto Naskh Arabic|arabic':['noto-naskh-arabic.woff2',  '400 700'],
  'Noto Naskh Arabic|latin': ['noto-naskh-latin.woff2',   '400 700'],
};

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();
const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
if (!blocks.length) throw new Error('no @font-face blocks in the Google Fonts response');

const faces = [];
const seen = new Set();
for (const [, subset, block] of blocks) {
  if (!KEEP.has(subset)) continue;
  const family = (block.match(/font-family: '([^']+)'/) || [])[1];
  const key = `${family}|${subset}`;
  if (!FILES[key] || seen.has(key)) continue;
  seen.add(key);
  const [file, weights] = FILES[key];
  const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];

  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (bytes.length < 2000) throw new Error(`suspiciously small download for ${file}`);
  fs.writeFileSync(path.join(ROOT, 'fonts', file), bytes);
  console.log(`  ${file.padEnd(26)} ${(bytes.length / 1024).toFixed(0)} KB`);

  faces.push('  /* ' + family + ' — ' + subset + ' */\n  ' +
    block.replace(/url\(https:[^)]+\)/, `url('fonts/${file}')`)
         .replace(/font-weight: [^;]+;/, `font-weight: ${weights};`)
         .replace(/\n/g, '\n  '));
}

const missing = Object.keys(FILES).filter(k => !seen.has(k));
if (missing.length) throw new Error('subsets not returned by Google: ' + missing.join(', '));

const htmlPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('  /* Fraunces — latin */');
const end = html.indexOf('  :root{');
if (start < 0 || end < 0 || end < start) throw new Error('could not locate the @font-face block in index.html');
html = html.slice(0, start) + faces.join('\n') + '\n\n' + html.slice(end);
fs.writeFileSync(htmlPath, html);

console.log(`\nwrote ${faces.length} @font-face rules into index.html`);
console.log('remember to bump VERSION in sw.js — the fonts are precached');
