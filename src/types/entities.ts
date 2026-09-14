// Pure type declarations. No runtime values, no functions, no side effects.
// Everything a component might need to type its props or state lives here.

// type-only import — items.ts imports back from here, TS handles the
// circular type dep cleanly since neither side pulls runtime values.
import type { CategoryId } from './items'

export type Platform = string
export type Ownership = 'owned' | 'shared' | 'subscription' | 'unlicensed'
export type GameStatus = 'backlog' | 'playing' | 'played' | 'completed' | 'dropped'
export type GameSource = 'original' | 'remake' | 'remaster' | 'reimagined' | 'reboot' | 'port' | 'sequel' | 'spinoff' | 'standalone' | 'expanded' | 'collection' | 'other'
export type GameField = 'title' | 'status' | 'playTime' | 'rating' | 'tags'

export type MusicType = 'single' | 'ep' | 'album' | 'ost' | 'live' | 'recopilation'
export type MusicSource = 'original' | 'compilation' | 'soundtrack' | 'remaster' | 'deluxe' | 'reissue' | 'other'
export type MusicField = 'title' | 'artist' | 'releaseYear' | 'type' | 'rating' | 'tags'
// Standard Goldmine grading scale for physical media condition.
export type VinylCondition = 'mint' | 'near_mint' | 'very_good_plus' | 'very_good' | 'good_plus' | 'good' | 'fair' | 'poor'

// User-defined tracklist spanning multiple albums / artists. Lives at
// the top-level (data/playlists.json) rather than on any single Music
// item — a playlist references tracks by (itemId, trackId).
export interface PlaylistTrackRef {
  itemId: string        // Music Item that owns the track
  trackId: string       // Track.id inside that item
}
export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string        // relative asset path or URL
  tracks: PlaylistTrackRef[]
  createdAt: number
}

// One entry per live show the user has attended. Similar shape to a
// RewatchEntry but with venue/city metadata that only makes sense for
// concerts.
export interface ConcertEntry {
  id: string
  date: string          // ISO date
  venue: string
  city?: string
  setlist?: string      // free-form multiline
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
export type VnField = 'title' | 'status' | 'length' | 'rating' | 'tags'

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
  seiyuuNote?: string      // "young / adult", "route Amane only", etc.
  image?: string           // relative asset path or URL
  vndbId?: string          // "c1234" — lets the detail modal deep-link back to VNDB
}

// One person credited on a VN, grouped by role. VNDB splits staff into
// dozens of roles — collapsed here to the ones a hobby tracker actually
// cares about; users add anything else as a custom field.
export type VnStaffRole = 'writer' | 'artist' | 'composer' | 'director' | 'translator' | 'other'
export interface VnStaffMember {
  id: string
  name: string
  original?: string       // native-script name (e.g. Japanese kanji) when different from `name`
  role: VnStaffRole
  note?: string           // e.g. "Common route", "Route: Yuki", "Chapter 3-5"
}

// A publisher who released the VN in a specific language / region. VNDB
// exposes publishers per release, not per VN — this shape collapses that
// out to one row per (publisher, language) pair so the editor can show
// "Frontwing 🇯🇵 · Sekai Project 🇺🇸".
export interface VnPublisher {
  id: string
  name: string
  original?: string       // native-script name
  lang: string            // ISO-ish code from VNDB: "ja", "en", "zh-Hans", …
  role?: 'publisher' | 'developer' | 'both'
}

// One release edition of a VN. VNDB tracks these as `editions` on the VN
// itself (Original / Limited / Fan-translated / …). Kept read-only in the
// editor for now — the fetcher fills them and the user rarely edits.
export interface VnEdition {
  id: string
  eid?: number            // VNDB's own edition id
  lang?: string
  name: string
  official?: boolean
}

// One cover artwork for a VN. VNs typically ship multiple covers — one per
// release, plus fan editions and re-releases. The user picks which one is
// the main cover (used on the card) and can flag any as "exhibited" in the
// detail view's covers gallery.
export interface VnCover {
  id: string
  path: string            // relative asset path or URL
  lang?: string           // language of the release the cover comes from
  releaseTitle?: string   // e.g. "Original edition", "Steam release"
  main?: boolean          // exactly one cover should carry this flag
  exhibited?: boolean     // shown in the "Covers" gallery section
}

// VNDB dev status. 0 = Finished, 1 = In development, 2 = Cancelled.
export type VnDevStatus = 'finished' | 'in_development' | 'cancelled'

