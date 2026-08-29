// Static validation of the extension and site — run before packaging.
// Checks structure and cross-file consistency; behavioral coverage of the
// pattern engine lives in tests/.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXTENSION_DIR,
  SITE_DIR,
  ZIP_NAME,
  loadEngine,
  readManifest,
  readPackageJson,
} from './lib.mjs';

const failures = [];
const check = (ok, message) => {
  if (ok) console.log(`  ok  ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL  ${message}`);
  }
};

// ---- manifest.json --------------------------------------------------------

const manifest = readManifest();
check(manifest.manifest_version === 3, 'manifest_version is 3');
check(
  /^\d+\.\d+\.\d+$/.test(manifest.version ?? ''),
  `manifest version is x.y.z (${manifest.version})`
);
check(
  manifest.version === readPackageJson().version,
  `manifest version matches package.json (${manifest.version})`
);
check(
  Array.isArray(manifest.permissions) &&
    manifest.permissions.length === 1 &&
    manifest.permissions[0] === 'storage' &&
    !manifest.host_permissions,
  'permissions are storage-only (no host permissions — the privacy promise)'
);

// Every file the manifest references must exist in the extension dir.
const referenced = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap(cs => cs.js ?? []),
  manifest.action?.default_popup,
  ...Object.values(manifest.action?.default_icon ?? {}),
  ...Object.values(manifest.icons ?? {}),
].filter(Boolean);
for (const file of new Set(referenced)) {
  check(existsSync(join(EXTENSION_DIR, file)), `manifest file exists: ${file}`);
}

// ---- popup.html script references ----------------------------------------

const popupHtml = readFileSync(join(EXTENSION_DIR, 'popup.html'), 'utf8');
for (const [, src] of popupHtml.matchAll(/<script src="([^"]+)">/g)) {
  check(existsSync(join(EXTENSION_DIR, src)), `popup script exists: ${src}`);
}

// ---- pattern engine -------------------------------------------------------

const engine = await loadEngine();
const result = engine.validatePatterns(engine.DEFAULT_PATTERNS);
check(result.ok, `default patterns validate (${result.ok ? result.count : result.error})`);

// ---- site ↔ extension consistency ----------------------------------------

const siteHtml = readFileSync(join(SITE_DIR, 'index.html'), 'utf8');
check(
  siteHtml.includes(`downloads/${ZIP_NAME}`),
  `site download CTA points at downloads/${ZIP_NAME}`
);

// ---------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
