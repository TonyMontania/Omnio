// Pure type declarations shared across the renderer.

import type { CategoryId } from './items'

export type Platform = string
export type Ownership = 'owned' | 'shared' | 'subscription' | 'unlicensed'
export type GameStatus = 'backlog' | 'playing' | 'played' | 'completed' | 'dropped'
export type GameSource = 'original' | 'remake' | 'remaster' | 'reimagined' | 'reboot' | 'port' | 'sequel' | 'spinoff' | 'standalone' | 'expanded' | 'collection' | 'other'
export type GameField = 'title' | 'status' | 'playTime' | 'rating' | 'tags' | 'deckCompat'

export type MusicType = 'single' | 'ep' | 'album' | 'ost' | 'live' | 'recopilation'
export type MusicSource = 'original' | 'compilation' | 'soundtrack' | 'remaster' | 'deluxe' | 'reissue' | 'other'
export type MusicField = 'title' | 'artist' | 'releaseYear' | 'type' | 'rating' | 'tags'
// Goldmine grading scale for physical media condition.
export type VinylCondition = 'mint' | 'near_mint' | 'very_good_plus' | 'very_good' | 'good_plus' | 'good' | 'fair' | 'poor'

// Cross-item playlist stored at the top level; references tracks by
// their owning music item + track id.
export interface PlaylistTrackRef {
  itemId: string
  trackId: string
}
export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string
  tracks: PlaylistTrackRef[]
  createdAt: number
}

// User-defined groups inside a franchise (Timeline A/B, Liberl Arc,
// Prime series…). Items not assigned to any section fall into an
// implicit "Ungrouped" strip.
export interface FranchiseSection {
  id: string
  name: string
  itemIds: string[]
  notes?: Record<string, string>
}

// Free-canvas franchise diagram — Zelda-style branches with labels and
// convergence arrows. Node coordinates are React Flow world units.
export type FranchiseGraphNodeShape = 'rect' | 'rounded' | 'pill' | 'circle' | 'diamond' | 'text'
export interface FranchiseGraphNode {
  id: string
  itemId?: string
  text?: string
  shape?: FranchiseGraphNodeShape
  x: number
  y: number
  width?: number
  height?: number
  // Explicit user-set stack order (Send to back / Bring to front).
  zIndex?: number
}

export type FranchiseGraphEdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep'
export type FranchiseGraphEdgeMarker = 'arrow' | 'arrow-closed' | 'none'
export interface FranchiseGraphEdge {
  id: string
  from: string
  to: string
  // Persisted so React Flow re-routes the arrow from the same anchor
  // point on reload instead of picking a new default.
  fromHandle?: string
  toHandle?: string
  label?: string
  color?: string
  edgeType?: FranchiseGraphEdgeType
  marker?: FranchiseGraphEdgeMarker
}
export interface FranchiseGraph {
  nodes: FranchiseGraphNode[]
  edges: FranchiseGraphEdge[]
}

export interface ConcertEntry {
  id: string
  date: string
  venue: string
  city?: string
  setlist?: string
  notes?: string
}

export type MangaStatus = 'plan_to_read' | 'reading' | 'completed' | 'paused' | 'dropped'
export type PublicationStatus = 'publishing' | 'finished' | 'hiatus' | 'cancelled' | 'not_yet_released'
export type MangaSource = 'original' | 'light_novel' | 'novel' | 'game' | 'visual_novel' | 'anime' | 'other'
export type MangaField = 'title' | 'authors' | 'status' | 'chapters' | 'rating' | 'tags'

export type AnimeStatus = 'plan_to_watch' | 'watching' | 'completed' | 'paused' | 'dropped'
export type AiringStatus = 'airing' | 'finished' | 'not_yet_aired' | 'cancelled'
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
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

export type BookStatus = 'plan_to_read' | 'reading' | 'completed' | 'paused' | 'dropped'
export type BookFormat = 'paperback' | 'hardcover' | 'ebook' | 'audiobook' | 'other'
export type BookSource = 'original' | 'translation' | 'adaptation' | 'other'
export type BookField = 'title' | 'authors' | 'status' | 'pages' | 'rating' | 'tags'

