# Changelog

All notable changes to Omnio are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Each `## v<version>` section is the body of that tag's [GitHub Release](https://github.com/TonyMontania/Omnio/releases). Only user-visible changes land here — new features, fixes and behavior changes you'll actually notice while using the app.

## v0.5.7 — 2026-10-05

### Fixed

- **AppImage opens on every launcher.** The AppImage shipped with folders and launch scripts that only the build user could read or run, so firejail-based launchers and the AppImage catalog stopped with `Permission denied`. Every file and folder inside it is now readable, the launchers are executable, and each release is checked for this before it's published.
- **Installed builds keep your library in the right place.** The Windows installer, MSI, macOS app, AppImage, `.deb` and `.rpm` used to store `data/` and `assets/` next to the program itself — a folder that is read-only on several platforms or replaced on every update. They now use the system's app-data folder (`%APPDATA%\com.omnio.app` on Windows, `~/Library/Application Support/com.omnio.app` on macOS, `~/.local/share/com.omnio.app` on Linux). An existing library is moved there automatically the first time you open 0.5.7. The portable ZIP still keeps everything next to `omnio.exe`.
- **MusicBrainz now fills in producers.** Most albums credit producers per track rather than on the album itself, so the field almost always came back empty. Album-wide producers are listed first, followed by per-track producers ordered by how many tracks they produced.
- **Scrollbars use the app's style everywhere.** Most views were falling back to the plain system scrollbar.
- **Anime and Donghua match the other libraries.** The "This season" button made the top bar taller, pushing the whole page down a few pixels.
- **Visual Novels moved to Enabled libraries** in Settings, next to the other libraries, instead of sitting under Extras.

### Changed

- **Library toolbar reorganized.** Search, view controls (smart list, grouping, sort, filters) and actions (delete, export) now sit in clear groups, and every control has the same height.
- **Top-bar buttons share one size** across all libraries.
- **Home widgets fill their whole row.** Card widgets — Continue where you left off, Currently, Recently rated, Currently airing, Finished this week, Top of the year — show only complete rows, sized to the space they have at medium or full width, so there are no half-empty rows.
- **VGMdb removed from the list of metadata sources.** Its public API has been offline, so it is no longer advertised as available.

## v0.5.6 — 2026-09-29

### Added

- **Home board rebuilt with new widgets.** The dashboard is now cover-forward and dense:
  - **Currently — hero mode.** The top in-progress item shows as a big card with the cover, a blurred-cover backdrop, status pill, and progress meta ("Episode 5 of 12", "12.4h played"). Everything else in progress follows below as regular cards.
  - **Continue where you left off.** One card per in-progress series / anime / manga / book, showing the concrete next unit — Episode 6, Chapter 42, Page 187. Skips items already at the total.
  - **This week (airing).** 7-column grid of anime, donghua and series airing each weekday, with today highlighted. Replaces the old flat "Currently airing" list in the default layout.
  - **Pick from your backlog.** Random shuffle of 2–5 items sitting in a backlog / plan-to status, with a ↻ reshuffle button. Breaks decision paralysis without shaming.
  - **Random from favorites.** Same shuffle mechanic but scoped to ★5 items — rediscovery of stuff you loved.
  - **Rating spread.** Horizontal bar chart of how many items you rated at each star level.
  - **Finished this week.** Items you marked completed in the last 7 days, with a "Today / Yesterday / 3d ago" badge on the cover.
  - **Top of the year (so far).** ★4+ items you finished in the current calendar year. Hides itself when the list is empty.
  - **Genre spotlight.** Your top 5 genres by count, each with a mini cover strip of representative items.
- **Quick add popover.** Moved out of the Home widgets and into a permanent button in the sidebar footer — pick a library, type a title, hit Enter. Works from any view.
- **EXIF stripped from uploaded covers.** JPEG, PNG and WebP covers you drop into the editor now have EXIF, XMP and ICC metadata removed before landing on disk. Pixel quality is preserved (no re-encoding). If you later export or share a cover, no GPS coordinates, camera make or serial number travel with it.

