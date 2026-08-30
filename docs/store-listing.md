# Chrome Web Store listing — Slop Finder

Everything to paste into the developer console. Screenshots live in
`docs/store-assets/` (1280×800; the popup shot is 640×400, also accepted).

## Basics

- **Name**: Slop Finder
- **Category**: Tools
- **Language**: English
- **Summary** (from manifest, ≤132 chars): Highlights the tells of
  AI-generated prose on every page you read. Runs locally — no network
  requests, no data collected.

## Description

Slop Finder highlights the tells of AI-generated prose on every page you
read, and counts them on a toolbar badge.

WHAT IT CATCHES

38 patterns across three kinds of tells:

- Vocabulary: "delve", "tapestry", "pivotal", "seamless", "ever-evolving"
- Stock constructions: "not just X, but Y", "stands as a testament",
  "plays a crucial role", "no fluff, no filler, no jargon"
- Structural habits: stacked rhetorical questions, echoing sentence runs,
  three sentences opening on the same word

HOW IT WORKS

- Exact matches get solid highlighter yellow; the containing sentence gets
  a pale wash so you can read the hit in context
- The toolbar badge counts matches on the current tab
- Built on the CSS Custom Highlight API: the page's DOM is never modified,
  so nothing shifts, breaks, or interferes with selection and copying
- Re-scans as pages change, including busy feeds that render content late

YOUR RULES

The pattern set is plain JSON. Download the active set, edit it, upload it
back — validation runs before anything is stored, and one click restores
the defaults. Toggle the whole thing off from the popup at any time.

PRIVATE BY CONSTRUCTION

Everything runs locally in your browser. The only permission is "storage",
used for your own settings. No network requests, no analytics, no accounts,
no data collection of any kind.

Detection patterns adapted from Simon Willison's LLM cliché highlighter.
Open source: https://github.com/williamnewton/slopfinder

## Privacy tab

- **Single purpose**: Highlights AI-writing cliché phrases on web pages the
  user visits and shows a per-tab count.
- **Permission justification — storage**: Stores the user's on/off
  preference and optional custom pattern list locally. Nothing leaves the
  browser.
- **Host permission justification** (the console asks because the content
  script matches `http://*/*` and `https://*/*` — this is the product's
  single feature, not an extra grant): The extension's sole purpose is to
  automatically highlight AI-cliché phrases on pages as the user reads
  them, so its content script must run on all http/https pages. The script
  only reads page text locally and paints matches with the CSS Custom
  Highlight API. It never modifies page content, injects no remote code,
  makes no network requests, and collects or transmits no data.
- **Data usage disclosures**: collects no user data (check "no" on every
  category). No remote code.

## Submission notes

- Upload `dist/slopfinder-extension-v1.0.0.zip`
- Visibility: Public
- Before submitting, confirm upstream attribution terms for the pattern set
  (simonw/tools license) — credit is already given in the description,
  site, popup, and README.
