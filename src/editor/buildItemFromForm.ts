// Pure function that takes the editor form's current field values and
// assembles the `AnyItem` payload that gets persisted. Extracted from
// App.tsx (Fase 2.1) so the ~250 LoC of per-category branches don't
// bloat the main component.
//
// Every field is passed in explicitly through `FormSnapshot` — no
// closures over state, no hidden inputs. That makes the function easy
// to test in isolation, easy to port to Rust (a `From<&FormState>` for
// `Item` gets you the same shape), and easy to reason about when the
// output-shape rules per category change.
//
// The category-specific branch structure is preserved as-is from the
// pre-extract App.tsx code so the resulting `AnyItem` shape stays
// identical to what pre-Fase-2.1 saves wrote to disk.

import { seasonsDerivedCounts, isAlbumLikeMusic, isMangaLike } from '../types'
import { isAnimeLikeCategory } from '../categories'
import type { CategoryId } from '../types/items'
import type {
  AnyItem, CustomField, Track, DlcEntry, BundleGame, SaveFile,
  Achievement, Screenshot, ChapterNote, MangaVolume, Chapter,
  Episode, Season, SingleCover, AlbumEdition, Unit,
  VnCharacter, VnStaffMember, VnScreenshot, VnCover, VnEdition, VnPublisher,
  Ownership, GameStatus, GameSource,
  MusicType, MusicSource, VinylCondition,
  MangaStatus, MangaSource, PublicationStatus, MediaOwnership,
  AnimeStatus, AnimeFormat, AiringStatus, AnimeSeason, Demographic, AnimeSource, Weekday,
  SeriesStatus, SeriesFormat,
  MovieSource, WatchLocation,
  BookStatus, BookFormat, BookSource,
  VisualNovelStatus, VnLength, VnDevStatus,
  AgeRating, RelatedItem, RewatchEntry, Platform,
} from '../types'

// Every editable field on the form. This mirrors the block of ~155
// useStates that used to live at the top of App.tsx — App.tsx now
// assembles this object on demand and passes it in.
export interface FormSnapshot {
  // -- Universal / Base --
  activeCategory: CategoryId
  title: string
  cover: string
  notes: string
  tags: string[]
  rating: number
  finishedAt: string
  customFields: CustomField[]

  // -- Games --
  devs: string[]
  publishers: string[]
  achievementsUnlocked: string
  achievementsTotal: string
  releaseDate: string
  bannerImage: string
  logoImage: string
  description: string
  platforms: Platform[]
  ownership: Ownership | ''
  gameStatus: GameStatus
  playTime: string
  hasDlc: boolean
  dlcList: DlcEntry[]
  hasAddons: boolean
  addonsList: DlcEntry[]
  isBundle: boolean
  bundleContents: BundleGame[]
  saveFiles: SaveFile[]
  achievementsList: Achievement[]
  screenshots: Screenshot[]
  pcgwPage: string | undefined
  gameSource: GameSource | ''
  originalWorkId: string
  gameReview: string
  hasSpoilers: boolean
  franchise: string

  // -- Music --
  releaseYear: string
  duration: string
  consumed: boolean
  artist: string
  musicType: MusicType | ''
  genres: string[]
  label: string
  partOfAlbum: string
  partOfAlbumId: string
  hasTracks: boolean
  tracks: Track[]
  singleCovers: SingleCover[]
  editions: AlbumEdition[]
  musicSource: MusicSource | ''
  vinylCondition: VinylCondition | ''
  producers: string[]
  musicReview: string

  // -- Manga / Comics --
  mangaAuthors: string[]
  mangaArtists: string[]
  volumeCovers: MangaVolume[]
  mangaDescription: string
  pubStatus: PublicationStatus | ''
  readingStatus: MangaStatus
  chaptersRead: string
  totalChapters: string
  volumesRead: string
  totalVolumesM: string
  startDate: string
  mangaSource: MangaSource | ''
  magazine: string
  mangaReview: string
  hasChapters: boolean
  chapters: Chapter[]
  mediaOwnership: MediaOwnership | ''
  discCount: string
  mangadexId: string

