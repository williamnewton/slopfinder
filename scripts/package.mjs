// Package the extension for distribution:
//   dist/slopfinder-extension-v<version>.zip   (versioned build artifact)
//   site/downloads/slopfinder-extension.zip    (what the landing page serves)
//
// Uses the system `zip` (present on macOS and ubuntu runners). Files are
// added in sorted order with extra attributes stripped (-X) so rebuilds of
// identical content stay as reproducible as zip allows.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readdirSync } from 'node:fs';
import { DIST_DIR, EXTENSION_DIR, SITE_DIR, ZIP_NAME, readManifest } from './lib.mjs';

const { version } = readManifest();
const versionedZip = join(DIST_DIR, `slopfinder-extension-v${version}.zip`);

rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(DIST_DIR, { recursive: true });

const files = readdirSync(EXTENSION_DIR, { recursive: true, withFileTypes: true })
  .filter(d => d.isFile() && d.name !== '.DS_Store')
  .map(d => relative(EXTENSION_DIR, join(d.parentPath, d.name)))
  .sort();

execFileSync('zip', ['-X', '-q', versionedZip, ...files], { cwd: EXTENSION_DIR });

const downloads = join(SITE_DIR, 'downloads');
mkdirSync(downloads, { recursive: true });
copyFileSync(versionedZip, join(downloads, ZIP_NAME));

const kb = (statSync(versionedZip).size / 1024).toFixed(1);
console.log(`Packaged v${version} (${files.length} files, ${kb} KB)`);
console.log(`  ${relative(process.cwd(), versionedZip)}`);
console.log(`  ${relative(process.cwd(), join(downloads, ZIP_NAME))}`);
