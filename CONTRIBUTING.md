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

Requires **Node 18+** and **npm 9+**.

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev       # Vite + Electron with hot-reload for the renderer
```

The first launch creates `data/` and `assets/` next to the executable
(or under `%APPDATA%\Omnio` / `~/Library/Application Support/Omnio` for
installed builds).

## Before you push

```bash
npm run lint       # ESLint, --max-warnings 0
npm test           # Vitest unit tests
npx tsc --noEmit   # Type-check without emitting
```

CI runs these plus a Playwright smoke test that boots Electron and
checks the window mounts. All four must pass for a PR to merge.

## Project layout

```
electron/
  main.ts               Electron main process — every IPC handler, every
                        disk operation, every metadata fetcher backend.
                        The renderer never touches disk directly.
  preload.ts            Bridge that exposes ipcRenderer to the window.

src/
  App.tsx               Top-level React component. Hoists every state
                        atom for the item editor + wraps every modal.
                        Category-specific editor JSX is being extracted
                        into src/components/editors/*EditorSection.tsx —
                        Music, Games, Movies, Series done as of 0.3.9;
                        Anime, Donghua, Manga family, Books still inline.
  Home.tsx              Landing dashboard.
  GlobalSearch.tsx      Ctrl+K palette. Operator parser lives here.
  {Category}DetailModal Read-only detail views per library.
  {Source}Fetcher.tsx   One file per metadata source (14 today).
  {Source}Importer.tsx  One file per data importer (Steam, Letterboxd,
                        Backloggd, Serializd, Spotify, MAL/AniList XML,
                        Kindle highlights, Last.fm, Trakt, Discogs).
  components/
    editors/            Small editor building blocks + the extracted
                        per-category *EditorSection components.
    detail/             Small building blocks for the DetailModals.
    FetcherModal.tsx    Base modal for search-then-pick fetchers.
    ImageLightbox.tsx   Global full-screen image viewer.
    CoverPlaceholder    Category-shaped SVG for items without a cover.
  types/
    entities.ts         Pure TypeScript types. No runtime code.
    options.ts          OPTIONS lists, defaults, palette-like constants.
    helpers.ts          Pure functions (label lookups, formatters).
    index.ts            Barrel; import everything from './types'.
  utils/
    csv.ts              parseCsv, colIndex, buildCsv.
    format.ts           formatBytes, formatDate, formatIsoDate (TZ-safe).
    files.ts            File-picker + drag-and-drop upload helpers.

packaging/docker/       Dockerfile + compose + Unraid template. Publishes
                        multi-arch amd64/arm64 to ghcr.io.

docs/
  FIELDS.md             Every field on every category, EN + ES labels.
  REDESIGN.md           Historical design doc for the 0.3 UX pass.
  PWA_REFACTOR.md       Plan for the future web / mobile shell.
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
4. **All 11 libraries share one Item type.** New fields go on the
   `Item` interface; runtime code gates them by `categoryId`. Don't
   fork parallel types per category.
5. **Zero ESLint warnings.** The `--max-warnings 0` gate is deliberate
   and CI-enforced. Fix the warning, don't `// eslint-disable-*`.
6. **No emojis in code / commits unless the user asks.** Product copy
   in the UI is fine; commit messages, comments and doc prose stay
   plain text.

## Recipes

### Add a metadata source

1. Add an IPC handler under `electron/main.ts` (e.g. `foo:search`,
   `foo:details`). Follow the `proxyJson` pattern; wrap search in
   `cachedSearch('foo', term, fn)` so it hits the 24h cache.
2. Create `src/FooFetcher.tsx` — modeled on `MusicBrainzFetcher.tsx` if
   the API is search-then-details, or on `AniDBFetcher.tsx` if it's
   paste-an-ID.
3. In App.tsx, lazy-import + open state + render the fetcher inside a
   `<Suspense>` in the modal region. Wire `onApply` to
   `applyFetchedPatch(...)` — that function already handles every
   category's field mapping.
4. Add the source's row to the README table (Metadata sources
   section) + the About panel changelog if it's a full release.

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
3. Add the category to `CATEGORIES` in `electron/main.ts` so the
   split-file storage works.
4. Add a `{Category}DetailModal.tsx` — model on `MusicDetailModal.tsx`
   for square covers or `GameDetailModal.tsx` for 2:3 posters.
5. Add the category-specific editor JSX to App.tsx (or ideally a new
   `{Category}EditorSection.tsx` matching Movies/Series/Music/Games).
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

## Docker deployment PRs

Anything under `packaging/docker/` needs to keep the multi-arch
manifest healthy — smoke-test with `docker build --platform=linux/arm64`
locally if you're touching the Dockerfile or the KasmVNC autostart.
See `packaging/docker/README.md` for the full deployment doc.

## Getting help

Post in an issue prefixed `[question]` if the docs don't cover what
you're trying to build. Faster than DMing — the answer probably helps
the next contributor too.
