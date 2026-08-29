# CLAUDE.md

Slop Finder = the **LLM Cliché Highlighter** Chrome extension (`extension/`)
plus its static landing site (`site/index.html`), with a zero-dependency Node
workstation (`scripts/`, `tests/`). Ported from the `cliche-highlighter`
prototype in the `nextjs-prototypes` repo; that prototype and this repo are
now independent — changes here do not sync back.

## Rules

1. **Run `npm run build` (check + test + package) before committing.** It is
   the whole CI gate.
2. **The version lives in `extension/manifest.json`** and must match
   `package.json`. Change it only via `npm run bump -- <patch|minor|major>`.
   Release = tag `v<version>` (the release workflow fails on mismatch).
3. **No npm dependencies, no build step.** The extension is plain MV3 JS
   loaded directly by Chrome; the site is one self-contained `index.html`.
   Keep it that way — don't introduce bundlers, frameworks, or packages
   without an explicit request.
4. **The privacy promise is load-bearing**: `storage` is the only permission,
   there are no host permissions, and nothing makes network requests. The
   landing page and Web Store listing say so. `npm run check` enforces it.
5. **Site and extension must not drift.** Every cliché the demo animates
   must be caught by the shipped engine under the pattern name in the mark's
   `title` (`tests/patterns.test.mjs` "demo honesty" tests — update them
   when editing the demo copy in `site/index.html`).
6. **`patterns.js` patterns are data, not code**: JSON-serializable specs
   (regex source + flags strings; typed heuristic entries). The popup
   exports/imports exactly this spec and `validatePatterns` gate-checks it.
   New patterns need a spec entry + a test.
7. **`site/downloads/` and `dist/` are build outputs** (gitignored). CI
   rebuilds them; never commit zips.

## Gotchas

- `node --test tests/` (bare directory) fails on some Node versions — the
  test script globs `tests/*.test.mjs` instead.
- `patterns.js` attaches to `self`; in Node, set
  `globalThis.self = globalThis` before importing (see `scripts/lib.mjs`
  `loadEngine()`).
- `collectMatches` drops overlapping matches (earliest start wins), so a
  passage can animate more highlights on the landing page than the engine
  counts on the real text — demo tests run patterns against isolated
  snippets for this reason.
- The highlighter-yellow (`#fcd34d`) / dark-ink (`#1d1b17`) pair is the
  brand and is intentionally identical in light and dark themes — don't
  theme-tokenize it. It appears in `site/index.html`, `content.js`,
  `background.js` (badge), and `popup.html`.
