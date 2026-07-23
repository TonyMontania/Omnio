// Pure type declarations. No runtime values, no functions, no side effects.
// Everything a component might need to type its props or state lives here.

export type Platform = string
export type Ownership = 'owned' | 'shared' | 'subscription' | 'unlicensed'
export type GameStatus = 'backlog' | 'playing' | 'played' | 'completed' | 'dropped'
export type GameSource = 'original' | 'remake' | 'remaster' | 'reimagined' | 'reboot' | 'port' | 'sequel' | 'spinoff' | 'standalone' | 'expanded' | 'collection' | 'other'
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
export type RelationKind =
  | 'sequel' | 'prequel' | 'side_story' | 'spin_off' | 'alt_version' | 'adaptation'
  | 'standalone' | 'remake' | 'remaster' | 'reboot' | 'port'
  | 'dlc' | 'collection' | 'same_series' | 'same_universe' | 'crossover'
  | 'other'

export interface DlcEntry {
  id: string
  name: string
  status: GameStatus
}

// A game bundled inside another (Metal Gear Solid HD Collection contains
// MGS2 + MGS3, etc.). Kept intentionally light — the parent Item already
// carries the shared metadata; each sub-entry only needs a cover + own status.
export interface BundleGame {
  id: string
  name: string
  cover?: string           // relative asset path (assets/videojuegos/bundle/…) or URL
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

// A distinct release edition of an album (Deluxe, Japan, 10th Anniversary…),
// each with its own optional cover and extra/alternate tracks.
export interface AlbumEdition {
  id: string
  name: string
  cover?: string
  tracks?: Track[]
}

// Artwork for a single that shipped with its own cover, often before the
// album dropped. Displayed as a small gallery under the tracklist.
export interface SingleCover {
  id: string
  name: string
  cover: string
  year?: string
}

export interface Unit {
  number: number
  watched: boolean
}

export type BandStatus = 'active' | 'disbanded' | 'hiatus' | 'unknown'

// A band member with one or more roles (Vocals, Guitar, Bass, Drums…).
// `former` marks ex-members so the UI can split current vs. past line-ups.
export interface BandMember {
  id: string
  name: string
  roles: string[]
  former?: boolean
  joinedIn?: string        // free-text year: "1998", "March 2003", "?"
  leftIn?: string          // only meaningful when former=true
}

export interface MusicArtist {
  id: string
  name: string
  photo?: string
  bannerImage?: string
  createdAt: number
  origin?: string
  bandStatus?: BandStatus
  genres?: string[]
  activeFrom?: string
  activeTo?: string
  labels?: string[]
  members?: BandMember[]
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
  isBundle?: boolean
  bundleContents?: BundleGame[]
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
  singleCovers?: SingleCover[]
  editions?: AlbumEdition[]
  mangaSource?: MangaSource
  magazine?: string
  mangaReview?: string
  hasChapters?: boolean
  chapters?: Chapter[]
  movieSource?: MovieSource
  movieReview?: string
  productionCompanies?: string[]
  distributors?: string[]
  gameSource?: GameSource
  // If this game derives from another (remake, port, expanded, standalone,
  // reimagined, sequel etc.), point at the parent item so the two show as
  // connected on both sides.
  originalWorkId?: string
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
