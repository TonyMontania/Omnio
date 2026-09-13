# Changelog

All notable changes to Omnio are documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Each `## v<version>` section becomes the body of that tag's [GitHub Release](https://github.com/TonyMontania/Omnio/releases) — the release workflow reads this file and passes the matching section to `tauri-action`, so patch notes stay authored here (versioned in git, reviewable in PRs) instead of in a separate release form.

## Unreleased

### Added

- **Home widget: Big numbers.** A row of scrapbook-style tiles at the top of the dashboard — total items in the library, finished this year, hours logged (sums game playtime + movie runtime + episodes × episode duration + VN estimated hours), and count of items rated ★4 or higher. No comparisons, no deltas, no "less than last month" framing — the widget is a portrait of what you have, not a report card.
- **Home widget: Currently airing.** Filters anime, donghua and series with `airingStatus === 'airing'` — the shows actually on air this season, distinct from "upcoming" (future releases). Newest-first.
- **Home widget: Upcoming this week.** Companion to the existing 30-day upcoming widget; tighter 7-day horizon for users who only want the imminent stuff.
- **Home widget: Quick add.** Inline single-row form (category select + title input + Add button) that skips the full Add panel and drops a stub item straight into the chosen library. Faster path when you just want to remember something exists — flesh-fill the rest later.
- **Home widget: Cover carousel.** Auto-scrolling marquee of covers from your library; pauses on hover, respects `prefers-reduced-motion`, click a cover to open the item. Purely decorative.
- **Currently widget covers Visual Novels too.** The existing "in progress" widget now surfaces VNs with `visualNovelStatus === 'playing'`, matching how it already covered every other category.
- **Default Home layout ships with the new widgets** enabled — big-numbers → currently → carousel → upcoming-week → currently-airing → quick-add → recently-rated. Existing users who saved their own layout keep theirs; anyone who never touched Edit mode gets the new default on next boot.

### Fixed

- **Track artist column in the Music detail view split band names that contain a `/`.** The parser that decided when to render "artistA, artistB" as separate pills was splitting on `/` and `:` too — so `156/Silence`, `AC/DC`, `Sunami:Portrayal Of Guilt` and every other band that carries one of those characters showed as two pills instead of one. The split is now scoped to real featured-artist separators (`,`, `&`, `feat.`, `ft.`, ` x `).
- **Track artist rendering was inconsistent within the same album.** When every track shared the album artist, the cell rendered as plain text; when a track added a featured artist, both names rendered as yellow accent pills. Same "Architects" text ended up styled differently row to row. Every artist name is now a pill, so a lone `Architects` sits at the same visual weight as `Architects · Jon Green` two rows down.

### Changed

- **In-app updater downloads land in the app's install folder instead of `~/Downloads`.** The download destination is now the parent of `current_exe()` — so a portable user gets the new ZIP right next to their extracted `omnio.exe`, an NSIS user gets the new `setup.exe` inside `%LocalAppData%\Programs\Omnio\`, and an AppImage user gets the new AppImage sitting next to the running one. Falls back to the OS Downloads folder (and then to the app-data dir) when the install location is read-only for the process — typical for MSI installs in Program Files or `.deb` / `.rpm` installs under `/usr/bin`, where writing without elevation isn't allowed.
- **Release title on GitHub is just the tag** — `v0.5.3` instead of `Omnio v0.5.3`. Cleaner in the releases list, matches how most Tauri projects render.

Small patch release. Two things: three new Linux / Windows delivery channels come online (`.rpm`, AUR `omnio-bin`, winget `TonyMontania.Omnio`), and the in-app updater finally hands every install variant the matching release asset.

Nothing on disk changes. Upgrade is a normal installer swap; your library stays where it is.

### Downloads

Grab the build for your platform from the assets below.

| OS | File | Notes |
| --- | --- | --- |
| Windows | `Omnio_0.5.2_x64-setup.exe` | NSIS installer, per-user, no admin required |
| Windows | `Omnio_0.5.2_x64_en-US.msi` | MSI for group-policy / SCCM rollouts |
| Windows | `Omnio_0.5.2_windows-portable.zip` | portable EXE — needs WebView2 (installed by default on Windows 10 21H2+ and every Windows 11) |
| macOS (Apple Silicon) | `Omnio_0.5.2_aarch64.dmg` | drag to Applications |
| macOS (Intel) | `Omnio_0.5.2_x64.dmg` | drag to Applications |
| Linux | `omnio_0.5.2_amd64.AppImage` | `chmod +x` and run (may need `libfuse2`) |
| Linux | `omnio_0.5.2_amd64.deb` | `sudo dpkg -i omnio_0.5.2_amd64.deb` |
| Linux | `omnio-0.5.2-1.x86_64.rpm` | `sudo dnf install ./omnio-0.5.2-1.x86_64.rpm` |
| Arch AUR | — | `yay -S omnio-bin` (or your AUR helper) |
| winget | — | `winget install TonyMontania.Omnio` |

