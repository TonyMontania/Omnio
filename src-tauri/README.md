# Omnio — Tauri POC (Fases B + C + E **complete**)

Rust backend proof-of-concept. The Electron backend under `electron/`
is untouched and remains the production path — this folder is a
side-by-side experiment.

## What's here

| File | Mirrors |
|---|---|
| `Cargo.toml` | (Rust project manifest — no Electron equivalent) |
| `tauri.conf.json` | `electron-builder.yml` + `electron/main.ts` window setup |
| `build.rs` | (Cargo build script — no Electron equivalent) |
| `src/main.rs` | `electron/main.ts` (post-Fase-1.2 slim version) |
| `src/paths.rs` | `electron/paths.ts` (storage root + CATEGORY_IDS + TOP_SLICES + backup slots) |
| `src/state.rs` | Module-scope closures in `electron/net.ts` + `electron/util.ts` (reqwest client, search cache, `lastHashes`) |
| `src/net.rs` | `electron/net.ts` in full (proxy config → shared reqwest client, proxy_json skeleton, TTL search cache, MB/AniDB throttlers) |
| `src/util.rs` | `electron/util.ts` in full (sanitize + sha1 + safe_relative + write_if_changed + asset filename builders, with unit tests) |
| `src/handlers/mod.rs` | `electron/handlers/*.ts` module barrel |
| `src/handlers/system.rs` | `electron/handlers/system.ts` (6 commands, 1:1) |
| `src/handlers/storage.rs` | `electron/handlers/storage.ts` (all 6 commands — `storage:rename-all-assets` completed in step 4) |
| `src/handlers/data.rs` | `electron/handlers/data.ts` (4 commands + split-file read/write/rotate/migrate/rename-all-assets machinery) |
| `src/handlers/images.rs` | `electron/handlers/images.ts` (9 commands: data-URL save, unlink, blob save/delete/reveal, HTTP download with retry, broken-asset audit, single + bulk clear-ref) |
| `src/handlers/updates.rs` | `electron/handlers/updates.ts` (8 commands: GitHub Releases poll, semver compare, install-kind detect, streaming download with progress events, reveal + launch-installer + appimage-swap + open-dmg) |
| `src/handlers/fetchers.rs` | `electron/handlers/fetchers.ts` (28 commands across 17 sources: SGDB, Jikan, Kitsu, MangaDex, ComicVine, MusicBrainz, VGMdb, IGDB, TMDb, AniList, Steam, OpenLibrary, VNDB, Discogs, lrclib, AniDB, PCGamingWiki) |
| `src/schemas.rs` | `electron/schemas.ts` (loose object validators + pick_valid / parse_or / warn_invalid runners) |

## Commands ported

