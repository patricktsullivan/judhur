# Fonts

Self-hosted webfonts. The app used to load these from Google Fonts, which meant
Arabic rendered in a fallback face on a cold offline start or from `file://` —
a broken study loop under `[R-11]`, not a cosmetic downgrade — and put a
third-party request on every install, which the Settings copy otherwise promised
the app didn't make.

| File | Family | Subset | Used for |
|---|---|---|---|
| `inter-latin.woff2` | Inter | latin | body text |
| `fraunces-latin.woff2` | Fraunces | latin | display headings |
| `noto-naskh-arabic.woff2` | Noto Naskh Arabic | arabic | all Arabic script |
| `noto-naskh-latin.woff2` | Noto Naskh Arabic | latin | stray latin inside Arabic runs |

Only the latin and arabic subsets are kept — the cyrillic, greek, vietnamese,
math and symbol subsets Google also serves are dead weight here. Total ~225 KB,
precached by the service worker so the study loop works offline from first
install.

**Licensing.** All three families are under the SIL Open Font License 1.1
(`OFL.txt`), which permits redistribution. They are not covered by the
repository's AGPL-3.0 licence and keep their own terms; the OFL is compatible with
shipping them alongside AGPL software.

**Updating.** `node tools/sync-fonts.mjs` refetches from Google Fonts and
rewrites the `@font-face` block in `index.html`. It is the only tool in this
repo that needs network access. Bump `VERSION` in `sw.js` afterwards, since the
fonts are precached.
