# Editor + Detail Redesign — Tabbed Layout

**Status:** prototype (branch `prototype/editor-tabs`), opt-in via Settings.

The problem: as we add features (attachments, achievements, save-backup,
per-chapter notes, session timer, quote collection, etc.) the edit modal
and detail modal become walls of vertical scroll. Even with progressive
disclosure hiding empty sections, a power user who fills 40+ fields ends
up scrolling forever.

The fix: split both surfaces into tabs. Basic info stays visible always;
everything else is one click away, not one thousand pixels down.

---

## Editor — tab structure

The right column of the edit modal (the form) grows a tab bar at the
top. The left column (Live Preview + sticky cover) stays put.

```
┌─────────────────────────────────────────────────────────────────┐
│ Live Preview │  [Overview] [Details] [Media] [Progress]         │
│              │  [History] [Related] [Attachments] [Notes]       │
│  [cover]     │  ────────────────────────────────────────────    │
│  Title       │                                                  │
│  Status      │  ← content of the active tab                     │
│  ...         │                                                  │
│              │  [Delete]  [Move to library ▾]  [Cancel] [Save]  │
└─────────────────────────────────────────────────────────────────┘
```

### Tab contents (revised — 7 tabs, more focused split)

Splitting "Details" into **Identity** (who made it, how it's classified)
and **Progress** (what you've done with it) keeps each tab focused. Every
category maps its existing sections into these:

| Tab           | Games                                                       | Music                                       | Movies / Series                            | Anime / Manga                                     | Books                                    |
|---------------|-------------------------------------------------------------|---------------------------------------------|--------------------------------------------|---------------------------------------------------|------------------------------------------|
| Overview      | Title, cover, status, rating, tags, franchise               | Title, cover, artist, type, rating, tags   | Title, cover, status, rating, tags, franchise | Title, cover, status, rating, tags, franchise  | Title, cover, status, rating, tags, saga |
| Identity      | Devs, publishers, platforms, genres, source, age rating, edition | Genres, label, artist, source, producers | Cast, crew, directors, production, genres, source | Authors, artists, publisher, magazine, source | Authors, publisher, format, ISBN, source, translator |
| Progress      | Playtime, achievements, DLC, addons, bundle contents        | Tracklist, listened-per-track              | Watched status, timesWatched              | Episodes / chapters read, list, next unwatched   | Pages read / total                       |
| Media         | Cover / banner / logo uploads + SGDB / IGDB fetchers        | Cover + single covers + edition covers     | Cover + backdrop                          | Cover + banner + volume covers                    | Cover                                    |
| History       | Replay history                                              | Listen history                             | Rewatch history                           | Rewatch / reread history                          | Reread history                           |
| Related       | Related games, franchise timeline, recommendations          | Related albums, recommendations            | Related, franchise, recommendations       | Related, franchise, recommendations               | Related, saga, recommendations           |
| Notes         | Review + spoilers, notes, custom fields, tags editor, groups | Review + spoilers, notes, custom fields, tags, groups | Review + spoilers, notes, custom fields, tags, groups | Review + spoilers, notes, custom fields, tags, groups | Review + spoilers, notes, custom fields, tags, groups |

Attachments (save games, EPUB, subtitles, screenshots) will live inside
Progress once the feature ships — see `project_feature_roadmap.md`. If
Progress gets too dense we'll add Attachments as an 8th top-level tab.

### Behaviour rules

1. **Auto-hide empty tabs.** A tab whose sections have zero user data
   collapses off the tab bar. Example: an item with no rewatches has no
   **History** tab. As soon as the user adds one, the tab appears.
   Overview and Notes are always visible.

2. **Dot indicator.** Tabs with data show a small accent-colored dot
   next to the label. Lets you scan an item's density at a glance:
   `[Overview •] [Details] [Media •] [Notes •]` → this item has core
   info, no extended details, has media, has notes.

3. **Sticky tab bar.** Scrolling the tab content does not scroll the
   tab bar off. Users can jump between tabs without losing their place.

4. **Keyboard.** `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle tabs. `Ctrl+1..9`
   jumps to nth tab. `Ctrl+K` within the editor opens a field-search
   palette (planned separately).

5. **Save button unchanged.** Footer stays sticky at the bottom of the
   right column. One Save button per item, saves everything regardless
   of active tab.

---

## Detail modal — same treatment

Hero section (cover + title + status + primary meta) stays pinned at
the top. Every other section moves into a tab below.

```
┌─────────────────────────────────────────────────────────────────┐
│  [cover]  Metro Exodus (2019)              [Duplicate] [Edit]   │
│           Metro 3 · 4A Games                                    │
│           ★ 4.5 · Backlog · M · PC                              │
│  ────────────────────────────────────────────────────────────  │
│  [Overview] [Progress] [Related] [History] [Attachments]        │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│    ← tab content                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Same auto-hide-empty rule. Detail modal is read-only — no save button
in the footer.

---

## Migration path

1. **Ship as opt-in.** Settings > Appearance > "Editor layout":
   Compact (single scroll) — default — or Tabbed (new). Users choose.
2. **Iterate on the tab shape** based on feedback. Nothing bakes in
   until the tab set is proven.
3. **Once stable**, make Tabbed default for new users; keep Compact
   available as a preference.
4. **Never remove Compact.** Some users prefer the scroll — respect it.

---

## Progressive disclosure + tabs = the design contract

New features get a natural home: pick the tab that fits. If a feature
doesn't fit any tab, that's the signal we're adding scope creep — not
just filling in a gap. Tabs are the shell; features are the tenants.

See also:
- `MEMORY.md` → `project_feature_roadmap.md` for the pending feature list per library
- `MEMORY.md` → `feedback_library_consistency.md` for the "new library must follow the pattern" rule
