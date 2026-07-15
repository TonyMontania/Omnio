# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Omnio logo">

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
![Platform: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

**English** · [Español](README.es.md)

![Omnio screenshot](https://github.com/user-attachments/assets/f7abdd85-ae6b-4deb-b1c1-00441e0456f3)

**Omnio** is a local-first desktop app to track your hobbies — games, music, movies, series, anime, donghua, manga, manhwa, manhua and western comics — all in one place. No accounts, no telemetry, no cloud. Your data lives in `data.json` and `assets/` next to the executable, so it's portable enough to carry on a USB stick.

The UI is in English. For a field-by-field reference in English and Spanish, see [`docs/FIELDS.md`](docs/FIELDS.md).

## Install

Download from the [latest release](https://github.com/TonyMontania/Omnio/releases/latest) and pick your platform.

**Windows** (`.exe` portable)
1. Download `Omnio-*-portable.exe`, drop it in a folder of your choice.
2. Double-click to run. `data.json` and `assets/` are created next to it on first run.
3. First launch: SmartScreen will show *"Windows protected your PC"* — click **More info** → **Run anyway**. It's an unsigned open-source build; you can inspect and rebuild the source yourself if you prefer.

**macOS** (`.dmg`, universal Intel + Apple Silicon)
1. Download `Omnio-Mac-*-x64.dmg` (Intel) or `Omnio-Mac-*-arm64.dmg` (Apple Silicon) and drag Omnio.app to Applications.
2. First launch: Gatekeeper will say *"Omnio can't be opened because Apple cannot check it for malicious software"*. To bypass:
   - **Right-click** the app → **Open** → confirm in the dialog. Or:
   - In Terminal: `xattr -cr /Applications/Omnio.app` and launch normally.

**Linux** (`.AppImage`)
1. Download `Omnio-Linux-*.AppImage`.
2. `chmod +x Omnio-Linux-*.AppImage`
3. Double-click or run from terminal. Some distros need `libfuse2` (`sudo apt install libfuse2` on Debian/Ubuntu).

The whole folder (exe/dmg/AppImage + `data.json` + `assets/`) is portable — move it between machines or drop it on a USB stick and your library travels with it.

## Tech stack

- **Electron 30** + **React 18** + **Vite 5** + **TypeScript 5**
- Main process under `electron/`, renderer under `src/`
- Local storage: a single `data.json` + an `assets/` folder holding images per category/kind
- No backend, no external APIs
- Typography: Fraunces (display) + Inter (body) + IBM Plex Mono (labels/data)

## Categories

### Games
Infinitebacklog-style card: banner + logo, cover, description, developers/publishers (multiple), **free-form platforms** (create your own, with suggestions + autocomplete), ownership, status (Backlog / Playing / Played / Completed / Dropped), time played, half-step rating, achievements unlocked/total, DLC/Expansions and Addons with their own status, mini-markdown notes, tags. **Extended**: alternative titles, source (Original/Remake/Remaster/Port/Sequel/Spin-off), ESRB age rating, franchise, review with spoiler toggle, replay history, related games with relation kind, auto franchise timeline, recommendations.

### Music
Cards per type (Single / EP / Album / OST / Live / Compilation), tracklist with per-track rating, favorite, listened, and a **per-track Lyrics button** (modal to read/edit lyrics). Auto-computed total duration for album-like types. Spotify-style Artist profile: banner + circular avatar, chronological discography, average rating. Listened / Not listened collections. **Extended**: alternative titles, source (Original/Compilation/Soundtrack/Remaster/Deluxe/Reissue), producers, review with spoilers, listen history, related albums, recommendations.

### Movies
Directors, cast, franchise, watched + rewatch count, review with spoiler toggle, backdrop image. **Extended**: alternative titles, source (Original/Book/Comic/Game/True story/Remake/Sequel), content rating, watched where, full rewatch history log, related movies, franchise timeline, recommendations.

### Series
Its own Anime-style card — cast, directors, showrunners, writers, network, country, language, content rating. **Nested season list** with optional episodes per season (number/title/year/total eps, watched, rating, notes). Automatic migration from the old flat `units[]` checklist system. Related series, franchise timeline, recommendations, rewatch history, review with spoilers.

### Anime & Donghua
Collapsible sidebar group with two independent sub-libraries (**Anime** and **Donghua**) sharing an AniList/MAL-style card: studios, format (TV/Movie/OVA/ONA/Special/Music Video), airing status, season + year, demographic, watch status (Plan to watch / Watching / Completed / Paused / Dropped), episodes watched/total, aired-from/to, rating, notes. **Extended**: alternative titles, source (Manga/Light novel/Web novel/Novel/Original/Game/Visual novel), ESRB age rating, ep. duration + auto total runtime, aired range, favorite episode + note, conditional dropped-at info, **episode list** with watched/rating/filler/notes, review with spoilers, rewatch history, related with relation kind, franchise timeline, recommendations.

### Comics & Manga
Four independent sub-libraries (Manga, Manhwa, Manhua, Western Comics) sharing an AniList/MAL-style card: authors + artists, genres, publication status, reading status, chapters and volumes read/total, volume covers gallery, rating, notes. **Extended**: alternative titles, source, ESRB age rating, magazine/serialization, **chapter list** with read/rating/notes, review with spoilers, reread history, related manga with relation kind, franchise timeline, recommendations.

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
- **Data**: Export / Import backup JSON, Reset settings to defaults, Delete all data, About.

## Statistics per category

Every category has status distribution (pie/bar), top rated, and "completed per month" activity. Plus:

- **Games**: Top developers, Top publishers, Top platforms, Top genres.
- **Music**: Top artists, Top genres, Top labels, Listens per month.
- **Movies**: Movies watched per month, Top directors, Top actors, Top genres.
- **Anime & Donghua**: Episodes watched per month, Top studios, Total watch time (aggregated across both sub-libraries).
- **Series**: Episodes watched per month, Top networks, Top actors, Total watch time.
- **Manga/Manhwa/Manhua/Comics**: Chapters read per month, Top authors, Top artists, Top magazines.

## Cross-cutting features

- **Tags** free per item.
- **Groups**: user-created collections inside each category, drag-to-reorder.
- **Search** by title (Ctrl+F).
- **Filters** by tags plus category-specific ones (status, platform, genre).
- **Sort modes**: alphabetical, most recent, rating, plus category-specific ones (time played, date, status, custom drag order, artist, duration, episodes watched, chapters read).
- **Related items**: manual linking between items in the same category with a relation kind (sequel, prequel, side story, spin-off, alt version, adaptation, other). Clickable from the detail view. Displayed as a cover-only strip.
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

## Storage & portability

**Files**:
```
Omnio-0.1.0-portable.exe   ← the executable
data.json                   ← all data
assets/                     ← local images
  anime/cover/
  videojuegos/cover/
  videojuegos/banner/
  videojuegos/logo/
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
- In the portable build, `data.json` and `assets/` live in the same folder as the `.exe` (via `PORTABLE_EXECUTABLE_DIR` on Windows).
- When you upload an image from your PC, it's decoded and written to disk at `assets/{category}/{kind}/{uuid}.{ext}`. The `data.json` only stores the relative path — no heavy data URLs embedded.
- A custom `omnio-asset://` protocol serves images to the renderer with a path-traversal guard.
- **Automatic migration**: the first time you open the app with this version, if you had covers/banners/logos stored as data URLs, they're extracted to disk and `data.json` is rewritten with relative paths.

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