// One screenshot attached to a VN. Same shape as Game Screenshot but with
// a per-screenshot NSFW flag — VNDB annotates each screenshot individually,
// and the detail modal blurs sensitive ones behind a click-to-reveal.
export interface VnScreenshot {
  id: string
  filename: string
  path: string             // relative to assets/
  addedAt: string          // ISO
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

// A game bundled inside another (Metal Gear Solid HD Collection contains
// MGS2 + MGS3, etc.). Kept intentionally light — the parent Item already
// carries the shared metadata; each sub-entry only needs a cover + own status.
export interface BundleGame {
  id: string
  name: string
  cover?: string           // relative asset path (assets/videojuegos/bundle/…) or URL
  status: GameStatus
}

// Highlight / note captured from a book while reading. Bulk-imported
// from Kindle "My Clippings.txt" (and eventually other sources like
// StoryGraph CSV). Read-only display in BookDetailModal — bulk-imported
// artifacts, users delete individually if they want to prune.
export interface Highlight {
  id: string
  text: string
  note?: string          // separate note text (Kindle exports Note entries too)
  page?: string          // "42"
  location?: string      // Kindle location range, e.g. "1200-1204"
  addedAt?: string       // ISO date
}

// Detailed per-achievement record (Games). Coexists with the flat
// achievementsUnlocked / achievementsTotal string fields — those stay
// as a fast "12 / 40" summary; this array is opt-in richer data for
// users who care about the full list.
export interface Achievement {
  id: string
  name: string
  description?: string
  unlockedAt?: string    // ISO date
  icon?: string          // relative asset path or URL
}

// Screenshot attached to a Game. Stored under assets/games/screenshots/
// <title>/<filename>. Same shape as SaveFile without the mandatory size —
// screenshots are always images so previews get shown in the editor +
// detail modal.
export interface Screenshot {
  id: string
  filename: string
  path: string           // relative to assets/
  addedAt: string        // ISO
  caption?: string
}

// Per-chapter reading note for a Book. Chapter is free-form so "Prologue",
// "1", "1.5", "Chapter 12 — The Return" all work.
export interface ChapterNote {
  id: string
  chapter: string
  note: string
}

// User-uploaded save files for a game. Stored on disk under
// assets/games/saves/<title>/<filename>. Any extension is accepted
// (.sav / .dat / .zip / .rar / whatever) — save formats vary too much
// per engine to whitelist. Uploads accumulate over time; the `note`
// field is what makes 20 entries for the same game useful ("post-final
// boss", "NG+", "all collectibles").
export interface SaveFile {
  id: string
  filename: string       // original filename, with (2)/(3)/… suffix on collision
  path: string           // relative to assets/, e.g. "games/saves/Metro Exodus/Slot 3.sav"
  size: number           // bytes
  addedAt: string        // ISO
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
  scanlator?: string        // fan-translation attribution group ("MangaDex" / "Void Scans" / etc.)
}

// Physical vs digital ownership tracker (manga family). Users often
// collect the physical volumes and read the digital release — this
// captures both without collapsing the distinction.
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
  // Disc number for multi-disc albums (physical releases). "1" for the
  // first disc, "2" for the second, etc. Undefined = single-disc album
  // or unassigned — the tracklist treats those as one flat list.
  disc?: string
}

