// Pure type declarations. No runtime values, no functions, no side effects.
// Everything a component might need to type its props or state lives here.

export type Platform = string
export type Ownership = 'owned' | 'shared' | 'subscription' | 'unlicensed'
export type GameStatus = 'backlog' | 'playing' | 'played' | 'completed' | 'dropped'
export type GameSource = 'original' | 'remake' | 'remaster' | 'port' | 'sequel' | 'spinoff' | 'other'
export type GameField = 'title' | 'status' | 'playTime' | 'rating' | 'tags'

export type MusicType = 'single' | 'ep' | 'album' | 'ost' | 'live' | 'recopilation'
export type MusicSource = 'original' | 'compilation' | 'soundtrack' | 'remaster' | 'deluxe' | 'reissue' | 'other'
export type MusicField = 'title' | 'artist' | 'releaseYear' | 'type' | 'rating' | 'tags'

export type MangaStatus = 'plan_to_read' | 'reading' | 'completed' | 'paused' | 'dropped'
export type PublicationStatus = 'publishing' | 'finished' | 'hiatus' | 'cancelled' | 'not_yet_released'
export type MangaSource = 'original' | 'light_novel' | 'novel' | 'game' | 'visual_novel' | 'anime' | 'other'
export type MangaField = 'title' | 'status' | 'chapters'

export type AnimeStatus = 'plan_to_watch' | 'watching' | 'completed' | 'paused' | 'dropped'
export type AiringStatus = 'airing' | 'finished' | 'not_yet_aired' | 'cancelled'
export type AnimeFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'music'
export type AnimeSeason = 'winter' | 'spring' | 'summer' | 'fall'
export type Demographic = 'shonen' | 'shojo' | 'seinen' | 'josei'
export type AnimeSource = 'manga' | 'light_novel' | 'web_novel' | 'novel' | 'original' | 'game' | 'visual_novel' | 'other'
export type AnimeField = 'title' | 'status' | 'episodes' | 'rating' | 'tags'

export type SeriesStatus = 'plan_to_watch' | 'watching' | 'completed' | 'paused' | 'dropped'
export type SeriesFormat = 'ongoing' | 'ended' | 'miniseries' | 'limited' | 'anthology' | 'other'
export type SeriesField = 'title' | 'status' | 'episodes' | 'rating' | 'tags'

export type MovieSource = 'original' | 'book' | 'comic' | 'game' | 'true_story' | 'remake' | 'sequel' | 'other'
export type MovieField = 'title' | 'status' | 'year' | 'rating' | 'tags'
export type WatchLocation = 'cinema' | 'streaming' | 'physical' | 'tv' | 'other'

export type AgeRating = 'e' | 'e10' | 't' | 'm' | 'ao' | 'rp'
export type RelationKind = 'sequel' | 'prequel' | 'side_story' | 'spin_off' | 'alt_version' | 'adaptation' | 'other'

export interface DlcEntry {
  id: string
  name: string
  status: GameStatus
}

export interface MangaVolume {
  id: string
  number: string
  cover: string
}

export interface RelatedItem {
  itemId: string
  relation: RelationKind
}

export interface RewatchEntry {
  id: string
  date: string
  rating?: number
  notes?: string
}

export interface Chapter {
  id: string
  number: string
  title?: string
  read?: boolean
  readDate?: string
  rating?: number
  notes?: string
}

export interface Episode {
  id: string
  number: string
  title?: string
  watched?: boolean
  watchedDate?: string
  rating?: number
  notes?: string
  filler?: boolean
}

export interface Season {
  id: string
  number: string
  title?: string
  year?: string
  totalEpisodes?: string
  episodes?: Episode[]
  watched?: boolean
  rating?: number
  notes?: string
  watchedDate?: string
}

export interface Track {
  id: string
  number: string
  name: string
  artist?: string
  duration: string
  favorite?: boolean
  rating?: number
  listened?: boolean
  lyrics?: string
}

export interface Unit {
  number: number
  watched: boolean
}

export interface MusicArtist {
  id: string
  name: string
  photo?: string
  bannerImage?: string
  createdAt: number
}

export interface Collection {
  id: string
  name: string
  categoryId: string
  itemIds: string[]
  createdAt: number
  cover?: string
}

export interface Item {
  id: string
  categoryId: string
  title: string
  cover?: string
  bannerImage?: string
  logoImage?: string
  description?: string
  notes?: string
  createdAt: number
  tags?: string[]
  rating?: number
  finishedAt?: string
  // Games — devs & publishers are lists (were single strings pre-0.2; migrated on load).
  devs?: string[]
  publishers?: string[]
  achievementsUnlocked?: string
  achievementsTotal?: string
  releaseDate?: string
  platforms?: Platform[]
  ownership?: Ownership
  gameStatus?: GameStatus
  playTime?: string
  hasDlc?: boolean
  dlcList?: DlcEntry[]
  hasAddons?: boolean
  addonsList?: DlcEntry[]
  releaseYear?: string
  duration?: string
  consumed?: boolean
  artist?: string
  genres?: string[]
  label?: string
  partOfAlbum?: string
  authors?: string[]
  mangaArtists?: string[]
  pubStatus?: PublicationStatus
  mangaStatus?: MangaStatus
  chaptersRead?: string
  totalChapters?: string
  volumesRead?: string
  totalVolumes?: string
  startDate?: string
  volumeCovers?: MangaVolume[]
  studios?: string[]
  animeFormat?: AnimeFormat
  airingStatus?: AiringStatus
  watchStatus?: AnimeStatus
  episodesWatched?: string
  totalEpisodes?: string
  animeDescription?: string
  season?: AnimeSeason
  seasonYear?: string
  demographic?: Demographic
  alternativeTitles?: string[]
  animeSource?: AnimeSource
  episodeDuration?: string
  airedFrom?: string
  airedTo?: string
  ageRating?: AgeRating
  favoriteEpisode?: string
  favoriteEpisodeNote?: string
  droppedAtEpisode?: string
  droppedReason?: string
  hasEpisodes?: boolean
  episodes?: Episode[]
  animeReview?: string
  rewatches?: RewatchEntry[]
  relatedItems?: RelatedItem[]
  recommendedItems?: string[]
  seriesStatus?: SeriesStatus
  seriesFormat?: SeriesFormat
  seriesDescription?: string
  showrunners?: string[]
  writers?: string[]
  network?: string
  country?: string
  language?: string
  contentRating?: string
  hasSeasons?: boolean
  seasons?: Season[]
  seriesReview?: string
  musicSource?: MusicSource
  producers?: string[]
  musicReview?: string
  mangaSource?: MangaSource
  magazine?: string
  mangaReview?: string
  hasChapters?: boolean
  chapters?: Chapter[]
  movieSource?: MovieSource
  movieReview?: string
  gameSource?: GameSource
  gameReview?: string
  mangaDescription?: string
  directors?: string[]
  cast?: string[]
  franchise?: string
  watchedWhere?: WatchLocation
  bannerImage2?: string
  movieDescription?: string
  hasSpoilers?: boolean
  timesWatched?: string
  hasTracks?: boolean
  tracks?: Track[]
  musicType?: MusicType
  unitCount?: string
  startYear?: string
  endYear?: string
  totalSubUnits?: string
  units?: Unit[]
}
