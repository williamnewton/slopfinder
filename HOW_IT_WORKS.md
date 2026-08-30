# How It Works

Slop Finder is two deliverables in one repo: a Manifest V3 Chrome extension
that highlights the tells of LLM-generated prose on any page, and the static
landing site that demos and distributes it. No AI is called anywhere — the
extension is pure pattern matching (regexes + heuristics) and makes zero
network requests.

## Architecture

```
Chrome extension (extension/, plain MV3 JS — no build step)
  content script (auto-runs on every http(s) page, top frame only)
    patterns.js + content.js ──▶ scan → CSS Custom Highlight API paint
         │                              │
         │ chrome.storage (pattern      │ {type:'count'} message
         │ JSON + enabled flag)         ▼
         │                        background.js → per-tab badge on the icon
         ▼
  settings popup (click the icon): toggle · count · JSON download/upload/reset

Landing site (site/index.html, one self-contained file)
  hero sweep → mock browser window demo → badge upticks → download CTA
```

## Content script behavior spec

The details below are the contract; anything off-spec is a bug.

### When it runs

- Injected on every `http(s)` page at `document_idle`, **top frame only**
  (`all_frames` unset) — content inside iframes is never scanned or counted.
- Never runs on `chrome://`, the Web Store, PDFs, or tabs opened before the
  extension was (re)loaded. The popup shows `–` there.
- **Re-scan triggers**: (1) any settings change, instantly, in every tab
  (`storage.onChanged`); (2) DOM mutations after 1.5s of quiet
  (`MutationObserver` debounce); (3) on pages that never go quiet —
  feed-style pages with live counters and virtualized scrolling — a max-wait
  timer guarantees a scan at least every 5s. Expect up to ~5s of lag between
  content appearing and highlights/badge updating.

### What gets scanned

- A TreeWalker over `document.body` text nodes, skipping
  script/style/noscript/template/textarea/iframe/svg/canvas parents.
  Consecutive text nodes are grouped by their nearest block ancestor and
  each block is matched as one string — so a sentence split across inline
  spans matches, but a sentence split across two blocks does not.
- Segments under 8 characters are skipped.
- **Visibility is not checked.** Hidden DOM text (collapsed "see more"
  content, closed menus, off-screen but still-mounted posts) is scanned, so
  the count can exceed the highlights visible on screen.
- Virtualized feeds remove far-off-screen content from the DOM, so the
  count is a live "what's in the DOM now" number that fluctuates as you
  scroll — not a cumulative tally.

### Matching & painting

- Every enabled pattern runs per block; overlapping matches collapse
  (earliest start wins, longer match breaks ties), so nested phrases never
  double-count. The surviving exact-match count is the number on the badge
  and in the popup.
- Two paint layers via the **CSS Custom Highlight API** (Chrome 105+):
  solid yellow (`#fcd34d`) on the exact match, pale cream on the whole
  containing sentence (regions merge when they overlap).
- Zero DOM mutation — the only insertion is one `<style>` tag for the
  `::highlight` rules. No layout shift, page scripts/selection/copy are
  unaffected, and clearing (toggle off) is instant. This is also why the
  MutationObserver never re-triggers on our own work.

### Counting & badge

- Each scan repaints from scratch and reports its total to the background
  worker, which sets the **per-tab** badge: empty at 0, `999+` cap, yellow
  with dark ink. The popup asks the active tab for its latest results on
  open — popup and badge always reflect the last completed scan.

## Pattern engine (`patterns.js`)

Detection logic adapted from Simon Willison's `llm-cliche-highlighter.html`.
**Patterns are data, not code**: the default set (38 entries) is a
JSON-serializable spec — regexes stored as `pattern` + `flags` strings, plus
typed heuristic finders:

| Type | Detects |
|---|---|
| `regex` | Stock phrases ("delve", "stands as a testament", "not just X, but Y", …) |
| `chain` | "HEAD X, HEAD Y" lists ("No fluff, no filler, no jargon") |
| `echo` | Consecutive sentences built on the same repeated skeleton |
| `questions` | Stacked rhetorical questions |
| `anaphora` | 3+ consecutive sentences opening on the same word |

`compilePatterns(spec)` builds runnable finders; `validatePatterns(spec)`
gate-checks imports (array shape, unique ids, known types, regexes compile,
`g` flag required). This spec is exactly what the popup exports/imports and
what lives in `chrome.storage.local`. Some heuristics are deliberately
aggressive — e.g. `stranded-auxiliary` flags short clauses landing on a bare
auxiliary ("In one sense, it is.") — trim the JSON if a pattern is too noisy
for your reading.

## Popup (`popup.html` / `popup.js`)

A rounded panel (inner container — the popup window itself can't be
transparent): title, this-page count (labeled "on this page"), on/off
toggle (storage-backed,
applied live by every tab), an expandable **Patterns** row (`<details>`)
that lists the active pattern names as a scrollable bullet list with
descriptions on hover, and — under a dotted divider — pattern management:
Download JSON (exports the active spec), Upload JSON (parse →
`validatePatterns` → store; errors shown inline, invalid sets never
stored), Reset to defaults.

## Background worker (`background.js`)

Seeds defaults into storage on install (only missing keys — updates preserve
user settings), sets badge colors once, and mirrors `{type:'count'}`
messages onto the sender tab's badge.

## Landing site (`site/index.html`)

Self-contained static page, no framework. Hero headline sweeps its mark
first; a mock browser window (traffic lights, address pill, extension icon
with badge) then replays the sweep over a fake AI launch post, one cliché
per 620ms stagger, with the badge upticking in step — hero and demo are
sequenced so only one thing animates at a time. Light/dark via CSS tokens +
a pre-paint localStorage check; `prefers-reduced-motion` renders the final
state statically. The Download CTA serves the zip that `npm run package`
drops into `site/downloads/`.

## Error handling

- **Content script**: no-ops without `CSS.highlights` or `document.body`; a
  broken stored pattern set falls back to compiled defaults; `sendMessage`
  failures (extension reloaded) are swallowed.
- **Popup**: JSON parse and validation errors are shown inline and never
  stored; count shows `–` on pages without a content script.
- **Site**: demo timers are cleaned up per loop; storage access is
  try/caught (theme falls back to dark).