// A distinct release edition of an album (Deluxe, Japan, 10th Anniversary…),
// each with its own optional cover and extra/alternate tracks.
export interface AlbumEdition {
  id: string
  name: string
  cover?: string
  releaseDate?: string     // ISO date; each edition often ships months/years after the base album
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

// One period of a member's tenure with a specific role set. Members who
// only ever did one thing don't need `stints[]` — the top-level roles +
// joinedIn/leftIn cover the common case. Stints kick in when a member
// switched instruments over time (bassist who later became rhythm
// guitarist, etc.); each entry stands on its own.
export interface MemberStint {
  id: string
  roles: string[]
  from?: string           // free-text year: "1998", "March 2003", "?"
  to?: string             // empty = still doing this role in this stint
  // Marks this stint as a touring-only period — the member was on
  // stage for the tour(s) but never joined the studio line-up (or
  // switched instruments only for the road). Rendered with a dashed
  // border on the band timeline.
  touring?: boolean
}

// Membership tier — expands the old `former: boolean` toggle into four
// buckets so touring musicians get their own visual group without
// getting mixed into the studio line-up.
//   - 'current'          — active studio member
//   - 'current-touring'  — currently touring only (no studio credit)
//   - 'former'           — past studio member
//   - 'former-touring'   — past touring member (no studio credit)
export type MemberStatus = 'current' | 'current-touring' | 'former' | 'former-touring'

// Resolve the effective membership tier from a member, migrating the
// legacy `former: boolean` field on the fly. Keeps callers in the UI
// simple: `getMemberStatus(m) === 'former-touring'` regardless of what
// era the JSON was written in.
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

// A band member with one or more roles (Vocals, Guitar, Bass, Drums…).
// `membership` groups the line-up on the artist detail page and the
// band timeline. `former` is kept for back-compat with pre-0.4.1 data
// — the load path migrates `former: true` → `membership: 'former'`.
// `deceased` renders a † next to the name.
export interface BandMember {
  id: string
  name: string
  roles: string[]
  membership?: MemberStatus
  former?: boolean         // deprecated: read-only, kept so old JSON still loads
  joinedIn?: string        // free-text year: "1998", "March 2003", "?"
  leftIn?: string          // only meaningful when the membership is a 'former*' tier
  deceased?: boolean
  stints?: MemberStint[]   // optional extra periods with different role sets
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
  // Live shows attended for this artist. Moved from Item (albums used to
  // carry their own concerts list, which meant re-typing the same show
  // for every album by the same band). Legacy Item.concerts arrays are
  // migrated onto the matching artist on first load post-0.3.6.
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

// Bag view of an item — every field of every variant, all optional,
// `categoryId` widened to plain string. This is the top-level `Item`
// type most of the codebase still uses. Components that opted into the
// discriminated union (`GameItem`, `MusicItem`, … from `./items`)
// declare the strict variant they accept and narrow via the
// `isGameItem` / `isMusicItem` type guards. Fase 2 will split App.tsx
// state per-category and let us swap `Item` from this bag to
// `TypedItem` (the strict union) — until then this is the shared
// vocabulary.
//
// `AnyItem` and `Item` refer to the same shape; the alias makes the
// intent clear when a signature specifically wants the "cross-category
// bag view" (sort/filter helpers, stat aggregators, importers).
// Note: also re-exported under the name `Item` from `./items`.
export interface AnyItem {
  id: string
  categoryId: CategoryId
  title: string
  // Item-level favorite ⭐. Toggled from the card and the detail view.
  // Fuels the Home "Favorites" strip and the `favorite:true` operator
  // in Ctrl+K search. Distinct from Track.favorite (per-song).
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
  saveFiles?: SaveFile[]
  achievements?: Achievement[]
  screenshots?: Screenshot[]
  // PCGamingWiki page name once matched (e.g. "Metro Exodus"). Stored so
  // the save-paths panel doesn't re-run opensearch every time the editor
  // opens. Cleared / re-matched via the "Re-match" button in that panel.
  pcgwPage?: string
  releaseYear?: string
  duration?: string
  consumed?: boolean
  artist?: string
  genres?: string[]
  label?: string
  partOfAlbum?: string        // free-text fallback (imports, legacy entries where the album isn't in the library)
  partOfAlbumId?: string      // preferred: live reference to another Music item (typically an album). Set on non-albums that were later absorbed into an album — EPs, singles collected into a compilation, OSTs bundled into a deluxe edition. The detail view resolves this to a clickable link.
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
  airingDay?: Weekday        // used by the Simulcast board to slot the show into its weekday column
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
  // If this game derives from another (remake, port, expanded, standalone,
  // reimagined, sequel etc.), point at the parent item so the two show as
  // connected on both sides.
  originalWorkId?: string
  gameReview?: string
  mangaDescription?: string
  directors?: string[]
  cast?: string[]
  franchise?: string
  // Cross-library adaptation link — points at another item (any
  // category). Used by BasedOnDisplay + FranchiseTimeline.
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
  // Books — mirrors the manga shape (authors + reading progress + publication
  // status) with a couple of book-specific fields on top.
  bookStatus?: BookStatus
  bookFormat?: BookFormat
  bookSource?: BookSource
  publisher?: string
  saga?: string           // "The Wheel of Time", "Foundation", etc.
  sagaIndex?: string      // "Book 1", "Vol. 3"; free-form so "1.5" works
  pagesRead?: string
  totalPages?: string
  isbn?: string
  translator?: string
  bookReview?: string
  highlights?: Highlight[]
  chapterNotes?: ChapterNote[]
  // Visual Novels — VNDB-shaped metadata. Shares a lot with Games (devs,
  // publishers, platforms, releaseDate) but adds VN-specific fields: staff
  // by role, characters, engine, length enum + community hours, per-work
  // NSFW flag, and VNDB id for future re-syncs.
  visualNovelStatus?: VisualNovelStatus
  vnLength?: VnLength
  vnLengthHours?: string      // community-averaged hours from VNDB, free-form
  vnEngine?: string           // "Ren'Py" / "Kirikiri" / "TyranoBuilder" / etc.
  vnOriginalLanguage?: string // ISO-ish code from VNDB: "ja", "en", "zh", "ko", …
  vnLanguages?: string[]      // every language the release ships in
  vnAliases?: string[]        // alternate titles (romaji, english, other)
  vnCharacters?: VnCharacter[]
  vnStaff?: VnStaffMember[]
  vnScreenshots?: VnScreenshot[]
  vnCovers?: VnCover[]        // multi-cover gallery; one carries `main: true`
  vnEditions?: VnEdition[]    // release editions (Original / Steam / fan tr.)
  vnPublishers?: VnPublisher[] // per-language publishers with country tags
  vnCommunityRating?: string  // VNDB score /10, free-form so "8.45" fits
  vnDevStatus?: VnDevStatus
  vnDescription?: string
  vnReview?: string
  vndbId?: string             // "v12345" — page slug on vndb.org
  nsfw?: boolean              // work-level flag; screenshots carry their own too
  // User-defined free-form fields, Notion-style. Displayed at the bottom of
  // every detail view; each item can carry its own list independently of the
  // built-in category schema.
  customFields?: CustomField[]
  // User-defined *library-level* custom fields (see types/customFields.ts).
  // The schema lives in Settings.libraryCustomFields[categoryId]; each item
  // stores its own values keyed by field id under this bag. Missing entries
  // mean the item just hasn't answered that field — never a crash.
  libraryCustomFieldValues?: Record<string, string | number | boolean | null>
}

export interface CustomField {
  id: string
  key: string
  value: string
}
