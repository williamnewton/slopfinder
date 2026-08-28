// Bump the version everywhere it lives (extension/manifest.json +
// package.json — the single source of truth is the manifest).
//
//   npm run bump patch     0.2.0 -> 0.2.1
//   npm run bump minor     0.2.0 -> 0.3.0
//   npm run bump major     0.2.0 -> 1.0.0
//   npm run bump 1.4.2     explicit version

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_DIR, ROOT, readManifest } from './lib.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run bump -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

const current = readManifest().version;
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  const [major, minor, patch] = current.split('.').map(Number);
  if (arg === 'major') next = `${major + 1}.0.0`;
  else if (arg === 'minor') next = `${major}.${minor + 1}.0`;
  else if (arg === 'patch') next = `${major}.${minor}.${patch + 1}`;
  else {
    console.error(`Unknown bump "${arg}" — use patch, minor, major, or x.y.z`);
    process.exit(1);
  }
}

// String-replace the version fields so formatting and key order survive.
for (const file of [join(EXTENSION_DIR, 'manifest.json'), join(ROOT, 'package.json')]) {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(`"version": "${current}"`, `"version": "${next}"`));
}

console.log(`${current} -> ${next}`);
console.log('Next: npm run build, commit, then tag the release:');
console.log(`  git tag v${next} && git push --tags`);