### Changed

- **Home widget frames redesigned.** Cards now use a subtle top-down gradient, a stronger shadow, and an accent bar next to each title. Hover tints the border. Big numbers tiles got a bolder look — 40px value, accent gradient background, hover lift.
- **Fixed Big numbers "stretch" bug.** When the widget was set to medium next to another medium, its four tiles used to stretch into ugly wide bars. It now wraps into a 2×2 grid at medium and stays as 4 across at large.
- **"Libraries (rich portals)" widget removed** from the default layout. The sidebar already lists your libraries with counts, and the widget was mostly duplicated real estate.
- **Global scrollbar redesigned.** Thumb picks up an accent tint on hover; track is transparent with a hairline separator. Consistent across library, sidebar, modals and Home.
- **README install docs updated.** macOS Sequoia 15 doesn't accept the classic right-click Open bypass for unsigned apps anymore — the guide now points at `xattr -cr /Applications/Omnio.app`. AppImage FUSE requirement is spelled out ("`sudo apt install libfuse2` on Ubuntu 22.04+", plus the `--appimage-extract-and-run` fallback). Portable ZIP warning about WebView2 is now unmissable.

### Security

- **DevTools blocked in release builds.** F12, Ctrl+Shift+I / J / C / K, Ctrl+U, Ctrl+P and right-click on non-input elements no longer open developer tooling or the save-as-page menu in the packaged app. Dev builds are unaffected.
- **API keys and tokens no longer appear in error logs.** Query-string params matching `api_key`, `client_secret`, `token`, `authorization`, `password`, `secret` and friends are redacted to `***` before any failing-URL diagnostic hits stderr. Applies to every metadata fetcher and to plugin HTTP calls.

## v0.5.5 — 2026-09-26

### Added

- **Franchise graph diagrams.** New free-canvas view mode per franchise — draw the branches of a series (Zelda-style forks, prequels/sequels/side-stories, alternate timelines) as nodes and edges on an interactive canvas. Six node shapes (rect, rounded, pill, circle, diamond, plain text) and four edge routings (bezier, straight, step, smoothstep), plus arrow markers. Sits alongside the existing "by year" and "by sections" franchise modes; each franchise remembers its own preferred mode. A read-only preview also renders inside the detail modal's franchise strip.
- **MusicBrainz edition picker.** The music fetcher now runs in two steps: first pick the release group (the album as an abstract work), then pick the specific edition — a given pressing, region, format or reissue. Previously it silently grabbed the first release in the group. Edition-specific label, catalog number, release date and Cover Art Archive cover come through now.
- **Steam Deck compatibility on the card.** Games with a Deck compat set (Verified / Playable / Unsupported) get a chip on the card. Toggleable in **Settings → Cards → Games → Steam Deck Compatibility**.

### Changed

- **Game editor: every tab now reflects what it holds.** Fields that had piled up in one or two tabs are now grouped by intent:
  - **Overview** — rating, completion date, notes
  - **Identity** — devs, publishers, platforms, release date, copy type, alt titles, genres, source + age rating, original work, franchise, plus a new **Ownership** block (store links, purchase log, Steam Deck + ProtonDB compat)
  - **Progress** — status, time played, HowLongToBeat, achievements (unlocked/total + list), PCGW save paths, save files, playthroughs
  - **Media** — cover, banner, logo, screenshots gallery
  - **Related** — DLC, addons, bundle contents, related games, recommendations
  - **Notes** — review + spoiler toggle
- **Library view selector is now a compact dropdown.** The row of six buttons (List / Grid / Compact / Kanban / Timeline / Diary) was taking up too much of the topbar. Replaced by a single trigger showing the current view; the menu lists all options with a one-line hint each.
- **Ownership block: cleaner empty state.** Store links, purchase log, and platform compat sit under one section with less redundant help text. Steam Deck compat switched from pills to a select so it lines up with ProtonDB.

