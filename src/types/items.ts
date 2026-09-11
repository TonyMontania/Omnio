// Discriminated-union item types. Every item on disk still lives inside
// the same `data/{category}.json` file it always did — this module only
// changes what TypeScript knows about it.
//
// The legacy `Item` interface (in `entities.ts`) is a bag of ~130
// optional fields, so `item.gameStatus` compiles even on a music entry
// even though it can never be defined there. The strict types below
// carve that bag into one variant per category:
//
//   GameItem   — `categoryId: 'videojuegos'`
//   MusicItem  — `categoryId: 'musica'`
//   MangaItem  — `categoryId: 'manga' | 'manhwa' | 'manhua' | 'comics_west'`
//   AnimeItem  — `categoryId: 'anime' | 'donghua'`
//   MovieItem  — `categoryId: 'peliculas'`
//   SeriesItem — `categoryId: 'series'`
//   BookItem   — `categoryId: 'libros'`
//   VnItem     — `categoryId: 'visual_novels'`
//
// A component that already knows what category it renders (a detail
// modal, an editor section) declares its prop as the matching variant
// — inside, `item.gameStatus` is safe and `item.vnCharacters` is a
// compile error. Cross-category code takes `TypedItem` and narrows via
// the `isGameItem` / `isMusicItem` type guards or a `categoryId` switch.
//
// This file introduces the strict shape without touching the legacy
// `Item`; callers opt in as they migrate. When every consumer has moved
// over, `Item` is deleted and `TypedItem` renamed to `Item` (Fase 1.1
// wrap-up).

// Alias re-export so `import { Item } from './types'` resolves to the
// loose bag from `./entities` for now. The strict variants + type
// guards below stay opt-in until Fase 2 splits App.tsx state.
export type { AnyItem as Item } from './entities'

import type {
  Ownership, GameStatus, GameSource,
  MusicType, MusicSource, Track, VinylCondition,
  MangaStatus, PublicationStatus, MangaSource, MangaVolume, Chapter, MediaOwnership,
  AnimeStatus, AnimeSource, AnimeFormat, AnimeSeason, AiringStatus, Demographic, Episode, Weekday,
  SeriesStatus, SeriesFormat, Season,
  MovieSource, WatchLocation,
  BookStatus, BookFormat, BookSource,
  VisualNovelStatus, VnLength, VnCharacter, VnStaffMember, VnScreenshot,
  VnCover, VnEdition, VnPublisher, VnDevStatus,
  AgeRating, RelatedItem, RewatchEntry,
  SingleCover, AlbumEdition, ConcertEntry, Unit,
  CustomField, SaveFile, Achievement, Screenshot, ChapterNote, Highlight,
  DlcEntry, BundleGame,
  Platform,
} from './entities'

// ---------------------------------------------------------------------
// CategoryId — literal union of every valid `categoryId` string. Every
// place that used to compare `activeCategory === 'visual_novels'` will
// switch to this so a typo becomes a compile error.
// ---------------------------------------------------------------------
export type GameCategoryId = 'videojuegos'
export type MusicCategoryId = 'musica'
export type MangaCategoryId = 'manga' | 'manhwa' | 'manhua' | 'comics_west'
export type AnimeCategoryId = 'anime' | 'donghua'
export type MovieCategoryId = 'peliculas'
export type SeriesCategoryId = 'series'
export type BookCategoryId = 'libros'
export type VnCategoryId = 'visual_novels'

export type CategoryId =
  | GameCategoryId
  | MusicCategoryId
  | MangaCategoryId
  | AnimeCategoryId
  | MovieCategoryId
  | SeriesCategoryId
  | BookCategoryId
  | VnCategoryId

// ---------------------------------------------------------------------
// BaseItem — fields every category actually uses. Cover, notes, tags,
// rating, favorite, custom fields. `description` is here because it
// appears in enough categories (games / books / VN / music genres line
// etc.) that pushing it into every variant only duplicated the field.
// Same reasoning for `bannerImage` / `logoImage` (rendered on every
// detail modal that has hero art) and the release/franchise metadata
// which is used across almost every category.
// ---------------------------------------------------------------------
export interface BaseItem {
  id: string
  categoryId: CategoryId
  title: string
  createdAt: number
  favorite?: boolean
  cover?: string
  bannerImage?: string
  logoImage?: string
  description?: string
  notes?: string
  tags?: string[]
  rating?: number
  finishedAt?: string
  // Semi-universal metadata — used by ≥5 categories.
  releaseDate?: string
  releaseYear?: string
  alternativeTitles?: string[]
  genres?: string[]
  franchise?: string
  ageRating?: AgeRating
  hasSpoilers?: boolean
  // Cross-library adaptation link. Points at another item in the
  // library — typically the original work an adaptation is based on
  // (Anime → Manga, Movie → Book, Series → Comic, Game → its source
  // novel, etc.). Unlike `originalWorkId` (games-only, remake chain),
  // this crosses categories. Rendering the reverse edge (all items
  // that link back to `me`) is done at render-time — no second field.
  basedOnItemId?: string
  startDate?: string
  // History + graph edges — every category has them.
  rewatches?: RewatchEntry[]
  relatedItems?: RelatedItem[]
  recommendedItems?: string[]
  // Notion-style extras rendered on every detail view.
  customFields?: CustomField[]
}

