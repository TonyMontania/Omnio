# Fetcher field coverage

Which library-editor fields each metadata source populates on **Apply**,
plus a short note when the field is left blank on purpose. Baseline for
audits and "why didn't X get filled in?" questions.

Legend: ✅ set · ⚠ inferred (best-effort) · ✖ not available in the
source's API · — irrelevant to that source's library.

---

## Books · OpenLibrary

| Field | Status | Notes |
|---|---|---|
| Title, authors, description, genres, ISBN, publisher, total pages, release year, cover | ✅ | Wired via `applyFetchedPatch` after the setter list was extended. |
| Series / Book # in series | ✖ | OpenLibrary's series data lives on the *work*, not on individual editions; the search returns editions and doesn't include the series slot. |
| Translator | ✖ | Not exposed by the OpenLibrary search or work endpoints. |
| Book source (original / translation / adaptation) | ✖ | Not modeled by OpenLibrary. User picks manually. |
| Format (paperback / ebook / …) | ✖ | OpenLibrary marks editions with a physical_format string that's inconsistent enough we don't guess. |
| Publication status | ✖ | Not applicable to books the way it is to serialized manga. |
| Franchise | ✖ | No cross-book grouping field. |

## Anime / Donghua · AniList + Kitsu + AniDB

| Field | AniList | Kitsu | AniDB |
|---|---|---|---|
| Title / alt titles / studios / format / description / genres / dates / episodes | ✅ | ✅ | ✅ |
| Demographic | ⚠ inferred from `genres` (Shounen/Shoujo/Seinen/Josei) | ✖ not in Kitsu's attrs | ✖ |
| Age rating | ✖ AniList only has `isAdult:bool` | ✅ (G/PG/R/R18 → E/E10/T/M) | ✖ |
| Airing status | ✅ | ✅ | ✖ |

## Manga · AniList + Kitsu + MangaDex

| Field | AniList | Kitsu | MangaDex |
|---|---|---|---|
| Title / alt / authors / artists / description / genres / chapters / volumes | ✅ | ✅ | ✅ |
| Publication status | ✅ | ✅ | ✅ |
| Magazine / serialization | ✖ needs a separate `relations` query | ✖ | ✖ MangaDex ties it via publisher rels, not the manga endpoint |
| Demographic | ⚠ inferred from genres | ✖ | ✅ (`publicationDemographic`) |
| Age rating | ✖ | ✅ | ✅ (`contentRating`) |
| MangaDex ID | — | — | ✅ (was already set on the patch but not wired into the editor state — fixed) |

## Comics-West · ComicVine

Volumes-level data (name, description, publisher, start year, cover,
creators). Individual issue fields aren't fetched.

## Movies · TMDb

| Field | Status | Notes |
|---|---|---|
| Title / description / release date / cast / directors / writers / production companies / genres / runtime / franchise / content rating (MPAA) | ✅ | |
| Distributors ("Distributed by") | ✖ | TMDb has `production_companies` but no distributor field. The theatrical distributor sometimes overlaps with a production company but there's no reliable split. Left for user. |
| Movie source (original / remake / adaptation) | ✖ | Not modeled by TMDb. |

## Series · TMDb

| Field | Status | Notes |
|---|---|---|
| Title / description / cast / showrunners / directors / writers / network / country / language / genres / format / seasons / total episodes / content rating (TV-MA…) | ✅ | Crew presence depends on TMDb having the data for the show; obscure titles may return an empty crew list. |
| First season year / Last season year | ✅ | Now derived from `first_air_date` / `last_air_date` on Apply. |
| Ep. duration (min) | ✅ | `episode_run_time[0]`. |
| Franchise | ✖ | TV series have no `belongs_to_collection`. |

## Games · IGDB

| Field | Status | Notes |
|---|---|---|
| Title / devs / publishers / platforms / genres / description / cover / banner / logo / franchise / age rating / release date | ✅ | |
| Source (remake / remaster / port / …) | ✅ | Mapped from IGDB `category` enum; when IGDB reports `main_game`, we fall back to title heuristics ("Definitive Edition", "Remaster", …). Games that are actually originals leave this field empty on purpose — the user can pick "original" explicitly. |
| Save + config paths | ✅ | Via the PCGamingWiki inline block in the game editor, not IGDB. |

## Music · MusicBrainz

| Field | Status | Notes |
|---|---|---|
| Title / artist / alt titles / release date / label / distributor / type / source / genres / cover / tracklist | ✅ | |
| Producers | ✅ | Extracted from release-level artist-relations. |
| Track artists | ✅ | Now pulled from each recording's `artist-credit`; only set on tracks whose artist actually differs from the album artist. |

## Music · VGMdb

Routed through the community `vgmdb.info` JSON proxy. Frequently
returns "fetch failed" when the proxy is under load — that's an
availability problem with the third party, not an Omnio bug. When it
succeeds it fills title, artist, alt titles, full release date, label,
distributor, genres, producers (falling back to composers), tracklist,
and cover.

---

## Where field wiring lives

Every fetcher builds a `Partial<Item>` and hands it to
`applyFetchedPatch(patch, coverPath, bannerPath, sourceLabel, hints)` in
`App.tsx`. That function decides which state setter each key maps to
based on the active category. Adding a new field usually means:

1. Fetcher: set `patch.<field>` from the API response.
2. `applyFetchedPatch`: add an `if (patch.<field>) set<Field>(patch.<field>)` branch.
3. If the field is category-specific (book vs series vs anime), gate
   the setter on `activeCategory` inside `applyFetchedPatch`.