## v0.5.4 — 2026-09-21

### Added

- **On this day widget.** New Home widget that surfaces items you finished on today's month + day in previous years, grouped by "N year(s) ago". Hides itself completely on days with nothing to show.
- **Drag & drop widget reordering.** Grab any widget on the Home layout editor and drop it into a new slot. The ↑ / ↓ buttons stay for keyboard users.
- **Cross-library genre heatmap.** Matrix of the top genres across every library, with cell intensity scaled by count. One-off genres are filtered out; hover a cell for the exact number.
- **Added vs finished chart.** Two bars per month over the last 6 / 12 / 24 / 36 months — items you added versus items you finished. Optional library scope picker.
- **HowLongToBeat fetcher for Games.** Fills main story / main + extras / completionist hours from howlongtobeat.com — feeds the "Shortest to beat" backlog sort.
- **Last.fm sync via API.** Second Last.fm importer alongside the existing CSV path. Set your API key + username in **Settings → Integrations** and pull your top-scrobbled albums for any period. Accepted matches mark the album as listened and add a note to its history log with playcount + date.
- **Per-episode events in the calendar export.** Toggle in the Release calendar header — when on, every upcoming episode of a currently-airing show gets its own event in the exported `.ics` (capped at 60 events / 1 year of projection).
- **Book ISBN quick-lookup.** New Lookup button next to the ISBN field in the Book editor. Cleans the value, hits OpenLibrary, fills title, authors, publisher, page count, release date, description and cover. Your rating, reading status, notes and log are left alone.
- **Local music folder scanner.** Point at your music root under **Settings → Data → Import** and Omnio walks the tree and returns one row per detected album folder. Recognizes both nested (`Artist/Album/track.mp3`) and flat (`Artist - Album/track.mp3`) layouts, every common year format (`Album (2015)`, `[2015] Album`, `2015 - Album`, `Album - 2015`, and more), multi-disc rollups (`CD1` / `Disc 2` / `Vol. 3`), grouping folders (`Discography`, `Studio Albums`, `Live`, `EPs`, `Singles`, `Compilations`, `Soundtracks`, …) and 18 audio formats. Cover art picks any `cover` / `folder` / `front` / `artwork` file, falling back to any image in the folder. Nothing lands in the library until you click Import.
- **Auto-tag suggestions from metadata fetchers.** Fetchers now surface source-specific themes as clickable chips below the tag editor. Jikan (MAL) sends themes + explicit genres, AniList sends its top community-ranked tags, IGDB sends player perspectives + game modes + top keywords, TMDb sends keywords. One click accepts a chip, ✕ dismisses it, or use Accept all / Dismiss all for the batch.
- **History log: kind picker + Nth-time counter.** Every history tab (Reread / Rewatch / Play / Listen) now records what kind of entry each row is — Rewatched, Started, Finished, Dropped, or Note. Each completion entry gets a "Nth time" chip so you can see at a glance whether a row is your third read-through or a first-time finish. Verbs adapt per category ("Started watching" / "Started reading" / "First heard").

### Changed

- **"Remember sort per library" respects your choice at startup.** The setting only kicked in on subsequent category switches — the first-visited category always opened at "Most recent". Boot now reads and restores your last sort before rendering.
- **Unchecking a plugin in Settings no longer removes the toggle itself.** Split "unlocked" (you discovered the unlock code) from "hidden from sidebar" (a per-session preference). Un-checking now hides the plugin but keeps the row in Settings so you can bring it back with one click.
- **Watched episodes stay readable.** Dropped the strike-through on watched episode titles — combined with the dim color it made them illegible. The ✓ column already signals watched state clearly.
- **Detail views: neutral genre pills.** All detail modals now render genres as the same neutral chip family instead of accent-tinted pills, matching the visual language across libraries.
- **Music tracklist favourite column.** ★ still marks favourite tracks, inline before the track name — cleaner alignment.
- **Books description textarea taller.** Bumped from 3 rows to 8 so long synopses stay visible without a tiny scroll box.
- **Books Progress tab layout fixed.** The Progress section no longer collides with the tab bar.