// ---------------------------------------------------------------------
// Per-category field sets. Anything only relevant to one variant.
// ---------------------------------------------------------------------

export interface GameFields {
  gameStatus?: GameStatus
  gameSource?: GameSource
  gameReview?: string
  playTime?: string
  duration?: string
  // Estimated hours to beat the main story (HowLongToBeat). Used by
  // the backlog prioritization sort ("Shortest first") and displayed
  // in the games detail view. Stored as a number so we can sort
  // numerically without parsing.
  hltbHours?: number
  hltbHoursCompletionist?: number
  hltbHoursExtras?: number
  ownership?: Ownership
  platforms?: Platform[]
  devs?: string[]
  publishers?: string[]
  achievementsUnlocked?: string
  achievementsTotal?: string
  achievements?: Achievement[]
  saveFiles?: SaveFile[]
  screenshots?: Screenshot[]
  hasDlc?: boolean
  dlcList?: DlcEntry[]
  hasAddons?: boolean
  addonsList?: DlcEntry[]
  isBundle?: boolean
  bundleContents?: BundleGame[]
  pcgwPage?: string
  originalWorkId?: string
}

export interface MusicFields {
  musicType?: MusicType
  musicSource?: MusicSource
  musicReview?: string
  artist?: string
  label?: string
  producers?: string[]
  consumed?: boolean
  partOfAlbum?: string
  partOfAlbumId?: string
  hasTracks?: boolean
  tracks?: Track[]
  singleCovers?: SingleCover[]
  editions?: AlbumEdition[]
  vinylCondition?: VinylCondition
  concerts?: ConcertEntry[]
  discCount?: string
  mediaOwnership?: MediaOwnership
}

export interface MangaFields {
  mangaStatus?: MangaStatus
  mangaSource?: MangaSource
  pubStatus?: PublicationStatus
  authors?: string[]
  mangaArtists?: string[]
  chaptersRead?: string
  totalChapters?: string
  volumesRead?: string
  totalVolumes?: string
  volumeCovers?: MangaVolume[]
  magazine?: string
  hasChapters?: boolean
  chapters?: Chapter[]
  mediaOwnership?: MediaOwnership
  mangadexId?: string
  mangaDescription?: string
  mangaReview?: string
  publisher?: string
}

export interface AnimeFields {
  watchStatus?: AnimeStatus
  animeSource?: AnimeSource
  animeFormat?: AnimeFormat
  airingStatus?: AiringStatus
  airingDay?: Weekday
  episodesWatched?: string
  totalEpisodes?: string
  season?: AnimeSeason
  seasonYear?: string
  demographic?: Demographic
  studios?: string[]
  episodeDuration?: string
  airedFrom?: string
  airedTo?: string
  favoriteEpisode?: string
  favoriteEpisodeNote?: string
  droppedAtEpisode?: string
  droppedReason?: string
  hasEpisodes?: boolean
  episodes?: Episode[]
  animeReview?: string
  animeDescription?: string
}

export interface MovieFields {
  movieSource?: MovieSource
  movieReview?: string
  movieDescription?: string
  consumed?: boolean
  duration?: string
  timesWatched?: string
  directors?: string[]
  cast?: string[]
  writers?: string[]
  productionCompanies?: string[]
  distributors?: string[]
  watchedWhere?: WatchLocation
  bannerImage2?: string
  contentRating?: string
}

export interface SeriesFields {
  seriesStatus?: SeriesStatus
  seriesFormat?: SeriesFormat
  seriesDescription?: string
  seriesReview?: string
  showrunners?: string[]
  writers?: string[]
  directors?: string[]
  cast?: string[]
  network?: string
  country?: string
  language?: string
  contentRating?: string
  hasSeasons?: boolean
  seasons?: Season[]
  episodesWatched?: string
  totalEpisodes?: string
  unitCount?: string
  startYear?: string
  endYear?: string
  units?: Unit[]
  bannerImage2?: string
}

