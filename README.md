# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/TonyMontania/Omnio?color=c9a227)](https://github.com/TonyMontania/Omnio/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/TonyMontania/Omnio/total.svg?color=c9a227)](https://github.com/TonyMontania/Omnio/releases)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

**Omnio** is a local desktop app to track your hobbies — games, music, movies, series, anime, donghua, manga, manhwa, manhua and western comics — all in one place. No accounts, no telemetry, no cloud. Your data lives in a `data/` folder next to the executable, portable enough to carry on a USB stick.

![Omnio — Full-screen tabbed editor with live preview and one-click metadata fetch](https://github.com/user-attachments/assets/ffba12f6-f3b2-44b2-a531-91d16c804204)
*Every item edits in a tabbed editor (Overview / Identity / Progress / Media / History / Related / Notes). Live card + detail preview stays pinned on the left; the metadata-fetch panel at the top pulls from IGDB / SteamGridDB / TMDb / AniList / MangaDex / MusicBrainz / Discogs / … in one click.*

![Omnio — Games library grid](https://github.com/user-attachments/assets/f16b4de2-d0b5-4d6e-972d-86fa5ae57f7c)
*The Games library — 176 covers at a glance, quick status chips (Backlog / Playing / Played / Completed / Dropped) in the topbar, alphabetized grid, and the same Add + Filters + Sort controls every library carries.*

![Omnio — Detail view with banner, franchise, bundle contents](https://github.com/user-attachments/assets/88b6a8dd-8f62-432d-8ce4-4c9742371b97)
*Detail view for a bundled release — banner, cover, description, status, source, age rating, groups, genres, platforms, ownership, playtime, and the individual games inside the collection, each linkable to its own entry.*

![Omnio — Home dashboard](https://github.com/user-attachments/assets/b5173ea8-5ed1-4c59-81e0-fa54bc5f04ba)
*Home dashboard — a portal card per active library with total / completed counters and the three most recent titles. Header shows a time-of-day greeting, and the topbar surfaces global Search, Calendar, Stats and Settings.*

![Omnio — Simulcast board for the current anime & donghua season](https://github.com/user-attachments/assets/bb150be5-e96e-410b-876a-ec196f80104c)
*Simulcast board — a 7-column weekday grid populated from each show's `Airs on` field, so the airing season is at a glance. Works across Anime and Donghua together.*

## What it does

- **11 libraries** in one app: Games, Music, Movies, Series, Anime, Donghua, Manga, Manhwa, Manhua, Western Comics, Books.
- **Home dashboard** — landing view with a portal card per library and a next-30-days upcoming releases panel. Optional startup screen.
- **Tabbed editor + fused top-nav** — every item edits inside Overview / Identity / Progress / Media / History / Related / Notes; the library header (title, count, status chips, view toggle, +Add) lives on a single top-nav row.
- **One-click metadata + covers** from 14 sources across the 11 libraries — AniDB, AniList, ComicVine, IGDB, Kitsu, lrclib, MangaDex, MusicBrainz (with Cover Art Archive), MyAnimeList, OpenLibrary, PCGamingWiki, SteamGridDB, TMDb, VGMdb.
- **Import**: MyAnimeList / AniList XML, Steam profile, Letterboxd, Kindle highlights (`My Clippings.txt`), Last.fm scrobbles, Trakt.tv, Discogs collection, Excel / CSV / Notion / TXT with Playnite / GOG / Goodreads vocab presets.
- **Export**: HTML site (search + light/dark toggle built in), MAL-compatible XML for anime + manga, iCal (.ics) for the release calendar.
- **In-app updater** — silent check at boot, one-click download of the exact build for your platform.
- **Local-first**: everything lives in `data/` + `assets/` next to the executable. No accounts, no cloud, no telemetry.

## Install

Download the latest build for your platform from the [releases page](https://github.com/TonyMontania/Omnio/releases/latest).

### Windows
- **Portable `.exe`** — drop it in a folder and run. `data/` and `assets/` are created next to it. On first launch, SmartScreen shows *"Windows protected your PC"* → click **More info** → **Run anyway**.
- **NSIS installer `.exe`** — classic setup wizard, data goes to `%APPDATA%\Omnio`.
- **winget**: `winget install TonyMontania.Omnio`
- **Scoop**: `scoop install omnio`
- **Chocolatey**: `choco install omnio`

### macOS
- **`.dmg`** (universal — Intel or Apple Silicon) — drag Omnio.app to Applications. First launch: right-click → **Open** to bypass Gatekeeper, or run `xattr -cr /Applications/Omnio.app` in Terminal.
- **Homebrew Cask**: `brew install --cask omnio`

### Linux
- **`.AppImage`** — `chmod +x` and run. May need `libfuse2` on Debian/Ubuntu.
- **`.deb`**: `sudo apt install ./Omnio-Linux-*.deb`
- **Flatpak**: `flatpak install flathub com.omnio.app`
- **Snap**: `sudo snap install omnio`
- **AUR**: `yay -S omnio-bin`

### Docker (headless / server)
The full Electron app runs inside a KasmVNC session in the container, and you reach it from any browser on your LAN. Meant for NAS setups (Unraid, TrueNAS Scale, Synology, Proxmox LXC) — on a normal desktop the native installer is still the better choice.

```bash
docker run -d --name omnio \
  -p 3000:3000 -p 3001:3001 \
  -v /path/to/omnio/config:/config \
  -e PUID=1000 -e PGID=1000 -e TZ=Etc/UTC \
  --shm-size=1gb \
  --restart unless-stopped \
  ghcr.io/tonymontania/omnio:latest
```

Then open <http://localhost:3000>. Your entire library (data + assets + snapshots) lives under the mounted `/config` folder.

A `docker-compose.yml`, an Unraid template and detailed NAS notes live in [`packaging/docker/`](packaging/docker/).

**Portable builds** (portable EXE, tarball, AppImage) keep `data/` + `assets/` next to the executable — move the folder or drop it on a USB stick and your library travels with you. Installer builds follow each OS's standard data location.

## Keyboard shortcuts

- **Ctrl+K** — global search across every library
- **Ctrl+F** — search inside the current library
- **Ctrl+H** — jump to Home dashboard
- **Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)** — undo / redo
- **F5** — refresh the current library (reload data from disk)
- **?** — show the shortcuts cheatsheet
- **Right-click** on any card — quick actions (open, edit, duplicate, move, delete)
- **Shift+click** — multi-select cards
- **Esc** — close any modal / panel / detail view

## Highlights

- **Tabbed editor** — every item edits inside Overview / Identity / Progress / Media / History / Related / Notes tabs. Empty tabs auto-hide so a lightly-annotated item stays lean.
- **Full-screen edit modal** with live preview on the left (card / detail) and a metadata-fetch panel at the top.
- **Move items between libraries** (bulk or single) — reassign a manga to manhwa, an anime to donghua, without re-typing.
- **Bulk actions**: select many cards, then change status, rating, add/remove tags or genres, add to group, move library, or delete in one click.
- **Cross-library "similar to"** — link a manga to its anime adaptation, a game to the book it's based on. Each result carries a category badge.
- **Per-item JSON export** — right-click any card or use the Export button in a detail modal to share one entry's full spec as JSON.
- **Rolling snapshots**: 5 automatic backups taken on each save; restore any of them from Settings.
- **Yearly heatmap + Wrapped** end-of-year recap.
- **Related items & franchise timelines** — link sequels, remakes, spin-offs, and see everything in the same franchise as a scrollable row.
- **Simulcast board** for airing anime + donghua — 7-column weekday grid, populated from the `Airs on` field.
- **Data health audit** — Settings → Data → Maintenance scans every item and flags what's missing (cover, rating, status, authors, release year, …) per library.
- **Genre normalizer** — merge duplicate genre labels ("Sci-Fi" / "Science Fiction" / "Ciencia ficción") into a canonical form across the whole library in one pass.
- **Review with spoilers** toggle, separate from notes.
- **Play / watch / read / listen history** — full session log per item.
- **11 themes** (Dark, Light, AMOLED, Nord, Tokyo Night, Solarized Dark, Dracula, Catppuccin, Rosé Pine, Gruvbox, Everforest) × **8 accents**, plus density and font-size controls.

## Categories at a glance

Sorted alphabetically — the way the app itself lists them.

- **Anime & Donghua** — AniList-style card, studios, episodes watched/total, episode list with rating/notes, rewatch log, per-item **banner image**, **AniDB deep-fetch** for weighted tags + tighter cross-refs (coexists with AniList / MAL / Kitsu), and a weekday-slotted **simulcast board** for the airing season.
- **Books** — authors, publisher, series/saga, pages read/total, ISBN, format (paperback / hardcover / ebook / audiobook), reread history, **per-chapter notes**, **Kindle highlights** imported from `My Clippings.txt`. OpenLibrary metadata + covers, no key needed.
- **Games** — banner + logo + cover, multiple devs/publishers, free-form platforms, playtime, DLC + bundles, edition, source (remake/remaster/port…), franchise, related games, **detailed achievement list** with per-entry unlocked date, **screenshots gallery** with click-to-view lightbox, **save file backup** stored under `assets/games/saves/`, and inline **PCGamingWiki save + config paths** so you know where the game keeps its data.
- **Manga / Manhwa / Manhua / Western Comics** — authors + artists, chapters/volumes, volume covers gallery with lightbox, chapter list with per-chapter **scanlator** attribution, magazine, per-item **banner image**, **physical / digital ownership** tracker, direct link to the title's MangaDex page for new-chapter follow.
- **Movies** — directors, writers, cast, production, franchise, rewatch history, backdrop, **streaming availability** + **physical media type** (Blu-Ray / 4K UHD / DVD / VHS / Digital), **Letterboxd** CSV import.
- **Music** — Single / EP / Album / OST / Live / Compilation, per-track rating + **one-click lyrics fetch (lrclib.net, no key)**, single covers gallery, editions (Deluxe, Japan, Anniversary…), Spotify-style Artist profile in a tabbed modal with **multi-stint role periods** per member and a † **deceased mark**, **vinyl condition** (Goldmine grading), **concert log** with venue + setlist per attended show, **Last.fm scrobbles** + **Discogs collection** import.
- **Series** — cast, directors, showrunners, seasons with per-episode tracking, **Sub/Dub** tracker, **Trakt.tv** watched-history import.

For a full field-by-field reference (English + Spanish labels), see [`docs/FIELDS.md`](docs/FIELDS.md).

## Metadata sources

14 sources wired directly into the editors — click the **↗** button on the "Fetch metadata" panel to search, pick and auto-fill. Keys go in **Settings → Data → Integrations**. Sorted alphabetically.

| Source | Library | Auth |
| --- | --- | --- |
| [AniDB](https://anidb.net/) | Anime · Donghua — weighted tags, tighter cross-refs (paste AID) | Registered client name |
| [AniList](https://anilist.co/) | Anime · Donghua · Manga · Manhwa · Manhua | No key |
| [ComicVine](https://comicvine.gamespot.com/) | Western Comics | Free API key |
| [IGDB](https://www.igdb.com/) | Games — full metadata | Twitch Client ID + Secret (free) |
| [Kitsu](https://kitsu.app/) | Anime · Manga fallback | No key |
| [lrclib](https://lrclib.net/) | Music — per-track lyrics (synced when available) | No key |
| [MangaDex](https://mangadex.org/) | Manga · Manhwa · Manhua | No key |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Music | No key |
| [MyAnimeList](https://myanimelist.net/) (via Jikan) | Anime · Manga | No key |
| [OpenLibrary](https://openlibrary.org/) | Books | No key |
| [PCGamingWiki](https://www.pcgamingwiki.com/) | Games — save + config paths per OS | No key |
| [SteamGridDB](https://www.steamgriddb.com/) | Games — covers, banners, logos, heroes | Free API key |
| [TMDb](https://www.themoviedb.org/) | Movies + Series | Free API key |
| [VGMdb](https://vgmdb.net/) | Music — game/anime OSTs | No key |

## Storage & portability

Your library lives in two folders next to the executable (or under the OS data dir for installer builds):

```
data/
  games.json  music.json  movies.json  series.json  books.json
  anime.json  donghua.json
  manga.json  manhwa.json  manhua.json  comics_west.json
  collections.json   ← groups
  artists.json       ← music artist profiles
  settings.json      customOrders.json
  backups/1..5/      ← 5 rotating snapshots
assets/
  games/cover/  games/banner/  games/logo/  games/bundle/
  games/saves/<title>/…    ← user-uploaded save files per game
  games/screenshots/<title>/…  ← per-game screenshot gallery
  music/cover/  movies/cover/  movies/banner/
  series/cover/  anime/cover/  manga/cover/  manga/volume/
  artists/photo/  ...
```

- **Split storage**: each library is its own JSON. Editing one game only rewrites `games.json` — corruption of one file leaves the rest intact.
- **Rolling backups**: every meaningful save rotates 5 snapshots. Restore from **Settings → Data**.
- **Asset filenames** use the item's title — e.g., `Hollow Knight cover.jpg`, `The Dark Side of the Moon cover.png` — so browsing `assets/` in Explorer / Finder is meaningful.
- **Truly portable**: drop the whole folder on a USB stick, take it anywhere.

## Settings tabs

- **Appearance** — theme, accent, density, font size, card zoom, motion.
- **Behavior** — confirm before deleting, startup screen (Home dashboard / last category / first category), remember sort per library.
- **Libraries** — turn any of the 11 categories on/off.
- **Card Fields** — pick which fields show on cards, per library.
- **Data** — backup & restore (JSON + assets folder), snapshots (5 rotated), remote backup, import (MAL/AniList XML, Excel/CSV/Notion, Steam profile, **Letterboxd**, **Kindle highlights**, **Last.fm scrobbles**, **Trakt.tv**, **Discogs collection**), export (HTML, MAL XML for anime/manga, iCal for calendar), Yearly Wrapped with PNG export, API keys, updates, maintenance (find broken covers, rename all assets, clean orphans, **duplicate finder**, **genre normalizer**, **incomplete-items audit**), reset settings, delete all data.

## Build from source

Omnio is an Electron + React + Vite + TypeScript app. Requires **Node.js 18+** and **npm 9+**.

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev        # launches Vite + Electron in dev mode with HMR
npm run build      # type-check, bundle, and produce an installer/portable
                   # for the current platform via electron-builder
npm run lint       # ESLint (zero-warning gate)
```

Build artifacts land in `release/`. See [`electron-builder.json5`](electron-builder.json5) for per-target settings.

## Privacy

Omnio is local-first: your library never leaves your machine.

- **No accounts, no telemetry, no analytics.** Nothing is sent home.
- **Outbound requests happen only when you trigger them**: (1) metadata lookups against the 14 sources listed above — one request per search you run in an editor; (2) the in-app updater checks GitHub Releases at startup and when you press "Check for updates".
- **API keys** you paste into Settings → Data → Integrations are stored in `data/settings.json` on your disk and used only to sign the corresponding source's requests.
- **No third-party trackers** are embedded in the app or the exported HTML site.

## Changelog

Release notes for every version live on the [releases page](https://github.com/TonyMontania/Omnio/releases). Each build lists new features, fixes and any migration steps.

## License

[MIT](LICENSE) — feel free to fork, modify and distribute.

---

- Bug reports and feature requests → [issues](https://github.com/TonyMontania/Omnio/issues)
- Want to contribute? → [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Found a security issue? → [SECURITY.md](SECURITY.md)