### Fixed

- **Artist member editor: status select overlapping the name field.** Now sized properly so the member name input gets its full space back.
- **Home widgets that self-hide no longer leave an empty card.** Widgets that decide they have nothing to show now hide their frame entirely outside edit mode.
- **HowLongToBeat, Last.fm sync and the music folder scanner now actually reach the backend.** Fixes a plumbing issue where the calls were arriving empty.

## v0.5.3 — 2026-09-18

### Added

- **Kanban view — universal across every library.** New layout mode in the view toggle row. Columns are the category's status enum (`backlog / playing / completed / …` for games, `plan_to_watch / watching / completed / …` for anime); cards are draggable between columns and dropping applies the matching status patch. Music and Movies work too — their `consumed` boolean maps to a two-column layout.
- **Timeline view.** Horizontal scroll of items grouped by release year — covers pinned under each year label with a hairline axis. Items missing a year land in a footer hint so you can find and fill them.
- **Diary view.** Chronological log of entries dated by `finishedAt` (or `createdAt` as fallback), grouped by month. Each entry shows the day, weekday, cover, title, a "Finished" vs "Added" badge, rating and a snippet of the review or notes if there is one. Read-only.
- **Group by (toolbar dropdown).** Group the classic Grid / List / Compact renders into collapsible sections by year, decade, status or half-star rating. Missing values land in an "Unknown" bucket at the end.
- **Big numbers widget.** Row of scrapbook-style tiles at the top of the dashboard — total items, finished this year, hours logged (playtime + runtime + episodes × episode duration + VN hours) and count of items rated ★4 or higher. No deltas, no comparisons.
- **Currently airing widget.** Filters anime, donghua and series that are actually on air this season, distinct from "upcoming" (future releases).
- **Upcoming this week widget.** Companion to the existing 30-day upcoming widget with a tighter 7-day horizon.
- **Quick add widget.** Inline single-row form (category + title + Add) that drops a stub item straight into the chosen library — faster path when you just want to remember something exists.
- **Cover carousel widget.** Auto-scrolling marquee of covers from your library; pauses on hover, respects `prefers-reduced-motion`, click a cover to open the item.
- **"In progress" widget now covers Visual Novels** alongside every other category.
- **Smart lists — saved filter presets, per library or across every library.** New "Manage" button next to the smart list dropdown. Create as many lists as you like, name them, pick a scope (a specific library or "all") and stack rules from a fixed vocabulary — favorite yes/no, rating floor and ceiling, has-tag, status is one of, year floor and ceiling, has review, has cover, finished / consumed. Applying a list layers on top of the current search / tag / status filters, so you can bottle "4-star games I never finished" once and use it from the toolbar.
- **Cross-library playlists.** New Playlists entry in the sidebar — ordered lists that can mix items from every library. Each has a name, an optional description and any number of entries; the detail view lets you reorder and remove entries. Adding items uses a full-library picker with search plus a per-library filter, and greys out anything already in the list.
- **Card menu: "Move to library…" and "Add to playlist…"** Right-click any item to move it to a different library or drop it into an existing playlist. The playlist picker has an inline "Create and add" affordance. Moving an item keeps its source-library-specific fields so moving back later restores them.
- **Auto-status transitions (Settings → Behavior).** Giving an item a rating or setting a finished date now bumps its status to "completed" if it was still in a backlog / in-progress state, and stamps today as the finished date when one wasn't already set. Both gated by their own toggles.
- **Custom keyboard shortcuts (Settings → Keyboard shortcuts).** Every hotkey now flows through a rebindable table. Click Record on a row, press a keystroke; Esc to cancel. Blank binding disables the action. Reset returns one row to its default; Reset all clears every override.
- **Library-level custom fields (Settings → Custom fields).** Add your own typed fields to any library — text, number, date, yes/no, or a select-from-a-list. Every item in that library grows the extras at the bottom of its editor. Renaming keeps existing values; removing a field just hides them until it's re-added.
- **Games — playthroughs / runs log.** Dedicated section for structured runs — one entry per campaign, NG+ replay or co-op session with a friend. Each captures start / finish dates, hours, character or class, difficulty, platform, co-op tag, milestones and a longer note. The section header sums total hours across runs.
- **Series / Anime — "Airs" chip on the item card.** When a show is `airing`, its card grows a small accent-tinted chip showing the weekday its new episodes drop ("Airs Tue"). The dot pulses so the airing state reads at a glance.
- **Visual Novels — routes / endings tracker.** VN editor grew a checklist of endings grouped by optional Route. Each ending has a name, kind (good / bad / true / normal), a "seen" checkbox that stamps today when ticked and a note. Header shows `X / Y seen`.
- **Games — store links, purchase log and platform compatibility flags.** Store links list every place the game lives (Steam / GOG / Epic / itch / Humble / EA / Ubi / Battle.net / Rockstar / Nintendo / PlayStation / Xbox / Official / Other) with URLs and notes. Purchase log captures date, price, currency, storefront, discount and note per row. Steam Deck compatibility uses Valve's four-value scale (Verified / Playable / Unsupported / Unknown) and shows as a coloured chip on the card. ProtonDB rating covers the Linux angle (Platinum / Gold / Silver / Bronze / Borked).
- **Movies — viewings log.** Editor section for structured watch history — one row per viewing with date, format (theater / streaming / bluray / dvd / download), location, companions and a note. Card grows a "× N watched" chip once the total is > 1.
- **Books — highlights & quotes list.** Kindle-style capture: page reference, quoted text, personal note, captured-at date.
- **Manga family — bookmark block.** Chapter cursor + short note ("last panel of the arc before the timeskip"). Card grows a subtle chip when set.
- **Music — Listening note.** Freeform textarea for the anecdote attached to an album, kept separate from Review.
- **Export what's shown.** New toolbar dropdown next to Delete: exports only the items currently visible after search + tags + smart-list filtering, as a single CSV or JSON. A saved smart list becomes a shareable spreadsheet in two clicks.
- **CSV column set catches up with the newer fields.** Games CSV now includes Deck compatibility and Proton rating; Movies CSV includes times-watched and where-watched; every manga-family CSV includes bookmark chapter and note; Music CSV includes the listening note; Visual Novels have their own CSV column set.

