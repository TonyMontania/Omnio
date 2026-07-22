# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

**English** · [Español](README.es.md)

![Omnio screenshot](https://github.com/user-attachments/assets/f7abdd85-ae6b-4deb-b1c1-00441e0456f3)

**Omnio** is a local-first desktop app to track your hobbies — games, music, movies, series, anime, donghua, manga, manhwa, manhua and western comics — all in one place. No accounts, no telemetry, no cloud. Your data lives in a `data/` folder next to the executable, portable enough to carry on a USB stick.

The UI is in English. For a field-by-field reference in English and Spanish, see [`docs/FIELDS.md`](docs/FIELDS.md).

## Highlights

- **10 libraries** with rich per-category fields (see [Categories](#categories))
- **9 metadata sources wired in-app** covering every library — SteamGridDB + IGDB (games), TMDb (movies + series), MusicBrainz/CAA + VGMdb (music), AniList + MAL + Kitsu (anime), MangaDex + ComicVine for the comics family (see [Metadata sources](#metadata--artwork-sources))
- **Bulk import** from MyAnimeList / AniList XML exports
- **Global search Ctrl+K**, bulk actions (Shift+click), undo/redo (Ctrl+Z)
- **Split storage** since 0.1.7: one JSON per library slice, editing one game only rewrites `games.json`, corruption of one file leaves the rest intact
- **5 rotating snapshots** auto-taken on each save; 1-click restore
- **Yearly heatmap + Wrapped** end-of-year recap in Statistics
- **Static HTML export** to share your library as a folder anyone can open
- **Six themes**, eight accents, density + font-size controls, six-language-neutral iconography

## Contents

- [Install](#install)
- [Categories](#categories)
- [Metadata & artwork sources](#metadata--artwork-sources)
- [Power features](#cross-cutting-features)
- [Statistics](#statistics-per-category)
- [Settings](#settings)
- [UI](#ui)
- [Storage & portability](#storage--portability)
- [Development](#development)

## Install

Download from the [latest release](https://github.com/TonyMontania/Omnio/releases/latest) and pick your platform.

### Windows

**Portable `.exe`** — recommended (USB-stick mode)
1. Download `Omnio-*-portable.exe`, drop it in a folder of your choice.
2. Double-click to run. `data.json` and `assets/` are created next to it on first run.
3. First launch: SmartScreen will show *"Windows protected your PC"* — click **More info** → **Run anyway**. It's an unsigned open-source build; you can inspect and rebuild the source yourself if you prefer.

**NSIS installer `.exe`** — classic Setup wizard with Start Menu entry and uninstaller.
1. Download `Omnio-*-setup.exe` and run it.
2. Data goes to `%APPDATA%\Omnio` (NOT next to the executable). If you want the portable USB behavior, use the portable build instead.

**winget** — from any terminal:
```powershell
winget install TonyMontania.Omnio
```

**Scoop** (community bucket — portable-friendly):
```powershell
scoop install omnio
```

**Chocolatey**:
```powershell
choco install omnio
```

### macOS (universal Intel + Apple Silicon)

**`.dmg`** — recommended
1. Download `Omnio-Mac-*-x64.dmg` (Intel) or `Omnio-Mac-*-arm64.dmg` (Apple Silicon) and drag Omnio.app to Applications.
2. First launch: Gatekeeper will say *"Omnio can't be opened because Apple cannot check it for malicious software"*. To bypass:
   - **Right-click** the app → **Open** → confirm in the dialog. Or:
   - In Terminal: `xattr -cr /Applications/Omnio.app` and launch normally.

**`.zip`** — drag-and-drop the `.app` without mounting a disk image. Same Gatekeeper step applies.

**Homebrew Cask**:
```bash
brew install --cask omnio
```

### Linux

**`.AppImage`** — works on every distro
1. Download `Omnio-Linux-*.AppImage`.
2. `chmod +x Omnio-Linux-*.AppImage`
3. Double-click or run from terminal. Some distros need `libfuse2` (`sudo apt install libfuse2` on Debian/Ubuntu).

**Debian / Ubuntu / Mint (`.deb`)**
```bash
sudo apt install ./Omnio-Linux-*.deb
```

**Tarball (`.tar.gz`)** — extract anywhere and run `./omnio`. Portable, no root required.

**Flatpak (Flathub)**
```bash
flatpak install flathub com.omnio.app
flatpak run com.omnio.app
```

**Snap**
```bash
sudo snap install omnio
```

**Arch / Manjaro (AUR)**
```bash
yay -S omnio-bin      # or: paru -S omnio-bin
```

### Portability

The portable, tarball and AppImage builds keep `data/` + `assets/` next to the executable — move the folder between machines or drop it on a USB stick and your library travels with you. The NSIS installer, Homebrew Cask, `.deb`, Flatpak, Snap and AUR builds follow each OS's standard data location (`%APPDATA%`, `~/Library/Application Support/Omnio`, `~/.config/Omnio`, etc.); use **Settings → Data → Export** to move a library between install methods.

## Tech stack

- **Electron 30** + **React 18** + **Vite 5** + **TypeScript 5**
- Main process under `electron/`, renderer under `src/`
- Local storage: split JSON per category under `data/` + an `assets/` folder holding images per category/kind. Editing one item only rewrites its slice; on-demand modals are code-split via React.lazy so the initial bundle stays lean and cold-start is fast
- No backend, no external APIs
- Typography: Fraunces (display) + Inter (body) + IBM Plex Mono (labels/data)

## Categories

### Games
Infinitebacklog-style card: banner + logo, cover, description, **multiple developers and publishers**, **free-form platforms** (create your own, with suggestions + autocomplete), ownership, status (Backlog / Playing / Played / Completed / Dropped), time played, half-step rating, **achievements unlocked / total**, DLC/Expansions and Addons with their own status, **bundle contents** (for collections like MGS HD Collection — each sub-game has its own cover and status you can track independently), mini-markdown notes, tags. **Extended**: alternative titles, source (Original / Remake / Remaster / Reboot / Port / Sequel / Spin-off / Standalone expansion / Expanded / Collection), **edition** (free-text — Standard, Deluxe, Collector's, whatever), ESRB age rating, franchise, review with spoiler toggle, replay history, related games with rich relation kinds (sequel, prequel, standalone, DLC, remake, reboot, port, collection, same universe, crossover…), auto franchise timeline, recommendations.

### Music
Cards per type (Single / EP / Album / OST / Live / Compilation), tracklist with per-track rating, favorite, listened, and a **per-track Lyrics button** (modal to read/edit lyrics). Auto-computed total duration for album-like types. **Single covers gallery** — separate artwork for singles released before/around the album (title + year + image). **Editions** — Deluxe, Japan, Anniversary and others, each with its own cover image and its own tracklist (extra or alternate tracks). Spotify-style Artist profile: banner + circular avatar (shown on the Artists overview too), chronological discography, average rating, **band info** (origin, status, years active, genres, labels, current + former members with per-member roles **and join / leave years**). Listened / Not listened collections. **Extended**: alternative titles, source, producers, review with spoilers, listen history, related albums, recommendations.

### Movies
Directors, **writers**, cast, **production companies**, **distributed by**, franchise, watched + rewatch count, review with spoiler toggle, backdrop image. **Extended**: alternative titles, source (Original / Book / Comic / Game / True story / Remake / Sequel), content rating, watched where, full rewatch history log, related movies, franchise timeline, recommendations.

### Series
Its own Anime-style card — cast, directors, showrunners, writers, network, country, language, content rating. **Nested season list** with optional episodes per season (number/title/year/total eps, watched, rating, notes). Automatic migration from the old flat `units[]` checklist system. Related series, franchise timeline, recommendations, rewatch history, review with spoilers.

### Anime & Donghua
Collapsible sidebar group with two independent sub-libraries (**Anime** and **Donghua**) sharing an AniList/MAL-style card: studios, format (TV/Movie/OVA/ONA/Special/Music Video), airing status, season + year, demographic, watch status (Plan to watch / Watching / Completed / Paused / Dropped), episodes watched/total, aired-from/to, rating, notes. **Extended**: alternative titles, source (Manga/Light novel/Web novel/Novel/Original/Game/Visual novel), ESRB age rating, ep. duration + auto total runtime, aired range, favorite episode + note, conditional dropped-at info, **episode list** with watched/rating/filler/notes, review with spoilers, rewatch history, related with relation kind, franchise timeline, recommendations.

### Comics & Manga
Four independent sub-libraries (Manga, Manhwa, Manhua, Western Comics) sharing an AniList/MAL-style card: authors + artists, genres, publication status, reading status, chapters and volumes read/total, volume covers gallery, rating, notes. **Extended**: alternative titles, source, ESRB age rating, magazine/serialization, **chapter list** with read/rating/notes, review with spoilers, reread history, related manga with relation kind, franchise timeline, recommendations.

## Metadata & artwork sources

Nine sources are wired directly into the editors — click the **↗** button next to the cover field to search, pick, and auto-fill. Keys go in **Settings → Data → Integrations**; sources marked *no key* work out of the box. Covers/banners are downloaded to `assets/` on the fly.

| Source | Library | In-app | Auth |
| --- | --- | --- | --- |
| [SteamGridDB](https://www.steamgriddb.com/) | Games — covers, banners, logos, heroes | **↗ Integrated** | free API key |
| [IGDB](https://www.igdb.com/) (via Twitch) | Games — full metadata: devs, publishers, platforms, genres, franchises, dates | **↗ Integrated** | Twitch Client ID + Secret (free) |
| [TMDb](https://www.themoviedb.org/) | Movies + Series — cast, crew, seasons, cover, backdrop, dates, genres, networks | **↗ Integrated** | free v3 API key |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Music — releases, tracklists, artists, labels + cover | **↗ Integrated** | no key |
| [VGMdb](https://vgmdb.net/) (via [vgmdb.info](https://vgmdb.info/)) | Music — game & anime soundtracks, Japanese releases | **↗ Integrated** | no key |
| [AniList](https://anilist.co/) | Anime · Donghua · Manga · Manhwa · Manhua — metadata + cover + banner | **↗ Integrated** | no key |
| [MyAnimeList](https://myanimelist.net/) via [Jikan](https://jikan.moe/) | Anime · Manga — metadata, cover, authors, magazine | **↗ Integrated** | no key |
| [Kitsu](https://kitsu.app/) | Anime · Manga fallback when AniList/MAL miss a title | **↗ Integrated** | no key |
| [MangaDex](https://mangadex.org/) | Manga · Manhwa · Manhua — including obscure titles + scanlations | **↗ Integrated** | no key |
| [ComicVine](https://comicvine.gamespot.com/) | Western Comics — Marvel, DC, Image, indies + creator credits | **↗ Integrated** | free API key |
| [Rate Your Music](https://rateyourmusic.com/) | Music — genres, discographies, ratings | Manual reference | — |
| [IMDb](https://www.imdb.com/) | Movies & Series — no public free API; TMDb covers the same ground | Manual reference | — |
| [Movie Poster DB](https://movieposterdb.com/) | Higher-res posters when TMDb's aren't enough | Manual reference | account |
| [Douban](https://m.douban.com/home_guide) | Chinese-language IMDb — donghua, C-dramas, Asian cinema | Manual reference | — |
| [AniDB](https://anidb.net/) | Anime — deep metadata | Manual reference — the API needs client registration + a hard 2s rate limit; AniList/MAL/Kitsu already cover the same ground | — |
| [Discogs](https://www.discogs.com/) | Music — physical releases, vinyl, editions | Manual reference | — |

**Bulk import**: already tracking anime/manga elsewhere? Settings → Data → **Import MAL / AniList XML** loads a full export in one go. Works with MyAnimeList's native export and the [malscraper.azurewebsites.net](https://malscraper.azurewebsites.net/) AniList exporter.

Got another site worth integrating? Open an issue or a PR.

## UI

- **6 themes**: Dark (default), Light, Dark AMOLED, Nord, Gruvbox, Solarized Dark. Via `data-theme`.
- **8 independent accents**: theme default, amber, red, blue, green, purple, teal, pink. Via `data-accent`.
- **Density**: Comfortable / Compact (reduces paddings and font sizes).
- **Font size**: Small / Medium / Large (global zoom).
- **Sidebar**: Full (216 px) / Icons only (60 px).
- **Motion**: On / Reduced (respects `prefers-reduced-motion` from the OS plus manual override).
- **Startup**: last-viewed category or always the first one.
- **Layouts**: List / Grid / Compact + manual drag-to-reorder.
- **Onboarding**: welcome modal on first run to pick which libraries to enable (editable later under Settings → Libraries).

## Settings

Organized in tabs:
- **Appearance**: Theme, Accent, Density, Font size, Sidebar mode, Default view, Motion.
- **Behavior**: Confirm before deleting, Startup category.
- **Libraries**: Individual toggles for each of the 9 categories.
- **Card Fields**: which fields to show on cards per category (Games, Music, Manga/etc., Movies, Anime, Series).
- **Data**: Export / Import backup JSON, automatic snapshots (5 rotated with 1-click restore), Find similar titles (fuzzy duplicate finder), Import from MyAnimeList / AniList XML, Export as HTML (static shareable site), Yearly wrapped (year-in-review), SteamGridDB API key, Reset settings to defaults, Delete all data, About.

## Statistics per category

Every category has status distribution (pie/bar), a **GitHub-style yearly heatmap** keyed on completion dates, top rated, and "completed per month" activity. Plus:

- **Games**: Top developers, Top publishers, Top platforms, Top genres.
- **Music**: Top artists, Top genres, Top labels, Listens per month.
- **Movies**: Movies watched per month, Top directors, Top actors, Top genres.
- **Anime & Donghua**: Episodes watched per month, Top studios, Total watch time (aggregated across both sub-libraries).
- **Series**: Episodes watched per month, Top networks, Top actors, Total watch time.
- **Manga/Manhwa/Manhua/Comics**: Chapters read per month, Top authors, Top artists, Top magazines.

**Yearly wrapped** (Settings → Data) rolls up any given year end-to-end: totals per category, hours played, episodes watched, chapters read, average rating, busiest month, top 5 rated, top devs / studios / genres.

## Cross-cutting features

- **Tags** free per item.
- **Groups**: user-created collections inside each category, drag-to-reorder. **Each group can have its own custom cover image** (click ✎ on the group card).
- **Search** by title in the current library (Ctrl+F) and **global search** across every category and artist (Ctrl+K) — command-palette style with keyboard nav.
- **Bulk actions**: Shift+click cards to select many at once. A floating pill offers change status, add/remove tag, add to group, delete — all with a single confirm.
- **Undo / redo** for every library mutation: Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y). 40-step in-memory history covering items, groups and artists.
- **Filters** by tags plus category-specific ones (status, platform, genre).
- **Sort modes**: alphabetical, most recent, rating, plus category-specific ones (time played, date, status, custom drag order, artist, duration, episodes watched, chapters read).
- **Related items**: manual linking between items in the same category with a rich set of relation kinds — sequel, prequel, side story, spin-off, standalone expansion, DLC/expansion, remake, remaster, reboot, port, alt version, same collection, same series, same universe, crossover, adaptation, other. Clickable from the detail view. Displayed as a cover-only strip.
- **Franchise timeline**: auto-derived — items sharing the same `franchise` field appear together in a scrollable row, sorted chronologically. Clickable.
- **Recommendations**: manual list, no relation kind. Cover-only strip.
- **Review with spoilers**: separate from notes, with a "Contains spoilers / No spoilers" toggle — a "Show spoilers" button gates the content until clicked.
- **Rewatch/Reread/Replay/Listen history**: full log with date, rating and notes per session.
- **Toast** on save.
- **Esc** closes any open modal, panel or detail view.
- **"Don't ask again"** on delete confirmations.
- **Empty states** with icon + CTA when a category is empty; a smaller variant when filters leave the list empty.
- **Sticky top layout**: the top bar of every view stays pinned and only the content below scrolls. Flex-based (no `sticky` with offsets), no gaps or content bleed. What stays pinned depends on the view:
  - **Library items**: header + tabs (All X / Groups) + toolbar (search / sort / filters) pinned; only the list scrolls.
  - **Library groups / artists**: header + tabs pinned; the folder grid scrolls.
  - **Status boards**: header (plus toolbar in Games) pinned; the list scrolls.
  - **Statistics / Settings**: only the header pinned — the category/settings tabs scroll along with the content.
- **Sticky editor footer**: Delete, Cancel and Save always visible while scrolling the form — never buried at the bottom.
- **Virtualization**: off-screen cards use `content-visibility: auto` so scrolling a 500+ item grid stays smooth.

## Storage & portability

**Files**:
```
Omnio-0.1.7-portable.exe   ← the executable
data/
  videojuegos.json          ← items with categoryId 'videojuegos'
  musica.json               ← items with categoryId 'musica'
  peliculas.json            ← …one file per category
  series.json
  anime.json
  donghua.json
  manga.json
  manhwa.json
  manhua.json
  comics_west.json
  collections.json          ← groups
  artists.json              ← music artist profiles
  settings.json             ← preferences
  customOrders.json         ← per-category custom sort orders
  backups/
    1/  … 5/                ← 5 rotating full-directory snapshots
assets/                     ← local images
  anime/cover/
  videojuegos/cover/
  videojuegos/banner/
  videojuegos/logo/
  videojuegos/bundle/       ← thumbnails for bundle contents
  peliculas/cover/
  peliculas/banner/
  musica/cover/
  series/cover/
  manga/cover/
  manga/volume/
  artists/photo/
  ...
```

**How it works**:
- In the portable build, `data/` and `assets/` live in the same folder as the `.exe` (via `PORTABLE_EXECUTABLE_DIR` on Windows).
- **Split storage** (0.1.7+): each library is its own `.json` file — editing a game only rewrites `videojuegos.json`, not everything else. Every write is content-hashed so unchanged slices are skipped entirely. Corruption of one file leaves the rest intact.
- **Automatic migration**: on the first boot of 0.1.7+, if you had the legacy single `data.json`, it's split into `data/` automatically and the original is renamed to `data.pre-split.json` as a safety net.
- When you upload an image from your PC, it's decoded and written to disk at `assets/{category}/{kind}/{uuid}.{ext}`. The JSON files only store the relative path — no heavy data URLs embedded.
- A custom `omnio-asset://` protocol serves images to the renderer with a path-traversal guard.
- **Rolling backups**: every save that actually changes anything rotates the snapshot ring — slot 1 gets a fresh directory copy of the current data, slots 2–5 shift down, the fifth is dropped. Restore any of them from Settings → Data → Automatic snapshots; the current library is copied to `data.pre-restore/` first, so nothing is ever destroyed.
- **Site export**: Settings → Data → Export as HTML picks a folder, writes a standalone `index.html` and copies your `assets/` next to it. Send the folder as-is, open with any browser.

**Truly portable**: drop the whole folder onto a USB stick and take it with you. All your data + images travel with the executable.

## Visual identity

- Amber-on-dark base palette (dark theme by default), plus light and 4 alternative themes.
- Custom line iconography with no emojis — categories, Games/Manga/Anime/Series statuses, navigation. Monochrome typographic symbols (`✓ ★ → ✎ ⧉ ←`) are used sparingly.
- Progressive radii: 6 px (small), 10 px (medium), 16 px (large).
- Focus rings with glow via `box-shadow`.
- Logo: ring with a 4-point star centered — the ring stands for "a library that holds everything", the star for the rating / passion for hobbies.

## Development

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev          # dev with hot reload
npm run build        # packages the portable exe under release/{version}/
npm run lint
```

Requires Node 18+ (for `crypto.randomUUID` in the bundler) and Windows for the portable build (electron-builder). On Mac/Linux it runs in dev mode, but the build target is Windows portable — extend `electron-builder.json5` if you need other platforms.

### Code layout

```
electron/                Electron main process + IPC
public/                  static assets (logos, icons)
build/                   icons generated for packaging
scripts/                 build scripts (icon generation)
src/
├── App.tsx              root component (state + views)
├── App.css              re-exports styles/*.css
├── styles/              tokens, base, sidebar, layout, forms, cards, panels, detail, insights, settings
├── types/               entities, options, helpers (barrel index.ts)
├── insights/            stats.ts + DistChart.tsx
├── components/editors/  15 reusable edit-form subcomponents
├── *DetailModal.tsx     one detail view per category
├── ArtistDetailView.tsx music artist profile
├── ItemCard.tsx         generic list card
├── StarRating.tsx       half-star rating input
├── icons.tsx            inline SVG iconography
└── categories.ts        metadata for the 9 categories
```

For a detailed field-by-field reference by category, see [`docs/FIELDS.md`](docs/FIELDS.md).

## Contributing

PRs are welcome. Please:

1. Open an issue first if you want to discuss a bigger change.
2. Keep changes small and focused. One thing per PR.
3. `npm run lint` and `tsc --noEmit` should be clean.
4. Test in `npm run dev` before submitting.

The app deliberately keeps a tight scope: single-user, local-only, hobby-tracking. Features that require network, accounts, or cross-device sync are out of scope unless they're opt-in and stay local by default.

## License

[MIT](LICENSE) — feel free to fork, modify and distribute.