export interface BookFields {
  bookStatus?: BookStatus
  bookFormat?: BookFormat
  bookSource?: BookSource
  bookReview?: string
  publisher?: string
  saga?: string
  sagaIndex?: string
  translator?: string
  pagesRead?: string
  totalPages?: string
  isbn?: string
  authors?: string[]
  pubStatus?: PublicationStatus
  chapterNotes?: ChapterNote[]
  highlights?: Highlight[]
}

export interface VnFields {
  visualNovelStatus?: VisualNovelStatus
  vnLength?: VnLength
  vnLengthHours?: string
  vnEngine?: string
  vnOriginalLanguage?: string
  vnLanguages?: string[]
  vnAliases?: string[]
  vnCharacters?: VnCharacter[]
  vnStaff?: VnStaffMember[]
  vnScreenshots?: VnScreenshot[]
  vnCovers?: VnCover[]
  vnEditions?: VnEdition[]
  vnPublishers?: VnPublisher[]
  vnCommunityRating?: string
  vnDevStatus?: VnDevStatus
  vnDescription?: string
  vnReview?: string
  vndbId?: string
  nsfw?: boolean
  // Shared with games — devs / publishers / platforms / playTime are
  // legitimate on a VN too (studios that shipped it, engine platforms,
  // how long you played). Duplicated to stay accessible on VnItem
  // without pulling in the rest of GameFields.
  devs?: string[]
  publishers?: string[]
  platforms?: Platform[]
  playTime?: string
}

// ---------------------------------------------------------------------
// The variants. Each is BaseItem + one discriminator + one field set.
// ---------------------------------------------------------------------

export type GameItem   = BaseItem & GameFields   & { categoryId: GameCategoryId }
export type MusicItem  = BaseItem & MusicFields  & { categoryId: MusicCategoryId }
export type MangaItem  = BaseItem & MangaFields  & { categoryId: MangaCategoryId }
export type AnimeItem  = BaseItem & AnimeFields  & { categoryId: AnimeCategoryId }
export type MovieItem  = BaseItem & MovieFields  & { categoryId: MovieCategoryId }
export type SeriesItem = BaseItem & SeriesFields & { categoryId: SeriesCategoryId }
export type BookItem   = BaseItem & BookFields   & { categoryId: BookCategoryId }
export type VnItem     = BaseItem & VnFields     & { categoryId: VnCategoryId }

// The discriminated union. Consumers that know they're dealing with a
// concrete category — after a `switch (item.categoryId)` or an
// `isGameItem(item)` guard — get a strict per-variant type where
// accessing a field from another category is a compile error.
//
// `TypedItem` is the same union, kept as an explicit name for the rare
// consumer that wants to say "specifically one of the strict variants,
// not the loose bag". Cross-category consumers keep using `Item` (see
// note in `types/entities.ts`).
export type TypedItem =
  | GameItem
  | MusicItem
  | MangaItem
  | AnimeItem
  | MovieItem
  | SeriesItem
  | BookItem
  | VnItem

// ---------------------------------------------------------------------
// Type guards. Every consumer that used `activeCategory === 'X'` moves
// to `isXItem(item)` — the narrowing is the same but the compiler
// stops accepting typos and refuses fields that don't belong.
// ---------------------------------------------------------------------

export function isGameItem(item: { categoryId: string }): item is GameItem {
  return item.categoryId === 'videojuegos'
}

export function isMusicItem(item: { categoryId: string }): item is MusicItem {
  return item.categoryId === 'musica'
}

export function isMangaItem(item: { categoryId: string }): item is MangaItem {
  return item.categoryId === 'manga'
    || item.categoryId === 'manhwa'
    || item.categoryId === 'manhua'
    || item.categoryId === 'comics_west'
}

export function isAnimeItem(item: { categoryId: string }): item is AnimeItem {
  return item.categoryId === 'anime' || item.categoryId === 'donghua'
}

export function isMovieItem(item: { categoryId: string }): item is MovieItem {
  return item.categoryId === 'peliculas'
}

export function isSeriesItem(item: { categoryId: string }): item is SeriesItem {
  return item.categoryId === 'series'
}

export function isBookItem(item: { categoryId: string }): item is BookItem {
  return item.categoryId === 'libros'
}

export function isVnItem(item: { categoryId: string }): item is VnItem {
  return item.categoryId === 'visual_novels'
}

// Exhaustive-switch helper. Callers use it in the default branch of a
// switch to force TypeScript to complain when a new category is added
// and this switch wasn't updated.
export function assertNeverCategory(x: never): never {
  throw new Error(`unhandled categoryId variant: ${JSON.stringify(x)}`)
}