### Fixed

- **Track artist column split band names containing `/`.** `156/Silence`, `AC/DC`, `Sunami:Portrayal Of Guilt` and any band with `/` or `:` in the name rendered as two pills instead of one. Splitting is now scoped to real featured-artist separators only (`,`, `&`, `feat.`, `ft.`, ` x `).
- **Track artist rendering was inconsistent within an album.** Same "Architects" text could render as plain text on one row and as an accent pill on the next. Every artist name is now a pill, so a lone `Architects` sits at the same visual weight as `Architects · Jon Green` two rows down.

### Changed

- **In-app updater downloads land in the app's install folder** instead of `~/Downloads`. Portable users get the new ZIP next to their extracted `omnio.exe`, NSIS users get the new setup inside `%LocalAppData%\Programs\Omnio\`, AppImage users get the new AppImage next to the running one. Falls back to the OS Downloads folder (and then to the app-data dir) when the install location is read-only.
- **Release title on GitHub is just the tag** (`v0.5.3` instead of `Omnio v0.5.3`). Cleaner in the releases list.

## v0.5.2 — new delivery channels + updater fix

Small patch release. Three new delivery channels come online (`.rpm`, AUR `omnio-bin`, winget `TonyMontania.Omnio`), and the in-app updater picks the right asset for every install variant.

