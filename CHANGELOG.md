# Changelog

All notable changes to Omnio are documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Each `## v<version>` section becomes the body of that tag's [GitHub Release](https://github.com/TonyMontania/Omnio/releases) — the release workflow reads this file and passes the matching section to `tauri-action`, so patch notes stay authored here (versioned in git, reviewable in PRs) instead of in a separate release form.

## v0.5.1 — Item templates, quick-add via URL, settings rework, mobile cleanup

Second Tauri release. Three new user-facing features — **item templates**, **quick-add via URL** and **half-star ratings across the board** — a big **visual rework of Settings**, and the experimental mobile companion / encrypted backup / git-backed data folder all get retired to keep the desktop app lean.

No data-on-disk changes. Upgrading is a normal installer replacement; your library stays where it is.

### Downloads

Grab the build for your platform from the assets below.

| OS | File | Notes |
| --- | --- | --- |
| Windows | `Omnio_0.5.1_x64-setup.exe` | NSIS installer, per-user, no admin required |
| Windows | `Omnio_0.5.1_x64_en-US.msi` | MSI for group-policy / SCCM rollouts |
| Windows | `Omnio_0.5.1_windows-portable.zip` | portable EXE — needs WebView2 (installed by default on Windows 10 21H2+ and every Windows 11) |
| macOS (Apple Silicon) | `Omnio_0.5.1_aarch64.dmg` | drag to Applications |
| macOS (Intel) | `Omnio_0.5.1_x64.dmg` | drag to Applications |
| Linux | `omnio_0.5.1_amd64.AppImage` | `chmod +x` and run (may need `libfuse2`) |
| Linux | `omnio_0.5.1_amd64.deb` | `sudo dpkg -i omnio_0.5.1_amd64.deb` |

All builds are unsigned — Windows SmartScreen and macOS Gatekeeper warn on first launch, one confirmation clears them.

### What's new

#### Item templates

Save the field values you want prefilled for the next item in a given category. Open **Add**, set your defaults (status, tags, and for games: platforms + ownership + source), click **Save as template** in the panel header. Every new item you add in that category will start with those slots populated.

- Templates are stored per-category — a template for **Games** doesn't affect **Books**.
- Editing an existing item never applies a template — only fresh items opened from the "+" button.
- Manage saved templates from **Settings → Behavior → Item templates**. One-click **Clear** per row.

#### Quick-add via URL

Paste a supported metadata URL into the **Title** field of the Add panel and the matching fetcher opens with the slug already humanized and pre-searched. Supported sources:

- **IGDB** — `igdb.com/games/<slug>` → routes to the IGDB fetcher.
- **TMDb** — `themoviedb.org/movie/<id>-<slug>` and `/tv/<id>-<slug>` → routes to TMDb.
- **AniList** — `anilist.co/anime/<id>/<slug>` and `/manga/<id>/<slug>`.
- **MyAnimeList** — `myanimelist.net/anime/<id>/<slug>` (routed through the AniList fetcher, which handles MAL-shaped queries).
- **VNDB** — `vndb.org/v<id>`.
- **MangaDex** — `mangadex.org/title/<uuid>/<slug>`.
- **OpenLibrary** — `openlibrary.org/works/OL<id>W/<slug>`.
- **Steam** — `store.steampowered.com/app/<id>/<slug>` (routed through IGDB, which searches by title).

Detection is scoped to fetchers available for the current category — pasting a TMDb URL while adding a Book does nothing (no false-positive redirect).

#### Half-star ratings across the board

The **RatingPicker** in every editor uses a 10-pill row (0.5 → 5.0), the **min-rating filter** offers `1 · 1.5 · 2 · 2.5 · 3 · 3.5 · 4 · 4.5 · 5`, and the **`★{n}`** display on cards and detail views shows halves as `★4.5`. Sorting by rating respects halves too.

#### Settings visual rework

- **Floating navigation card** — the left column is now a rounded card with a border, sticky on scroll, with breathing room from the app sidebar (before: pegged to the app chrome).
- **One card per setting** — every top-level `.field-group` is a distinct surface with a bold display-font title (up from tiny mono uppercase). Descriptions sit inside the card, not floating loose next to it.
- **Card fields tab** — the eight per-library toggle grids collapsed into **one big card with a 2-column grid**. Each category has a subtitle with a hairline border-bottom and its pills below. Wraps to one column at narrow widths.
- **Enabled libraries / Extras / Plugins** — checkbox rows now render as **inline chips that wrap**, instead of a full-width vertical stack. Much denser.
- **Cover wall export dialog** — was rendering unstyled because it referenced classes that didn't exist. Now uses the canonical `.modal-panel` shell with a real header, subtitle, labeled rows and a two-column grid for **Title on the wall** and **Background**.
- **Section titles** ("Danger zone", "Integrations · API keys", …) got a stronger visual weight (18px bold with an underline).

#### Docs

- **README** rewrite — table of contents, features grouped in three columns (Track / Discover / Own your data), metadata sources split into per-category tables, CI badges added (Tests + Lint).
- **CONTRIBUTING.md** absorbed the "Build from source" block; the README now has a short link to it.
- **`docs/IDEAS.md`** — `#15 Half-star ratings` marked as shipped; the barcode-via-mobile-app entry was removed with the mobile companion.

### Removed

- **Mobile app / PWA discontinued.** The experimental mobile companion is gone. Removed: the `src/mobile/` component tree, the `src/MobileNav.tsx` bottom bar, `useIsMobile` / `useDeviceClass` hooks, the PWA manifest + service worker, `src/utils/lanSync.ts` + `src/utils/githubSync.ts`, the `LanServerSettings` / `SyncSettings` panels, and the Rust `handlers/lan_server.rs` axum endpoint that served the desktop library over the LAN. The `axum` / `tower-http` / `local-ip-address` Cargo dependencies came out with it. Desktop-only from here.
- **Encrypted 7z backup retired.** `BackupSettings.tsx`, `handlers/backup.rs` and the `sevenz-rust` + `walkdir` crates were removed. The **rolling 5-snapshot backup on every save** stays — it lives in `data/backups/1..5/` and is restorable from **Settings → Backup, import & export**.
- **Git-backed data folder retired.** `GitBackedSettings.tsx` and `handlers/git_data.rs` (init / commit / push / pull / history / restore) came out; the `chrono` crate went with them. If you had this enabled, your `data/` folder still works as a git repo — Omnio just no longer manages the commits.
- **Old `fontSize` "Interface size" toggle** — was mobile-only zoom (only activated at `≤640px` viewports). Now dead; the setting is gone from **Appearance**.

### Cleanup

- **~600 LoC of Rust and ~250 LoC of TypeScript removed** across the mobile / backup / git retirements.
- **Three Cargo crates dropped**: `sevenz-rust`, `walkdir`, `chrono` (plus `axum` / `tower-http` / `local-ip-address` from the mobile removal).
- **Two npm dependencies dropped**: `qrcode` and `jsqr` (used only for mobile-PC pairing).
- Slimmer bundle, faster cold compile, less to maintain.

### Full changelog

`v0.5.0...v0.5.1` on GitHub — https://github.com/TonyMontania/Omnio/compare/v0.5.0...v0.5.1

## v0.5.0 — Omnio migrates from Electron to Tauri

Full notes: https://github.com/TonyMontania/Omnio/releases/tag/v0.5.0

Highlights: Rust/Tauri v2 backend, ~90% smaller installer, first-boot library migration from Electron, new **Visual Novels** category with full VNDB integration, better error surfacing on network failures, loose schema validation at the disk boundary.
