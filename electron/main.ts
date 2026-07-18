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

// Keep the last N snapshots of data.json rotated next to it. Cheap
// insurance against corruption, buggy edits, or accidental resets — the
// user can copy `data.backup-1.json` over `data.json` and be back where
// they were on their previous save.
const BACKUP_COUNT = 5

async function rotateBackups(): Promise<void> {
  const dir = path.dirname(DATA_FILE)
  const backupPath = (n: number) => path.join(dir, `data.backup-${n}.json`)
  // backup-(N-1) → backup-N, dropping the oldest.
  for (let i = BACKUP_COUNT; i > 1; i--) {
    try { await fs.rename(backupPath(i - 1), backupPath(i)) } catch { /* absent is fine */ }
  }
  // current data.json → backup-1 (skip if there's no current file yet).
  try { await fs.copyFile(DATA_FILE, backupPath(1)) } catch { /* first-ever save */ }
}

ipcMain.handle('data:save', async (_event, data: unknown) => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await rotateBackups()
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

ipcMain.handle('data:list-backups', async () => {
  const dir = path.dirname(DATA_FILE)
  const results: { file: string; mtime: number; size: number }[] = []
  for (let i = 1; i <= BACKUP_COUNT; i++) {
    const p = path.join(dir, `data.backup-${i}.json`)
    try {
      const st = await fs.stat(p)
      results.push({ file: `data.backup-${i}.json`, mtime: st.mtimeMs, size: st.size })
    } catch { /* missing backup slot */ }
  }
  return results
})

ipcMain.handle('data:restore-backup', async (_event, filename: string) => {
  if (!/^data\.backup-[1-5]\.json$/.test(filename)) return false
  const src = path.join(path.dirname(DATA_FILE), filename)
  try {
    await fs.copyFile(DATA_FILE, path.join(path.dirname(DATA_FILE), `data.pre-restore.json`))
  } catch { /* no current file, nothing to preserve */ }
  await fs.copyFile(src, DATA_FILE)
  return true
})

ipcMain.handle('data:load', async () => {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
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
