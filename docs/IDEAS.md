# Feature backlog / brainstorm

Reviewed after the v0.5.0 Tauri cutover. Grouped by theme, with references to
competitors where the pattern comes from. Marked *(shipped)* what Omnio already
covers so nothing gets re-suggested.

## 1. Tracking automation

1. **Windows process watcher for playtime** — Playnite-style
   - Poll foreground process every N seconds, match against the Games library,
     increment `playTime`
   - "Now playing" banner on Home / auto-flip `gameStatus` to `playing`
   - Local scan of Steam/GOG/Epic install folders for auto-library seeding

2. **Bidirectional Trakt / MAL / AniList / Backloggd / Letterboxd sync**
   - Today Omnio only imports (one-shot)
   - Push local status changes upstream when the user wants a public profile
   - Useful for users who treat Omnio as source of truth but keep social profiles

3. **Kindle sync automation** — update "pages read" without re-importing `My Clippings.txt`
   - Watcher on the file if a Kindle is connected
   - Last read position → `pagesRead`

4. **Local installation detection** — minimal Playnite pattern
   - Scan `Steam\steamapps\common`, `GOG Games\`, `Epic Games\`
   - Match against IGDB, propose creating an item if it's missing

5. **Media server integration** — Plex / Jellyfin / Kodi already track watch state
   - Read watch progress via API, fill it into Movies/Series items
   - Complements manual TV tracking

## 2. Cross-media / franchise

6. **Cross-library franchise timelines** — today `franchise` is per-library
   - "The Witcher" would show books + games + Netflix series on ONE timeline
   - Sorted by publication year
   - Auto-appears when three items share a `franchise` value

7. **Bidirectional "Adapted from"** — `originalWorkId` exists for Games
   - Extend to Anime→Manga, Movie→Book, Series→Comic
   - Detail view: "Based on: [Books] Blood Meridian ★★★★★ (your rating)"

8. **Author / director filmography auto-populate**
   - Adding a Guillermo del Toro film → suggest the other 8 he directed (TMDb)
   - "You have 8 of Miyazaki's 12 films — missing: Ponyo, The Wind Rises…"

## 3. Discovery / recommendation

9. **"Similar to what you liked" engine** — 100% local, zero cloud
   - Cosine similarity over tags + genres + franchise between library items
   - Home widget: "Because you rated Spec Ops: The Line ★★★★★…"

10. **Discography completion** (Music)
    - MusicBrainz knows the full discography of an artist
    - "You have 7 of Tool's 11 studio albums — missing: Undertow, Opiate…"
    - Button "wishlist all missing" seeds placeholders

11. **Series next-book auto-suggest** (Books)
    - Detect sagas (Sapkowski · Cosmere · Sanderson) via OpenLibrary
    - "You finished The Blade Itself — First Law #2 is Before They Are Hanged"

## 4. Reading / watching / playing progress

12. **Diary-style entries** (Letterboxd)
    - Rewatch log already exists but each entry could carry a short review
    - "This month" view — everything watched/read/played this month, chronological

13. **Reading challenges** (Goodreads / StoryGraph)
    - "2026 goal: 24 books" — progress bar on Home
    - Genre-restricted challenges: "3 non-fiction / 5 sci-fi / 2 poetry"

14. **Backlog prioritization** — today backlog is a passive list
    - Auto-sort by HowLongToBeat estimated time (Games)
    - "2h session tonight" → filter Games ≤2h remaining

## 5. Ratings + reviews

15. **Half-star ratings** *(shipped)* — 0.5 steps via `RatingPicker` (10-pill row) and half-star display in `StarRatingDisplay`. Min-rating filter supports halves too.

16. **Multi-dimensional ratings** (opt-in per library)
    - Games: gameplay / story / graphics / replayability
    - Movies: direction / acting / cinematography / script
    - Weighted average → single final score

17. **Rich-markdown reviews** — today plain text
    - Bold / italic / links / spoiler tags would materially improve long reviews

## 6. New categories / expansions

18. **Podcasts** — Overcast / PocketCasts pattern
    - RSS feed parsing, episode list, listened tracker
    - Logical extension given the music-adjacent features already in the app

19. **YouTube channels / video series** — creators followed
    - Subs to channels / "caught up" status / notes per series
    - Replaces the ad-hoc mental subs list many users keep

20. **Tabletop RPG / Board Games**
    - Play sessions (date, players, winner, notes)
    - BoardGameGeek as source

21. **TCG / physical collections** — Pokemon cards / Magic / vinyl already partially covered

22. **Fitness / workouts / running** — activity tracker local *(possibly scope-creep)*

## 7. Import expansions

23. **StoryGraph** (books) — many migrate there from Goodreads
24. **RateYourMusic (RYM)** — music power users
25. **Discogs wantlist** in addition to collection
26. **IMDb watchlist export**
27. **HowLongToBeat backlog import**
28. **Personal Kindle library JSON** (via Kindle app export)

## 8. Integrated reader / player

29. **CBZ / CBR reader** — huge for the Manga family (Kavita/Komga level but local)
30. **EPUB reader** — full Books integration
31. **Simple audio player** — for the music tracker, with local playlists

## 9. Notifications + calendar

32. **Granular release calendar** — today has iCal export
    - Home widget "Upcoming this week: X, Y, Z"
    - Watch/read reminder for simulcast episodes

33. **Steam sale watcher** — "Wishlist item X dropped to $9.99"
    - IsThereAnyDeal API is free

34. **New chapter alert** — MangaDex web has follow-chapters
    - Periodic poll for mangas with `mangadexId` filled

## 10. Stats & visualization

35. **Time-of-day / day-of-week heatmap** (Yearly Wrapped exists)
    - "You watch anime mostly Sundays 10pm–2am" — Spotify Wrapped-style insight

36. **Rating distribution vs global** — "Your rating: ★★★★, TMDb average: 6.8/10"

37. **Backlog burn-down chart** — "at this pace, your backlog dies in 4.2 years"

38. **Genre wheel radar chart** per library

## 11. Local sync (no own cloud)

39. **Git-backed data folder** — auto-commit + push to user's own repo
    - `data/` as a git repo → history + rollback + push to a private GitHub repo

40. **Syncthing profile / config** — helper for 2-machine setup

41. **Automatic encrypted backup** — 7z + password, rotates

## 12. Power-user UX

42. **Command palette expansion** — Ctrl+K already exists
    - Verbs too: "add:game Hollow Knight", "rate:5 CurrentItem"

43. **Quick-add via URL bar** — paste IGDB/TMDb/AniList URL → auto-fetch
    - Detect URL in clipboard when the add panel opens

44. **Reactive bulk edit** — today bulk changes ONE field. Multi-field bulk (status + tag + rating together)

45. **Custom smart lists / saved searches** — "All 5★ games I finished in 2024" as a saved filter

46. **Reorderable library sidebar** — today the order is alphabetical fixed

47. **Split view** — two libraries side by side at once

48. **Item template system** — "when I add a manga, prefill with these defaults"

## 13. Charts / graphics

49. **Cover wall** — export as a 4K image with ALL your covers in a grid
    - Social-media-friendly "shelfie"

50. **Enriched Yearly Wrapped** — today short
    - Per category, per month, top X by rating, top X by playtime

## 14. Long-shot / experimental

51. **Local LLM opt-in** (via Ollama)
    - Auto-generate reviews: "summarize my note in 3 lines"
    - Auto-tag from notes: "classify this as jrpg/action/etc"
    - Zero cloud, off-by-default

52. **AR trophy shelf** — Meta Quest / Apple Vision Pro visual gallery — very fringe

---

## Competitor reference

- **Playnite** (Windows games manager) — process watch, auto-import Steam/GOG/Epic, plugin ecosystem
- **Backloggd** — Letterboxd for games, reviews, lists, half-star ratings
- **Letterboxd** — reviews, lists, watchlist, diary, awards
- **Goodreads** — reading challenges, reviews
- **StoryGraph** — Goodreads alternative with richer stats
- **MyAnimeList / AniList** — episode tracking, recommendations
- **HowLongToBeat** — estimated completion times
- **Trakt.tv** — cross-media checkpoints, watchlist sync
- **Last.fm** — scrobbling, stats
- **Kavita / Komga** — self-hosted comic/manga readers
- **Overcast / PocketCasts** — podcast tracking pattern
- **RateYourMusic (RYM)** — music power-user platform
- **BoardGameGeek** — board games DB + play tracking
