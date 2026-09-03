// Field-map dispatch for merging a fetched metadata `Partial<AnyItem>`
// patch into the editor form (Fase 3.1). Before this file, App.tsx held
// a 200-line `applyFetchedPatch` that was ~60 `if (patch.X) setX(patch.X)`
// lines with a scattering of guards and transforms — adding a new field
// meant editing the middle of App.tsx and hoping nothing collided.
//
// Now every routing lives here as one row in `PATCH_ROUTES`. The runner
// walks the table once per patch and applies the matching side effect.
// Rust port becomes a `match key { ... }` block or a `HashMap<&str, Fn>`.
//
// What stays in App.tsx: things that need renderer-only context
// (`editingItem`, `items`, `window.ipcRenderer`, `setToast`) — cover /
// banner cleanup, franchise sibling counting for the toast, IGDB parent-
// game lookup, and VNDB relation resolution. Those live in the wrapper
// that calls `applyPatchFieldsToForm`.

import type { AnyItem } from '../types'
import { assertNever, isAnimeLikeCategory, isMangaLikeCategory } from '../categories'
import type { CategoryId } from '../types/items'
import type { FormSetters } from './formActions'

// Renderer context each route can read. Kept minimal on purpose — if a
// route needs more, prefer keeping that logic in the App.tsx wrapper and
// passing the result through the patch rather than plumbing extra state
// into every row.
export interface PatchContext {
  activeCategory: CategoryId
}

// A single routing rule. Each row declares which patch key it consumes
// (`from`, kept for docs / grep) and an `apply` closure that runs the
// side effect. Guards (truthy / defined / category-gated) are baked in
// by the helper builders below so rows stay one-liners.
export interface PatchRoute {
  from: keyof AnyItem
  apply: (patch: Partial<AnyItem>, s: FormSetters, ctx: PatchContext) => void
}

// -- Route builders ---------------------------------------------------
//
// `truthy` mirrors the old `if (patch.X) setX(patch.X)` idiom: skip
// falsy (undefined, empty string, empty array) values. Most fetcher
// fields fall into this bucket — a source that has no value for a field
// just leaves it undefined.
function truthy<K extends keyof AnyItem>(
  from: K,
  apply: (v: NonNullable<AnyItem[K]>, s: FormSetters, ctx: PatchContext) => void,
): PatchRoute {
  return {
    from,
    apply: (patch, s, ctx) => {
      const v = patch[from]
      if (v) apply(v as NonNullable<AnyItem[K]>, s, ctx)
    },
  }
}

// `defined` mirrors `if (patch.X !== undefined) setX(patch.X ?? '')`:
// applies even when the value is an empty string or null so a fetcher
// can *clear* a field it previously filled. Used for the small handful
// of fields (network, country, franchise, isbn, …) where "no value" is
// a meaningful override.
function defined<K extends keyof AnyItem>(
  from: K,
  apply: (v: AnyItem[K], s: FormSetters, ctx: PatchContext) => void,
): PatchRoute {
  return {
    from,
    apply: (patch, s, ctx) => {
      if (patch[from] !== undefined) apply(patch[from] as AnyItem[K], s, ctx)
    },
  }
}

// `truthyIf` is the category-gated variant: only fires when `onlyIf`
// returns true for the current context. Used for the `tags` route,
// which only applies to Visual Novels — every other category has its
// own tag editor that should be user-driven, not fetcher-driven.
function truthyIf<K extends keyof AnyItem>(
  from: K,
  onlyIf: (ctx: PatchContext) => boolean,
  apply: (v: NonNullable<AnyItem[K]>, s: FormSetters, ctx: PatchContext) => void,
): PatchRoute {
  return {
    from,
    apply: (patch, s, ctx) => {
      const v = patch[from]
      if (v && onlyIf(ctx)) apply(v as NonNullable<AnyItem[K]>, s, ctx)
    },
  }
}