All builds are unsigned — Windows SmartScreen and macOS Gatekeeper warn on first launch, one confirmation clears them.

### What's new

#### New delivery channels

Three channels come back after being retired in the Tauri migration. All three are stamped by CI from templates in `packaging/`, uploaded to the release as extra assets, and ready for one-command downstream submission.

- **Fedora / RHEL `.rpm` build.** Tauri v2 has a native `rpm` bundle target; adding `"rpm"` to `bundle.targets` + `rpm` to the Linux CI prereqs is all it took. The release publishes `omnio-0.5.2-1.x86_64.rpm` alongside the AppImage + `.deb`. Distros covered: Fedora, RHEL, CentOS Stream, Rocky, AlmaLinux, openSUSE (via zypper), Amazon Linux 2023.
- **AUR package `omnio-bin`.** `packaging/aur/PKGBUILD` repackages the upstream `.deb` for Arch and derivatives — no rebuild, just download-verify-install. The release workflow stamps the version + SHA256 into the PKGBUILD and uploads the stamped file as `omnio-bin.PKGBUILD.txt`; submitting to AUR is one `git push` from a maintainer machine with SSH access to `ssh://aur@aur.archlinux.org/omnio-bin.git`.
- **winget package `TonyMontania.Omnio`.** `packaging/winget/*.yaml` describes the NSIS + MSI + portable-ZIP installers, each with its own SHA256 and installer switches (silent + interactive). The stamped YAMLs land on the release, ready for `wingetcreate submit` against `microsoft/winget-pkgs`.

Under the hood: `scripts/stamp-packaging.mjs` reads the release-assets directory, computes SHA256 per artifact and replaces `@VERSION@` / `@SHA256_*@` / `@RELEASE_DATE@` tokens in each template. No templating engine — literal `@TOKEN@` strings, so unfilled slots are trivially greppable. `packaging/README.md` documents the submission flow per channel plus a recipe for adding Homebrew / Flathub / Snap later.

### Fixed

#### In-app updater picked the wrong asset for MSI / portable / .deb / .rpm

The install-kind detector was hard-coded to check an env var (`PORTABLE_EXECUTABLE_DIR`) that our `windows-portable.zip` never sets, and had no branch at all for MSI or `.deb`. Portable users saw a hint (`-portable.exe`) that didn't match any published asset; MSI users got pointed at the NSIS `.exe`; `.deb` users got the AppImage.

Detection now reads `current_exe()` and matches against Tauri v2's default install directories:

- Windows: `%ProgramFiles%` (or `Program Files (x86)`) → MSI. `%LOCALAPPDATA%\Programs\` → NSIS. Anywhere else → portable zip.
- Linux: `$APPIMAGE` set → AppImage. Exe under `/usr/bin` or `/usr/local/bin` → `.deb` or `.rpm` (picked by reading `ID` / `ID_LIKE` from `/etc/os-release` — Fedora, RHEL, CentOS, Rocky, Alma, openSUSE, SUSE, Amazon Linux, Mandriva and Mageia go to `.rpm`).
- macOS unchanged (single `.app` bundle format; arch alone picks the DMG).

Only the frontend match string changes; the download + install-launch pipeline is untouched.

### Docs

- **Install section rewritten** — the three cramped bullets became per-OS tables (Windows / macOS / Linux) with a Package / File / Command / Notes column each. Every channel we publish (NSIS, MSI, portable ZIP, winget, arm64 DMG, x64 DMG, AppImage, `.deb`, `.rpm`, AUR) shows its exact filename, the command to run and any prerequisites.
- **`CHANGELOG.md` is now the source of truth for release notes.** The release workflow extracts the `## v<tag>` section from `CHANGELOG.md` and hands it to `tauri-action` as the release body, so future patch notes live in git alongside the code they describe.

### Full changelog

`v0.5.1...v0.5.2` on GitHub — https://github.com/TonyMontania/Omnio/compare/v0.5.1...v0.5.2

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
