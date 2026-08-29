// Content script: runs automatically on every page, scans the prose for LLM
// clichés, and paints matches with the CSS Custom Highlight API (no DOM
// mutation, so highlighting can't break page scripts and clearing is
// instant). Reports the match count to the background worker, which shows it
// as a badge on the toolbar icon.
//
// Patterns come from chrome.storage (seeded with the defaults on install, and
// replaceable from the settings panel); storage changes re-scan live. A
// debounced MutationObserver re-scans pages that render content late.
//
// Text extraction groups text nodes by their nearest block-level ancestor and
// runs the engine per block, so sentence-level patterns (echoes, anaphora,
// stacked questions) see the same contiguous prose a reader does.

(() => {
  'use strict';
  if (self.__llmClicheContent) return;

  const HIT_HL = 'llm-cliche-hit';
  const FLAG_HL = 'llm-cliche-flag';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'IFRAME', 'SVG', 'CANVAS']);
  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'NAV',
    'BLOCKQUOTE', 'PRE', 'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'CAPTION',
    'DETAILS', 'SUMMARY', 'BODY'
  ]);
  const RESCAN_DEBOUNCE_MS = 1500;
  const RESCAN_MAX_WAIT_MS = 5000;

  const state = { enabled: true, compiled: null, results: null };
  self.__llmClicheContent = state;

  function blockAncestor(node) {
    let el = node.parentElement;
    while (el && el !== document.body && !BLOCK_TAGS.has(el.tagName)) {
      el = el.parentElement;
    }
    return el || document.body;
  }

  // Collect text nodes grouped into per-block segments. Each segment carries
  // the concatenated text plus a part list mapping segment offsets back to
  // the source nodes, so engine matches can become DOM Ranges.
  function collectSegments() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const segments = [];
    let current = null;
    let node;
    while ((node = walker.nextNode())) {
      const block = blockAncestor(node);
      if (!current || current.block !== block) {
        current = { block, text: '', parts: [] };
        segments.push(current);
      }
      current.parts.push({ node, start: current.text.length, length: node.nodeValue.length });
      current.text += node.nodeValue;
    }
    return segments;
  }

  // Convert a [start, end) span in segment text into a DOM Range.
  function spanToRange(segment, start, end) {
    const range = document.createRange();
    let startSet = false;
    for (const part of segment.parts) {
      const partEnd = part.start + part.length;
      if (!startSet && start < partEnd) {
        range.setStart(part.node, start - part.start);
        startSet = true;
      }
      if (startSet && end <= partEnd) {
        range.setEnd(part.node, end - part.start);
        return range;
      }
    }
    if (startSet) {
      const last = segment.parts[segment.parts.length - 1];
      range.setEnd(last.node, last.length);
      return range;
    }
    return null;
  }

  function injectStyles() {
    if (document.querySelector('style[data-llm-cliche]')) return;
    const style = document.createElement('style');
    style.dataset.llmCliche = '';
    style.textContent = `
      ::highlight(${FLAG_HL}) { background-color: rgba(254, 243, 199, 0.85); color: #1d1b17; }
      ::highlight(${HIT_HL}) { background-color: #fcd34d; color: #1d1b17; }
    `;
    document.documentElement.append(style);
  }

  function reportCount(total) {
    try {
      chrome.runtime.sendMessage({ type: 'count', total });
    } catch {
      // Extension context gone (e.g. reloaded) — nothing to report to.
    }
  }

  function scan() {
    if (!('highlights' in CSS) || !state.compiled || !document.body) return;
    const engine = self.ClicheEngine;
    const hitRanges = [];
    const flagRanges = [];
    const perPattern = {};
    let flagged = 0;
    for (const p of state.compiled) perPattern[p.id] = 0;

    for (const segment of collectSegments()) {
      if (segment.text.length < 8) continue;
      const { matches, perPattern: counts } = engine.collectMatches(segment.text, state.compiled);
      if (!matches.length) continue;
      for (const id of Object.keys(counts)) perPattern[id] += counts[id];
      for (const m of matches) {
        const r = spanToRange(segment, m.start, m.end);
        if (r) hitRanges.push(r);
      }
      for (const region of engine.buildRegions(segment.text, matches)) {
        const r = spanToRange(segment, region.start, region.end);
        if (r) flagRanges.push(r);
        flagged += 1;
      }
    }

    CSS.highlights.set(FLAG_HL, new Highlight(...flagRanges));
    CSS.highlights.set(HIT_HL, new Highlight(...hitRanges));
    injectStyles();

    state.results = {
      total: hitRanges.length,
      flagged,
      perPattern: state.compiled
        .map(p => ({ id: p.id, name: p.name, count: perPattern[p.id] }))
        .filter(p => p.count > 0)
        .sort((a, b) => b.count - a.count)
    };
    reportCount(state.results.total);
  }

  function clear() {
    if ('highlights' in CSS) {
      CSS.highlights.delete(HIT_HL);
      CSS.highlights.delete(FLAG_HL);
    }
    state.results = null;
    reportCount(0);
  }

  function applySettings({ enabled, patterns }) {
    state.enabled = enabled !== false;
    try {
      state.compiled = self.ClicheEngine.compilePatterns(
        Array.isArray(patterns) && patterns.length ? patterns : self.ClicheEngine.DEFAULT_PATTERNS
      );
    } catch {
      state.compiled = self.ClicheEngine.compilePatterns(self.ClicheEngine.DEFAULT_PATTERNS);
    }
    if (state.enabled) scan();
    else clear();
  }

  chrome.storage.local.get(['enabled', 'patterns']).then(applySettings);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.enabled && !changes.patterns)) return;
    chrome.storage.local.get(['enabled', 'patterns']).then(applySettings);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'status') {
      sendResponse({ enabled: state.enabled, results: state.results });
    } else if (message.type === 'rescan') {
      if (state.enabled) scan();
      sendResponse(state.results);
    }
  });

  // Late-rendering pages (SPAs, infinite scroll): re-scan after DOM mutations
  // settle. The Highlight API adds no DOM nodes, so our own work never
  // re-triggers the observer (the style element is injected once, pre-scan).
  //
  // The debounce alone starves on pages that mutate continuously (feeds with
  // live counters, virtualized scrolling — e.g. LinkedIn), because the timer
  // keeps resetting and the settle never comes. The max-wait timer guarantees
  // a scan at least every RESCAN_MAX_WAIT_MS while mutations keep arriving.
  let rescanTimer;
  let maxWaitTimer;
  function runScheduledScan() {
    clearTimeout(rescanTimer);
    clearTimeout(maxWaitTimer);
    rescanTimer = maxWaitTimer = undefined;
    if (state.enabled && state.compiled) scan();
  }
  const observer = new MutationObserver(() => {
    if (!state.enabled || !state.compiled) return;
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(runScheduledScan, RESCAN_DEBOUNCE_MS);
    if (maxWaitTimer === undefined) {
      maxWaitTimer = setTimeout(runScheduledScan, RESCAN_MAX_WAIT_MS);
    }
  });
  if (document.body) {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
})();