  // -- Anime / Donghua --
  studios: string[]
  animeFormat: AnimeFormat | ''
  airingStatus: AiringStatus | ''
  airingDay: Weekday | ''
  watchStatus: AnimeStatus
  episodesWatched: string
  totalEpisodes: string
  animeDescription: string
  season: AnimeSeason | ''
  seasonYear: string
  demographic: Demographic | ''
  alternativeTitles: string[]
  animeSource: AnimeSource | ''
  episodeDuration: string
  airedFrom: string
  airedTo: string
  ageRating: AgeRating | ''
  favoriteEpisode: string
  favoriteEpisodeNote: string
  droppedAtEpisode: string
  droppedReason: string
  hasEpisodes: boolean
  episodes: Episode[]
  animeReview: string
  rewatches: RewatchEntry[]
  relatedItems: RelatedItem[]
  recommendedItems: string[]

  // -- Series --
  seriesStatus: SeriesStatus
  seriesFormat: SeriesFormat | ''
  seriesDescription: string
  showrunners: string[]
  writers: string[]
  network: string
  country: string
  language: string
  contentRating: string
  hasSeasons: boolean
  seasons: Season[]
  seriesReview: string
  unitCount: string
  startYear: string
  endYear: string
  units: Unit[]

  // -- Movies --
  directors: string[]
  cast: string[]
  productionCompanies: string[]
  distributors: string[]
  movieDescription: string
  movieSource: MovieSource | ''
  movieReview: string
  watchedWhere: WatchLocation | ''
  movieBanner: string
  timesWatched: string

  // -- Books --
  bookStatus: BookStatus
  bookFormat: BookFormat | ''
  bookSource: BookSource | ''
  pagesRead: string
  totalPages: string
  publisher: string
  saga: string
  sagaIndex: string
  isbn: string
  translator: string
  bookReview: string
  chapterNotes: ChapterNote[]

  // -- Visual Novels --
  visualNovelStatus: VisualNovelStatus
  vnLength: VnLength | ''
  vnLengthHours: string
  vnEngine: string
  vnOriginalLanguage: string
  vnLanguages: string[]
  vnAliases: string[]
  vnCharacters: VnCharacter[]
  vnStaff: VnStaffMember[]
  vnScreenshots: VnScreenshot[]
  vnCovers: VnCover[]
  vnEditions: VnEdition[]
  vnPublishers: VnPublisher[]
  vnCommunityRating: string
  vnDevStatus: VnDevStatus | ''
  vnDescription: string
  vnReview: string
  vndbId: string
  nsfw: boolean
}

