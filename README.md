# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/TonyMontania/Omnio?color=c9a227)](https://github.com/TonyMontania/Omnio/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/TonyMontania/Omnio/total.svg?color=c9a227)](https://github.com/TonyMontania/Omnio/releases)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

**Omnio** is a local desktop app to track every hobby you follow — games, music, movies, series, anime, donghua, manga family, books and visual novels — in one place. No accounts, no cloud, no telemetry. Your library lives in a `data/` folder you own.

![Omnio — Full-screen tabbed editor with live preview and one-click metadata fetch](https://github.com/user-attachments/assets/ffba12f6-f3b2-44b2-a531-91d16c804204)
*Tabbed editor (Overview / Identity / Progress / Media / History / Related / Notes) with live preview + one-click metadata fetch from 13 sources.*

![Omnio — Games library grid](https://github.com/user-attachments/assets/f16b4de2-d0b5-4d6e-972d-86fa5ae57f7c)

![Omnio — Home dashboard](https://github.com/user-attachments/assets/b5173ea8-5ed1-4c59-81e0-fa54bc5f04ba)

## Install

Download the build for your platform from the [releases page](https://github.com/TonyMontania/Omnio/releases/latest). All builds are unsigned — SmartScreen / Gatekeeper show a first-launch warning that clears with one confirmation.

- **Windows** — `Omnio_<version>_x64-setup.exe` (NSIS, per-user, no admin) or `.msi` for group-policy rollouts. Data lives under `%APPDATA%\com.omnio.app\`.
- **macOS** — `Omnio_<version>_aarch64.dmg` (Apple Silicon) or `_x64.dmg` (Intel). Drag Omnio.app to Applications. First launch: right-click → **Open** to bypass Gatekeeper.
- **Linux** — `omnio_<version>_amd64.AppImage` (may need `libfuse2` on Debian/Ubuntu) or `.deb` (`sudo dpkg -i omnio_<version>_amd64.deb`).

## Features

- **12 libraries** — Games · Music · Movies · Series · Anime · Donghua · Manga · Manhwa · Manhua · Western Comics · Books · Visual Novels
- **One-click metadata + covers** from 13 sources (see table below). Cached locally for 24 h.
- **Tabbed editor** — Overview / Identity / Progress / Media / History / Related / Notes. Empty tabs auto-hide.
- **Full-screen edit modal** with live card + detail preview on the left; per-source fetcher panel at the top.
- **Home widget board** — customizable dashboard with "in progress" / "upcoming" / "recently rated" widgets + per-library portals.
- **Arcade section** — score / 1cc tracker for shmups and arcade games. Grid mode adapted from [doopu/1ccTracker](https://github.com/doopu/1ccTracker).
- **Bulk actions** — multi-select cards to change status, rating, tags, groups, or move between libraries in one click.
- **Tag hierarchy** — nest tags (`jrpg → turn-based`); filtering a parent matches every descendant.
- **Global search (Ctrl+K)** across every library with operator syntax (`favorite:true`, `year:>2020`, `status:playing`).
- **Import** — MAL / AniList XML, Steam, Letterboxd, Backloggd, Serializd, Spotify, Kindle highlights, Last.fm, Trakt.tv, Discogs, Excel / CSV / Notion with Playnite / GOG / Goodreads presets.
- **Export** — static HTML site (searchable, light/dark), MAL XML, iCal for release calendar, per-category CSV, Yearly Wrapped PNG.
- **Rolling backups** — 5 automatic snapshots per save, restore any of them from Settings.
- **HTTP proxy** — routes every outbound request (metadata / covers / updater) through a configured proxy.
- **In-app updater** — checks GitHub Releases, downloads the matching build for your platform.
- **11 themes × 8 accents** — Dark / Light / AMOLED / Nord / Tokyo Night / Solarized Dark / Dracula / Catppuccin / Rosé Pine / Gruvbox / Everforest, plus density + font-size controls.
- **Fully local** — no accounts, no telemetry, no analytics. Data lives in `data/` + `assets/` under your OS's app data folder (or next to the executable for portable builds).

## Metadata sources

Click the **↗** button on the "Fetch metadata" panel to search, pick and auto-fill. API keys (only for the sources that require them) go in **Settings → Data → Integrations**. Full field-coverage matrix in [`docs/FETCHER_FIELDS.md`](docs/FETCHER_FIELDS.md).

| Source | Library | Auth |
| --- | --- | --- |
| [AniDB](https://anidb.net/) | Anime · Donghua — weighted tags, tighter cross-refs (paste AID) | Registered client name |
| [AniList](https://anilist.co/) | Anime · Donghua · Manga family | No key |
| [ComicVine](https://comicvine.gamespot.com/) | Western Comics | Free API key |
| [IGDB](https://www.igdb.com/) | Games — full metadata + source inference (Remake/Remaster/Port…) | Twitch Client ID + Secret (free) |
| [Kitsu](https://kitsu.app/) | Anime · Manga fallback — supplies age rating that AniList lacks | No key |
| [lrclib](https://lrclib.net/) | Music — per-track lyrics (synced when available) | No key |
| [MangaDex](https://mangadex.org/) | Manga family — also fills MangaDex ID for the "new chapters" deep link | No key |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Music — title, artist, tracklist, producers, cover art | No key |
| [OpenLibrary](https://openlibrary.org/) | Books — title, authors, description, publisher, ISBN, cover | No key |
| [PCGamingWiki](https://www.pcgamingwiki.com/) | Games — save + config paths per OS | No key |
| [SteamGridDB](https://www.steamgriddb.com/) | Games — covers, banners, logos, heroes | Free API key |
| [TMDb](https://www.themoviedb.org/) | Movies + Series | Free API key |
| [VNDB](https://vndb.org/) | Visual Novels — description, aliases, engine, tags, screenshots, characters + staff, multi-region covers, relations | No key |

## Storage

Your library lives in two folders under the OS's app data directory (or next to the executable for portable builds):

```
data/
  games.json  music.json  movies.json  series.json
  anime.json  donghua.json
  manga.json  manhwa.json  manhua.json  comics_west.json
  books.json  visual_novels.json
  collections.json  artists.json  arcadeGames.json
  settings.json  customOrders.json
  cache/searches.json    ← 24 h TTL of metadata search results
  backups/1..5/          ← 5 rotating snapshots
assets/
  <category>/<kind>/<filename>
  games/saves/<title>/…      ← per-game save files
  games/screenshots/<title>/…
```

Each library is its own JSON — editing one game only rewrites `games.json`, so corruption of one file leaves the rest intact. Asset filenames use the item's title (`Hollow Knight cover.jpg`) so browsing `assets/` in Explorer / Finder stays meaningful.

## Keyboard shortcuts

- **Ctrl+K** — global search across every library
- **Ctrl+F** — search inside the current library
- **Ctrl+H** — Home dashboard
- **Ctrl+Z / Ctrl+Shift+Z** — undo / redo
- **F5** — reload data from disk
- **?** — full shortcut cheatsheet
- **Right-click** — quick actions on any card
- **Shift+click** — multi-select
- **Esc** — close modal / panel

## Build from source

Omnio is a Tauri (Rust) + React + Vite + TypeScript app. Requires **Node.js 22+**, **npm 10+**, **Rust stable** (via [rustup](https://rustup.rs/)) and the platform's C toolchain: Visual Studio Build Tools with "Desktop development with C++" on Windows, Xcode Command Line Tools on macOS, `build-essential` + `libwebkit2gtk-4.1-dev` on Linux.

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

Build artifacts land in `src-tauri/target/release/bundle/` (`nsis/*.exe`, `msi/*.msi`, `dmg/*.dmg`, `appimage/*.AppImage`, `deb/*.deb`). Bundle configuration lives in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).

## Privacy

- **No accounts, no telemetry, no analytics.** Nothing is sent home.
- **Outbound requests only when you trigger them** — metadata lookups (one request per search you run) and the update check against GitHub Releases at startup.
- **API keys** you paste into Settings → Data → Integrations live in `data/settings.json` on your disk and are only used to sign that source's requests.
- **No third-party trackers** in the app or in the exported HTML site.

## Credits

- **Arcade → Grid mode** is a reimplementation of [doopu/1ccTracker](https://github.com/doopu/1ccTracker) — same visual language and per-cell flag vocabulary (1cc / no-miss / no-bomb / pacifist / all-clear / extra-clear), integrated into Omnio's data model.

## License

[MIT](LICENSE) — feel free to fork, modify and distribute.

---

- Bugs / feature requests → [issues](https://github.com/TonyMontania/Omnio/issues)
- Want to contribute? → [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security → [SECURITY.md](SECURITY.md)
- Full field-by-field reference → [`docs/FIELDS.md`](docs/FIELDS.md)
- Changelog → [releases page](https://github.com/TonyMontania/Omnio/releases)
