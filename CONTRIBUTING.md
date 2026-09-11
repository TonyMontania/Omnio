# Contributing to Omnio

Thanks for taking the time — Omnio is a local-first hobby tracker and every
piece of it is designed to keep it that way. This doc walks through the
project layout, the contracts to preserve, and step-by-step recipes for the
most common extensions (add a metadata source, add an importer, add a
library category, add a per-item editor field).

## Reporting bugs / requesting features

- **Bugs** → open an issue with reproduction steps + your OS + your Omnio
  version (from Settings → Maintenance & about). If the app is broken on
  start, `Ctrl+Shift+I` opens DevTools — the Console tab usually has the
  stack trace.
- **Feature requests** → open an issue framed as "the problem I'm trying
  to solve," not "the feature I want." That gives room to find a simpler
  solution than the one you thought of first.
- **Security** → follow [SECURITY.md](SECURITY.md) — don't post those in
  public issues.

## Running locally

Omnio is a Tauri (Rust) + React + Vite + TypeScript app. Requires **Node.js 22+**,
**npm 10+**, **Rust stable** (via [rustup](https://rustup.rs/)) and the platform's
C toolchain: Visual Studio Build Tools with "Desktop development with C++" on
Windows, Xcode Command Line Tools on macOS, `build-essential` +
`libwebkit2gtk-4.1-dev` on Linux.

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev                     # tauri dev — vite + cargo run
npm run build                   # tauri build — installers for the current OS
npm run lint                    # ESLint (zero-warning gate)
npm test                        # Vitest (renderer)
(cd src-tauri && cargo test)    # Rust unit tests
```

Build artifacts land in `src-tauri/target/release/bundle/` (`nsis/*.exe`,
`msi/*.msi`, `dmg/*.dmg`, `appimage/*.AppImage`, `deb/*.deb`). Bundle
configuration lives in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).

The first launch creates `data/` and `assets/` under
`%APPDATA%\com.omnio.app\` (Windows), `~/Library/Application Support/com.omnio.app/`
(macOS) or `~/.config/com.omnio.app/` (Linux). If a previous Electron
install exists, its library is imported once on first boot (see
`src-tauri/src/migrate_from_electron.rs`).

## Before you push

```bash
npm run lint                        # ESLint on src/, --max-warnings 0
npm test                            # Vitest unit tests
npx tsc --noEmit                    # Type-check without emitting
(cd src-tauri && cargo check)       # Rust type-check
(cd src-tauri && cargo test)        # Rust unit tests
```

CI runs the JS layers on every push. All must pass for a PR to merge.

## Project layout

```
src/                              Renderer (React + TypeScript).
  App.tsx                         Top-level React component. Hoists every state
                                  atom for the item editor + wraps every modal.
                                  Category-specific editor JSX is extracted
                                  into src/components/editors/*EditorSection.tsx.
  Home.tsx                        Landing dashboard.
  GlobalSearch.tsx                Ctrl+K palette. Operator parser lives here.
  {Category}DetailModal           Read-only detail views per library.
  {Source}Fetcher.tsx             One file per metadata source.
  {Source}Importer.tsx            One file per data importer (Steam, Letterboxd,
                                  Backloggd, Serializd, Spotify, MAL/AniList XML,
                                  Kindle highlights, Last.fm, Trakt, Discogs).
  components/
    editors/                      Small editor building blocks + per-category
                                  *EditorSection components.
    detail/                       Building blocks for the DetailModals.
    FetcherModal.tsx              Base modal for search-then-pick fetchers.
    ImageLightbox.tsx             Global full-screen image viewer.
    CoverPlaceholder              Category-shaped SVG for items without a cover.
  types/
    entities.ts                   Pure TypeScript types. No runtime code.
    options.ts                    OPTIONS lists, defaults, palette constants.
    helpers.ts                    Pure functions (label lookups, formatters,
                                  assetSrc — branches on Tauri vs Electron).
    ipc-contract.ts               Typed IPC channel contract; `src/utils/ipc.ts`
                                  and the Tauri shim reference it.
    index.ts                      Barrel; import everything from './types'.
  utils/
    csv.ts                        parseCsv, colIndex, buildCsv.
    format.ts                     formatBytes, formatDate, formatIsoDate.
    files.ts                      File-picker + drag-and-drop upload helpers.
    ipc.ts                        Typed `invoke()` wrapper around
                                  `window.ipcRenderer.invoke`.
    ipc-shim.ts                   Installed at boot when running under Tauri;
                                  populates `window.ipcRenderer` with a router
                                  that translates Electron-style channel calls
                                  to Tauri commands + events.
    ipc-tauri-map.ts              Channel → Rust arg-name table for the shim.

src-tauri/                        Backend (Rust). 66 commands, 8 handler modules.
  Cargo.toml                      Deps: tauri, tokio, serde, reqwest, sha1, …
  tauri.conf.json                 Bundle config: NSIS installer, MSI, DMG,
                                  AppImage. Publisher metadata, asset protocol.
  capabilities/default.json       Tauri v2 permission set for the main window.
  src/
    main.rs                       Entry — registers commands + URI schemes,
                                  runs first-boot migration.
    paths.rs                      Storage root resolution (portable / packaged
                                  / dev), CATEGORY_IDS, TOP_SLICES.
    util.rs                       sanitize_asset_name, sha1_hex, safe_relative,
                                  write_if_changed, asset filename builders.
    net.rs                        Shared reqwest Client (proxy-aware),
                                  proxy_json JSON fetch skeleton, search cache,
                                  MB/AniDB throttlers.
    schemas.rs                    Loose serde validators for on-disk JSON —
                                  drop-invalid-row-and-log strategy.
    state.rs                      Shared `AppState` — http_client, search_cache,
                                  last_hashes.
    asset_protocol.rs             `omnio-asset://` URI scheme handler
                                  (used indirectly via convertFileSrc under
                                  Tauri's built-in asset:// protocol).
    migrate_from_electron.rs      First-boot: copy old Electron library into
                                  the Tauri storage root, drop marker.
    handlers/
      system.rs                   proxy_apply, cache clear, export site/csv,
                                  item export json, dialog directory pick.
      storage.rs                  storage_root, copy-data-to, clean orphans,
                                  import-assets-from, rename-all-assets.
      data.rs                     data:save / data:load / snapshot rotation /
                                  legacy monolithic-file migrator.
      images.rs                   image save/delete/download, blob save/delete/
                                  reveal, broken-asset audit + clear-ref.
      updates.rs                  GitHub Releases poll, install-kind detect,
                                  streaming download with progress events.
      fetchers.rs                 28 commands / 17 sources: SGDB, Jikan, Kitsu,
                                  MangaDex, ComicVine, MusicBrainz, VGMdb, IGDB,
                                  TMDb, AniList, Steam, OpenLibrary, VNDB,
                                  Discogs, lrclib, AniDB, PCGamingWiki.

docs/
  FIELDS.md                       Every field on every category, EN + ES labels.
  FETCHER_FIELDS.md               Which fields each source populates.
  FETCHER_REGISTRY.md             Renderer-side fetcher registration.
  REDESIGN.md                     Historical design doc for the 0.3 UX pass.
```

## The design contract

Non-negotiables — a PR that breaks these gets bounced.

1. **Local-first, no telemetry.** Nothing may phone home except in
   response to a user action (metadata search, cover download, update
   check). No analytics, no crash reporters that upload silently.
2. **State hoisted in App.tsx.** New per-category editors take value +
   setter as props — no local state that duplicates App's atoms.
   When the item-form migration to `useReducer` eventually happens the
   diff should be mechanical (swap prop bag for `dispatch`).
3. **`data/` and `assets/` are the source of truth.** No sidecar
   databases. Every read/write goes through `data:load` / `data:save`.
4. **All libraries share one Item type.** New fields go on the
   `Item` interface; runtime code gates them by `categoryId`. Don't
   fork parallel types per category.
5. **Zero ESLint warnings + zero cargo warnings.** The `--max-warnings 0`
   gate is deliberate and CI-enforced on both sides.
6. **No emojis in code / commits unless the user asks.** Product copy
   in the UI is fine; commit messages, comments and doc prose stay
   plain text.

## Recipes

### Add a metadata source

1. Add a Rust command under `src-tauri/src/handlers/fetchers.rs` (e.g.
   `foo_search`, `foo_details`). Follow the `proxy_json` pattern; wrap
   search in `cached_search(&state, "foo", term, || async { ... })` so
   it hits the 24h cache.
2. Register the new command in `src-tauri/src/main.rs` under
   `.invoke_handler(tauri::generate_handler![...])`.
3. Add the channel → arg-name mapping in
   `src/utils/ipc-tauri-map.ts` so the renderer's positional
   `invoke('foo:search', term)` translates to the Tauri call.
4. Add typed args + return to `src/types/ipc-contract.ts`.
5. Create `src/FooFetcher.tsx` — modeled on `MusicBrainzFetcher.tsx` if
   the API is search-then-details, or on `AniDBFetcher.tsx` if it's
   paste-an-ID.
6. In App.tsx, lazy-import + open state + render the fetcher inside a
   `<Suspense>`. Wire `onApply` to `applyFetchedPatch(...)` — that
   function already handles every category's field mapping.
7. Add the source's row to the README table + About panel changelog.

### Add an importer

1. Create `src/FooImporter.tsx` — model on `LetterboxdImporter.tsx` for
   CSV, `SpotifyImporter.tsx` for JSON, `SerializdImporter.tsx` for
   sniff-on-first-char JSON-or-CSV. All follow the same
   dedupe-against-library / preselect-new / per-row-checkbox pattern.
2. Add lazy import + open state + render block in App.tsx.
3. Add the Settings → Backup, import & export button.
4. Bump the README `## What it does` bullet list.

### Add a library category

1. Add the id + label to `src/categories.ts`.
2. Add the category-specific fields (status enum, format enum, etc.)
   to `src/types/entities.ts` and their OPTIONS lists to
   `src/types/options.ts`.
3. Add the category id to `CATEGORY_IDS` in
   `src-tauri/src/paths.rs` so the split-file storage picks it up.
4. Add a `{Category}DetailModal.tsx` — model on `MusicDetailModal.tsx`
   for square covers or `GameDetailModal.tsx` for 2:3 posters.
5. Add the category-specific editor JSX to App.tsx (or ideally a new
   `{Category}EditorSection.tsx`).
6. Add a glyph to `src/components/CoverPlaceholder.tsx`.
7. Add an entry to the Image upload guide + README.

### Add a per-item field

1. Extend the `Item` interface in `src/types/entities.ts`. Fields are
   always optional (`?:`) — legacy items have to load cleanly.
2. Add state in App.tsx: `const [foo, setFoo] = useState('')`. Wire
   into `loadItemIntoForm`, the item builder in `saveItem`, and the
   reset block.
3. Wire into the relevant `{Category}EditorSection` (or the inline
   block if the category hasn't been extracted yet).
4. Add read-only display in the matching DetailModal.
5. Add to the CSV export column list (`src/CsvExporter.ts`) if it
   makes sense for spreadsheets.
6. Update `docs/FIELDS.md` — EN + ES labels.

## Commit style

- Short imperative subject ("Music: bump edition cover to album size"),
  70 chars max.
- Body wraps at 72 chars, explains **why** more than **what** (the
  diff shows what).
- No AI / assistant co-authorship. If you paired with a bot to draft
  the code, that's fine — the commit still lands under your name.
- Group commits by theme, not by file. A refactor spanning 10 files
  is one commit; three unrelated fixes are three.

## Getting help

Post in an issue prefixed `[question]` if the docs don't cover what
you're trying to build. Faster than DMing — the answer probably helps
the next contributor too.
