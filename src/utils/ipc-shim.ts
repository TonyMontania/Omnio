// Installs `window.ipcRenderer` mimicking the Electron preload API
// while routing every call through Tauri's invoke/listen primitives.
// Lets the ~80 existing IPC call sites work unchanged across both
// hosts. Tauri commands take named args; the positional-to-named
// translation table lives in ipc-tauri-map.ts.

import { CHANNEL_ARG_NAMES, tauriCommandFor } from './ipc-tauri-map'

// `__TAURI_INTERNALS__` is Tauri v2's runtime marker; Electron doesn't set it.
export function isTauriHost(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Cached at shim install so assetSrc() can build fetchable URLs
// without waiting for a round-trip on every image.
let tauriAssetsRoot: string | null = null

export function getTauriAssetsRoot(): string | null {
  return tauriAssetsRoot
}

let convertFileSrcFn: ((p: string) => string) | null = null

export function convertFileSrc(absolutePath: string): string | null {
  return convertFileSrcFn ? convertFileSrcFn(absolutePath) : null
}

// Dynamic import so the Electron build never bundles Tauri packages.
async function loadTauri() {
  const [core, eventMod] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ])
  return { invoke: core.invoke, listen: eventMod.listen, convertFileSrc: core.convertFileSrc }
}

// Tracks handler → unlisten association so Electron-shaped
// `.off(channel, handler)` can find its Tauri unlisten fn.
type UnlistenFn = () => void
type Listener = (event: unknown, ...args: unknown[]) => void

function positionalToNamed(channel: string, args: unknown[]): Record<string, unknown> {
  const names = CHANNEL_ARG_NAMES[channel]
  if (!names) {
    console.warn(`[ipc-shim] no arg-name map for channel "${channel}" — sending empty payload`)
    return {}
  }
  const payload: Record<string, unknown> = {}
  for (let i = 0; i < names.length; i++) {
    if (args[i] !== undefined) payload[names[i]] = args[i]
  }
  return payload
}

// Idempotent installer. Under Electron: no-op (preload owns the global).
// Under Tauri: installs the routing shim. Under a plain browser (vite
// preview, jsdom): installs the localStorage fallback so boot succeeds.
export async function installIpcShim(): Promise<void> {
  if (!isTauriHost()) {
    if (!(window as Window & { ipcRenderer?: unknown }).ipcRenderer) {
      installBrowserFallback()
    }
    return
  }
  if ((window as Window & { ipcRenderer?: unknown }).ipcRenderer) return

  const tauri = await loadTauri()
  const listeners = new WeakMap<Listener, Promise<UnlistenFn>>()

  convertFileSrcFn = tauri.convertFileSrc
  try {
    const storageRoot = await tauri.invoke<string>('storage_root', {})
    if (storageRoot) {
      // convertFileSrc percent-encodes the whole path so the OS-native
      // separator can stay as-is.
      const sep = storageRoot.includes('\\') ? '\\' : '/'
      tauriAssetsRoot = `${storageRoot}${sep}assets`
    }
  } catch (e) {
    console.warn('[ipc-shim] could not resolve Tauri storage root — asset URLs will fall back to omnio-asset://', e)
  }

  const shim: Window['ipcRenderer'] = {
    invoke(channel: string, ...args: unknown[]) {
      const command = tauriCommandFor(channel)
      const payload = positionalToNamed(channel, args)
      return tauri.invoke(command, payload)
    },
    on(channel: string, listener: Listener) {
      // Electron listeners receive `(event, ...args)`; Tauri emits
      // `{ event, payload }`. Bridge: synthetic null event + payload.
      const promise = tauri.listen(channel, (event) => {
        listener(null, event.payload)
      })
      listeners.set(listener, promise)
    },
    off(channel: string, ...args: unknown[]) {
      void channel
      // Only per-handler cleanup — Tauri's listen returns an unlisten
      // scoped to a single call. `.off(channel)` without a handler
      // (unbind-all in Electron) has no Tauri equivalent.
      const listener = args[0] as Listener | undefined
      if (!listener) return
      const promise = listeners.get(listener)
      if (!promise) return
      listeners.delete(listener)
      promise.then((unlisten) => unlisten()).catch(() => { /* absent = fine */ })
    },
    send(channel: string, ...args: unknown[]) {
      // Electron's fire-and-forget IPC has no Tauri equivalent (commands
      // always return). Only used for dev channels Rust never emits, so
      // dropping is safe.
      void channel; void args
    },
  }

  ;(window as Window & { ipcRenderer: Window['ipcRenderer'] }).ipcRenderer = shim
}

// Browser fallback — reachable outside Tauri/Electron (vite preview,
// jsdom). Keeps a minimal library in localStorage so the app boots.

const BROWSER_STORE_KEY = 'omnio-browser-store'

function readBrowserStore(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(BROWSER_STORE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {}
  } catch { return {} }
}
function writeBrowserStore(next: Record<string, unknown>): void {
  try { localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(next)) }
  catch { /* quota exceeded — silent */ }
}

function browserRoute(channel: string, args: unknown[]): unknown {
  const store = readBrowserStore()
  switch (channel) {
    case 'data:load':
      return {
        items: (store.items as unknown[]) ?? [],
        collections: (store.collections as unknown[]) ?? [],
        settings: (store.settings as unknown) ?? {},
        artists: (store.artists as unknown[]) ?? [],
        arcadeGames: (store.arcadeGames as unknown[]) ?? [],
      }
    case 'data:save': {
      const payload = args[0] as Record<string, unknown> | undefined
      if (payload && typeof payload === 'object') writeBrowserStore(payload)
      return true
    }
    case 'data:list-backups':
      return []
    case 'storage:root':
      return 'browser://localStorage'
    case 'updates:check':
      return { ok: true, hasUpdate: false }
    case 'plugin:data-load': {
      const slug = args[0] as string
      return (store[`plugin:${slug}`] as unknown) ?? null
    }
    case 'plugin:data-save': {
      const slug = args[0] as string
      const data = args[1] as unknown
      const next = { ...store }
      next[`plugin:${slug}`] = data
      writeBrowserStore(next)
      return { ok: true }
    }
    default:
      // Rust-only commands return a shaped "not available" reply so
      // the UI can render an error instead of crashing on undefined.
      return { ok: false, error: 'not available in browser mode' }
  }
}

function installBrowserFallback(): void {
  const shim: Window['ipcRenderer'] = {
    invoke(channel: string, ...args: unknown[]) {
      return Promise.resolve(browserRoute(channel, args))
    },
    on() {},
    off() {},
    send() {},
  }
  ;(window as Window & { ipcRenderer: Window['ipcRenderer'] }).ipcRenderer = shim
}
