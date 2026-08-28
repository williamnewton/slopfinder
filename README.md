# Slop Finder

**LLM Cliché Highlighter** — a Chrome extension that highlights the tells of
AI-generated prose ("delve", "not just X, but Y", "stands as a testament", …)
on any page you read, plus the static landing site that distributes it.

Ported from the `cliche-highlighter` prototype in `nextjs-prototypes` into a
standalone repo with its own build/test/deploy workstation. Detection
patterns adapted from [Simon Willison's llm-cliche-highlighter](https://github.com/simonw/tools/blob/main/llm-cliche-highlighter.html)
and Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).

## Layout

```
extension/   Manifest V3 Chrome extension — plain JS, no build step
  patterns.js    the detection engine (patterns are JSON-serializable data)
  content.js     scans pages, paints via the CSS Custom Highlight API
  background.js  seeds defaults, shows the per-tab count badge
  popup.*        settings panel: toggle, count, pattern JSON import/export
site/        static landing page (single self-contained index.html)
  downloads/     packaged zip lands here (gitignored; built artifact)
scripts/     the workstation (zero-dependency Node)
tests/       node:test suite for the pattern engine
dist/        versioned build artifacts (gitignored)
```

## Workstation

Requires Node ≥ 18. No npm dependencies.

| Command | What it does |
|---|---|
| `npm run check` | Validate manifest, referenced files, pattern spec, site ↔ extension consistency (pattern count, download link) |
| `npm test` | Run the engine test suite, including the "demo honesty" tests (every cliché the landing page animates must be caught by the shipped engine) |
| `npm run package` | Zip the extension → `dist/slopfinder-extension-v<version>.zip` + `site/downloads/slopfinder-extension.zip` |
| `npm run build` | check + test + package |
| `npm run serve` | Serve `site/` at http://localhost:4600 |
| `npm run bump -- patch\|minor\|major\|x.y.z` | Bump the version in `extension/manifest.json` + `package.json` |

## Develop

- **Extension**: load `extension/` unpacked at `chrome://extensions` (enable
  Developer mode → "Load unpacked"). Edits to the popup apply on reopen;
  edits to content/background scripts need the extension's reload button.
- **Site**: `npm run package && npm run serve`, then open
  http://localhost:4600.

## Release

1. `npm run bump -- minor` (or `patch` / `major`)
2. `npm run build` — must pass
3. Commit, then `git tag v<version> && git push --tags`

GitHub Actions then:

- **CI** (`ci.yml`) — `npm run build` on every push/PR, uploads the zip as an artifact.
- **Deploy site** (`deploy-pages.yml`) — publishes `site/` (with a fresh zip)
  to GitHub Pages on every push to `main`. One-time setup: repo Settings →
  Pages → Source: "GitHub Actions".
- **Release** (`release.yml`) — on a `v*` tag, verifies the tag matches the
  manifest version, builds, and attaches the zip to a GitHub Release.

### Chrome Web Store

Publishing to the Web Store is manual for now: upload
`dist/slopfinder-extension-v<version>.zip` at the
[developer dashboard](https://chrome.google.com/webstore/devconsole). The
extension requests only the `storage` permission and makes no network
requests, which keeps review simple — keep it that way.