// Visual Novels — modeled after VNDB (vndb.org). Status vocab mirrors games
// so a user can move a VN through the same mental buckets they use for
// backlog / playing / completed. VNDB itself uses "length" as an enum of
// five buckets — the community-averaged hours land in `vnLengthHours`.
export type VisualNovelStatus = 'plan_to_play' | 'playing' | 'paused' | 'completed' | 'dropped'
export type VnLength = 'very_short' | 'short' | 'medium' | 'long' | 'very_long'
export type VnField = 'title' | 'status' | 'length' | 'year' | 'rating' | 'tags'

// A character in a VN. Role mirrors VNDB's own vocabulary: protagonist
// (Main Character), main, side, appears. `seiyuu` is the voice actor when
// the release ships with voiced dialogue.
export type VnCharacterRole = 'protagonist' | 'main' | 'side' | 'appears'
export interface VnCharacter {
  id: string
  name: string
  original?: string        // native-script name
  role: VnCharacterRole
  description?: string
  seiyuu?: string
  seiyuuNote?: string
  image?: string
  vndbId?: string
}

export type VnStaffRole = 'writer' | 'artist' | 'composer' | 'director' | 'translator' | 'other'
export interface VnStaffMember {
  id: string
  name: string
  original?: string
  role: VnStaffRole
  note?: string
}

// One row per (publisher, language) pair — VNDB stores publishers on
// releases, not on the VN itself, so multiple releases collapse here.
export interface VnPublisher {
  id: string
  name: string
  original?: string
  lang: string
  role?: 'publisher' | 'developer' | 'both'
}

export interface VnEdition {
  id: string
  eid?: number
  lang?: string
  name: string
  official?: boolean
}

// Exactly one cover per VN should carry `main` = true.
export interface VnCover {
  id: string
  path: string
  lang?: string
  releaseTitle?: string
  main?: boolean
  exhibited?: boolean
}

export type VnDevStatus = 'finished' | 'in_development' | 'cancelled'

export interface VnScreenshot {
  id: string
  filename: string
  path: string
  addedAt: string
  caption?: string
  nsfw?: boolean
}

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

// Games bundled inside a parent item (Metal Gear Solid HD Collection).
// Each sub-entry only needs a cover + status; the parent Item carries
// the shared metadata.
export interface BundleGame {
  id: string
  name: string
  cover?: string
  status: GameStatus
}

export interface Highlight {
  id: string
  text: string
  note?: string
  page?: string
  location?: string
  addedAt?: string
}

// Full per-achievement record — coexists with the summary
// achievementsUnlocked / achievementsTotal fields for a quick "12/40".
export interface Achievement {
  id: string
  name: string
  description?: string
  unlockedAt?: string
  icon?: string
}

export interface Screenshot {
  id: string
  filename: string
  path: string
  addedAt: string
  caption?: string
}

export interface ChapterNote {
  id: string
  chapter: string
  note: string
}