// -- The route table --------------------------------------------------
//
// Grouped by fetcher family for readability, not by execution order —
// the runner walks the array top-to-bottom, so if two rows want to touch
// the same setter (see `description` vs the per-category description
// rows) put the more specific one first.
export const PATCH_ROUTES: PatchRoute[] = [
  // -- Universal -----------------------------------------------------
  truthy('title', (v, s) => s.setTitle(v)),
  truthy('alternativeTitles', (v, s) => s.setAlternativeTitles(v)),
  truthy('genres', (v, s) => s.setGenres(v)),
  truthy('releaseDate', (v, s) => {
    s.setReleaseDate(v)
    // Movies + a few other cards show a separate "Release year" field
    // that's disconnected from the ISO date. Derive it here so both
    // stay in sync — otherwise the card shows the right year but the
    // editor field is empty.
    const yr = v.slice(0, 4)
    if (/^\d{4}$/.test(yr)) s.setReleaseYear(yr)
  }),
  truthy('releaseYear', (v, s) => s.setReleaseYear(v)),
  truthy('duration', (v, s) => s.setDuration(v)),

  // -- Anime / Donghua (AniList, Jikan, Kitsu) -----------------------
  truthy('airedFrom', (v, s) => s.setAiredFrom(v)),
  truthy('airedTo', (v, s) => s.setAiredTo(v)),
  truthy('seasonYear', (v, s) => s.setSeasonYear(v)),
  truthy('season', (v, s) => s.setSeason(v)),
  truthy('episodeDuration', (v, s) => s.setEpisodeDuration(v)),
  truthy('unitCount', (v, s) => s.setUnitCount(v)),
  truthy('studios', (v, s) => s.setStudios(v)),
  truthy('animeFormat', (v, s) => s.setAnimeFormat(v)),
  truthy('animeSource', (v, s) => s.setAnimeSource(v)),
  truthy('totalEpisodes', (v, s) => s.setTotalEpisodes(v)),
  truthy('animeDescription', (v, s) => s.setAnimeDescription(v)),
  truthy('airingStatus', (v, s) => s.setAiringStatus(v)),
  truthy('demographic', (v, s) => s.setDemographic(v)),

  // -- Movies / Series (TMDb) ----------------------------------------
  truthy('movieDescription', (v, s) => s.setMovieDescription(v)),
  truthy('seriesDescription', (v, s) => s.setSeriesDescription(v)),
  truthy('cast', (v, s) => s.setCast(v)),
  truthy('directors', (v, s) => s.setDirectors(v)),
  truthy('writers', (v, s) => s.setWriters(v)),
  truthy('showrunners', (v, s) => s.setShowrunners(v)),
  truthy('productionCompanies', (v, s) => s.setProductionCompanies(v)),
  truthy('distributors', (v, s) => s.setDistributors(v)),
  defined('network', (v, s) => s.setNetwork(v ?? '')),
  defined('country', (v, s) => s.setCountry(v ?? '')),
  defined('language', (v, s) => s.setLanguage(v ?? '')),
  defined('contentRating', (v, s) => s.setContentRating(v ?? '')),
  truthy('seriesFormat', (v, s) => s.setSeriesFormat(v)),
  defined('startYear', (v, s) => s.setStartYear(v ?? '')),
  defined('endYear', (v, s) => s.setEndYear(v ?? '')),
  defined('hasSeasons', (v, s) => s.setHasSeasons(v ?? false)),
  truthy('seasons', (v, s) => s.setSeasons(v)),

  // -- Music (MusicBrainz) -------------------------------------------
  defined('artist', (v, s) => s.setArtist(v ?? '')),
  truthy('musicType', (v, s) => s.setMusicType(v)),
  truthy('musicSource', (v, s) => s.setMusicSource(v)),
  defined('label', (v, s) => s.setLabel(v ?? '')),
  truthy('producers', (v, s) => s.setProducers(v)),
  defined('hasTracks', (v, s) => s.setHasTracks(v ?? false)),
  truthy('tracks', (v, s) => s.setTracks(v)),

  // -- Games (IGDB) --------------------------------------------------
  truthy('devs', (v, s) => s.setDevs(v)),
  truthy('publishers', (v, s) => s.setPublishers(v)),
  truthy('platforms', (v, s) => s.setPlatforms(v)),
  defined('franchise', (v, s) => s.setFranchise(v ?? '')),
  truthy('ageRating', (v, s) => s.setAgeRating(v)),
  truthy('gameSource', (v, s) => s.setGameSource(v)),

  // -- Manga family (ComicVine, MangaDex) ----------------------------
  //
  // `authors` unconditionally routes to the manga-authors setter — the
  // pre-refactor code branched on `activeCategory === 'libros'` but
  // both branches ended in the same setter call, so the guard was a
  // no-op.
  truthy('authors', (v, s) => s.setMangaAuthors(v)),
  truthy('mangaArtists', (v, s) => s.setMangaArtists(v)),
  truthy('mangaDescription', (v, s) => s.setMangaDescription(v)),
  truthy('totalChapters', (v, s) => s.setTotalChapters(v)),
  truthy('totalVolumes', (v, s) => s.setTotalVolumesM(v)),
  defined('magazine', (v, s) => s.setMagazine(v ?? '')),
  truthy('pubStatus', (v, s) => s.setPubStatus(v)),
  truthy('mangaSource', (v, s) => s.setMangaSource(v)),
  defined('mangadexId', (v, s) => s.setMangadexId(v ?? '')),

  // -- Books (OpenLibrary) -------------------------------------------
  defined('publisher', (v, s) => s.setPublisher(v ?? '')),
  defined('isbn', (v, s) => s.setIsbn(v ?? '')),
  defined('totalPages', (v, s) => s.setTotalPages(v ?? '')),
  defined('saga', (v, s) => s.setSaga(v ?? '')),
  defined('sagaIndex', (v, s) => s.setSagaIndex(v ?? '')),
  truthy('bookFormat', (v, s) => s.setBookFormat(v)),
  truthy('bookSource', (v, s) => s.setBookSource(v)),
  defined('translator', (v, s) => s.setTranslator(v ?? '')),

  // -- Description dispatch ------------------------------------------
  //
  // Fetchers that don't know which category they're feeding pass the
  // description through the generic `description` key; we route it to
  // the right per-category setter based on the active library. Ordered
  // AFTER the explicit `animeDescription` / `movieDescription` /
  // `seriesDescription` / `mangaDescription` rows so an explicit field
  // wins if both are present.
  truthy('description', (v, s, ctx) => {
    // Exhaustive dispatch on CategoryId — every case is handled below,
    // and the `assertNever` tail forces TypeScript to error at compile
    // time if a new category joins the union without a routing here.
    const cat = ctx.activeCategory
    if (isAnimeLikeCategory(cat)) { s.setAnimeDescription(v); return }
    if (isMangaLikeCategory(cat)) { s.setMangaDescription(v); return }
    switch (cat) {
      case 'peliculas':     s.setMovieDescription(v); return
      case 'series':        s.setSeriesDescription(v); return
      case 'videojuegos':
      case 'musica':
      case 'libros':
      case 'visual_novels': s.setDescription(v); return
      default: assertNever(cat, 'applyPatch/description dispatch')
    }
  }),

  // -- Visual Novels (VNDB) ------------------------------------------
  defined('vnDescription', (v, s) => s.setVnDescription(v ?? '')),
  truthy('vnAliases', (v, s) => s.setVnAliases(v)),
  truthy('vnLength', (v, s) => s.setVnLength(v)),
  defined('vnLengthHours', (v, s) => s.setVnLengthHours(v ?? '')),
  defined('vnEngine', (v, s) => s.setVnEngine(v ?? '')),
  defined('vnOriginalLanguage', (v, s) => s.setVnOriginalLanguage(v ?? '')),
  truthy('vnLanguages', (v, s) => s.setVnLanguages(v)),
  truthy('vnStaff', (v, s) => s.setVnStaff(v)),
  truthy('vnCharacters', (v, s) => s.setVnCharacters(v)),
  truthy('vnEditions', (v, s) => s.setVnEditions(v)),
  truthy('vnPublishers', (v, s) => s.setVnPublishers(v)),
  truthy('vnScreenshots', (v, s) => s.setVnScreenshots(v)),
  truthy('vnCovers', (v, s) => s.setVnCovers(v)),
  defined('vnCommunityRating', (v, s) => s.setVnCommunityRating(v ?? '')),
  truthy('vnDevStatus', (v, s) => s.setVnDevStatus(v)),
  defined('vndbId', (v, s) => s.setVndbId(v ?? '')),
  defined('nsfw', (v, s) => s.setNsfw(!!v)),
  truthy('visualNovelStatus', (v, s) => s.setVisualNovelStatus(v)),
  // VNDB drops content tags into `patch.tags`; every other library's
  // tags stay user-driven, so gate this to VN.
  truthyIf('tags', (ctx) => ctx.activeCategory === 'visual_novels', (v, s) => s.setTags(v)),
]

// -- Runner -----------------------------------------------------------
//
// Walk every route once against the incoming patch. Routes are pure
// (side effects go only through the setters passed in), so order-of-
// evaluation only matters when two rows can touch the same setter —
// see the `description` note above.
export function applyPatchFieldsToForm(
  patch: Partial<AnyItem>,
  setters: FormSetters,
  ctx: PatchContext,
): void {
  for (const route of PATCH_ROUTES) route.apply(patch, setters, ctx)
}
