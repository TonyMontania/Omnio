import { useState, useEffect, useMemo, useRef, ChangeEvent, Suspense, lazy } from 'react'

// Category metadata (Games / Music / Movies / Series / Anime & Donghua / Comics & Manga family)
import {
  CATEGORIES,
  isAnimeLikeCategory, isCategoryId,
} from './categories'
import type { CategoryId } from './types/items'

// Types
import type {
  Item, AnyItem, Collection, Unit, MusicArtist,
  Platform, Ownership, GameStatus, GameField, GameSource,
  MusicType, MusicField, MusicSource, Track, DlcEntry, BundleGame,
  VinylCondition, ConcertEntry,
  MangaStatus, MangaField, MangaSource, MangaVolume, Chapter, PublicationStatus, MediaOwnership,
  AnimeStatus, AnimeField, AnimeSource, AnimeFormat, AnimeSeason, AiringStatus, Demographic, Episode, Weekday,
  SeriesStatus, SeriesField, SeriesFormat, Season,
  MovieField, MovieSource, WatchLocation,
  BookField, BookStatus, BookFormat, BookSource,
  VnField, VisualNovelStatus, VnLength, VnCharacter, VnStaffMember, VnScreenshot,
  VnCover, VnEdition, VnPublisher, VnDevStatus,
  AgeRating, RelatedItem, RewatchEntry,
  BandStatus, BandMember, SingleCover, AlbumEdition,
  CustomField, SaveFile, Achievement, Screenshot, ChapterNote,
} from './types'
import type { ArcadeGame } from './types/arcade'

// Runtime constants (option lists, default field visibility)
import {
  GAME_STATUS_OPTIONS, GAME_FIELD_OPTIONS, DEFAULT_GAME_FIELDS,
  MUSIC_FIELD_OPTIONS, DEFAULT_MUSIC_FIELDS,
  MANGA_STATUS_OPTIONS, MANGA_FIELD_OPTIONS, DEFAULT_MANGA_FIELDS,
  ANIME_STATUS_OPTIONS,
  ANIME_FIELD_OPTIONS, DEFAULT_ANIME_FIELDS, WEEKDAY_OPTIONS,
  SERIES_STATUS_OPTIONS, SERIES_FIELD_OPTIONS, DEFAULT_SERIES_FIELDS,
  MOVIE_FIELD_OPTIONS, DEFAULT_MOVIE_FIELDS,
  BOOK_STATUS_OPTIONS, BOOK_FIELD_OPTIONS, DEFAULT_BOOK_FIELDS,
  VN_STATUS_OPTIONS, VN_FIELD_OPTIONS, DEFAULT_VN_FIELDS,
  BAND_STATUS_OPTIONS,
} from './types'

// Helpers (label lookups, derived counts, formatters, mini markdown)
import {
  getGameStatusRank, getMangaStatus, getAnimeStatus, getSeriesStatus, getBookStatus,
  isMangaLike,
  assetSrc, renderMiniMarkdown, parseDurationToSeconds,
} from './types'

// Stats — pure aggregation functions used by the Insights view
import {
  getCategoryStats, getTopRated, getTopArtists, getTopStudios, getTopNetworks, getTopActors,
  getTopGenres, getTopDirectors, getTopDevs, getTopPublishers, getTopPlatforms,
  getTopMusicLabels, getTopMangaAuthors, getTopMangaArtists, getTopMagazines,
  getMonthlyActivity, getAnimeEpisodesPerMonth, getSeriesEpisodesPerMonth,
  getMoviesWatchedPerMonth, getMangaChaptersPerMonth, getMusicListensPerMonth,
  getDistribution,
} from './insights/stats'
// UI: category-specific detail modals + shared building blocks.
// Every on-demand modal is code-split via React.lazy so the initial
// bundle stays lean — the app boots faster and users only pay for a
// modal's JS the first time they open it (imperceptible on local disk).
import ItemCard from './ItemCard'
import KanbanView from './views/KanbanView'
import DiaryView from './views/DiaryView'
import TimelineView from './views/TimelineView'
import { patchItemStatus, getUniversalStatusOptions } from './utils/statusUniversal'
import CardContextMenu, { type CardMenuAction } from './components/CardContextMenu'
import ImageLightbox from './components/ImageLightbox'
import FirstRunWizard from './FirstRunWizard'
import Toast from './Toast'
import BackupList from './BackupList'
import BulkActionBar from './BulkActionBar'
import Sidebar from './Sidebar'
const ReleaseCalendar    = lazy(() => import('./ReleaseCalendar'))
const Home              = lazy(() => import('./home/HomeBoard'))
const ArcadeView        = lazy(() => import('./arcade/ArcadeView'))
import { PLUGINS } from './plugins/registry'
import type { PluginDef, PluginPageMeta } from './plugins/registry'
import { subscribePluginCounts } from './plugins/counts'
const ArtistDetailView  = lazy(() => import('./ArtistDetailView'))
// The eight per-category detail modals were pulled out of this
// module and now live inside `components/DetailModalRouter.tsx`.
const DetailModalRouter = lazy(() => import('./components/DetailModalRouter'))
const DuplicatesModal   = lazy(() => import('./DuplicatesModal'))
const GenreNormalizerModal = lazy(() => import('./GenreNormalizerModal'))
const RoleNormalizerModal  = lazy(() => import('./RoleNormalizerModal'))
const TagHierarchyModal    = lazy(() => import('./TagHierarchyModal'))
const ImageUploadGuide     = lazy(() => import('./ImageUploadGuide'))
const RandomizerModal      = lazy(() => import('./RandomizerModal'))
const DataHealthAuditModal = lazy(() => import('./DataHealthAuditModal'))
const GlobalSearch      = lazy(() => import('./GlobalSearch'))
const SteamGridDbPicker = lazy(() => import('./SteamGridDbPicker'))
// Metadata fetchers (AniList, TMDb, IGDB, …) are lazy-loaded from
// `fetchers/registrations.tsx`, not here — the registry owns them now.
const MalImporter       = lazy(() => import('./MalImporter'))
const GenericImporter   = lazy(() => import('./GenericImporter'))
const SteamImporter     = lazy(() => import('./SteamImporter'))
const LetterboxdImporter = lazy(() => import('./LetterboxdImporter'))
const BackloggdImporter  = lazy(() => import('./BackloggdImporter'))
const StoryGraphImporter = lazy(() => import('./StoryGraphImporter'))
const ImdbImporter       = lazy(() => import('./ImdbImporter'))
const RymImporter        = lazy(() => import('./RymImporter'))
const HltbImporter       = lazy(() => import('./HltbImporter'))
const SerializdImporter  = lazy(() => import('./SerializdImporter'))
const SpotifyImporter    = lazy(() => import('./SpotifyImporter'))
const HighlightsImporter = lazy(() => import('./HighlightsImporter'))
const LastfmImporter    = lazy(() => import('./LastfmImporter'))
const TraktImporter     = lazy(() => import('./TraktImporter'))
const DiscogsImporter   = lazy(() => import('./DiscogsImporter'))
const YearlyWrapped     = lazy(() => import('./YearlyWrapped'))
const CoverWallExporter = lazy(() => import('./CoverWallExporter'))
const CrossLibraryFranchiseModal = lazy(() => import('./components/CrossLibraryFranchiseModal'))
const DiscographyChecker = lazy(() => import('./DiscographyChecker'))
const LocalInstallScanner = lazy(() => import('./LocalInstallScanner'))
import { BasedOnPicker } from './components/BasedOn'
import { buildStaticSiteHtml } from './exportSite'
import { buildCsvExports } from './CsvExporter'
import {
  CategoryIcon, GameStatusIcon, MangaStatusIcon, AnimeStatusIcon,
  // ChevronIcon removed — no more collapsible library groups.
  InsightsIcon, SettingsIcon, FolderIcon, CalendarIcon,
} from './icons'

// Editors and pickers used inside detail modals and the toolbar
import DistChart from './insights/DistChart'
import Heatmap from './insights/Heatmap'
import { pickImageToDataUrl, imageDropHandlers, assetBasename, exportItemAsJson } from './utils/files'
import { expandTagSelection } from './utils/tags'
// Fetcher registry — panel iterates `getFetchersFor(activeCategory)`
// and a single `activeFetcher: string | null` state drives which modal
// is on screen. All 11 built-in sources declare themselves in
// `fetchers/registrations.tsx`; that side-effect import seeds the map.
import './fetchers'
import { getFetchersFor, resolveHint, type FetcherRegistration } from './fetchers/registry'
import { detectQuickAddUrl } from './utils/quickAddUrl'
import ConcertLogEditor from './components/editors/ConcertLogEditor'
import MusicEditorSection from './components/editors/MusicEditorSection'
import GameEditorSection from './components/editors/GameEditorSection'
import MovieEditorSection from './components/editors/MovieEditorSection'
import SeriesEditorSection from './components/editors/SeriesEditorSection'
import AnimeEditorSection from './components/editors/AnimeEditorSection'
import MangaEditorSection from './components/editors/MangaEditorSection'
import BookEditorSection from './components/editors/BookEditorSection'
import VisualNovelEditorSection from './components/editors/VisualNovelEditorSection'
import TagEditor from './components/editors/TagEditor'
import BandMembersEditor from './components/editors/BandMembersEditor'
import FiltersDropdown from './components/editors/FiltersDropdown'
import { invoke } from './utils/ipc'
import { buildItemFromForm as buildItemFromFormImpl } from './editor/buildItemFromForm'
import { resetForm as resetFormImpl, loadItemIntoForm as loadItemIntoFormImpl, type FormSetters } from './editor/formActions'
import { applyPatchFieldsToForm } from './editor/applyPatch'

import './App.css'

type Layout = 'list' | 'grid' | 'compact' | 'kanban' | 'timeline' | 'diary'
type GroupBy = 'none' | 'year' | 'decade' | 'status' | 'rating'
type SortBy =
  | 'alpha' | 'recent' | 'rating' | 'custom'
  // Games
  | 'time' | 'status' | 'releaseAsc' | 'releaseDesc' | 'hltbAsc' | 'hltbDesc'
  // Cross-category
  | 'yearAsc' | 'yearDesc' | 'duration'
  // Series / Anime
  | 'episodes' | 'animeStatus' | 'seriesStatus'
  // Manga family
  | 'chapters' | 'mangaStatus'
  // Music
  | 'artist'

type ThemeName = 'dark' | 'light' | 'dark-amoled' | 'nord' | 'gruvbox-dark' | 'solarized-dark' | 'dracula' | 'tokyo-night' | 'catppuccin' | 'rose-pine' | 'everforest'
type AccentName = 'default' | 'amber' | 'red' | 'blue' | 'green' | 'purple' | 'teal' | 'pink'

const THEME_OPTIONS: { value: ThemeName; label: string; family: string; swatch: string[] }[] = [
  { value: 'dark', label: 'Dark', family: 'Original', swatch: ['#14151a', '#1b1c23', '#c9a227'] },
  { value: 'light', label: 'Light', family: 'Original', swatch: ['#f5f3ee', '#ffffff', '#a8791b'] },
  { value: 'dark-amoled', label: 'AMOLED', family: 'Original', swatch: ['#000000', '#0a0a0a', '#c9a227'] },
  { value: 'nord', label: 'Nord', family: 'Cool', swatch: ['#2e3440', '#3b4252', '#88c0d0'] },
  { value: 'tokyo-night', label: 'Tokyo Night', family: 'Cool', swatch: ['#1a1b26', '#24283b', '#7aa2f7'] },
  { value: 'solarized-dark', label: 'Solarized', family: 'Cool', swatch: ['#002b36', '#073642', '#b58900'] },
  { value: 'dracula', label: 'Dracula', family: 'Vibrant', swatch: ['#282a36', '#44475a', '#bd93f9'] },
  { value: 'catppuccin', label: 'Catppuccin', family: 'Vibrant', swatch: ['#1e1e2e', '#313244', '#cba6f7'] },
  { value: 'rose-pine', label: 'Rosé Pine', family: 'Vibrant', swatch: ['#191724', '#26233a', '#ebbcba'] },
  { value: 'gruvbox-dark', label: 'Gruvbox', family: 'Warm', swatch: ['#282828', '#3c3836', '#d79921'] },
  { value: 'everforest', label: 'Everforest', family: 'Warm', swatch: ['#2d353b', '#3d484d', '#a7c080'] },
]

const ACCENT_OPTIONS: { value: AccentName; label: string; swatch: string }[] = [
  { value: 'default', label: 'Theme default', swatch: 'transparent' },
  { value: 'amber', label: 'Amber', swatch: '#c9a227' },
  { value: 'red', label: 'Red', swatch: '#d9695f' },
  { value: 'blue', label: 'Blue', swatch: '#5b9bd5' },
  { value: 'green', label: 'Green', swatch: '#7fb77e' },
  { value: 'purple', label: 'Purple', swatch: '#a284d9' },
  { value: 'teal', label: 'Teal', swatch: '#4fb4a5' },
  { value: 'pink', label: 'Pink', swatch: '#d97ea0' },
]

type DensityName = 'comfortable' | 'compact'
type StartupCategoryMode = 'last' | 'first' | 'home'
type MotionMode = 'auto' | 'reduced'

interface Settings {
  defaultLayout: Layout
  confirmDelete: boolean
  theme: ThemeName
  accent: AccentName
  density: DensityName
  motion: MotionMode
  startupCategory: StartupCategoryMode
  lastCategory?: string
  welcomeShown?: boolean
  enabledCategories?: string[]
  gameFields: Record<GameField, boolean>
  musicFields: Record<MusicField, boolean>
  mangaFields: Record<MangaField, boolean>
  movieFields: Record<MovieField, boolean>
  animeFields: Record<AnimeField, boolean>
  seriesFields: Record<SeriesField, boolean>
  bookFields: Record<BookField, boolean>
  vnFields: Record<VnField, boolean>
  // Last sort mode the user picked per category. Restored on switch so
  // "Rating" stays as your preference in Games without leaking into Music.
  categorySortModes?: Record<string, string>
  rememberCategorySort?: boolean
  // Card-grid zoom. sm = denser, md = default, lg / xl = bigger covers.
  // Applies globally so every library respects the same preference.
  cardZoom?: 'sm' | 'md' | 'lg' | 'xl'
  sgdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
  comicvineApiKey?: string
  // AniDB's HTTP API requires a registered client name (register at
  // anidb.net/software/add — the site issues a name after a quick review).
  // Empty means "AniDB fetcher disabled"; the button in the anime editor
  // links to the settings when this is missing.
  anidbClient?: string
  // Optional HTTP/HTTPS proxy URL applied to every outbound fetch in the
  // main process. Useful for NAS containers behind corporate firewalls
  // or Pi-hole-style DNS filters. Format: `http://user:pass@host:port`.
  httpProxy?: string
  // Automatic backup to an external folder. Interval is the minimum time
  // between snapshots; the app checks hourly while running and fires the
  // same storage:copy-data-to routine as the manual button. Empty target
  // = feature disabled even if interval is set. lastAt is the unix ms
  // of the most recent successful auto-backup, used to gate the check.
  autoBackupInterval?: 'off' | 'daily' | 'weekly'
  autoBackupTarget?: string
  autoBackupLastAt?: number
  // Optional parent-tag map for the Tag hierarchy feature. Keys are child
  // tag strings, values are the parent tag string. Missing keys = the tag
  // is top-level. Cycles are ignored by the expand helper.
  tagTree?: Record<string, string>
  // Home board layout — user-arranged list of widgets (id + size). Missing
  // = the default layout kicks in (libraries + currently + upcoming).
  // Empty array [] = user explicitly cleared everything; the board shows
  // the "empty" hint instead of silently reverting to defaults.
  homeWidgets?: { id: string; size: 'small' | 'medium' | 'large' }[]
  // Persistent sidebar collapsed → icon-rail only. Users can toggle
  // from the sidebar itself. Omitted = expanded (default).
  sidebarCollapsed?: boolean
  // Extras section in the sidebar can be toggled per item from
  // Settings → Enabled libraries. Omitted = enabled (default).
  arcadeEnabled?: boolean
  // Plugins that the user has explicitly unlocked. Compiled plugins
  // stay invisible in the sidebar, "Enabled libraries" list and
  // card-field settings until their slug is added here. Unlocking is
  // gated by a user action (e.g. typing a plugin's slug into the
  // Home viewport keyboard listener).
  unlockedPlugins?: string[]
  // Per-plugin, per-field on/off overrides. Missing entries fall back
  // to the plugin's declared defaults.
  pluginCardFields?: Record<string, Record<string, boolean>>
  // Per-category defaults applied when the user opens Add. Set via
  // "Save as template" in the add panel; cleared per-category from
  // Settings → Behavior. Keys are CategoryId strings.
  itemTemplates?: Partial<Record<string, ItemTemplate>>
}

// Small subset of add-panel fields we're willing to prefill for a new
// item. Kept optional so a template only touches the slots the user
// actually filled in when they saved it — a template with just
// `platforms: ['PC']` doesn't force a status onto every new game.
interface ItemTemplate {
  gameStatus?: GameStatus
  watchStatus?: AnimeStatus
  seriesStatus?: SeriesStatus
  mangaStatus?: MangaStatus
  bookStatus?: BookStatus
  visualNovelStatus?: VisualNovelStatus
  consumed?: boolean
  ownership?: Ownership | ''
  gameSource?: GameSource | ''
  tags?: string[]
  platforms?: Platform[]
}

interface AppData {
  items: AnyItem[]
  collections: Collection[]
  artists?: MusicArtist[]
  settings?: Settings
  customOrders?: Record<string, string[]>
  arcadeGames?: ArcadeGame[]
}

// Displayed in Settings → Data → About. Sourced from package.json so the
// About string can't drift from the packaged version number.
const APP_VERSION = __APP_VERSION__

const DEFAULT_SETTINGS: Settings = { defaultLayout: 'grid', confirmDelete: true, theme: 'dark', accent: 'default', density: 'comfortable', motion: 'auto', startupCategory: 'last', gameFields: DEFAULT_GAME_FIELDS, musicFields: DEFAULT_MUSIC_FIELDS, mangaFields: DEFAULT_MANGA_FIELDS, movieFields: DEFAULT_MOVIE_FIELDS, animeFields: DEFAULT_ANIME_FIELDS, seriesFields: DEFAULT_SERIES_FIELDS, bookFields: DEFAULT_BOOK_FIELDS, vnFields: DEFAULT_VN_FIELDS, rememberCategorySort: true, categorySortModes: {}, cardZoom: 'md' }

function getUniqueTags(list: AnyItem[]): string[] {
  const set = new Set<string>()
  list.forEach((i) => i.tags?.forEach((t) => set.add(t)))
  return Array.from(set).sort()
}

function compareDates(a?: string, b?: string, asc = true): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return asc ? da - db : db - da
}

// Reads whichever year-ish field the item happens to have populated.
// Different categories store year in different places (games use releaseDate,
// music/movies use releaseYear, series use startYear, anime uses airedFrom, etc).
// Group a pre-sorted item list into buckets for the "Group by" render
// mode. Every bucket keeps its input order (so the outer sortBy still
// controls how items appear inside a group). Categories that don't
// carry a given axis (e.g. Music has no `year` on every album) still
// work — items without a key land in the "Unknown" bucket at the end.
interface Bucket { key: string; label: string; list: AnyItem[] }
function groupItems(list: AnyItem[], by: 'year' | 'decade' | 'status' | 'rating', categoryId: string): Bucket[] {
  const buckets = new Map<string, Bucket>()
  const putIn = (key: string, label: string, it: AnyItem) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, list: [] })
    buckets.get(key)!.list.push(it)
  }
  // `||` (not `??`) so unset-but-empty-string year fields fall through
  // to the next candidate instead of pinning to '' and returning NaN.
  const yearOf = (it: AnyItem): number => {
    const raw = it.releaseYear
      || it.seasonYear
      || it.startYear
      || (it.airedFrom ? it.airedFrom.slice(0, 4) : '')
      || (it.releaseDate ? it.releaseDate.slice(0, 4) : '')
      || ''
    return parseInt(String(raw), 10)
  }
  for (const it of list) {
    if (by === 'year') {
      const y = yearOf(it)
      if (!isNaN(y) && y >= 1000 && y <= 3000) putIn(String(y), String(y), it)
      else putIn('_unknown', 'Unknown year', it)
    } else if (by === 'decade') {
      const y = yearOf(it)
      if (!isNaN(y) && y >= 1000 && y <= 3000) {
        const d = Math.floor(y / 10) * 10
        putIn(String(d), `${d}s`, it)
      } else putIn('_unknown', 'Unknown decade', it)
    } else if (by === 'status') {
      const v = it.gameStatus ?? it.watchStatus ?? it.seriesStatus ?? it.mangaStatus ?? it.bookStatus ?? it.visualNovelStatus
        ?? (categoryId === 'peliculas' ? (it.consumed ? 'watched' : 'unwatched')
          : categoryId === 'musica' ? (it.consumed ? 'listened' : 'unlistened') : '')
      const key = String(v || '_unknown')
      const label = key === '_unknown' ? 'No status' : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      putIn(key, label, it)
    } else if (by === 'rating') {
      const r = it.rating ?? 0
      if (!r) putIn('_unknown', 'Unrated', it)
      else {
        const key = String(Math.floor(r))
        putIn(key, `★ ${key}${r % 1 === 0.5 ? '.5' : ''}+`, it)
      }
    }
  }
  const arr = Array.from(buckets.values())
  // Sort buckets: numeric keys ascending (year / decade / rating),
  // status by original enum order, "_unknown" last.
  arr.sort((a, b) => {
    if (a.key === '_unknown') return 1
    if (b.key === '_unknown') return -1
    const an = parseInt(a.key, 10)
    const bn = parseInt(b.key, 10)
    if (!isNaN(an) && !isNaN(bn)) return by === 'rating' ? bn - an : an - bn
    return a.label.localeCompare(b.label)
  })
  return arr
}

function pickYear(i: AnyItem): number {
  const first = i.releaseYear || i.seasonYear || i.startYear
    || (i.airedFrom ? i.airedFrom.slice(0, 4) : '')
    || (i.releaseDate ? i.releaseDate.slice(0, 4) : '')
  const n = parseInt(first || '', 10)
  return isNaN(n) ? 0 : n
}

// Total runtime / listen time in seconds. Music sums track durations,
// movies use their `duration` (minutes), series/anime use eps * ep duration.
function pickDuration(i: AnyItem): number {
  if (i.tracks && i.tracks.length > 0) {
    return i.tracks.reduce((acc: number, t) => acc + parseDurationToSeconds(t.duration), 0)
  }
  const movieMin = parseInt(i.duration || '', 10)
  if (!isNaN(movieMin) && movieMin > 0) return movieMin * 60
  const eps = parseInt(i.episodesWatched || i.totalEpisodes || '', 10)
  const epDur = parseInt(i.episodeDuration || '', 10)
  if (!isNaN(eps) && !isNaN(epDur) && eps > 0 && epDur > 0) return eps * epDur * 60
  return 0
}

function statusRank<T extends string>(value: T | undefined, fallback: T, options: readonly { value: T }[]): number {
  const v = (value || fallback) as T
  const idx = options.findIndex((o) => o.value === v)
  return idx < 0 ? options.length : idx
}

function filterAndSort<T extends AnyItem>(list: T[], search: string, filterTags: string[], filterStatus: GameStatus[], filterPlatforms: Platform[], filterGenres: string[], sortBy: SortBy | null, customOrder: string[] = [], minRating = 0, tagTree?: Record<string, string>): T[] {
  filterTags = expandTagSelection(filterTags, tagTree)
  let result = list
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    result = result.filter((i) => {
      if (i.title.toLowerCase().includes(q)) return true
      if (i.alternativeTitles?.some((a: string) => a.toLowerCase().includes(q))) return true
      if (i.artist?.toLowerCase().includes(q)) return true
      return false
    })
  }
  if (filterTags.length > 0) result = result.filter((i) => i.tags?.some((t: string) => filterTags.includes(t)))
  if (filterStatus.length > 0) result = result.filter((i) => filterStatus.includes(i.gameStatus || 'backlog'))
  if (filterPlatforms.length > 0) result = result.filter((i) => i.platforms?.some((p: string) => filterPlatforms.includes(p)))
  if (filterGenres.length > 0) result = result.filter((i) => i.genres?.some((g: string) => filterGenres.includes(g)))
  if (minRating > 0) result = result.filter((i) => (i.rating ?? 0) >= minRating)
  if (!sortBy) return result
  const arr = [...result]
  // Universal
  if (sortBy === 'alpha') arr.sort((a, b) => a.title.localeCompare(b.title))
  else if (sortBy === 'recent') arr.sort((a, b) => b.createdAt - a.createdAt)
  else if (sortBy === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  // Games
  else if (sortBy === 'time') arr.sort((a, b) => parseFloat(b.playTime || '0') - parseFloat(a.playTime || '0'))
  // Backlog prioritization — shortest / longest games first based on
  // HowLongToBeat's main-story estimate. Unrated games fall to the
  // end so a fresh backlog with no HLTB data still sorts sensibly.
  else if (sortBy === 'hltbAsc') arr.sort((a, b) => {
    const av = (a as { hltbHours?: number }).hltbHours ?? Number.POSITIVE_INFINITY
    const bv = (b as { hltbHours?: number }).hltbHours ?? Number.POSITIVE_INFINITY
    return av - bv
  })
  else if (sortBy === 'hltbDesc') arr.sort((a, b) => ((b as { hltbHours?: number }).hltbHours ?? -1) - ((a as { hltbHours?: number }).hltbHours ?? -1))
  else if (sortBy === 'status') arr.sort((a, b) => getGameStatusRank(b.gameStatus) - getGameStatusRank(a.gameStatus))
  else if (sortBy === 'releaseAsc') arr.sort((a, b) => compareDates(a.releaseDate, b.releaseDate, true))
  else if (sortBy === 'releaseDesc') arr.sort((a, b) => compareDates(a.releaseDate, b.releaseDate, false))
  // Cross-category year & duration
  else if (sortBy === 'yearAsc') arr.sort((a, b) => (pickYear(a) || 9999) - (pickYear(b) || 9999))
  else if (sortBy === 'yearDesc') arr.sort((a, b) => pickYear(b) - pickYear(a))
  else if (sortBy === 'duration') arr.sort((a, b) => pickDuration(b) - pickDuration(a))
  // Series / Anime
  else if (sortBy === 'episodes') arr.sort((a, b) => (parseInt(b.episodesWatched || '0', 10) || 0) - (parseInt(a.episodesWatched || '0', 10) || 0))
  else if (sortBy === 'animeStatus') arr.sort((a, b) => statusRank(a.watchStatus, 'plan_to_watch', ANIME_STATUS_OPTIONS) - statusRank(b.watchStatus, 'plan_to_watch', ANIME_STATUS_OPTIONS))
  else if (sortBy === 'seriesStatus') arr.sort((a, b) => statusRank(a.seriesStatus, 'plan_to_watch', SERIES_STATUS_OPTIONS) - statusRank(b.seriesStatus, 'plan_to_watch', SERIES_STATUS_OPTIONS))
  // Manga family
  else if (sortBy === 'chapters') arr.sort((a, b) => (parseInt(b.chaptersRead || '0', 10) || 0) - (parseInt(a.chaptersRead || '0', 10) || 0))
  else if (sortBy === 'mangaStatus') arr.sort((a, b) => statusRank(a.mangaStatus, 'plan_to_read', MANGA_STATUS_OPTIONS) - statusRank(b.mangaStatus, 'plan_to_read', MANGA_STATUS_OPTIONS))
  // Music
  else if (sortBy === 'artist') arr.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''))
  // Custom (drag order)
  else if (sortBy === 'custom') {
    const idx = new Map(customOrder.map((id, i) => [id, i]))
    arr.sort((a, b) => (idx.has(a.id) ? idx.get(a.id)! : Infinity) - (idx.has(b.id) ? idx.get(b.id)! : Infinity))
  }
  return arr
}



