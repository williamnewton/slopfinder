# Launch posts — this afternoon

Three posts and a credit ping. The asset that carries all of them: a 15–30s
clip of a LinkedIn feed lighting up with the badge counting. Record it
yourself (your feed, logged in) — screen-record a scroll, no editing needed.
Fallback asset: the landing page demo loop.

All drafts below pass the extension's own scanner (0 matches) — see
`npm run slopcheck` note in the ship checklist. Keep it that way if you
edit; getting flagged by your own tool in the replies is the failure mode.

## LinkedIn (the meta-play — post it where the slop lives)

> I built a Chrome extension that highlights AI-written clichés on any page
> you read.
>
> It's called Slop Finder. Install it, open your feed, and watch the yellow
> pile up. 38 patterns — the vocabulary, the stock phrases, the stacked
> rhetorical questions — each one counted on a badge as you scroll.
>
> It runs entirely in your browser. Zero network requests, zero data
> collected, and the pattern list is plain JSON you can edit yourself.
>
> Detection patterns adapted from Simon Willison's LLM cliché highlighter.
>
> Try it: [PAGES_URL]

(Attach the feed clip. Yes, quoting example clichés in the post would get
them highlighted by the extension — that's the joke working, but the draft
above deliberately avoids quoting any, so the announcement itself scans
clean.)

## X/Twitter

> Every AI cliché, caught in the act.
>
> Slop Finder highlights the tells of machine-written prose on any page —
> 38 patterns, counted on a badge, running entirely locally.
>
> [clip]
>
> [PAGES_URL] — on the Chrome Web Store soon; the zip on the site works
> today.

## Credit ping to Simon Willison (email or DM, before the posts go up)

> Hi Simon — I turned your LLM cliché highlighter into an auto-running
> Chrome extension: it scans every page as you browse, paints matches with
> the CSS Highlight API, and counts them on a per-tab badge. Your pattern
> set does all the real work and you're credited on the site, in the popup,
> and in the README. Code: https://github.com/williamnewton/slopfinder ·
> demo: [PAGES_URL]. Wanted you to see it first — and thanks for the
> patterns.

## Show HN (HOLD until the Web Store listing is approved)

- Title: `Show HN: Slop Finder – highlight the tells of AI writing on any page`
- Text:

> A Chrome extension that highlights AI-writing clichés as you browse and
> counts them on the toolbar. 38 patterns adapted from Simon Willison's
> cliché highlighter: vocabulary tells, stock constructions, and structural
> habits like stacked rhetorical questions. Built on the CSS Custom
> Highlight API so the page DOM is never touched. Storage-only permissions,
> no network requests; patterns are editable JSON. Feedback on the pattern
> set is very welcome — some heuristics are deliberately aggressive.

## After the store listing is approved

- Swap the site's Download CTA to the store URL (keep the zip link as a
  fallback)
- Post Show HN
- Reply to your own LinkedIn/X posts with the one-click install link
