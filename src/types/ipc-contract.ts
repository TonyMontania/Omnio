// Typed IPC contract. This file is the single source of truth for
// every channel the renderer can invoke and every response the Rust
// backend returns. The renderer helper (`invoke` in
// `src/utils/ipc.ts`) refuses to compile if a caller passes the
// wrong argument shape or reads the wrong field off the return
// value. The Tauri shim (`src/utils/ipc-shim.ts`) uses the
// per-channel arg-name table (`src/utils/ipc-tauri-map.ts`) to route
// each positional invoke into a named Tauri command call.
//
// Adding a new channel = one entry here + one row in the arg-name
// map + one `#[tauri::command]` in the corresponding
// `src-tauri/src/handlers/*.rs` module + one line in the
// `.invoke_handler(...)` list in `src-tauri/src/main.rs`.
//
// Naming convention: renderer uses `namespace:kebab-case`
// (`data:save`, `asset-blob:save`), the shim translates to
// `snake_case` (`data_save`, `asset_blob_save`) for the Rust side.

// ---------------------------------------------------------------------
// Common return-shape helpers
// ---------------------------------------------------------------------

// Every fetcher / write handler returns this envelope. Callers
// pattern-match on `.ok` before touching `.data` or `.error`.
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string }

// Some ops report success without any payload (delete, apply, clear).
// A separate alias keeps the intent obvious at the call site.
export type SimpleResult = { ok: true } | { ok: false; error: string }

// A handful of legacy handlers respond with `true`/`false` booleans
// instead of the envelope — kept as-is for backwards compat since
// the renderer is used to reading them that way.
export type BoolResult = boolean

// ---------------------------------------------------------------------
// Per-channel response shapes.
//
// These are the "public" shapes — anything the renderer reads off the
// return value of an invoke() call. Kept as loose as the caller needs
// (many use `unknown` for nested payload because a proper strict type
// belongs to the domain module, not the IPC contract).
// ---------------------------------------------------------------------

export interface UpdateAssetRow { name: string; url: string; size: number }
export type UpdatesCheckResult =
  | { ok: false; error: string }
  | {
      ok: true
      hasUpdate: boolean
      current: string
      latest: string
      htmlUrl?: string
      publishedAt?: string
      notes?: string
      assets?: UpdateAssetRow[]
    }
export interface UpdatesInstallKind {
  kind: string
  assetHint: string
  platform: string
  arch: string
}
export type UpdatesDownloadResult =
  | { ok: true; path: string; size: number }
  | { ok: false; error: string }

export type ItemExportResult =
  | { ok: true; path: string }
  | { ok: false; canceled?: boolean; error?: string }

export interface ImageSaveResult { path: string }
export type ImageDownloadResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export interface AssetBlobEntry {
  id: string
  filename: string
  path: string
  size: number
  addedAt: string
}
export type AssetBlobSaveResult =
  | { ok: true; entry: AssetBlobEntry }
  | { ok: false; error: string }

export interface DataSaveResult {
  ok: true
  rewrites: { from: string; to: string }[]
}

// `data:load` returns the raw split payload. The renderer's own
// AppData type is stricter; here we stay at `Record<string, unknown>`
// because the contract owns the wire shape only.
export type DataLoadResult = Record<string, unknown> | null

export interface BackupRow { file: string; mtime: number; size: number }

export interface BrokenAssetRow {
  itemId: string
  itemTitle: string
  category: string
  field: string
  rel: string
}
export interface AuditBrokenAssetsResult {
  ok: true
  broken: BrokenAssetRow[]
}
export interface ClearAssetRefsResult {
  ok: boolean
  cleared: number
  errors: string[]
}

export type StorageCopyDataToResult =
  | { ok: true; path: string; files: number }
  | { ok: false; error: string }
export interface StorageCleanOrphanResult {
  ok: true
  removed: number
  bytes: number
  referenced: number
  scanned: number
}
export type StorageRenameAllResult =
  | { ok: true; renamed: number; rewrites: { from: string; to: string }[] }
  | { ok: false; error: string }
export type StorageImportAssetsResult =
  | { ok: true; copied: number }
  | { ok: false; error: string }
export interface StorageCleanupArtifactsResult { removed: number; bytes: number }

export type SteamLibraryResult = { ok: true; xml: string } | { ok: false; error: string }

