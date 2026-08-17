# Deferred work

Items that were scoped in past brainstorms but not landed yet, with the
reason and a rough size estimate so future sessions can pick them up
without re-deriving the context.

Sizes: **S** ≤ 1 day · **M** 2-5 days · **L** 1-2 weeks · **XL** 2+ weeks.

---

## Features

### Item timeline (vertical, per-item)  ·  M
Per-item view that stacks every rewatch / replay / read entry on a vertical
line with dates + notes. Data already exists in `Item.rewatches`; the missing
piece is the display component and a Timeline tab in each DetailModal.
Design cue: mirror `BandTimeline` (SVG) but rotated 90° with fixed row
height per entry and expandable notes.

### Public share HTML (single item / list)  ·  M
Today the HTML site export dumps the whole library. Missing: export **one**
item as a standalone HTML page, and export a hand-picked list. Same
renderer, different scope selector. Optional stretch: upload target
integration (Netlify Drop / GitHub Pages hint in the UI).

### Tag hierarchy  ·  M
Tags are flat today. Support `parent → child` nesting (`jrpg → turn-based`,
`jrpg → action`). Changes required:
- `Item.tags: string[]` stays the strings on items; hierarchy lives at the
  category-settings level under a new `tagTree: { [tag: string]: string }`
  parent map.
- Card display: keep showing leaf tags.
- Filter dropdown: show as a tree; selecting a parent matches all descendants.
- Import/export: preserve the map in JSON backups + settings.json.

### Sentry / crash reporter (opt-in)  ·  M
Would give visibility into silent crashes in the wild. **Recommended NOT
to add** — cuts against the local-first design contract. Only worth
revisiting if a crash-related bug proves impossible to reproduce and
becomes user-blocking.

---

## Bigger swings

### App.tsx complete editor extraction  ·  M
Music, Games, Movies, Series done (0.3.7 + 0.3.9). Remaining: Anime,
Donghua, Manga family (4 categories share the same block), Books. Same
recipe as MovieEditorSection / SeriesEditorSection — ~30-40 props per
category, all state stays hoisted in App.tsx. Best done after Vitest
grows an editor-testing harness so regressions surface automatically.

### Mobile CSS pass  ·  L
Every full-screen editor modal needs to reflow below 768px. Grid
becomes single-column. Card zoom loses `xl` on mobile. Long tables
(tracklist, achievements, screenshots) become horizontally-scrolling
stacks below 640px. Right-click context menu → long-press. Ctrl+K
becomes a bottom-sheet. Independent of the PWA refactor; can land
even inside the Electron shell if a user runs the app in a
narrow window.

### Fetcher plugin registry  ·  L
Each fetcher is a self-contained file today. Convert to a plugin
system where a fetcher registers itself with `{ id, categories, search,
apply, settings }`. Benefits: adding a new source (Anilist v2, MangaUpdates,
IMDB) becomes drop-a-file, not touch-App.tsx. Needs a design pass first
to decide the shape of the registry API and whether third-party plugins
are in scope.

### PWA / mobile web shell  ·  XL
The full plan lives at [`docs/PWA_REFACTOR.md`](PWA_REFACTOR.md). Six
weeks of focused work in five phases: extract `core/`, add an rpc/
abstraction, ship an HTTP server, mobile CSS pass, PWA manifest +
service worker. The Docker + KasmVNC deployment covers the "browser
access from a NAS" case today; PWA is only worth doing if mobile
becomes a first-class target.

---

## Docs / community

### Screenshots per library  ·  S (needs user)
README today has hero + Games + Music + Detail + Home + Simulcast (6
images). Missing: Books with Kindle highlights, Anime with AniList
picker, Movies with backdrop + streaming, Series with per-episode
tracking, Manga with volume covers gallery, Artists with band-timeline.
Can't self-serve — needs the user to take + upload the screenshots.

### Ultra-review of the codebase  ·  S
Never run against the current tree. Would surface real bugs the
smoke test can't catch. Recommend running it once after 0.4.0 lands
so the review targets a clean semver boundary.

---

## Meta

Anything deferred here should either land or get an explicit "won't
do" note (with the reasoning) — not sit indefinitely. Revisit this
file at the start of every minor version so the list stays honest.
