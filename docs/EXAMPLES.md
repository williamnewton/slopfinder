# Verified example pages

Real pages for demos, screenshots, and manual testing, each scored with the
shipped engine (v1.0.2 defaults) on 2026-08-30. Counts came from running
`collectMatches` over the page's extracted text — in-extension numbers can
differ slightly (per-block scanning, hidden DOM text), but the character of
each page holds.

| Page | What it is | Result |
|---|---|---|
| [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) | The taxonomy the patterns are partly drawn from — quotes real AI text as examples | **140 matches** in ~121k chars; every category fires (`ai-vocab` 45, `ai-leftovers` 41, `echo-triad` 14) |
| [Imarticus: "Digital Disruption…"](https://imarticus.org/blog/digital-disruption-how-to-stay-ahead-in-the-ever-evolving-landscape-of-digital-marketing/) | SEO content-farm blog post | **18 matches** on one post (`ai-vocab` 7, `landscape` 5, `echo-triad` 3) |
| [LinkedIn Pulse: "Digital Dynamics…"](https://www.linkedin.com/pulse/digital-dynamics-navigating-ever-evolving-landscape-4gakf) | Public Pulse article, readable logged-out | **5 matches** in ~4.3k chars — "ever-evolving landscape" twice, "delve", a participle tail |
| [Paul Graham: "How to Do Great Work"](https://paulgraham.com/greatwork.html) | Human-written control (aphoristic essay) | **41 matches** in ~67k chars — but *zero* vocabulary/stock-phrase hits; all from structural heuristics (`echo-triad` 17, `stranded-auxiliary` 12, `not-just` 6) |

## What the control teaches

The pattern set has two distinct tiers:

- **Vocabulary and stock-phrase patterns** (`ai-vocab`, `landscape`,
  `testament`, `crucial-role`, …) are the discriminators. They light up
  content-farm and LLM prose at roughly 10–20 matches per 10k characters
  and were **absent** from the human-written control.
- **Structural heuristics** (`echo-triad`, `stranded-auxiliary`,
  `not-just`, `stacked-questions`) fire on deliberate human style too —
  aphoristic essayists write echoing runs and bare-auxiliary reversals on
  purpose. On the control they produced ~6 matches per 10k chars.

So a page with a big count *and* yellow on words like "delve" or
"ever-evolving landscape" is the strong signal; a moderate count that is
all structural flags on a stylish essay is the known false-positive
profile. This is also the first place to look if the default set ever
needs tuning (see `stranded-auxiliary` in particular).

## Demo suggestions

- The Wikipedia page is the best single screenshot/clip: dense, varied,
  and self-aware.
- Any search for "ever-evolving landscape" "delve into" blog surfaces
  fresh SEO-farm examples on demand.
- LinkedIn feeds vary run to run — Pulse articles are more reproducible
  than the feed for demos (and readable logged-out).