// Fetcher payloads are typed loosely — each fetcher component knows its
// own hit shape and can safely narrow the `unknown[]` it gets back.
// Keeping the contract at `unknown` avoids duplicating VnHit / IgdbHit
// / TmdbHit definitions here just for the wire.
export type FetcherHitsEnvelope = Envelope<unknown[]>
export type FetcherObjectEnvelope = Envelope<Record<string, unknown>>

export type LrclibResult = Envelope<{ lyrics: string; synced: boolean }>
export type AnidbResult = Envelope<string>
export type PcgwSearchResult = Envelope<{ title: string; url: string }[]>
export interface PcgwSavePathsPayload {
  pageName: string
  pageUrl: string
  rows: { OS: string; Type: string; Location: string }[]
}
export type PcgwSavePathsResult = Envelope<PcgwSavePathsPayload>

export type DiscogsCollectionResult = Envelope<{
  releases: unknown[]
  truncated: boolean
  totalPages: number
}>

// ---------------------------------------------------------------------
// The contract itself.
//
// Each entry: `channel: { args: [...tuple], result: T }`. The tuple
// preserves argument order and per-position names so calls read
// naturally. `result` is what the promise resolves to.
//
// Grouped by handler file (src-tauri/src/handlers/*.rs) so the contract
// mirrors the runtime split. Adding a handler = adding an entry in
// the right group here.
// ---------------------------------------------------------------------