Nothing on disk changes. Upgrade is a normal installer swap; your library stays where it is.

### Added

- **Fedora / RHEL `.rpm` build.** Ships alongside the AppImage and `.deb`. Distros covered: Fedora, RHEL, CentOS Stream, Rocky, AlmaLinux, openSUSE, Amazon Linux 2023.
- **AUR package `omnio-bin`.** For Arch, Manjaro, EndeavourOS. Install with `yay -S omnio-bin` (or your AUR helper).
- **winget package `TonyMontania.Omnio`.** Install with `winget install TonyMontania.Omnio` on Windows.

### Fixed

- **In-app updater picked the wrong asset for MSI / portable / .deb / .rpm builds.** Portable users saw a hint that didn't match any published asset; MSI users got pointed at the NSIS `.exe`; `.deb` users got the AppImage. Detection now reads the running executable's location and matches the right published asset for the install variant. macOS unchanged.

### Docs

- **Install section rewritten** — per-OS tables (Windows / macOS / Linux) showing every channel with its exact filename, install command and prerequisites.
- **`CHANGELOG.md` is now the source of truth for release notes** — the release workflow reads this file and passes the matching section to the GitHub Release body.

## v0.5.1 — item templates, quick-add via URL, half-star ratings, settings rework

Second Tauri release. Three new user-facing features — **item templates**, **quick-add via URL** and **half-star ratings across the board** — a **visual rework of Settings**, and the experimental mobile companion / encrypted backup / git-backed data folder retired to keep the desktop app lean.

No data-on-disk changes. Upgrading is a normal installer replacement.

### Added

- **Item templates.** Save the field values you want prefilled for the next item in a category. Open **Add**, set your defaults (status, tags, and for games: platforms + ownership + source), click **Save as template**. Every new item you add in that category starts with those slots populated.
  - Templates are stored per-category — a template for Games doesn't affect Books.
  - Editing an existing item never applies a template — only fresh items opened from the "+" button.
  - Manage saved templates from **Settings → Behavior → Item templates**.
- **Quick-add via URL.** Paste a supported metadata URL into the Title field of the Add panel and the matching fetcher opens with the slug pre-searched. Supported: IGDB, TMDb (movie / tv), AniList (anime / manga), MyAnimeList, VNDB, MangaDex, OpenLibrary, Steam. Detection is scoped to fetchers available for the current category — no false-positive redirects.
- **Half-star ratings across the board.** The rating picker uses a 10-pill row (0.5 → 5.0), the min-rating filter offers half steps, and `★{n}` displays halves as `★4.5`. Sorting respects halves too.

### Changed

- **Settings visual rework.** Left navigation is a floating rounded card sticky on scroll. Every top-level setting is its own card with a bold title. Card fields collapsed into one card with a 2-column grid per library. Enabled libraries / Extras / Plugins render as inline chips that wrap instead of a full-width vertical stack. Section titles ("Danger zone", "Integrations · API keys", …) got a stronger visual weight.

### Removed

- **Mobile app / PWA.** The experimental mobile companion is discontinued — desktop-only from here.
- **Encrypted 7z backup.** The rolling 5-snapshot backup on every save stays (restorable from **Settings → Backup, import & export**).
- **Git-backed data folder.** If you had it enabled, your `data/` folder still works as a git repo — Omnio just no longer manages the commits.
- **Old "Interface size" toggle** — was mobile-only zoom, dead on desktop.

### Docs

- **README** rewrite — table of contents, features grouped in three columns (Track / Discover / Own your data), metadata sources split into per-category tables, CI badges added.

## v0.5.0 — Omnio migrates from Electron to Tauri

Full notes: https://github.com/TonyMontania/Omnio/releases/tag/v0.5.0

Highlights: Rust/Tauri v2 backend, ~90% smaller installer, first-boot library migration from Electron, new **Visual Novels** category with full VNDB integration, better error surfacing on network failures.
