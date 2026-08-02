# Editor + Chrome Redesign

**Status:** shipped (default behaviour, no toggle).

Two shifts landed together:

1. **Chrome.** Sidebar is gone. A single top-nav bar carries the brand
   on the left, a Home tab, and the utility icons (calendar, statistics,
   settings) on the right. Library navigation happens on the Home
   dashboard — cards per library — not in persistent chrome. The old
   sidebar / top-nav toggle in Settings is retired.

2. **Editor.** The edit modal is tabbed. Overview stays visible; the
   rest of the form is split across focused tabs so power users with 40+
   filled fields aren't scrolling forever. The old "Compact (single
   scroll)" mode and its Settings toggle are retired.

The **detail modal** stays as a single scroll (read-only, one Edit
button). Progressive disclosure hides empty sections. Not tabbed on
purpose: a reader shouldn't need an extra click to see what they own.

---

## Editor — tab structure

The right column of the edit modal (the form) has a tab bar at the top.
The left column (Live Preview + sticky cover) stays put.

```
┌─────────────────────────────────────────────────────────────────┐
│ Live Preview │  [Overview] [Identity] [Progress] [Media]        │
│              │  [History] [Related] [Notes]                     │
│  [cover]     │  ────────────────────────────────────────────    │
│  Title       │                                                  │
│  Status      │  ← content of the active tab                     │
│  ...         │                                                  │
│              │  [Delete]  [Move to library ▾]  [Cancel] [Save]  │
└─────────────────────────────────────────────────────────────────┘
```

### Tab contents (7 tabs)

Splitting "Details" into **Identity** (who made it, how it's classified)
and **Progress** (what you've done with it) keeps each tab focused.
Every category maps its existing sections into these:

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

2. **Dot indicator.** Tabs with data show a small accent-coloured dot
   next to the label. Lets you scan an item's density at a glance:
   `[Overview •] [Identity] [Media •] [Notes •]` → this item has core
   info, no extended identity data, has media, has notes.

3. **Sticky tab bar.** Scrolling the tab content does not scroll the
   tab bar off. Users can jump between tabs without losing their place.

4. **Keyboard.** `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle tabs. `Ctrl+1..9`
   jumps to nth tab. `Ctrl+K` within the editor opens a field-search
   palette (planned separately).

5. **Save button unchanged.** Footer stays sticky at the bottom of the
   right column. One Save button per item, saves everything regardless
   of active tab.

---

## Chrome — top-nav only

```
┌─────────────────────────────────────────────────────────────────┐
│  ◈ Omnio      [Home]                     [📅] [📊] [⚙]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← library grid / board / detail / editor                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Left cluster: brand mark + Home tab.
- Right cluster: calendar / statistics / settings icons.
- Library switching lives on the Home dashboard (one card per library).
- Collection status chips (Backlog / Playing / Beaten / …) render inside
  the library header, not in persistent chrome.
- The top-nav auto-hides on the Home view — Home has its own header.

---

## Detail modal — single scroll, progressive disclosure

Hero section (cover + title + status + primary meta) pinned at the top;
sections below stack in a single scroll. Empty sections hide themselves.
No tabs — the detail modal is read-only, and the extra click cost
outweighs the density payoff. If a user wants to reorganise they go to
Edit, which is where the tabs live.

---

## Progressive disclosure + tabs = the design contract

New features get a natural home: pick the tab that fits. If a feature
doesn't fit any tab, that's the signal we're adding scope creep — not
just filling in a gap. Tabs are the shell; features are the tenants.

See also:
- `MEMORY.md` → `project_feature_roadmap.md` for the pending feature list per library
- `MEMORY.md` → `feedback_library_consistency.md` for the "new library must follow the pattern" rule
