// Single source of truth for every IPC channel's args and return shape.
// Adding a channel needs an entry here plus a row in ipc-tauri-map.ts,
// a #[tauri::command] under src-tauri/src/handlers/, and a line in
// main.rs's `.invoke_handler(...)` list. Renderer uses `ns:kebab-case`;
// the shim translates to `snake_case` for the Rust side.

// Standard fetcher / write handler envelope.
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string }

// Success without a payload (delete / apply / clear).
export type SimpleResult = { ok: true } | { ok: false; error: string }

// Legacy handlers that return a bare boolean rather than the envelope.
export type BoolResult = boolean

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

// The renderer narrows to AppData at the call site.
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

// Fetcher payloads stay loose (`unknown[]`) so per-source hit shapes
// live in the fetcher components rather than being duplicated here.
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

// Contract table. Grouped by handler module. Each entry:
// `channel: { args: [...tuple], result: T }`.

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
  'fs:read-text-file':
    { args: [path: string]; result: { ok: true; text: string } | { ok: false; error: string } }

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

  // -- handlers/fetchers.ts --
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
  'mb:release-group-releases':
    { args: [releaseGroupId: string]; result: FetcherHitsEnvelope }
  'mb:release-group-details':
    { args: [releaseGroupId: string, releaseId?: string]; result: Envelope<Record<string, unknown>> & { chosenReleaseId?: string; releaseGroupId?: string } }
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
  'anidb:download-titles':
    { args: []; result: { ok: true; data: { count: number; path: string } } | { ok: false; error: string } }
  'anidb:search-titles':
    { args: [query: string, limit: number]; result: { ok: true; data: { aid: string; mainTitle: string; altTitles: string[]; score: number }[] } | { ok: false; error: string } }
  'pcgw:search':
    { args: [term: string]; result: PcgwSearchResult }
  'pcgw:save-paths':
    { args: [pageName: string]; result: PcgwSavePathsResult }
  'hltb:search':
    { args: [term: string]; result: FetcherObjectEnvelope }
  'lastfm:top_albums':
    { args: [apiKey: string, username: string, limit: number, period: string]; result: FetcherObjectEnvelope }
  'lastfm:album_info':
    { args: [apiKey: string, username: string, artist: string, album: string]; result: FetcherObjectEnvelope }
}

// Helpers for narrowing to a single channel's arg / result types.
export type IpcChannel = keyof IpcContract
export type IpcArgs<K extends IpcChannel> = IpcContract[K]['args']
export type IpcResult<K extends IpcChannel> = IpcContract[K]['result']