| Rust (snake_case)          | Electron channel        | Status |
|----------------------------|-------------------------|--------|
| `proxy_apply`              | `proxy:apply`           | Storage only — reqwest wiring lands with `net.ts` port |
| `cache_clear_searches`     | `cache:clear-searches`  | Full behavior (empty cache in POC) |
| `item_export_json`         | `item:export-json`      | Full behavior |
| `dialog_pick_directory`    | `dialog:pick-directory` | Full behavior |
| `export_site`              | `export:site`           | Full behavior (assets dir walked via `tokio::fs`) |
| `export_csv`               | `export:csv`            | Full behavior (path sanitization matches Electron) |
| `storage_root`             | `storage:root`          | Full behavior |
| `storage_copy_data_to`     | `storage:copy-data-to`  | Full behavior (date-stamped subdir + assets/) |
| `storage_clean_orphan_assets` | `storage:clean-orphan-assets` | Full behavior (same scanned-JSON set as TS) |
| `storage_import_assets_from`  | `storage:import-assets-from`  | Full behavior (overwrite semantics preserved) |
| `storage_cleanup_migration_artifacts` | `storage:cleanup-migration-artifacts` | Full behavior |
| `storage_rename_all_assets` | `storage:rename-all-assets` | Full behavior (reuses data.rs renamer) |
| `data_save` | `data:save` | Full behavior — validation warn, snapshot rotate, per-slice write-if-changed |
| `data_load` | `data:load` | Full behavior — split read + legacy migrator + schema validators |
| `data_list_backups` | `data:list-backups` | Full behavior |
| `data_restore_backup` | `data:restore-backup` | Full behavior — pre-restore safety copy included |
| `image_save` | `image:save` | Data-URL parse + base64 decode + write |
| `image_delete` | `image:delete` | safe_relative + unlink |
| `image_download` | `image:download` | reqwest with 3-attempt retry (408/429/5xx/net) |
| `asset_blob_save` | `asset-blob:save` | Opaque bytes → per-item subdir, collision suffix, UUID id |
| `asset_blob_delete` | `asset-blob:delete` | Unlink + best-effort rmdir |
| `asset_blob_reveal` | `asset-blob:reveal` | Windows: `explorer.exe /select,` (macOS/Linux fallback pending) |
| `storage_audit_broken_assets` | `storage:audit-broken-assets` | Walk JSONs, check file exists, emit `BrokenRef[]` |
| `storage_clear_asset_ref` | `storage:clear-asset-ref` | Single field blank |
| `storage_clear_asset_refs` | `storage:clear-asset-refs` | Bulk group-by-source, index for O(1) item lookup |
| `updates_check` / `updates_install_kind` / `updates_open_url` / `updates_download` / `updates_reveal` / `updates_launch_installer` / `updates_appimage_swap` / `updates_open_dmg` | `updates:*` | GitHub Releases poll, streaming download with progress events, per-platform install flow |
| `sgdb_search` / `sgdb_assets` | `sgdb:*` | SteamGridDB game art (Bearer key) |
| `jikan_search` | `jikan:search` | MAL proxy with 3-attempt retry + 429/504 hint |
| `kitsu_search` | `kitsu:search` | JSON:API + soft-error walk |
| `mangadex_search` / `mangadex_covers` | `mangadex:*` | `includes[]` array serialization |
| `comicvine_search` / `comicvine_volume` | `comicvine:*` | API key + `error != OK` soft check |
| `mb_search` | `mb:search` | 1.05s throttle + release-groups pick |
| `mb_release_group_details` | `mb:release-group-details` | 3-stage chain (list → tracklist → enrich) with throttle each |
| `vgmdb_search` / `vgmdb_album` | `vgmdb:*` | vgmdb.info community JSON |
| `igdb_search` | `igdb:search` | Twitch OAuth token cache (AsyncMutex + Instant expiry) + Apicalypse body |
| `tmdb_search` / `tmdb_details` | `tmdb:*` | append_to_response branch on movie vs tv |
| `anilist_search` | `anilist:search` | GraphQL POST + `pointer("/data/Page/media")` walk |
| `steam_library` | `steam:library` | Vanity vs URL parse, XML text return |
| `openlibrary_search` / `openlibrary_work` | `openlibrary:*` | Fields query + work detail |
| `vndb_search` / `vndb_detail` / `vndb_characters` / `vndb_releases` | `vndb:*` | Kana API POST + JSON body filters; pagination loop with `more` flag |
| `discogs_collection` | `discogs:collection` | 100/page cap 20 pages + Retry-After honor on 429 |
| `lrclib_track` | `lrclib:track` | 404 → "no lyrics" branch, synced/plain fallback |
| `anidb_anime` | `anidb:anime` | 2.1s throttle + XML `<error>` regex extract |
| `pcgw_search` / `pcgw_save_paths` | `pcgw:*` | OpenSearch array shape + wikitext nested-brace walker |

## Coverage vs. Electron

Fases **B** (backend port) and **C** (renderer routing) are complete.
The Rust POC handles every IPC channel the Electron backend does — 66
commands across 8 handler modules — and the renderer routes to
whichever backend it's running under with no code changes at call
sites.

### Renderer routing (Fase C)

The 81+ `window.ipcRenderer.invoke(...)` and `.on(...)` sites in
`src/App.tsx`, `src/utils/files.ts`, etc. work unchanged on both
backends. Mechanism:

