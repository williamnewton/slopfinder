// Behavioral tests for the extension's pattern engine (extension/patterns.js)
// plus the "demo honesty" suite: every cliché the landing page animates must
// actually be caught by the shipped engine, under the pattern name the page
// displays.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from '../scripts/lib.mjs';

const engine = await loadEngine();
const compiled = engine.compilePatterns(engine.DEFAULT_PATTERNS);

// ---- defaults -------------------------------------------------------------

test('default pattern set validates', () => {
  const result = engine.validatePatterns(engine.DEFAULT_PATTERNS);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.count, engine.DEFAULT_PATTERNS.length);
});

test('default pattern set survives a JSON round-trip (popup export/import)', () => {
  const roundTripped = JSON.parse(JSON.stringify(engine.DEFAULT_PATTERNS));
  assert.equal(engine.validatePatterns(roundTripped).ok, true);
  assert.equal(engine.compilePatterns(roundTripped).length, compiled.length);
});

// ---- demo honesty ---------------------------------------------------------
// Mirrors DEMO_PARAGRAPHS in site/index.html: each entry is a highlighted
// segment and the pattern name the landing page credits for it.

const DEMO_HITS = [
  ['delve into', 'AI vocabulary words'],
  ['not just an editor, but a philosophy', '“Not just X, but Y”'],
  ['No fluff, no filler, no jargon', '“No X, no Y” chains'],
  ['plays a pivotal role', '“Plays a crucial role”'],
  [', reflecting the appeal', 'Participle sentence tails'],
  ['seamless', 'AI vocabulary words'],
  ['stands as a testament', '“Stands as a testament”'],
  ['Here’s the kicker:', '“Here’s the twist”'],
  ['You already know the answer.', '“You already know”'],
  ['That’s not nothing.', '“That’s not nothing”'],
];

for (const [snippet, patternName] of DEMO_HITS) {
  test(`demo: ${patternName} catches “${snippet}”`, () => {
    const pattern = compiled.find(p => p.name === patternName);
    assert.ok(pattern, `no pattern named ${patternName}`);
    assert.ok(pattern.find(snippet).length > 0, `pattern did not match the snippet`);
  });
}

test('demo: full launch post produces a healthy match count', () => {
  const post = [
    'In this guide, we delve into the rewrite. It’s not just an editor, but a philosophy. No fluff, no filler, no jargon.',
    'Community feedback plays a pivotal role in every release, reflecting the appeal of a seamless design. The steady adoption stands as a testament to the team.',
    'Here’s the kicker: nobody reads the changelog. You already know the answer. That’s not nothing.',
  ].join('\n');
  const { matches } = engine.collectMatches(post, compiled);
  // Overlapping matches collapse (earliest start wins), so the count can be
  // below the 10 animated highlights — but the prose is wall-to-wall cliché.
  assert.ok(matches.length >= 8, `expected >= 8 matches, got ${matches.length}`);
});

// ---- matching semantics ---------------------------------------------------

test('collectMatches drops overlaps: earliest start wins', () => {
  // “plays a pivotal role” contains “pivotal” (AI vocab); the earlier,
  // longer crucial-role match must win and the vocab hit must be dropped.
  const { matches, perPattern } = engine.collectMatches(
    'Community feedback plays a pivotal role in every release.',
    compiled
  );
  assert.equal(matches.length, 1);
  assert.equal(perPattern['crucial-role'], 1);
  assert.equal(perPattern['ai-vocab'], 0);
});

test('buildRegions expands matches to sentences and merges overlaps', () => {
  const text = 'We delve into the seamless tapestry. Plain sentence here.';
  const { matches } = engine.collectMatches(text, compiled);
  const regions = engine.buildRegions(text, matches);
  assert.equal(regions.length, 1);
  assert.equal(text.slice(regions[0].start, regions[0].end), 'We delve into the seamless tapestry.');
});

test('chain finder counts items', () => {
  const noChain = compiled.find(p => p.id === 'no-chain');
  const found = noChain.find('No fluff, no filler, no jargon.');
  assert.equal(found.length, 1);
  assert.equal(found[0].count, 3);
});

test('questions finder needs a run of question sentences', () => {
  const stacked = compiled.find(p => p.id === 'stacked-questions');
  assert.equal(stacked.find('Why does this matter? Who benefits? What changes?').length, 1);
  assert.equal(stacked.find('Why does this matter? It matters a lot.').length, 0);
});

test('anaphora finder skips pronouns and articles', () => {
  const anaphora = compiled.find(p => p.id === 'sentence-anaphora');
  assert.equal(
    anaphora.find('Maybe it works. Maybe it fails. Maybe nobody notices.').length,
    1
  );
  // "The" is on the skip list — three "The …" sentences are normal prose.
  assert.equal(
    anaphora.find('The cat sat down. The dog barked loudly. The bird flew away.').length,
    0
  );
});

test('echo finder flags repeated sentence skeletons', () => {
  const echo = compiled.find(p => p.id === 'echo-triad');
  assert.ok(
    echo.find(
      'The old tools made you wait for results. The new tools make you wait for permission. The next tools make you wait for nothing.'
    ).length > 0
  );
});

// ---- validation gate (what the popup's Upload JSON runs) ------------------

test('validatePatterns rejects malformed specs', () => {
  const cases = [
    [{}, 'not an array'],
    [[], 'empty array'],
    [[{ id: 'a', name: 'A', type: 'regex', pattern: 'x', flags: 'i' }], 'missing g flag'],
    [[{ id: 'a', name: 'A', type: 'regex', pattern: '(', flags: 'g' }], 'bad regex'],
    [[{ id: 'a', name: 'A', type: 'wat' }], 'unknown type'],
    [
      [
        { id: 'a', name: 'A', type: 'echo' },
        { id: 'a', name: 'A2', type: 'echo' },
      ],
      'duplicate ids',
    ],
    [[{ name: 'A', type: 'echo' }], 'missing id'],
  ];
  for (const [spec, label] of cases) {
    assert.equal(engine.validatePatterns(spec).ok, false, `should reject: ${label}`);
  }
});

test('validatePatterns accepts a minimal custom set', () => {
  const result = engine.validatePatterns([
    { id: 'custom', name: 'Custom', type: 'regex', pattern: 'foo', flags: 'gi' },
  ]);
  assert.equal(result.ok, true, result.error);
});
