import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

function getStorageRoot(): string {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR
  if (app.isPackaged) return path.dirname(app.getPath('exe'))
  return app.getPath('userData')
}

const STORAGE_ROOT = getStorageRoot()
const DATA_FILE = path.join(STORAGE_ROOT, 'data.json')
const ASSETS_ROOT = path.join(STORAGE_ROOT, 'assets')

protocol.registerSchemesAsPrivileged([
  { scheme: 'omnio-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

let win: BrowserWindow | null

function createWindow() {
  // In dev the icons live under project/build/ (see APP_ROOT above); in the
  // packaged app they are copied to process.resourcesPath via extraResources.
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, iconName)
    : path.join(process.env.APP_ROOT, 'build', iconName)

  win = new BrowserWindow({
    title: 'Omnio',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.setMenuBarVisibility(false)

  win.once('ready-to-show', () => {
    win?.maximize()
    win?.show()
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function safeRelative(rel: string): string | null {
  const normalized = path.normalize(rel).replace(/^([/\\])+/, '')
  const target = path.join(ASSETS_ROOT, normalized)
  const resolved = path.resolve(target)
  if (!resolved.startsWith(path.resolve(ASSETS_ROOT))) return null
  return resolved
}

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
}

// ---------------------------------------------------------------------------
// Split storage: one .json per library slice under data/, plus five rotating
// snapshots (each a directory copy) under data/backups/. Migrates the legacy
// single data.json automatically on first boot of a split-aware version.
// ---------------------------------------------------------------------------

const DATA_DIR       = path.join(STORAGE_ROOT, 'data')
const BACKUPS_DIR    = path.join(DATA_DIR, 'backups')
const LEGACY_DATA_FILE = DATA_FILE  // pre-0.1.7 single-file layout
const BACKUP_COUNT   = 5

// One file per category → items with that categoryId. Extra top-level slices
// (collections, artists, settings, customOrders) live at data/ root too.
const CATEGORY_IDS = [
  'videojuegos', 'musica', 'peliculas', 'series',
  'anime', 'donghua',
  'manga', 'manhwa', 'manhua', 'comics_west',
] as const

// The internal categoryId (kept in every item.categoryId, in customOrders keys,
// and in dozens of activeCategory === 'videojuegos' branches) stays untouched.
// This map only decides what the file on disk is called, so the folder reads
// as English rather than a mix of English + Spanish.
const CATEGORY_FILENAME: Record<string, string> = {
  videojuegos: 'games',
  musica: 'music',
  peliculas: 'movies',
  anime: 'anime',
  donghua: 'donghua',
  series: 'series',
  manga: 'manga',
  manhwa: 'manhwa',
  manhua: 'manhua',
  comics_west: 'comics_west',
}
const fileForCategory = (cat: string) => `${CATEGORY_FILENAME[cat] ?? cat}.json`

// Same map is applied to assets/ folder names. Existing users' JSON stores
// image paths like "videojuegos/cover/xxx.jpg"; migrateLegacyAssetFolders()
// renames the folders and rewrites those paths so nothing 404s post-migrate.
const CATEGORY_ASSET_FOLDER: Record<string, string> = CATEGORY_FILENAME
const assetFolderForCategory = (cat: string) => CATEGORY_ASSET_FOLDER[cat] ?? cat

const TOP_SLICES = ['collections', 'artists', 'settings', 'customOrders'] as const

// Slice → last-written SHA1. Used to skip writes for unchanged files so a
// save that only edits, say, a game only rewrites videojuegos.json.
const lastHashes: Record<string, string> = {}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

function sha1(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex')
}

async function writeIfChanged(filepath: string, content: string): Promise<boolean> {
  const hash = sha1(content)
  if (lastHashes[filepath] === hash) return false
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.writeFile(filepath, content, 'utf-8')
  lastHashes[filepath] = hash
  return true
}

// One-shot rename: 0.1.7 wrote files by categoryId (videojuegos.json etc);
// 0.1.7.1+ uses English names (games.json etc). Runs before any read/write
// so callers don't have to know about both layouts.
async function renameLegacyCategoryFiles(): Promise<void> {
  const renames: [string, string][] = [
    ['videojuegos.json', 'games.json'],
    ['musica.json',       'music.json'],
    ['peliculas.json',    'movies.json'],
  ]
  const rename = async (dir: string) => {
    for (const [oldName, newName] of renames) {
      const oldP = path.join(dir, oldName)
      const newP = path.join(dir, newName)
      if (await fileExists(oldP) && !await fileExists(newP)) {
        try { await fs.rename(oldP, newP) } catch { /* non-fatal */ }
      }
    }
  }
  await rename(DATA_DIR)
  // Also fix snapshot dirs so restores keep working.
  for (let i = 1; i <= BACKUP_COUNT; i++) {
    const slot = path.join(BACKUPS_DIR, String(i))
    if (await fileExists(slot)) await rename(slot)
  }
}

// One-shot rename: pre-0.2.1 stored asset folders as assets/videojuegos,
// assets/musica, assets/peliculas (Spanish, matching internal categoryIds).
// 0.2.1+ uses English names to match the split data files. Rename the
// folders AND rewrite the relative paths inside every category JSON so
// existing covers/banners/logos keep resolving.
async function renameLegacyAssetFolders(): Promise<void> {
  // Marker file skips the entire scan on subsequent boots so we don't
  // re-check three folder names + rewrite ten JSONs on every launch after
  // the first-run migration.
  const marker = path.join(DATA_DIR, '.assets-migrated')
  if (await fileExists(marker)) return
  const renames: [string, string][] = [
    ['videojuegos', 'games'],
    ['musica',       'music'],
    ['peliculas',    'movies'],
  ]
  for (const [oldName, newName] of renames) {
    const oldP = path.join(ASSETS_ROOT, oldName)
    const newP = path.join(ASSETS_ROOT, newName)
    if (await fileExists(oldP) && !await fileExists(newP)) {
      try { await fs.rename(oldP, newP) } catch { /* non-fatal */ }
    }
  }
  // Rewrite paths inside every category JSON. Match at the start of any
  // string field to avoid mangling arbitrary text; paths look like
  // "videojuegos/cover/xxx.jpg".
  for (const cat of CATEGORY_IDS) {
    const p = path.join(DATA_DIR, fileForCategory(cat))
    let raw: string
    try { raw = await fs.readFile(p, 'utf-8') } catch { continue }
    let changed = raw
    for (const [oldName, newName] of renames) {
      // Only rewrite when the folder name appears as an asset-path prefix
      // (inside quotes, followed by /). Leaves item titles / descriptions
      // that happen to contain the word untouched.
      const re = new RegExp(`"${oldName}/`, 'g')
      changed = changed.replace(re, `"${newName}/`)
    }
    if (changed !== raw) {
      try {
        await fs.writeFile(p, changed, 'utf-8')
        lastHashes[p] = sha1(changed)
      } catch { /* non-fatal */ }
    }
  }
  // Drop the marker last so a crash mid-migration leaves it absent and the
  // migration retries on next boot.
  try { await fs.writeFile(marker, new Date().toISOString(), 'utf-8') } catch { /* non-fatal */ }
}

async function readSplitData(): Promise<Record<string, unknown> | null> {
  if (!await fileExists(DATA_DIR)) return null
  await renameLegacyCategoryFiles()
  await renameLegacyAssetFolders()
  const items: unknown[] = []
  for (const cat of CATEGORY_IDS) {
    const p = path.join(DATA_DIR, fileForCategory(cat))
    try {
      const raw = await fs.readFile(p, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) items.push(...parsed)
      lastHashes[p] = sha1(raw)
    } catch { /* missing = empty slice */ }
  }
  const out: Record<string, unknown> = { items }
  for (const key of TOP_SLICES) {
    const p = path.join(DATA_DIR, `${key}.json`)
    try {
      const raw = await fs.readFile(p, 'utf-8')
      out[key] = JSON.parse(raw)
      lastHashes[p] = sha1(raw)
    } catch { /* missing = leave undefined */ }
  }
  return out
}

async function migrateLegacyIfNeeded(): Promise<Record<string, unknown> | null> {
  if (!await fileExists(LEGACY_DATA_FILE)) return null
  let legacy: Record<string, unknown>
  try {
    legacy = JSON.parse(await fs.readFile(LEGACY_DATA_FILE, 'utf-8'))
  } catch { return null }
  await writeSplitData(legacy)
  // Keep the original around as a safety net — never delete it automatically.
  try {
    await fs.rename(LEGACY_DATA_FILE, path.join(STORAGE_ROOT, 'data.pre-split.json'))
  } catch { /* rename may fail if there's a name clash — non-fatal */ }
  return legacy
}

// Splits an AppData payload across per-category + top-level files, writing
// only slices whose content changed. Rotates the snapshot ring first if any
// write is going to happen.
async function writeSplitData(payload: Record<string, unknown>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })

  const plans: { path: string; content: string }[] = []

  // Per-category item shards.
  if (Array.isArray(payload.items)) {
    const bySlice: Record<string, unknown[]> = {}
    for (const cat of CATEGORY_IDS) bySlice[cat] = []
    for (const it of payload.items as { categoryId?: string }[]) {
      const cat = it.categoryId
      if (cat && bySlice[cat]) bySlice[cat].push(it)
    }
    for (const cat of CATEGORY_IDS) {
      plans.push({
        path: path.join(DATA_DIR, fileForCategory(cat)),
        content: JSON.stringify(bySlice[cat], null, 2),
      })
    }
  }

  // Top-level slices — skip any that the caller didn't include so
  // undefined keys don't silently wipe files on disk.
  for (const key of TOP_SLICES) {
    if (payload[key] === undefined) continue
    plans.push({
      path: path.join(DATA_DIR, `${key}.json`),
      content: JSON.stringify(payload[key], null, 2),
    })
  }

  const willChange = plans.some((p) => sha1(p.content) !== lastHashes[p.path])
  if (willChange) await rotateSnapshots()

  for (const p of plans) await writeIfChanged(p.path, p.content)
}

// Snapshot rotation: slot N-1 → N (dropping the oldest), then copy the
// current data files into a fresh slot 1. Snapshots are directories so
// restore is one atomic operation from the user's point of view.
async function rotateSnapshots(): Promise<void> {
  await fs.mkdir(BACKUPS_DIR, { recursive: true })
  for (let i = BACKUP_COUNT; i > 1; i--) {
    const src = path.join(BACKUPS_DIR, String(i - 1))
    const dst = path.join(BACKUPS_DIR, String(i))
    if (await fileExists(src)) {
      try { await fs.rm(dst, { recursive: true, force: true }) } catch { /* absent */ }
      try { await fs.rename(src, dst) } catch { /* rename failure = non-fatal */ }
    }
  }
  // Take a fresh snapshot of the current on-disk state into slot 1.
  const slot1 = path.join(BACKUPS_DIR, '1')
  try {
    let entries: string[] = []
    try { entries = await fs.readdir(DATA_DIR) } catch { /* no data yet */ }
    const jsonFiles = entries.filter((f) => f.endsWith('.json'))
    if (jsonFiles.length === 0) return  // first save ever — nothing to snapshot
    await fs.mkdir(slot1, { recursive: true })
    for (const f of jsonFiles) {
      await fs.copyFile(path.join(DATA_DIR, f), path.join(slot1, f))
    }
  } catch { /* snapshot best-effort; a failure here doesn't block the save */ }
}

ipcMain.handle('data:save', async (_event, data: Record<string, unknown>) => {
  await writeSplitData(data ?? {})
  return true
})

ipcMain.handle('data:load', async () => {
  // Prefer split files if they exist. Otherwise, one-shot migrate the
  // legacy data.json and return its contents.
  const split = await readSplitData()
  if (split && Array.isArray(split.items) && split.items.length > 0) return split
  const migrated = await migrateLegacyIfNeeded()
  if (migrated) return migrated
  // Nothing on disk (fresh install) — return whatever readSplitData gave us
  // so the renderer sees a consistent shape (possibly empty).
  return split
})

ipcMain.handle('data:list-backups', async () => {
  const results: { file: string; mtime: number; size: number }[] = []
  for (let i = 1; i <= BACKUP_COUNT; i++) {
    const slot = path.join(BACKUPS_DIR, String(i))
    if (!await fileExists(slot)) continue
    try {
      let entries: string[] = []
      try { entries = await fs.readdir(slot) } catch { continue }
      let mtime = 0
      let size = 0
      for (const f of entries) {
        const st = await fs.stat(path.join(slot, f))
        mtime = Math.max(mtime, st.mtimeMs)
        size += st.size
      }
      results.push({ file: `snapshot-${i}`, mtime, size })
    } catch { /* skip malformed slot */ }
  }
  return results
})

ipcMain.handle('data:restore-backup', async (_event, name: string) => {
  const m = /^snapshot-([1-5])$/.exec(name)
  if (!m) return false
  const slot = path.join(BACKUPS_DIR, m[1])
  if (!await fileExists(slot)) return false

  // Preserve current state before overwriting.
  const preRestore = path.join(STORAGE_ROOT, 'data.pre-restore')
  try {
    await fs.rm(preRestore, { recursive: true, force: true })
    await fs.cp(DATA_DIR, preRestore, { recursive: true })
  } catch { /* first-time restore before any save — nothing to preserve */ }

  // Wipe current data JSONs (keep backups/ dir untouched) then copy snapshot in.
  try {
    const currentFiles = await fs.readdir(DATA_DIR)
    for (const f of currentFiles) {
      if (f.endsWith('.json')) await fs.unlink(path.join(DATA_DIR, f))
    }
  } catch { /* absent = fine */ }
  const snapFiles = await fs.readdir(slot)
  for (const f of snapFiles) {
    if (f.endsWith('.json')) {
      await fs.copyFile(path.join(slot, f), path.join(DATA_DIR, f))
    }
  }
  // Invalidate hash cache so the next save can't skip a rewrite by mistake.
  for (const k of Object.keys(lastHashes)) delete lastHashes[k]
  return true
})

ipcMain.handle('image:save', async (_event, categoryId: string, kind: string, dataUrl: string) => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const ext = EXT_FROM_MIME[mime] ?? 'bin'
  const buf = Buffer.from(match[2], 'base64')
  const safeCategory = assetFolderForCategory(categoryId).replace(/[^a-z0-9_-]/gi, '')
  const safeKind = kind.replace(/[^a-z0-9_-]/gi, '')
  const dir = path.join(ASSETS_ROOT, safeCategory, safeKind)
  await fs.mkdir(dir, { recursive: true })
  const filename = `${crypto.randomUUID()}.${ext}`
  await fs.writeFile(path.join(dir, filename), buf)
  return `${safeCategory}/${safeKind}/${filename}`
})

ipcMain.handle('image:delete', async (_event, rel: string) => {
  const resolved = safeRelative(rel)
  if (!resolved) return false
  try {
    await fs.unlink(resolved)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('storage:root', async () => STORAGE_ROOT)

// Copy the current data/ directory to a user-chosen folder (Dropbox,
// OneDrive, Google Drive, etc.). Everything stays local-only; the cloud
// service does its own sync when it detects new files. Runs on demand from
// Settings → Data → Remote backup.
ipcMain.handle('storage:copy-data-to', async (_event, targetDir: string) => {
  try {
    if (!targetDir) return { ok: false, error: 'No folder chosen' }
    const dest = path.join(targetDir, `omnio-backup-${new Date().toISOString().slice(0, 10)}`)
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
    let files = 0
    for (const e of entries) {
      if (!e.isFile()) continue
      if (!e.name.endsWith('.json')) continue
      await fs.copyFile(path.join(DATA_DIR, e.name), path.join(dest, e.name))
      files++
    }
    // Include assets so a cold restore on a new machine has covers too.
    try {
      await fs.cp(ASSETS_ROOT, path.join(dest, 'assets'), { recursive: true, force: false, errorOnExist: false })
    } catch { /* assets dir may not exist yet */ }
    return { ok: true, path: dest, files }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// Frees disk from old one-shot migration / restore safety nets that pile up
// as the user experiments with restores. Never touches the live data/ or the
// numbered snapshots under data/backups/.
ipcMain.handle('storage:cleanup-migration-artifacts', async () => {
  const paths = [
    path.join(STORAGE_ROOT, 'data.pre-split.json'),
    path.join(STORAGE_ROOT, 'data.pre-restore'),
  ]
  let removed = 0
  let bytes = 0
  for (const p of paths) {
    try {
      const stat = await fs.stat(p)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(p, { withFileTypes: true })
        for (const e of entries) {
          try { const s = await fs.stat(path.join(p, e.name)); bytes += s.size } catch { /* skip */ }
        }
        await fs.rm(p, { recursive: true, force: true })
      } else {
        bytes += stat.size
        await fs.unlink(p)
      }
      removed++
    } catch { /* absent = nothing to do */ }
  }
  return { removed, bytes }
})

// -----------------------------------------------------------------------------
// Update check. We don't ship electron-updater because the builds are unsigned
// (portable EXE, DMG without notarisation, AppImage) and every auto-updater
// stack assumes signed artifacts and a publish server. Instead we poll the
// GitHub Releases API, compare semver against APP_VERSION and let the user
// download the right variant themselves. This works uniformly for portable,
// NSIS, DMG, AppImage, .deb — whichever build they installed from.
//
// Runs opportunistically at boot (renderer decides when) and on demand from
// Settings → Data → Check for updates.
// -----------------------------------------------------------------------------

const GITHUB_LATEST_RELEASE = 'https://api.github.com/repos/TonyMontania/Omnio/releases/latest'

function parseSemver(v: string): number[] | null {
  const clean = v.trim().replace(/^v/i, '')
  const parts = clean.split('.').map((n) => parseInt(n, 10))
  if (parts.some((n) => Number.isNaN(n))) return null
  while (parts.length < 3) parts.push(0)
  return parts.slice(0, 3)
}

function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest)
  const b = parseSemver(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

interface ReleaseAsset { name: string; browser_download_url: string; size: number }
interface GithubRelease {
  tag_name: string
  name?: string
  html_url: string
  body?: string
  published_at?: string
  prerelease?: boolean
  draft?: boolean
  assets?: ReleaseAsset[]
}

ipcMain.handle('updates:check', async (_event, currentVersion: string) => {
  try {
    const r = await fetch(GITHUB_LATEST_RELEASE, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Omnio-update-check' },
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as GithubRelease
    if (json.draft || json.prerelease) return { ok: true, hasUpdate: false, current: currentVersion, latest: json.tag_name }
    const hasUpdate = isNewer(json.tag_name, currentVersion)
    return {
      ok: true,
      hasUpdate,
      current: currentVersion,
      latest: json.tag_name,
      htmlUrl: json.html_url,
      publishedAt: json.published_at,
      notes: json.body,
      assets: (json.assets ?? []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('updates:open-url', async (_event, url: string) => {
  const { shell } = await import('electron')
  await shell.openExternal(url)
  return true
})

// Which build did the user actually install? We use this to point them at the
// matching asset from the release page instead of a generic "open release" —
// portable users get portable, NSIS users get setup, DMG users get DMG, etc.
ipcMain.handle('updates:install-kind', async () => {
  const platform = process.platform
  const arch = process.arch
  const isPortableWin = platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_DIR
  let kind = 'unknown'
  let assetHint = ''
  if (platform === 'win32') {
    if (isPortableWin) { kind = 'win-portable'; assetHint = '-portable.exe' }
    else { kind = 'win-nsis'; assetHint = '-setup.exe' }
  } else if (platform === 'darwin') {
    kind = arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
    assetHint = arch === 'arm64' ? '-arm64.dmg' : '-x64.dmg'
  } else if (platform === 'linux') {
    // Best-effort: default to AppImage. .deb / Flatpak / Snap users have their
    // own package manager anyway and shouldn't rely on our downloader.
    kind = 'linux-appimage'; assetHint = '.AppImage'
  }
  return { kind, assetHint, platform, arch }
})

// Download an update asset to a predictable location and stream progress
// back to the renderer via the returned event. We can't do "true" auto-update
// because the builds are unsigned (SmartScreen / Gatekeeper would prompt on
// every silent install anyway), so this is the assisted flow:
//   * NSIS win32     → downloads *-setup.exe, launches it, quits the app
//   * Portable win32 → downloads to the same folder, reveals in Explorer,
//                      user closes Omnio and runs the new .exe manually
//   * DMG mac        → downloads the .dmg, opens it (Finder handles the drag)
//   * AppImage linux → downloads next to the running AppImage, chmods it,
//                      relaunches from the new one so the swap is atomic
ipcMain.handle('updates:download', async (event, url: string, filename: string) => {
  try {
    const downloadsDir = app.getPath('downloads')
    await fs.mkdir(downloadsDir, { recursive: true })
    const safeName = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    const targetPath = path.join(downloadsDir, safeName)

    const r = await fetch(url)
    if (!r.ok || !r.body) return { ok: false, error: `HTTP ${r.status}` }
    const total = Number(r.headers.get('content-length') ?? 0) || 0

    const handle = await fs.open(targetPath, 'w')
    const stream = handle.createWriteStream()
    let received = 0
    let lastReport = 0
    const reader = (r.body as ReadableStream<Uint8Array>).getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      stream.write(Buffer.from(value))
      received += value.byteLength
      // Throttle progress events to ~10 per MiB so the renderer doesn't
      // choke on a fetch that finishes in <1s from a fast mirror.
      if (received - lastReport > 200_000) {
        event.sender.send('updates:progress', { received, total })
        lastReport = received
      }
    }
    stream.end()
    await new Promise<void>((res) => stream.on('close', () => res()))
    await handle.close()
    event.sender.send('updates:progress', { received, total: total || received })
    return { ok: true, path: targetPath, size: received }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('updates:reveal', async (_event, filePath: string) => {
  const { shell } = await import('electron')
  shell.showItemInFolder(filePath)
  return true
})

// Windows NSIS: launch the setup and quit. UAC + SmartScreen still appear
// because the build isn't signed — one prompt to approve, then a normal
// setup wizard. On success it replaces the installed Omnio with the new one.
ipcMain.handle('updates:launch-installer', async (_event, filePath: string) => {
  const { shell } = await import('electron')
  await shell.openPath(filePath)
  setTimeout(() => app.quit(), 500)
  return true
})

// Linux AppImage: chmod +x, relaunch from the new file, quit. The new one
// takes over and the old file can be deleted whenever the user wants.
ipcMain.handle('updates:appimage-swap', async (_event, newPath: string) => {
  try {
    await fs.chmod(newPath, 0o755)
    const { spawn } = await import('node:child_process')
    spawn(newPath, [], { detached: true, stdio: 'ignore' }).unref()
    setTimeout(() => app.quit(), 500)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// macOS: open the DMG so Finder mounts it. User drags Omnio.app to
// Applications like a normal install.
ipcMain.handle('updates:open-dmg', async (_event, filePath: string) => {
  const { shell } = await import('electron')
  await shell.openPath(filePath)
  return true
})

// Dialog helpers — main-process only, so surfaced through IPC for the
// renderer's export flows.
import { dialog } from 'electron'

ipcMain.handle('dialog:pick-directory', async (_event, title?: string) => {
  const r = await dialog.showOpenDialog({
    title: title ?? 'Choose a folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (r.canceled || r.filePaths.length === 0) return null
  return r.filePaths[0]
})

// Static-site export: write index.html into targetDir and mirror the
// assets/ folder alongside so the exported page renders with real covers
// even when the user zips and hands it to a friend.
ipcMain.handle('export:site', async (_event, targetDir: string, htmlContent: string) => {
  try {
    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(path.join(targetDir, 'index.html'), htmlContent, 'utf-8')
    // Copy assets/ recursively — falls back gracefully if not present.
    const dstAssets = path.join(targetDir, 'assets')
    try {
      await fs.cp(ASSETS_ROOT, dstAssets, { recursive: true, force: true })
    } catch { /* nothing to copy is fine */ }
    return { ok: true, path: targetDir }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// ---- External metadata fetchers ----
// We proxy through the main process so (a) API keys stay out of the renderer's
// devtools if the user opens them and (b) we avoid CORS entirely. Neither
// endpoint stores data on our end — we're just forwarding.

const SGDB_BASE = 'https://www.steamgriddb.com/api/v2'

ipcMain.handle('sgdb:search', async (_event, apiKey: string, term: string) => {
  if (!apiKey || !term.trim()) return { ok: false, error: 'Missing API key or search term' }
  try {
    const r = await fetch(`${SGDB_BASE}/search/autocomplete/${encodeURIComponent(term)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data: unknown }
    return { ok: true, data: json.data }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('sgdb:assets', async (_event, apiKey: string, kind: 'grids' | 'heroes' | 'logos', gameId: number | string) => {
  if (!apiKey || !gameId) return { ok: false, error: 'Missing API key or game id' }
  try {
    const r = await fetch(`${SGDB_BASE}/${kind}/game/${gameId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data: unknown }
    return { ok: true, data: json.data }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// Jikan v4 — unofficial MyAnimeList proxy, no API key required.
// kind is 'anime' or 'manga'; docs: https://docs.api.jikan.moe
// Jikan is a free community proxy over the real MAL API and returns 504
// (upstream timeout) intermittently, especially for manga. Retry a few
// times with backoff on transient errors before surfacing the failure.
ipcMain.handle('jikan:search', async (_event, term: string, kind: 'anime' | 'manga') => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  const url = `https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(term.trim())}&limit=12&sfw=false`
  const isRetryable = (status: number) => status === 504 || status === 502 || status === 503 || status === 429 || status === 408
  const maxAttempts = 3
  let lastError = 'Search failed'
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const r = await fetch(url)
      if (r.ok) {
        const json = await r.json() as { data?: unknown[] }
        return { ok: true, data: json.data ?? [] }
      }
      lastError = `HTTP ${r.status}${r.status === 504 ? ' — MAL upstream timed out, retry in a moment' : ''}`
      if (!isRetryable(r.status)) return { ok: false, error: lastError }
    } catch (e) {
      lastError = (e as Error).message
    }
    if (attempt < maxAttempts - 1) await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
  }
  return { ok: false, error: lastError }
})

// Kitsu — free, no-key anime/manga fallback. JSON:API spec: everything
// is under attributes and relationships are separate. Useful when AniList
// or MAL miss a title (region-specific, obscure, or older entries).
const KITSU_BASE = 'https://kitsu.io/api/edge'

ipcMain.handle('kitsu:search', async (_event, term: string, kind: 'anime' | 'manga') => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  try {
    const params = new URLSearchParams()
    params.set('filter[text]', term.trim())
    params.set('page[limit]', '15')
    const url = `${KITSU_BASE}/${kind}?${params.toString()}`
    const r = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data?: unknown[]; errors?: { title?: string; detail?: string }[] }
    if (json.errors && json.errors.length) return { ok: false, error: json.errors[0].detail ?? json.errors[0].title ?? 'Kitsu error' }
    return { ok: true, data: json.data ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// MangaDex — open, no-key manga metadata for manga (ja), manhwa (ko),
// manhua (zh) and everything else. Includes[] joins cover_art / author /
// artist so a single request has everything we need to build a patch.
const MD_BASE = 'https://api.mangadex.org'
const MD_UA = 'Omnio/0.1 ( https://github.com/TonyMontania/Omnio )'

ipcMain.handle('mangadex:search', async (_event, term: string) => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  try {
    const params = new URLSearchParams({ title: term.trim(), limit: '15' })
    // Multiple `includes[]` values must be repeated, not comma-joined.
    for (const inc of ['cover_art', 'author', 'artist']) params.append('includes[]', inc)
    const url = `${MD_BASE}/manga?${params.toString()}`
    const r = await fetch(url, { headers: { 'User-Agent': MD_UA, Accept: 'application/json' } })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data?: unknown[]; result?: string; errors?: { detail?: string }[] }
    if (json.result === 'error') return { ok: false, error: json.errors?.[0]?.detail ?? 'MangaDex returned an error' }
    return { ok: true, data: json.data ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// ComicVine (GameSpot) — comics metadata (Marvel, DC, Image, indies).
// Requires a free API key from comicvine.gamespot.com/api/. Rate-limit
// is soft (~200 req/hr per key). "Volume" is ComicVine's word for series.
const CV_BASE = 'https://comicvine.gamespot.com/api'
const CV_UA = 'Omnio/0.1 ( https://github.com/TonyMontania/Omnio )'

ipcMain.handle('comicvine:search', async (_event, apiKey: string, term: string) => {
  if (!apiKey || !term.trim()) return { ok: false, error: 'Missing API key or search term' }
  try {
    const url = `${CV_BASE}/search/?api_key=${encodeURIComponent(apiKey)}&format=json&resources=volume&query=${encodeURIComponent(term.trim())}&limit=15&field_list=id,name,deck,start_year,count_of_issues,publisher,image,api_detail_url`
    const r = await fetch(url, { headers: { 'User-Agent': CV_UA, Accept: 'application/json' } })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { results?: unknown[]; error?: string; status_code?: number }
    if (json.error && json.error !== 'OK') return { ok: false, error: json.error }
    return { ok: true, data: json.results ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('comicvine:volume', async (_event, apiKey: string, id: number | string) => {
  if (!apiKey || !id) return { ok: false, error: 'Missing API key or volume id' }
  try {
    // Volume ids are prefixed 4050- in ComicVine's canonical URL scheme.
    const url = `${CV_BASE}/volume/4050-${id}/?api_key=${encodeURIComponent(apiKey)}&format=json&field_list=id,name,deck,description,start_year,count_of_issues,publisher,image,person_credits,character_credits`
    const r = await fetch(url, { headers: { 'User-Agent': CV_UA, Accept: 'application/json' } })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { results?: unknown; error?: string }
    if (json.error && json.error !== 'OK') return { ok: false, error: json.error }
    return { ok: true, data: json.results }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// MusicBrainz — open-source music metadata. No API key, but the rate
// limit is 1 request per IP per second and a descriptive User-Agent is
// required. Cover Art Archive (CAA) is the sister service that hosts
// artwork keyed by the MusicBrainz Release MBID.
const MB_UA = 'Omnio/0.1 ( https://github.com/TonyMontania/Omnio )'
const MB_BASE = 'https://musicbrainz.org/ws/2'

// Cheap per-endpoint throttler: never fires two MB requests within 1s.
let mbLastCall = 0
async function mbThrottle(): Promise<void> {
  const wait = 1050 - (Date.now() - mbLastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  mbLastCall = Date.now()
}

ipcMain.handle('mb:search', async (_event, term: string) => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  await mbThrottle()
  try {
    // release-group covers albums/EPs/singles/soundtracks as a unit
    // (versus release, which is one specific pressing / country release).
    const url = `${MB_BASE}/release-group?query=${encodeURIComponent(term.trim())}&limit=15&fmt=json`
    const r = await fetch(url, { headers: { 'User-Agent': MB_UA, Accept: 'application/json' } })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { 'release-groups'?: unknown[] }
    return { ok: true, data: json['release-groups'] ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// Fetches one release (specific pressing) so we can read the tracklist.
// If callers pass a release-group id, we resolve to the first release
// inside it first. `inc` lists what MB should join in the response.
ipcMain.handle('mb:release-group-details', async (_event, releaseGroupId: string) => {
  if (!releaseGroupId) return { ok: false, error: 'Missing release-group id' }
  await mbThrottle()
  try {
    // Step 1: find releases in this group; MB returns them sorted, and the
    // first Official one usually has the standard tracklist.
    const rgUrl = `${MB_BASE}/release?release-group=${encodeURIComponent(releaseGroupId)}&fmt=json&limit=25`
    const rg = await fetch(rgUrl, { headers: { 'User-Agent': MB_UA, Accept: 'application/json' } })
    if (!rg.ok) return { ok: false, error: `HTTP ${rg.status}` }
    const rgJson = await rg.json() as { releases?: { id: string; status?: string; date?: string; 'track-count'?: number }[] }
    const releases = rgJson.releases ?? []
    const chosen = releases.find((r) => r.status === 'Official') ?? releases[0]
    if (!chosen) return { ok: false, error: 'No releases found in group' }

    await mbThrottle()
    const relUrl = `${MB_BASE}/release/${chosen.id}?fmt=json&inc=recordings+artist-credits+labels+release-groups+media`
    const rel = await fetch(relUrl, { headers: { 'User-Agent': MB_UA, Accept: 'application/json' } })
    if (!rel.ok) return { ok: false, error: `HTTP ${rel.status}` }
    return { ok: true, data: await rel.json(), chosenReleaseId: chosen.id, releaseGroupId }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// VGMdb doesn't publish an official API — the community runs
// https://vgmdb.info as a JSON proxy of the site. Free, no key, but
// availability isn't guaranteed. Category coverage: game soundtracks,
// anime OSTs and Japanese releases.
const VGMDB_BASE = 'https://vgmdb.info'

ipcMain.handle('vgmdb:search', async (_event, term: string) => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  try {
    const url = `${VGMDB_BASE}/search/albums/${encodeURIComponent(term.trim())}?format=json`
    const r = await fetch(url)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { results?: { albums?: unknown[] } }
    return { ok: true, data: json.results?.albums ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('vgmdb:album', async (_event, link: string) => {
  // The search results carry a `link` like "album/12345". vgmdb.info
  // resolves those to the details endpoint at the same path.
  if (!link) return { ok: false, error: 'Missing album link' }
  try {
    const url = `${VGMDB_BASE}/${link.replace(/^\/+/, '')}?format=json`
    const r = await fetch(url)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    return { ok: true, data: await r.json() }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// IGDB (Twitch) — the industry-standard games metadata source. Auth is a
// two-step: exchange Client ID + Secret for a bearer token at Twitch's
// OAuth endpoint (60-day expiry), then hit api.igdb.com/v4 with the token
// plus the same Client ID. Token is cached in-memory for the session.

let igdbToken: { access_token: string; expires_at: number } | null = null

async function ensureIgdbToken(clientId: string, clientSecret: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'Missing IGDB Client ID or Secret' }
  if (igdbToken && igdbToken.expires_at > Date.now() + 60_000) {
    return { ok: true, token: igdbToken.access_token }
  }
  try {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`
    const r = await fetch(url, { method: 'POST' })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      igdbToken = null
      return { ok: false, error: `Twitch OAuth HTTP ${r.status}${t ? `: ${t.slice(0, 120)}` : ''}` }
    }
    const j = await r.json() as { access_token: string; expires_in: number }
    igdbToken = { access_token: j.access_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 }
    return { ok: true, token: j.access_token }
  } catch (e) {
    igdbToken = null
    return { ok: false, error: (e as Error).message }
  }
}

// IGDB uses Apicalypse — a SQL-ish body language. The search endpoint alone
// only returns id/name; we ask for the joined fields we care about in a
// single call to avoid a follow-up "details" round-trip like TMDb needs.
const IGDB_FIELDS = [
  'name', 'summary', 'storyline', 'first_release_date',
  'cover.image_id',
  'artworks.image_id', 'screenshots.image_id',
  'involved_companies.company.name',
  'involved_companies.developer', 'involved_companies.publisher',
  'platforms.name', 'genres.name',
  'franchises.name', 'collection.name',
  'alternative_names.name', 'alternative_names.comment',
  // IGDB has been shifting age_rating fields between enums and strings across
  // API versions. Ask for the whole nested object so both shapes reach the
  // renderer and pickAgeRating can pick whichever key exists.
  'age_ratings.*',
  'game_modes.name', 'themes.name',
  'total_rating',
].join(',')

ipcMain.handle('igdb:search', async (_event, clientId: string, clientSecret: string, term: string) => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  const auth = await ensureIgdbToken(clientId, clientSecret)
  if (!auth.ok) return auth
  const safeTerm = term.trim().replace(/"/g, '\\"')
  const body = `search "${safeTerm}"; fields ${IGDB_FIELDS}; limit 12;`
  try {
    const r = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${auth.token}`,
        'Accept': 'application/json',
      },
      body,
    })
    if (!r.ok) return { ok: false, error: `IGDB HTTP ${r.status}` }
    const data = await r.json() as unknown[]
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// TMDb — the standard Movies + TV metadata source. Requires a free v3 API
// key (themoviedb.org/settings/api). Kind is 'movie' or 'tv'.
const TMDB_BASE = 'https://api.themoviedb.org/3'

ipcMain.handle('tmdb:search', async (_event, apiKey: string, term: string, kind: 'movie' | 'tv') => {
  if (!apiKey || !term.trim()) return { ok: false, error: 'Missing API key or search term' }
  try {
    const url = `${TMDB_BASE}/search/${kind}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(term.trim())}&include_adult=false`
    const r = await fetch(url)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { results?: unknown[] }
    return { ok: true, data: json.results ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// Full details include credits (cast+crew) and images. TV details also carry
// each season's number/episode_count/air_date/poster_path so we can build
// the app's Season[] list without a second call.
ipcMain.handle('tmdb:details', async (_event, apiKey: string, kind: 'movie' | 'tv', id: number | string) => {
  if (!apiKey || !id) return { ok: false, error: 'Missing API key or id' }
  try {
    const url = `${TMDB_BASE}/${kind}/${id}?api_key=${encodeURIComponent(apiKey)}&append_to_response=credits,images,external_ids`
    const r = await fetch(url)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    return { ok: true, data: await r.json() }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// AniList — GraphQL, no API key required. Type is 'ANIME' or 'MANGA'.
ipcMain.handle('anilist:search', async (_event, term: string, kind: 'ANIME' | 'MANGA') => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  const query = `
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 12) {
        media(search: $search, type: $type) {
          id
          title { romaji english native }
          format
          status
          episodes
          chapters
          volumes
          duration
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          description(asHtml: false)
          genres
          studios(isMain: true) { nodes { name } }
          staff(perPage: 5) { nodes { name { full } } }
          source
          countryOfOrigin
          coverImage { extraLarge large }
          bannerImage
          synonyms
          averageScore
          siteUrl
        }
      }
    }`
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search: term.trim(), type: kind } }),
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data?: { Page?: { media?: unknown[] } }; errors?: { message: string }[] }
    if (json.errors && json.errors.length) return { ok: false, error: json.errors[0].message }
    return { ok: true, data: json.data?.Page?.media ?? [] }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

// Download a remote image URL and file it into assets/{category}/{kind}/{uuid}.{ext}.
// Same pipeline as image:save (which takes a data-URL from a file picker) — the
// difference is fetching bytes from HTTP first. Used by both metadata fetchers.
const EXT_FROM_URL: Record<string, string> = {
  png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', gif: 'gif', avif: 'avif', bmp: 'bmp', svg: 'svg',
}

ipcMain.handle('image:download', async (_event, url: string, categoryId: string, kind: string) => {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    const buf = Buffer.from(await r.arrayBuffer())
    let ext = EXT_FROM_MIME[ct.split(';')[0].trim()]
    if (!ext) {
      const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
      ext = EXT_FROM_URL[urlExt] ?? 'bin'
    }
    const safeCategory = assetFolderForCategory(categoryId).replace(/[^a-z0-9_-]/gi, '')
    const safeKind = kind.replace(/[^a-z0-9_-]/gi, '')
    const dir = path.join(ASSETS_ROOT, safeCategory, safeKind)
    await fs.mkdir(dir, { recursive: true })
    const filename = `${crypto.randomUUID()}.${ext}`
    await fs.writeFile(path.join(dir, filename), buf)
    return `${safeCategory}/${safeKind}/${filename}`
  } catch {
    return null
  }
})

app.whenReady().then(() => {
  protocol.handle('omnio-asset', (request) => {
    const url = new URL(request.url)
    const rel = decodeURIComponent(url.hostname + url.pathname)
    const resolved = safeRelative(rel)
    if (!resolved) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(resolved).toString())
  })
  createWindow()
})