- Under Electron: `preload.ts` provides `window.ipcRenderer` as always.
- Under Tauri: `src/utils/ipc-shim.ts` installs a shim on
  `window.ipcRenderer` at boot (before React mounts). The shim exposes
  the Electron API (`invoke`, `on`, `off`, `send`) but routes:
  - `invoke(channel, ...args)` → `tauriInvoke(tauriCommandFor(channel),
    positionalToNamed(channel, args))`
  - `on(channel, listener)` → `tauriListen(channel, ev =>
    listener(null, ev.payload))`

The channel-name → snake_case translation (`'data:save'` →
`'data_save'`, `'asset-blob:save'` → `'asset_blob_save'`) and the
per-channel positional → named args map live in
`src/utils/ipc-tauri-map.ts` — one entry per command.

### Asset protocol (`omnio-asset://`)

`src-tauri/src/asset_protocol.rs` serves files from the assets root
through the custom `omnio-asset://` URI scheme registered on the Tauri
`Builder`. Rendered paths on disk are identical to what Electron
writes (`videojuegos/cover/x.jpg`) so no data migration is needed for
the switch — the same JSONs, the same assets/, the same URI shape.

Path-traversal is defended through `util::safe_relative`, matching
what `electron/main.ts` does for its `registerFileProtocol` handler.
Content-Type is derived via `mime_guess::from_path` so `image/jpeg`,
`image/webp` etc. are set correctly for the webview.

### First-boot library migration (Fase E)

`src-tauri/src/migrate_from_electron.rs` runs once inside the Tauri
`setup()` callback. If it detects:

- an existing Electron storage root (`%APPDATA%\Omnio` on Windows,
  `~/Library/Application Support/Omnio` on macOS, `~/.config/Omnio`
  on Linux) **and**
- a fresh Tauri storage root (no `data/` folder present, no marker
  file)

then it copies `data/` and `assets/` from Electron's dir into
Tauri's. The user sees their full library on first open. A marker
file `.migrated-from-electron` is written on success so the migration
never runs again — subsequent boots see the marker and skip.

Copy semantics (not move): the Electron install stays fully intact,
so a user who wants to roll back to Electron loses nothing.

The Electron build (`npm run dev`) still handles every channel as
before. Nothing about that path changed.

## First-time setup (Windows)

The two dependencies Tauri needs and this repo doesn't already have:

```bash
# 1. Rust toolchain (~1 GB, one-time). You already have scoop:
scoop install rustup
rustup default stable

# 2. Visual Studio Build Tools with MSVC + Windows 10 SDK.
# https://aka.ms/vs/17/release/vs_BuildTools.exe
# In the installer, pick "Desktop development with C++".
```

Verify:

```bash
npx tauri info
```

Every line under `[✘] Environment` should now be a `✔`.

## Try it

```bash
npm run tauri:dev
```

Vite serves the renderer at `localhost:5173` (same as `npm run dev`),
Tauri wraps it in a native window titled "Omnio (Tauri POC)". Open
DevTools → Console and run one of the ported commands:

```js
const { invoke } = await import('@tauri-apps/api/core')
await invoke('cache_clear_searches')          // → { ok: true }
await invoke('dialog_pick_directory', { title: 'Pick anything' })  // → path or null
```

## Build

```bash
npm run tauri:build
```

Produces a Windows installer under `src-tauri/target/release/bundle/`.
Bundle size lands around 12–15 MB vs. Electron's ~180 MB — mostly
because there's no bundled Chromium.

## Not the plan (deliberately out of POC scope)

- **Renderer routing** — `src/utils/ipc.ts` still points at
  `window.ipcRenderer` unconditionally. Making it detect Tauri and
  translate `'proxy:apply'` → `'proxy_apply'` is Fase C.
- **Auto-update** — `tauri-plugin-updater` lands with the `updates.ts`
  port (Fase B step 7).
- **Data folder migration** — Tauri's `app_data_dir()` under Windows
  resolves to `%APPDATA%/com.omnio.app/`, distinct from Electron's
  `%APPDATA%/Omnio/`. When we cut over, a one-shot copy on first
  Tauri boot handles it. For now the POC uses its own empty folder,
  so you can experiment without touching your real Electron data.
