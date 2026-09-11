#!/usr/bin/env node
// Stamp packaging manifests with a release version + per-asset SHA256s.
//
// Reads the release's assets, computes SHA256 for the ones referenced
// by each manifest (AUR PKGBUILD, winget YAMLs) and writes stamped
// copies to a chosen output directory. Placeholders are literal
// `@TOKEN@` strings — no templating engine, easy to grep for.
//
// Usage:
//   node scripts/stamp-packaging.mjs \
//        --version 0.5.1 \
//        --assets-dir ./release-assets \
//        --out ./stamped
//
// The release workflow calls this after `gh release download` pulls the
// tagged assets locally, then uploads the stamped files back with
// `gh release upload`.

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

function usage() {
  process.stderr.write(
    'usage: stamp-packaging.mjs --version <ver> --assets-dir <dir> --out <dir>\n',
  )
  process.exit(2)
}

// ---- CLI parsing ---------------------------------------------------

const argv = process.argv.slice(2)
const opts = { version: '', assetsDir: '', out: '' }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--version') opts.version = argv[++i]
  else if (a === '--assets-dir') opts.assetsDir = argv[++i]
  else if (a === '--out') opts.out = argv[++i]
  else usage()
}
if (!opts.version || !opts.assetsDir || !opts.out) usage()

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGING_ROOT = path.join(REPO_ROOT, 'packaging')
const RELEASE_DATE = new Date().toISOString().slice(0, 10)

// ---- Helpers -------------------------------------------------------

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    const s = createReadStream(file)
    s.on('data', (c) => h.update(c))
    s.on('error', reject)
    s.on('end', () => resolve(h.digest('hex')))
  })
}

async function findAsset(pattern) {
  const entries = await readdir(opts.assetsDir)
  const matches = entries.filter((n) => pattern.test(n))
  if (matches.length === 0) {
    process.stderr.write(`stamp-packaging: no asset matched ${pattern}\n`)
    return null
  }
  if (matches.length > 1) {
    process.stderr.write(
      `stamp-packaging: multiple matches for ${pattern}: ${matches.join(', ')} — using first\n`,
    )
  }
  return path.join(opts.assetsDir, matches[0])
}

async function digestOf(pattern) {
  const p = await findAsset(pattern)
  if (!p) return null
  const st = await stat(p)
  if (!st.isFile()) return null
  return sha256(p)
}

function replaceAll(input, tokens) {
  let out = input
  for (const [k, v] of Object.entries(tokens)) {
    // Use split/join instead of a regex so `@` in values doesn't confuse
    // us. Missing values leave the placeholder in place — the caller
    // can grep for `@` afterwards to spot un-stamped slots.
    if (v == null) continue
    out = out.split(`@${k}@`).join(v)
  }
  return out
}

// ---- Compute SHA256s for the assets each manifest references -------

// Asset filename patterns match Tauri v2 conventions +
// release.yml's own portable-zip step.
const digests = {
  amd64_deb:      await digestOf(/^omnio_[0-9.]+_amd64\.deb$/i),
  amd64_rpm:      await digestOf(/^omnio-[0-9.]+.*x86_64\.rpm$/i),
  aarch64_deb:    await digestOf(/^omnio_[0-9.]+_(arm64|aarch64)\.deb$/i),
  aarch64_rpm:    await digestOf(/^omnio-[0-9.]+.*aarch64\.rpm$/i),
  nsis_x64:       await digestOf(/^Omnio_[0-9.]+_x64-setup\.exe$/i),
  msi_x64:        await digestOf(/^Omnio_[0-9.]+_x64.*\.msi$/i),
  portable_x64:   await digestOf(/^Omnio_[0-9.]+_windows-portable\.zip$/i),
  appimage_x64:   await digestOf(/^omnio_[0-9.]+_amd64\.AppImage$/i),
}

process.stderr.write('stamp-packaging: computed digests:\n')
for (const [k, v] of Object.entries(digests)) {
  process.stderr.write(`  ${k.padEnd(14)} ${v ?? '(missing)'}\n`)
}

// ---- Stamp each manifest into <out>/<subdir>/ ----------------------

await mkdir(path.join(opts.out, 'aur'), { recursive: true })
await mkdir(path.join(opts.out, 'winget'), { recursive: true })

const tokens = {
  VERSION: opts.version,
  PKGREL: '1',
  RELEASE_DATE,
  SHA256_AMD64:        digests.amd64_deb ?? '',
  SHA256_AARCH64:      digests.aarch64_deb ?? '',
  SHA256_NSIS_X64:     digests.nsis_x64 ?? '',
  SHA256_MSI_X64:      digests.msi_x64 ?? '',
  SHA256_PORTABLE_X64: digests.portable_x64 ?? '',
}

async function stamp(inRelPath, outRelPath) {
  const src = path.join(PACKAGING_ROOT, inRelPath)
  const dst = path.join(opts.out, outRelPath)
  const raw = await readFile(src, 'utf8')
  const stamped = replaceAll(raw, tokens)
  await writeFile(dst, stamped, 'utf8')
  const unfilled = (stamped.match(/@[A-Z0-9_]+@/g) ?? []).length
  process.stderr.write(
    `stamp-packaging: wrote ${outRelPath} (${unfilled} unfilled placeholder${unfilled === 1 ? '' : 's'})\n`,
  )
}

await stamp('aur/PKGBUILD', 'aur/PKGBUILD')
await stamp('winget/TonyMontania.Omnio.yaml',            'winget/TonyMontania.Omnio.yaml')
await stamp('winget/TonyMontania.Omnio.installer.yaml',  'winget/TonyMontania.Omnio.installer.yaml')
await stamp('winget/TonyMontania.Omnio.locale.en-US.yaml', 'winget/TonyMontania.Omnio.locale.en-US.yaml')

process.stderr.write('stamp-packaging: done.\n')