// Any file extension is accepted — save formats vary too much per
// engine to whitelist. `note` is what makes multiple slots useful
// ("post-final boss", "NG+", "all collectibles").
export interface SaveFile {
  id: string
  filename: string
  path: string
  size: number
  addedAt: string
  note?: string
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

export type RewatchKind = 'rewatch' | 'started' | 'finished' | 'dropped' | 'note'

export interface RewatchEntry {
  id: string
  date: string
  // Legacy entries omit this; every consumer treats missing as 'rewatch'.
  kind?: RewatchKind
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
  scanlator?: string
}

export type MediaOwnership = 'physical' | 'digital' | 'both' | 'neither'

export interface Episode {
  id: string
  number: string
  title?: string
  watched?: boolean
  watchedDate?: string
  rating?: number
  notes?: string
  filler?: boolean
  // Free-text minutes ("25", "24-26"); AniDB values survive round-trip.
  airdate?: string
  length?: string
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
  disc?: string
}

// Distinct release edition of an album (Deluxe, Japan, 10th Anniversary…).
export interface AlbumEdition {
  id: string
  name: string
  cover?: string
  releaseDate?: string
  tracks?: Track[]
}

// Single that shipped with its own cover — often ahead of the album.
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

// One tenure period with a distinct role set. Members who never
// changed instruments don't need stints — the top-level roles + join/
// leave years cover them.
export interface MemberStint {
  id: string
  roles: string[]
  from?: string
  to?: string
  // Touring-only stint: on stage for the tour but not in the studio
  // line-up. Rendered dashed on the band timeline.
  touring?: boolean
}

// 'current' / 'former' apply to studio members; the '-touring' variants
// mark musicians who were on stage but not on the studio line-up.
export type MemberStatus = 'current' | 'current-touring' | 'former' | 'former-touring'

// Reads the effective status, migrating the legacy `former: boolean`.
export function getMemberStatus(m: { membership?: MemberStatus; former?: boolean }): MemberStatus {
  if (m.membership) return m.membership
  return m.former ? 'former' : 'current'
}

export function isFormerMember(m: { membership?: MemberStatus; former?: boolean }): boolean {
  const s = getMemberStatus(m)
  return s === 'former' || s === 'former-touring'
}

export function isTouringMember(m: { membership?: MemberStatus; former?: boolean }): boolean {
  const s = getMemberStatus(m)
  return s === 'current-touring' || s === 'former-touring'
}

export interface BandMember {
  id: string
  name: string
  roles: string[]
  membership?: MemberStatus
  // Legacy pre-0.4.1 flag; load path migrates it to `membership`.
  former?: boolean
  joinedIn?: string
  leftIn?: string
  deceased?: boolean
  stints?: MemberStint[]
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
  concerts?: ConcertEntry[]
}

export interface Collection {
  id: string
  name: string
  categoryId: string
  itemIds: string[]
  createdAt: number
  cover?: string
}

// Bag view — every field of every variant, all optional. Discriminated
// variants (GameItem / MusicItem / …) live in ./items and narrow via
// the isGameItem / isMusicItem type guards. Re-exported as `Item`.
export interface AnyItem {
  id: string
  categoryId: CategoryId
  title: string
  // Item-level favorite. Distinct from Track.favorite (per-song).
  favorite?: boolean
  cover?: string
  bannerImage?: string
  logoImage?: string
  description?: string
  notes?: string
  createdAt: number
  tags?: string[]
  rating?: number
  finishedAt?: string
  devs?: string[]
  publishers?: string[]
  achievementsUnlocked?: string
  achievementsTotal?: string
  releaseDate?: string
  platforms?: Platform[]
  ownership?: Ownership
  gameStatus?: GameStatus
  playTime?: string
  // Structured play sessions — each row is one campaign, NG+ replay
  // or co-op session. Coexists with the free-text `playTime` total.
  playthroughs?: Playthrough[]
  vnEndings?: VnEnding[]
  storeLinks?: StoreLink[]
  purchases?: Purchase[]
  deckCompat?: DeckCompat
  protonRating?: ProtonRating
  viewings?: MovieViewing[]
  bookHighlights?: BookHighlight[]
  bookmarkChapter?: string
  bookmarkNote?: string
  listeningNote?: string
  hasDlc?: boolean
  dlcList?: DlcEntry[]
  hasAddons?: boolean
  addonsList?: DlcEntry[]
  isBundle?: boolean
  bundleContents?: BundleGame[]
  saveFiles?: SaveFile[]
  achievements?: Achievement[]
  screenshots?: Screenshot[]
  // Cached PCGamingWiki page match so the save-paths panel doesn't
  // re-run opensearch every time the editor opens.
  pcgwPage?: string
  releaseYear?: string
  duration?: string
  consumed?: boolean
  artist?: string
  genres?: string[]
  label?: string
  // Free-text fallback for legacy / imported entries whose parent album
  // isn't in the library. Prefer `partOfAlbumId` when the album exists.
  partOfAlbum?: string
  partOfAlbumId?: string
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
  airingDay?: Weekday
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
  vinylCondition?: VinylCondition
  concerts?: ConcertEntry[]
  // Music multi-disc: number of physical discs when the release is a
  // multi-disc CD / vinyl set. Ignored when `mediaOwnership !== 'physical'`
  // (a digital release doesn't need this). Free-text so "1", "2 CD",
  // "3 (2 CD + 1 DVD)" all work.
  discCount?: string
  mangaSource?: MangaSource
  magazine?: string
  mangaReview?: string
  hasChapters?: boolean
  chapters?: Chapter[]
  mediaOwnership?: MediaOwnership
  mangadexId?: string        // used to compose the "New chapters (RSS)" link in the detail modal
  movieSource?: MovieSource
  movieReview?: string
  productionCompanies?: string[]
  distributors?: string[]
  gameSource?: GameSource
  // Points at the parent item when this game derives from another
  // (remake, port, sequel, …) so both ends of the link render as connected.
  originalWorkId?: string
  gameReview?: string
  mangaDescription?: string
  directors?: string[]
  cast?: string[]
  franchise?: string
  // Cross-library adaptation link — the source work in any category.
  basedOnItemId?: string
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
  units?: Unit[]
  bookStatus?: BookStatus
  bookFormat?: BookFormat
  bookSource?: BookSource
  publisher?: string
  saga?: string
  sagaIndex?: string
  pagesRead?: string
  totalPages?: string
  isbn?: string
  translator?: string
  bookReview?: string
  highlights?: Highlight[]
  chapterNotes?: ChapterNote[]
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
  // Work-level NSFW; VnScreenshot carries a per-image flag too.
  nsfw?: boolean
  // Notion-style per-item ad-hoc fields (rendered at the bottom of
  // every detail view).
  customFields?: CustomField[]
  // Library-schema custom fields — schema lives in
  // Settings.libraryCustomFields[categoryId]; values keyed by field id.
  libraryCustomFieldValues?: Record<string, string | number | boolean | null>
}

export interface CustomField {
  id: string
  key: string
  value: string
}

// Store slug the UI maps to an icon and label.
export type StoreSlug =
  | 'steam' | 'gog' | 'epic' | 'itch' | 'humble' | 'ubi' | 'ea'
  | 'battlenet' | 'rockstar' | 'nintendo' | 'playstation' | 'xbox'
  | 'official' | 'other'
export interface StoreLink {
  id: string
  store: StoreSlug
  url: string
  note?: string
}

// Every field except `id` is optional so partial history (gift with
// no price, unknown discount) can still be captured.
export interface Purchase {
  id: string
  date?: string
  price?: string
  currency?: string
  // Matches a StoreLink.store slug or a free-text label.
  storeLabel?: string
  discount?: string
  note?: string
  createdAt: number
}

export type DeckCompat = 'verified' | 'playable' | 'unsupported' | 'unknown'
export type ProtonRating = 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked'

export type MovieFormat = 'theater' | 'streaming' | 'bluray' | 'dvd' | 'download' | 'other'
export interface MovieViewing {
  id: string
  date?: string
  format?: MovieFormat
  location?: string
  companions?: string
  note?: string
  createdAt: number
}

export interface BookHighlight {
  id: string
  page?: string
  text: string
  note?: string
  capturedAt?: string
  createdAt: number
}

// One route / ending of a VN. Blank `route` means shared/common route.
export interface VnEnding {
  id: string
  name: string
  seen: boolean
  route?: string
  kind?: string
  note?: string
  seenAt?: string
  createdAt: number
}

// Free-form fields; `hours` mirrors `playTime`'s shape so
// parseDurationToSeconds consumes either. Only `id` is required.
export interface Playthrough {
  id: string
  startedAt?: string
  finishedAt?: string
  hours?: string
  character?: string
  difficulty?: string
  platform?: Platform
  coop?: string
  note?: string
  achievementsHit?: string[]
  createdAt: number
}