function App() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>(CATEGORIES[0].id)
  // App-level items state stays on the loose `AnyItem` bag so the
  // dozens of generic mappers / bulk ops inside App.tsx keep compiling
  // without a narrow per line. Component boundaries (detail modals,
  // editor sections) declare their strict variant (`GameItem`,
  // `MusicItem`, …) — narrowing happens at the pass site via the
  // `isGameItem` / `isMusicItem` type guards. Fase 2 will split this
  // per-category and drop `AnyItem` entirely.
  const [items, setItems] = useState<AnyItem[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [layout, setLayout] = useState<Layout>('grid')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  // `ItemCard` only accepts the three classic layouts. Special views
  // (musicBoard, mangaBoard, per-status boards, etc.) always render as
  // grid/list/compact, so when the main layout is kanban/timeline/diary
  // we degrade to 'grid' inside those special renderers.
  const classicLayout: 'list' | 'grid' | 'compact' =
    layout === 'list' || layout === 'compact' ? layout : 'grid'
  const [specialView, setSpecialView] = useState<'none' | 'home' | 'board' | 'musicBoard' | 'mangaBoard' | 'moviesBoard' | 'animeBoard' | 'seriesBoard' | 'bookBoard' | 'vnBoard' | 'simulcastBoard' | 'stats' | 'calendar' | 'settings' | 'arcade'>('none')
  // Arcade section state (score log + 1cc grid). Loaded from and
  // persisted to the same JSON blob as `items` — see save/load below.
  const [arcadeGames, setArcadeGames] = useState<ArcadeGame[]>([])
  // Locally-installed plugin (git-ignored overlay under
  // `src/categories/<slug>/`). When non-null, its <View/> replaces
  // the library grid. Registry populates via `import.meta.glob` — the
  // public build has zero entries so this state stays `null`.
  const [activePluginSlug, setActivePluginSlug] = useState<string | null>(null)
  const [pluginCounts, setPluginCounts] = useState<Record<string, number>>({})
  const [pluginPageMeta, setPluginPageMeta] = useState<PluginPageMeta | null>(null)
  useEffect(() => subscribePluginCounts(setPluginCounts), [])

  // Fire each plugin's `preload` once so the sidebar count is
  // populated before the user opens the plugin for the first time.
  useEffect(() => { for (const p of PLUGINS) { void p.preload?.() } }, [])

  // Home-screen keyboard listener: user types a plugin's slug and
  // the app unlocks (or re-locks) it. Only active on the Home view
  // and when no input/textarea has focus — otherwise we'd steal
  // keystrokes from search boxes.
  const pluginKeyBufferRef = useRef('')
  useEffect(() => {
    if (specialView !== 'home' || activePluginSlug) return
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      const tag = active?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (active as HTMLElement | null)?.isContentEditable) return
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      const ch = e.key.toLowerCase()
      if (!/[a-z]/.test(ch)) { pluginKeyBufferRef.current = ''; return }
      const buf = (pluginKeyBufferRef.current + ch).slice(-32)
      pluginKeyBufferRef.current = buf
      for (const plug of PLUGINS) {
        // Trigger word = plugin slug's singular form, matched case-
        // insensitively at the end of the buffer. Keeps the trigger
        // discoverable-but-unspoken — same word the user would guess
        // if a friend mentioned it exists.
        const triggers = [plug.slug.toLowerCase(), plug.slug.toLowerCase().replace(/s$/, '')]
          .filter((t) => t.length >= 3)
        if (!triggers.some((t) => buf.endsWith(t))) continue
        pluginKeyBufferRef.current = ''
        setSettings((prev) => {
          const unlocked = new Set(prev.unlockedPlugins ?? [])
          if (unlocked.has(plug.slug)) {
            unlocked.delete(plug.slug)
            setToast(`${plug.label} library deactivated`)
          } else {
            unlocked.add(plug.slug)
            setToast(`Activated ${plug.label} library`)
          }
          return { ...prev, unlockedPlugins: Array.from(unlocked) }
        })
        break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [specialView, activePluginSlug])
  useEffect(() => { if (!activePluginSlug) setPluginPageMeta(null) }, [activePluginSlug])
  // If the user re-locks a plugin whose view is currently open, snap
  // them back to Home so they aren't stranded in a hidden library.
  useEffect(() => {
    if (activePluginSlug && !settings.unlockedPlugins?.includes(activePluginSlug)) {
      setActivePluginSlug(null)
      setSpecialView('home')
    }
  }, [activePluginSlug, settings.unlockedPlugins])
  // Only compiled plugins the user has unlocked (via the Home
  // keyboard listener) show up in the sidebar / settings / card
  // fields. Everyone else runs the same build with the plugin's code
  // present but no visible surface anywhere.
  const visiblePlugins: PluginDef[] = useMemo(
    () => PLUGINS.filter((p) => settings.unlockedPlugins?.includes(p.slug)),
    [settings.unlockedPlugins],
  )
  const [animeBoardStatus, setAnimeBoardStatus] = useState<AnimeStatus>('plan_to_watch')
  const [seriesBoardStatus, setSeriesBoardStatus] = useState<SeriesStatus>('plan_to_watch')
  const [bookBoardStatus, setBookBoardStatus] = useState<BookStatus>('plan_to_read')
  const [vnBoardStatus, setVnBoardStatus] = useState<VisualNovelStatus>('plan_to_play')
  // Single detail-modal state. `viewing` holds whichever item the
  // user opened; `<DetailModalRouter>` narrows via the per-category
  // type guards and picks the right modal. Replaces eight separate
  // `viewingX` slots that used to live one per category — see
  // components/DetailModalRouter.tsx.
  const [viewing, setViewing] = useState<AnyItem | null>(null)
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'behavior' | 'libraries' | 'cards' | 'data' | 'integrations' | 'maintenance'>('appearance')
  const [welcomeStep, setWelcomeStep] = useState<'libraries' | 'keys' | 'tips'>('libraries')
  const [welcomePicks, setWelcomePicks] = useState<Record<string, boolean>>({})
  const [moviesBoardFilter, setMoviesBoardFilter] = useState<'watched' | 'unwatched'>('watched')
  const [mangaBoardStatus, setMangaBoardStatus] = useState<MangaStatus>('plan_to_read')
  const [musicBoardFilter, setMusicBoardFilter] = useState<'listened' | 'unlistened'>('listened')
  const [statsCategory, setStatsCategory] = useState<CategoryId>(CATEGORIES[0].id)

  useEffect(() => {
    if (settings.enabledCategories && settings.enabledCategories.length > 0 && !settings.enabledCategories.includes(activeCategory)) {
      // Guard: `enabledCategories` is `string[]` on disk, so cross the
      // boundary through isCategoryId — a bad value from a hand-edited
      // settings file falls back to the first CATEGORIES entry rather
      // than corrupting state.
      const first = settings.enabledCategories[0]
      if (isCategoryId(first)) setActiveCategory(first)
    }
    if (settings.enabledCategories && settings.enabledCategories.length > 0 && !settings.enabledCategories.includes(statsCategory)) {
      const first = settings.enabledCategories[0]
      if (isCategoryId(first)) setStatsCategory(first)
    }
  }, [settings.enabledCategories, activeCategory, statsCategory])

  useEffect(() => {
    if (settings.arcadeEnabled === false && specialView === 'arcade') {
      setSpecialView('home')
    }
  }, [settings.arcadeEnabled, specialView])

  const [subView, setSubView] = useState<'items' | 'groups' | 'artists'>('items')
  // Sort order for the folder-grid sub-views (Groups and Artists).
  // Independent of the main library `sortBy` so switching between
  // items and groups doesn't clobber either one's ordering.
  const [folderSort, setFolderSort] = useState<'alpha' | 'recent'>('alpha')
  const [musicArtists, setMusicArtists] = useState<MusicArtist[]>([])
  const [newArtistName, setNewArtistName] = useState('')
  const [viewingArtist, setViewingArtist] = useState<MusicArtist | null>(null)
  const [artistPanelOpen, setArtistPanelOpen] = useState(false)
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null)
  const [artistEditorTab, setArtistEditorTab] = useState<'overview' | 'details' | 'members' | 'concerts'>('overview')
  const [artistNameField, setArtistNameField] = useState('')
  const [artistPhotoField, setArtistPhotoField] = useState('')
  const [artistBannerField, setArtistBannerField] = useState('')
  const [artistOrigin, setArtistOrigin] = useState('')
  const [artistBandStatus, setArtistBandStatus] = useState<BandStatus | ''>('')
  const [artistGenres, setArtistGenres] = useState<string[]>([])
  const [artistActiveFrom, setArtistActiveFrom] = useState('')
  const [artistActiveTo, setArtistActiveTo] = useState('')
  const [artistLabels, setArtistLabels] = useState<string[]>([])
  const [artistMembers, setArtistMembers] = useState<BandMember[]>([])
  const [artistConcerts, setArtistConcerts] = useState<ConcertEntry[]>([])
  const artistPhotoFileInputRef = useRef<HTMLInputElement>(null)
  const artistBannerFileInputRef = useRef<HTMLInputElement>(null)
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [collectionNameField, setCollectionNameField] = useState('')
  const [collectionCoverField, setCollectionCoverField] = useState('')
  const collectionCoverFileRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<GameStatus[]>([])
  const [filterPlatforms, setFilterPlatforms] = useState<Platform[]>([])
  const [filterGenres, setFilterGenres] = useState<string[]>([])
  const [minRating, setMinRating] = useState<number>(0)
  const [deleteMode, setDeleteMode] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editPreviewMode, setEditPreviewMode] = useState<'card' | 'detail'>('card')
  const [editingId, setEditingId] = useState<string | null>(null)
  const savedScrollRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [boardStatus, setBoardStatus] = useState<GameStatus>('backlog')
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('pie')
  const [customOrders, setCustomOrders] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [brokenAssetsOpen, setBrokenAssetsOpen] = useState(false)
  const [genreNormalizerOpen, setGenreNormalizerOpen] = useState(false)
  const [roleNormalizerOpen, setRoleNormalizerOpen] = useState(false)
  const [tagHierarchyOpen, setTagHierarchyOpen] = useState(false)
  const [imageGuideOpen, setImageGuideOpen] = useState(false)
  const [randomizerOpen, setRandomizerOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [brokenAssets, setBrokenAssets] = useState<{ itemId: string; itemTitle: string; category: string; field: string; rel: string }[]>([])

  // Mirror of storage:clear-asset-ref but for the in-memory items /
  // collections / artists state, so a Clear from the broken-cover modal
  // reflects instantly — otherwise <img> tags keep firing 404s on every
  // render until the user hits F5.
  const applyClearedRefLocally = (b: { itemId: string; category: string; field: string }) => {
    skipHistoryRef.current = true
    if (b.category === 'artists') {
      setMusicArtists((list) => list.map((a) => {
        if (a.id !== b.itemId) return a
        if (b.field === 'photo')  return { ...a, photo: undefined }
        if (b.field === 'banner') return { ...a, bannerImage: undefined }
        return a
      }))
      return
    }
    if (b.category === 'collections') {
      setCollections((list) => list.map((g) => (g.id === b.itemId && b.field === 'cover' ? { ...g, cover: undefined } : g)))
      return
    }
    setItems((list) => list.map((it) => {
      if (it.id !== b.itemId) return it
      if (b.field === 'cover')     return { ...it, cover: undefined }
      if (b.field === 'banner')    return { ...it, bannerImage: undefined }
      if (b.field === 'banner 2')  return { ...it, bannerImage2: undefined }
      if (b.field === 'logo')      return { ...it, logoImage: undefined }
      if (b.field.startsWith('volume ')) {
        const n = b.field.slice(7)
        return { ...it, volumeCovers: it.volumeCovers?.map((v) => (String(v.number ?? '?') === n ? { ...v, cover: '' } : v)) }
      }
      if (b.field.startsWith('single ')) {
        const n = b.field.slice(7)
        return { ...it, singleCovers: it.singleCovers?.map((s) => ((s.name ?? '?') === n ? { ...s, cover: '' } : s)) }
      }
      if (b.field.startsWith('edition ')) {
        const n = b.field.slice(8)
        return { ...it, editions: it.editions?.map((e) => ((e.name ?? '?') === n ? { ...e, cover: undefined } : e)) }
      }
      if (b.field.startsWith('bundle ')) {
        const n = b.field.slice(7)
        return { ...it, bundleContents: it.bundleContents?.map((x) => ((x.name ?? '?') === n ? { ...x, cover: undefined } : x)) }
      }
      return it
    }))
  }
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ item: AnyItem; x: number; y: number } | null>(null)
  // Active tab in the tabbed editor prototype. Reset to 'overview' each
  // time the user opens a new item so they always land on the essentials.
  const [editorTab, setEditorTab] = useState<'overview' | 'identity' | 'progress' | 'media' | 'history' | 'related' | 'notes'>('overview')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sgdbOpen, setSgdbOpen] = useState<null | 'grids' | 'heroes' | 'logos'>(null)
  const [bundleSgdbFor, setBundleSgdbFor] = useState<null | { entryId: string; title: string }>(null)
  const [updateInfo, setUpdateInfo] = useState<null | { current: string; latest: string; htmlUrl?: string; publishedAt?: string; notes?: string; matchedAssetUrl?: string; matchedAssetName?: string }>(null)
  const [updateCheckState, setUpdateCheckState] = useState<'idle' | 'checking' | 'up-to-date' | 'error'>('idle')
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null)
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)
  const [updateInstallKind, setUpdateInstallKind] = useState<string>('unknown')
  type DownloadState =
    | { phase: 'idle' }
    | { phase: 'downloading'; received: number; total: number }
    | { phase: 'done'; path: string; size: number }
    | { phase: 'error'; message: string }
  const [downloadState, setDownloadState] = useState<DownloadState>({ phase: 'idle' })
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

  const runUpdateCheck = async (silent: boolean) => {
    if (!silent) setUpdateCheckState('checking')
    setUpdateCheckError(null)
    const r = await invoke('updates:check', APP_VERSION)
    if (!r.ok) {
      if (!silent) { setUpdateCheckState('error'); setUpdateCheckError(r.error) }
      return
    }
    if (r.hasUpdate) {
      // Point the user at the exact asset that matches their install kind.
      const installKind = await invoke('updates:install-kind')
      let matchedAssetUrl: string | undefined
      let matchedAssetName: string | undefined
      if (installKind.assetHint && Array.isArray(r.assets)) {
        const hit = r.assets.find((a) => a.name.toLowerCase().endsWith(installKind.assetHint.toLowerCase()))
        if (hit) { matchedAssetUrl = hit.url; matchedAssetName = hit.name }
      }
      setUpdateInstallKind(installKind.kind)
      setUpdateInfo({ current: r.current, latest: r.latest, htmlUrl: r.htmlUrl, publishedAt: r.publishedAt, notes: r.notes, matchedAssetUrl, matchedAssetName })
      setUpdateBannerDismissed(false)
      if (!silent) setUpdateCheckState('idle')
    } else {
      setUpdateInfo(null)
      if (!silent) setUpdateCheckState('up-to-date')
    }
  }

  useEffect(() => {
    // Silent check once at boot; renderer decides when so we don't block startup.
    const t = setTimeout(() => { runUpdateCheck(true) }, 1500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handler = (_ev: unknown, p: { received: number; total: number }) => {
      setDownloadState((s) => s.phase === 'downloading' ? { phase: 'downloading', received: p.received, total: p.total } : s)
    }
    window.ipcRenderer.on('updates:progress', handler)
    return () => { window.ipcRenderer.off('updates:progress', handler) }
  }, [])

  const startAssistedDownload = async () => {
    if (!updateInfo?.matchedAssetUrl || !updateInfo.matchedAssetName) return
    setUpdateModalOpen(true)
    setDownloadState({ phase: 'downloading', received: 0, total: 0 })
    const r = await invoke('updates:download', updateInfo.matchedAssetUrl, updateInfo.matchedAssetName)
    if (!r.ok) {
      setDownloadState({ phase: 'error', message: r.error })
      return
    }
    setDownloadState({ phase: 'done', path: r.path, size: r.size })
  }

  const finalizeUpdate = async () => {
    if (downloadState.phase !== 'done') return
    if (updateInstallKind === 'win-nsis') {
      await invoke('updates:launch-installer', downloadState.path)
    } else if (updateInstallKind === 'linux-appimage') {
      const r = await invoke('updates:appimage-swap', downloadState.path)
      if (!r.ok) setDownloadState({ phase: 'error', message: r.error })
    } else if (updateInstallKind === 'mac-arm64' || updateInstallKind === 'mac-x64') {
      await invoke('updates:open-dmg', downloadState.path)
      setUpdateModalOpen(false)
    } else {
      // Portable / unknown → reveal in explorer, user runs manually.
      await invoke('updates:reveal', downloadState.path)
      setUpdateModalOpen(false)
    }
  }
  // Single open-state for every metadata fetcher. Holds the registration
  // id (`'tmdb'` / `'igdb'` / …) of the modal currently on screen.
  const [activeFetcher, setActiveFetcher] = useState<string | null>(null)
  const [malOpen, setMalOpen] = useState(false)
  const [genericImportOpen, setGenericImportOpen] = useState(false)
  const [steamOpen, setSteamOpen] = useState(false)
  const [letterboxdOpen, setLetterboxdOpen] = useState(false)
  const [highlightsImportOpen, setHighlightsImportOpen] = useState(false)
  const [lastfmImportOpen, setLastfmImportOpen] = useState(false)
  const [traktImportOpen, setTraktImportOpen] = useState(false)
  const [discogsImportOpen, setDiscogsImportOpen] = useState(false)
  const [backloggdOpen, setBackloggdOpen] = useState(false)
  const [storyGraphOpen, setStoryGraphOpen] = useState(false)
  const [imdbOpen, setImdbOpen] = useState(false)
  const [rymOpen, setRymOpen] = useState(false)
  const [hltbOpen, setHltbOpen] = useState(false)
  const [serializdOpen, setSerializdOpen] = useState(false)
  const [spotifyOpen, setSpotifyOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const [coverWallOpen, setCoverWallOpen] = useState(false)
  const [franchiseTimelineOpen, setFranchiseTimelineOpen] = useState<string | null>(null)
  const [discographyCheckerOpen, setDiscographyCheckerOpen] = useState(false)
  const [installScanOpen, setInstallScanOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportScope, setExportScope] = useState<string>('all')

  // ---- Undo / redo of library mutations ----
  // We snapshot items+collections+artists on every observable change and
  // let Ctrl+Z pop back through them. Deliberately limited to library data
  // — settings, panel state and modal state are not undoable.
  interface HistorySnap { items: AnyItem[]; collections: Collection[]; artists: MusicArtist[] }
  const historyRef = useRef<HistorySnap[]>([])
  const redoRef = useRef<HistorySnap[]>([])
  const skipHistoryRef = useRef(false)
  const prevSnapRef = useRef<HistorySnap | null>(null)

  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void; suppressible?: boolean } | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const askConfirm = (message: string, onConfirm: () => void, suppressible = false) => { setDontAskAgain(false); setConfirmState({ message, onConfirm, suppressible }) }

  const [title, setTitle] = useState('')
  const [cover, setCover] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [rating, setRating] = useState(0)
  const [finishedAt, setFinishedAt] = useState('')

  const [devs, setDevs] = useState<string[]>([])
  const [publishers, setPublishers] = useState<string[]>([])
  const [achievementsUnlocked, setAchievementsUnlocked] = useState('')
  const [achievementsTotal, setAchievementsTotal] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [bannerImage, setBannerImage] = useState('')
  const [logoImage, setLogoImage] = useState('')
  const [description, setDescription] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [ownership, setOwnership] = useState<Ownership | ''>('')
  const [gameStatus, setGameStatus] = useState<GameStatus>('backlog')
  const [playTime, setPlayTime] = useState('')
  const [hltbHours, setHltbHours] = useState('')
  const [hasDlc, setHasDlc] = useState(false)
  const [dlcList, setDlcList] = useState<DlcEntry[]>([])
  const [hasAddons, setHasAddons] = useState(false)
  const [addonsList, setAddonsList] = useState<DlcEntry[]>([])
  const [isBundle, setIsBundle] = useState(false)
  const [bundleContents, setBundleContents] = useState<BundleGame[]>([])
  const [saveFiles, setSaveFiles] = useState<SaveFile[]>([])
  const [achievementsList, setAchievementsList] = useState<Achievement[]>([])
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [chapterNotes, setChapterNotes] = useState<ChapterNote[]>([])
  const [pcgwPage, setPcgwPage] = useState<string | undefined>(undefined)

  const [releaseYear, setReleaseYear] = useState('')
  const [duration, setDuration] = useState('')
  const [consumed, setConsumed] = useState(false)
  const [artist, setArtist] = useState('')
  const [musicType, setMusicType] = useState<MusicType | ''>('')
  const [genres, setGenres] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [partOfAlbum, setPartOfAlbum] = useState('')
  const [partOfAlbumId, setPartOfAlbumId] = useState('')
  const [hasTracks, setHasTracks] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [singleCovers, setSingleCovers] = useState<SingleCover[]>([])
  const [editions, setEditions] = useState<AlbumEdition[]>([])
  const [unitCount, setUnitCount] = useState('')
  const [mangaAuthors, setMangaAuthors] = useState<string[]>([])
  const [mangaArtists, setMangaArtists] = useState<string[]>([])
  const [volumeCovers, setVolumeCovers] = useState<MangaVolume[]>([])
  const [mangaDescription, setMangaDescription] = useState('')
  const [directors, setDirectors] = useState<string[]>([])
  const [cast, setCast] = useState<string[]>([])
  const [productionCompanies, setProductionCompanies] = useState<string[]>([])
  const [distributors, setDistributors] = useState<string[]>([])
  const [movieDescription, setMovieDescription] = useState('')
  const [studios, setStudios] = useState<string[]>([])
  const [animeFormat, setAnimeFormat] = useState<AnimeFormat | ''>('')
  const [airingStatus, setAiringStatus] = useState<AiringStatus | ''>('')
  const [airingDay, setAiringDay] = useState<Weekday | ''>('')
  const [watchStatus, setWatchStatus] = useState<AnimeStatus>('plan_to_watch')
  const [episodesWatched, setEpisodesWatched] = useState('')
  const [totalEpisodes, setTotalEpisodes] = useState('')
  const [animeDescription, setAnimeDescription] = useState('')
  const [season, setSeason] = useState<AnimeSeason | ''>('')
  const [seasonYear, setSeasonYear] = useState('')
  const [demographic, setDemographic] = useState<Demographic | ''>('')
  const [alternativeTitles, setAlternativeTitles] = useState<string[]>([])
  const [animeSource, setAnimeSource] = useState<AnimeSource | ''>('')
  const [episodeDuration, setEpisodeDuration] = useState('')
  const [airedFrom, setAiredFrom] = useState('')
  const [airedTo, setAiredTo] = useState('')
  const [ageRating, setAgeRating] = useState<AgeRating | ''>('')
  const [favoriteEpisode, setFavoriteEpisode] = useState('')
  const [favoriteEpisodeNote, setFavoriteEpisodeNote] = useState('')
  const [droppedAtEpisode, setDroppedAtEpisode] = useState('')
  const [droppedReason, setDroppedReason] = useState('')
  const [hasEpisodes, setHasEpisodes] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [animeReview, setAnimeReview] = useState('')
  const [rewatches, setRewatches] = useState<RewatchEntry[]>([])
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([])
  const [recommendedItems, setRecommendedItems] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [seriesStatus, setSeriesStatus] = useState<SeriesStatus>('plan_to_watch')
  const [seriesFormat, setSeriesFormat] = useState<SeriesFormat | ''>('')
  const [seriesDescription, setSeriesDescription] = useState('')
  const [showrunners, setShowrunners] = useState<string[]>([])
  const [writers, setWriters] = useState<string[]>([])
  const [network, setNetwork] = useState('')
  const [country, setCountry] = useState('')
  const [language, setLanguage] = useState('')
  const [contentRating, setContentRating] = useState('')
  const [hasSeasons, setHasSeasons] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seriesReview, setSeriesReview] = useState('')
  const [musicSource, setMusicSource] = useState<MusicSource | ''>('')
  const [vinylCondition, setVinylCondition] = useState<VinylCondition | ''>('')
  const [producers, setProducers] = useState<string[]>([])
  const [musicReview, setMusicReview] = useState('')
  const [mangaSource, setMangaSource] = useState<MangaSource | ''>('')
  const [mediaOwnership, setMediaOwnership] = useState<MediaOwnership | ''>('')
  const [discCount, setDiscCount] = useState('')
  const [mangadexId, setMangadexId] = useState('')
  const [magazine, setMagazine] = useState('')
  const [mangaReview, setMangaReview] = useState('')
  const [hasChapters, setHasChapters] = useState(false)
  const [chapters, setChapters] = useState<Chapter[]>([])
  // Books — mirror manga's shape (status, pages read/total, publication status, review)
  const [bookStatus, setBookStatus] = useState<BookStatus>('plan_to_read')
  const [bookFormat, setBookFormat] = useState<BookFormat | ''>('')
  const [bookSource, setBookSource] = useState<BookSource | ''>('')
  const [pagesRead, setPagesRead] = useState('')
  const [totalPages, setTotalPages] = useState('')
  const [publisher, setPublisher] = useState('')
  const [saga, setSaga] = useState('')
  const [sagaIndex, setSagaIndex] = useState('')
  const [isbn, setIsbn] = useState('')
  const [translator, setTranslator] = useState('')
  const [bookReview, setBookReview] = useState('')
  // Visual Novels — VNDB-shaped state
  const [visualNovelStatus, setVisualNovelStatus] = useState<VisualNovelStatus>('plan_to_play')
  const [vnLength, setVnLength] = useState<VnLength | ''>('')
  const [vnLengthHours, setVnLengthHours] = useState('')
  const [vnEngine, setVnEngine] = useState('')
  const [vnOriginalLanguage, setVnOriginalLanguage] = useState('')
  const [vnLanguages, setVnLanguages] = useState<string[]>([])
  const [vnAliases, setVnAliases] = useState<string[]>([])
  const [vnCharacters, setVnCharacters] = useState<VnCharacter[]>([])
  const [vnStaff, setVnStaff] = useState<VnStaffMember[]>([])
  const [vnScreenshots, setVnScreenshots] = useState<VnScreenshot[]>([])
  const [vnCovers, setVnCovers] = useState<VnCover[]>([])
  const [vnEditions, setVnEditions] = useState<VnEdition[]>([])
  const [vnPublishers, setVnPublishers] = useState<VnPublisher[]>([])
  const [vnCommunityRating, setVnCommunityRating] = useState('')
  const [vnDevStatus, setVnDevStatus] = useState<VnDevStatus | ''>('')
  const [vnDescription, setVnDescription] = useState('')
  const [vnReview, setVnReview] = useState('')
  const [vndbId, setVndbId] = useState('')
  const [nsfw, setNsfw] = useState(false)
  const [movieSource, setMovieSource] = useState<MovieSource | ''>('')
  const [movieReview, setMovieReview] = useState('')
  const [gameSource, setGameSource] = useState<GameSource | ''>('')
  const [originalWorkId, setOriginalWorkId] = useState<string>('')
  const [gameReview, setGameReview] = useState('')
  const [franchise, setFranchise] = useState('')
  const [basedOnItemId, setBasedOnItemId] = useState('')
  const [watchedWhere, setWatchedWhere] = useState<WatchLocation | ''>('')
  const [movieBanner, setMovieBanner] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [timesWatched, setTimesWatched] = useState('')
  const movieBannerFileInputRef = useRef<HTMLInputElement>(null)

  const handleMovieBannerFile = pickImageToDataUrl(setMovieBanner)
  const [pubStatus, setPubStatus] = useState<PublicationStatus | ''>('')
  const [readingStatus, setReadingStatus] = useState<MangaStatus>('plan_to_read')
  const [chaptersRead, setChaptersRead] = useState('')
  const [totalChapters, setTotalChapters] = useState('')
  const [volumesRead, setVolumesRead] = useState('')
  const [totalVolumesM, setTotalVolumesM] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startYear, setStartYear] = useState('')
  const [endYear, setEndYear] = useState('')
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    loadFromDisk({ applySettings: true })
  }, [])

  // Reads the split JSON files off disk and hydrates state. Runs once on
  // mount and again whenever the user hits F5, so external edits to the
  // data/ folder (or a snapshot restore) show up without a full app restart.
  const loadFromDisk = async ({ applySettings }: { applySettings: boolean }): Promise<void> => {
    const migrate = async (list: AnyItem[]): Promise<{ list: AnyItem[]; changed: boolean }> => {
      let changed = false
      const persist = async (val: string | undefined, categoryId: string, kind: string, basename?: string): Promise<string | undefined> => {
        if (!val || !val.startsWith('data:')) return val
        const rel = await window.ipcRenderer.invoke('image:save', categoryId, kind, val, basename)
        if (typeof rel === 'string') { changed = true; return rel }
        return val
      }
      const migrated = await Promise.all(list.map(async (it) => {
        const cover = await persist(it.cover, it.categoryId, 'cover', assetBasename(it.title, 'cover'))
        const bannerImage = await persist(it.bannerImage, it.categoryId, 'banner', assetBasename(it.title, 'banner'))
        const bannerImage2 = await persist(it.bannerImage2, it.categoryId, 'banner', assetBasename(it.title, 'banner', 2))
        const logoImage = await persist(it.logoImage, it.categoryId, 'logo', assetBasename(it.title, 'logo'))
        let volumeCovers = it.volumeCovers
        if (volumeCovers && volumeCovers.length > 0) {
          volumeCovers = await Promise.all(volumeCovers.map(async (v) => ({ ...v, cover: (await persist(v.cover, it.categoryId, 'volume', assetBasename(it.title, 'volume', v.number))) ?? v.cover })))
        }
        const anyIt = it as unknown as { devs?: unknown; publisher?: unknown; publishers?: unknown }
        let devs = it.devs
        if (typeof anyIt.devs === 'string') {
          devs = (anyIt.devs as string).split(',').map((s) => s.trim()).filter(Boolean)
          changed = true
        }
        let publishers = it.publishers
        // Legacy pre-0.2 games stored a single `publisher: string`. Split
        // into `publishers: string[]` and strip the legacy field ONLY when
        // we actually did the migration — otherwise Book items (which use
        // publisher as a first-class field) get wiped every load.
        let stripLegacyPublisher = false
        if (!publishers && typeof anyIt.publisher === 'string' && anyIt.publisher && it.categoryId === 'videojuegos') {
          publishers = [(anyIt.publisher as string).trim()].filter(Boolean)
          changed = true
          stripLegacyPublisher = true
        }
        return { ...it, cover, bannerImage, bannerImage2, logoImage, volumeCovers, devs, publishers, ...(stripLegacyPublisher ? { publisher: undefined } : {}) }
      }))
      return { list: migrated, changed }
    }
    const migrateArtists = async (list: MusicArtist[]): Promise<{ list: MusicArtist[]; changed: boolean }> => {
      let changed = false
      const persist = async (val: string | undefined, kind: string, basename?: string): Promise<string | undefined> => {
        if (!val || !val.startsWith('data:')) return val
        const rel = await window.ipcRenderer.invoke('image:save', 'artists', kind, val, basename)
        if (typeof rel === 'string') { changed = true; return rel }
        return val
      }
      const migrated = await Promise.all(list.map(async (a) => ({ ...a, photo: await persist(a.photo, 'photo', assetBasename(a.name, 'photo')), bannerImage: await persist(a.bannerImage, 'photo', assetBasename(a.name, 'banner')) })))
      return { list: migrated, changed }
    }
    const data = await window.ipcRenderer.invoke('data:load') as AppData | null
    let items = data?.items ?? []
    let artists = data?.artists ?? []
    const itemsRes = await migrate(items)
    items = itemsRes.list
    const artistsRes = await migrateArtists(artists)
    artists = artistsRes.list

    // 0.3.6 migration: Music Item.concerts → MusicArtist.concerts. Older
    // versions kept a concerts list on every album/single; now it lives
    // on the artist. Match by exact artist name, create the artist if
    // there is no existing one, and dedupe on (date + venue) so re-runs
    // are idempotent. Item.concerts is cleared once merged.
    {
      const withConcerts = items.filter((i) => i.categoryId === 'musica' && Array.isArray(i.concerts) && i.concerts.length > 0)
      if (withConcerts.length > 0) {
        const byName = new Map<string, MusicArtist>()
        for (const a of artists) byName.set(a.name.trim().toLowerCase(), a)
        for (const it of withConcerts) {
          const key = (it.artist ?? '').trim().toLowerCase()
          if (!key) continue
          let artist = byName.get(key)
          if (!artist) {
            artist = { id: crypto.randomUUID(), name: (it.artist ?? '').trim(), createdAt: Date.now() }
            byName.set(key, artist)
            artists = [...artists, artist]
          }
          const seen = new Set((artist.concerts ?? []).map((c) => `${c.date}|${c.venue.toLowerCase()}`))
          const merged = [...(artist.concerts ?? [])]
          for (const c of it.concerts!) {
            const k = `${c.date}|${c.venue.toLowerCase()}`
            if (seen.has(k)) continue
            seen.add(k)
            merged.push(c)
          }
          artist.concerts = merged.length > 0 ? merged : undefined
        }
        items = items.map((i) => (i.categoryId === 'musica' && i.concerts ? { ...i, concerts: undefined } : i))
      }
    }

    skipHistoryRef.current = true
    setItems(items)
    setCollections(data?.collections ?? [])
    setMusicArtists(artists)
    setArcadeGames(data?.arcadeGames ?? [])
    if (applySettings && data?.settings) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...data.settings,
        gameFields: { ...DEFAULT_GAME_FIELDS, ...data.settings.gameFields },
        musicFields: { ...DEFAULT_MUSIC_FIELDS, ...data.settings.musicFields },
        mangaFields: { ...DEFAULT_MANGA_FIELDS, ...data.settings.mangaFields },
        movieFields: { ...DEFAULT_MOVIE_FIELDS, ...data.settings.movieFields },
        animeFields: { ...DEFAULT_ANIME_FIELDS, ...data.settings.animeFields },
        seriesFields: { ...DEFAULT_SERIES_FIELDS, ...data.settings.seriesFields },
          bookFields: { ...DEFAULT_BOOK_FIELDS, ...data.settings.bookFields },
          vnFields: { ...DEFAULT_VN_FIELDS, ...(data.settings.vnFields ?? {}) },
        enabledCategories: data.settings.enabledCategories && !data.settings.enabledCategories.includes('donghua') && data.settings.enabledCategories.includes('anime')
          ? [...data.settings.enabledCategories, 'donghua']
          : data.settings.enabledCategories,
      }
      setSettings(merged)
      setLayout(merged.defaultLayout)
      // Apply the HTTP proxy setting (if any) to the main-process fetch
      // dispatcher so every metadata / cover / updater request routes
      // through it. Cheap no-op when unset.
      if (merged.httpProxy !== undefined) {
        window.ipcRenderer.invoke('proxy:apply', merged.httpProxy)
      }
      if (merged.startupCategory === 'last' && merged.lastCategory && isCategoryId(merged.lastCategory)) {
        setActiveCategory(merged.lastCategory)
      }
      // Home dashboard takes precedence when the setting is on — sets a
      // specialView instead of choosing a category. First-run only; F5
      // keeps whatever the user was looking at.
      if (applySettings && merged.startupCategory === 'home') {
        setSpecialView('home')
      }
    }
    if (data?.customOrders) setCustomOrders(data.customOrders)
    setLoaded(true)
  }

  useEffect(() => {
    if (!loaded) return
    void (async () => {
      const res = await window.ipcRenderer.invoke('data:save', { items, collections, settings, artists: musicArtists, arcadeGames }) as { ok?: boolean; rewrites?: { from: string; to: string }[] } | boolean
      // Main-process rename step may have renamed some asset files to match
      // titles. Reflect those rewrites in local state so <img src> resolves
      // to the new filename without a full reload.
      const rewrites = (typeof res === 'object' && res?.rewrites) || []
      if (rewrites.length === 0) return
      const map = new Map(rewrites.map((r) => [r.from, r.to]))
      const swap = (v: string | undefined) => (v && map.has(v) ? map.get(v)! : v)
      skipHistoryRef.current = true
      setItems((list) => list.map((it) => {
        const cover = swap(it.cover)
        const bannerImage = swap(it.bannerImage)
        const bannerImage2 = swap(it.bannerImage2)
        const logoImage = swap(it.logoImage)
        const volumeCovers = it.volumeCovers?.map((v) => ({ ...v, cover: swap(v.cover) ?? v.cover }))
        const singleCovers = it.singleCovers?.map((s) => ({ ...s, cover: swap(s.cover) ?? s.cover }))
        const editions = it.editions?.map((e) => ({ ...e, cover: swap(e.cover) ?? e.cover }))
        const bundleContents = it.bundleContents?.map((b) => ({ ...b, cover: swap(b.cover) ?? b.cover }))
        return { ...it, cover, bannerImage, bannerImage2, logoImage, volumeCovers, singleCovers, editions, bundleContents }
      }))
      setMusicArtists((list) => list.map((a) => ({ ...a, photo: swap(a.photo), bannerImage: swap(a.bannerImage) })))
      setCollections((list) => list.map((g) => ({ ...g, cover: swap(g.cover) ?? g.cover })))
      // Also refresh the currently-open editor's field states so the input
      // boxes show the new filename immediately — without this the user
      // would see the old UUID path until they close and reopen the modal.
      setCover((v) => swap(v) ?? v)
      setBannerImage((v) => swap(v) ?? v)
      setLogoImage((v) => swap(v) ?? v)
      setMovieBanner((v) => swap(v) ?? v)
      setArtistPhotoField((v) => swap(v) ?? v)
      setArtistBannerField((v) => swap(v) ?? v)
      setCollectionCoverField((v) => swap(v) ?? v)
      setVolumeCovers((list) => list.map((v) => ({ ...v, cover: swap(v.cover) ?? v.cover })))
      setSingleCovers((list) => list.map((s) => ({ ...s, cover: swap(s.cover) ?? s.cover })))
      setEditions((list) => list.map((e) => ({ ...e, cover: swap(e.cover) ?? e.cover })))
      setBundleContents((list) => list.map((b) => ({ ...b, cover: swap(b.cover) ?? b.cover })))
    })()
  }, [items, collections, settings, musicArtists, arcadeGames, loaded])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const inField = (e.target as HTMLElement | null)?.matches?.('input, textarea, [contenteditable="true"]')
      if (mod && e.key.toLowerCase() === 'f' && subView === 'items' && specialView === 'none') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault()
        undo()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'y' && !inField) {
        e.preventDefault()
        redo()
      } else if (e.key === 'F5' && !inField) {
        e.preventDefault()
        loadFromDisk({ applySettings: false }).then(() => setToast('Library refreshed'))
      } else if (e.key === '?' && !inField && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShortcutsOpen(true)
      } else if (mod && e.key.toLowerCase() === 'h' && !inField) {
        e.preventDefault()
        setSpecialView('home'); closePanel(); closeAllDetailViews()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // closePanel + closeAllDetailViews are stable enough here — including
    // them re-registers the handler on every render since they're not
    // memoized. The effect only reads them, never depends on their identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subView, specialView])

  // Track library mutations and stash them on a bounded history stack.
  // Only fires for real content edits (items/collections/artists), not
  // settings or UI state.
  useEffect(() => {
    if (!loaded) return
    if (skipHistoryRef.current) { skipHistoryRef.current = false; prevSnapRef.current = { items, collections, artists: musicArtists }; return }
    if (prevSnapRef.current) {
      historyRef.current.push(prevSnapRef.current)
      if (historyRef.current.length > 40) historyRef.current.shift()
      redoRef.current = []
    }
    prevSnapRef.current = { items, collections, artists: musicArtists }
  }, [items, collections, musicArtists, loaded])

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) { setToast('Nothing to undo'); return }
    if (prevSnapRef.current) redoRef.current.push(prevSnapRef.current)
    skipHistoryRef.current = true
    setItems(prev.items)
    setCollections(prev.collections)
    setMusicArtists(prev.artists)
    setToast('Undone')
  }
  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) { setToast('Nothing to redo'); return }
    if (prevSnapRef.current) historyRef.current.push(prevSnapRef.current)
    skipHistoryRef.current = true
    setItems(next.items)
    setCollections(next.collections)
    setMusicArtists(next.artists)
    setToast('Redone')
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (alertMsg) setAlertMsg(null)
      else if (confirmState) setConfirmState(null)
      else if (artistPanelOpen) closeArtistPanel()
      else if (panelOpen) closePanel()
      else if (viewing) setViewing(null)
      else if (viewingArtist) setViewingArtist(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // closePanel / closeArtistPanel change on every render but that would
    // cause the listener to rebind constantly; the closure captures the
    // latest versions each time this effect re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertMsg, confirmState, viewing, viewingArtist, artistPanelOpen, panelOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // Tabbed-editor visibility. Walks the form container, groups each
  // `.form-section-header` with its following siblings until the next
  // header, and toggles a `.editor-hidden` class on every node in a group
  // whose assigned tab (data-belongs-to on the header) doesn't match the
  // active tab. Sections without an assigned tab default to 'notes' so
  // nothing is lost silently.
  //
  // A MutationObserver watches childList changes on the form so nodes that
  // mount post-render — a fetcher applying metadata that populates a
  // previously-empty section, editions/tracks appearing, etc. — get the
  // class applied immediately, instead of bleeding into the current tab
  // until the user switches tabs and back. `attributes` is intentionally
  // NOT observed, so toggling .editor-hidden ourselves doesn't self-trigger.
  useEffect(() => {
    if (!panelOpen) return
    const root = document.querySelector<HTMLElement>('.form[data-editor-tab]')
    if (!root) return
    const apply = () => {
      const headers = Array.from(root.querySelectorAll<HTMLElement>('.form-section-header'))
      if (headers.length === 0) return
      const firstHeader = headers[0]
      // Section 0 is everything before the first header (fetch-metadata
      // panel + basic-info block). Keep it visible in overview only.
      let node: ChildNode | null = root.firstChild
      while (node && node !== firstHeader) {
        if (node instanceof HTMLElement) node.classList.toggle('editor-hidden', editorTab !== 'overview')
        node = node.nextSibling
      }
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i]
        const belongsTo = h.getAttribute('data-belongs-to') ?? 'notes'
        const show = belongsTo === editorTab
        const next = headers[i + 1]
        let cur: ChildNode | null = h
        while (cur && cur !== next) {
          if (cur instanceof HTMLElement) cur.classList.toggle('editor-hidden', !show)
          cur = cur.nextSibling
        }
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [editorTab, panelOpen, editingId, activeCategory])

  // Fetchers dispatch this event via downloadImageAsset when image:download
  // returns { ok: false, error }. Surfacing the reason is the whole point —
  // before this, a bad TMDb URL / rate-limit / CDN blip left the item with
  // no cover and the user had no idea why.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: string; error: string }>).detail
      setToast(`Cover download failed — ${detail?.error ?? 'unknown'}. Try another asset.`)
    }
    window.addEventListener('omnio-image-download-error', h)
    return () => window.removeEventListener('omnio-image-download-error', h)
  }, [])

  // Scheduled auto-backup driver. Checks every hour while the app is
  // running and fires storage:copy-data-to if:
  //   * the interval is not 'off'
  //   * a destination folder is configured
  //   * enough time has passed since the last auto-backup for the picked
  //     cadence (daily = 24h, weekly = 7*24h)
  // Silent on success (writes autoBackupLastAt back to settings), toasts
  // on failure. The hourly cadence means users don't wait > 1h to see
  // the first backup after setting up.
  useEffect(() => {
    const interval = settings.autoBackupInterval ?? 'off'
    const target = settings.autoBackupTarget
    if (interval === 'off' || !target) return
    const gapMs = interval === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    const check = async () => {
      const last = settings.autoBackupLastAt ?? 0
      if (Date.now() - last < gapMs) return
      const r = await window.ipcRenderer.invoke('storage:copy-data-to', target) as { ok: boolean; error?: string; files?: number; path?: string }
      if (r?.ok) setSettings((s) => ({ ...s, autoBackupLastAt: Date.now() }))
      else setToast(`Auto-backup failed: ${r?.error ?? 'unknown'}`)
    }
    // Fire once on mount (short delay to let the initial data:load finish)
    // and then hourly.
    const first = setTimeout(check, 20_000)
    const hourly = setInterval(check, 60 * 60 * 1000)
    return () => { clearTimeout(first); clearInterval(hourly) }
  }, [settings.autoBackupInterval, settings.autoBackupTarget, settings.autoBackupLastAt])

  // Generic toast bus — any component (detail modals, editors) can dispatch
  // `omnio-toast` with a string in event.detail and it shows in the toast bar.
  // Used by exportItemAsJson and anywhere else that needs a fire-and-forget
  // status message without threading setToast through as a prop.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (detail) setToast(detail)
    }
    window.addEventListener('omnio-toast', h)
    return () => window.removeEventListener('omnio-toast', h)
  }, [])

  // Global click-to-zoom: any <img class="zoomable"> anywhere opens a
  // full-screen lightbox. When multiple `.zoomable` images share a
  // `data-zoom-group` value (e.g. a covers gallery), the arrow-key
  // navigation walks between them; otherwise it's a single-image view.
  // Registered on document instead of per-modal so wiring a new cover /
  // banner / logo only takes adding the class.
  const [zoomState, setZoomState] = useState<{ images: { src: string; label?: string; caption?: string }[]; index: number } | null>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || target.tagName !== 'IMG') return
      const img = target as HTMLImageElement
      if (!img.classList.contains('zoomable')) return
      // Never intercept clicks that already have a specific handler on
      // the image itself (existing lightbox owners inside GameDetail /
      // MangaDetail have their own onClick and this global one would
      // fire in addition, opening two views).
      if (img.dataset.zoomHandled === '1') return
      e.preventDefault()
      e.stopPropagation()
      const group = img.dataset.zoomGroup
      let siblings: HTMLImageElement[] = [img]
      if (group) {
        siblings = Array.from(document.querySelectorAll<HTMLImageElement>(`img.zoomable[data-zoom-group="${CSS.escape(group)}"]`))
      }
      const startIndex = Math.max(0, siblings.indexOf(img))
      const images = siblings.map((s) => ({
        // The `src` attribute is already the fully resolved URL (Tauri's
        // asset:// via convertFileSrc, or a plain http URL). ImageLightbox
        // re-runs assetSrc on its input which is a no-op for those forms
        // — safe to pass along.
        src: s.currentSrc || s.src,
        label: s.dataset.zoomLabel,
        caption: s.dataset.zoomCaption || s.alt || undefined,
      }))
      setZoomState({ images, index: startIndex })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const handlePlayTimeChange = (v: string) => { if (/^\d*\.?\d{0,2}$/.test(v)) setPlayTime(v) }
  const intHandler = (setter: (v: string) => void) => (v: string) => { if (/^\d*$/.test(v)) setter(v) }
  const yearHandler = (setter: (v: string) => void) => (v: string) => { if (/^\d{0,4}$/.test(v)) setter(v) }

  const handleUnitCountChange = (v: string) => {
    if (!/^\d*$/.test(v)) return
    setUnitCount(v)
    const n = parseInt(v || '0', 10)
    setUnits((prev) => {
      const arr: Unit[] = []
      for (let i = 1; i <= n; i++) {
        const existing = prev.find((u) => u.number === i)
        arr.push({ number: i, watched: existing?.watched ?? false })
      }
      return arr
    })
  }

  const current = CATEGORIES.find((c) => c.id === activeCategory)
  const itemsInCategory = items.filter((i) => i.categoryId === activeCategory)
  const isVideojuegos = activeCategory === 'videojuegos'
  const isSeriesLike = activeCategory === 'series'
  const isAnime = isAnimeLikeCategory(activeCategory)
  const isManga = isMangaLike(activeCategory)
  const categoryCollections = collections.filter((c) => c.categoryId === activeCategory)
  const activeCollection = collections.find((c) => c.id === activeCollectionId) || null
  const gamesList = items.filter((i) => i.categoryId === 'videojuegos')
  const musicList = items.filter((i) => i.categoryId === 'musica')

  const scopedItems = subView === 'groups' && activeCollection
    ? (activeCollection.itemIds.map((id) => itemsInCategory.find((i) => i.id === id)).filter(Boolean) as Item[])
    : itemsInCategory

  const showFolderListing = subView === 'groups' && !activeCollectionId
  const showStatusFilter = isVideojuegos
  const availableTags = getUniqueTags(scopedItems)
  const availablePlatforms = Array.from(new Set(scopedItems.flatMap((i) => i.platforms || [])))
  const availableGenres = Array.from(new Set(scopedItems.flatMap((i) => i.genres || []))).sort()
  // Inside a collection, `custom` order reads the collection's own itemIds
  // list; outside, it reads the per-category custom order map. Wrapped in
  // its own useMemo so the visibleItems memo below has a stable array
  // reference between renders (ESLint exhaustive-deps was flagging it).
  const effectiveCustomOrder = useMemo(
    () => activeCollection ? activeCollection.itemIds : (customOrders[activeCategory] || []),
    [activeCollection, customOrders, activeCategory],
  )
  const visibleItems = useMemo(
    () => filterAndSort(scopedItems, search, filterTags, filterStatus, filterPlatforms, filterGenres, sortBy, effectiveCustomOrder, minRating, settings.tagTree),
    [scopedItems, search, filterTags, filterStatus, filterPlatforms, filterGenres, sortBy, effectiveCustomOrder, minRating, settings.tagTree],
  )

  const editingItem = items.find((i) => i.id === editingId) || null

  // Memoized once for every RelatedListEditor's cross-library allItems prop —
  // otherwise each render passed a fresh array literal to N sites and cascaded
  // child re-renders through the picker.
  const relatedCrossLibraryOptions = useMemo(
    () => items.filter((i) => i.id !== editingId),
    [items, editingId],
  )

  // Setter bag reused by resetForm / loadItemIntoForm. All entries are
  // React setters from useState calls above, which are stable across
  // renders — so this object doesn't need memoization for identity, but
  // wrapping in useMemo avoids re-building the (large) literal each
  // render and makes it easy to spot new setters missing from either
  // helper below.
  const formSetters: FormSetters = useMemo(() => ({
    setActiveCategory, setEditingId,
    setTitle, setCover, setNotes, setTags, setRating, setFinishedAt, setCustomFields,
    setDevs, setPublishers, setAchievementsUnlocked, setAchievementsTotal, setReleaseDate, setBannerImage, setLogoImage, setDescription,
    setPlatforms, setOwnership, setGameStatus, setPlayTime,
    setHasDlc, setDlcList, setHasAddons, setAddonsList, setIsBundle, setBundleContents, setSaveFiles, setAchievementsList, setScreenshots, setChapterNotes, setPcgwPage,
    setGameSource, setOriginalWorkId, setGameReview, setHasSpoilers, setFranchise,
    setReleaseYear, setDuration, setConsumed, setArtist, setMusicType, setGenres, setLabel, setPartOfAlbum, setPartOfAlbumId, setHasTracks, setTracks, setSingleCovers, setEditions,
    setMusicSource, setVinylCondition, setProducers, setMusicReview,
    setMangaAuthors, setMangaArtists, setVolumeCovers, setMangaDescription, setPubStatus, setReadingStatus, setChaptersRead, setTotalChapters, setVolumesRead, setTotalVolumesM, setStartDate,
    setMangaSource, setMagazine, setMangaReview, setHasChapters, setChapters, setMediaOwnership, setDiscCount, setMangadexId,
    setStudios, setAnimeFormat, setAiringStatus, setAiringDay, setWatchStatus, setEpisodesWatched, setTotalEpisodes, setAnimeDescription,
    setSeason, setSeasonYear, setDemographic, setAlternativeTitles, setAnimeSource, setEpisodeDuration, setAiredFrom, setAiredTo, setAgeRating,
    setFavoriteEpisode, setFavoriteEpisodeNote, setDroppedAtEpisode, setDroppedReason, setHasEpisodes, setEpisodes, setAnimeReview, setRewatches, setRelatedItems, setRecommendedItems,
    setSeriesStatus, setSeriesFormat, setSeriesDescription, setShowrunners, setWriters, setNetwork, setCountry, setLanguage, setContentRating, setHasSeasons, setSeasons, setSeriesReview,
    setUnitCount, setStartYear, setEndYear, setUnits,
    setDirectors, setCast, setProductionCompanies, setDistributors, setMovieDescription, setMovieSource, setMovieReview, setWatchedWhere, setMovieBanner, setTimesWatched,
    setBookStatus, setBookFormat, setBookSource, setPagesRead, setTotalPages, setPublisher, setSaga, setSagaIndex, setIsbn, setTranslator, setBookReview,
    setVisualNovelStatus, setVnLength, setVnLengthHours, setVnEngine, setVnOriginalLanguage, setVnLanguages, setVnAliases, setVnCharacters, setVnStaff, setVnScreenshots, setVnCovers, setVnEditions, setVnPublishers, setVnCommunityRating, setVnDevStatus, setVnDescription, setVnReview, setVndbId, setNsfw,
  }), [])

  const resetForm = () => resetFormImpl(formSetters)

  const resetListControls = () => { setSearch(''); setFilterTags([]); setFilterStatus([]); setFilterPlatforms([]); setFilterGenres([]) }

  const handleAddArtist = () => {
    if (!newArtistName.trim()) return
    setMusicArtists((prev) => [...prev, { id: crypto.randomUUID(), name: newArtistName.trim(), createdAt: Date.now() }])
    setNewArtistName('')
  }

  const handleDeleteArtist = (id: string) => {
    askConfirm('Delete this artist? Your songs/albums stay, only the artist entry is removed.', () => {
      const artist = musicArtists.find((a) => a.id === id)
      if (artist) {
        deleteAssetFile(artist.photo)
        deleteAssetFile(artist.bannerImage)
      }
      setMusicArtists((prev) => prev.filter((a) => a.id !== id))
      if (viewingArtist?.id === id) setViewingArtist(null)
    })
  }

  const openArtistEditPanel = (a: MusicArtist) => {
    setEditingArtistId(a.id)
    setArtistNameField(a.name)
    setArtistPhotoField(a.photo ?? '')
    setArtistBannerField(a.bannerImage ?? '')
    setArtistOrigin(a.origin ?? '')
    setArtistBandStatus(a.bandStatus ?? '')
    setArtistGenres(a.genres ?? [])
    setArtistActiveFrom(a.activeFrom ?? '')
    setArtistActiveTo(a.activeTo ?? '')
    setArtistLabels(a.labels ?? [])
    setArtistMembers(a.members ?? [])
    setArtistConcerts(a.concerts ?? [])
    setArtistEditorTab('overview')
    setArtistPanelOpen(true)
  }

  const closeArtistPanel = () => {
    setArtistPanelOpen(false)
    setEditingArtistId(null)
  }

  const handleArtistPhotoFile  = pickImageToDataUrl(setArtistPhotoField)
  const handleArtistBannerFile = pickImageToDataUrl(setArtistBannerField)

  const handleSaveArtistEdit = async () => {
    if (!artistNameField.trim() || !editingArtistId) return
    const persistArtistImg = async (val: string, kind: 'photo' | 'banner'): Promise<string | undefined> => {
      const trimmed = val.trim()
      if (!trimmed) return undefined
      if (!trimmed.startsWith('data:')) return trimmed
      const rel = await window.ipcRenderer.invoke('image:save', 'artists', 'photo', trimmed, assetBasename(artistNameField.trim(), kind))
      return typeof rel === 'string' ? rel : trimmed
    }
    const photo = await persistArtistImg(artistPhotoField, 'photo')
    const bannerImage = await persistArtistImg(artistBannerField, 'banner')
    const cleanMembers = artistMembers
      .filter((m) => m.name.trim())
      .map((m) => ({ ...m, name: m.name.trim(), roles: m.roles.filter((r) => r.trim()) }))
    const updated: Partial<MusicArtist> = {
      name: artistNameField.trim(), photo, bannerImage,
      origin: artistOrigin.trim() || undefined,
      bandStatus: artistBandStatus || undefined,
      genres: artistGenres.length > 0 ? artistGenres : undefined,
      activeFrom: artistActiveFrom.trim() || undefined,
      activeTo: artistActiveTo.trim() || undefined,
      labels: artistLabels.length > 0 ? artistLabels : undefined,
      members: cleanMembers.length > 0 ? cleanMembers : undefined,
      concerts: artistConcerts.length > 0 ? artistConcerts : undefined,
    }
    // Delete replaced/cleared image files.
    const oldArtist = musicArtists.find((a) => a.id === editingArtistId)
    if (oldArtist) {
      if (isLocalAssetPath(oldArtist.photo) && oldArtist.photo !== photo) deleteAssetFile(oldArtist.photo)
      if (isLocalAssetPath(oldArtist.bannerImage) && oldArtist.bannerImage !== bannerImage) deleteAssetFile(oldArtist.bannerImage)
    }
    setMusicArtists((prev) => prev.map((a) => (a.id === editingArtistId ? { ...a, ...updated } : a)))
    if (viewingArtist && viewingArtist.id === editingArtistId) setViewingArtist({ ...viewingArtist, ...updated })
    closeArtistPanel()
  }

  const closeAllDetailViews = () => {
    setViewing(null); setViewingArtist(null)
  }

  const switchCategory = (id: CategoryId) => {
    // Restore the sort the user last picked in this category (if the
    // "remember sort" setting is on) so their preferred view stays put
    // between visits. Falls back to 'recent' for first-time entries.
    const nextSort = settings.rememberCategorySort
      ? ((settings.categorySortModes?.[id] as SortBy | undefined) ?? 'recent')
      : 'recent'
    setActiveCategory(id); setSpecialView('none'); setSubView('items'); setActiveCollectionId(null); resetListControls(); setSortBy(nextSort); closePanel()
    closeAllDetailViews()
    setSettings((s) => ({ ...s, lastCategory: id }))
  }

  // Wrap setSortBy so every UI-driven change also persists to settings for
  // the currently-active category. Non-UI callers (like the "custom" reset
  // when opening a collection) go straight to setSortBy and are excluded.
  const setSortByPersistent = (v: SortBy) => {
    setSortBy(v)
    if (settings.rememberCategorySort && activeCategory) {
      setSettings((s) => ({ ...s, categorySortModes: { ...(s.categorySortModes ?? {}), [activeCategory]: v } }))
    }
  }

  const applyItemTemplate = (t: ItemTemplate | undefined) => {
    if (!t) return
    if (t.gameStatus !== undefined) setGameStatus(t.gameStatus)
    if (t.watchStatus !== undefined) setWatchStatus(t.watchStatus)
    if (t.seriesStatus !== undefined) setSeriesStatus(t.seriesStatus)
    if (t.mangaStatus !== undefined) setReadingStatus(t.mangaStatus)
    if (t.bookStatus !== undefined) setBookStatus(t.bookStatus)
    if (t.visualNovelStatus !== undefined) setVisualNovelStatus(t.visualNovelStatus)
    if (t.consumed !== undefined) setConsumed(t.consumed)
    if (t.ownership !== undefined) setOwnership(t.ownership)
    if (t.gameSource !== undefined) setGameSource(t.gameSource)
    if (t.tags !== undefined) setTags(t.tags)
    if (t.platforms !== undefined) setPlatforms(t.platforms)
  }

  const captureCurrentTemplate = (): ItemTemplate => {
    // Only categories that use each field see it back. `undefined` here
    // means "don't override". Empty arrays / '' are still meaningful (a
    // template of "no platforms" is a valid template).
    const t: ItemTemplate = {}
    if (activeCategory === 'videojuegos') {
      t.gameStatus = gameStatus
      t.ownership = ownership
      t.gameSource = gameSource
      t.platforms = platforms
    } else if (activeCategory === 'anime' || activeCategory === 'donghua') {
      t.watchStatus = watchStatus
    } else if (activeCategory === 'series') {
      t.seriesStatus = seriesStatus
    } else if (isMangaLike(activeCategory)) {
      t.mangaStatus = readingStatus
    } else if (activeCategory === 'libros') {
      t.bookStatus = bookStatus
    } else if (activeCategory === 'visual_novels') {
      t.visualNovelStatus = visualNovelStatus
    } else if (activeCategory === 'musica' || activeCategory === 'peliculas') {
      t.consumed = consumed
    }
    t.tags = tags
    return t
  }

  const openAddPanel = () => {
    setEditingId(null); resetForm(); setHltbHours(''); setBasedOnItemId('')
    // Apply the per-category template AFTER resetForm so template
    // slots override the reset defaults. Editing an existing item
    // never triggers this path — templates are for brand-new items only.
    applyItemTemplate(settings.itemTemplates?.[activeCategory])
    setPanelOpen(true)
  }

  const loadItemIntoForm = (item: AnyItem) => {
    loadItemIntoFormImpl(formSetters, item)
    // Extra fields not covered by the auto-generated FormSetters bag.
    // Adding them there would ripple through every form-related type;
    // wire them inline instead.
    const hltb = (item as { hltbHours?: number }).hltbHours
    setHltbHours(hltb !== undefined ? String(hltb) : '')
    setBasedOnItemId((item as { basedOnItemId?: string }).basedOnItemId ?? '')
  }

  // When every detail view closes and the list JSX remounts, restore the
  // scroll position we snapshotted before opening the detail. Uses rAF so it
  // runs after the DOM has painted the list at scrollTop 0.
  useEffect(() => {
    const anyOpen = viewing || viewingArtist
    if (anyOpen) return
    if (savedScrollRef.current <= 0) return
    const target = savedScrollRef.current
    let cancelled = false
    requestAnimationFrame(() => {
      if (cancelled) return
      const el = document.querySelector('main.content .content-scroll') as HTMLElement | null
      if (el) el.scrollTop = target
    })
    return () => { cancelled = true }
  }, [viewing, viewingArtist])

  const openEditPanel = (item: AnyItem) => {
    // Snapshot the list's scroll position so we can put the user back where
    // they were after they close the detail view.
    const el = document.querySelector('main.content .content-scroll') as HTMLElement | null
    savedScrollRef.current = el?.scrollTop ?? 0
    // Every category with a dedicated detail modal is handled by the
    // DetailModalRouter (see components/DetailModalRouter.tsx). Items
    // that don't have a modal fall through to the editor panel.
    const HAS_DETAIL_MODAL = new Set([
      'videojuegos', 'musica', 'libros', 'visual_novels', 'peliculas', 'series',
    ])
    if (HAS_DETAIL_MODAL.has(item.categoryId) || isMangaLike(item.categoryId) || isAnimeLikeCategory(item.categoryId)) {
      setViewing(item)
      return
    }
    loadItemIntoForm(item)
    setPanelOpen(true)
  }

  // Global search / cross-category open: switches category first so the
  // sidebar reflects where the item lives, then hands off to the normal
  // detail-modal flow. Also closes any open modals so we land clean.
  const navigateToItem = (item: AnyItem) => {
    setViewing(null); setViewingArtist(null)
    setActiveCategory(item.categoryId)
    setActiveCollectionId(null)
    setSpecialView('none')
    setSubView('items')
    setTimeout(() => openEditPanel(item), 0)
  }

  const navigateToArtist = (a: MusicArtist) => {
    setViewing(null)
    setActiveCategory('musica')
    setSubView('items')
    setSpecialView('none')
    setViewingArtist(a)
  }

  // === Bulk selection ===
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const applyToSelected = (updater: (item: AnyItem) => Partial<AnyItem>) => {
    setItems((all) => all.map((it) => selectedIds.has(it.id) ? { ...it, ...updater(it) } : it))
  }
  const bulkAddTag = (op: 'add' | 'remove', tag: string) => {
    setItems((all) => all.map((it) => {
      if (!selectedIds.has(it.id)) return it
      const cur = new Set(it.tags ?? [])
      if (op === 'add') cur.add(tag)
      else cur.delete(tag)
      const arr = Array.from(cur)
      return { ...it, tags: arr.length ? arr : undefined }
    }))
    setToast(op === 'add' ? `Tag "${tag}" added to ${selectedIds.size} items` : `Tag "${tag}" removed from ${selectedIds.size} items`)
  }
  const bulkAddToGroup = (collectionId: string) => {
    setCollections((all) => all.map((c) => {
      if (c.id !== collectionId) return c
      const merged = Array.from(new Set([...c.itemIds, ...Array.from(selectedIds)]))
      return { ...c, itemIds: merged }
    }))
    setToast(`Added ${selectedIds.size} items to group`)
  }
  const bulkMoveToLibrary = (targetCategoryId: CategoryId) => {
    const targetLabel = CATEGORIES.find((c) => c.id === targetCategoryId)?.label ?? targetCategoryId
    const count = selectedIds.size
    askConfirm(
      `Move ${count} item${count === 1 ? '' : 's'} to ${targetLabel}? Category-specific fields (like game platforms or manga chapters) stay on the item so nothing is lost if you move it back later — they just stop showing until then.`,
      () => {
        const ids = new Set(selectedIds)
        setItems((all) => all.map((it) => ids.has(it.id) ? { ...it, categoryId: targetCategoryId } : it))
        // Group memberships stay bound to the source category, so remove
        // moved items from any group whose categoryId no longer matches.
        setCollections((all) => all.map((c) => c.categoryId === targetCategoryId ? c : { ...c, itemIds: c.itemIds.filter((id) => !ids.has(id)) }))
        clearSelection()
        setToast(`Moved ${count} item${count === 1 ? '' : 's'} to ${targetLabel}`)
      },
    )
  }
  const bulkDelete = () => {
    askConfirm(
      `Delete ${selectedIds.size} items? This cannot be undone. Group memberships and related-item links will be cleaned up automatically.`,
      () => {
        const ids = new Set(selectedIds)
        setItems((all) => all.filter((it) => !ids.has(it.id)))
        setCollections((all) => all.map((c) => ({ ...c, itemIds: c.itemIds.filter((id) => !ids.has(id)) })))
        clearSelection()
        setToast(`Deleted ${ids.size} items`)
      },
    )
  }

  // Merge a fetched Partial<Item> patch into the currently-open editor form.
  // Handles the union of AniList / Jikan / TMDb output — each source only
  // populates the fields it knows about, and we just set what's present.
  const applyFetchedPatch = (
    patch: Partial<AnyItem>,
    coverPath?: string,
    bannerPath?: string,
    sourceLabel = 'Metadata',
    hints?: { parentGameTitle?: string; vnRelations?: { vndbId: string; relation: string; title: string }[] },
  ) => {
    // Apply every pure per-field routing through the field-map table
    // (see src/editor/applyPatch.ts). What remains here is the handful
    // of side effects that need renderer-only state — items lookup,
    // editingItem for stale-asset cleanup, and setToast.
    applyPatchFieldsToForm(patch, formSetters, { activeCategory })

    // If IGDB reported a parent game, look for it in the user's library and
    // pre-fill originalWorkId when a case-insensitive title matches. Saves
    // the user from picking it manually for remakes/expansions/ports.
    if (hints?.parentGameTitle && activeCategory === 'videojuegos') {
      const t = hints.parentGameTitle.toLowerCase().trim()
      const parent = items.find((i) => i.categoryId === 'videojuegos' && i.id !== editingId && i.title.toLowerCase().trim() === t)
      if (parent) setOriginalWorkId(parent.id)
    }
    // Sibling-count sidebar for the toast — needs `items`, so it stays here.
    let franchiseSiblingCount = 0
    if (patch.franchise && activeCategory === 'videojuegos') {
      franchiseSiblingCount = items.filter((i) => i.categoryId === 'videojuegos' && i.franchise === patch.franchise && i.id !== editingId).length
    }

    // Resolve VNDB relation slugs against the user's own library — a
    // slug that matches an existing item's `vndbId` becomes a proper
    // RelatedItem entry. Uses the same relation vocabulary as VNDB
    // (sequel/prequel/side/…) collapsed to what RelationKind accepts.
    if (hints?.vnRelations && activeCategory === 'visual_novels') {
      const mapRel = (r: string): RelatedItem['relation'] => {
        const t = r.toLowerCase()
        if (t === 'seq' || t === 'sequel') return 'sequel'
        if (t === 'preq' || t === 'prequel') return 'prequel'
        if (t === 'side' || t === 'ser' || t === 'side_story') return 'side_story'
        if (t === 'alt' || t === 'alternative') return 'alt_version'
        if (t === 'char' || t === 'shares') return 'same_universe'
        if (t === 'fan' || t === 'orig') return 'other'
        return 'other'
      }
      const resolved: RelatedItem[] = []
      for (const hint of hints.vnRelations) {
        const match = items.find((i) => i.vndbId === hint.vndbId && i.id !== editingId)
        if (match) resolved.push({ itemId: match.id, relation: mapRel(hint.relation) })
      }
      if (resolved.length > 0) {
        setRelatedItems((prev) => {
          const seen = new Set(prev.map((r) => r.itemId))
          return [...prev, ...resolved.filter((r) => !seen.has(r.itemId))]
        })
      }
    }
    if (coverPath) {
      // If the editor already had a fetched cover pending save from an
      // earlier apply, delete that file — otherwise every re-fetch during
      // the same edit session accumulates orphaned assets on disk.
      const savedCover = editingItem?.cover
      if (isLocalAssetPath(cover) && cover !== savedCover && cover !== coverPath) {
        window.ipcRenderer.invoke('image:delete', cover)
      }
      setCover(coverPath)
    }
    if (bannerPath) {
      const savedBanner = editingItem?.bannerImage
      if (isLocalAssetPath(bannerImage) && bannerImage !== savedBanner && bannerImage !== bannerPath) {
        window.ipcRenderer.invoke('image:delete', bannerImage)
      }
      setBannerImage(bannerPath)
    }
    const franchiseNote = franchiseSiblingCount > 0
      ? ` · joins ${franchiseSiblingCount} other ${franchiseSiblingCount === 1 ? 'game' : 'games'} in "${patch.franchise}"`
      : ''
    setToast(`${sourceLabel} data applied${franchiseNote}`)
  }

  // Single opener for every detail modal — was eight near-identical
  // per-category functions before Fase 2.2 collapsed the viewing
  // state.
  const openEditFromModal = () => {
    if (!viewing) return
    loadItemIntoForm(viewing)
    setPanelOpen(true)
  }

  const closePanel = ({ afterSave = false }: { afterSave?: boolean } = {}) => {
    // If the user fetched artwork during this edit session but never saved,
    // the file lives on disk but isn't referenced by any item. Compare the
    // current form state against the persisted item and unlink any transient
    // assets before closing.
    //
    // afterSave=true skips this entirely: handleSave already ran
    // findOrphanedItemAssets against the just-persisted item, and the current
    // form state IS the saved state. If we ran the cleanup here we'd read a
    // stale editingItem (React hasn't propagated the setItems yet) and
    // delete files that were just saved — the exact "artwork downloaded,
    // then 404" bug.
    if (!afterSave && editingId && editingItem) {
      const orphanCandidates: (string | undefined)[] = [
        cover !== editingItem.cover ? cover : undefined,
        bannerImage !== editingItem.bannerImage ? bannerImage : undefined,
        logoImage !== editingItem.logoImage ? logoImage : undefined,
        movieBanner !== editingItem.bannerImage2 ? movieBanner : undefined,
      ]
      const savedBundleCovers = new Set((editingItem.bundleContents ?? []).map((b) => b.cover).filter(Boolean) as string[])
      for (const b of bundleContents) {
        if (b.cover && !savedBundleCovers.has(b.cover)) orphanCandidates.push(b.cover)
      }
      for (const c of orphanCandidates) {
        if (isLocalAssetPath(c)) window.ipcRenderer.invoke('image:delete', c)
      }
    } else if (!afterSave && !editingId) {
      // "Add" mode + cancel: nothing was ever persisted, so every asset in
      // the form is transient and safe to remove. When afterSave=true the
      // item just got saved so its assets are legitimately referenced now.
      for (const c of [cover, bannerImage, logoImage, movieBanner]) {
        if (isLocalAssetPath(c)) window.ipcRenderer.invoke('image:delete', c)
      }
      for (const b of bundleContents) {
        if (isLocalAssetPath(b.cover)) window.ipcRenderer.invoke('image:delete', b.cover)
      }
    }
    setPanelOpen(false); setEditingId(null); resetForm()
  }

  // Rebuilds only when any field the preview reads actually changes, so
  // typing a description doesn't rebuild the object 20 times per second.
  const previewItem = useMemo<Item>(() => ({
    id: editingId || 'preview',
    categoryId: activeCategory,
    title: title || 'Untitled',
    cover,
    notes: description,
    tags,
    rating: rating || undefined,
    createdAt: editingItem?.createdAt || Date.now(),
    gameStatus: gameStatus || undefined,
    playTime: playTime || undefined,
    hltbHours: hltbHours ? Number(hltbHours) : undefined,
    devs: devs.length > 0 ? devs : undefined,
    publishers: publishers.length > 0 ? publishers : undefined,
    platforms: platforms.length > 0 ? platforms : undefined,
    genres: genres.length > 0 ? genres : undefined,
    bannerImage: bannerImage || undefined,
    logoImage: logoImage || undefined,
    artist: artist || undefined,
    musicType: musicType || undefined,
    releaseYear: releaseYear || undefined,
    releaseDate: releaseDate || undefined,
    consumed: consumed || undefined,
    mangaStatus: readingStatus || undefined,
    chaptersRead: chaptersRead || undefined,
    chaptersTotal: totalChapters || undefined,
    watchStatus: watchStatus || undefined,
    episodesWatched: episodesWatched || undefined,
    episodesTotal: totalEpisodes || undefined,
    seriesStatus: seriesStatus || undefined,
  } as Item), [
    editingId, editingItem, activeCategory, title, cover, description, tags, rating,
    gameStatus, playTime, hltbHours, devs, publishers, platforms, genres, bannerImage, logoImage,
    artist, musicType, releaseYear, releaseDate, consumed, readingStatus,
    chaptersRead, totalChapters, watchStatus, episodesWatched, totalEpisodes, seriesStatus,
  ])

  const handleCoverFile  = pickImageToDataUrl(setCover)
  const handleBannerFile = pickImageToDataUrl(setBannerImage)
  const handleLogoFile   = pickImageToDataUrl(setLogoImage)

  const buildItemFromForm = (id: string, createdAt: number): AnyItem => buildItemFromFormImpl(id, createdAt, {
    activeCategory,
    title, cover, notes, tags, rating, finishedAt, customFields,
    devs, publishers, achievementsUnlocked, achievementsTotal, releaseDate,
    bannerImage, logoImage, description, platforms, ownership, gameStatus,
    playTime, hasDlc, dlcList, hasAddons, addonsList, isBundle, bundleContents,
    saveFiles, achievementsList, screenshots, pcgwPage, gameSource,
    originalWorkId, gameReview, hasSpoilers, franchise,
    releaseYear, duration, consumed, artist, musicType, genres, label,
    partOfAlbum, partOfAlbumId, hasTracks, tracks, singleCovers, editions,
    musicSource, vinylCondition, producers, musicReview,
    mangaAuthors, mangaArtists, volumeCovers, mangaDescription, pubStatus,
    readingStatus, chaptersRead, totalChapters, volumesRead, totalVolumesM,
    startDate, mangaSource, magazine, mangaReview, hasChapters, chapters,
    mediaOwnership, discCount, mangadexId,
    studios, animeFormat, airingStatus, airingDay, watchStatus,
    episodesWatched, totalEpisodes, animeDescription, season, seasonYear,
    demographic, alternativeTitles, animeSource, episodeDuration, airedFrom,
    airedTo, ageRating, favoriteEpisode, favoriteEpisodeNote, droppedAtEpisode,
    droppedReason, hasEpisodes, episodes, animeReview,
    rewatches, relatedItems, recommendedItems,
    seriesStatus, seriesFormat, seriesDescription, showrunners, writers,
    network, country, language, contentRating, hasSeasons, seasons,
    seriesReview, unitCount, startYear, endYear, units,
    directors, cast, productionCompanies, distributors, movieDescription,
    movieSource, movieReview, watchedWhere, movieBanner, timesWatched,
    bookStatus, bookFormat, bookSource, pagesRead, totalPages, publisher,
    saga, sagaIndex, isbn, translator, bookReview, chapterNotes,
    visualNovelStatus, vnLength, vnLengthHours, vnEngine, vnOriginalLanguage,
    vnLanguages, vnAliases, vnCharacters, vnStaff, vnScreenshots, vnCovers,
    vnEditions, vnPublishers, vnCommunityRating, vnDevStatus, vnDescription,
    vnReview, vndbId, nsfw,
  })
  // Placeholder — the actual implementation is now imported from
  // ./editor/buildItemFromForm.ts. Every branch below (Games, Movies,
  // Series, Anime, Manga, Books, VN, Music) is a category-specific
  // return with the same field-mapping the helper implements.

  const persistDataUrl = async (val: string | undefined, categoryId: string, kind: string, basename?: string): Promise<string | undefined> => {
    if (!val || !val.startsWith('data:')) return val
    const rel = await window.ipcRenderer.invoke('image:save', categoryId, kind, val, basename)
    return typeof rel === 'string' ? rel : val
  }

  const persistItemImages = async (item: AnyItem): Promise<AnyItem> => {
    const t = item.title
    const cover = await persistDataUrl(item.cover, item.categoryId, 'cover', assetBasename(t, 'cover'))
    const bannerImage = await persistDataUrl(item.bannerImage, item.categoryId, 'banner', assetBasename(t, 'banner'))
    const bannerImage2 = await persistDataUrl(item.bannerImage2, item.categoryId, 'banner', assetBasename(t, 'banner', 2))
    const logoImage = await persistDataUrl(item.logoImage, item.categoryId, 'logo', assetBasename(t, 'logo'))
    let volumeCovers = item.volumeCovers
    if (volumeCovers && volumeCovers.length > 0) {
      volumeCovers = await Promise.all(volumeCovers.map(async (v) => ({ ...v, cover: (await persistDataUrl(v.cover, item.categoryId, 'volume', assetBasename(t, 'volume', v.number))) ?? v.cover })))
    }
    let singleCovers = item.singleCovers
    if (singleCovers && singleCovers.length > 0) {
      singleCovers = await Promise.all(singleCovers.map(async (s) => ({ ...s, cover: (await persistDataUrl(s.cover, item.categoryId, 'single', assetBasename(t, 'single', s.name))) ?? s.cover })))
    }
    let editions = item.editions
    if (editions && editions.length > 0) {
      editions = await Promise.all(editions.map(async (e) => ({ ...e, cover: await persistDataUrl(e.cover, item.categoryId, 'edition', assetBasename(t, 'edition', e.name)) })))
    }
    // VN character-card uploads land as data URLs in vnCharacters[].image
    // (via pickImageToDataUrl on the editor). Fetched covers/screenshots
    // already come back as asset paths from the fetcher's downloadImageAsset
    // calls; persistDataUrl no-ops on those since they aren't data URLs.
    let vnCharacters = item.vnCharacters
    if (vnCharacters && vnCharacters.length > 0) {
      vnCharacters = await Promise.all(vnCharacters.map(async (c, i) => ({
        ...c,
        image: (await persistDataUrl(c.image, item.categoryId, 'character', assetBasename(t, 'char', c.name || i + 1))) ?? c.image,
      })))
    }
    let vnCovers = item.vnCovers
    if (vnCovers && vnCovers.length > 0) {
      vnCovers = await Promise.all(vnCovers.map(async (v, i) => ({
        ...v,
        path: (await persistDataUrl(v.path, item.categoryId, 'cover', assetBasename(t, 'cover', v.releaseTitle || i + 1))) ?? v.path,
      })))
    }
    let vnScreenshots = item.vnScreenshots
    if (vnScreenshots && vnScreenshots.length > 0) {
      vnScreenshots = await Promise.all(vnScreenshots.map(async (s, i) => ({
        ...s,
        path: (await persistDataUrl(s.path, item.categoryId, 'screenshot', assetBasename(t, 'screen', i + 1))) ?? s.path,
      })))
    }
    return { ...item, cover, bannerImage, bannerImage2, logoImage, volumeCovers, singleCovers, editions, vnCharacters, vnCovers, vnScreenshots }
  }

  // True only for asset paths we own on disk under assets/ — i.e. relative
  // strings, not data URLs, remote URLs, or blob:/file: refs. Used to gate
  // image:delete calls so we never try to unlink something we didn't write.
  const isLocalAssetPath = (val: string | undefined | null): val is string => {
    if (!val) return false
    return !/^(data:|https?:|file:|blob:|omnio-asset:)/i.test(val)
  }

  const deleteAssetFile = (rel: string | undefined | null) => {
    if (isLocalAssetPath(rel)) window.ipcRenderer.invoke('image:delete', rel)
  }

  // Compare the item we're about to save against the previously-saved version
  // and collect every asset path that used to be referenced but no longer is.
  // Covers the "clear cover", "replace banner", "remove one volume" cases.
  const findOrphanedItemAssets = (oldItem: AnyItem | undefined, newItem: AnyItem): string[] => {
    if (!oldItem) return []
    const orphans: string[] = []
    const check = (oldVal: string | undefined, newVal: string | undefined) => {
      if (isLocalAssetPath(oldVal) && oldVal !== newVal) orphans.push(oldVal)
    }
    check(oldItem.cover, newItem.cover)
    check(oldItem.bannerImage, newItem.bannerImage)
    check(oldItem.bannerImage2, newItem.bannerImage2)
    check(oldItem.logoImage, newItem.logoImage)
    const newVolIds = new Set((newItem.volumeCovers ?? []).map((v) => v.id))
    ;(oldItem.volumeCovers ?? []).forEach((oldV) => {
      if (!newVolIds.has(oldV.id)) {
        if (isLocalAssetPath(oldV.cover)) orphans.push(oldV.cover)
      } else {
        const newV = newItem.volumeCovers!.find((v) => v.id === oldV.id)
        if (newV && isLocalAssetPath(oldV.cover) && oldV.cover !== newV.cover) orphans.push(oldV.cover)
      }
    })
    // Single covers (removed or replaced).
    const newSingleIds = new Set((newItem.singleCovers ?? []).map((s) => s.id))
    ;(oldItem.singleCovers ?? []).forEach((oldS) => {
      const newS = newItem.singleCovers?.find((s) => s.id === oldS.id)
      if ((!newSingleIds.has(oldS.id) || (newS && oldS.cover !== newS.cover)) && isLocalAssetPath(oldS.cover)) orphans.push(oldS.cover)
    })
    // Edition covers (removed or replaced).
    const newEdIds = new Set((newItem.editions ?? []).map((e) => e.id))
    ;(oldItem.editions ?? []).forEach((oldE) => {
      const newE = newItem.editions?.find((e) => e.id === oldE.id)
      if ((!newEdIds.has(oldE.id) || (newE && oldE.cover !== newE.cover)) && isLocalAssetPath(oldE.cover)) orphans.push(oldE.cover!)
    })
    return orphans
  }

  const handleSave = async () => {
    if (!title.trim()) return
    // `basedOnItemId` lives on BaseItem so every category can carry a
    // cross-library adaptation link, but the form scaffolding
    // (FormSnapshot / buildItemFromForm) is per-category. Patch it in
    // after the build so we don't have to thread the field through
    // every editor section's props.
    const withBasedOn = (it: AnyItem): AnyItem =>
      basedOnItemId ? ({ ...it, basedOnItemId } as AnyItem) : ({ ...it, basedOnItemId: undefined } as AnyItem)
    if (editingId) {
      const oldItem = items.find((it) => it.id === editingId)
      const createdAt = oldItem?.createdAt ?? Date.now()
      const built = withBasedOn(buildItemFromForm(editingId, createdAt))
      const updated = await persistItemImages(built)
      findOrphanedItemAssets(oldItem, updated).forEach(deleteAssetFile)
      setItems((prev) => prev.map((it) => (it.id === editingId ? updated : it)))
      if (viewing && viewing.id === editingId) setViewing(updated)
    } else {
      const built = withBasedOn(buildItemFromForm(crypto.randomUUID(), Date.now()))
      const created = await persistItemImages(built)
      setItems((prev) => [...prev, created])
    }
    setToast('Saved')
    closePanel({ afterSave: true })
  }

  const performDelete = (item: AnyItem) => {
    // Fire-and-forget removal of any local asset files this item owned so
    // deleting an entry doesn't leave orphan images under assets/.
    deleteAssetFile(item.cover)
    deleteAssetFile(item.bannerImage)
    deleteAssetFile(item.bannerImage2)
    deleteAssetFile(item.logoImage)
    ;(item.volumeCovers ?? []).forEach((v) => deleteAssetFile(v.cover))
    ;(item.singleCovers ?? []).forEach((s) => deleteAssetFile(s.cover))
    ;(item.editions ?? []).forEach((e) => deleteAssetFile(e.cover))
    ;(item.vnCovers ?? []).forEach((c) => deleteAssetFile(c.path))
    ;(item.vnScreenshots ?? []).forEach((s) => deleteAssetFile(s.path))
    ;(item.vnCharacters ?? []).forEach((c) => deleteAssetFile(c.image))
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setCollections((prev) => prev.map((c) => ({ ...c, itemIds: c.itemIds.filter((id) => id !== item.id) })))
    if (editingId === item.id) closePanel()
    if (viewing && viewing.id === item.id) setViewing(null)
  }

  const handleDelete = (item: AnyItem) => {
    if (settings.confirmDelete) askConfirm(`Delete "${item.title}"? This can't be undone.`, () => performDelete(item), true)
    else performDelete(item)
  }

  // Toggle item-level favorite ⭐. Called from every card + the detail
  // views. Undo-tracked because it's an observable data change.
  const toggleItemFavorite = (item: AnyItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorite: !i.favorite } : i)))
  }

  const handleDeleteFromPanel = () => { if (editingItem) handleDelete(editingItem) }

  // Builds the right-click menu for a card. Actions are common to every
  // library (open, edit, duplicate, move, add to group, delete) so no
  // per-category branching is needed here — the modals underneath handle
  // the category-specific state.
  const buildCardMenu = (item: AnyItem): CardMenuAction[] => {
    const dup = () => {
      const copy: AnyItem = { ...item, id: crypto.randomUUID(), title: `${item.title} (Copy)`, createdAt: Date.now() }
      setItems((prev) => [...prev, copy])
      setToast(`Duplicated as "${copy.title}"`)
    }
    const targets = CATEGORIES.filter((c) => c.id !== item.categoryId)
    return [
      { label: 'Open', onClick: () => openEditPanel(item) },
      { label: 'Edit', onClick: () => { openEditPanel(item); setTimeout(() => loadItemIntoForm(item), 0); setPanelOpen(true) } },
      { label: 'Duplicate', onClick: dup },
      { label: 'Export as JSON…', onClick: () => exportItemAsJson(item as unknown as Record<string, unknown>, item.title) },
      { label: 'Export as HTML…', onClick: async () => {
        const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose where to export the item')
        if (!dir) return
        const artistsForItem = item.categoryId === 'musica' ? musicArtists : []
        const html = buildStaticSiteHtml([item], artistsForItem, item.title)
        const r = await window.ipcRenderer.invoke('export:site', dir, html)
        if (r?.ok) setToast(`Exported to ${r.path}`)
        else setToast(`Export failed: ${r?.error ?? 'unknown'}`)
      } },
      { divider: true, label: '', onClick: () => {} },
      // Move-to-library submenu flattened: each destination is its own row.
      // The categoryId change re-slots the item into another JSON on next save.
      ...targets.slice(0, 4).map((c) => ({
        label: `Move to ${c.label}`,
        onClick: () => {
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, categoryId: c.id } : i)))
          setToast(`Moved to ${c.label}`)
        },
      })),
      { divider: true, label: '', onClick: () => {} },
      { label: 'Delete…', danger: true, onClick: () => handleDelete(item) },
    ]
  }

  // Single "duplicate" handler for every detail modal. Fase 2.3
  // collapsed eight per-category near-identical functions into this
  // one — copy the item currently in `viewing`, give it a new uuid +
  // `(Copy)` title, drop it into the library, and open the editor.
  const handleDuplicate = () => {
    if (!viewing) return
    const copy: AnyItem = { ...viewing, id: crypto.randomUUID(), title: `${viewing.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewing(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return
    const newCol: Collection = { id: crypto.randomUUID(), name: newCollectionName.trim(), categoryId: activeCategory, itemIds: [], createdAt: Date.now() }
    setCollections((prev) => [...prev, newCol])
    setNewCollectionName('')
  }

  const handleDeleteCollection = (id: string) => {
    askConfirm('Delete this group? Items stay, they just stop being grouped.', () => {
      const target = collections.find((c) => c.id === id)
      if (target) deleteAssetFile(target.cover)
      setCollections((prev) => prev.filter((c) => c.id !== id))
      if (activeCollectionId === id) setActiveCollectionId(null)
    })
  }

  const openCollectionEditModal = (c: Collection) => {
    setEditingCollectionId(c.id)
    setCollectionNameField(c.name)
    setCollectionCoverField(c.cover ?? '')
  }

  const closeCollectionEditModal = () => {
    setEditingCollectionId(null)
    setCollectionNameField('')
    setCollectionCoverField('')
  }

  const handleCollectionCoverFile = pickImageToDataUrl(setCollectionCoverField)

  const handleSaveCollectionEdit = async () => {
    if (!collectionNameField.trim() || !editingCollectionId) return
    const trimmedCover = collectionCoverField.trim()
    let cover: string | undefined
    if (!trimmedCover) cover = undefined
    else if (trimmedCover.startsWith('data:')) {
      const rel = await window.ipcRenderer.invoke('image:save', 'groups', 'cover', trimmedCover, assetBasename(collectionNameField.trim(), 'cover'))
      cover = typeof rel === 'string' ? rel : trimmedCover
    } else cover = trimmedCover
    const oldCollection = collections.find((c) => c.id === editingCollectionId)
    if (oldCollection && isLocalAssetPath(oldCollection.cover) && oldCollection.cover !== cover) {
      deleteAssetFile(oldCollection.cover)
    }
    setCollections((prev) => prev.map((c) => (c.id === editingCollectionId ? { ...c, name: collectionNameField.trim(), cover } : c)))
    closeCollectionEditModal()
  }

  const handleToggleItemInCollection = (collectionId: string, itemId: string) => {
    setCollections((prev) => prev.map((c) => c.id === collectionId
      ? { ...c, itemIds: c.itemIds.includes(itemId) ? c.itemIds.filter((x) => x !== itemId) : [...c.itemIds, itemId] }
      : c))
  }

  const handleReorder = (targetId: string) => {
    if (!activeCollectionId || !draggedId || draggedId === targetId) return
    setCollections((prev) => prev.map((c) => {
      if (c.id !== activeCollectionId) return c
      const ids = [...c.itemIds]
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from === -1 || to === -1) return c
      ids.splice(from, 1)
      ids.splice(to, 0, draggedId)
      return { ...c, itemIds: ids }
    }))
    setDraggedId(null)
  }

  const handleReorderCategory = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setCustomOrders((prev) => {
      const base = prev[activeCategory] && prev[activeCategory].length > 0 ? prev[activeCategory] : itemsInCategory.map((i) => i.id)
      const ids = [...base]
      if (!ids.includes(draggedId)) ids.push(draggedId)
      if (!ids.includes(targetId)) ids.push(targetId)
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      ids.splice(from, 1)
      ids.splice(to, 0, draggedId)
      return { ...prev, [activeCategory]: ids }
    })
    setDraggedId(null)
  }

  const handleExport = () => {
    const data = JSON.stringify({ items, collections, settings, artists: musicArtists, customOrders }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `omnio-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        askConfirm('This replaces all current data with the imported file. Continue?', () => {
          if (parsed.items) setItems(parsed.items)
          if (parsed.collections) setCollections(parsed.collections)
          if (parsed.settings) setSettings(parsed.settings)
          if (parsed.artists) setMusicArtists(parsed.artists)
          if (parsed.customOrders) setCustomOrders(parsed.customOrders)
        })
      } catch {
        setAlertMsg('That file is not a valid Omnio backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleWipeAll = () => {
    askConfirm('This permanently deletes ALL items and groups in every category. This cannot be undone.', () => {
      setItems([])
      setCollections([])
    })
  }

  // Page context surfaced in the topnav (icon + title + count + back +
  // per-view actions). Replaces the duplicated `.content-header` blocks
  // that used to sit at the top of every board / library / stats view.
  // The topnav is the single header now.
  // Kanban / Timeline / Diary only make sense on a real item list.
  // Artists sub-tab shows folder cards, Groups shows collections,
  // Artist detail view is its own thing — degrade to classic in all
  // those cases.
  const supportsExtendedViews = subView === 'items' && !viewingArtist && !activeCollectionId
  const viewToggleBtns = (
    <div className="view-toggle">
      <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')} title="List — one card per row with meta">☰ List</button>
      <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')} title="Grid — cover-first tiles">▦ Grid</button>
      <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')} title="Compact — dense list, tiny covers">≡ Compact</button>
      {supportsExtendedViews && (
        <>
          <button className={layout === 'kanban' ? 'active' : ''} onClick={() => setLayout('kanban')} title="Kanban — columns per status, drag cards to change status">⊞ Kanban</button>
          <button className={layout === 'timeline' ? 'active' : ''} onClick={() => setLayout('timeline')} title="Timeline — items grouped by release year">⇢ Timeline</button>
          <button className={layout === 'diary' ? 'active' : ''} onClick={() => setLayout('diary')} title="Diary — chronological log by finished/added date">✎ Diary</button>
        </>
      )}
    </div>
  )
  const backToLibrary = () => setSpecialView('none')
  type PageChip = { key: string; label: string; count: number; active: boolean; onClick: () => void }
  const buildCategoryChips = (): PageChip[] => {
    if (isVideojuegos) return GAME_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.gameStatus || 'backlog') === s.value).length,
      active: (specialView as string) === 'board' && boardStatus === s.value,
      onClick: () => { setSpecialView('board'); setBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    if (activeCategory === 'musica') return (['listened', 'unlistened'] as const).map((v) => ({
      key: v, label: v === 'listened' ? 'Listened' : 'Not listened',
      count: itemsInCategory.filter((i) => v === 'listened' ? i.consumed : !i.consumed).length,
      active: (specialView as string) === 'musicBoard' && musicBoardFilter === v,
      onClick: () => { setSpecialView('musicBoard'); setMusicBoardFilter(v); closePanel(); closeAllDetailViews() },
    }))
    if (isManga) return MANGA_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.mangaStatus || 'plan_to_read') === s.value).length,
      active: (specialView as string) === 'mangaBoard' && mangaBoardStatus === s.value,
      onClick: () => { setSpecialView('mangaBoard'); setMangaBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    if (activeCategory === 'peliculas') return (['watched', 'unwatched'] as const).map((v) => ({
      key: v, label: v === 'watched' ? 'Watched' : 'Not watched',
      count: itemsInCategory.filter((i) => v === 'watched' ? i.consumed : !i.consumed).length,
      active: (specialView as string) === 'moviesBoard' && moviesBoardFilter === v,
      onClick: () => { setSpecialView('moviesBoard'); setMoviesBoardFilter(v); closePanel(); closeAllDetailViews() },
    }))
    if (isAnime) return ANIME_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.watchStatus || 'plan_to_watch') === s.value).length,
      active: (specialView as string) === 'animeBoard' && animeBoardStatus === s.value,
      onClick: () => { setSpecialView('animeBoard'); setAnimeBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    if (isSeriesLike) return SERIES_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.seriesStatus || 'plan_to_watch') === s.value).length,
      active: (specialView as string) === 'seriesBoard' && seriesBoardStatus === s.value,
      onClick: () => { setSpecialView('seriesBoard'); setSeriesBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    if (activeCategory === 'libros') return BOOK_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.bookStatus || 'plan_to_read') === s.value).length,
      active: (specialView as string) === 'bookBoard' && bookBoardStatus === s.value,
      onClick: () => { setSpecialView('bookBoard'); setBookBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    if (activeCategory === 'visual_novels') return VN_STATUS_OPTIONS.map((s) => ({
      key: s.value, label: s.label,
      count: itemsInCategory.filter((i) => (i.visualNovelStatus || 'plan_to_play') === s.value).length,
      active: (specialView as string) === 'vnBoard' && vnBoardStatus === s.value,
      onClick: () => { setSpecialView('vnBoard'); setVnBoardStatus(s.value); closePanel(); closeAllDetailViews() },
    }))
    return []
  }
  type PageCount = { n: number; unit: string }
  const pageMeta: { icon: React.ReactNode; title: string; count?: PageCount; onBack?: () => void; actions?: React.ReactNode; chips?: PageChip[] } | null = (() => {
    // Home and Arcade own their whole viewport (hero header + widgets
    // or grid), so the shell doesn't add a topbar on top.
    if (specialView === 'home') return null
    if (specialView === 'arcade') return null
    // When a plugin is active, it owns the topnav and publishes its
    // own meta via `setPageMeta` — mirror it here so the shell
    // renders it in the standard Omnio topbar.
    if (activePluginSlug) return pluginPageMeta
    if (specialView === 'calendar') return { icon: <CalendarIcon />, title: 'Release calendar' }
    if (specialView === 'stats') return { icon: <InsightsIcon />, title: 'Statistics' }
    if (specialView === 'settings') return { icon: <SettingsIcon />, title: 'Settings' }
    if (specialView === 'board') {
      const label = GAME_STATUS_OPTIONS.find((s) => s.value === boardStatus)?.label ?? ''
      const n = gamesList.filter((g) => (g.gameStatus || 'backlog') === boardStatus).length
      return { icon: <GameStatusIcon value={boardStatus} />, title: label, count: { n, unit: n === 1 ? 'game' : 'games' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'musicBoard') {
      const n = musicList.filter((m) => musicBoardFilter === 'listened' ? m.consumed : !m.consumed).length
      return { icon: <span className="page-icon-glyph">{musicBoardFilter === 'listened' ? '✓' : '○'}</span>, title: musicBoardFilter === 'listened' ? 'Listened' : 'Not listened', count: { n, unit: n === 1 ? 'item' : 'items' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'mangaBoard') {
      const n = itemsInCategory.filter((i) => (i.mangaStatus || 'plan_to_read') === mangaBoardStatus).length
      return { icon: <MangaStatusIcon value={mangaBoardStatus} />, title: getMangaStatus(mangaBoardStatus).label, count: { n, unit: n === 1 ? 'item' : 'items' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'moviesBoard') {
      const n = itemsInCategory.filter((i) => moviesBoardFilter === 'watched' ? i.consumed : !i.consumed).length
      return { icon: <span className="page-icon-glyph">{moviesBoardFilter === 'watched' ? '✓' : '○'}</span>, title: moviesBoardFilter === 'watched' ? 'Watched' : 'Not watched', count: { n, unit: n === 1 ? 'item' : 'items' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'animeBoard') {
      const n = itemsInCategory.filter((i) => (i.watchStatus || 'plan_to_watch') === animeBoardStatus).length
      return { icon: <AnimeStatusIcon value={animeBoardStatus} />, title: getAnimeStatus(animeBoardStatus).label, count: { n, unit: n === 1 ? 'item' : 'items' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'seriesBoard') {
      const n = itemsInCategory.filter((i) => (i.seriesStatus || 'plan_to_watch') === seriesBoardStatus).length
      return { icon: <AnimeStatusIcon value={seriesBoardStatus} />, title: getSeriesStatus(seriesBoardStatus).label, count: { n, unit: n === 1 ? 'item' : 'items' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'bookBoard') {
      const n = itemsInCategory.filter((i) => (i.bookStatus || 'plan_to_read') === bookBoardStatus).length
      return { icon: <MangaStatusIcon value={bookBoardStatus as MangaStatus} />, title: getBookStatus(bookBoardStatus).label, count: { n, unit: n === 1 ? 'book' : 'books' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'vnBoard') {
      const label = VN_STATUS_OPTIONS.find((s) => s.value === vnBoardStatus)?.label ?? ''
      const n = itemsInCategory.filter((i) => (i.visualNovelStatus || 'plan_to_play') === vnBoardStatus).length
      return { icon: <CategoryIcon id="visual_novels" />, title: label, count: { n, unit: n === 1 ? 'VN' : 'VNs' }, onBack: backToLibrary, actions: viewToggleBtns }
    }
    if (specialView === 'simulcastBoard') {
      const airing = itemsInCategory.filter((i) => i.airingStatus === 'airing' && i.airingDay)
      return { icon: <CategoryIcon id={activeCategory} />, title: 'This season', count: { n: airing.length, unit: airing.length === 1 ? 'show' : 'shows' }, onBack: backToLibrary }
    }
    // specialView === 'none' → the library view (with optional collection drill-in)
    const count: PageCount = showFolderListing
      ? { n: categoryCollections.length, unit: categoryCollections.length === 1 ? 'group' : 'groups' }
      : { n: visibleItems.length, unit: visibleItems.length === 1 ? 'item' : 'items' }
    const isAnimeLike = activeCategory === 'anime' || activeCategory === 'donghua'
    const libActions = (
      <>
        {!showFolderListing && viewToggleBtns}
        {isAnimeLike && subView === 'items' && !activeCollectionId && (
          <button
            className="secondary-btn"
            onClick={() => { setSpecialView('simulcastBoard'); closePanel(); closeAllDetailViews() }}
            title="Airing anime grouped by weekday"
          >This season</button>
        )}
        {subView === 'items' && <button className="add-btn" onClick={openAddPanel}>+ Add</button>}
      </>
    )
    // Only show chips at the library root (no collection drill-in and
    // browsing items, not groups) — otherwise the topnav would try to
    // filter by status while you're inside a group / artist list.
    const chips = !activeCollectionId && subView === 'items' ? buildCategoryChips() : []
    return {
      icon: activeCollectionId ? <FolderIcon /> : <CategoryIcon id={current?.id ?? ''} />,
      title: (activeCollectionId ? activeCollection?.name : current?.label) ?? '',
      count,
      onBack: activeCollectionId ? () => { setActiveCollectionId(null); resetListControls() } : undefined,
      actions: libActions,
      chips: chips.length > 0 ? chips : undefined,
    }
  })()

  return (
    <Suspense fallback={null}>
    <div
      className="app"
      data-theme={settings.theme}
      data-accent={settings.accent === 'default' ? undefined : settings.accent}
      data-density={settings.density}
      data-motion={settings.motion}
      data-layout="sidebar"
      data-sidebar={settings.sidebarCollapsed ? 'collapsed' : 'expanded'}
      data-card-zoom={settings.cardZoom ?? 'md'}
    >
      {updateInfo && !updateBannerDismissed && (
        <div className="update-banner">
          <span className="update-banner-icon">↗</span>
          <div className="update-banner-body">
            <span className="update-banner-title">Omnio {updateInfo.latest} is available</span>
            <span className="update-banner-sub">
              You're on {updateInfo.current}.
              {updateInfo.matchedAssetName ? ` Update from within the app: ${updateInfo.matchedAssetName}.` : ' Pick the build for your platform on the release page.'}
            </span>
          </div>
          <div className="update-banner-actions">
            {updateInfo.matchedAssetUrl && (
              <button type="button" className="update-banner-btn primary" onClick={startAssistedDownload}>Update</button>
            )}
            <button type="button" className={updateInfo.matchedAssetUrl ? 'update-banner-btn ghost' : 'update-banner-btn primary'} onClick={() => { if (updateInfo.htmlUrl) invoke('updates:open-url', updateInfo.htmlUrl) }}>Release page</button>
            <button type="button" className="update-banner-btn ghost" onClick={() => setUpdateBannerDismissed(true)}>Later</button>
          </div>
        </div>
      )}
      <div className="body">
        <Sidebar
          items={items}
          collections={collections}
          enabledCategories={settings.enabledCategories}
          arcadeEnabled={settings.arcadeEnabled}
          active={
            specialView === 'home' ? { kind: 'home' } :
            specialView === 'calendar' ? { kind: 'special', id: 'calendar' } :
            specialView === 'stats' ? { kind: 'special', id: 'stats' } :
            specialView === 'settings' ? { kind: 'special', id: 'settings' } :
            specialView === 'arcade' ? { kind: 'arcade' } :
            activePluginSlug ? { kind: 'plugin', slug: activePluginSlug } :
            { kind: 'library', categoryId: activeCategory }
          }
          collapsed={!!settings.sidebarCollapsed}
          onToggleCollapsed={() => setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))}
          onOpenHome={() => { setActivePluginSlug(null); setSpecialView('home'); closePanel(); closeAllDetailViews() }}
          onOpenLibrary={(id) => { setActivePluginSlug(null); switchCategory(id); closePanel(); closeAllDetailViews() }}
          onOpenCalendar={() => { setActivePluginSlug(null); setSpecialView('calendar'); closePanel(); closeAllDetailViews() }}
          onOpenStats={() => { setActivePluginSlug(null); setSpecialView('stats'); closePanel(); closeAllDetailViews() }}
          onOpenSettings={() => { setActivePluginSlug(null); setSpecialView('settings'); closePanel(); closeAllDetailViews() }}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenRandomizer={() => setRandomizerOpen(true)}
          onOpenArcade={() => { setSpecialView('arcade'); setActivePluginSlug(null); closePanel(); closeAllDetailViews() }}
          pluginCounts={pluginCounts}
          visiblePlugins={visiblePlugins}
          onOpenPlugin={(slug) => { setSpecialView('none'); setActivePluginSlug(slug); closePanel(); closeAllDetailViews() }}
        />

        <div className="main-column">
      {pageMeta && (
        <nav className="topnav">
          <div className="topnav-page">
            {pageMeta.onBack && (
              <button className="topnav-back" onClick={pageMeta.onBack} title="Back" aria-label="Back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            )}
            <span className="topnav-page-icon">{pageMeta.icon}</span>
            <span className="topnav-page-title">{pageMeta.title}</span>
            {pageMeta.count && (
              <span className="topnav-page-count">
                <span className="count-n">{pageMeta.count.n}</span>
                <span className="count-unit">{pageMeta.count.unit}</span>
              </span>
            )}
            {pageMeta.chips && (
              <div className="topnav-chips">
                {pageMeta.chips.map((c) => (
                  <button
                    key={c.key}
                    className={c.active ? 'topnav-chip active' : 'topnav-chip'}
                    onClick={c.onClick}
                  >
                    <span>{c.label}</span>
                    <span className="topnav-chip-count">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {pageMeta.actions && (
            <div className="topnav-page-actions">{pageMeta.actions}</div>
          )}
        </nav>
      )}
        <main className="content">
          {viewing ? (
            <DetailModalRouter
              viewing={viewing}
              items={items}
              collections={collections}
              onClose={() => setViewing(null)}
              onEdit={openEditFromModal}
              onDuplicate={handleDuplicate}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewing(target) }}
              onSaveTrackLyrics={(item, trackId, lyrics) => {
                const updated: AnyItem = { ...item, tracks: (item.tracks ?? []).map((t) => t.id === trackId ? { ...t, lyrics: lyrics.trim() || undefined } : t) }
                setItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
                setViewing(updated)
                setToast('Lyrics saved')
              }}
            />
          ) : viewingArtist ? (
            <ArtistDetailView
              artist={viewingArtist}
              items={musicList.filter((m) => m.artist === viewingArtist.name)}
              layout={classicLayout}
              onSetLayout={(l) => setLayout(l)}
              onBack={() => setViewingArtist(null)}
              onEdit={() => openArtistEditPanel(viewingArtist)}
              onOpenItem={openEditPanel}
              onDeleteItem={handleDelete}
              musicFields={settings.musicFields}
            />
          ) : (
            <>
          {specialView === 'board' && (
            <>
              <div className="toolbar">
                <input
                  className="search-input"
                  placeholder="Search by title... (Ctrl+F)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="time">Time played</option>
                  <option value="releaseAsc">Release date ↑</option>
                  <option value="releaseDesc">Release date ↓</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {filterAndSort(gamesList.filter((g) => (g.gameStatus || 'backlog') === boardStatus), search, [], [], [], [], sortBy).length === 0 && <p className="empty">No games here.</p>}
                {filterAndSort(gamesList.filter((g) => (g.gameStatus || 'backlog') === boardStatus), search, [], [], [], [], sortBy).map((g) => (
                  <ItemCard key={g.id} item={g} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite}
                        gameFields={settings.gameFields}
                        musicFields={settings.musicFields}
                        mangaFields={settings.mangaFields} />
                ))}
              </div>
              </div>
            </>
          )}

          {specialView === 'musicBoard' && (() => {
            const list = filterAndSort(musicList.filter((m) => musicBoardFilter === 'listened' ? m.consumed : !m.consumed), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="artist">By artist</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                  <option value="duration">Duration (longest)</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((m) => (
                  <ItemCard key={m.id} item={m} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} musicFields={settings.musicFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'mangaBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.mangaStatus || 'plan_to_read') === mangaBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="chapters">Chapters read</option>
                  <option value="mangaStatus">Status</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} mangaFields={settings.mangaFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'moviesBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => moviesBoardFilter === 'watched' ? i.consumed : !i.consumed), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                  <option value="duration">Duration (longest)</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} movieFields={settings.movieFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'animeBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.watchStatus || 'plan_to_watch') === animeBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="episodes">Episodes watched</option>
                  <option value="animeStatus">Status</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                  <option value="duration">Duration (longest)</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} animeFields={settings.animeFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'seriesBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.seriesStatus || 'plan_to_watch') === seriesBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="episodes">Episodes watched</option>
                  <option value="seriesStatus">Status</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} seriesFields={settings.seriesFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'bookBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.bookStatus || 'plan_to_read') === bookBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="yearAsc">Publication year ↑</option>
                  <option value="yearDesc">Publication year ↓</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} bookFields={settings.bookFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'vnBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.visualNovelStatus || 'plan_to_play') === vnBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                  <option value="recent">Most recent</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="rating">Rating</option>
                  <option value="yearAsc">Release year ↑</option>
                  <option value="yearDesc">Release year ↓</option>
                </select>
              </div>
              <div className="content-scroll">
              <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
                {list.length === 0 && <p className="empty">Nothing here.</p>}
                {list.map((i) => (
                  <ItemCard key={i.id} item={i} layout={classicLayout} onOpen={openEditPanel} onDelete={handleDelete} onToggleFavorite={toggleItemFavorite} vnFields={settings.vnFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'simulcastBoard' && (() => {
            // Only anime + donghua are simulcast-relevant. Items surface here
            // when the user set airingStatus='airing' AND picked an airingDay
            // in the editor. Everything else stays out — showing "unknown day"
            // slots would just be noise.
            const airing = itemsInCategory.filter((i) => i.airingStatus === 'airing' && i.airingDay)
            const byDay = new Map<string, Item[]>()
            for (const w of WEEKDAY_OPTIONS) byDay.set(w.value, [])
            for (const item of airing) byDay.get(item.airingDay!)?.push(item)
            for (const list of byDay.values()) list.sort((a, b) => a.title.localeCompare(b.title))
            const totalAiring = itemsInCategory.filter((i) => i.airingStatus === 'airing').length
            const missingDay = totalAiring - airing.length
            return (
              <div className="content-scroll">
                {airing.length === 0 && (
                  <p className="empty">
                    No airing shows with a weekday set. In the editor, set <b>Airing status</b> to
                    <em> Airing</em> and pick a weekday under <b>Airs on</b> for anything you're
                    currently watching this season.
                  </p>
                )}
                {missingDay > 0 && airing.length > 0 && (
                  <p className="hint" style={{ margin: '0 0 12px' }}>
                    {missingDay} airing show{missingDay === 1 ? ' has' : 's have'} no weekday set — open the
                    editor and pick one under <b>Airs on</b> to slot it here.
                  </p>
                )}
                {airing.length > 0 && (
                  <div className="simulcast-grid">
                    {WEEKDAY_OPTIONS.map((w) => {
                      const list = byDay.get(w.value) ?? []
                      return (
                        <div key={w.value} className="simulcast-col">
                          <div className="simulcast-col-header">
                            <span className="simulcast-day">{w.short}</span>
                            <span className="simulcast-day-count">{list.length}</span>
                          </div>
                          <div className="simulcast-col-body">
                            {list.length === 0 && <span className="simulcast-empty">—</span>}
                            {list.map((i) => (
                              <ItemCard
                                key={i.id}
                                item={i}
                                layout="grid"
                                onOpen={openEditPanel}
                                onDelete={handleDelete} onToggleFavorite={toggleItemFavorite}
                                animeFields={settings.animeFields}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {specialView === 'stats' && (
            <>
              <div className="content-scroll">
              <div className="sub-tabs">
                {CATEGORIES.filter((c) => !settings.enabledCategories || settings.enabledCategories.includes(c.id)).map((cat) => (
                  <button key={cat.id} className={statsCategory === cat.id ? 'sub-tab active' : 'sub-tab'} onClick={() => setStatsCategory(cat.id)}>
                    <CategoryIcon id={cat.id} /> {cat.label}
                  </button>
                ))}
              </div>
              <div className="view-toggle chart-toggle">
                <button className={chartMode === 'pie' ? 'active' : ''} onClick={() => setChartMode('pie')}>◔ Pie</button>
                <button className={chartMode === 'bar' ? 'active' : ''} onClick={() => setChartMode('bar')}>▤ Bar</button>
              </div>
              <DistChart data={getDistribution(statsCategory, items.filter((i) => i.categoryId === statsCategory))} mode={chartMode} />

              <Heatmap items={items.filter((i) => i.categoryId === statsCategory)} />

              <div className="stats-bar">
                {getCategoryStats(statsCategory, items.filter((i) => i.categoryId === statsCategory)).map((s) => (
                  <div key={s.label} className="stat-pill">
                    <span className="stat-value">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="insights-row">
                <div className="insights-col">
                  <h3 className="insights-subheading">Completed per month</h3>
                  <div className="bar-chart month-chart">
                    {getMonthlyActivity(items.filter((i) => i.categoryId === statsCategory)).map((m) => (
                      <div key={m.label} className="bar-row">
                        <span className="bar-label">{m.label}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 20)}%`, background: 'var(--accent)' }} />
                        </div>
                        <span className="bar-value">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="insights-col">
                  <h3 className="insights-subheading">Top rated</h3>
                  <div className="top-rated-list">
                    {getTopRated(items.filter((i) => i.categoryId === statsCategory)).length === 0 && <p className="hint">No ratings yet.</p>}
                    {getTopRated(items.filter((i) => i.categoryId === statsCategory)).map((i, idx) => (
                      <div key={i.id} className="top-rated-row">
                        <span className="top-rated-rank">#{idx + 1}</span>
                        <span className="top-rated-title">{i.title}</span>
                        <span className="top-rated-score">★ {i.rating}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {statsCategory === 'musica' && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top artists</h3>
                      <div className="top-rated-list">
                        {getTopArtists(musicArtists, musicList).length === 0 && <p className="hint">No artists with items yet.</p>}
                        {getTopArtists(musicArtists, musicList).map((a, idx) => (
                          <div key={a.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{a.name}</span>
                            <span className="top-rated-score">{a.count} {a.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top genres</h3>
                      <div className="top-rated-list">
                        {getTopGenres(items.filter((i) => i.categoryId === 'musica')).length === 0 && <p className="hint">No genres yet.</p>}
                        {getTopGenres(items.filter((i) => i.categoryId === 'musica')).map((g, idx) => (
                          <div key={g.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{g.name}</span>
                            <span className="top-rated-score">{g.count} {g.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top labels</h3>
                      <div className="top-rated-list">
                        {getTopMusicLabels(items.filter((i) => i.categoryId === 'musica')).length === 0 && <p className="hint">No labels yet.</p>}
                        {getTopMusicLabels(items.filter((i) => i.categoryId === 'musica')).map((l, idx) => (
                          <div key={l.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{l.name}</span>
                            <span className="top-rated-score">{l.count} {l.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Listens per month</h3>
                      <div className="bar-chart month-chart">
                        {getMusicListensPerMonth(items.filter((i) => i.categoryId === 'musica')).map((m) => (
                          <div key={m.label} className="bar-row">
                            <span className="bar-label">{m.label}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 12)}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="bar-value">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {statsCategory === 'anime' && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Episodes watched per month</h3>
                      <div className="bar-chart month-chart">
                        {getAnimeEpisodesPerMonth(items.filter((i) => isAnimeLikeCategory(i.categoryId))).map((m) => (
                          <div key={m.label} className="bar-row">
                            <span className="bar-label">{m.label}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 4)}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="bar-value">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top studios</h3>
                      <div className="top-rated-list">
                        {getTopStudios(items.filter((i) => isAnimeLikeCategory(i.categoryId))).length === 0 && <p className="hint">No studios yet.</p>}
                        {getTopStudios(items.filter((i) => isAnimeLikeCategory(i.categoryId))).map((s, idx) => (
                          <div key={s.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{s.name}</span>
                            <span className="top-rated-score">{s.count} {s.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {statsCategory === 'series' && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Episodes watched per month</h3>
                      <div className="bar-chart month-chart">
                        {getSeriesEpisodesPerMonth(items.filter((i) => i.categoryId === 'series')).map((m) => (
                          <div key={m.label} className="bar-row">
                            <span className="bar-label">{m.label}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 4)}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="bar-value">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top networks</h3>
                      <div className="top-rated-list">
                        {getTopNetworks(items.filter((i) => i.categoryId === 'series')).length === 0 && <p className="hint">No networks yet.</p>}
                        {getTopNetworks(items.filter((i) => i.categoryId === 'series')).map((n, idx) => (
                          <div key={n.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{n.name}</span>
                            <span className="top-rated-score">{n.count} {n.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top actors</h3>
                      <div className="top-rated-list">
                        {getTopActors(items.filter((i) => i.categoryId === 'series')).length === 0 && <p className="hint">No actors yet.</p>}
                        {getTopActors(items.filter((i) => i.categoryId === 'series')).map((a, idx) => (
                          <div key={a.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{a.name}</span>
                            <span className="top-rated-score">{a.count} {a.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {statsCategory === 'videojuegos' && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top developers</h3>
                      <div className="top-rated-list">
                        {getTopDevs(items.filter((i) => i.categoryId === 'videojuegos')).length === 0 && <p className="hint">No developers yet.</p>}
                        {getTopDevs(items.filter((i) => i.categoryId === 'videojuegos')).map((d, idx) => (
                          <div key={d.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{d.name}</span>
                            <span className="top-rated-score">{d.count} {d.count === 1 ? 'game' : 'games'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top publishers</h3>
                      <div className="top-rated-list">
                        {getTopPublishers(items.filter((i) => i.categoryId === 'videojuegos')).length === 0 && <p className="hint">No publishers yet.</p>}
                        {getTopPublishers(items.filter((i) => i.categoryId === 'videojuegos')).map((p, idx) => (
                          <div key={p.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{p.name}</span>
                            <span className="top-rated-score">{p.count} {p.count === 1 ? 'game' : 'games'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top platforms</h3>
                      <div className="top-rated-list">
                        {getTopPlatforms(items.filter((i) => i.categoryId === 'videojuegos')).length === 0 && <p className="hint">No platforms yet.</p>}
                        {getTopPlatforms(items.filter((i) => i.categoryId === 'videojuegos')).map((p, idx) => (
                          <div key={p.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{p.name}</span>
                            <span className="top-rated-score">{p.count} {p.count === 1 ? 'game' : 'games'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top genres</h3>
                      <div className="top-rated-list">
                        {getTopGenres(items.filter((i) => i.categoryId === 'videojuegos')).length === 0 && <p className="hint">No genres yet.</p>}
                        {getTopGenres(items.filter((i) => i.categoryId === 'videojuegos')).map((g, idx) => (
                          <div key={g.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{g.name}</span>
                            <span className="top-rated-score">{g.count} {g.count === 1 ? 'game' : 'games'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {statsCategory === 'peliculas' && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Movies watched per month</h3>
                      <div className="bar-chart month-chart">
                        {getMoviesWatchedPerMonth(items.filter((i) => i.categoryId === 'peliculas')).map((m) => (
                          <div key={m.label} className="bar-row">
                            <span className="bar-label">{m.label}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 12)}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="bar-value">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top directors</h3>
                      <div className="top-rated-list">
                        {getTopDirectors(items.filter((i) => i.categoryId === 'peliculas')).length === 0 && <p className="hint">No directors yet.</p>}
                        {getTopDirectors(items.filter((i) => i.categoryId === 'peliculas')).map((d, idx) => (
                          <div key={d.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{d.name}</span>
                            <span className="top-rated-score">{d.count} {d.count === 1 ? 'movie' : 'movies'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top actors</h3>
                      <div className="top-rated-list">
                        {getTopActors(items.filter((i) => i.categoryId === 'peliculas')).length === 0 && <p className="hint">No actors yet.</p>}
                        {getTopActors(items.filter((i) => i.categoryId === 'peliculas')).map((a, idx) => (
                          <div key={a.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{a.name}</span>
                            <span className="top-rated-score">{a.count} {a.count === 1 ? 'movie' : 'movies'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top genres</h3>
                      <div className="top-rated-list">
                        {getTopGenres(items.filter((i) => i.categoryId === 'peliculas')).length === 0 && <p className="hint">No genres yet.</p>}
                        {getTopGenres(items.filter((i) => i.categoryId === 'peliculas')).map((g, idx) => (
                          <div key={g.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{g.name}</span>
                            <span className="top-rated-score">{g.count} {g.count === 1 ? 'movie' : 'movies'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {isMangaLike(statsCategory) && (
                  <>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Chapters read per month</h3>
                      <div className="bar-chart month-chart">
                        {getMangaChaptersPerMonth(items.filter((i) => i.categoryId === statsCategory)).map((m) => (
                          <div key={m.label} className="bar-row">
                            <span className="bar-label">{m.label}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.min(100, m.value * 4)}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="bar-value">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top authors</h3>
                      <div className="top-rated-list">
                        {getTopMangaAuthors(items.filter((i) => i.categoryId === statsCategory)).length === 0 && <p className="hint">No authors yet.</p>}
                        {getTopMangaAuthors(items.filter((i) => i.categoryId === statsCategory)).map((a, idx) => (
                          <div key={a.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{a.name}</span>
                            <span className="top-rated-score">{a.count} {a.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top artists</h3>
                      <div className="top-rated-list">
                        {getTopMangaArtists(items.filter((i) => i.categoryId === statsCategory)).length === 0 && <p className="hint">No artists yet.</p>}
                        {getTopMangaArtists(items.filter((i) => i.categoryId === statsCategory)).map((a, idx) => (
                          <div key={a.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{a.name}</span>
                            <span className="top-rated-score">{a.count} {a.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="insights-col">
                      <h3 className="insights-subheading">Top magazines</h3>
                      <div className="top-rated-list">
                        {getTopMagazines(items.filter((i) => i.categoryId === statsCategory)).length === 0 && <p className="hint">No magazines yet.</p>}
                        {getTopMagazines(items.filter((i) => i.categoryId === statsCategory)).map((mg, idx) => (
                          <div key={mg.name} className="top-rated-row">
                            <span className="top-rated-rank">#{idx + 1}</span>
                            <span className="top-rated-title">{mg.name}</span>
                            <span className="top-rated-score">{mg.count} {mg.count === 1 ? 'item' : 'items'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {statsCategory === 'libros' && (() => {
                  const books = items.filter((i) => i.categoryId === 'libros')
                  const pagesPerMonth: { label: string; value: number }[] = (() => {
                    const map: Record<string, number> = {}
                    for (const b of books) {
                      if (!b.finishedAt) continue
                      const m = /^\d{4}-(\d{2})/.exec(b.finishedAt); if (!m) continue
                      map[m[1]] = (map[m[1]] ?? 0) + parseInt(b.totalPages || '0', 10)
                    }
                    return Array.from({ length: 12 }, (_, i) => {
                      const k = (i + 1).toString().padStart(2, '0')
                      return { label: new Date(2000, i, 1).toLocaleString('en', { month: 'short' }), value: map[k] ?? 0 }
                    })
                  })()
                  const tally = (getter: (b: typeof books[number]) => string[] | undefined) => {
                    const m: Record<string, number> = {}
                    for (const b of books) for (const v of getter(b) ?? []) m[v] = (m[v] ?? 0) + 1
                    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
                  }
                  const topAuthors = tally((b) => b.authors)
                  const publishers: Record<string, number> = {}
                  for (const b of books) if (b.publisher) publishers[b.publisher] = (publishers[b.publisher] ?? 0) + 1
                  const topPublishers = Object.entries(publishers).sort((a, b) => b[1] - a[1]).slice(0, 8)
                  const maxPages = Math.max(1, ...pagesPerMonth.map((m) => m.value))
                  return (
                    <>
                      <div className="insights-col">
                        <h3 className="insights-subheading">Pages read per month</h3>
                        <div className="bar-chart month-chart">
                          {pagesPerMonth.map((m) => (
                            <div key={m.label} className="bar-row">
                              <span className="bar-label">{m.label}</span>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${(m.value / maxPages) * 100}%`, background: 'var(--accent)' }} />
                              </div>
                              <span className="bar-value">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="insights-col">
                        <h3 className="insights-subheading">Top authors</h3>
                        <div className="top-rated-list">
                          {topAuthors.length === 0 && <p className="hint">No authors yet.</p>}
                          {topAuthors.map(([name, count], idx) => (
                            <div key={name} className="top-rated-row">
                              <span className="top-rated-rank">#{idx + 1}</span>
                              <span className="top-rated-title">{name}</span>
                              <span className="top-rated-score">{count} {count === 1 ? 'book' : 'books'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="insights-col">
                        <h3 className="insights-subheading">Top publishers</h3>
                        <div className="top-rated-list">
                          {topPublishers.length === 0 && <p className="hint">No publishers yet.</p>}
                          {topPublishers.map(([name, count], idx) => (
                            <div key={name} className="top-rated-row">
                              <span className="top-rated-rank">#{idx + 1}</span>
                              <span className="top-rated-title">{name}</span>
                              <span className="top-rated-score">{count} {count === 1 ? 'book' : 'books'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
              </div>
            </>
          )}

          {specialView === 'home' && (
            <Suspense fallback={<div style={{ padding: 32 }} className="hint">Loading…</div>}>
              <Home
                items={items}
                enabledCategories={settings.enabledCategories}
                layout={settings.homeWidgets}
                onSaveLayout={(next) => setSettings((s) => ({ ...s, homeWidgets: next }))}
                onOpenCategory={(id) => switchCategory(id)}
                onOpenItem={navigateToItem}
                onOpenCalendar={() => { setSpecialView('calendar'); closePanel(); closeAllDetailViews() }}
                onOpenStats={() => { setSpecialView('stats'); closePanel(); closeAllDetailViews() }}
                onOpenSettings={() => { setSpecialView('settings'); closePanel(); closeAllDetailViews() }}
                onOpenSearch={() => setSearchOpen(true)}
                onOpenRandomizer={() => setRandomizerOpen(true)}
                onQuickAdd={(categoryId, title) => {
                  const stub: AnyItem = {
                    id: crypto.randomUUID(),
                    categoryId: categoryId as CategoryId,
                    title,
                    cover: '',
                    tags: [],
                    createdAt: Date.now(),
                  }
                  setItems((prev) => [...prev, stub])
                  setToast(`Added "${title}"`)
                }}
              />
            </Suspense>
          )}

          {specialView === 'calendar' && (
            <Suspense fallback={<div style={{ padding: 32 }} className="hint">Loading…</div>}>
              <ReleaseCalendar items={items} onNavigate={navigateToItem} />
            </Suspense>
          )}

          {activePluginSlug && (() => {
            const p = PLUGINS.find((x) => x.slug === activePluginSlug)
            if (!p) return null
            const View = p.View
            // Merge defaults declared by the plugin with the user's
            // per-field overrides. `cardFields` is what the plugin
            // ultimately checks in its card renderer.
            const overrides = settings.pluginCardFields?.[p.slug] ?? {}
            const cardFields: Record<string, boolean> = {}
            for (const f of p.cardFields ?? []) {
              cardFields[f.value] = overrides[f.value] ?? f.default ?? true
            }
            return (
              <Suspense fallback={<div style={{ padding: 32 }} className="hint">Loading…</div>}>
                <View setPageMeta={setPluginPageMeta} cardFields={cardFields} />
              </Suspense>
            )
          })()}

          {specialView === 'arcade' && (
            <Suspense fallback={<div style={{ padding: 32 }} className="hint">Loading…</div>}>
              <ArcadeView
                games={arcadeGames}
                onCreate={(g) => setArcadeGames((prev) => [...prev, g])}
                onUpdate={(gid, patch) => setArcadeGames((prev) => prev.map((g) => g.id === gid ? { ...g, ...patch } : g))}
                onDelete={(gid) => setArcadeGames((prev) => prev.filter((g) => g.id !== gid))}
                onAddRun={(gid, run) => setArcadeGames((prev) => prev.map((g) => g.id === gid ? { ...g, runs: [...g.runs, { ...run, id: crypto.randomUUID() }] } : g))}
                onRemoveRun={(gid, rid) => setArcadeGames((prev) => prev.map((g) => g.id === gid ? { ...g, runs: g.runs.filter((r) => r.id !== rid) } : g))}
                onUpdateRun={(gid, rid, patch) => setArcadeGames((prev) => prev.map((g) => g.id === gid ? { ...g, runs: g.runs.map((r) => r.id === rid ? { ...r, ...patch } : r) } : g))}
              />
            </Suspense>
          )}

          {specialView === 'settings' && (
            <>
              <div className="settings-layout">
              <aside className="settings-sidebar">
                <div className="settings-nav-group-label">Look &amp; feel</div>
                <button className={settingsTab === 'appearance' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('appearance')}><span className="settings-nav-icon">◐</span>Appearance</button>
                <button className={settingsTab === 'behavior' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('behavior')}><span className="settings-nav-icon">⚙</span>Behavior</button>
                <div className="settings-nav-group-label">Libraries</div>
                <button className={settingsTab === 'libraries' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('libraries')}><span className="settings-nav-icon">☰</span>Enabled libraries</button>
                <button className={settingsTab === 'cards' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('cards')}><span className="settings-nav-icon">▦</span>Card fields</button>
                <div className="settings-nav-group-label">Data</div>
                <button className={settingsTab === 'data' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('data')}><span className="settings-nav-icon">⌘</span>Backup, import &amp; export</button>
                <button className={settingsTab === 'integrations' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('integrations')}><span className="settings-nav-icon">↗</span>Integrations &amp; network</button>
                <button className={settingsTab === 'maintenance' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('maintenance')}><span className="settings-nav-icon">⛭</span>Maintenance &amp; about</button>
              </aside>
              <div className="settings-main">
              <div className="settings-form">
                {settingsTab === 'appearance' && (
                  <>
                    <div className="field-group">
                      <label>Theme</label>
                      {['Original', 'Cool', 'Vibrant', 'Warm'].map((family) => {
                        const themes = THEME_OPTIONS.filter((th) => th.family === family)
                        if (themes.length === 0) return null
                        return (
                          <div key={family} className="theme-family">
                            <span className="theme-family-label">{family}</span>
                            <div className="theme-grid">
                              {themes.map((th) => (
                                <button key={th.value} type="button" className={settings.theme === th.value ? 'theme-swatch active' : 'theme-swatch'} onClick={() => setSettings((s) => ({ ...s, theme: th.value }))}>
                                  <div className="theme-swatch-preview">
                                    {th.swatch.map((c, idx) => <span key={idx} style={{ background: c }} />)}
                                  </div>
                                  <span className="theme-swatch-label">{th.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="field-group">
                      <label>Accent color</label>
                      <div className="accent-grid">
                        {ACCENT_OPTIONS.map((a) => (
                          <button key={a.value} type="button" title={a.label} className={settings.accent === a.value ? 'accent-swatch active' : 'accent-swatch'} onClick={() => setSettings((s) => ({ ...s, accent: a.value }))}>
                            {a.value === 'default'
                              ? <span className="accent-dot default-accent">A</span>
                              : <span className="accent-dot" style={{ background: a.swatch }} />}
                            <span className="accent-label">{a.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Density</label>
                      <div className="yesno">
                        <button type="button" className={settings.density === 'comfortable' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, density: 'comfortable' }))}>Comfortable</button>
                        <button type="button" className={settings.density === 'compact' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, density: 'compact' }))}>Compact</button>
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Card zoom</label>
                      <div className="yesno">
                        {(['sm','md','lg','xl'] as const).map((z) => (
                          <button key={z} type="button" className={(settings.cardZoom ?? 'md') === z ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, cardZoom: z }))}>{z === 'sm' ? 'Small' : z === 'md' ? 'Medium' : z === 'lg' ? 'Large' : 'Extra large'}</button>
                        ))}
                      </div>
                      <p className="hint">Controls how big the covers show in Grid layout. Smaller fits more per row; larger makes each cover more prominent.</p>
                    </div>
                    <div className="field-group">
                      <label>Default view</label>
                      <select
                        value={settings.defaultLayout}
                        onChange={(e) => { const v = e.target.value as Layout; setSettings((s) => ({ ...s, defaultLayout: v })); setLayout(v) }}
                      >
                        <option value="grid">Grid</option>
                        <option value="list">List</option>
                        <option value="compact">Compact</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Animations</label>
                      <div className="yesno">
                        <button type="button" className={settings.motion === 'auto' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, motion: 'auto' }))}>On</button>
                        <button type="button" className={settings.motion === 'reduced' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, motion: 'reduced' }))}>Reduced</button>
                      </div>
                    </div>
                  </>
                )}

                {settingsTab === 'behavior' && (
                  <>
                    <div className="field-group">
                      <label>Confirm before deleting</label>
                      <div className="yesno">
                        <button type="button" className={settings.confirmDelete ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, confirmDelete: true }))}>Yes</button>
                        <button type="button" className={!settings.confirmDelete ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, confirmDelete: false }))}>No</button>
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Remember sort per library</label>
                      <div className="yesno">
                        <button type="button" className={settings.rememberCategorySort ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, rememberCategorySort: true }))}>Yes</button>
                        <button type="button" className={!settings.rememberCategorySort ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, rememberCategorySort: false, categorySortModes: {} }))}>No</button>
                      </div>
                      <p className="hint">When on, each library keeps whichever sort you left it in ("Rating" in Games, "Alphabetical" in Music…). When off, every library opens sorted by "Most recent".</p>
                    </div>
                    <div className="field-group">
                      <label>On startup, open</label>
                      <div className="yesno">
                        <button type="button" className={settings.startupCategory === 'home' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, startupCategory: 'home' }))}>Home dashboard</button>
                        <button type="button" className={settings.startupCategory === 'last' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, startupCategory: 'last' }))}>Last used category</button>
                        <button type="button" className={settings.startupCategory === 'first' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, startupCategory: 'first' }))}>First category</button>
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Item templates</label>
                      <p className="hint">When you save a template from the Add panel ("Save as template"), new items in that category prefill status / tags / (games: platforms · ownership · source). Clear one below.</p>
                      {(() => {
                        const entries = Object.entries(settings.itemTemplates ?? {})
                          .filter(([id]) => CATEGORIES.some((c) => c.id === id))
                        if (entries.length === 0) {
                          return <p className="hint" style={{ marginTop: 6, opacity: 0.7 }}>No templates saved yet.</p>
                        }
                        return (
                          <div className="library-toggle-list stacked" style={{ marginTop: 6 }}>
                            {entries.map(([id, t]) => {
                              const cat = CATEGORIES.find((c) => c.id === id)
                              if (!cat || !t) return null
                              const parts: string[] = []
                              if (t.gameStatus) parts.push(t.gameStatus.replace(/_/g, ' '))
                              if (t.watchStatus) parts.push(t.watchStatus.replace(/_/g, ' '))
                              if (t.seriesStatus) parts.push(t.seriesStatus.replace(/_/g, ' '))
                              if (t.mangaStatus) parts.push(t.mangaStatus.replace(/_/g, ' '))
                              if (t.bookStatus) parts.push(t.bookStatus.replace(/_/g, ' '))
                              if (t.visualNovelStatus) parts.push(t.visualNovelStatus.replace(/_/g, ' '))
                              if (t.consumed !== undefined) parts.push(t.consumed ? 'consumed' : 'unconsumed')
                              if (t.ownership) parts.push(t.ownership)
                              if (t.gameSource) parts.push(t.gameSource)
                              if (t.platforms && t.platforms.length > 0) parts.push(`platforms: ${t.platforms.join(', ')}`)
                              if (t.tags && t.tags.length > 0) parts.push(`tags: ${t.tags.join(', ')}`)
                              return (
                                <div key={id} className="library-toggle-row" style={{ justifyContent: 'space-between' }}>
                                  <span className="library-toggle-icon"><CategoryIcon id={id} /></span>
                                  <span style={{ flex: 1 }}>
                                    <b>{cat.label}</b>
                                    {parts.length > 0 && <span style={{ marginLeft: 8, color: 'var(--text-dim)', fontSize: 12 }}>{parts.join(' · ')}</span>}
                                  </span>
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => setSettings((s) => {
                                      const rest = { ...(s.itemTemplates ?? {}) }
                                      delete rest[id]
                                      return { ...s, itemTemplates: rest }
                                    })}
                                  >Clear</button>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </>
                )}

                {settingsTab === 'libraries' && (() => {
                  // VN is a category (has editor/save/fetcher) but visually
                  // belongs to Extras alongside Arcade. Filter it out of the
                  // main list; render it with the Extras toggles below.
                  const EXTRA_CAT_IDS = new Set(['visual_novels'])
                  const mainCats = CATEGORIES.filter((c) => !EXTRA_CAT_IDS.has(c.id))
                  const extraCats = CATEGORIES.filter((c) => EXTRA_CAT_IDS.has(c.id))
                  return (
                  <>
                    <div className="field-group">
                      <label>Enabled libraries</label>
                      <p className="hint">Uncheck a library to hide it from Home and insights. Your data is preserved even if you disable one.</p>
                      <div className="library-toggle-list">
                        {mainCats.map((cat) => {
                          const enabled = !settings.enabledCategories || settings.enabledCategories.includes(cat.id)
                          return (
                            <label key={cat.id} className="library-toggle-row">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => setSettings((s) => {
                                  const current = s.enabledCategories ?? CATEGORIES.map((c) => c.id)
                                  const next = enabled ? current.filter((id) => id !== cat.id) : [...current, cat.id]
                                  return { ...s, enabledCategories: next }
                                })}
                              />
                              <span className="library-toggle-icon"><CategoryIcon id={cat.id} /></span>
                              <span>{cat.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Extras</label>
                      <p className="hint">Optional sections that live outside the standard libraries. Disabling one only hides its sidebar entry — the data stays intact.</p>
                      <div className="library-toggle-list">
                        <label className="library-toggle-row">
                          <input
                            type="checkbox"
                            checked={settings.arcadeEnabled !== false}
                            onChange={() => setSettings((s) => ({ ...s, arcadeEnabled: s.arcadeEnabled === false ? true : false }))}
                          />
                          <span className="library-toggle-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="6" width="18" height="12" rx="2" />
                              <path d="M8 10v4M6 12h4" />
                              <circle cx="15" cy="11" r="1" fill="currentColor" />
                              <circle cx="17.5" cy="13.5" r="1" fill="currentColor" />
                            </svg>
                          </span>
                          <span>Arcade</span>
                        </label>
                        {extraCats.map((cat) => {
                          const enabled = !settings.enabledCategories || settings.enabledCategories.includes(cat.id)
                          return (
                            <label key={cat.id} className="library-toggle-row">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => setSettings((s) => {
                                  const current = s.enabledCategories ?? CATEGORIES.map((c) => c.id)
                                  const next = enabled ? current.filter((id) => id !== cat.id) : [...current, cat.id]
                                  return { ...s, enabledCategories: next }
                                })}
                              />
                              <span className="library-toggle-icon"><CategoryIcon id={cat.id} /></span>
                              <span>{cat.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    {visiblePlugins.length > 0 && (
                      <div className="field-group">
                        <label>Plugins</label>
                        <p className="hint">Optional libraries you've unlocked. Uncheck to hide from the sidebar again.</p>
                        <div className="library-toggle-list">
                          {visiblePlugins.map((plug) => {
                            const Icon = plug.icon
                            return (
                              <label key={plug.slug} className="library-toggle-row">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() => setSettings((s) => ({
                                    ...s,
                                    unlockedPlugins: (s.unlockedPlugins ?? []).filter((sl) => sl !== plug.slug),
                                  }))}
                                  title={`Uncheck to hide ${plug.label} again`}
                                />
                                <span className="library-toggle-icon"><Icon /></span>
                                <span>{plug.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                  )
                })()}

                {settingsTab === 'cards' && (
                  <div className="settings-grid-card">
                    <div className="settings-grid-2">
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Games</div>
                        <div className="pills">
                          {GAME_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.gameFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, gameFields: { ...s.gameFields, [f.value]: !s.gameFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Music</div>
                        <div className="pills">
                          {MUSIC_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.musicFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, musicFields: { ...s.musicFields, [f.value]: !s.musicFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Manga, Manhwa, Manhua &amp; Western Comics</div>
                        <div className="pills">
                          {MANGA_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.mangaFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, mangaFields: { ...s.mangaFields, [f.value]: !s.mangaFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Movies</div>
                        <div className="pills">
                          {MOVIE_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.movieFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, movieFields: { ...s.movieFields, [f.value]: !s.movieFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Anime</div>
                        <div className="pills">
                          {ANIME_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.animeFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, animeFields: { ...s.animeFields, [f.value]: !s.animeFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Series</div>
                        <div className="pills">
                          {SERIES_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.seriesFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, seriesFields: { ...s.seriesFields, [f.value]: !s.seriesFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Books</div>
                        <div className="pills">
                          {BOOK_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.bookFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, bookFields: { ...s.bookFields, [f.value]: !s.bookFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="settings-grid-item">
                        <div className="settings-grid-item-title">Visual Novels</div>
                        <div className="pills">
                          {VN_FIELD_OPTIONS.map((f) => (
                            <button key={f.value} type="button" className={settings.vnFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, vnFields: { ...s.vnFields, [f.value]: !s.vnFields[f.value] } }))}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      {visiblePlugins.filter((p) => p.cardFields && p.cardFields.length > 0).map((plug) => {
                        const overrides = settings.pluginCardFields?.[plug.slug] ?? {}
                        return (
                          <div key={plug.slug} className="settings-grid-item">
                            <div className="settings-grid-item-title">{plug.label}</div>
                            <div className="pills">
                              {plug.cardFields!.map((f) => {
                                const on = overrides[f.value] ?? f.default ?? true
                                return (
                                  <button
                                    key={f.value}
                                    type="button"
                                    className={on ? 'pill active' : 'pill'}
                                    onClick={() => setSettings((s) => ({
                                      ...s,
                                      pluginCardFields: {
                                        ...(s.pluginCardFields ?? {}),
                                        [plug.slug]: { ...(s.pluginCardFields?.[plug.slug] ?? {}), [f.value]: !on },
                                      },
                                    }))}
                                  >{f.label}</button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {settingsTab === 'data' && (
                  <>
                    <div className="settings-section-title">Backup &amp; restore</div>
                    <div className="field-group">
                      <label>Manual backup</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={handleExport}>⬇ Export backup</button>
                        <button type="button" className="secondary-btn" onClick={() => importInputRef.current?.click()}>⬆ Import backup</button>
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Pick the assets folder from your other Omnio install')
                          if (!dir) return
                          const r = await window.ipcRenderer.invoke('storage:import-assets-from', dir) as { ok: boolean; copied?: number; error?: string }
                          if (r?.ok) setToast(`Copied ${r.copied ?? 0} asset files into this install`)
                          else setToast(`Assets import failed: ${r?.error ?? 'unknown'}`)
                        }}>⬆ Import assets folder…</button>
                        <input type="file" accept="application/json" ref={importInputRef} style={{ display: 'none' }} onChange={handleImportFile} />
                      </div>
                      <p className="hint">Save your library as a single JSON file, or restore one you exported earlier. When migrating between installs (portable ↔ NSIS, dev ↔ portable) also use <strong>Import assets folder</strong> to copy the images so covers keep resolving.</p>
                    </div>
                    <div className="field-group">
                      <label>Scheduled auto-backup</label>
                      <div className="field-row">
                        <div className="field-group compact">
                          <label>Interval</label>
                          <select
                            value={settings.autoBackupInterval ?? 'off'}
                            onChange={(e) => setSettings((s) => ({ ...s, autoBackupInterval: e.target.value as 'off' | 'daily' | 'weekly' }))}
                          >
                            <option value="off">Off</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                        <div className="field-group compact" style={{ flex: 1 }}>
                          <label>Destination folder</label>
                          <div className="settings-actions">
                            <button type="button" className="secondary-btn" onClick={async () => {
                              const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Pick a folder for automatic backups')
                              if (dir) setSettings((s) => ({ ...s, autoBackupTarget: dir }))
                            }}>{settings.autoBackupTarget ? 'Change folder…' : 'Pick folder…'}</button>
                            {settings.autoBackupTarget && (
                              <button type="button" className="secondary-btn" onClick={() => setSettings((s) => ({ ...s, autoBackupTarget: undefined }))}>Clear</button>
                            )}
                          </div>
                          {settings.autoBackupTarget && <p className="hint" style={{ marginTop: 4 }}><code>{settings.autoBackupTarget}</code></p>}
                        </div>
                      </div>
                      <p className="hint">
                        Copies the whole <code>data/</code> + <code>assets/</code> tree to the destination on the chosen cadence — same routine as the Remote backup button, but automatic. The app checks hourly while running and fires the copy when enough time has passed since the last one. Great for pointing at a Dropbox / OneDrive / Syncthing folder that already syncs to another machine. Last auto-backup: {settings.autoBackupLastAt ? new Date(settings.autoBackupLastAt).toLocaleString() : 'never'}.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>Automatic snapshots</label>
                      <BackupList
                        onRestore={(file) => askConfirm(
                          `Restore ${file}? Your current library will be copied to data.pre-restore/ before it's replaced. You'll need to restart Omnio to see the restored data.`,
                          async () => {
                            const ok = await window.ipcRenderer.invoke('data:restore-backup', file)
                            if (ok) setToast('Restored — restart Omnio to load the snapshot')
                            else setToast('Restore failed')
                          },
                        )}
                      />
                    </div>
                    <div className="field-group">
                      <label>Remote backup</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose a folder inside Dropbox / OneDrive / Drive')
                          if (!dir) return
                          const r = await window.ipcRenderer.invoke('storage:copy-data-to', dir)
                          if (r?.ok) setToast(`Copied ${r.files} files to ${r.path}`)
                          else setToast(`Backup failed: ${r?.error ?? 'unknown'}`)
                        }}>Copy library to folder…</button>
                      </div>
                      <p className="hint">Pick a folder inside your cloud storage (Dropbox, OneDrive, Google Drive) — Omnio writes a timestamped copy of <code>data/</code> and <code>assets/</code> there and the cloud service handles the upload.</p>
                    </div>

                    <div className="settings-section-title">Import &amp; share</div>
                    <div className="field-group">
                      <label>Import from other trackers</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => setMalOpen(true)}>Import MAL / AniList XML</button>
                        <button type="button" className="secondary-btn" onClick={() => setGenericImportOpen(true)}>Import Excel / CSV / Notion / TXT</button>
                        <button type="button" className="secondary-btn" onClick={() => setSteamOpen(true)}>Import from Steam profile</button>
                        <button type="button" className="secondary-btn" onClick={() => setLetterboxdOpen(true)}>Import from Letterboxd</button>
                        <button type="button" className="secondary-btn" onClick={() => setBackloggdOpen(true)}>Import from Backloggd</button>
                        <button type="button" className="secondary-btn" onClick={() => setSerializdOpen(true)}>Import from Serializd</button>
                        <button type="button" className="secondary-btn" onClick={() => setSpotifyOpen(true)}>Import Spotify library</button>
                        <button type="button" className="secondary-btn" onClick={() => setHighlightsImportOpen(true)}>Import Kindle highlights</button>
                        <button type="button" className="secondary-btn" onClick={() => setLastfmImportOpen(true)}>Import Last.fm scrobbles</button>
                        <button type="button" className="secondary-btn" onClick={() => setTraktImportOpen(true)}>Import from Trakt.tv</button>
                        <button type="button" className="secondary-btn" onClick={() => setDiscogsImportOpen(true)}>Import Discogs collection</button>
                        <button type="button" className="secondary-btn" onClick={() => setStoryGraphOpen(true)}>Import from StoryGraph</button>
                        <button type="button" className="secondary-btn" onClick={() => setImdbOpen(true)}>Import from IMDb</button>
                        <button type="button" className="secondary-btn" onClick={() => setRymOpen(true)}>Import from RateYourMusic</button>
                        <button type="button" className="secondary-btn" onClick={() => setHltbOpen(true)}>Import HowLongToBeat times</button>
                        <button type="button" className="secondary-btn" onClick={() => setDiscographyCheckerOpen(true)}>Check music discography completion</button>
                        <button type="button" className="secondary-btn" onClick={() => setInstallScanOpen(true)}>Detect installed games (Steam / GOG / Epic)</button>
                      </div>
                      <p className="hint">Steam import reads a public profile via the community XML endpoint — no API key. Letterboxd accepts the CSVs from your account export (Settings → Data → Export on letterboxd.com). Kindle highlights import parses <code>My Clippings.txt</code> from your Kindle's <code>documents/</code> folder and attaches each highlight to a matching book (or creates one). Playtime and status pre-fill; open each item afterwards to fetch cover + metadata via IGDB or SteamGridDB / TMDb.</p>
                    </div>
                    <div className="field-group">
                      <label>Export to other trackers</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const { buildAnimeMalXml, downloadBlob } = await import('./MalExporter')
                          downloadBlob('omnio-anime.xml', 'application/xml', buildAnimeMalXml(items))
                        }}>⬇ Export Anime (MAL XML)</button>
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const { buildMangaMalXml, downloadBlob } = await import('./MalExporter')
                          downloadBlob('omnio-manga.xml', 'application/xml', buildMangaMalXml(items))
                        }}>⬇ Export Manga (MAL XML)</button>
                      </div>
                      <p className="hint">Bulk-load titles from other places. MAL/AniList uses the XML export; the generic importer takes an .xlsx, .csv (including Notion database exports), .tsv or .txt file with one title per line.</p>
                    </div>
                    <div className="field-group">
                      <label>Share your library</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => setWrappedOpen(true)}>Yearly wrapped</button>
                        <button type="button" className="secondary-btn" onClick={() => setCoverWallOpen(true)}>Cover wall export</button>
                        <select value={exportScope} onChange={(e) => setExportScope(e.target.value)} style={{ maxWidth: 200 }}>
                          <option value="all">All libraries</option>
                          {CATEGORIES.filter((c) => !settings.enabledCategories || settings.enabledCategories.includes(c.id)).map((c) => (
                            <option key={c.id} value={c.id}>{c.label} only</option>
                          ))}
                        </select>
                        <button type="button" className="secondary-btn" disabled={exporting} onClick={async () => {
                          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose where to export your Omnio site')
                          if (!dir) return
                          setExporting(true)
                          const scopedItems = exportScope === 'all' ? items : items.filter((i) => i.categoryId === exportScope)
                          const scopedArtists = exportScope === 'musica' || exportScope === 'all' ? musicArtists : []
                          const scopeLabel = exportScope === 'all' ? 'My Omnio Library' : `My ${CATEGORIES.find((c) => c.id === exportScope)?.label ?? ''} library`
                          const html = buildStaticSiteHtml(scopedItems, scopedArtists, scopeLabel)
                          const r = await window.ipcRenderer.invoke('export:site', dir, html)
                          setExporting(false)
                          if (r?.ok) setToast(`Exported to ${r.path}`)
                          else setToast(`Export failed: ${r?.error ?? 'unknown'}`)
                        }}>{exporting ? 'Exporting…' : 'Export as HTML'}</button>
                        <button type="button" className="secondary-btn" disabled={exporting} onClick={async () => {
                          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose where to save the CSV files')
                          if (!dir) return
                          setExporting(true)
                          const scopedItems = exportScope === 'all' ? items : items.filter((i) => i.categoryId === exportScope)
                          const scopedArtists = exportScope === 'musica' || exportScope === 'all' ? musicArtists : []
                          const files = buildCsvExports(scopedItems, scopedArtists, exportScope)
                          const fileCount = Object.keys(files).length
                          if (fileCount === 0) { setExporting(false); setToast('Nothing to export'); return }
                          const r = await window.ipcRenderer.invoke('export:csv', dir, files)
                          setExporting(false)
                          if (r?.ok) setToast(`Wrote ${r.count} CSV file${r.count === 1 ? '' : 's'} to ${r.path}`)
                          else setToast(`Export failed: ${r?.error ?? 'unknown'}`)
                        }}>Export as CSV</button>
                      </div>
                      <p className="hint">Wrapped is a year-in-review view. HTML export builds a standalone <code>index.html</code> and copies your <code>assets/</code> folder — send the folder to a friend and it just opens. CSV export drops one file per category so spreadsheets/BI tools can round-trip your library. Scope defaults to the whole library; pick a single library to share just that one.</p>
                    </div>
                  </>
                )}

                {settingsTab === 'integrations' && (
                  <>
                    <div className="settings-section-title">Network</div>
                    <div className="field-group">
                      <label>HTTP proxy (optional)</label>
                      <input
                        type="text"
                        placeholder="http://user:pass@host:port"
                        value={settings.httpProxy ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, httpProxy: e.target.value }))}
                        onBlur={() => window.ipcRenderer.invoke('proxy:apply', settings.httpProxy ?? '').then((r) => {
                          setToast(r?.ok ? (settings.httpProxy ? 'Proxy applied' : 'Proxy cleared') : `Proxy failed: ${r?.error ?? 'unknown'}`)
                        })}
                      />
                      <p className="hint">
                        Routes every outbound request from Omnio (metadata fetchers, cover downloads, in-app updater) through the given HTTP(S) proxy. Useful for Docker / NAS deployments behind a corporate firewall or a Pi-hole. Leave empty for a direct connection. Takes effect on blur; also re-applied on every startup.
                      </p>
                    </div>
                    <div className="settings-section-title">Integrations · API keys</div>
                    {/* Sorted alphabetically by service name so users can scan the list. */}
                    <div className="field-group">
                      <label>AniDB client name (Anime · Donghua)</label>
                      <input
                        type="text"
                        placeholder="e.g. omnio"
                        value={settings.anidbClient ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, anidbClient: e.target.value }))}
                      />
                      <p className="hint">
                        AniDB's HTTP API requires a client name registered at <code>anidb.net/software/add</code>.
                        Enter the name here to enable the AniDB deep-fetch button in the anime / donghua editors. Deep metadata (creators per episode, weighted tags, cross-refs) — coexists with AniList / MAL / Kitsu. Rate-limited to one request per two seconds per AniDB's terms.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>ComicVine (Western Comics)</label>
                      <input
                        type="password"
                        placeholder="Paste your ComicVine key…"
                        value={settings.comicvineApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, comicvineApiKey: e.target.value }))}
                      />
                      <p className="hint">Free key at <code>comicvine.gamespot.com/api/</code> — Marvel, DC, Image, indies.</p>
                    </div>
                    <div className="field-group">
                      <label>IGDB (Games — full metadata) — Twitch Client ID + Secret</label>
                      <input
                        type="text"
                        placeholder="Client ID"
                        value={settings.igdbClientId ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, igdbClientId: e.target.value }))}
                      />
                      <input
                        type="password"
                        placeholder="Client Secret"
                        value={settings.igdbClientSecret ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, igdbClientSecret: e.target.value }))}
                        style={{ marginTop: 6 }}
                      />
                      <p className="hint">Free Twitch app at <code>dev.twitch.tv/console/apps</code> (Application Integration, any localhost redirect).</p>
                    </div>
                    <div className="field-group">
                      <label>SteamGridDB (Games — covers / banners / logos)</label>
                      <input
                        type="password"
                        placeholder="Paste your SteamGridDB key…"
                        value={settings.sgdbApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, sgdbApiKey: e.target.value }))}
                      />
                      <p className="hint">Free key at <code>steamgriddb.com/profile/preferences/api</code>.</p>
                    </div>
                    <div className="field-group">
                      <label>TMDb (Movies + Series)</label>
                      <input
                        type="password"
                        placeholder="Paste your TMDb v3 API key…"
                        value={settings.tmdbApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, tmdbApiKey: e.target.value }))}
                      />
                      <p className="hint">Free v3 key at <code>themoviedb.org/settings/api</code>.</p>
                    </div>
                    <p className="hint" style={{ marginTop: -6 }}>AniList, Kitsu, MangaDex, MusicBrainz, MyAnimeList and VGMdb need no key — they work out of the box.</p>

                    <div className="settings-section-title">Updates</div>
                    <div className="field-group">
                      <label>Check for updates</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => runUpdateCheck(false)} disabled={updateCheckState === 'checking'}>
                          {updateCheckState === 'checking' ? 'Checking…' : 'Check for updates'}
                        </button>
                        {updateInfo?.matchedAssetUrl && (
                          <button type="button" className="secondary-btn" onClick={startAssistedDownload}>
                            ⬇ Update to {updateInfo.latest}
                          </button>
                        )}
                        {updateInfo && (
                          <button type="button" className="secondary-btn" onClick={() => { if (updateInfo.htmlUrl) invoke('updates:open-url', updateInfo.htmlUrl) }}>
                            ↗ Open release page
                          </button>
                        )}
                      </div>
                      {updateCheckState === 'up-to-date' && !updateInfo && (
                        <p className="hint">You're on the latest — v{APP_VERSION}.</p>
                      )}
                      {updateCheckState === 'error' && (
                        <p className="hint" style={{ color: 'var(--danger)' }}>Couldn't reach GitHub: {updateCheckError}</p>
                      )}
                      {updateInfo && (
                        <p className="hint">Omnio {updateInfo.latest} released. You're on {updateInfo.current}. Downloads work for portable, NSIS, DMG, AppImage — pick your build on the release page.</p>
                      )}
                    </div>
                  </>
                )}

                {settingsTab === 'maintenance' && (
                  <>
                    <div className="settings-section-title">Maintenance</div>
                    {/* Grouped as three sub-sections so 9 buttons + hints
                        don't read as a wall. Each row is a compact card:
                        title + one-line description on the left, action
                        on the right, so the whole tab fits without a
                        second scroll for most users. */}
                    <div className="maintenance-group">
                      <div className="maintenance-group-title">Cleanup &amp; organization</div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Find duplicates</h4>
                          <p>Fuzzy-matches titles across every library and lets you merge or delete duplicates.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setDupOpen(true)}>Find similar titles</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Genre normalizer</h4>
                          <p>Merge variants that spell the same concept differently ("Sci-Fi" / "Science Fiction" / "Ciencia ficción"). Applies only to <code>genres[]</code>; <code>tags[]</code> untouched.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setGenreNormalizerOpen(true)}>Merge genres</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Role normalizer</h4>
                          <p>Same idea for band-member roles across every Music Artist — keeps the band-timeline color palette consistent.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setRoleNormalizerOpen(true)}>Merge roles</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Tag hierarchy</h4>
                          <p>Nest tags under a parent (e.g. <code>jrpg → turn-based</code>). Selecting the parent in Filters matches every descendant; item cards still show the leaf tag.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setTagHierarchyOpen(true)}>Edit hierarchy</button>
                      </div>
                    </div>

                    <div className="maintenance-group">
                      <div className="maintenance-group-title">Data integrity</div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Audit incomplete items</h4>
                          <p>Diagnostic scan — reports which core fields are missing per library (cover, rating, status, authors / developers, release year…). Non-destructive.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setAuditOpen(true)}>Scan items</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Find broken covers</h4>
                          <p>Lists every <code>cover</code> / <code>banner</code> / <code>logo</code> / <code>volume</code> / <code>photo</code> whose file is missing on disk. Pick and clear the reference to re-fetch cleanly.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const r = await window.ipcRenderer.invoke('storage:audit-broken-assets') as { ok: boolean; broken?: { itemId: string; itemTitle: string; category: string; field: string; rel: string }[]; error?: string }
                          if (!r?.ok) { setToast(`Audit failed: ${r?.error ?? 'unknown'}`); return }
                          const broken = r.broken ?? []
                          setBrokenAssets(broken)
                          setBrokenAssetsOpen(true)
                        }}>Scan files</button>
                      </div>
                    </div>

                    <div className="maintenance-group">
                      <div className="maintenance-group-title">Asset maintenance</div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Rename all assets to titles</h4>
                          <p>Sweeps <code>assets/</code> and renames every file to <code>[title] [kind].ext</code>. Handy after upgrading from an old UUID-named build.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const r = await window.ipcRenderer.invoke('storage:rename-all-assets') as { ok: boolean; renamed?: number; rewrites?: { from: string; to: string }[]; error?: string }
                          if (!r?.ok) { setToast(`Rename failed: ${r?.error ?? 'unknown'}`); return }
                          const rewrites = r.rewrites ?? []
                          if (rewrites.length === 0) { setToast('All assets already use title-based names'); return }
                          const map = new Map(rewrites.map((x) => [x.from, x.to]))
                          const swap = (v: string | undefined) => (v && map.has(v) ? map.get(v)! : v)
                          skipHistoryRef.current = true
                          setItems((list) => list.map((it) => ({
                            ...it,
                            cover: swap(it.cover),
                            bannerImage: swap(it.bannerImage),
                            bannerImage2: swap(it.bannerImage2),
                            logoImage: swap(it.logoImage),
                            volumeCovers: it.volumeCovers?.map((v) => ({ ...v, cover: swap(v.cover) ?? v.cover })),
                            singleCovers: it.singleCovers?.map((s) => ({ ...s, cover: swap(s.cover) ?? s.cover })),
                            editions: it.editions?.map((e) => ({ ...e, cover: swap(e.cover) ?? e.cover })),
                            bundleContents: it.bundleContents?.map((b) => ({ ...b, cover: swap(b.cover) ?? b.cover })),
                          })))
                          setMusicArtists((list) => list.map((a) => ({ ...a, photo: swap(a.photo), bannerImage: swap(a.bannerImage) })))
                          setCollections((list) => list.map((g) => ({ ...g, cover: swap(g.cover) ?? g.cover })))
                          setToast(`Renamed ${rewrites.length} asset${rewrites.length === 1 ? '' : 's'}`)
                        }}>Rename now</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Clean orphan assets</h4>
                          <p>Deletes files no item, group cover, or artist photo references anymore. Reclaims disk from fetched-and-discarded covers.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => askConfirm(
                          'Scan the assets/ folder and delete every file no item references anymore? Reclaims disk used by covers you fetched from an API and then discarded before saving.',
                          async () => {
                            const r = await window.ipcRenderer.invoke('storage:clean-orphan-assets')
                            if (!r?.ok) { setToast(`Scan failed: ${r?.error ?? 'unknown'}`); return }
                            if (r.removed > 0) setToast(`Removed ${r.removed} orphan${r.removed === 1 ? '' : 's'} · freed ${(r.bytes / 1024 / 1024).toFixed(2)} MB (${r.referenced} references / ${r.scanned} files scanned)`)
                            else setToast(`Nothing to clean · ${r.referenced} references / ${r.scanned} files on disk`)
                          },
                        )}>Scan &amp; delete</button>
                      </div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Clean migration leftovers</h4>
                          <p>Deletes one-shot safety nets from upgrades / restores (<code>data.pre-split.json</code>, <code>data.pre-restore/</code>). Rotating snapshots stay put.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={async () => {
                          const r = await window.ipcRenderer.invoke('storage:cleanup-migration-artifacts')
                          if (r?.removed > 0) setToast(`Freed ${(r.bytes / 1024).toFixed(1)} KB`)
                          else setToast('Nothing to clean')
                        }}>Delete backups</button>
                      </div>
                    </div>

                    <div className="maintenance-group">
                      <div className="maintenance-group-title">Reference</div>
                      <div className="maintenance-row">
                        <div className="maintenance-row-info">
                          <h4>Image upload guide</h4>
                          <p>Recommended aspect + dimensions for every image slot in the app. Every slot accepts PNG · JPG · WebP · GIF · AVIF · BMP · SVG.</p>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => setImageGuideOpen(true)}>Show guide</button>
                      </div>
                    </div>

                    <div className="settings-section-title">Danger zone</div>
                    <div className="field-group">
                      <label>Reset settings</label>
                      <button type="button" className="secondary-btn" onClick={() => askConfirm('Reset all settings to defaults? Your library data won’t be affected.', () => { setSettings(DEFAULT_SETTINGS); setLayout(DEFAULT_SETTINGS.defaultLayout); setToast('Settings reset') })}>Reset to defaults</button>
                    </div>
                    <div className="field-group">
                      <label>Delete all data</label>
                      <button type="button" className="danger-btn" onClick={handleWipeAll}>Delete all data</button>
                    </div>
                    <div className="field-group">
                      <label>About</label>
                      <div className="about-box">
                        <p className="about-title">Omnio <span className="about-version">v{APP_VERSION}</span></p>
                        <p className="about-tagline">A personal hobby backlog tracker for games, music, movies, series, anime, donghua, manga family, books and visual novels.</p>
                        <p className="about-line">Local-only. No accounts, no telemetry, no cloud. Your data lives on this machine.</p>
                        <p className="about-section-title">New in this release</p>
                        <ul className="about-changelog">
                          <li><b>Fedora / RHEL <code>.rpm</code> build</b> — Tauri v2's native <code>rpm</code> bundle target is on; the release ships <code>omnio-&lt;version&gt;-1.x86_64.rpm</code> next to the AppImage and <code>.deb</code>. Install with <code>sudo dnf install ./omnio-&lt;version&gt;-1.x86_64.rpm</code> on Fedora / RHEL / CentOS / Rocky / Alma / openSUSE / Amazon Linux 2023.</li>
                          <li><b>Arch AUR: <code>omnio-bin</code></b> — the release publishes a stamped PKGBUILD that repackages the upstream <code>.deb</code> for Arch and derivatives. <code>yay -S omnio-bin</code>.</li>
                          <li><b>winget: <code>TonyMontania.Omnio</code></b> — three installer entries (NSIS + MSI + portable ZIP), each with its own SHA256. <code>winget install TonyMontania.Omnio</code>.</li>
                          <li><b>In-app updater picks the right asset for every install variant</b> — the detector was broken for portable (looked for an env var that doesn't exist), MSI (no branch at all) and <code>.deb</code> (Linux always got AppImage). It now reads <code>current_exe()</code>, matches against Tauri v2's default install directories on Windows, and reads <code>/etc/os-release</code> on Linux to split <code>.deb</code> from <code>.rpm</code>. Portable users finally get the portable ZIP; MSI users get the MSI; Fedora users get the RPM.</li>
                        </ul>
                        <p className="about-line">
                          <a
                            href="https://github.com/TonyMontania/Omnio/releases"
                            className="about-releases-link"
                            onClick={(e) => { e.preventDefault(); invoke('updates:open-url', 'https://github.com/TonyMontania/Omnio/releases') }}
                          >Show all release notes →</a>
                        </p>
                        <p className="about-line about-stack">Built with Tauri · Rust · React · Vite · TypeScript</p>
                        <p className="about-line" style={{ marginTop: 8 }}>
                          Arcade → Grid mode adapted from{' '}
                          <a
                            href="https://github.com/doopu/1ccTracker"
                            className="about-releases-link"
                            onClick={(e) => { e.preventDefault(); invoke('updates:open-url', 'https://github.com/doopu/1ccTracker') }}
                          >doopu/1ccTracker</a>
                          .
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </div>
              </div>
            </>
          )}

          {specialView === 'none' && !activePluginSlug && (
            <>
              <div className="sub-tabs">
                <button className={subView === 'items' ? 'sub-tab active' : 'sub-tab'} onClick={() => { setSubView('items'); setActiveCollectionId(null); resetListControls() }}>
                  All {current?.label}
                </button>
                {activeCategory === 'musica' && (
                  <button className={subView === 'artists' ? 'sub-tab active' : 'sub-tab'} onClick={() => { setSubView('artists'); setActiveCollectionId(null); resetListControls() }}>
                    Artists
                  </button>
                )}
                <button className={subView === 'groups' ? 'sub-tab active' : 'sub-tab'} onClick={() => { setSubView('groups'); setActiveCollectionId(null); resetListControls() }}>
                  Groups
                </button>
              </div>

              {subView === 'artists' ? (
                <div className="content-scroll">
                  <div className="new-collection">
                    <input
                      placeholder="New artist name"
                      value={newArtistName}
                      onChange={(e) => setNewArtistName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddArtist() }}
                    />
                    <button type="button" onClick={handleAddArtist}>+ Add artist</button>
                    <select
                      className="sort-select"
                      value={folderSort}
                      onChange={(e) => setFolderSort(e.target.value as 'alpha' | 'recent')}
                      title="Sort artists"
                    >
                      <option value="alpha">Alphabetical</option>
                      <option value="recent">Most recent</option>
                    </select>
                  </div>
                  <div className={`folder-grid folder-grid-${classicLayout}`}>
                    {musicArtists.length === 0 && <p className="empty">No artists yet.</p>}
                    {[...musicArtists]
                      .sort((a, b) => folderSort === 'recent' ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : a.name.localeCompare(b.name))
                      .map((a) => (
                      <div key={a.id} className="folder-card" onClick={() => setViewingArtist(a)}>
                        <button className="delete" onClick={(e) => { e.stopPropagation(); handleDeleteArtist(a.id) }}>✕</button>
                        {a.photo
                          ? <img className="folder-photo circle" src={assetSrc(a.photo)} alt={a.name} />
                          : <div className="folder-photo circle placeholder">{a.name.slice(0, 1).toUpperCase()}</div>}
                        <h3>{a.name}</h3>
                        <span className="folder-count">{musicList.filter((m) => m.artist === a.name).length} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : showFolderListing ? (
                <div className="content-scroll">
                  <div className="new-collection">
                    <input
                      placeholder="New group name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCollection() }}
                    />
                    <button type="button" onClick={handleCreateCollection}>+ Create group</button>
                    <select
                      className="sort-select"
                      value={folderSort}
                      onChange={(e) => setFolderSort(e.target.value as 'alpha' | 'recent')}
                      title="Sort groups"
                    >
                      <option value="alpha">Alphabetical</option>
                      <option value="recent">Most recent</option>
                    </select>
                  </div>
                  <div className={`folder-grid folder-grid-${classicLayout}`}>
                    {categoryCollections.length === 0 && <p className="empty">You haven't created any groups here yet.</p>}
                    {[...categoryCollections]
                      .sort((a, b) => folderSort === 'recent' ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : a.name.localeCompare(b.name))
                      .map((c) => (
                      <div key={c.id} className="folder-card" onClick={() => { setActiveCollectionId(c.id); resetListControls(); setSortBy('custom') }}>
                        <button className="folder-edit" onClick={(e) => { e.stopPropagation(); openCollectionEditModal(c) }} title="Edit group">✎</button>
                        <button className="delete" onClick={(e) => { e.stopPropagation(); handleDeleteCollection(c.id) }}>✕</button>
                        {c.cover
                          ? <img className="folder-photo" src={assetSrc(c.cover)} alt={c.name} />
                          : <span className="folder-icon"><FolderIcon /></span>}
                        <h3>{c.name}</h3>
                        <span className="folder-count">{c.itemIds.length} {c.itemIds.length === 1 ? 'item' : 'items'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="toolbar">
                    <input
                      ref={searchInputRef}
                      className="search-input"
                      placeholder="Search by title... (Ctrl+F)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                      className="sort-select"
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                      title="Group items visually"
                      disabled={layout === 'kanban' || layout === 'timeline' || layout === 'diary'}
                    >
                      <option value="none">No grouping</option>
                      <option value="year">Group by year</option>
                      <option value="decade">Group by decade</option>
                      <option value="status">Group by status</option>
                      <option value="rating">Group by rating</option>
                    </select>
                    <select className="sort-select" value={sortBy} onChange={(e) => setSortByPersistent(e.target.value as SortBy)}>
                      <option value="recent">Most recent</option>
                      <option value="alpha">Alphabetical</option>
                      <option value="rating">Rating</option>
                      <option value="custom">{activeCollection ? 'Manual order' : 'Custom order'}</option>
                      {activeCategory === 'videojuegos' && <>
                        <option value="time">Time played</option>
                        <option value="hltbAsc">Shortest to beat</option>
                        <option value="hltbDesc">Longest to beat</option>
                        <option value="status">Status</option>
                        <option value="releaseAsc">Release date ↑</option>
                        <option value="releaseDesc">Release date ↓</option>
                      </>}
                      {activeCategory === 'musica' && <>
                        <option value="artist">By artist</option>
                        <option value="yearAsc">Release year ↑</option>
                        <option value="yearDesc">Release year ↓</option>
                        <option value="duration">Duration (longest)</option>
                      </>}
                      {activeCategory === 'peliculas' && <>
                        <option value="yearAsc">Release year ↑</option>
                        <option value="yearDesc">Release year ↓</option>
                        <option value="duration">Runtime (longest)</option>
                      </>}
                      {activeCategory === 'series' && <>
                        <option value="seriesStatus">Status</option>
                        <option value="episodes">Episodes watched</option>
                        <option value="yearAsc">Year ↑</option>
                        <option value="yearDesc">Year ↓</option>
                      </>}
                      {(activeCategory === 'anime' || activeCategory === 'donghua') && <>
                        <option value="animeStatus">Status</option>
                        <option value="episodes">Episodes watched</option>
                        <option value="yearAsc">Year ↑</option>
                        <option value="yearDesc">Year ↓</option>
                      </>}
                      {(activeCategory === 'manga' || activeCategory === 'manhwa' || activeCategory === 'manhua' || activeCategory === 'comics_west') && <>
                        <option value="mangaStatus">Status</option>
                        <option value="chapters">Chapters read</option>
                      </>}
                    </select>
                    <FiltersDropdown
                      availableTags={availableTags}
                      filterTags={filterTags}
                      onToggleTag={(t) => setFilterTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                      showStatus={showStatusFilter}
                      filterStatus={filterStatus}
                      onToggleStatus={(s) => setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                      showPlatform={isVideojuegos}
                      availablePlatforms={availablePlatforms}
                      filterPlatforms={filterPlatforms}
                      onTogglePlatform={(p) => setFilterPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                      showGenre={activeCategory === 'musica'}
                      availableGenres={availableGenres}
                      filterGenres={filterGenres}
                      onToggleGenre={(g) => setFilterGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])}
                      minRating={minRating}
                      onSetMinRating={setMinRating}
                      onClear={() => { setFilterTags([]); setFilterStatus([]); setFilterPlatforms([]); setFilterGenres([]); setMinRating(0) }}
                      tagTree={settings.tagTree}
                    />
                    <button
                      type="button"
                      className={deleteMode ? 'sort-select delete-mode-btn active' : 'sort-select delete-mode-btn'}
                      onClick={() => setDeleteMode((v) => !v)}
                      title={deleteMode ? 'Exit delete mode' : 'Enter delete mode — cards show a red ✕ to remove'}
                    >
                      {deleteMode ? '← Exit delete' : '✕ Delete'}
                    </button>
                  </div>

                  <div className="content-scroll">
                  {sortBy === 'custom' && <p className="hint drag-hint">Drag cards to reorder them.</p>}
                  {deleteMode && <p className="hint drag-hint" style={{ color: 'var(--danger)' }}>Delete mode — click the red ✕ on any card to remove it.</p>}

                  {layout === 'kanban' ? (
                    getUniversalStatusOptions(activeCategory).length === 0 ? (
                      <p className="hint">This library doesn't have a status enum, so the Kanban view isn't available. Switch to Grid or List.</p>
                    ) : (
                      <KanbanView
                        items={visibleItems}
                        categoryId={activeCategory}
                        onOpen={openEditPanel}
                        onSetStatus={(id, status) => {
                          setItems((prev) => prev.map((it) => {
                            if (it.id !== id) return it
                            return { ...it, ...patchItemStatus(it.categoryId, status) }
                          }))
                        }}
                      />
                    )
                  ) : layout === 'timeline' ? (
                    <TimelineView items={visibleItems} onOpen={openEditPanel} />
                  ) : layout === 'diary' ? (
                    <DiaryView items={visibleItems} onOpen={openEditPanel} />
                  ) : (() => {
                    // Group-by wrapper: bucket the visible items when the
                    // user picked a non-'none' groupBy, otherwise render
                    // them flat like before. Group keys are grouped in
                    // insertion order — sortBy still controls per-group
                    // order because `visibleItems` was already sorted.
                    if (groupBy === 'none') {
                      return (
                        <div className={`${layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}${deleteMode ? ' delete-mode' : ''}`}>
                          {visibleItems.length === 0 && (
                            itemsInCategory.length === 0 ? (
                              <div className="empty-state">
                                <div className="empty-state-icon"><CategoryIcon id={activeCategory} /></div>
                                <h3>Your {current?.label.toLowerCase()} library is empty</h3>
                                <p>Add your first {current?.singular ?? 'item'} to start tracking.</p>
                                <button className="add-btn" onClick={openAddPanel}>+ Add {current?.singular ?? 'item'}</button>
                              </div>
                            ) : (
                              <div className="empty-state small">
                                <p>No items match your filters.</p>
                                <button className="secondary-btn" onClick={() => { resetListControls() }}>Clear filters</button>
                              </div>
                            )
                          )}
                          {visibleItems.map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              layout={layout as 'list' | 'grid' | 'compact'}
                              onOpen={openEditPanel}
                              onDelete={handleDelete} onToggleFavorite={toggleItemFavorite}
                              onToggleSelect={toggleSelect}
                              selected={selectedIds.has(item.id)}
                              selectionActive={selectedIds.size > 0}
                              draggableEnabled={sortBy === 'custom'}
                              onDragStartItem={setDraggedId}
                              onDropItem={activeCollection ? handleReorder : handleReorderCategory}
                              gameFields={settings.gameFields}
                              musicFields={settings.musicFields}
                              mangaFields={settings.mangaFields}
                              movieFields={settings.movieFields}
                              animeFields={settings.animeFields}
                              seriesFields={settings.seriesFields}
                              bookFields={settings.bookFields}
                              vnFields={settings.vnFields}
                              onContextMenu={(it, x, y) => setCtxMenu({ item: it, x, y })}
                            />
                          ))}
                        </div>
                      )
                    }
                    // Grouped render — one section per group, each with
                    // its own header + ItemCard grid/list. Collapsed
                    // sections carry all their meta so the count line is
                    // still meaningful without expanding.
                    const groups = groupItems(visibleItems, groupBy, activeCategory)
                    return (
                      <div className="library-groups">
                        {groups.map(({ key, label, list }) => (
                          <section key={key} className="library-group">
                            <header className="library-group-header">
                              <span className="library-group-label">{label}</span>
                              <span className="library-group-count">{list.length}</span>
                            </header>
                            <div className={`${layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}${deleteMode ? ' delete-mode' : ''}`}>
                              {list.map((item) => (
                                <ItemCard
                                  key={item.id}
                                  item={item}
                                  layout={layout as 'list' | 'grid' | 'compact'}
                                  onOpen={openEditPanel}
                                  onDelete={handleDelete} onToggleFavorite={toggleItemFavorite}
                                  onToggleSelect={toggleSelect}
                                  selected={selectedIds.has(item.id)}
                                  selectionActive={selectedIds.size > 0}
                                  draggableEnabled={false}
                                  gameFields={settings.gameFields}
                                  musicFields={settings.musicFields}
                                  mangaFields={settings.mangaFields}
                                  movieFields={settings.movieFields}
                                  animeFields={settings.animeFields}
                                  seriesFields={settings.seriesFields}
                                  bookFields={settings.bookFields}
                                  vnFields={settings.vnFields}
                                  onContextMenu={(it, x, y) => setCtxMenu({ item: it, x, y })}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )
                  })()}
                  </div>
                </>
              )}
            </>
          )}
            </>
          )}
        </main>
        {panelOpen && (
          <>
            <div className="panel-backdrop">
            <aside className="detail-panel fullscreen">
              <div className="panel-header">
              <h3>{editingId ? `Edit ${current?.label}` : `Add ${current?.label}`}</h3>
              <div className="panel-header-actions">
                {!editingId && (
                  <button
                    type="button"
                    className="ghost"
                    title={`Save the current status / tags / platforms as the default for new ${current?.label ?? 'items'}`}
                    onClick={() => {
                      const template = captureCurrentTemplate()
                      setSettings((s) => ({
                        ...s,
                        itemTemplates: { ...(s.itemTemplates ?? {}), [activeCategory]: template },
                      }))
                      setToast(`Template saved for ${current?.label ?? 'this category'}`)
                    }}
                  >Save as template</button>
                )}
                <button className="panel-close" onClick={() => closePanel()}>✕</button>
              </div>
            </div>
            <>
                <div className="edit-columns">
                <aside className="edit-preview-col">
                  <div className="edit-preview-topbar">
                    <span className="edit-preview-label">Live preview</span>
                    {editingItem && <span className="edit-preview-added">Added {new Date(editingItem.createdAt).toLocaleDateString()}</span>}
                  </div>
                  <div className="edit-preview-toggle">
                    <button type="button" className={editPreviewMode === 'card' ? 'active' : ''} onClick={() => setEditPreviewMode('card')}>Card</button>
                    <button type="button" className={editPreviewMode === 'detail' ? 'active' : ''} onClick={() => setEditPreviewMode('detail')}>Detail</button>
                  </div>
                  {editPreviewMode === 'card' ? (
                    <div className="edit-preview-frame card-mode">
                      <ItemCard
                        item={previewItem}
                        layout="grid"
                        onOpen={() => { /* preview only */ }}
                        onDelete={() => { /* preview only */ }}
                        gameFields={settings.gameFields}
                        musicFields={settings.musicFields}
                        mangaFields={settings.mangaFields}
                        movieFields={settings.movieFields}
                        animeFields={settings.animeFields}
                        seriesFields={settings.seriesFields}
                        bookFields={settings.bookFields}
                        vnFields={settings.vnFields}
                      />
                    </div>
                  ) : (
                    <div className="edit-preview-frame">
                      <div className="edit-preview-detail">
                        {(isVideojuegos || activeCategory === 'peliculas' || activeCategory === 'series') && (
                          bannerImage || movieBanner
                            ? <div className="pd-banner"><img src={assetSrc(bannerImage || movieBanner)} alt="" />
                                {isVideojuegos && logoImage && (
                                  <img className="pd-logo" src={assetSrc(logoImage)} alt="" />
                                )}
                              </div>
                            : <div className="pd-banner">No banner
                                {isVideojuegos && logoImage && (
                                  <img className="pd-logo" src={assetSrc(logoImage)} alt="" />
                                )}
                              </div>
                        )}
                        {isVideojuegos && logoImage && !bannerImage && (
                          <div className="pd-logo-row"><img src={assetSrc(logoImage)} alt="" /></div>
                        )}
                        <div className="pd-cover-row">
                          <div className={activeCategory === 'musica' ? 'pd-cover square' : 'pd-cover'}>
                            {cover ? <img src={assetSrc(cover)} alt="" /> : <span>{(title || '?').charAt(0).toUpperCase()}</span>}
                          </div>
                          <div className="pd-info">
                            <h3 className="pd-title">{title || 'Untitled'}</h3>
                            {alternativeTitles.length > 0 && (
                              <p className="pd-line pd-alt">{alternativeTitles.join(' · ')}</p>
                            )}
                            {activeCategory === 'musica' && artist && <p className="pd-line pd-strong">{artist}</p>}
                            {rating > 0 && <p className="pd-line">★ {rating}</p>}
                            {(() => {
                              const parts: string[] = []
                              if (releaseDate) parts.push(String(new Date(releaseDate).getFullYear()))
                              else if (releaseYear) parts.push(releaseYear)
                              if (activeCategory === 'musica' && musicType) parts.push(musicType)
                              if (activeCategory === 'peliculas' && duration) parts.push(`${duration} min`)
                              return parts.length > 0 ? <p className="pd-line">{parts.join(' · ')}</p> : null
                            })()}
                            {isVideojuegos && playTime && <p className="pd-line">{playTime}h played</p>}
                            {isVideojuegos && gameStatus && <p className="pd-line pd-status">{gameStatus.replace('_', ' ')}</p>}
                            {activeCategory === 'peliculas' && consumed && <p className="pd-line pd-status">Watched{timesWatched && ` · ${timesWatched}x`}</p>}
                            {(activeCategory === 'anime' || activeCategory === 'donghua') && (
                              <>
                                {watchStatus && <p className="pd-line pd-status">{watchStatus.replace(/_/g, ' ')}</p>}
                                {(episodesWatched || totalEpisodes) && <p className="pd-line">Episodes: {episodesWatched || '0'}{totalEpisodes && ` / ${totalEpisodes}`}</p>}
                              </>
                            )}
                            {activeCategory === 'series' && (
                              <>
                                {seriesStatus && <p className="pd-line pd-status">{seriesStatus.replace(/_/g, ' ')}</p>}
                                {(episodesWatched || totalEpisodes) && <p className="pd-line">Episodes: {episodesWatched || '0'}{totalEpisodes && ` / ${totalEpisodes}`}</p>}
                              </>
                            )}
                            {isMangaLike(activeCategory) && (
                              <>
                                {readingStatus && <p className="pd-line pd-status">{readingStatus.replace(/_/g, ' ')}</p>}
                                {(chaptersRead || totalChapters) && <p className="pd-line">Chapters: {chaptersRead || '0'}{totalChapters && ` / ${totalChapters}`}</p>}
                                {(volumesRead || totalVolumesM) && <p className="pd-line">Volumes: {volumesRead || '0'}{totalVolumesM && ` / ${totalVolumesM}`}</p>}
                              </>
                            )}
                            {activeCategory === 'musica' && consumed && <p className="pd-line pd-status">Listened</p>}
                          </div>
                        </div>

                        {/* Category-specific field rows */}
                        {isVideojuegos && (
                          <div className="pd-fields">
                            {devs.length > 0 && <div className="pd-field-row"><span className="pd-key">Developers</span><span className="pd-val">{devs.join(', ')}</span></div>}
                            {publishers.length > 0 && <div className="pd-field-row"><span className="pd-key">Publishers</span><span className="pd-val">{publishers.join(', ')}</span></div>}
                            {platforms.length > 0 && <div className="pd-field-row"><span className="pd-key">Platforms</span><span className="pd-val">{platforms.join(', ')}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {ownership && <div className="pd-field-row"><span className="pd-key">Ownership</span><span className="pd-val">{ownership}</span></div>}
                            {gameSource && <div className="pd-field-row"><span className="pd-key">Source</span><span className="pd-val">{gameSource}</span></div>}
                            {franchise && <div className="pd-field-row"><span className="pd-key">Franchise</span><span className="pd-val">{franchise}</span></div>}
                            {(achievementsUnlocked || achievementsTotal) && <div className="pd-field-row"><span className="pd-key">Achievements</span><span className="pd-val">{achievementsUnlocked || '0'} / {achievementsTotal || '?'}</span></div>}
                            {ageRating && <div className="pd-field-row"><span className="pd-key">Age rating</span><span className="pd-val">{ageRating}</span></div>}
                            {hasDlc && dlcList.length > 0 && <div className="pd-field-row"><span className="pd-key">DLC</span><span className="pd-val">{dlcList.length}</span></div>}
                            {hasAddons && addonsList.length > 0 && <div className="pd-field-row"><span className="pd-key">Addons</span><span className="pd-val">{addonsList.length}</span></div>}
                            {isBundle && bundleContents.length > 0 && <div className="pd-field-row"><span className="pd-key">Bundle</span><span className="pd-val">{bundleContents.length} games</span></div>}
                          </div>
                        )}

                        {activeCategory === 'musica' && (
                          <div className="pd-fields">
                            {musicSource && <div className="pd-field-row"><span className="pd-key">Source</span><span className="pd-val">{musicSource}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {label && <div className="pd-field-row"><span className="pd-key">Label</span><span className="pd-val">{label}</span></div>}
                            {producers.length > 0 && <div className="pd-field-row"><span className="pd-key">Producers</span><span className="pd-val">{producers.join(', ')}</span></div>}
                            {partOfAlbum && <div className="pd-field-row"><span className="pd-key">Part of</span><span className="pd-val">{partOfAlbum}</span></div>}
                            {hasTracks && tracks.length > 0 && <div className="pd-field-row"><span className="pd-key">Tracks</span><span className="pd-val">{tracks.length}</span></div>}
                            {editions.length > 0 && <div className="pd-field-row"><span className="pd-key">Editions</span><span className="pd-val">{editions.length}</span></div>}
                            {singleCovers.length > 0 && <div className="pd-field-row"><span className="pd-key">Singles</span><span className="pd-val">{singleCovers.length}</span></div>}
                          </div>
                        )}

                        {activeCategory === 'peliculas' && (
                          <div className="pd-fields">
                            {directors.length > 0 && <div className="pd-field-row"><span className="pd-key">Directors</span><span className="pd-val">{directors.join(', ')}</span></div>}
                            {writers.length > 0 && <div className="pd-field-row"><span className="pd-key">Writers</span><span className="pd-val">{writers.join(', ')}</span></div>}
                            {cast.length > 0 && <div className="pd-field-row"><span className="pd-key">Cast</span><span className="pd-val">{cast.slice(0, 6).join(', ')}{cast.length > 6 && ` +${cast.length - 6}`}</span></div>}
                            {productionCompanies.length > 0 && <div className="pd-field-row"><span className="pd-key">Production</span><span className="pd-val">{productionCompanies.join(', ')}</span></div>}
                            {distributors.length > 0 && <div className="pd-field-row"><span className="pd-key">Distributed by</span><span className="pd-val">{distributors.join(', ')}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {movieSource && <div className="pd-field-row"><span className="pd-key">Source</span><span className="pd-val">{movieSource}</span></div>}
                            {franchise && <div className="pd-field-row"><span className="pd-key">Franchise</span><span className="pd-val">{franchise}</span></div>}
                            {contentRating && <div className="pd-field-row"><span className="pd-key">Content rating</span><span className="pd-val">{contentRating}</span></div>}
                            {watchedWhere && <div className="pd-field-row"><span className="pd-key">Watched on</span><span className="pd-val">{watchedWhere}</span></div>}
                          </div>
                        )}

                        {activeCategory === 'series' && (
                          <div className="pd-fields">
                            {directors.length > 0 && <div className="pd-field-row"><span className="pd-key">Directors</span><span className="pd-val">{directors.join(', ')}</span></div>}
                            {showrunners.length > 0 && <div className="pd-field-row"><span className="pd-key">Showrunners</span><span className="pd-val">{showrunners.join(', ')}</span></div>}
                            {writers.length > 0 && <div className="pd-field-row"><span className="pd-key">Writers</span><span className="pd-val">{writers.join(', ')}</span></div>}
                            {cast.length > 0 && <div className="pd-field-row"><span className="pd-key">Cast</span><span className="pd-val">{cast.slice(0, 6).join(', ')}{cast.length > 6 && ` +${cast.length - 6}`}</span></div>}
                            {network && <div className="pd-field-row"><span className="pd-key">Network</span><span className="pd-val">{network}</span></div>}
                            {country && <div className="pd-field-row"><span className="pd-key">Country</span><span className="pd-val">{country}</span></div>}
                            {language && <div className="pd-field-row"><span className="pd-key">Language</span><span className="pd-val">{language}</span></div>}
                            {seriesFormat && <div className="pd-field-row"><span className="pd-key">Format</span><span className="pd-val">{seriesFormat}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {contentRating && <div className="pd-field-row"><span className="pd-key">Content rating</span><span className="pd-val">{contentRating}</span></div>}
                            {hasSeasons && seasons.length > 0 && <div className="pd-field-row"><span className="pd-key">Seasons</span><span className="pd-val">{seasons.length}</span></div>}
                          </div>
                        )}

                        {(activeCategory === 'anime' || activeCategory === 'donghua') && (
                          <div className="pd-fields">
                            {studios.length > 0 && <div className="pd-field-row"><span className="pd-key">Studios</span><span className="pd-val">{studios.join(', ')}</span></div>}
                            {animeFormat && <div className="pd-field-row"><span className="pd-key">Format</span><span className="pd-val">{animeFormat}</span></div>}
                            {airingStatus && <div className="pd-field-row"><span className="pd-key">Airing</span><span className="pd-val">{airingStatus}</span></div>}
                            {(season || seasonYear) && <div className="pd-field-row"><span className="pd-key">Season</span><span className="pd-val">{season} {seasonYear}</span></div>}
                            {demographic && <div className="pd-field-row"><span className="pd-key">Demographic</span><span className="pd-val">{demographic}</span></div>}
                            {animeSource && <div className="pd-field-row"><span className="pd-key">Source</span><span className="pd-val">{animeSource}</span></div>}
                            {ageRating && <div className="pd-field-row"><span className="pd-key">Age rating</span><span className="pd-val">{ageRating}</span></div>}
                            {episodeDuration && <div className="pd-field-row"><span className="pd-key">Ep. duration</span><span className="pd-val">{episodeDuration} min</span></div>}
                            {(airedFrom || airedTo) && <div className="pd-field-row"><span className="pd-key">Aired</span><span className="pd-val">{airedFrom || '?'} → {airedTo || '?'}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {favoriteEpisode && <div className="pd-field-row"><span className="pd-key">Fav episode</span><span className="pd-val">#{favoriteEpisode}{favoriteEpisodeNote && ` — ${favoriteEpisodeNote}`}</span></div>}
                            {hasEpisodes && episodes.length > 0 && <div className="pd-field-row"><span className="pd-key">Episode list</span><span className="pd-val">{episodes.length}</span></div>}
                          </div>
                        )}

                        {isMangaLike(activeCategory) && (
                          <div className="pd-fields">
                            {mangaAuthors.length > 0 && <div className="pd-field-row"><span className="pd-key">Authors</span><span className="pd-val">{mangaAuthors.join(', ')}</span></div>}
                            {mangaArtists.length > 0 && <div className="pd-field-row"><span className="pd-key">Artists</span><span className="pd-val">{mangaArtists.join(', ')}</span></div>}
                            {magazine && <div className="pd-field-row"><span className="pd-key">Magazine</span><span className="pd-val">{magazine}</span></div>}
                            {pubStatus && <div className="pd-field-row"><span className="pd-key">Publication</span><span className="pd-val">{pubStatus.replace(/_/g, ' ')}</span></div>}
                            {mangaSource && <div className="pd-field-row"><span className="pd-key">Source</span><span className="pd-val">{mangaSource}</span></div>}
                            {(startYear || endYear) && <div className="pd-field-row"><span className="pd-key">Ran</span><span className="pd-val">{startYear || '?'} → {endYear || 'present'}</span></div>}
                            {genres.length > 0 && <div className="pd-field-row"><span className="pd-key">Genres</span><span className="pd-val">{genres.join(', ')}</span></div>}
                            {ageRating && <div className="pd-field-row"><span className="pd-key">Age rating</span><span className="pd-val">{ageRating}</span></div>}
                            {volumeCovers.length > 0 && <div className="pd-field-row"><span className="pd-key">Vol. covers</span><span className="pd-val">{volumeCovers.length}</span></div>}
                            {hasChapters && chapters.length > 0 && <div className="pd-field-row"><span className="pd-key">Chapter list</span><span className="pd-val">{chapters.length}</span></div>}
                          </div>
                        )}

                        {(description || mangaDescription || movieDescription || animeDescription || seriesDescription) && (
                          <div className="pd-section">
                            <span className="pd-section-label">Description</span>
                            <p className="pd-desc">{description || mangaDescription || movieDescription || animeDescription || seriesDescription}</p>
                          </div>
                        )}

                        {(gameReview || musicReview || movieReview || animeReview || seriesReview || mangaReview) && (
                          <div className="pd-section">
                            <span className="pd-section-label">Review{hasSpoilers ? ' — contains spoilers' : ''}</span>
                            <p className="pd-desc">{gameReview || musicReview || movieReview || animeReview || seriesReview || mangaReview}</p>
                          </div>
                        )}

                        {notes && (
                          <div className="pd-section">
                            <span className="pd-section-label">Notes</span>
                            <div className="pd-desc" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(notes) }} />
                          </div>
                        )}

                        {relatedItems.length > 0 && (
                          <div className="pd-field-row"><span className="pd-key">Related</span><span className="pd-val">{relatedItems.length} item{relatedItems.length !== 1 ? 's' : ''}</span></div>
                        )}
                        {recommendedItems.length > 0 && (
                          <div className="pd-field-row"><span className="pd-key">Recommendations</span><span className="pd-val">{recommendedItems.length}</span></div>
                        )}
                        {rewatches.length > 0 && (
                          <div className="pd-field-row"><span className="pd-key">History log</span><span className="pd-val">{rewatches.length} entr{rewatches.length !== 1 ? 'ies' : 'y'}</span></div>
                        )}

                        {tags.length > 0 && (
                          <div className="pd-tags">
                            {tags.map((t) => <span key={t} className="pd-tag">{t}</span>)}
                          </div>
                        )}
                        {editingId && (() => {
                          const groups = categoryCollections.filter((c) => c.itemIds.includes(editingId))
                          return groups.length > 0 ? (
                            <div className="pd-field-row"><span className="pd-key">Groups</span><span className="pd-val">{groups.map((g) => g.name).join(', ')}</span></div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}
                </aside>
                <div className="edit-form-col">

                  <div className="editor-tabs-bar" role="tablist">
                    {(['overview','identity','progress','media','history','related','notes'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        className={editorTab === tab ? 'editor-tab active' : 'editor-tab'}
                        onClick={() => setEditorTab(tab)}
                      >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                    ))}
                  </div>

                  <div className="form" data-editor-tab={editorTab}>
                    <div className="metadata-sources-panel">
                      <div className="metadata-sources-header">
                        <span className="metadata-sources-title">↗ Fetch metadata</span>
                        <span className="metadata-sources-hint">Auto-fills title, cover, and category-specific fields</span>
                      </div>
                      <div className="metadata-sources-grid">
                        {/* Iterated from the fetcher registry — see
                            src/fetchers/registrations.tsx. Alphabetical by
                            label so ordering stays stable regardless of
                            registration order. */}
                        {getFetchersFor(activeCategory)
                          .slice()
                          .sort((a: FetcherRegistration, b: FetcherRegistration) => a.label.localeCompare(b.label))
                          .map((reg) => (
                            <button
                              key={reg.id}
                              type="button"
                              className="metadata-source-btn"
                              onClick={() => setActiveFetcher(reg.id)}
                            >
                              <span className="ms-name">↗ {reg.label}</span>
                              <span className="ms-desc">{resolveHint(reg, activeCategory)}</span>
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="form-section-header" data-belongs-to="overview">
                      <span className="form-section-title">Basic info</span>
                    </div>
                    <div className="field-group">
                      <label>Title</label>
                      <input
                        placeholder="Title — or paste an IGDB / TMDb / AniList / VNDB / MangaDex / OpenLibrary / Steam URL"
                        value={title}
                        onChange={(e) => {
                          const v = e.target.value
                          // Paste-a-URL shortcut: if the new value is a
                          // supported metadata URL and the current category
                          // has that fetcher wired, humanize the slug into
                          // the title field and open the fetcher so the
                          // user goes straight to picking a result.
                          const available = getFetchersFor(activeCategory).map((r) => r.id)
                          const match = detectQuickAddUrl(v, available)
                          if (match) {
                            setTitle(match.query)
                            setActiveFetcher(match.fetcherId)
                            setToast(`Opening ${match.source} search…`)
                          } else {
                            setTitle(v)
                          }
                        }}
                      />
                    </div>

                    <div className="form-section-header" data-belongs-to="media">
                      <span className="form-section-title">Media</span>
                      <span className="form-section-hint">
                        {isVideojuegos ? 'Cover · banner · logo'
                          : (activeCategory === 'peliculas' || activeCategory === 'series') ? 'Cover · backdrop'
                          : (isAnime || isMangaLike(activeCategory)) ? 'Cover · banner'
                          : 'Cover'}
                      </span>
                    </div>
                    <div className="field-group image-drop" {...imageDropHandlers(setCover)}>
                      <label>Cover</label>
                      <input
                        placeholder={cover.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL · drop here to upload'}
                        value={cover.startsWith('data:') ? '' : cover}
                        onChange={(e) => setCover(e.target.value)}
                      />
                      <div className="upload-row">
                        <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()}>Upload from PC</button>
                        {isVideojuegos && <button type="button" className="upload-btn" onClick={() => setSgdbOpen('grids')} title="Fetch from SteamGridDB">↗ SteamGridDB</button>}
                        {cover && <button type="button" className="upload-btn clear" onClick={() => setCover('')}>Clear</button>}
                      </div>
                      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCoverFile} />
                    </div>

                    {(activeCategory === 'peliculas' || isSeriesLike) && (
                      <div className="field-group image-drop" {...imageDropHandlers(setMovieBanner)}>
                        <label>Backdrop image</label>
                        <input
                          placeholder={movieBanner.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                          value={movieBanner.startsWith('data:') ? '' : movieBanner}
                          onChange={(e) => setMovieBanner(e.target.value)}
                        />
                        <div className="upload-row">
                          <button type="button" className="upload-btn" onClick={() => movieBannerFileInputRef.current?.click()}>Upload from PC</button>
                          {movieBanner && <button type="button" className="upload-btn clear" onClick={() => setMovieBanner('')}>Clear</button>}
                        </div>
                        <input type="file" accept="image/*" ref={movieBannerFileInputRef} style={{ display: 'none' }} onChange={handleMovieBannerFile} />
                      </div>
                    )}

                    {(isAnime || isMangaLike(activeCategory)) && (
                      <div className="field-group image-drop" {...imageDropHandlers(setBannerImage)}>
                        <label>Banner image</label>
                        <input
                          placeholder={bannerImage.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                          value={bannerImage.startsWith('data:') ? '' : bannerImage}
                          onChange={(e) => setBannerImage(e.target.value)}
                        />
                        <div className="upload-row">
                          <button type="button" className="upload-btn" onClick={() => bannerFileInputRef.current?.click()}>Upload from PC</button>
                          {bannerImage && <button type="button" className="upload-btn clear" onClick={() => setBannerImage('')}>Clear</button>}
                        </div>
                        <input type="file" accept="image/*" ref={bannerFileInputRef} style={{ display: 'none' }} onChange={handleBannerFile} />
                      </div>
                    )}

                    {isVideojuegos && (
                      <>
                        <div className="field-group image-drop" {...imageDropHandlers(setBannerImage)}>
                          <label>Banner image</label>
                          <input
                            placeholder={bannerImage.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                            value={bannerImage.startsWith('data:') ? '' : bannerImage}
                            onChange={(e) => setBannerImage(e.target.value)}
                          />
                          <div className="upload-row">
                            <button type="button" className="upload-btn" onClick={() => bannerFileInputRef.current?.click()}>Upload from PC</button>
                            <button type="button" className="upload-btn" onClick={() => setSgdbOpen('heroes')} title="Fetch from SteamGridDB">↗ SteamGridDB</button>
                            {bannerImage && <button type="button" className="upload-btn clear" onClick={() => setBannerImage('')}>Clear</button>}
                          </div>
                          <input type="file" accept="image/*" ref={bannerFileInputRef} style={{ display: 'none' }} onChange={handleBannerFile} />
                        </div>
                        <div className="field-group image-drop" {...imageDropHandlers(setLogoImage)}>
                          <label>Logo image</label>
                          <input
                            placeholder={logoImage.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                            value={logoImage.startsWith('data:') ? '' : logoImage}
                            onChange={(e) => setLogoImage(e.target.value)}
                          />
                          <div className="upload-row">
                            <button type="button" className="upload-btn" onClick={() => logoFileInputRef.current?.click()}>Upload from PC</button>
                            <button type="button" className="upload-btn" onClick={() => setSgdbOpen('logos')} title="Fetch from SteamGridDB">↗ SteamGridDB</button>
                            {logoImage && <button type="button" className="upload-btn clear" onClick={() => setLogoImage('')}>Clear</button>}
                          </div>
                          <input type="file" accept="image/*" ref={logoFileInputRef} style={{ display: 'none' }} onChange={handleLogoFile} />
                        </div>
                      </>
                    )}

                    {isVideojuegos && (
                      <GameEditorSection
                        title={title}
                        editingId={editingId}
                        items={items}
                        activeCategory={activeCategory}
                        relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                        devs={devs} setDevs={setDevs}
                        publishers={publishers} setPublishers={setPublishers}
                        achievementsUnlocked={achievementsUnlocked} setAchievementsUnlocked={setAchievementsUnlocked}
                        achievementsTotal={achievementsTotal} setAchievementsTotal={setAchievementsTotal}
                        releaseDate={releaseDate} setReleaseDate={setReleaseDate}
                        description={description} setDescription={setDescription}
                        platforms={platforms} setPlatforms={setPlatforms}
                        ownership={ownership} setOwnership={setOwnership}
                        gameStatus={gameStatus} setGameStatus={setGameStatus}
                        playTime={playTime} handlePlayTimeChange={handlePlayTimeChange}
                        hltbHours={hltbHours} setHltbHours={setHltbHours}
                        hasDlc={hasDlc} setHasDlc={setHasDlc} dlcList={dlcList} setDlcList={setDlcList}
                        hasAddons={hasAddons} setHasAddons={setHasAddons} addonsList={addonsList} setAddonsList={setAddonsList}
                        isBundle={isBundle} setIsBundle={setIsBundle} bundleContents={bundleContents} setBundleContents={setBundleContents} setBundleSgdbFor={setBundleSgdbFor}
                        pcgwPage={pcgwPage} setPcgwPage={setPcgwPage}
                        saveFiles={saveFiles} setSaveFiles={setSaveFiles}
                        achievementsList={achievementsList} setAchievementsList={setAchievementsList}
                        screenshots={screenshots} setScreenshots={setScreenshots}
                        rating={rating} setRating={setRating}
                        finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                        alternativeTitles={alternativeTitles} setAlternativeTitles={setAlternativeTitles}
                        genres={genres} setGenres={setGenres}
                        gameSource={gameSource} setGameSource={setGameSource}
                        ageRating={ageRating} setAgeRating={setAgeRating}
                        originalWorkId={originalWorkId} setOriginalWorkId={setOriginalWorkId}
                        franchise={franchise} setFranchise={setFranchise}
                        gameReview={gameReview} setGameReview={setGameReview}
                        hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                        rewatches={rewatches} setRewatches={setRewatches}
                        relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                        recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                      />
                    )}

                    {activeCategory === 'peliculas' && (
                      <MovieEditorSection
                        editingId={editingId}
                        items={items}
                        relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                        directors={directors} setDirectors={setDirectors}
                        writers={writers} setWriters={setWriters}
                        cast={cast} setCast={setCast}
                        productionCompanies={productionCompanies} setProductionCompanies={setProductionCompanies}
                        distributors={distributors} setDistributors={setDistributors}
                        movieDescription={movieDescription} setMovieDescription={setMovieDescription}
                        genres={genres} setGenres={setGenres}
                        releaseDate={releaseDate} setReleaseDate={setReleaseDate}
                        releaseYear={releaseYear} setReleaseYear={setReleaseYear}
                        duration={duration} setDuration={setDuration}
                        franchise={franchise} setFranchise={setFranchise}
                        consumed={consumed} setConsumed={setConsumed}
                        timesWatched={timesWatched} setTimesWatched={setTimesWatched}
                        watchedWhere={watchedWhere} setWatchedWhere={setWatchedWhere}
                        rating={rating} setRating={setRating}
                        finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                        alternativeTitles={alternativeTitles} setAlternativeTitles={setAlternativeTitles}
                        movieSource={movieSource} setMovieSource={setMovieSource}
                        contentRating={contentRating} setContentRating={setContentRating}
                        movieReview={movieReview} setMovieReview={setMovieReview}
                        hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                        rewatches={rewatches} setRewatches={setRewatches}
                        relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                        recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                        yearHandler={yearHandler}
                        intHandler={intHandler}
                      />
                    )}

                    {isSeriesLike && (
                      <SeriesEditorSection
                        editingId={editingId}
                        items={items}
                        relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                        seriesDescription={seriesDescription} setSeriesDescription={setSeriesDescription}
                        directors={directors} setDirectors={setDirectors}
                        showrunners={showrunners} setShowrunners={setShowrunners}
                        writers={writers} setWriters={setWriters}
                        cast={cast} setCast={setCast}
                        genres={genres} setGenres={setGenres}
                        seriesStatus={seriesStatus} setSeriesStatus={setSeriesStatus}
                        seriesFormat={seriesFormat} setSeriesFormat={setSeriesFormat}
                        network={network} setNetwork={setNetwork}
                        watchedWhere={watchedWhere} setWatchedWhere={setWatchedWhere}
                        country={country} setCountry={setCountry}
                        language={language} setLanguage={setLanguage}
                        contentRating={contentRating} setContentRating={setContentRating}
                        unitCount={unitCount} handleUnitCountChange={handleUnitCountChange}
                        totalEpisodes={totalEpisodes} setTotalEpisodes={setTotalEpisodes}
                        episodesWatched={episodesWatched} setEpisodesWatched={setEpisodesWatched}
                        episodeDuration={episodeDuration} setEpisodeDuration={setEpisodeDuration}
                        startYear={startYear} setStartYear={setStartYear}
                        endYear={endYear} setEndYear={setEndYear}
                        airedFrom={airedFrom} setAiredFrom={setAiredFrom}
                        airedTo={airedTo} setAiredTo={setAiredTo}
                        startDate={startDate} setStartDate={setStartDate}
                        finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                        franchise={franchise} setFranchise={setFranchise}
                        rating={rating} setRating={setRating}
                        seriesReview={seriesReview} setSeriesReview={setSeriesReview}
                        hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                        rewatches={rewatches} setRewatches={setRewatches}
                        relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                        recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                        hasSeasons={hasSeasons} setHasSeasons={setHasSeasons}
                        seasons={seasons} setSeasons={setSeasons}
                        yearHandler={yearHandler}
                        intHandler={intHandler}
                      />
                    )}

                {isAnime && (
                  <AnimeEditorSection
                    editingId={editingId}
                    activeCategory={activeCategory}
                    items={items}
                    relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                    studios={studios} setStudios={setStudios}
                    animeDescription={animeDescription} setAnimeDescription={setAnimeDescription}
                    genres={genres} setGenres={setGenres}
                    animeFormat={animeFormat} setAnimeFormat={setAnimeFormat}
                    season={season} setSeason={setSeason}
                    seasonYear={seasonYear} setSeasonYear={setSeasonYear}
                    demographic={demographic} setDemographic={setDemographic}
                    watchStatus={watchStatus} setWatchStatus={setWatchStatus}
                    airingStatus={airingStatus} setAiringStatus={setAiringStatus}
                    airingDay={airingDay} setAiringDay={setAiringDay}
                    episodesWatched={episodesWatched} setEpisodesWatched={setEpisodesWatched}
                    totalEpisodes={totalEpisodes} setTotalEpisodes={setTotalEpisodes}
                    startDate={startDate} setStartDate={setStartDate}
                    finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                    rating={rating} setRating={setRating}
                    alternativeTitles={alternativeTitles} setAlternativeTitles={setAlternativeTitles}
                    animeSource={animeSource} setAnimeSource={setAnimeSource}
                    ageRating={ageRating} setAgeRating={setAgeRating}
                    episodeDuration={episodeDuration} setEpisodeDuration={setEpisodeDuration}
                    airedFrom={airedFrom} setAiredFrom={setAiredFrom}
                    airedTo={airedTo} setAiredTo={setAiredTo}
                    favoriteEpisode={favoriteEpisode} setFavoriteEpisode={setFavoriteEpisode}
                    favoriteEpisodeNote={favoriteEpisodeNote} setFavoriteEpisodeNote={setFavoriteEpisodeNote}
                    droppedAtEpisode={droppedAtEpisode} setDroppedAtEpisode={setDroppedAtEpisode}
                    droppedReason={droppedReason} setDroppedReason={setDroppedReason}
                    animeReview={animeReview} setAnimeReview={setAnimeReview}
                    hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                    franchise={franchise} setFranchise={setFranchise}
                    rewatches={rewatches} setRewatches={setRewatches}
                    relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                    recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                    hasEpisodes={hasEpisodes} setHasEpisodes={setHasEpisodes}
                    episodes={episodes} setEpisodes={setEpisodes}
                    yearHandler={yearHandler}
                    intHandler={intHandler}
                  />
                )}

                {isManga && (
                  <MangaEditorSection
                    editingId={editingId}
                    items={items}
                    relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                    mangaAuthors={mangaAuthors} setMangaAuthors={setMangaAuthors}
                    mangaArtists={mangaArtists} setMangaArtists={setMangaArtists}
                    mangaDescription={mangaDescription} setMangaDescription={setMangaDescription}
                    genres={genres} setGenres={setGenres}
                    pubStatus={pubStatus} setPubStatus={setPubStatus}
                    readingStatus={readingStatus} setReadingStatus={setReadingStatus}
                    chaptersRead={chaptersRead} setChaptersRead={setChaptersRead}
                    totalChapters={totalChapters} setTotalChapters={setTotalChapters}
                    volumesRead={volumesRead} setVolumesRead={setVolumesRead}
                    totalVolumesM={totalVolumesM} setTotalVolumesM={setTotalVolumesM}
                    releaseDate={releaseDate} setReleaseDate={setReleaseDate}
                    startDate={startDate} setStartDate={setStartDate}
                    finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                    rating={rating} setRating={setRating}
                    alternativeTitles={alternativeTitles} setAlternativeTitles={setAlternativeTitles}
                    mangaSource={mangaSource} setMangaSource={setMangaSource}
                    ageRating={ageRating} setAgeRating={setAgeRating}
                    magazine={magazine} setMagazine={setMagazine}
                    mediaOwnership={mediaOwnership} setMediaOwnership={setMediaOwnership}
                    mangadexId={mangadexId} setMangadexId={setMangadexId}
                    mangaReview={mangaReview} setMangaReview={setMangaReview}
                    hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                    rewatches={rewatches} setRewatches={setRewatches}
                    franchise={franchise} setFranchise={setFranchise}
                    relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                    recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                    hasChapters={hasChapters} setHasChapters={setHasChapters}
                    chapters={chapters} setChapters={setChapters}
                    volumeCovers={volumeCovers} setVolumeCovers={setVolumeCovers}
                    intHandler={intHandler}
                  />
                )}

                {activeCategory === 'visual_novels' && (
                  <VisualNovelEditorSection
                    editingId={editingId}
                    items={items}
                    relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                    visualNovelStatus={visualNovelStatus} setVisualNovelStatus={setVisualNovelStatus}
                    vnDescription={vnDescription} setVnDescription={setVnDescription}
                    devs={devs} setDevs={setDevs}
                    publishers={publishers} setPublishers={setPublishers}
                    vnPublishers={vnPublishers} setVnPublishers={setVnPublishers}
                    vnEngine={vnEngine} setVnEngine={setVnEngine}
                    vnLength={vnLength} setVnLength={setVnLength}
                    vnLengthHours={vnLengthHours} setVnLengthHours={setVnLengthHours}
                    vnCommunityRating={vnCommunityRating} setVnCommunityRating={setVnCommunityRating}
                    vnDevStatus={vnDevStatus} setVnDevStatus={setVnDevStatus}
                    vnOriginalLanguage={vnOriginalLanguage} setVnOriginalLanguage={setVnOriginalLanguage}
                    vnLanguages={vnLanguages} setVnLanguages={setVnLanguages}
                    vnAliases={vnAliases} setVnAliases={setVnAliases}
                    platforms={platforms} setPlatforms={setPlatforms}
                    existingPlatforms={Array.from(new Set(items.flatMap((i) => i.platforms ?? [])))}
                    releaseDate={releaseDate} setReleaseDate={setReleaseDate}
                    releaseYear={releaseYear} setReleaseYear={setReleaseYear}
                    playTime={playTime} setPlayTime={setPlayTime}
                    startDate={startDate} setStartDate={setStartDate}
                    finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                    rating={rating} setRating={setRating}
                    nsfw={nsfw} setNsfw={setNsfw}
                    vnStaff={vnStaff} setVnStaff={setVnStaff}
                    vnCharacters={vnCharacters} setVnCharacters={setVnCharacters}
                    vnCovers={vnCovers} setVnCovers={setVnCovers}
                    vnEditions={vnEditions} setVnEditions={setVnEditions}
                    vnScreenshots={vnScreenshots} setVnScreenshots={setVnScreenshots}
                    cover={cover} setCover={setCover}
                    vnReview={vnReview} setVnReview={setVnReview}
                    hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                    rewatches={rewatches} setRewatches={setRewatches}
                    vndbId={vndbId} setVndbId={setVndbId}
                    relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                    recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                  />
                )}

                {activeCategory === 'libros' && (
                  <BookEditorSection
                    editingId={editingId}
                    items={items}
                    relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                    bookStatus={bookStatus} setBookStatus={setBookStatus}
                    mangaAuthors={mangaAuthors} setMangaAuthors={setMangaAuthors}
                    bookFormat={bookFormat} setBookFormat={setBookFormat}
                    pubStatus={pubStatus} setPubStatus={setPubStatus}
                    publisher={publisher} setPublisher={setPublisher}
                    isbn={isbn} setIsbn={setIsbn}
                    saga={saga} setSaga={setSaga}
                    sagaIndex={sagaIndex} setSagaIndex={setSagaIndex}
                    bookSource={bookSource} setBookSource={setBookSource}
                    translator={translator} setTranslator={setTranslator}
                    description={description} setDescription={setDescription}
                    pagesRead={pagesRead} setPagesRead={setPagesRead}
                    totalPages={totalPages} setTotalPages={setTotalPages}
                    startDate={startDate} setStartDate={setStartDate}
                    rating={rating} setRating={setRating}
                    finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                    bookReview={bookReview} setBookReview={setBookReview}
                    hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                    chapterNotes={chapterNotes} setChapterNotes={setChapterNotes}
                    rewatches={rewatches} setRewatches={setRewatches}
                    franchise={franchise} setFranchise={setFranchise}
                    relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                    recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                  />
                )}

                    {activeCategory === 'musica' && (
                      <MusicEditorSection
                        title={title}
                        editingId={editingId}
                        items={items}
                        relatedCrossLibraryOptions={relatedCrossLibraryOptions}
                        artist={artist} setArtist={setArtist}
                        alternativeTitles={alternativeTitles} setAlternativeTitles={setAlternativeTitles}
                        musicType={musicType} setMusicType={setMusicType}
                        musicSource={musicSource} setMusicSource={setMusicSource}
                        vinylCondition={vinylCondition} setVinylCondition={setVinylCondition}
                        mediaOwnership={mediaOwnership} setMediaOwnership={setMediaOwnership}
                        discCount={discCount} setDiscCount={setDiscCount}
                        producers={producers} setProducers={setProducers}
                        releaseDate={releaseDate} setReleaseDate={setReleaseDate}
                        releaseYear={releaseYear} setReleaseYear={setReleaseYear}
                        genres={genres} setGenres={setGenres}
                        label={label} setLabel={setLabel}
                        consumed={consumed} setConsumed={setConsumed}
                        hasTracks={hasTracks} setHasTracks={setHasTracks}
                        tracks={tracks} setTracks={setTracks}
                        rating={rating} setRating={setRating}
                        finishedAt={finishedAt} setFinishedAt={setFinishedAt}
                        singleCovers={singleCovers} setSingleCovers={setSingleCovers}
                        editions={editions} setEditions={setEditions}
                        partOfAlbumId={partOfAlbumId} setPartOfAlbumId={setPartOfAlbumId}
                        partOfAlbum={partOfAlbum} setPartOfAlbum={setPartOfAlbum}
                        musicReview={musicReview} setMusicReview={setMusicReview}
                        hasSpoilers={hasSpoilers} setHasSpoilers={setHasSpoilers}
                        rewatches={rewatches} setRewatches={setRewatches}
                        relatedItems={relatedItems} setRelatedItems={setRelatedItems}
                        recommendedItems={recommendedItems} setRecommendedItems={setRecommendedItems}
                        yearHandler={yearHandler}
                      />
                    )}

                    <div className="form-section-header" data-belongs-to="notes">
                      <span className="form-section-title">Notes, tags & groups</span>
                    </div>
                    <div className="field-group">
                      <label>{activeCategory === 'peliculas' ? 'Review' : 'Notes (supports **bold**, *italic*, and "- " lists)'}</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                      {notes.trim() && <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(notes) }} />}
                    </div>

                    {editingId && (
                      <div className="field-group">
                        <label>Groups</label>
                        <div className="pills">
                          {categoryCollections.length === 0 && <span className="hint">No groups here yet.</span>}
                          {categoryCollections.map((c) => (
                            <button key={c.id} type="button" className={c.itemIds.includes(editingId) ? 'pill active' : 'pill'} onClick={() => handleToggleItemInCollection(c.id, editingId)}>
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <TagEditor
                      tags={tags}
                      onAdd={(t) => setTags((prev) => prev.includes(t) ? prev : [...prev, t])}
                      onRemove={(i) => setTags((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-group">
                      <label>Custom fields — your own key/value pairs</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {customFields.map((f, i) => (
                          <div key={f.id} style={{ display: 'flex', gap: 6 }}>
                            <input
                              value={f.key}
                              onChange={(e) => setCustomFields((prev) => prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                              placeholder="Key (e.g. My score)"
                              style={{ flex: '0 0 30%' }}
                            />
                            <input
                              value={f.value}
                              onChange={(e) => setCustomFields((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                              placeholder="Value"
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => setCustomFields((prev) => prev.filter((_, j) => j !== i))}
                              title="Remove"
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="secondary-btn"
                          style={{ alignSelf: 'flex-start' }}
                          onClick={() => setCustomFields((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])}
                        >+ Add field</button>
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Adapted from another library item</label>
                      <p className="hint" style={{ margin: '2px 0 6px' }}>Link this item to the original work it's based on — anime → manga, movie → book, series → comic, game → novel, etc. The reverse edge ("Adapted as") shows on the source item automatically.</p>
                      <BasedOnPicker
                        currentItemId={editingId ?? undefined}
                        value={basedOnItemId}
                        onChange={setBasedOnItemId}
                        allItems={items}
                      />
                    </div>
                  </div>
                </div>
                </div>

                <div className="panel-footer">
                  {editingId && <button className="danger" onClick={handleDeleteFromPanel}>Delete</button>}
                  <button type="button" className="ghost" onClick={() => askConfirm('Clear every field in this editor? The item stays in your library — Save changes only overwrites when you press it.', () => resetForm())}>Clear fields</button>
                  {editingId && (
                    <div className="bulk-drop">
                      <button type="button" className="ghost" onClick={() => setMoveMenuOpen((v) => !v)}>Move to library ▾</button>
                      {moveMenuOpen && (
                        <div className="bulk-menu">
                          {CATEGORIES.filter((c) => c.id !== activeCategory).map((c) => (
                            <button key={c.id} type="button" onClick={() => {
                              setMoveMenuOpen(false)
                              askConfirm(
                                `Move "${title || 'this item'}" to ${c.label}? Category-specific fields stay on the item and reappear if you move it back.`,
                                () => {
                                  if (!editingId) return
                                  setItems((all) => all.map((it) => it.id === editingId ? { ...it, categoryId: c.id } : it))
                                  setCollections((all) => all.map((col) => col.categoryId === c.id ? col : { ...col, itemIds: col.itemIds.filter((id) => id !== editingId) }))
                                  setToast(`Moved to ${c.label}`)
                                  closePanel()
                                },
                              )
                            }}>{c.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="panel-footer-right">
                    <button className="ghost" onClick={() => closePanel()}>Cancel</button>
                    <button className="primary" onClick={handleSave}>{editingId ? 'Save changes' : 'Add'}</button>
                  </div>
                </div>
              </>
          </aside>
          </div>
          </>
        )}
        </div>
      </div>

      {!settings.welcomeShown && items.length === 0 && loaded && (
        <div className="modal-overlay">
          <div className="modal-box welcome-modal">
            <p className="modal-brand">Welcome to Omnio</p>
            {welcomeStep === 'libraries' ? (
              <>
                <p className="modal-message">
                  Which libraries do you want to enable? You can turn them on or off later in <b>Settings → Libraries</b>.
                </p>
                <div className="library-toggle-list welcome-libs">
                  {CATEGORIES.map((cat) => {
                    const checked = welcomePicks[cat.id] ?? true
                    return (
                      <label key={cat.id} className="library-toggle-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setWelcomePicks((p) => ({ ...p, [cat.id]: !checked }))}
                        />
                        <span className="library-toggle-icon"><CategoryIcon id={cat.id} /></span>
                        <span>{cat.label}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="modal-actions" style={{ gap: 8 }}>
                  <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>1 / 3</span>
                  <button className="danger-solid" onClick={() => {
                    const picked = CATEGORIES.filter((c) => welcomePicks[c.id] ?? true).map((c) => c.id)
                    setSettings((s) => ({ ...s, enabledCategories: picked.length > 0 ? picked : CATEGORIES.map((c) => c.id) }))
                    const firstEnabled = picked[0]
                    if (firstEnabled) setActiveCategory(firstEnabled)
                    setWelcomeStep('keys')
                  }}>Continue →</button>
                </div>
              </>
            ) : welcomeStep === 'keys' ? (
              <>
                <p className="modal-message">
                  API keys for metadata sources — optional but they unlock the ↗ Fetch buttons in the editors. All free, keyless sources (AniList, MAL, Kitsu, MangaDex, MusicBrainz, VGMdb, OpenLibrary) work out of the box.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SteamGridDB (game covers/banners/logos)</span>
                    <input type="password" placeholder="Free key at steamgriddb.com/profile/preferences/api" value={settings.sgdbApiKey ?? ''} onChange={(e) => setSettings((s) => ({ ...s, sgdbApiKey: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TMDb (movies + series)</span>
                    <input type="password" placeholder="Free v3 key at themoviedb.org/settings/api" value={settings.tmdbApiKey ?? ''} onChange={(e) => setSettings((s) => ({ ...s, tmdbApiKey: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IGDB (games full metadata) — Twitch Client ID + Secret</span>
                    <input type="text" placeholder="Client ID (dev.twitch.tv/console/apps)" value={settings.igdbClientId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, igdbClientId: e.target.value }))} />
                    <input type="password" placeholder="Client Secret" value={settings.igdbClientSecret ?? ''} onChange={(e) => setSettings((s) => ({ ...s, igdbClientSecret: e.target.value }))} />
                  </label>
                </div>
                <div className="modal-actions" style={{ gap: 8, marginTop: 16 }}>
                  <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>2 / 3</span>
                  <button className="secondary-btn" onClick={() => setWelcomeStep('libraries')}>← Back</button>
                  <button className="secondary-btn" onClick={() => setWelcomeStep('tips')}>Skip →</button>
                  <button className="danger-solid" onClick={() => setWelcomeStep('tips')}>Continue →</button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-message">
                  You're all set. A few tips to get started:
                </p>
                <ul className="welcome-tips">
                  <li>Pick a library from the Home dashboard.</li>
                  <li>Click <b>+ Add</b> or use <b>↗ Fetch metadata</b> in the editor to fill fields from AniList / TMDb / IGDB / etc.</li>
                  <li>Personalize theme, density, card fields and card zoom in <b>Settings</b>.</li>
                  <li>Press <b>?</b> anytime for the shortcuts cheatsheet · <b>Ctrl+K</b> for global search · <b>F5</b> to refresh.</li>
                  <li>Right-click any card for quick actions (open, edit, duplicate, move, delete).</li>
                </ul>
                <div className="modal-actions" style={{ gap: 8 }}>
                  <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>3 / 3</span>
                  <button className="secondary-btn" onClick={() => setWelcomeStep('keys')}>← Back</button>
                  <button className="danger-solid" onClick={() => setSettings((s) => ({ ...s, welcomeShown: true }))}>Get started</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editingCollectionId && (
        <div className="modal-overlay" onClick={closeCollectionEditModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
            <p className="modal-brand">Edit group</p>
            <div className="field-group">
              <label>Name</label>
              <input value={collectionNameField} onChange={(e) => setCollectionNameField(e.target.value)} autoFocus />
            </div>
            <div className="field-group">
              <label>Cover image</label>
              {collectionCoverField && (
                <div className="cover-preview">
                  <img src={assetSrc(collectionCoverField) ?? collectionCoverField} alt="" />
                </div>
              )}
              <div className="upload-row">
                <button type="button" className="upload-btn" onClick={() => collectionCoverFileRef.current?.click()}>Upload</button>
                <input type="file" accept="image/*" ref={collectionCoverFileRef} style={{ display: 'none' }} onChange={handleCollectionCoverFile} />
                {collectionCoverField && (
                  <button type="button" className="upload-btn clear" onClick={() => setCollectionCoverField('')}>Clear</button>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={closeCollectionEditModal}>Cancel</button>
              <button className="primary" onClick={handleSaveCollectionEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p className="modal-brand">Omnio</p>
            <p className="modal-message">{confirmState.message}</p>
            {confirmState.suppressible && (
              <label className="dont-ask">
                <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
                <span>Don’t ask again</span>
              </label>
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirmState(null)}>Cancel</button>
              <button className="danger-solid" onClick={() => { if (confirmState.suppressible && dontAskAgain) setSettings((s) => ({ ...s, confirmDelete: false })); confirmState.onConfirm(); setConfirmState(null) }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {artistPanelOpen && (
        // No overlay-click dismiss — matches every other editor modal.
        // Losing a form's worth of typed fields to a stray outside click
        // is a worse default than an extra click on the close button.
        // Esc still closes via the global-shortcut handler.
        <div className="modal-overlay">
          <div className="modal-panel artist-editor-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '94vw', maxHeight: '88vh' }}>
            <div className="modal-header">
              <h2>Edit Artist</h2>
              <button type="button" className="panel-close" onClick={closeArtistPanel}>✕</button>
            </div>
            <div className="editor-tabs-bar" role="tablist">
              {(['overview', 'details', 'members', 'concerts'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  className={artistEditorTab === tab ? 'editor-tab active' : 'editor-tab'}
                  onClick={() => setArtistEditorTab(tab)}
                >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>
            <div className="modal-body">
              <div className="form">
                {artistEditorTab === 'overview' && (
                  <>
                    <div className="field-group">
                      <label>Name</label>
                      <input value={artistNameField} onChange={(e) => setArtistNameField(e.target.value)} />
                    </div>
                    <div className="field-group image-drop" {...imageDropHandlers(setArtistPhotoField)}>
                      <label>Photo</label>
                      <input
                        placeholder={artistPhotoField.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL · drop here to upload'}
                        value={artistPhotoField.startsWith('data:') ? '' : artistPhotoField}
                        onChange={(e) => setArtistPhotoField(e.target.value)}
                      />
                      <div className="upload-row">
                        <button type="button" className="upload-btn" onClick={() => artistPhotoFileInputRef.current?.click()}>Upload from PC</button>
                        {artistPhotoField && <button type="button" className="upload-btn clear" onClick={() => setArtistPhotoField('')}>Clear</button>}
                      </div>
                      <input type="file" accept="image/*" ref={artistPhotoFileInputRef} style={{ display: 'none' }} onChange={handleArtistPhotoFile} />
                    </div>
                    <div className="field-group image-drop" {...imageDropHandlers(setArtistBannerField)}>
                      <label>Banner image</label>
                      <input
                        placeholder={artistBannerField.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL · drop here to upload'}
                        value={artistBannerField.startsWith('data:') ? '' : artistBannerField}
                        onChange={(e) => setArtistBannerField(e.target.value)}
                      />
                      <div className="upload-row">
                        <button type="button" className="upload-btn" onClick={() => artistBannerFileInputRef.current?.click()}>Upload from PC</button>
                        {artistBannerField && <button type="button" className="upload-btn clear" onClick={() => setArtistBannerField('')}>Clear</button>}
                      </div>
                      <input type="file" accept="image/*" ref={artistBannerFileInputRef} style={{ display: 'none' }} onChange={handleArtistBannerFile} />
                    </div>
                  </>
                )}
                {artistEditorTab === 'details' && (
                  <>
                    <div className="field-group">
                      <label>Origin</label>
                      <input value={artistOrigin} onChange={(e) => setArtistOrigin(e.target.value)} placeholder="e.g. London, England" />
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Status</label>
                        <select value={artistBandStatus} onChange={(e) => setArtistBandStatus(e.target.value as BandStatus | '')}>
                          <option value="">Unspecified</option>
                          {BAND_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Years active</label>
                        <div className="field-row">
                          <input value={artistActiveFrom} onChange={(e) => setArtistActiveFrom(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="From" />
                          <input value={artistActiveTo} onChange={(e) => setArtistActiveTo(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="To" />
                        </div>
                      </div>
                    </div>
                    <TagEditor
                      label="Genres"
                      placeholder="Add genre"
                      tags={artistGenres}
                      onAdd={(g) => setArtistGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                      onRemove={(i) => setArtistGenres((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <TagEditor
                      label="Labels"
                      placeholder="Add record label"
                      tags={artistLabels}
                      onAdd={(l) => setArtistLabels((prev) => prev.includes(l) ? prev : [...prev, l])}
                      onRemove={(i) => setArtistLabels((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  </>
                )}
                {artistEditorTab === 'members' && (
                  <div className="field-group">
                    <label>Members</label>
                    <BandMembersEditor members={artistMembers} onChange={setArtistMembers} />
                  </div>
                )}
                {artistEditorTab === 'concerts' && (
                  <ConcertLogEditor entries={artistConcerts} onChange={setArtistConcerts} />
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="danger-btn" onClick={() => { const id = editingArtistId!; closeArtistPanel(); handleDeleteArtist(id) }} style={{ marginRight: 'auto' }}>Delete</button>
              <button type="button" className="ghost-btn" onClick={closeArtistPanel}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleSaveArtistEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      <GlobalSearch
        open={searchOpen}
        items={items}
        artists={musicArtists}
        onClose={() => setSearchOpen(false)}
        onOpenItem={navigateToItem}
        onOpenArtist={navigateToArtist}
        onRunAction={(a) => {
          if (a.kind === 'open-library') {
            switchCategory(a.categoryId as CategoryId)
            setSpecialView('none')
            setActivePluginSlug(null)
          } else if (a.kind === 'open-view') {
            setActivePluginSlug(null)
            if (a.view === 'randomizer') { setRandomizerOpen(true); return }
            setSpecialView(a.view)
          } else if (a.kind === 'franchise') {
            setFranchiseTimelineOpen(a.franchise)
          } else if (a.kind === 'add-item') {
            if (a.categoryId) switchCategory(a.categoryId as CategoryId)
            setSpecialView('none')
            setActivePluginSlug(null)
            openAddPanel()
            // Prefill the add panel's title with the requested string
            // on the next tick — the panel needs a paint to mount.
            setTimeout(() => {
              const el = document.querySelector<HTMLInputElement>('.add-panel input[name="title"], .add-panel input[type="text"]')
              if (el) { el.value = a.title; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus() }
            }, 60)
          }
        }}
      />

      {dupOpen && (
        <DuplicatesModal
          items={items}
          onOpenItem={navigateToItem}
          onClose={() => setDupOpen(false)}
        />
      )}

      {auditOpen && (
        <DataHealthAuditModal
          items={items}
          onOpenItem={navigateToItem}
          onClose={() => setAuditOpen(false)}
        />
      )}

      {imageGuideOpen && (
        <Suspense fallback={null}>
          <ImageUploadGuide onClose={() => setImageGuideOpen(false)} />
        </Suspense>
      )}

      {randomizerOpen && (
        <Suspense fallback={null}>
          <RandomizerModal
            items={items}
            enabledCategories={settings.enabledCategories}
            onOpenItem={navigateToItem}
            onClose={() => setRandomizerOpen(false)}
          />
        </Suspense>
      )}

      {roleNormalizerOpen && (
        <Suspense fallback={null}>
          <RoleNormalizerModal
            artists={musicArtists}
            onClose={() => setRoleNormalizerOpen(false)}
            onApply={(mapping) => {
              // Rewrite roles + stint.roles across every artist. Dedupe
              // the resulting arrays since two variants might collapse
              // into a canonical the member already had.
              let touchedArtists = 0
              setMusicArtists((prev) => prev.map((a) => {
                if (!a.members || a.members.length === 0) return a
                let artistTouched = false
                const nextMembers = a.members.map((m) => {
                  let memberTouched = false
                  const rewriteRoles = (roles?: string[]) => {
                    if (!roles || roles.length === 0) return roles
                    const seen = new Set<string>()
                    const next: string[] = []
                    for (const r of roles) {
                      const canon = mapping[r] ?? r
                      if (canon !== r) memberTouched = true
                      if (!seen.has(canon)) { seen.add(canon); next.push(canon) }
                    }
                    return next
                  }
                  const newRoles = rewriteRoles(m.roles) ?? m.roles
                  const newStints = m.stints?.map((s) => {
                    const nr = rewriteRoles(s.roles)
                    return nr === s.roles ? s : { ...s, roles: nr ?? [] }
                  })
                  if (!memberTouched) return m
                  artistTouched = true
                  return { ...m, roles: newRoles, stints: newStints }
                })
                if (!artistTouched) return a
                touchedArtists++
                return { ...a, members: nextMembers }
              }))
              const merged = Object.keys(mapping).length
              setToast(`Merged ${merged} role variant${merged === 1 ? '' : 's'} across ${touchedArtists} artist${touchedArtists === 1 ? '' : 's'}`)
            }}
          />
        </Suspense>
      )}

      {tagHierarchyOpen && (
        <Suspense fallback={null}>
          <TagHierarchyModal
            items={items}
            tagTree={settings.tagTree}
            onClose={() => setTagHierarchyOpen(false)}
            onSave={(next) => {
              setSettings((s) => ({ ...s, tagTree: next }))
              const count = Object.keys(next).length
              setToast(count === 0 ? 'Tag hierarchy cleared' : `Tag hierarchy saved (${count} nested tag${count === 1 ? '' : 's'})`)
            }}
          />
        </Suspense>
      )}

      {genreNormalizerOpen && (
        <GenreNormalizerModal
          items={items}
          onClose={() => setGenreNormalizerOpen(false)}
          onApply={(mapping) => {
            // Rewrite every item that carries any variant. Also dedupe the
            // resulting genres[] because two variants might collapse into
            // one canonical that the item already had.
            let changed = 0
            setItems((prev) => prev.map((it) => {
              const g = it.genres
              if (!g || g.length === 0) return it
              let touched = false
              const next: string[] = []
              const seen = new Set<string>()
              for (const label of g) {
                const canon = mapping[label] ?? label
                if (canon !== label) touched = true
                if (!seen.has(canon)) { seen.add(canon); next.push(canon) }
              }
              if (!touched && next.length === g.length) return it
              changed++
              return { ...it, genres: next }
            }))
            const merged = Object.keys(mapping).length
            setToast(`Merged ${merged} variant${merged === 1 ? '' : 's'} across ${changed} item${changed === 1 ? '' : 's'}`)
          }}
        />
      )}

      {ctxMenu && (
        <CardContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          actions={buildCardMenu(ctxMenu.item)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {shortcutsOpen && (
        <div className="modal-overlay" onClick={() => setShortcutsOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: '90vw' }}>
            <div className="modal-header">
              <h2>Keyboard shortcuts</h2>
              <button type="button" className="panel-close" onClick={() => setShortcutsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
                {[
                  { section: 'Navigation', rows: [
                    ['Ctrl+K', 'Global search across every library'],
                    ['Ctrl+F', 'Search inside the current library'],
                    ['F5', 'Refresh the library from disk'],
                    ['?', 'Show this cheatsheet'],
                    ['Esc', 'Close any open modal, panel or detail view'],
                  ]},
                  { section: 'Editing', rows: [
                    ['Ctrl+Z', 'Undo the last change'],
                    ['Ctrl+Shift+Z', 'Redo'],
                    ['Ctrl+Y', 'Redo (alt)'],
                  ]},
                  { section: 'Selection', rows: [
                    ['Shift+click', 'Toggle multi-select on a card'],
                    ['Click', 'When any card is selected, single click toggles too'],
                  ]},
                  { section: 'Detail views', rows: [
                    ['Edit', 'Opens the full editor pre-filled with the item'],
                    ['Duplicate', 'Creates a "(Copy)" of the current item'],
                  ]},
                ].map((g) => (
                  <div key={g.section}>
                    <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>{g.section}</h3>
                    <table style={{ width: '100%', fontSize: 13 }}>
                      <tbody>
                        {g.rows.map(([k, d]) => (
                          <tr key={k}>
                            <td style={{ padding: '4px 0', width: 130 }}>
                              <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{k}</kbd>
                            </td>
                            <td style={{ padding: '4px 0', color: 'var(--text-dim)' }}>{d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {brokenAssetsOpen && (
        <div className="modal-overlay" onClick={() => setBrokenAssetsOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2>Broken cover audit</h2>
              <button type="button" className="panel-close" onClick={() => setBrokenAssetsOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {brokenAssets.length === 0 ? (
                <p className="hint">No broken references. Every asset path in your library resolves to a real file on disk.</p>
              ) : (
                <>
                  <p className="hint">{brokenAssets.length} reference{brokenAssets.length === 1 ? '' : 's'} point to a file that no longer exists. Click <strong>Clear</strong> to blank the field — the item updates live, no reload needed. Then re-open the item and re-fetch cleanly.</p>
                  <div className="settings-actions" style={{ marginBottom: 12 }}>
                    <button type="button" className="secondary-btn" onClick={() => {
                      // Update in-memory state; autosave persists to disk on
                      // the next tick. No IPC round-trip means no risk of
                      // "handler not registered" (stale dev main.js) or races
                      // on shared JSON files between parallel per-ref writes.
                      brokenAssets.forEach((b) => applyClearedRefLocally(b))
                      const n = brokenAssets.length
                      setBrokenAssets([])
                      setToast(`Cleared ${n} reference${n === 1 ? '' : 's'}`)
                    }}>Clear all {brokenAssets.length}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {brokenAssets.map((b, i) => (
                      <div key={`${b.itemId}-${b.field}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{b.itemTitle}</div>
                          <div className="hint" style={{ margin: 0, fontSize: 12 }}>
                            <code>{b.category}</code> · {b.field} · <code style={{ opacity: 0.7 }}>{b.rel}</code>
                          </div>
                        </div>
                        <button type="button" className="secondary-btn" onClick={() => {
                          applyClearedRefLocally(b)
                          setBrokenAssets((list) => list.filter((_, j) => j !== i))
                          setToast('Reference cleared')
                        }}>Clear</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <BulkActionBar
        items={items}
        selectedIds={selectedIds}
        collections={collections}
        onClear={clearSelection}
        onApplyStatus={applyToSelected}
        onApplyTag={bulkAddTag}
        onApplyRating={(r) => {
          setItems((all) => all.map((it) => selectedIds.has(it.id) ? { ...it, rating: r || undefined } : it))
          setToast(r ? `Rating set to ★${r} on ${selectedIds.size} items` : `Rating cleared on ${selectedIds.size} items`)
        }}
        onApplyGenre={(op, g) => {
          setItems((all) => all.map((it) => {
            if (!selectedIds.has(it.id)) return it
            const cur = it.genres ?? []
            if (op === 'add') {
              if (cur.includes(g)) return it
              return { ...it, genres: [...cur, g] }
            }
            return { ...it, genres: cur.filter((x) => x !== g) }
          }))
          setToast(op === 'add' ? `Genre "${g}" added to ${selectedIds.size} items` : `Genre "${g}" removed from ${selectedIds.size} items`)
        }}
        onAddToGroup={bulkAddToGroup}
        onMoveToLibrary={bulkMoveToLibrary}
        onDelete={bulkDelete}
        onExportHtml={async () => {
          const picked = items.filter((i) => selectedIds.has(i.id))
          if (picked.length === 0) return
          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose where to export the selection')
          if (!dir) return
          const includesMusic = picked.some((i) => i.categoryId === 'musica')
          const scopedArtists = includesMusic ? musicArtists : []
          const html = buildStaticSiteHtml(picked, scopedArtists, `Omnio selection (${picked.length} items)`)
          const r = await window.ipcRenderer.invoke('export:site', dir, html)
          if (r?.ok) setToast(`Exported ${picked.length} items to ${r.path}`)
          else setToast(`Export failed: ${r?.error ?? 'unknown'}`)
        }}
      />

      {sgdbOpen && (
        <SteamGridDbPicker
          apiKey={settings.sgdbApiKey}
          initialQuery={title}
          kind={sgdbOpen}
          onPick={(rel) => {
            // Delete the previous transient asset (downloaded from a prior
            // SGDB pick during this same edit session) so it doesn't linger.
            const savedCover = editingItem?.cover
            const savedBanner = editingItem?.bannerImage
            const savedLogo = editingItem?.logoImage
            if (sgdbOpen === 'grids') {
              if (isLocalAssetPath(cover) && cover !== savedCover && cover !== rel) window.ipcRenderer.invoke('image:delete', cover)
              setCover(rel)
            } else if (sgdbOpen === 'heroes') {
              if (isLocalAssetPath(bannerImage) && bannerImage !== savedBanner && bannerImage !== rel) window.ipcRenderer.invoke('image:delete', bannerImage)
              setBannerImage(rel)
            } else if (sgdbOpen === 'logos') {
              if (isLocalAssetPath(logoImage) && logoImage !== savedLogo && logoImage !== rel) window.ipcRenderer.invoke('image:delete', logoImage)
              setLogoImage(rel)
            }
            setToast('Artwork downloaded')
          }}
          onClose={() => setSgdbOpen(null)}
        />
      )}

      {bundleSgdbFor && (
        <SteamGridDbPicker
          apiKey={settings.sgdbApiKey}
          initialQuery={bundleSgdbFor.title}
          kind="grids"
          saveAsKind="bundle"
          onPick={(rel) => {
            // Delete the previous bundle sub-cover if it was a transient
            // download (present in state but not in the persisted item).
            const savedBundle = editingItem?.bundleContents?.find((b) => b.id === bundleSgdbFor.entryId)?.cover
            const currentBundle = bundleContents.find((b) => b.id === bundleSgdbFor.entryId)?.cover
            if (isLocalAssetPath(currentBundle) && currentBundle !== savedBundle && currentBundle !== rel) {
              window.ipcRenderer.invoke('image:delete', currentBundle)
            }
            setBundleContents((prev) => prev.map((b) => b.id === bundleSgdbFor.entryId ? { ...b, cover: rel } : b))
            setToast('Bundle cover downloaded')
          }}
          onClose={() => setBundleSgdbFor(null)}
        />
      )}

      {/* Single registry-driven fetcher slot. `activeFetcher` holds the
          registration id; the render function binds every per-source
          detail (apiKey, kind, initialUrl, hints). Toast label follows
          the registration's own `label`. */}
      {activeFetcher && (() => {
        const reg = getFetchersFor(activeCategory).find((r) => r.id === activeFetcher)
        if (!reg) return null
        return reg.render({
          initialQuery: title,
          categoryId: activeCategory,
          settings,
          onApply: (p, c, b, h) => applyFetchedPatch(p, c, b, reg.label, h),
          onClose: () => setActiveFetcher(null),
        })
      })()}

      {malOpen && (
        <MalImporter
          existingItems={items}
          onImport={(newItems) => {
            setItems((all) => [...all, ...newItems])
            setToast(`Imported ${newItems.length} items`)
          }}
          onClose={() => setMalOpen(false)}
        />
      )}

      {genericImportOpen && (
        <GenericImporter
          existingItems={items}
          onImport={(newItems) => {
            setItems((all) => [...all, ...newItems])
            setToast(`Imported ${newItems.length} items`)
          }}
          onClose={() => setGenericImportOpen(false)}
        />
      )}

      {steamOpen && (
        <Suspense fallback={null}>
          <SteamImporter
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} games from Steam`)
            }}
            onClose={() => setSteamOpen(false)}
          />
        </Suspense>
      )}

      {letterboxdOpen && (
        <LetterboxdImporter
          existingItems={items}
          onImport={(newItems) => {
            setItems((all) => [...all, ...newItems])
            setToast(`Imported ${newItems.length} movie${newItems.length === 1 ? '' : 's'} from Letterboxd`)
          }}
          onClose={() => setLetterboxdOpen(false)}
        />
      )}

      {backloggdOpen && (
        <Suspense fallback={null}>
          <BackloggdImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} game${newItems.length === 1 ? '' : 's'} from Backloggd`)
            }}
            onClose={() => setBackloggdOpen(false)}
          />
        </Suspense>
      )}

      {storyGraphOpen && (
        <Suspense fallback={null}>
          <StoryGraphImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} book${newItems.length === 1 ? '' : 's'} from StoryGraph`)
            }}
            onClose={() => setStoryGraphOpen(false)}
          />
        </Suspense>
      )}

      {imdbOpen && (
        <Suspense fallback={null}>
          <ImdbImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} entr${newItems.length === 1 ? 'y' : 'ies'} from IMDb`)
            }}
            onClose={() => setImdbOpen(false)}
          />
        </Suspense>
      )}

      {rymOpen && (
        <Suspense fallback={null}>
          <RymImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} album${newItems.length === 1 ? '' : 's'} from RateYourMusic`)
            }}
            onClose={() => setRymOpen(false)}
          />
        </Suspense>
      )}

      {hltbOpen && (
        <Suspense fallback={null}>
          <HltbImporter
            existingItems={items}
            onPatch={(patches) => {
              const byId = new Map(patches.map((p) => [p.id, p.hltbHours]))
              setItems((all) => all.map((it) => {
                const h = byId.get(it.id)
                if (h === undefined) return it
                return { ...it, hltbHours: h } as Item
              }))
              setToast(`Patched ${patches.length} game${patches.length === 1 ? '' : 's'} with HLTB times`)
            }}
            onClose={() => setHltbOpen(false)}
          />
        </Suspense>
      )}

      {serializdOpen && (
        <Suspense fallback={null}>
          <SerializdImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} show${newItems.length === 1 ? '' : 's'} from Serializd`)
            }}
            onClose={() => setSerializdOpen(false)}
          />
        </Suspense>
      )}

      {spotifyOpen && (
        <Suspense fallback={null}>
          <SpotifyImporter
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Imported ${newItems.length} album${newItems.length === 1 ? '' : 's'} from Spotify`)
            }}
            onClose={() => setSpotifyOpen(false)}
          />
        </Suspense>
      )}

      {discogsImportOpen && (
        <DiscogsImporter
          existingItems={items}
          onImport={({ updates, creates }) => {
            setItems((all) => {
              const next = all.map((it) => updates.has(it.id) ? { ...it, ...updates.get(it.id)! } : it)
              return [...next, ...creates]
            })
            const total = updates.size + creates.length
            setToast(`Applied Discogs data to ${total} release${total === 1 ? '' : 's'}`)
          }}
          onClose={() => setDiscogsImportOpen(false)}
        />
      )}

      {traktImportOpen && (
        <TraktImporter
          existingItems={items}
          onImport={({ movieUpdates, movieCreates, seriesUpdates, seriesCreates }) => {
            setItems((all) => {
              const next = all.map((it) => {
                const mUp = movieUpdates.get(it.id)
                if (mUp) return { ...it, ...mUp }
                const sUp = seriesUpdates.get(it.id)
                if (sUp) return { ...it, ...sUp }
                return it
              })
              return [...next, ...movieCreates, ...seriesCreates]
            })
            const total = movieUpdates.size + movieCreates.length + seriesUpdates.size + seriesCreates.length
            setToast(`Applied Trakt data to ${total} item${total === 1 ? '' : 's'}`)
          }}
          onClose={() => setTraktImportOpen(false)}
        />
      )}

      {lastfmImportOpen && (
        <LastfmImporter
          existingItems={items}
          onImport={({ updates, creates }) => {
            setItems((all) => {
              const next = all.map((it) => updates.has(it.id) ? { ...it, ...updates.get(it.id)!, finishedAt: it.finishedAt || updates.get(it.id)!.finishedAt } : it)
              return [...next, ...creates]
            })
            const total = updates.size + creates.length
            setToast(`Applied Last.fm data to ${total} album${total === 1 ? '' : 's'}`)
          }}
          onClose={() => setLastfmImportOpen(false)}
        />
      )}

      {highlightsImportOpen && (
        <HighlightsImporter
          existingItems={items}
          onImport={({ updates, creates }) => {
            setItems((all) => {
              const next = all.map((it) => updates.has(it.id) ? { ...it, highlights: updates.get(it.id) } : it)
              return [...next, ...creates]
            })
            const totalEntries = [...updates.values()].reduce((s, arr) => s + arr.length, 0)
              + creates.reduce((s, it) => s + (it.highlights?.length ?? 0), 0)
            const bookCount = updates.size + creates.length
            setToast(`Imported ${totalEntries} highlight${totalEntries === 1 ? '' : 's'} across ${bookCount} book${bookCount === 1 ? '' : 's'}`)
          }}
          onClose={() => setHighlightsImportOpen(false)}
        />
      )}

      {coverWallOpen && (
        <Suspense fallback={null}>
          <CoverWallExporter
            open={coverWallOpen}
            items={items}
            enabledCategories={settings.enabledCategories}
            onClose={() => setCoverWallOpen(false)}
          />
        </Suspense>
      )}
      {franchiseTimelineOpen && (
        <Suspense fallback={null}>
          <CrossLibraryFranchiseModal
            franchise={franchiseTimelineOpen}
            allItems={items}
            onClose={() => setFranchiseTimelineOpen(null)}
            onNavigate={(id) => {
              const target = items.find((i) => i.id === id)
              if (target) navigateToItem(target)
            }}
          />
        </Suspense>
      )}
      {installScanOpen && (
        <Suspense fallback={null}>
          <LocalInstallScanner
            existingItems={items}
            onImport={(newItems) => {
              setItems((all) => [...all, ...newItems])
              setToast(`Added ${newItems.length} game${newItems.length === 1 ? '' : 's'} from install scan · open each to fetch cover/metadata`)
            }}
            onClose={() => setInstallScanOpen(false)}
          />
        </Suspense>
      )}
      {discographyCheckerOpen && (
        <Suspense fallback={null}>
          <DiscographyChecker
            items={items}
            onAddMissing={(rows) => {
              const now = Date.now()
              const newItems: AnyItem[] = rows.map((r) => ({
                id: crypto.randomUUID(),
                categoryId: 'musica',
                title: r.title,
                artist: r.artist,
                releaseYear: r.year,
                musicType: 'album',
                createdAt: now,
              } as AnyItem))
              setItems((all) => [...all, ...newItems])
              setToast(`Added ${newItems.length} placeholder album${newItems.length === 1 ? '' : 's'} — open each to fetch cover/metadata`)
            }}
            onClose={() => setDiscographyCheckerOpen(false)}
          />
        </Suspense>
      )}
      {wrappedOpen && (
        <YearlyWrapped items={items} onClose={() => setWrappedOpen(false)} />
      )}

      {toast && <Toast message={toast} />}

      {updateModalOpen && updateInfo && (
        <div className="modal-overlay" onClick={() => downloadState.phase !== 'downloading' && setUpdateModalOpen(false)}>
          <div className="modal-box" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <p className="modal-brand">Update to Omnio {updateInfo.latest}</p>
            {downloadState.phase === 'downloading' && (() => {
              const pct = downloadState.total > 0 ? Math.floor((downloadState.received / downloadState.total) * 100) : 0
              const mb = (n: number) => (n / (1024 * 1024)).toFixed(1)
              return (
                <>
                  <p className="modal-message">Downloading {updateInfo.matchedAssetName}…</p>
                  <div className="update-progress"><div className="update-progress-bar" style={{ width: `${pct}%` }} /></div>
                  <p className="hint" style={{ marginTop: 8 }}>
                    {mb(downloadState.received)} MB{downloadState.total > 0 ? ` / ${mb(downloadState.total)} MB` : ''} · {pct}%
                  </p>
                </>
              )
            })()}
            {downloadState.phase === 'done' && (
              <>
                <p className="modal-message">
                  Download complete.{' '}
                  {updateInstallKind === 'win-nsis' && 'Click Install to launch the setup — Windows will show a SmartScreen prompt because the build is unsigned.'}
                  {updateInstallKind === 'win-portable' && 'The new portable exe is in your Downloads folder. Close Omnio and run it to finish the update.'}
                  {(updateInstallKind === 'mac-arm64' || updateInstallKind === 'mac-x64') && 'Click Open DMG to mount the disk image. Drag Omnio.app to Applications like a normal install.'}
                  {updateInstallKind === 'linux-appimage' && 'Click Replace and relaunch to make the new AppImage the active one.'}
                  {updateInstallKind === 'unknown' && 'The file is in your Downloads folder.'}
                </p>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setUpdateModalOpen(false)}>Close</button>
                  <button className="primary" onClick={finalizeUpdate}>
                    {updateInstallKind === 'win-nsis' ? 'Install now' :
                      updateInstallKind === 'linux-appimage' ? 'Replace and relaunch' :
                      (updateInstallKind === 'mac-arm64' || updateInstallKind === 'mac-x64') ? 'Open DMG' :
                      'Reveal in folder'}
                  </button>
                </div>
              </>
            )}
            {downloadState.phase === 'error' && (
              <>
                <p className="modal-message" style={{ color: 'var(--danger)' }}>Download failed: {downloadState.message}</p>
                <div className="modal-actions">
                  <button className="ghost" onClick={() => setUpdateModalOpen(false)}>Close</button>
                  <button className="primary" onClick={startAssistedDownload}>Retry</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p className="modal-brand">Omnio</p>
            <p className="modal-message">{alertMsg}</p>
            <div className="modal-actions">
              <button className="primary" onClick={() => setAlertMsg(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {zoomState && (
        <ImageLightbox
          images={zoomState.images}
          index={zoomState.index}
          onIndex={(i) => setZoomState((s) => (s ? { ...s, index: i } : s))}
          onClose={() => setZoomState(null)}
        />
      )}

      {/* First-run wizard: shown once on a fresh install. Any of the three
          CTAs dismisses it permanently (setting welcomeShown=true) and
          routes the user to the matching entry point. */}
      {items.length === 0 && !settings.welcomeShown && (
        <FirstRunWizard
          onImport={() => { setSettings((s) => ({ ...s, welcomeShown: true })); setSpecialView('settings') }}
          onOpenIntegrations={() => { setSettings((s) => ({ ...s, welcomeShown: true })); setSpecialView('settings') }}
          onAddFirst={(cat) => { setSettings((s) => ({ ...s, welcomeShown: true })); switchCategory(cat); setTimeout(() => openAddPanel(), 0) }}
          onDismiss={() => setSettings((s) => ({ ...s, welcomeShown: true }))}
        />
      )}
    </div>
    </Suspense>
  )
}

export default App