#!/usr/bin/env node
// Fills <VERSION> and <SHA256-*> placeholders in packaging/ manifests using
// the artifacts produced by `npm run build` under release/<version>/.
//
// Usage:
//   node scripts/stamp-packaging.mjs               # uses version from package.json
//   node scripts/stamp-packaging.mjs 0.1.5         # override version
//   node scripts/stamp-packaging.mjs --check       # verify placeholders, don't write
//
// Output goes to packaging/dist/<version>/ so the templates under packaging/
// stay clean and reusable for the next release.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG  = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const args    = process.argv.slice(2);
const check   = args.includes('--check');
const version = args.find(a => !a.startsWith('--')) ?? PKG.version;
const today   = new Date().toISOString().slice(0, 10);

const releaseDir = join(ROOT, 'release', version);
const outDir     = join(ROOT, 'packaging', 'dist', version);

const artifacts = {
  'SHA256-SETUP-EXE':    `Omnio-${version}-setup.exe`,
  'SHA256-PORTABLE-EXE': `Omnio-${version}-portable.exe`,
  'SHA256-DMG-X64':      `Omnio-Mac-${version}-x64.dmg`,
  'SHA256-DMG-ARM64':    `Omnio-Mac-${version}-arm64.dmg`,
  'SHA256-APPIMAGE':     `Omnio-Linux-${version}.AppImage`,
};

function sha256(path) {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

const hashes = {};
for (const [key, filename] of Object.entries(artifacts)) {
  const filepath = join(releaseDir, filename);
  if (existsSync(filepath)) {
    hashes[key] = sha256(filepath);
    console.log(`  ${filename.padEnd(40)} ${hashes[key]}`);
  } else {
    hashes[key] = null;
    console.warn(`  ${filename.padEnd(40)} MISSING (placeholder kept)`);
  }
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'dist' || entry === 'README.md') continue;
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const templates = walk(join(ROOT, 'packaging'));
mkdirSync(outDir, { recursive: true });

for (const src of templates) {
  let text = readFileSync(src, 'utf8');
  text = text.replace(/<VERSION>/g, version);
  text = text.replace(/<YYYY-MM-DD>/g, today);
  for (const [key, hash] of Object.entries(hashes)) {
    if (hash) text = text.replace(new RegExp(`<${key}>`, 'g'), hash);
  }

  const rel = relative(join(ROOT, 'packaging'), src);
  const dst = join(outDir, rel);
  mkdirSync(dirname(dst), { recursive: true });

  if (check) {
    const remaining = text.match(/<(SHA256-[^>]+|VERSION|YYYY-MM-DD)>/g);
    if (remaining) console.error(`  ${rel}: unresolved ${[...new Set(remaining)].join(', ')}`);
  } else {
    writeFileSync(dst, text);
    console.log(`  wrote ${relative(ROOT, dst)}`);
  }
}

console.log(check ? '\nCheck complete.' : `\nStamped manifests for v${version} → packaging/dist/${version}/`);
