// Thin wrappers around the generic `plugin:*` IPC commands. Everything
// is keyed by the Eroges slug — no other plugin sees these files.
//
// The `window.omnio.invoke` shim is the same one Omnio's built-in
// libraries use (see src/utils/ipc-shim.ts + ipc-tauri-map.ts).

import { SLUG } from './constants'
import type { ErogeData, ErogeItem } from './types'

// Under Tauri, src/utils/ipc-shim.ts installs `window.ipcRenderer`.
// Under Electron the same global is provided by preload.
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const bridge = (window as unknown as { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer
  if (!bridge) return Promise.reject(new Error('ipcRenderer missing'))
  return bridge.invoke(channel, ...args) as Promise<T>
}

// ---- data ------------------------------------------------------

export async function loadData(): Promise<ErogeData> {
  const raw = await invoke<ErogeData | null>('plugin:data-load', SLUG)
  if (!raw || !Array.isArray(raw.games)) return { games: [] }
  const games = raw.games.map((g) => {
    const rest: ErogeItem & { collectionIds?: unknown } = { ...g }
    delete rest.collectionIds
    return rest as ErogeItem
  })
  return { games, settings: raw.settings ?? {} }
}

export async function saveData(data: ErogeData): Promise<void> {
  // Surface silent backend failures (bad slug, disk full, permissions
  // errors on the portable folder…) so the settings modal can react
  // instead of pretending the write happened.
  const res = await invoke<{ ok: boolean; error?: string } | null>('plugin:data-save', SLUG, data)
  if (res && res.ok === false) throw new Error(res.error || 'plugin:data-save failed')
}

// ---- assets ----------------------------------------------------

export type AssetResult = { ok: true; filename: string } | { ok: false; error: string }

interface RawErr { ok: false; error: string }

function toAssetResult(v: unknown): AssetResult {
  if (typeof v === 'string') return { ok: true, filename: v }
  if (v && typeof v === 'object' && (v as RawErr).ok === false) return { ok: false, error: (v as RawErr).error }
  return { ok: false, error: 'unknown' }
}

const isAvif = (s: string): boolean => /\.avif$/i.test(s) || /^data:image\/avif/i.test(s)

// F95's CDN only serves AVIF. Re-encode through the webview's own decoder
// to JPEG (PNG when the image has transparency). null = keep the original.
export async function avifDataUrlToStandard(dataUrl: string): Promise<string | null> {
  try {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !canvas.width || !canvas.height) return null
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let hasAlpha = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) { hasAlpha = true; break }
    }
    return hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

export async function transcodeStoredAvif(kind: string, filename: string): Promise<AssetResult> {
  const keep: AssetResult = { ok: true, filename }
  const src = await invoke<string | RawErr>('plugin:asset-read-data-url', SLUG, kind, filename)
  if (typeof src !== 'string') return keep
  const converted = await avifDataUrlToStandard(src)
  if (!converted) return keep
  const saved = await saveDataUrlRaw(kind, converted, filename.replace(/\.avif$/i, ''))
  return saved.ok ? saved : keep
}

export async function assetDownload(kind: string, url: string, basename: string, referer?: string, cookie?: string): Promise<AssetResult> {
  const res = toAssetResult(await invoke('plugin:asset-download', SLUG, kind, url, basename, referer, cookie))
  if (!res.ok || !isAvif(res.filename)) return res
  return transcodeStoredAvif(kind, res.filename)
}
async function saveDataUrlRaw(kind: string, dataUrl: string, basename: string): Promise<AssetResult> {
  return toAssetResult(await invoke('plugin:asset-save-data-url', SLUG, kind, dataUrl, basename))
}
export async function assetSaveDataUrl(kind: string, dataUrl: string, basename: string): Promise<AssetResult> {
  const input = isAvif(dataUrl) ? (await avifDataUrlToStandard(dataUrl)) ?? dataUrl : dataUrl
  return saveDataUrlRaw(kind, input, basename)
}
export async function assetSaveFromFile(kind: string, sourcePath: string, basename: string): Promise<AssetResult> {
  return toAssetResult(await invoke('plugin:asset-save-from-file', SLUG, kind, sourcePath, basename))
}
export async function assetDelete(kind: string, basename: string): Promise<boolean> {
  return !!(await invoke('plugin:asset-delete', SLUG, kind, basename))
}
export async function assetRename(kind: string, oldBase: string, newBase: string): Promise<string | null> {
  const v = await invoke<string | null>('plugin:asset-rename', SLUG, kind, oldBase, newBase)
  return typeof v === 'string' ? v : null
}

// URL for <img>. Delegates to Omnio's `assetSrc` helper, which under
// Tauri v2 uses `convertFileSrc` to produce a `http://asset.localhost/…`
// URL served by Tauri's built-in asset protocol (the custom
// `omnio-asset://` scheme is not reachable from the webview there —
// only the Electron build serves it). On-disk layout:
// `assets/plugins/<slug>/<kind>/<file>`.
import { assetSrc } from '../../types/helpers'
export function assetUrl(kind: string, filename: string): string | undefined {
  return assetSrc(`plugins/${SLUG}/${kind}/${filename}`)
}

// ---- saves -----------------------------------------------------

export interface SaveInfo { name: string; size: number; mtime: number }

export async function savesList(gameName: string): Promise<SaveInfo[]> {
  const v = await invoke<SaveInfo[]>('plugin:saves-list', SLUG, gameName)
  return Array.isArray(v) ? v : []
}
export async function savesAdd(gameName: string): Promise<string[]> {
  const v = await invoke<{ ok: boolean; added?: string[]; canceled?: boolean }>('plugin:saves-add', SLUG, gameName)
  return v && Array.isArray(v.added) ? v.added : []
}
export async function savesDelete(gameName: string, fileName: string): Promise<boolean> {
  return !!(await invoke('plugin:saves-delete', SLUG, gameName, fileName))
}
export async function savesOpenFolder(gameName: string): Promise<boolean> {
  return !!(await invoke('plugin:saves-open-folder', SLUG, gameName))
}
export async function savesReveal(gameName: string, fileName: string): Promise<boolean> {
  return !!(await invoke('plugin:saves-reveal', SLUG, gameName, fileName))
}
export async function savesRenameFolder(oldName: string, newName: string): Promise<boolean> {
  return !!(await invoke('plugin:saves-rename-folder', SLUG, oldName, newName))
}
export async function savesDeleteAll(gameName: string): Promise<boolean> {
  return !!(await invoke('plugin:saves-delete-all', SLUG, gameName))
}

// ---- generic HTTP ----------------------------------------------

export async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const v = await invoke<string | { ok: false; error: string }>('net:fetch-text', url, headers)
  if (typeof v === 'string') return v
  throw new Error((v && (v as { error?: string }).error) || 'fetch failed')
}
