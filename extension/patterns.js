// LLM cliché pattern engine.
//
// Detection logic adapted from Simon Willison's "LLM cliché highlighter":
// https://github.com/simonw/tools/blob/main/llm-cliche-highlighter.html
//
// Patterns are data, not code: the default set below is a JSON-serializable
// spec (regexes stored as source + flags strings), which is what the settings
// panel exports and imports and what lives in chrome.storage. `compilePatterns`
// turns a spec array into runnable finders. Spec entry types:
//
//   { type: "regex",  pattern, flags }                — plain regex (g required)
//   { type: "chain",  head, headTest: {pattern, flags}, itemLabel }
//                                                     — "HEAD X, HEAD Y" lists
//   { type: "echo",      minGram, minRun }            — echoing sentence runs
//   { type: "questions", minRun }                     — stacked ?-sentences
//   { type: "anaphora",  minRun }                     — same sentence openers
//
// All entries also carry { id, name, description, group? }.
//
// Exposes `self.ClicheEngine`; loaded by the content script, the background
// worker, and the settings popup.

(() => {
  'use strict';
  if (self.ClicheEngine) return;

  const CHAIN_BODY = String.raw`[^,.;:!?\n–—…]*`;
  const CHAIN_SEP = String.raw`(?:\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+|\s*[;&–—]\s*(?:and\s+|or\s+)?|\s+-{1,2}\s+)`;
  const CHAIN_SPLIT = new RegExp(CHAIN_SEP, 'i');

  function makeChainFinder(head, headTest) {
    const item = head + CHAIN_BODY;
    const chain = new RegExp(String.raw`\b${item}(?:${CHAIN_SEP}${item})+`, 'gi');
    return function (text) {
      const found = [];
      for (const m of text.matchAll(chain)) {
        let end = m.index + m[0].length;
        while (end > m.index && /\s/.test(text[end - 1])) end -= 1;
        const count = m[0].split(CHAIN_SPLIT).filter(p => headTest.test(p.trim())).length;
        found.push({ start: m.index, end, count });
      }
      return found;
    };
  }

  function makeRegexFinder(re) {
    return function (text) {
      const found = [];
      for (const m of text.matchAll(re)) {
        found.push({ start: m.index, end: m.index + m[0].length });
      }
      return found;
    };
  }

  // Runs of consecutive sentences repeating the same multi-word skeleton —
  // the "X does A. Y does B." triad.
  function makeEchoFinder({ minGram = 3, minRun = 2 } = {}) {
    const SENT = /[^.!?\n]+[.!?]?/g;
    const grams = (s, n) => {
      const w = s.toLowerCase().match(/[a-z0-9'’-]+/g) || [];
      const out = new Set();
      for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
      return out;
    };
    return function (text) {
      const sents = [];
      for (const m of text.matchAll(SENT)) {
        if ((m[0].match(/\S+/g) || []).length >= 4) {
          sents.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        }
      }
      const found = [];
      let i = 0;
      while (i < sents.length) {
        let j = i;
        let shared = null;
        while (j + 1 < sents.length) {
          if (sents[j + 1].start - sents[j].end > 3) break; // adjacent prose only
          const a = grams(sents[j].text, minGram);
          const b = grams(sents[j + 1].text, minGram);
          const common = [...a].filter(g => b.has(g));
          if (!common.length) break;
          shared = common.sort((x, y) => y.length - x.length)[0];
          j += 1;
        }
        const run = j - i + 1;
        if (run >= minRun && shared) {
          let end = sents[j].end;
          while (end > sents[i].start && /\s/.test(text[end - 1])) end -= 1;
          found.push({ start: sents[i].start, end, count: run });
          i = j + 1;
        } else {
          i += 1;
        }
      }
      return found;
    };
  }

  // Runs of consecutive question sentences — the stacked rhetorical
  // interrogation.
  function makeQuestionChainFinder({ minRun = 2 } = {}) {
    const chain = /[^.!?\n]+\?(?:\s+[^.!?\n]+\?)+/g;
    return function (text) {
      const found = [];
      for (const m of text.matchAll(chain)) {
        const count = (m[0].match(/\?/g) || []).length;
        if (count < minRun) continue;
        let start = m.index;
        while (start < m.index + m[0].length && /\s/.test(text[start])) start += 1;
        found.push({ start, end: m.index + m[0].length, count });
      }
      return found;
    };
  }

  // Runs of consecutive sentences opening on the same word — "Maybe X.
  // Maybe Y. Maybe Z." Pronouns and articles are skipped.
  const ANAPHORA_SKIP = /^(?:i|it|the|a|an|this|that|we|you|they|he|she|there|but|and|so|in|as|if|my|his|her|their|its|these|those|for|at|on|of|to|is|was)$/i;
  function makeAnaphoraFinder({ minRun = 3 } = {}) {
    const SENT = /[^.!?\n]+[.!?]/g;
    return function (text) {
      const sents = [];
      for (const m of text.matchAll(SENT)) {
        const w = m[0].match(/[A-Za-z'’-]+/);
        if (w) {
          sents.push({
            start: m.index + m[0].indexOf(w[0]),
            end: m.index + m[0].length,
            head: w[0].toLowerCase()
          });
        }
      }
      const found = [];
      let i = 0;
      while (i < sents.length) {
        let j = i;
        while (j + 1 < sents.length && sents[j + 1].head === sents[i].head
               && sents[j + 1].start - sents[j].end < 4) j += 1;
        const run = j - i + 1;
        if (run >= minRun && !ANAPHORA_SKIP.test(sents[i].head)) {
          found.push({ start: sents[i].start, end: sents[j].end, count: run });
          i = j + 1;
        } else i += 1;
      }
      return found;
    };
  }

  // ---- Default pattern spec -------------------------------------------------

  const WIKI_GROUP = 'Signs of AI writing (Wikipedia)';

  // Spec builders: regexes are written as literals and serialized via
  // .source/.flags so escaping in the JSON spec is always correct.
  const rx = (id, name, description, re, group) => ({
    id, name, description, ...(group ? { group } : {}),
    type: 'regex', pattern: re.source, flags: re.flags
  });
  const chain = (id, name, description, head, headTest, itemLabel) => ({
    id, name, description,
    type: 'chain', head,
    headTest: { pattern: headTest.source, flags: headTest.flags },
    itemLabel
  });

  const DEFAULT_PATTERNS = [
    chain('no-chain', '“No X, no Y” chains',
      'Two or more “no …” items in a row, e.g. “No fluff, no filler, no jargon.”',
      String.raw`no[-\s]`, /^no[-\s]/i, '“no” item'),
    rx('whole', '“That’s the whole …”',
      '“That / this is the whole point, game, thing …”',
      /\b(?:that|this)(?:['’]s|\s+(?:is|was))\s+the\s+whole\b(?:\s+\w+)?/gi),
    chain('did-not-chain', '“Did not X, did not Y” chains',
      'Two or more “did not …” or “didn’t …” items in a row.',
      String.raw`(?:did\s+not|didn['’]t)\s`, /^(?:did\s+not|didn['’]t)\s/i, '“did not” item'),
    rx('dont-verb-it', '“Don’t VERB it … VERB it”',
      '“Don’t call it X. Call it Y.” — a negated verb + “it”, then the same verb + “it” again.',
      /\b(?:do\s+not|don['’]t)\s+(?:just\s+|simply\s+|merely\s+)?(\w+)(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b[^.!?\n]*?[.!?;,:–—]['"”’]*\s*(?:just\s+|simply\s+|merely\s+)?\1(?:\s+(?:of|about|at|on|for|with|to))?\s+it\b/gi),
    rx('sit-with', '“Sit with that”',
      'The reflective “sit with that / this / it (for a moment)”, plus “sit with the discomfort” and friends.',
      /\bsit(?:s|ting)?\s+with\s+(?:that|this|it|(?:the|your)\s+(?:discomfort|feelings?|tension|weight|uncertainty|ambiguity|grief|silence|unease))\b(?:\s+for\s+a\s+\w+)?/gi),
    rx('already-know', '“You already know”',
      '“You already know” — the answer, what to do, or standing alone before a full stop.',
      /\byou\s+already\s+knows?\s+(?:the\s+answer|what|how|why|this|that|it|who|where)\b|\byou\s+already\s+knows?\b(?![ \t]+\w)/gi),
    rx('is-the-entire', '“Is the entire …”',
      '“X is the entire point / game / business model.”',
      /(?:\b(?:is|was|are|were)|['’]s)\s+the\s+entire\b(?:\s+\w+)?/gi),
    rx('the-entire-is', '“The entire … is”',
      '“The entire point / game / business model is …” — the flipped twin of “is the entire”.',
      /\bthe\s+entire\s+[\w'’-]+(?:\s+[\w'’-]+){0,4}?\s+(?:is|was|are|were)\b/gi),
    rx('is-real', '“Is real … and / not”',
      '“The X is real, and / not …”. Skips “real estate”, “real time”, and similar.',
      /\bis\s+(?:(?:the|a)\s+real\b(?![\s-]+(?:estate|time|life|world|quick)\b)[^.!?\n]*?\b(?:and|not)\s+it\b|real\b(?![\s-]+(?:estate|time|life|world|quick)\b)[^.!?\n]*?\b(?:and|not)\b)/gi),
    rx('punchline', '“The punchline is”',
      '“The punchline is …”, “the punchline:”, or “the punchline?”.',
      /\bthe\s+punchline(?:\s+(?:is|was|being)\b|\s*[:?])/gi),
    rx('worth-naming', '“Worth naming”',
      'The therapist-voiced “that loss is real and it’s worth naming”. Skips “naming names”.',
      /(?:\b(?:is|are|was|were|feels?|felt|seems?|seemed)|['’]s)\s+(?:\w+\s+){0,2}?worth\s+naming\b(?!\s+names\b)|\bworth\s+naming\s*:/gi),
    rx('not-nothing', '“That’s not nothing”',
      '“That is not nothing”, plus the “this / it / which is not nothing” variants.',
      /\b(?:that|this|it|which)(?:['’]s|\s+(?:is|was))\s+not\s+nothing\b/gi),
    rx('is-the-whole', '“Is the whole …”',
      'Any subject + “is the whole point / trick / pitch / idea”, plus the “here is the whole …” opener.',
      /(?:\b(?:is|was|are|were)|['’]s)\s+the\s+whole\b(?:\s+\w+)?|\bhere(?:['’]s|\s+is)\s+the\s+whole\b(?:\s+\w+)?/gi),
    { id: 'echo-triad', name: 'Echoing sentence runs',
      description: 'Consecutive sentences built on the same repeated skeleton.',
      type: 'echo', minGram: 4, minRun: 2 },
    rx('performative-honesty', 'Performative honesty',
      'Sincerity announced rather than demonstrated: “I won’t pretend”, “let’s be honest”, “to be clear”.',
      /\bI\s+(?:will\s+not|won['’]t)\s+pretend\b|\b(?:I['’]ll|let['’]s|to)\s+be\s+(?:honest|clear|blunt|real)\b|(?:^|[.!?–—]\s+|\n)(?:Honestly|Look|Truthfully|Frankly)\s*,/gi),
    rx('thats-the-part', '“That’s the part …”',
      'Gesturing at a favoured detail instead of stating it: “that is the part a counter can’t reach”.',
      /\b(?:that|this|it)(?:['’]s|\s+(?:is|was))\s+the\s+part\b|\bthe\s+part\s+that\s+(?:makes|made|gets|got|keeps|kept)\s+(?:me|you|us|it)\b|\bmy\s+favou?rite\s+part\s+of\b/gi),
    rx('the-only-i-trust', '“The only X I trust”',
      'The narrowing superlative reveal: “the only marketing I trust”, “the only X that matters”.',
      /\bthe\s+only\s+[\w'’-]+(?:\s+[\w'’-]+){0,2}?\s+(?:I|you|we|it|he|she|they)\s+(?:trust|need|needs|care|want|wants|use|uses|believe)\b|\bthe\s+only\s+[\w'’-]+\s+that\s+(?:matters|counts|works|survives)\b/gi),
    rx('take-my-word', '“Don’t take my word for it”',
      'The stock invitation to verify: “you don’t have to take my word for it”.',
      /\b(?:you\s+)?(?:do\s+not|don['’]t)\s+(?:have\s+to\s+)?take\s+my\s+word\s+for\s+(?:it|any\s+of\s+(?:it|this|that))\b/gi),
    rx('turns-out', '“Turns out …”',
      'The casual-revelation opener: “Turns out X”, “it turns out that X”.',
      /(?:^|[.!?–—]\s+|\n)Turns\s+out\b|\bit\s+turns\s+out\s+that\b/gi),
    rx('fits-in-your-head', '“Fits in your head”',
      'Dev-blog boilerplate for simplicity: “small enough to hold in your head”, “batteries included”, “it just works”.',
      /\b(?:hold|fit|fits|holds|held)\s+(?:it\s+)?in\s+your\s+head\b|\bbatteries[-\s]included\b|\bit\s+just\s+works\b|\bzero[-\s]config(?:uration)?\b|\bsane\s+defaults\b/gi),
    { id: 'stacked-questions', name: 'Stacked rhetorical questions',
      description: 'Two or more questions fired in a row, usually fragments after the first.',
      type: 'questions', minRun: 2 },
    { id: 'sentence-anaphora', name: 'Repeated sentence openers',
      description: 'Three or more consecutive sentences starting on the same word.',
      type: 'anaphora', minRun: 3 },
    rx('colon-triple', 'Colon into a triple',
      'A colon opening onto three or more comma-separated items. Noisy in technical writing.',
      /:\s+[^.!?;:\n]{2,40},\s+[^.!?;:\n]{2,40},\s+(?:and\s+|or\s+)?[^.!?;:\n]{2,40}(?=[.!?\n])/g),
    rx('heres-the-twist', '“Here’s the twist”',
      'The stage-managed reveal: “here’s the twist”, “here’s the thing”, “here’s the catch / kicker / rub”.',
      /\bhere(?:['’]s|\s+is)\s+(?:the|a|my|one)\s+(?:twist|thing|catch|kicker|rub|problem|first|second|third|next|recent|real|best|worst|surprising|interesting|key|important)\b[\w\s-]{0,20}[:.]/gi),
    rx('x-is-dead', '“X is dead”',
      'The obituary headline and its sequel: “peer code review is dead”, “long live botd”.',
      /\b[\w\s]{3,30}\s+(?:is|are)\s+dead\b|\blong\s+live\s+\w+/gi),
    rx('thats-why-mattered', '“That’s why X mattered”',
      'Retroactively assigning significance: “that’s why being able to open the environment mattered”.',
      /\b(?:that|this)(?:['’]s|\s+(?:is|was))\s+why\b[^.!?\n]{0,80}?\b(?:matter(?:s|ed)?|count(?:s|ed)?)\b/gi),
    rx('stranded-auxiliary', 'Stranded auxiliary contrast',
      'A clause that lands on a bare auxiliary for the reversal: “The tool died; the data didn’t.”',
      /[;:,]\s+[^.;:!?\n]{2,50}\s(?:did|does|do|was|were|is|are|has|have|had|can|could|would|will)(?:n['’]t)?\s*[.;]|\b(?:Maybe|Perhaps)\s+\w+[^.!?\n]{0,40}\s(?:would|could|might|should|did|had|was|is)(?:n['’]t)?\s+(?:have\s*)?\./g),
    rx('ai-vocab', 'AI vocabulary words',
      'Words LLMs lean on far more than people do: “delve”, “tapestry”, “pivotal”, “seamless”, “ever-evolving”.',
      /\b(?:delv(?:e|es|ed|ing)|tapestr(?:y|ies)|meticulous(?:ly)?|pivotal|intricate(?:ly)?|intricacies|interplay|underscor(?:e|es|ed|ing)|garner(?:s|ed|ing)?|bolster(?:s|ed|ing)?|vibrant|bustling|multifaceted|seamless(?:ly)?|commendable|ever-evolving)\b/gi,
      WIKI_GROUP),
    rx('not-just', '“Not just X, but Y”',
      'Negative parallelisms: “not just X, but (also) Y” and the “it’s not X — it’s Y” contrast.',
      /\bnot\s+(?:just|only|merely|simply)\s+[^.!?\n;]*?\bbut(?:\s+also)?\b|\b(?:it|this|that)(?:['’]s|\s+(?:is|was))\s+not\s+[^.!?\n,;—–]{1,60}[,;—–]\s*(?:it|this|that)(?:['’]s|\s+(?:is|was))\b/gi,
      WIKI_GROUP),
    rx('note-that', '“It’s important to note”',
      'Didactic hedging: “it is important to note that”, “it’s worth noting”, “it should be noted”.',
      /\bit(?:['’]s|\s+(?:is|was))\s+(?:also\s+)?(?:important|worth|crucial|essential|vital)\s+(?:to\s+(?:note|remember|understand|recognize|mention|pause|consider|ask)|noting|mentioning|remembering|pausing|considering|asking)\b(?:\s+that\b)?|\bit\s+should\s+be\s+noted\b/gi,
      WIKI_GROUP),
    rx('testament', '“Stands as a testament”',
      '“Stands / serves as a testament (or reminder)” — inflating significance instead of saying what happened.',
      /\b(?:stand|stands|stood|serve|serves|served|standing|serving)\s+as\s+(?:a|an)\s+(?:\w+\s+)?(?:testament|reminder)\b|\b(?:is|was|are|were|remain|remains)\s+a\s+(?:\w+\s+)?testament\s+to\b/gi,
      WIKI_GROUP),
    rx('crucial-role', '“Plays a crucial role”',
      '“Plays a crucial / pivotal / vital / key / significant role in …”.',
      /\bplay(?:s|ed|ing)?\s+(?:a|an)\s+(?:\w+\s+)?(?:crucial|pivotal|vital|key|significant|central|critical|important)\s+role\b/gi,
      WIKI_GROUP),
    rx('landscape', '“Ever-evolving landscape”',
      'Scene-setting boilerplate: “the ever-evolving landscape”, “in today’s fast-paced world”.',
      /\b(?:ever-)?(?:evolving|changing|shifting)\s+landscape\b|\bin\s+today['’]s\s+(?:fast-paced|ever-changing|ever-evolving|digital|modern|competitive)\s+\w+/gi,
      WIKI_GROUP),
    rx('vague-experts', '“Experts argue”',
      'Vague attribution to unnamed authorities: “experts argue”, “some critics have noted”.',
      /\b(?:many|some|several|most|numerous)?\s*(?:experts|critics|observers|scholars|analysts|commentators)\s+(?:have\s+|often\s+|widely\s+)?(?:argu(?:e|es|ed)|not(?:e|es|ed)|suggest(?:s|ed)?|believ(?:e|es|ed)|agree[ds]?|contend(?:s|ed)?|observ(?:e|es|ed)|caution(?:s|ed)?|claim(?:s|ed)?|cit(?:e|es|ed)|point(?:s|ed)?\s+out)\b|\bindustry\s+reports?\s+(?:suggest|indicate|show)\w*\b/gi,
      WIKI_GROUP),
    rx('despite-challenges', '“Despite these challenges”',
      'The boilerplate challenges-and-outlook formula: “despite these challenges”, “time will tell”.',
      /\bdespite\s+(?:these|those|such|its|their|the|numerous|significant|ongoing)\s+(?:\w+\s+)?challenges\b|\bfac(?:e|es|ed|ing)\s+(?:several|numerous|many|significant|various|a\s+number\s+of)\s+challenges\b|\bchallenges\s+remain\b|\bremains\s+to\s+be\s+seen\b|\b(?:only\s+)?time\s+will\s+tell\b/gi,
      WIKI_GROUP),
    rx('participle-tail', 'Participle sentence tails',
      'Superficial analysis bolted onto a sentence end: “…, highlighting / underscoring the …”.',
      /,\s+(?:highlighting|underscoring|emphasizing|showcasing|reflecting|demonstrating|illustrating|signaling|solidifying|cementing|reinforcing|underlining)\s+(?:its|his|her|their|our|the|a|an|how|that|what|both)\b[^.!?\n]*/gi,
      WIKI_GROUP),
    rx('promo', 'Promotional boilerplate',
      'Travel-brochure tone: “nestled in”, “in the heart of”, “hidden gem”, “breathtaking”.',
      /\bnestled\s+(?:in|on|among|between|along|at)\b|\bin\s+the\s+heart\s+of\b|\brich\s+(?:cultural\s+|historical\s+)?(?:heritage|history|tapestry)\b|\bhidden\s+gem\b|\bmust-(?:visit|see|try)\b|\bbreathtaking\b|\bboasts?\s+(?:a|an|the)\b|\bstunning\s+(?:views?|scenery|architecture|backdrop)\b/gi,
      WIKI_GROUP),
    rx('ai-leftovers', 'Chatbot leftovers',
      'Artifacts pasted straight from a chatbot: “as an AI language model”, “knowledge cutoff”, markup debris.',
      /\bas\s+an\s+ai(?:\s+language)?\s+model\b|\bas\s+of\s+my\s+last\s+(?:update|training)\b|\bknowledge\s+cutoff\b|\bI\s+(?:cannot|can['’]t|do\s+not|don['’]t)\s+(?:browse\s+the\s+internet|access\s+real-?time)\b|contentReference|oaicite|turn0(?:search|news|image)\d*|attributableIndex|utm_source=/gi,
      WIKI_GROUP)
  ];

  // ---- Spec compilation & validation ---------------------------------------

  function compileFinder(spec) {
    switch (spec.type) {
      case 'regex':
        return makeRegexFinder(new RegExp(spec.pattern, spec.flags || 'gi'));
      case 'chain':
        return makeChainFinder(
          spec.head,
          new RegExp(spec.headTest.pattern, spec.headTest.flags || 'i')
        );
      case 'echo':
        return makeEchoFinder({ minGram: spec.minGram, minRun: spec.minRun });
      case 'questions':
        return makeQuestionChainFinder({ minRun: spec.minRun });
      case 'anaphora':
        return makeAnaphoraFinder({ minRun: spec.minRun });
      default:
        throw new Error(`unknown pattern type "${spec.type}"`);
    }
  }

  function compilePatterns(specs) {
    return specs.map(spec => ({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      group: spec.group,
      find: compileFinder(spec)
    }));
  }

  // Returns { ok: true, count } or { ok: false, error }.
  function validatePatterns(specs) {
    if (!Array.isArray(specs) || specs.length === 0) {
      return { ok: false, error: 'Expected a non-empty JSON array of patterns.' };
    }
    if (specs.length > 500) {
      return { ok: false, error: 'Too many patterns (max 500).' };
    }
    const seen = new Set();
    for (const [i, spec] of specs.entries()) {
      const at = `pattern ${i + 1}`;
      if (!spec || typeof spec !== 'object') return { ok: false, error: `${at}: not an object.` };
      if (typeof spec.id !== 'string' || !spec.id) return { ok: false, error: `${at}: missing "id".` };
      if (seen.has(spec.id)) return { ok: false, error: `${at}: duplicate id "${spec.id}".` };
      seen.add(spec.id);
      if (typeof spec.name !== 'string' || !spec.name) return { ok: false, error: `"${spec.id}": missing "name".` };
      if (spec.type === 'regex') {
        if (typeof spec.pattern !== 'string') return { ok: false, error: `"${spec.id}": missing "pattern".` };
        if (spec.flags && !String(spec.flags).includes('g')) {
          return { ok: false, error: `"${spec.id}": flags must include "g".` };
        }
      } else if (spec.type === 'chain') {
        if (typeof spec.head !== 'string' || !spec.headTest || typeof spec.headTest.pattern !== 'string') {
          return { ok: false, error: `"${spec.id}": chain needs "head" and "headTest.pattern".` };
        }
      } else if (!['echo', 'questions', 'anaphora'].includes(spec.type)) {
        return { ok: false, error: `"${spec.id}": unknown type "${spec.type}".` };
      }
      try {
        compileFinder(spec);
      } catch (err) {
        return { ok: false, error: `"${spec.id}": ${err.message}` };
      }
    }
    return { ok: true, count: specs.length };
  }

  // ---- Matching ------------------------------------------------------------

  // Run every compiled pattern over `text`, drop overlapping matches (earliest
  // start wins, longer match breaks ties), and tally per-pattern counts.
  function collectMatches(text, compiled) {
    const perPattern = {};
    const raw = [];
    for (const p of compiled) {
      perPattern[p.id] = 0;
      for (const m of p.find(text)) {
        m.patternId = p.id;
        raw.push(m);
      }
    }
    raw.sort((a, b) => a.start - b.start || b.end - a.end);
    const matches = [];
    for (const m of raw) {
      const last = matches[matches.length - 1];
      if (last && m.start < last.end) continue;
      matches.push(m);
      perPattern[m.patternId] += 1;
    }
    return { matches, perPattern };
  }

  function sentenceBounds(text, start, end) {
    let s = start;
    while (s > 0) {
      const ch = text[s - 1];
      if (ch === '\n' || ch === '.' || ch === '!' || ch === '?' || ch === '…') break;
      s -= 1;
    }
    while (s < start && /\s/.test(text[s])) s += 1;
    let e = end;
    while (e < text.length) {
      const ch = text[e];
      if (ch === '\n') break;
      e += 1;
      if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
        while (e < text.length && /["'”’)\]]/.test(text[e])) e += 1;
        break;
      }
    }
    return [s, e];
  }

  // Expand matches to whole flagged sentences, merging overlaps.
  function buildRegions(text, matches) {
    const regions = [];
    for (const m of matches) {
      const [s, e] = sentenceBounds(text, m.start, m.end);
      const last = regions[regions.length - 1];
      if (last && s <= last.end) {
        last.end = Math.max(last.end, e);
        last.matches.push(m);
      } else {
        regions.push({ start: s, end: e, matches: [m] });
      }
    }
    return regions;
  }

  self.ClicheEngine = {
    DEFAULT_PATTERNS,
    compilePatterns,
    validatePatterns,
    collectMatches,
    buildRegions
  };
})();
