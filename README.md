# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/TonyMontania/Omnio?color=c9a227)](https://github.com/TonyMontania/Omnio/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/TonyMontania/Omnio/total.svg?color=c9a227)](https://github.com/TonyMontania/Omnio/releases)
[![Tests](https://github.com/TonyMontania/Omnio/actions/workflows/test.yml/badge.svg)](https://github.com/TonyMontania/Omnio/actions/workflows/test.yml)
[![Lint](https://github.com/TonyMontania/Omnio/actions/workflows/lint.yml/badge.svg)](https://github.com/TonyMontania/Omnio/actions/workflows/lint.yml)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

**Omnio** is a local desktop app to track every hobby you follow — games, music, movies, series, anime, donghua, manga family, books and visual novels — in one place. No accounts, no cloud, no telemetry. Your library lives in a `data/` folder you own.

## Contents

- [Install](#install)
- [See it in action](#see-it-in-action)
- [Features](#features)
- [Metadata sources](#metadata-sources)
- [Storage](#storage)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Privacy](#privacy)
- [Credits](#credits)
- [License](#license)

## Install

Download the build for your platform from the [releases page](https://github.com/TonyMontania/Omnio/releases/latest). All builds are unsigned — SmartScreen / Gatekeeper show a first-launch warning that clears with one confirmation.

- **Windows** — `Omnio_<version>_x64-setup.exe` (NSIS, per-user, no admin), `.msi` for group-policy rollouts, or `Omnio_<version>_windows-portable.zip` (needs WebView2, included by default on Windows 10 21H2+ and every Windows 11). Also on **[winget](https://github.com/microsoft/winget-pkgs)**: `winget install TonyMontania.Omnio`. Data lives under `%APPDATA%\com.omnio.app\`.
- **macOS** — `Omnio_<version>_aarch64.dmg` (Apple Silicon) or `_x64.dmg` (Intel). Drag Omnio.app to Applications. First launch: right-click → **Open** to bypass Gatekeeper.
- **Linux** — `omnio_<version>_amd64.AppImage` (may need `libfuse2` on Debian/Ubuntu), `omnio_<version>_amd64.deb` (`sudo dpkg -i …`) or `omnio-<version>-1.x86_64.rpm` (`sudo dnf install …`). Arch users: **[`omnio-bin`](https://aur.archlinux.org/packages/omnio-bin)** on the AUR.

Building from source? See [CONTRIBUTING.md → Running locally](CONTRIBUTING.md#running-locally).

## See it in action

<!-- Prefer a short GIF here (add → fetch metadata → save flow). Replace this comment with an <img> once recorded. -->

![Omnio — Home dashboard](https://github.com/user-attachments/assets/b5173ea8-5ed1-4c59-81e0-fa54bc5f04ba)
*Home dashboard — customizable widget board with per-library portals + "in progress" / "upcoming" / "recently rated" widgets.*

![Omnio — Games library grid](https://github.com/user-attachments/assets/f16b4de2-d0b5-4d6e-972d-86fa5ae57f7c)
*Library grid — cover-first browsing with filters, tag hierarchy, custom sort, and bulk actions.*

![Omnio — Tabbed editor with live preview](https://github.com/user-attachments/assets/ffba12f6-f3b2-44b2-a531-91d16c804204)
*Tabbed editor (Overview / Identity / Progress / Media / History / Related / Notes) with live preview + one-click metadata fetch from 13 sources.*

## Features

<table>
<tr>
<td width="33%" valign="top">

**Track**

- **12 libraries** — Games · Music · Movies · Series · Anime · Donghua · Manga · Manhwa · Manhua · Western Comics · Books · Visual Novels
- **Tabbed editor** (Overview / Identity / Progress / Media / History / Related / Notes). Empty tabs auto-hide
- **Full-screen edit modal** with live card + detail preview
- **Bulk actions** — multi-select cards to change status, rating, tags, groups or move between libraries
- **Tag hierarchy** — nest tags (`jrpg → turn-based`); filtering a parent matches every descendant
- **Half-star ratings** in 0.5 steps
- **Item templates** — save the defaults you want prefilled per category

</td>
<td width="33%" valign="top">

**Discover**

- **One-click metadata + covers** from 13 sources (see below). Cached locally for 24 h
- **Quick-add via URL** — paste an IGDB / TMDb / AniList / VNDB / Steam URL into the title field, the fetcher opens pre-filled
- **Global search (Ctrl+K)** across every library with operator syntax (`favorite:true`, `year:>2020`, `status:playing`)
- **Home widget board** — customizable dashboard with "in progress" / "upcoming" / "recently rated" + per-library portals
- **Arcade section** — score / 1cc tracker for shmups and arcade games. Grid mode adapted from [doopu/1ccTracker](https://github.com/doopu/1ccTracker)

</td>
<td width="33%" valign="top">

**Own your data**

- **Fully local** — no accounts, no telemetry, no analytics
- **Import** — MAL / AniList XML, Steam, Letterboxd, IMDb, Backloggd, Serializd, Spotify, RateYourMusic, Kindle highlights, Last.fm, Trakt.tv, Discogs, StoryGraph, HowLongToBeat, Excel / CSV / Notion / TXT with Playnite / GOG / Goodreads presets
- **Export** — static HTML site (searchable, light/dark), MAL XML, iCal for release calendar, per-category CSV, Yearly Wrapped PNG
- **Rolling backups** — 5 automatic snapshots per save, restore any of them
- **In-app updater** — checks GitHub Releases, downloads the matching build
- **HTTP proxy** support for every outbound request
- **11 themes × 8 accents** — Dark / Light / AMOLED / Nord / Tokyo Night / Solarized / Dracula / Catppuccin / Rosé Pine / Gruvbox / Everforest

</td>
</tr>
</table>

## Metadata sources

Click the **↗** button on the "Fetch metadata" panel to search, pick and auto-fill. API keys (only for the sources that require them) go in **Settings → Integrations**. Full field-coverage matrix in [`docs/FETCHER_FIELDS.md`](docs/FETCHER_FIELDS.md).

Sources are grouped by the library they feed. Anything marked *No key* works out of the box.

**Games**

| Source | What it fills | Auth |
| --- | --- | --- |
| [IGDB](https://www.igdb.com/) | Full metadata + source inference (Remake / Remaster / Port…) | Twitch Client ID + Secret (free) |
| [SteamGridDB](https://www.steamgriddb.com/) | Covers, banners, logos, heroes | Free API key |
| [PCGamingWiki](https://www.pcgamingwiki.com/) | Save + config paths per OS | No key |

**Movies & Series**

| Source | What it fills | Auth |
| --- | --- | --- |
| [TMDb](https://www.themoviedb.org/) | Titles, cast, crew, backdrops, runtime, seasons + episodes | Free API key |

**Anime & Donghua**

| Source | What it fills | Auth |
| --- | --- | --- |
| [AniList](https://anilist.co/) | Full metadata, tags, relations | No key |
| [AniDB](https://anidb.net/) | Weighted tags, tighter cross-refs (paste AID) | Registered client name |
| [Kitsu](https://kitsu.app/) | Age rating fallback that AniList lacks | No key |

**Manga · Manhwa · Manhua · Western Comics**

| Source | What it fills | Auth |
| --- | --- | --- |
| [AniList](https://anilist.co/) | Full metadata for manga family | No key |
| [MangaDex](https://mangadex.org/) | Full metadata + MangaDex ID for "new chapters" deep link | No key |
| [Kitsu](https://kitsu.app/) | Manga fallback | No key |
| [ComicVine](https://comicvine.gamespot.com/) | Western Comics (Marvel, DC, Image, indies) | Free API key |

**Music**

| Source | What it fills | Auth |
| --- | --- | --- |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Title, artist, tracklist, producers, cover art | No key |
| [lrclib](https://lrclib.net/) | Per-track lyrics (synced when available) | No key |

**Books**

| Source | What it fills | Auth |
| --- | --- | --- |
| [OpenLibrary](https://openlibrary.org/) | Title, authors, description, publisher, ISBN, cover | No key |

**Visual Novels**

| Source | What it fills | Auth |
| --- | --- | --- |
| [VNDB](https://vndb.org/) | Description, aliases, engine, tags, screenshots, characters + staff, multi-region covers, relations | No key |

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

## Privacy

- **No accounts, no telemetry, no analytics.** Nothing is sent home.
- **Outbound requests only when you trigger them** — metadata lookups (one request per search you run) and the update check against GitHub Releases at startup.
- **API keys** you paste into Settings → Integrations live in `data/settings.json` on your disk and are only used to sign that source's requests.
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