export type IpcContract = {
  // -- handlers/system.ts --
  'proxy:apply':
    { args: [url: string | undefined | null]; result: SimpleResult }
  'cache:clear-searches':
    { args: []; result: { ok: true } }
  'item:export-json':
    { args: [item: Record<string, unknown>, suggestedName: string]; result: ItemExportResult }
  'dialog:pick-directory':
    { args: [title?: string]; result: string | null }
  'export:site':
    { args: [targetDir: string, htmlContent: string]; result: { ok: true; path: string } | { ok: false; error: string } }
  'export:csv':
    { args: [targetDir: string, files: Record<string, string>]; result: { ok: true; path: string; count: number } | { ok: false; error: string } }
  'library:export-text':
    { args: [body: string, suggestedName: string, filterLabel: string, extension: string]; result: ItemExportResult }
  'library:save-text-to':
    { args: [targetPath: string, body: string, overwrite: boolean]; result: ItemExportResult }
  'system:reveal':
    { args: [path: string]; result: SimpleResult }
  'fs:list-dir':
    { args: [path: string, includeHidden: boolean]; result: { ok: true; entries: { name: string; isDir: boolean; size: number }[] } | { ok: false; error: string } }
  'fs:common-locations':
    { args: []; result: { name: string; path: string }[] }
  'fs:path-info':
    { args: [path: string]; result: { exists: boolean; isDir: boolean; canonical: string; parent: string | null } }
  'fs:mkdir':
    { args: [path: string]; result: SimpleResult }

  // -- handlers/updates.ts --
  'updates:check':
    { args: [currentVersion: string]; result: UpdatesCheckResult }
  'updates:open-url':
    { args: [url: string]; result: BoolResult }
  'updates:install-kind':
    { args: []; result: UpdatesInstallKind }
  'updates:download':
    { args: [url: string, filename: string]; result: UpdatesDownloadResult }
  'updates:reveal':
    { args: [filePath: string]; result: BoolResult }
  'updates:launch-installer':
    { args: [filePath: string]; result: BoolResult }
  'updates:appimage-swap':
    { args: [newPath: string]; result: SimpleResult }
  'updates:open-dmg':
    { args: [filePath: string]; result: BoolResult }

  // -- handlers/images.ts --
  'image:save':
    { args: [categoryId: string, kind: string, dataUrl: string, basename?: string]; result: string | null }
  'image:delete':
    { args: [rel: string]; result: BoolResult }
  'image:download':
    { args: [url: string, categoryId: string, kind: string, basename?: string]; result: ImageDownloadResult }
  'asset-blob:save':
    { args: [kind: string, categoryId: string, title: string, filename: string, data: ArrayBuffer | Uint8Array]; result: AssetBlobSaveResult }
  'asset-blob:delete':
    { args: [rel: string]; result: BoolResult }
  'asset-blob:reveal':
    { args: [rel: string]; result: BoolResult }
  'storage:audit-broken-assets':
    { args: []; result: AuditBrokenAssetsResult }
  'storage:clear-asset-ref':
    { args: [itemId: string, field: string, source: string]; result: SimpleResult }
  'storage:clear-asset-refs':
    { args: [refs: { itemId: string; field: string; source: string }[]]; result: ClearAssetRefsResult }

  // -- handlers/data.ts --
  'data:save':
    { args: [data: Record<string, unknown>]; result: DataSaveResult }
  'data:load':
    { args: []; result: DataLoadResult }
  'data:list-backups':
    { args: []; result: BackupRow[] }
  'data:restore-backup':
    { args: [name: string]; result: BoolResult }

  // -- handlers/storage.ts --
  'storage:root':
    { args: []; result: string }
  'storage:copy-data-to':
    { args: [targetDir: string]; result: StorageCopyDataToResult }
  'storage:clean-orphan-assets':
    { args: []; result: StorageCleanOrphanResult | { ok: false; error: string } }
  'storage:rename-all-assets':
    { args: []; result: StorageRenameAllResult }
  'storage:import-assets-from':
    { args: [sourceAssetsDir: string]; result: StorageImportAssetsResult }
  'storage:cleanup-migration-artifacts':
    { args: []; result: StorageCleanupArtifactsResult }

  // -- handlers/fetchers.ts (17 sources, 28 channels) --
  'sgdb:search':
    { args: [apiKey: string, term: string]; result: FetcherHitsEnvelope }
  'sgdb:assets':
    { args: [apiKey: string, kind: 'grids' | 'heroes' | 'logos', gameId: number | string]; result: FetcherHitsEnvelope }
  'jikan:search':
    { args: [term: string, kind: 'anime' | 'manga']; result: FetcherHitsEnvelope }
  'kitsu:search':
    { args: [term: string, kind: 'anime' | 'manga']; result: FetcherHitsEnvelope }
  'mangadex:search':
    { args: [term: string]; result: FetcherHitsEnvelope }
  'mangadex:covers':
    { args: [mangaId: string]; result: FetcherHitsEnvelope }
  'comicvine:search':
    { args: [apiKey: string, term: string]; result: FetcherHitsEnvelope }
  'comicvine:volume':
    { args: [apiKey: string, id: number | string]; result: FetcherObjectEnvelope }
  'mb:search':
    { args: [term: string]; result: FetcherHitsEnvelope }
  'mb:release-group-details':
    { args: [releaseGroupId: string]; result: Envelope<Record<string, unknown>> & { chosenReleaseId?: string; releaseGroupId?: string } }
  'vgmdb:search':
    { args: [term: string]; result: FetcherHitsEnvelope }
  'vgmdb:album':
    { args: [link: string]; result: FetcherObjectEnvelope }
  'igdb:search':
    { args: [clientId: string, clientSecret: string, term: string]; result: FetcherHitsEnvelope }
  'tmdb:search':
    { args: [apiKey: string, term: string, kind: 'movie' | 'tv']; result: FetcherHitsEnvelope }
  'tmdb:details':
    { args: [apiKey: string, kind: 'movie' | 'tv', id: number | string]; result: FetcherObjectEnvelope }
  'anilist:search':
    { args: [term: string, kind: 'ANIME' | 'MANGA']; result: FetcherHitsEnvelope }
  'steam:library':
    { args: [profileInput: string]; result: SteamLibraryResult }
  'openlibrary:search':
    { args: [term: string]; result: FetcherHitsEnvelope }
  'openlibrary:work':
    { args: [workKey: string]; result: FetcherObjectEnvelope }
  'vndb:search':
    { args: [term: string]; result: FetcherHitsEnvelope }
  'vndb:detail':
    { args: [id: string]; result: FetcherHitsEnvelope }
  'vndb:characters':
    { args: [vnId: string]; result: FetcherHitsEnvelope }
  'vndb:releases':
    { args: [vnId: string]; result: FetcherHitsEnvelope }
  'discogs:collection':
    { args: [username: string, token?: string]; result: DiscogsCollectionResult }
  'lrclib:track':
    { args: [trackName: string, artistName: string, albumName?: string]; result: LrclibResult }
  'anidb:anime':
    { args: [client: string, aid: string | number]; result: AnidbResult }
  'pcgw:search':
    { args: [term: string]; result: PcgwSearchResult }
  'pcgw:save-paths':
    { args: [pageName: string]; result: PcgwSavePathsResult }
}

// Helpers for callers who need to name the args / result of a channel.
export type IpcChannel = keyof IpcContract
export type IpcArgs<K extends IpcChannel> = IpcContract[K]['args']
export type IpcResult<K extends IpcChannel> = IpcContract[K]['result']
