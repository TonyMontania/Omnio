// Table-driven merge of a fetched metadata Partial<AnyItem> patch into
// the editor form. Each row consumes one patch key. Anything that
// needs renderer-only context (existing item lookups, IPC calls,
// toasts, cover/banner cleanup) stays in the App.tsx wrapper.

import type { AnyItem } from '../types'
import { assertNever, isAnimeLikeCategory, isMangaLikeCategory } from '../categories'
import type { CategoryId } from '../types/items'
import type { FormSetters } from './formActions'

export interface PatchContext {
  activeCategory: CategoryId
}

export interface PatchRoute {
  from: keyof AnyItem
  apply: (patch: Partial<AnyItem>, s: FormSetters, ctx: PatchContext) => void
}

// `if (patch.X) apply(patch.X)` — skip empty/undefined values.
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

// `if (patch.X !== undefined) apply(patch.X)` — applies even for empty
// string / null so a fetcher can clear a field it previously filled.
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

// Same as `truthy` but only when `onlyIf` returns true for the ctx.
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

// Route table. Runner walks top-to-bottom, so put more specific rows
// (per-category description, etc.) before their generic fallback.
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
  defined('hasEpisodes', (v, s) => s.setHasEpisodes(v ?? false)),
  truthy('episodes', (v, s) => s.setEpisodes(v)),

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

  // Ordered AFTER the per-category description rows so an explicit
  // key wins over a generic one when both are present.
  truthy('description', (v, s, ctx) => {
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
  // Only VN accepts tags from a fetcher; every other library's tags
  // stay user-driven.
  truthyIf('tags', (ctx) => ctx.activeCategory === 'visual_novels', (v, s) => s.setTags(v)),
]

export function applyPatchFieldsToForm(
  patch: Partial<AnyItem>,
  setters: FormSetters,
  ctx: PatchContext,
): void {
  for (const route of PATCH_ROUTES) route.apply(patch, setters, ctx)
}
