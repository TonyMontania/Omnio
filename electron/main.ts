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

async function readSplitData(): Promise<Record<string, unknown> | null> {
  if (!await fileExists(DATA_DIR)) return null
  const items: unknown[] = []
  for (const cat of CATEGORY_IDS) {
    const p = path.join(DATA_DIR, `${cat}.json`)
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
        path: path.join(DATA_DIR, `${cat}.json`),
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
  const safeCategory = categoryId.replace(/[^a-z0-9_-]/gi, '')
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
ipcMain.handle('jikan:search', async (_event, term: string, kind: 'anime' | 'manga') => {
  if (!term.trim()) return { ok: false, error: 'Missing search term' }
  try {
    const url = `https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(term.trim())}&limit=12&sfw=false`
    const r = await fetch(url)
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const json = await r.json() as { data?: unknown[] }
    return { ok: true, data: json.data ?? [] }
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
    const safeCategory = categoryId.replace(/[^a-z0-9_-]/gi, '')
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
