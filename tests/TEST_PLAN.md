# Slop Finder Test Plan

How to verify the extension and the landing site before shipping a build.
Layers 0–1 are automated; layers 2–6 are manual passes in Chrome. Run the
whole plan before a Web Store submission or tagged release; run 0 + the
touched layer for day-to-day changes.

## 0. Automated suite (every change)

```bash
npm run build
```

- [ ] `check` passes — manifest v3, storage-only permissions, referenced
      files exist, versions in sync, site download link intact
- [ ] All engine tests pass (`npm test`) — defaults validate, JSON
      round-trip, demo honesty, overlap semantics, finder behaviors,
      upload validation gate
- [ ] Package succeeds; zip lands in `dist/` and `site/downloads/`

## 1. Engine smoke in a real page (scriptable, no install)

The content script can run outside the extension with a stubbed `chrome`
(storage/runtime no-ops) — inject `patterns.js` + `content.js` into any page
and confirm `CSS.highlights` gets populated. The landing page's demo copy is
wall-to-wall cliché, so it makes a good fixture: expect ≥ 8 matches.

## 2. Install & first run

- [ ] `chrome://extensions` → Developer mode → Load unpacked → `extension/`
      loads with no errors ("Errors" button absent)
- [ ] Toolbar icon shows the Slop Finder logo (pin it if hidden)
- [ ] Popup opens: logo + title, count row, Auto-highlight ON by default,
      "38 loaded" under Patterns
- [ ] Fresh-profile equivalent: after install, defaults are seeded (toggle
      on, patterns present) without opening the popup first

## 3. Highlighting on real pages

Good fixtures: the verified pages in `docs/EXAMPLES.md` (engine-scored,
with expected counts and a human-written control), plus the landing page
itself (`npm run serve` → http://localhost:4600 — the demo card is bait).

- [ ] Exact matches paint solid yellow; their whole sentence paints pale
- [ ] Page text/layout unchanged (highlight API only — no DOM mutation:
      selection, copy/paste, and page scripts keep working)
- [ ] Badge on the toolbar icon matches the popup's count
- [ ] Badge is **per-tab**: two tabs with different pages show different
      counts as you switch
- [ ] Clean page (e.g. a raw GitHub README of terse docs) → no badge
- [ ] SPA / late content: on a client-rendered page, highlights appear
      within ~2s of content settling (MutationObserver rescan)
- [ ] Continuously-mutating page (LinkedIn/X feed — live counters,
      virtualized scroll): highlights and count still update within ~5s
      of new content, even though the DOM never goes quiet (max-wait
      rescan; a plain debounce starves here)

## 4. Popup controls

- [ ] Toggle OFF → highlights vanish on every open tab within a second
      (storage.onChanged, no reload), badge clears
- [ ] Toggle ON → highlights and badge return
- [ ] Download JSON → `llm-cliche-patterns.json`, 38 entries, matches the
      spec format
- [ ] Upload the same file back → "Loaded 38 patterns."
- [ ] Upload edited JSON (add a trivial regex pattern for a word on the
      current page) → count rises live; new pattern survives popup reopen
- [ ] Upload garbage (`not json`) → "Not valid JSON." inline, nothing stored
- [ ] Upload invalid spec (duplicate ids / missing `g` flag) → specific
      validation error inline, nothing stored
- [ ] Reset → back to 38 defaults, pages re-scan
- [ ] On chrome://, Web Store, or PDF tabs the count shows "–" and nothing
      breaks

## 5. Lifecycle & persistence

- [ ] Settings (toggle state, custom patterns) survive a full Chrome
      restart
- [ ] Extension reload (chrome://extensions ⟳) keeps stored settings and
      re-highlights open tabs after their next reload
- [ ] Update path: bump version, reload — storage is preserved (onInstalled
      only seeds missing keys)

## 6. Landing site

- [ ] http://localhost:4600 (or the deployed URL): hero sweep runs once;
      the marked phrase sits on its own line at every width
- [ ] Demo loop: sweeps left-to-right through all 10 clichés, badge on the
      mock-browser toolbar upticks in step, holds, then loops; badge never
      pulses after the count completes
- [ ] Theme toggle flips light/dark, persists across reload, no flash on
      load
- [ ] Mobile (~375px): no horizontal scroll; browser bar, address pill,
      CTAs all fit
- [ ] `prefers-reduced-motion`: page renders fully highlighted, no
      animation
- [ ] Download button serves the zip; the zip loads as an unpacked-style
      package (manifest at archive root)
- [ ] Favicon shows the logo

## Release gate

All of the above, plus:

- [ ] `git tag v<version>` matches `extension/manifest.json`
- [ ] CI green; Pages deploy serves the new site + zip
- [ ] Fresh Chrome profile install from the built zip (drag into
      chrome://extensions), not just the working tree
