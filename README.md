# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

![Omnio screenshot](https://github.com/user-attachments/assets/f7abdd85-ae6b-4deb-b1c1-00441e0456f3)

**Omnio** is a local desktop app to track your hobbies — games, music, movies, series, anime, donghua, manga, manhwa, manhua and western comics — all in one place. No accounts, no telemetry, no cloud. Your data lives in a `data/` folder next to the executable, portable enough to carry on a USB stick.

## What it does

- **10 libraries** in one app: Games, Music, Movies, Series, Anime, Donghua, Manga, Manhwa, Manhua, Western Comics.
- **One-click metadata + covers** from 9 sources — SteamGridDB, IGDB, TMDb, MusicBrainz + Cover Art Archive, VGMdb, AniList, MyAnimeList, Kitsu, MangaDex, ComicVine.
- **Bulk import**: MyAnimeList / AniList XML, plus `.xlsx`, `.csv` (Notion exports work as-is), `.tsv` and `.txt`.
- **Static HTML export** — share your library as a folder anyone can open in a browser.
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

**Portable builds** (portable EXE, tarball, AppImage) keep `data/` + `assets/` next to the executable — move the folder or drop it on a USB stick and your library travels with you. Installer builds follow each OS's standard data location.

## Keyboard shortcuts

- **Ctrl+K** — global search across every library
- **Ctrl+F** — search inside the current library
- **Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)** — undo / redo
- **F5** — refresh the current library (reload data from disk)
- **Shift+click** — multi-select cards
- **Esc** — close any modal / panel / detail view

## Highlights

- **Full-screen edit modal** with live preview on the left (card / detail) and a metadata-fetch panel at the top.
- **Move items between libraries** (bulk or single) — reassign a manga to manhwa, an anime to donghua, without re-typing.
- **Bulk actions**: select many cards, then change status, add/remove tags, add to group, move library, or delete in one click.
- **Rolling snapshots**: 5 automatic backups taken on each save; restore any of them from Settings.
- **Yearly heatmap + Wrapped** end-of-year recap.
- **Related items & franchise timelines** — link sequels, remakes, spin-offs, and see everything in the same franchise as a scrollable row.
- **Review with spoilers** toggle, separate from notes.
- **Play / watch / read / listen history** — full session log per item.
- **11 themes** (Dark, Light, AMOLED, Nord, Tokyo Night, Solarized Dark, Dracula, Catppuccin, Rosé Pine, Gruvbox, Everforest) × **8 accents**, plus density and font-size controls.

## Categories at a glance

- **Games** — banner + logo + cover, multiple devs/publishers, free-form platforms, playtime, achievements, DLC + bundles, edition, source (remake/remaster/port…), franchise, related games.
- **Music** — Single / EP / Album / OST / Live / Compilation, per-track rating + lyrics, single covers gallery, editions (Deluxe, Japan, Anniversary…), Spotify-style Artist profile with members and years active.
- **Movies** — directors, writers, cast, production, franchise, rewatch history, backdrop.
- **Series** — cast, directors, showrunners, seasons with per-episode tracking.
- **Anime & Donghua** — AniList-style card, studios, episodes watched/total, episode list with rating/notes, rewatch log.
- **Manga / Manhwa / Manhua / Western Comics** — authors + artists, chapters/volumes, volume covers gallery, chapter list, magazine.

For a full field-by-field reference (English + Spanish labels), see [`docs/FIELDS.md`](docs/FIELDS.md).

## Metadata sources

Nine sources are wired directly into the editors — click the **↗** button next to the cover field to search, pick and auto-fill. Keys go in **Settings → Data → Integrations**.

| Source | Library | Auth |
| --- | --- | --- |
| [SteamGridDB](https://www.steamgriddb.com/) | Games — covers, banners, logos, heroes | Free API key |
| [IGDB](https://www.igdb.com/) | Games — full metadata | Twitch Client ID + Secret (free) |
| [TMDb](https://www.themoviedb.org/) | Movies + Series | Free API key |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Music | No key |
| [VGMdb](https://vgmdb.net/) | Music — game/anime OSTs | No key |
| [AniList](https://anilist.co/) | Anime · Donghua · Manga · Manhwa · Manhua | No key |
| [MyAnimeList](https://myanimelist.net/) (via Jikan) | Anime · Manga | No key |
| [Kitsu](https://kitsu.app/) | Anime · Manga fallback | No key |
| [MangaDex](https://mangadex.org/) | Manga · Manhwa · Manhua | No key |
| [ComicVine](https://comicvine.gamespot.com/) | Western Comics | Free API key |

## Storage & portability

Your library lives in two folders next to the executable (or under the OS data dir for installer builds):

```
data/
  games.json  music.json  movies.json  series.json
  anime.json  donghua.json
  manga.json  manhwa.json  manhua.json  comics_west.json
  collections.json   ← groups
  artists.json       ← music artist profiles
  settings.json      customOrders.json
  backups/1..5/      ← 5 rotating snapshots
assets/
  games/cover/  games/banner/  games/logo/  games/bundle/
  music/cover/  movies/cover/  movies/banner/
  series/cover/  anime/cover/  manga/cover/  manga/volume/
  artists/photo/  ...
```

- **Split storage**: each library is its own JSON. Editing one game only rewrites `games.json` — corruption of one file leaves the rest intact.
- **Rolling backups**: every meaningful save rotates 5 snapshots. Restore from **Settings → Data**.
- **Asset filenames** use the item's title — e.g., `Hollow Knight cover.jpg`, `The Dark Side of the Moon cover.png` — so browsing `assets/` in Explorer / Finder is meaningful.
- **Truly portable**: drop the whole folder on a USB stick, take it anywhere.

## Settings tabs

- **Appearance** — theme, accent, density, font size, sidebar mode, motion.
- **Behavior** — confirm before deleting, startup category.
- **Libraries** — turn any of the 10 categories on/off.
- **Card Fields** — pick which fields show on cards, per library.
- **Data** — export/import backup JSON, snapshots (5 rotated), remote backup, duplicate finder, MAL/AniList import, Excel/CSV/Notion import, HTML export, Yearly Wrapped, API keys, updates, maintenance (clean migration leftovers, clean orphan assets), reset settings, delete all data.

## License

[MIT](LICENSE) — feel free to fork, modify and distribute.

Bug reports and feature requests → [issues](https://github.com/TonyMontania/Omnio/issues). PRs welcome.
