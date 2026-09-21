// Channel → ordered arg-name list. Powers the Tauri IPC shim:
// Electron's renderer sends positional args (`invoke(channel, a, b, c)`),
// Tauri's `invoke` needs a `{ name: value }` object where the names
// match the Rust command's parameter names (with camelCase applied to
// snake_case names by Tauri v2's default `rename_all`).
//
// One entry per command declared in `src-tauri/src/main.rs`
// `.invoke_handler(...)`. When you add a new command, update BOTH the
// Rust side and this table — the shim silently drops args at indices
// beyond the array length, so a missing entry looks like "the args
// aren't reaching the backend" from the renderer's POV.

export const CHANNEL_ARG_NAMES: Record<string, string[]> = {
  // -- system --------------------------------------------------------
  'proxy:apply': ['url'],
  'cache:clear-searches': [],
  'item:export-json': ['item', 'suggestedName'],
  'dialog:pick-directory': ['title'],
  'export:site': ['targetDir', 'htmlContent'],
  'export:csv': ['targetDir', 'files'],
  'library:export-text': ['body', 'suggestedName', 'filterLabel', 'extension'],
  'library:save-text-to': ['targetPath', 'body', 'overwrite'],
  'system:reveal': ['path'],
  'fs:list-dir': ['path', 'includeHidden'],
  'fs:common-locations': [],
  'fs:path-info': ['path'],
  'fs:mkdir': ['path'],
  'fs:read-text-file': ['path'],

  // -- storage -------------------------------------------------------
  'storage:root': [],
  'storage:copy-data-to': ['targetDir'],
  'storage:clean-orphan-assets': [],
  'storage:import-assets-from': ['sourceAssetsDir'],
  'storage:cleanup-migration-artifacts': [],
  'storage:rename-all-assets': [],

  // -- data ----------------------------------------------------------
  'data:save': ['data'],
  'data:load': [],
  'data:list-backups': [],
  'data:restore-backup': ['name'],

  // -- images / blob / broken-asset audit ---------------------------
  'image:save': ['categoryId', 'kind', 'dataUrl', 'basename'],
  'image:delete': ['rel'],
  'image:download': ['url', 'categoryId', 'kind', 'basename'],
  'asset-blob:save': ['kind', 'categoryId', 'title', 'filename', 'data'],
  'asset-blob:delete': ['rel'],
  'asset-blob:reveal': ['rel'],
  'storage:audit-broken-assets': [],
  'storage:clear-asset-ref': ['itemId', 'field', 'source'],
  'storage:clear-asset-refs': ['refs'],

  // -- updates -------------------------------------------------------
  'updates:check': ['currentVersion'],
  'updates:install-kind': [],
  'updates:open-url': ['url'],
  'updates:download': ['url', 'filename'],
  'updates:reveal': ['filePath'],
  'updates:launch-installer': ['filePath'],
  'updates:appimage-swap': ['newPath'],
  'updates:open-dmg': ['filePath'],

  // -- fetchers (17 sources, 28 commands) ---------------------------
  'sgdb:search': ['apiKey', 'term'],
  'sgdb:assets': ['apiKey', 'kind', 'gameId'],
  'jikan:search': ['term', 'kind'],
  'kitsu:search': ['term', 'kind'],
  'mangadex:search': ['term'],
  'mangadex:covers': ['mangaId'],
  'comicvine:search': ['apiKey', 'term'],
  'comicvine:volume': ['apiKey', 'id'],
  'mb:search': ['term'],
  'mb:release-group-details': ['releaseGroupId'],
  'vgmdb:search': ['term'],
  'vgmdb:album': ['link'],
  'igdb:search': ['clientId', 'clientSecret', 'term'],
  'tmdb:search': ['apiKey', 'term', 'kind'],
  'tmdb:details': ['apiKey', 'kind', 'id'],
  'anilist:search': ['term', 'kind'],
  'steam:library': ['profileInput'],
  'openlibrary:search': ['term'],
  'openlibrary:work': ['workKey'],
  'vndb:search': ['term'],
  'vndb:detail': ['id'],
  'vndb:characters': ['vnId'],
  'vndb:releases': ['vnId'],
  'discogs:collection': ['username', 'token'],
  'lrclib:track': ['trackName', 'artistName', 'albumName'],
  'anidb:anime': ['client', 'aid'],
  'anidb:download-titles': [],
  'anidb:search-titles': ['query', 'limit'],
  'pcgw:search': ['term'],
  'pcgw:save-paths': ['pageName'],
  'hltb:search': ['term'],
  'lastfm:top_albums': ['apiKey', 'username', 'limit', 'period'],
  'lastfm:album_info': ['apiKey', 'username', 'artist', 'album'],

  // -- plugin sandbox (generic infra for `src/categories/<slug>/`) --
  'install:scan': ['customRoots'],
  'plugin:data-load': ['slug'],
  'plugin:data-save': ['slug', 'data'],
  'plugin:asset-download': ['slug', 'kind', 'url', 'basename', 'referer', 'cookie'],
  'plugin:asset-save-data-url': ['slug', 'kind', 'dataUrl', 'basename'],
  'plugin:asset-save-from-file': ['slug', 'kind', 'sourcePath', 'basename'],
  'plugin:asset-delete': ['slug', 'kind', 'basename'],
  'plugin:asset-rename': ['slug', 'kind', 'oldBasename', 'newBasename'],
  'plugin:saves-list': ['slug', 'gameName'],
  'plugin:saves-add': ['slug', 'gameName'],
  'plugin:saves-delete': ['slug', 'gameName', 'fileName'],
  'plugin:saves-open-folder': ['slug', 'gameName'],
  'plugin:saves-reveal': ['slug', 'gameName', 'fileName'],
  'plugin:saves-rename-folder': ['slug', 'oldName', 'newName'],
  'plugin:saves-delete-all': ['slug', 'gameName'],
  'net:fetch-text': ['url', 'headers'],
}

// Convert an Electron-style channel name to a Tauri command name.
// Electron uses `:` (namespace) and `-` (hyphen) as separators; Tauri
// commands are `snake_case` matching the Rust function name. Both
// `[-:]` collapse to `_`.
//
// 'proxy:apply'          → 'proxy_apply'
// 'storage:copy-data-to' → 'storage_copy_data_to'
// 'asset-blob:save'      → 'asset_blob_save'
export function tauriCommandFor(channel: string): string {
  return channel.replace(/[-:]/g, '_')
}
