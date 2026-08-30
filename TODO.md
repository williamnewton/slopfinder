# Ship checklist — Chrome Web Store + light marketing

Target: submit to the Web Store and post publicly this afternoon. Review
usually takes 1–3 days, so today's marketing links to the landing page and
zip; swap CTAs to the store listing once approved.

## 0. Decide once (blocks everything below)

- [x] **Name**: ship as "Slop Finder" or keep "LLM Cliché Highlighter"?
      The store listing name is hard to change cheaply later. If rebranding:
      manifest `name`/`description`, popup header, site title/copy, README.
- [x] **Version**: bump for the first public release — `npm run bump -- 1.0.0`

## 1. Make it public (≈15 min)

- [x] Create the GitHub repo (`gh repo create slopfinder --public`), push `main`
- [x] Repo Settings → Pages → Source: **GitHub Actions** (deploy workflow is
      already in the repo) → site goes live with the zip download
- [x] Point the site's GitHub CTA at this repo (it currently links to Simon
      Willison's upstream tool; keep his credit in the footer)
- [x] Tag `v<version>` → release workflow attaches the zip
- [ ] Sanity-pass the live Pages URL on phone + desktop

## 2. Chrome Web Store submission (≈45 min)

- [ ] One-time: register at chrome.google.com/webstore/devconsole
      ($5 fee, Google account)
- [ ] "New item" → upload `dist/slopfinder-extension-v<version>.zip`
- [ ] Listing: category **Tools** (or Productivity), language, description
      (lead with: highlights AI-writing tells on any page; 38 patterns;
      runs locally; no network requests; customizable via JSON)
- [ ] Assets: 128px icon (have it) · **1–5 screenshots at 1280×800**
      (capture: LinkedIn feed lit up, the popup, the landing demo) ·
      small promo tile 440×280 (optional but helps)
- [ ] Privacy tab: single purpose = "highlight AI-cliché phrases on pages
      you read"; justify `storage` (user settings/patterns only); declare
      **no data collected, no remote code** — this keeps review simple
- [ ] Visibility: Public → Submit for review
- [ ] After approval: swap the site's Download CTA to the store URL (keep
      the zip as a fallback link)

## 3. Light marketing (this afternoon, ≈1 hr)

Asset first, then three posts max:

- [ ] **The asset**: a 15–30s screen recording (or 3-frame GIF) of a
      LinkedIn feed lighting up + the badge counting — the irony is the
      hook. Backup: the landing page demo loop.
- [ ] **LinkedIn post** (the meta-play — posting it where the slop lives):
      demo clip + one honest paragraph, written like a human. Do not let it
      flag its own announcement — run the extension on your draft first.
- [ ] **X/Twitter thread**: clip + "every AI cliché, caught in the act" +
      landing URL; note Web Store pending, zip available now
- [ ] **Credit ping**: tag/email Simon Willison with the link — patterns
      are adapted from his tool (footer already credits him); he often
      boosts derivatives
- [ ] Hold **Show HN** until the store listing is approved (one-click
      install converts much better) — draft the title today:
      "Show HN: Slop Finder – highlight the tells of AI writing on any page"

## Later / nice-to-have

- [ ] Firefox port (uses `chrome.*` + Highlight API — check FF support)
- [ ] Store-listing screenshots automated via a capture script
- [ ] `stranded-auxiliary` noise review after a week of real use
