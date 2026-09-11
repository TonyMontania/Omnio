// Tauri IPC shim — installed at renderer boot when running under
// Tauri, no-op under Electron.
//
// The shim exposes a `window.ipcRenderer` that mimics the Electron
// preload API (`.invoke`, `.on`, `.off`, `.send`) but routes every
// call through Tauri's `invoke` + `listen` primitives. That means the
// 81+ call sites already scattered across App.tsx / files.ts / etc.
// keep working verbatim — no touch, no migration, no dual-import mess.
//
//   Electron: window.ipcRenderer is provided by preload.ts
//   Tauri:    window.ipcRenderer is provided by this shim
//
// One extra job: Tauri's command args are named (`{ arg1: value1 }`)
// while Electron sends them positionally (`invoke(channel, a, b)`).
// The `CHANNEL_ARG_NAMES` table (see ipc-tauri-map.ts) supplies the
// order-preserving mapping so `invoke('data:save', payload)` becomes
// `tauriInvoke('data_save', { data: payload })`.

import { CHANNEL_ARG_NAMES, tauriCommandFor } from './ipc-tauri-map'

// Skip the shim when the renderer is served by Electron. `__TAURI_INTERNALS__`
// is the Tauri v2 marker; Electron leaves it undefined.
export function isTauriHost(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Cached absolute path to the `assets/` folder under the Tauri storage
// root. Populated at shim install time by a synchronous `storage:root`
// round-trip. `assetSrc()` in types/helpers.ts reads this to decide
// whether to build an `omnio-asset://` URL (Electron path) or a
// converted `http://asset.localhost/<abs>` URL (Tauri path via the
// built-in asset protocol).
let tauriAssetsRoot: string | null = null

export function getTauriAssetsRoot(): string | null {
  return tauriAssetsRoot
}

// Re-exported so consumers don't have to depend on `@tauri-apps/api/core`
// directly. On Windows it becomes `http://asset.localhost/<encoded>`;
// on macOS it becomes `asset://localhost/<encoded>`. Either way, the
// webview will fetch the file the built-in asset protocol serves.
let convertFileSrcFn: ((p: string) => string) | null = null

export function convertFileSrc(absolutePath: string): string | null {
  return convertFileSrcFn ? convertFileSrcFn(absolutePath) : null
}

// Dynamic import so the Electron build never pulls the Tauri npm
// packages into its bundle. Vite tree-shakes the import when the
// branch below is dead-code-eliminated.
async function loadTauri() {
  const [core, eventMod] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ])
  return { invoke: core.invoke, listen: eventMod.listen, convertFileSrc: core.convertFileSrc }
}

// Handler → Tauri UnlistenFn map. Electron's `.on(channel, handler)`
// pairs with `.off(channel, handler)` and identifies by handler
// reference; Tauri's `listen()` returns an unlisten fn. We track the
// association so `.off()` can find the right unlisten.
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

/**
 * Install the shim. Idempotent — calling twice is a no-op.
 * Under Electron this returns without touching `window.ipcRenderer`.
 * Under Tauri it replaces the (missing) global with a router.
 * Under a plain browser (e.g. `vite preview` or a jsdom test) it
 * installs a fallback shim so the app still boots.
 */
export async function installIpcShim(): Promise<void> {
  if (!isTauriHost()) {
    // Electron already provides `window.ipcRenderer` via preload —
    // don't touch it. Otherwise install the browser fallback so the
    // renderer isn't stranded without a shim.
    if (!(window as Window & { ipcRenderer?: unknown }).ipcRenderer) {
      installBrowserFallback()
    }
    return
  }
  // If preload happened to define one anyway, respect it (dev cross-
  // configuration guard). The shim is opt-in — Tauri host + no
  // existing global.
  if ((window as Window & { ipcRenderer?: unknown }).ipcRenderer) return

  const tauri = await loadTauri()
  const listeners = new WeakMap<Listener, Promise<UnlistenFn>>()

  // Populate the assets-root cache so `assetSrc()` in types/helpers.ts
  // can turn stored relative paths (`games/cover/x.jpg`) into fetchable
  // URLs via Tauri's asset protocol. Best-effort — if storage:root
  // fails for any reason we fall back to the omnio-asset:// URL which
  // returns 404 under Tauri but at least keeps the JS side sane.
  convertFileSrcFn = tauri.convertFileSrc
  try {
    const storageRoot = await tauri.invoke<string>('storage_root', {})
    if (storageRoot) {
      // Windows uses backslashes; keep as-is because convertFileSrc
      // percent-encodes the whole thing.
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
      // Tauri events fire with `{ event, payload, id }`; Electron
      // listeners receive `(event, ...args)`. Bridge: pass a synthetic
      // `null` event object (renderers never inspect it here) and the
      // payload as the second arg. Matches the shape App.tsx uses:
      // `handler(_ev, { received, total })` for updates:progress.
      const promise = tauri.listen(channel, (event) => {
        listener(null, event.payload)
      })
      listeners.set(listener, promise)
    },
    off(channel: string, ...args: unknown[]) {
      void channel
      // Electron API: `.off(channel, listener)` unbinds one handler.
      // Some callers pass `.off(channel)` to remove all — Tauri only
      // supports per-handler cleanup, so single-handler mode is what
      // we cover. Any listener passed here that isn't tracked was
      // already off (or a channel-only call) — no-op is safe.
      const listener = args[0] as Listener | undefined
      if (!listener) return
      const promise = listeners.get(listener)
      if (!promise) return
      listeners.delete(listener)
      promise.then((unlisten) => unlisten()).catch(() => { /* absent = fine */ })
    },
    send(channel: string, ...args: unknown[]) {
      // Electron's fire-and-forget IPC. The Rust side doesn't have an
      // equivalent (every command returns something); the closest
      // mapping is a discarded invoke. In practice App.tsx uses
      // `send()` only for the dev main-process-message channel which
      // Rust doesn't emit, so ignoring here is fine.
      void channel; void args
    },
  }

  ;(window as Window & { ipcRenderer: Window['ipcRenderer'] }).ipcRenderer = shim
}

// -----------------------------------------------------------------
// Browser fallback shim
// -----------------------------------------------------------------
// Only reachable outside Tauri/Electron — e.g. `vite preview` or a
// jsdom test. Keeps a minimal library in localStorage so the app
// boots and returns "not available" for Rust-only commands.

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
    // Plugin sandbox — read/write our own scoped slot per slug.
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
    // Anything Rust-only (backup, git, install-scan, image blob io,
    // f95 fetch, MB search, …) — return a shaped "not available"
    // reply so the UI can render its own error without crashing.
    default:
      return { ok: false, error: 'not available in browser mode' }
  }
}

function installBrowserFallback(): void {
  const shim: Window['ipcRenderer'] = {
    invoke(channel: string, ...args: unknown[]) {
      return Promise.resolve(browserRoute(channel, args))
    },
    on() { /* no events in browser mode */ },
    off() { /* no events */ },
    send() { /* fire-and-forget no-op */ },
  }
  ;(window as Window & { ipcRenderer: Window['ipcRenderer'] }).ipcRenderer = shim
}