export function buildItemFromForm(id: string, createdAt: number, f: FormSnapshot): AnyItem {
  // Trim custom-field keys/values and drop rows the user left completely
  // empty so serialized JSON stays clean.
  const cleanCustomFields = f.customFields
    .map((x) => ({ ...x, key: x.key.trim(), value: x.value.trim() }))
    .filter((x) => x.key || x.value)

  const base: AnyItem = {
    id, categoryId: f.activeCategory, title: f.title.trim(),
    cover: f.cover.trim() || undefined,
    notes: f.notes.trim() || undefined,
    tags: f.tags.length > 0 ? f.tags : undefined,
    rating: f.rating || undefined,
    finishedAt: f.finishedAt || undefined,
    customFields: cleanCustomFields.length > 0 ? cleanCustomFields : undefined,
    createdAt,
  }

  const isVideojuegos = f.activeCategory === 'videojuegos'
  const isSeriesLike = f.activeCategory === 'series'
  const isAnime = isAnimeLikeCategory(f.activeCategory)
  const isManga = isMangaLike(f.activeCategory)

  if (isVideojuegos) {
    return {
      ...base,
      devs: f.devs.length > 0 ? f.devs : undefined,
      publishers: f.publishers.length > 0 ? f.publishers : undefined,
      achievementsUnlocked: f.achievementsUnlocked.trim() || undefined,
      achievementsTotal: f.achievementsTotal.trim() || undefined,
      releaseDate: f.releaseDate || undefined,
      bannerImage: f.bannerImage.trim() || undefined,
      logoImage: f.logoImage.trim() || undefined,
      description: f.description.trim() || undefined,
      platforms: f.platforms.length > 0 ? f.platforms : undefined,
      ownership: f.ownership || undefined,
      gameStatus: f.gameStatus,
      playTime: f.playTime || undefined,
      hasDlc: f.hasDlc,
      dlcList: f.hasDlc && f.dlcList.length > 0 ? f.dlcList : undefined,
      hasAddons: f.hasAddons,
      addonsList: f.hasAddons && f.addonsList.length > 0 ? f.addonsList : undefined,
      isBundle: f.isBundle,
      bundleContents: f.isBundle && f.bundleContents.length > 0 ? f.bundleContents : undefined,
      saveFiles: f.saveFiles.length > 0 ? f.saveFiles : undefined,
      achievements: f.achievementsList.length > 0 ? f.achievementsList : undefined,
      screenshots: f.screenshots.length > 0 ? f.screenshots : undefined,
      pcgwPage: f.pcgwPage || undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      gameSource: f.gameSource || undefined,
      originalWorkId: f.originalWorkId || undefined,
      ageRating: f.ageRating || undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      gameReview: f.gameReview.trim() || undefined,
      hasSpoilers: f.gameReview.trim() ? f.hasSpoilers : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      franchise: f.franchise.trim() || undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  if (f.activeCategory === 'peliculas') {
    return {
      ...base,
      directors: f.directors.length > 0 ? f.directors : undefined,
      cast: f.cast.length > 0 ? f.cast : undefined,
      writers: f.writers.length > 0 ? f.writers : undefined,
      productionCompanies: f.productionCompanies.length > 0 ? f.productionCompanies : undefined,
      distributors: f.distributors.length > 0 ? f.distributors : undefined,
      movieDescription: f.movieDescription.trim() || undefined,
      franchise: f.franchise.trim() || undefined,
      watchedWhere: f.watchedWhere || undefined,
      bannerImage2: f.movieBanner.trim() || undefined,
      hasSpoilers: f.movieReview.trim() ? f.hasSpoilers : undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      releaseDate: f.releaseDate || undefined,
      releaseYear: f.releaseYear || undefined,
      duration: f.duration || undefined,
      consumed: f.consumed,
      timesWatched: f.timesWatched || undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      movieSource: f.movieSource || undefined,
      contentRating: f.contentRating.trim() || undefined,
      movieReview: f.movieReview.trim() || undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  if (isSeriesLike) {
    const useSeasons = f.hasSeasons && f.seasons.length > 0
    const derived = useSeasons ? seasonsDerivedCounts(f.seasons) : null
    return {
      ...base,
      bannerImage2: f.movieBanner.trim() || undefined,
      unitCount: useSeasons ? String(f.seasons.length) : (f.unitCount || undefined),
      startYear: f.startYear || undefined,
      endYear: f.endYear || undefined,
      units: useSeasons ? undefined : (f.units.length > 0 ? f.units : undefined),
      seriesStatus: f.seriesStatus,
      seriesFormat: f.seriesFormat || undefined,
      seriesDescription: f.seriesDescription.trim() || undefined,
      directors: f.directors.length > 0 ? f.directors : undefined,
      cast: f.cast.length > 0 ? f.cast : undefined,
      showrunners: f.showrunners.length > 0 ? f.showrunners : undefined,
      writers: f.writers.length > 0 ? f.writers : undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      network: f.network.trim() || undefined,
      country: f.country.trim() || undefined,
      language: f.language.trim() || undefined,
      contentRating: f.contentRating.trim() || undefined,
      watchedWhere: f.watchedWhere || undefined,
      episodesWatched: derived ? String(derived.watched) : (f.episodesWatched || undefined),
      totalEpisodes: derived && derived.total > 0 ? String(derived.total) : (f.totalEpisodes || undefined),
      episodeDuration: f.episodeDuration || undefined,
      airedFrom: f.airedFrom || undefined,
      airedTo: f.airedTo || undefined,
      startDate: f.startDate || undefined,
      franchise: f.franchise.trim() || undefined,
      hasSeasons: useSeasons ? true : undefined,
      seasons: useSeasons ? f.seasons : undefined,
      seriesReview: f.seriesReview.trim() || undefined,
      hasSpoilers: f.seriesReview.trim() ? f.hasSpoilers : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
    }
  }

  if (isAnime) {
    const useEpisodes = f.hasEpisodes && f.episodes.length > 0
    const derivedWatched = useEpisodes ? String(f.episodes.filter((e) => e.watched).length) : (f.episodesWatched || undefined)
    const derivedTotal = useEpisodes ? String(f.episodes.length) : (f.totalEpisodes || undefined)
    return {
      ...base,
      studios: f.studios.length > 0 ? f.studios : undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      animeFormat: f.animeFormat || undefined,
      airingStatus: f.airingStatus || undefined,
      airingDay: f.airingStatus === 'airing' && f.airingDay ? f.airingDay : undefined,
      watchStatus: f.watchStatus,
      episodesWatched: derivedWatched,
      totalEpisodes: derivedTotal,
      animeDescription: f.animeDescription.trim() || undefined,
      season: f.season || undefined,
      seasonYear: f.seasonYear || undefined,
      demographic: f.demographic || undefined,
      startDate: f.startDate || undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      animeSource: f.animeSource || undefined,
      episodeDuration: f.episodeDuration || undefined,
      airedFrom: f.airedFrom || undefined,
      airedTo: f.airedTo || undefined,
      ageRating: f.ageRating || undefined,
      favoriteEpisode: f.favoriteEpisode || undefined,
      favoriteEpisodeNote: f.favoriteEpisodeNote.trim() || undefined,
      droppedAtEpisode: f.watchStatus === 'dropped' ? (f.droppedAtEpisode || undefined) : undefined,
      droppedReason: f.watchStatus === 'dropped' ? (f.droppedReason.trim() || undefined) : undefined,
      hasEpisodes: useEpisodes ? true : undefined,
      episodes: useEpisodes ? f.episodes : undefined,
      animeReview: f.animeReview.trim() || undefined,
      hasSpoilers: f.animeReview.trim() ? f.hasSpoilers : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      franchise: f.franchise.trim() || undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  if (isManga) {
    const useChapters = f.hasChapters && f.chapters.length > 0
    const derivedChaptersRead = useChapters ? String(f.chapters.filter((c) => c.read).length) : (f.chaptersRead || undefined)
    const derivedTotalChapters = useChapters ? String(f.chapters.length) : (f.totalChapters || undefined)
    return {
      ...base,
      authors: f.mangaAuthors.length > 0 ? f.mangaAuthors : undefined,
      mangaArtists: f.mangaArtists.length > 0 ? f.mangaArtists : undefined,
      volumeCovers: f.volumeCovers.length > 0 ? f.volumeCovers : undefined,
      mangaDescription: f.mangaDescription.trim() || undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      pubStatus: f.pubStatus || undefined,
      mangaStatus: f.readingStatus,
      chaptersRead: derivedChaptersRead,
      totalChapters: derivedTotalChapters,
      volumesRead: f.volumesRead || undefined,
      totalVolumes: f.totalVolumesM || undefined,
      startDate: f.startDate || undefined,
      releaseDate: f.releaseDate || undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      mangaSource: f.mangaSource || undefined,
      magazine: f.magazine.trim() || undefined,
      mediaOwnership: f.mediaOwnership || undefined,
      discCount: f.discCount.trim() || undefined,
      mangadexId: f.mangadexId.trim() || undefined,
      ageRating: f.ageRating || undefined,
      mangaReview: f.mangaReview.trim() || undefined,
      hasSpoilers: f.mangaReview.trim() ? f.hasSpoilers : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      franchise: f.franchise.trim() || undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
      hasChapters: useChapters ? true : undefined,
      chapters: useChapters ? f.chapters : undefined,
    }
  }

  if (f.activeCategory === 'libros') {
    return {
      ...base,
      authors: f.mangaAuthors.length > 0 ? f.mangaAuthors : undefined,
      description: f.description.trim() || undefined,
      bookStatus: f.bookStatus,
      bookFormat: f.bookFormat || undefined,
      bookSource: f.bookSource || undefined,
      pagesRead: f.pagesRead || undefined,
      totalPages: f.totalPages || undefined,
      publisher: f.publisher.trim() || undefined,
      saga: f.saga.trim() || undefined,
      sagaIndex: f.sagaIndex.trim() || undefined,
      isbn: f.isbn.trim() || undefined,
      translator: f.translator.trim() || undefined,
      pubStatus: f.pubStatus || undefined,
      genres: f.genres.length > 0 ? f.genres : undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      releaseDate: f.releaseDate || undefined,
      startDate: f.startDate || undefined,
      ageRating: f.ageRating || undefined,
      bookReview: f.bookReview.trim() || undefined,
      hasSpoilers: f.bookReview.trim() ? f.hasSpoilers : undefined,
      chapterNotes: f.chapterNotes.length > 0 ? f.chapterNotes : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      franchise: f.franchise.trim() || undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  if (f.activeCategory === 'visual_novels') {
    return {
      ...base,
      visualNovelStatus: f.visualNovelStatus,
      vnDescription: f.vnDescription.trim() || undefined,
      devs: f.devs.length > 0 ? f.devs : undefined,
      publishers: f.publishers.length > 0 ? f.publishers : undefined,
      vnPublishers: f.vnPublishers.length > 0 ? f.vnPublishers : undefined,
      vnEngine: f.vnEngine.trim() || undefined,
      vnLength: f.vnLength || undefined,
      vnLengthHours: f.vnLengthHours.trim() || undefined,
      vnCommunityRating: f.vnCommunityRating.trim() || undefined,
      vnDevStatus: f.vnDevStatus || undefined,
      vnOriginalLanguage: f.vnOriginalLanguage.trim() || undefined,
      vnLanguages: f.vnLanguages.length > 0 ? f.vnLanguages : undefined,
      vnAliases: f.vnAliases.length > 0 ? f.vnAliases : undefined,
      platforms: f.platforms.length > 0 ? f.platforms : undefined,
      releaseDate: f.releaseDate || undefined,
      releaseYear: f.releaseYear || undefined,
      playTime: f.playTime.trim() || undefined,
      startDate: f.startDate || undefined,
      nsfw: f.nsfw || undefined,
      vnStaff: f.vnStaff.length > 0 ? f.vnStaff : undefined,
      vnCharacters: f.vnCharacters.length > 0 ? f.vnCharacters : undefined,
      vnScreenshots: f.vnScreenshots.length > 0 ? f.vnScreenshots : undefined,
      vnCovers: f.vnCovers.length > 0 ? f.vnCovers : undefined,
      vnEditions: f.vnEditions.length > 0 ? f.vnEditions : undefined,
      vnReview: f.vnReview.trim() || undefined,
      hasSpoilers: f.vnReview.trim() ? f.hasSpoilers : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      vndbId: f.vndbId.trim() || undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  if (f.activeCategory === 'musica') {
    const albumLike = isAlbumLikeMusic(f.musicType || undefined)
    return {
      ...base,
      // Save whichever the user filled in — releaseDate is the more
      // precise one and drives the Release calendar; releaseYear is the
      // fallback shown on cards and used as the calendar's year-only
      // entry when no full date exists.
      releaseYear: f.releaseYear || undefined,
      releaseDate: f.releaseDate || undefined,
      musicType: f.musicType || undefined,
      consumed: f.consumed,
      artist: f.artist.trim() || undefined,
      genres: albumLike && f.genres.length > 0 ? f.genres : undefined,
      partOfAlbum: !albumLike ? (f.partOfAlbum.trim() || undefined) : undefined,
      partOfAlbumId: !albumLike && f.partOfAlbumId ? f.partOfAlbumId : undefined,
      label: albumLike ? (f.label.trim() || undefined) : undefined,
      hasTracks: albumLike ? f.hasTracks : undefined,
      tracks: albumLike && f.hasTracks && f.tracks.length > 0 ? f.tracks : undefined,
      singleCovers: albumLike && f.singleCovers.length > 0 ? f.singleCovers : undefined,
      editions: albumLike && f.editions.length > 0 ? f.editions : undefined,
      alternativeTitles: f.alternativeTitles.length > 0 ? f.alternativeTitles : undefined,
      musicSource: f.musicSource || undefined,
      producers: f.producers.length > 0 ? f.producers : undefined,
      musicReview: f.musicReview.trim() || undefined,
      hasSpoilers: f.musicReview.trim() ? f.hasSpoilers : undefined,
      vinylCondition: f.vinylCondition || undefined,
      // Music now also uses mediaOwnership (physical / digital / both /
      // neither) and discCount for multi-disc CDs / vinyl sets. Both
      // were previously only saved on manga items, which meant the
      // Format dropdown in the music editor silently threw its value
      // away on save.
      mediaOwnership: f.mediaOwnership || undefined,
      discCount: (f.mediaOwnership === 'physical' || f.mediaOwnership === 'both') ? (f.discCount.trim() || undefined) : undefined,
      rewatches: f.rewatches.length > 0 ? f.rewatches : undefined,
      relatedItems: f.relatedItems.length > 0 ? f.relatedItems : undefined,
      recommendedItems: f.recommendedItems.length > 0 ? f.recommendedItems : undefined,
    }
  }

  return base
}
