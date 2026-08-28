// Shared helpers for the workstation scripts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const EXTENSION_DIR = join(ROOT, 'extension');
export const SITE_DIR = join(ROOT, 'site');
export const DIST_DIR = join(ROOT, 'dist');

/** The name the landing page's download CTA links to. */
export const ZIP_NAME = 'slopfinder-extension.zip';

export function readManifest() {
  return JSON.parse(readFileSync(join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
}

export function readPackageJson() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
}

/**
 * Load the extension's pattern engine in Node. patterns.js is a plain
 * browser script that attaches to `self`, so alias it to globalThis first.
 */
export async function loadEngine() {
  globalThis.self = globalThis;
  await import(join(EXTENSION_DIR, 'patterns.js'));
  return globalThis.ClicheEngine;
}
