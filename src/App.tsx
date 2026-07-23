import { useState, useEffect, useRef, ChangeEvent, Suspense, lazy } from 'react'

// Category metadata (Games / Music / Movies / Series / Anime & Donghua / Comics & Manga family)
import {
  CATEGORIES, COMIC_CATEGORY_IDS, COMIC_GROUP_LABEL,
  ANIME_CATEGORY_IDS, ANIME_GROUP_LABEL, isAnimeLikeCategory,
} from './categories'

// Types
import type {
  Item, Collection, Unit, MusicArtist,
  Platform, Ownership, GameStatus, GameField, GameSource,
  MusicType, MusicField, MusicSource, Track, DlcEntry, BundleGame,
  MangaStatus, MangaField, MangaSource, MangaVolume, Chapter, PublicationStatus,
  AnimeStatus, AnimeField, AnimeSource, AnimeFormat, AnimeSeason, AiringStatus, Demographic, Episode,
  SeriesStatus, SeriesField, SeriesFormat, Season,
  MovieField, MovieSource, WatchLocation,
  AgeRating, RelatedItem, RewatchEntry,
  BandStatus, BandMember, SingleCover, AlbumEdition,
} from './types'

// Runtime constants (option lists, default field visibility)
import {
  OWNERSHIP_OPTIONS,
  GAME_STATUS_OPTIONS, GAME_SOURCE_OPTIONS, GAME_FIELD_OPTIONS, DEFAULT_GAME_FIELDS,
  MUSIC_TYPE_OPTIONS, MUSIC_SOURCE_OPTIONS, MUSIC_FIELD_OPTIONS, DEFAULT_MUSIC_FIELDS,
  MANGA_STATUS_OPTIONS, MANGA_SOURCE_OPTIONS, MANGA_FIELD_OPTIONS, DEFAULT_MANGA_FIELDS,
  PUBLICATION_STATUS_OPTIONS,
  ANIME_STATUS_OPTIONS, ANIME_FORMAT_OPTIONS, ANIME_SEASON_OPTIONS, ANIME_SOURCE_OPTIONS,
  ANIME_FIELD_OPTIONS, DEFAULT_ANIME_FIELDS, AIRING_STATUS_OPTIONS, DEMOGRAPHIC_OPTIONS,
  SERIES_STATUS_OPTIONS, SERIES_FORMAT_OPTIONS, SERIES_FIELD_OPTIONS, DEFAULT_SERIES_FIELDS,
  MOVIE_SOURCE_OPTIONS, MOVIE_FIELD_OPTIONS, DEFAULT_MOVIE_FIELDS, WATCH_LOCATION_OPTIONS,
  AGE_RATING_OPTIONS, BAND_STATUS_OPTIONS,
} from './types'

// Helpers (label lookups, derived counts, formatters, mini markdown)
import {
  getGameStatusRank, getMangaStatus, getAnimeStatus, getSeriesStatus,
  seasonsDerivedCounts, isAlbumLikeMusic, isMangaLike,
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
import Toast from './Toast'
import BackupList from './BackupList'
import BulkActionBar from './BulkActionBar'
const GameDetailModal   = lazy(() => import('./GameDetailModal'))
const MusicDetailModal  = lazy(() => import('./MusicDetailModal'))
const ArtistDetailView  = lazy(() => import('./ArtistDetailView'))
const MangaDetailModal  = lazy(() => import('./MangaDetailModal'))
const MovieDetailModal  = lazy(() => import('./MovieDetailModal'))
const AnimeDetailModal  = lazy(() => import('./AnimeDetailModal'))
const SeriesDetailModal = lazy(() => import('./SeriesDetailModal'))
const DuplicatesModal   = lazy(() => import('./DuplicatesModal'))
const GlobalSearch      = lazy(() => import('./GlobalSearch'))
const SteamGridDbPicker = lazy(() => import('./SteamGridDbPicker'))
const AniListFetcher    = lazy(() => import('./AniListFetcher'))
const JikanFetcher      = lazy(() => import('./JikanFetcher'))
const TmdbFetcher       = lazy(() => import('./TmdbFetcher'))
const IgdbFetcher       = lazy(() => import('./IgdbFetcher'))
const MusicBrainzFetcher = lazy(() => import('./MusicBrainzFetcher'))
const VgmdbFetcher      = lazy(() => import('./VgmdbFetcher'))
const ComicVineFetcher  = lazy(() => import('./ComicVineFetcher'))
const MangaDexFetcher   = lazy(() => import('./MangaDexFetcher'))
const KitsuFetcher      = lazy(() => import('./KitsuFetcher'))
const MalImporter       = lazy(() => import('./MalImporter'))
const GenericImporter   = lazy(() => import('./GenericImporter'))
const YearlyWrapped     = lazy(() => import('./YearlyWrapped'))
import { buildStaticSiteHtml } from './exportSite'
import {
  CategoryIcon, GameStatusIcon, MangaStatusIcon, AnimeStatusIcon,
  InsightsIcon, SettingsIcon, ChevronIcon, FolderIcon,
} from './icons'

// Editors and pickers used inside detail modals and the toolbar
import DistChart from './insights/DistChart'
import Heatmap from './insights/Heatmap'
import RatingPicker from './components/editors/RatingPicker'
import PlatformEditor from './components/editors/PlatformEditor'
import GameSubItems from './components/editors/GameSubItems'
import BundleGamesEditor from './components/editors/BundleGamesEditor'
import VolumeCoverEditor from './components/editors/VolumeCoverEditor'
import TrackListEditor from './components/editors/TrackListEditor'
import RelatedListEditor from './components/editors/RelatedListEditor'
import RecommendationsEditor from './components/editors/RecommendationsEditor'
import RewatchListEditor from './components/editors/RewatchListEditor'
import SeasonListEditor from './components/editors/SeasonListEditor'
import ChapterListEditor from './components/editors/ChapterListEditor'
import EpisodeListEditor from './components/editors/EpisodeListEditor'
import TagEditor from './components/editors/TagEditor'
import BandMembersEditor from './components/editors/BandMembersEditor'
import SingleCoverEditor from './components/editors/SingleCoverEditor'
import EditionsEditor from './components/editors/EditionsEditor'
import FiltersDropdown from './components/editors/FiltersDropdown'

import './App.css'

type Layout = 'list' | 'grid' | 'compact'
type SortBy =
  | 'alpha' | 'recent' | 'rating' | 'custom'
  // Games
  | 'time' | 'status' | 'releaseAsc' | 'releaseDesc'
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
type FontSizeName = 'small' | 'medium' | 'large'
type StartupCategoryMode = 'last' | 'first'
type MotionMode = 'auto' | 'reduced'

interface Settings {
  defaultLayout: Layout
  confirmDelete: boolean
  theme: ThemeName
  accent: AccentName
  density: DensityName
  fontSize: FontSizeName
  motion: MotionMode
  sidebarCompact: boolean
  startupCategory: StartupCategoryMode
  lastCategory?: string
  welcomeShown?: boolean
  enabledCategories?: string[]
  sidebarHidden: boolean
  gameFields: Record<GameField, boolean>
  musicFields: Record<MusicField, boolean>
  mangaFields: Record<MangaField, boolean>
  movieFields: Record<MovieField, boolean>
  animeFields: Record<AnimeField, boolean>
  seriesFields: Record<SeriesField, boolean>
  sgdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
  comicvineApiKey?: string
}

interface AppData {
  items: Item[]
  collections: Collection[]
  artists?: MusicArtist[]
  settings?: Settings
  customOrders?: Record<string, string[]>
}

// Displayed in Settings → Data → About. Sourced from package.json so the
// About string can't drift from the packaged version number.
const APP_VERSION = __APP_VERSION__

const DEFAULT_SETTINGS: Settings = { defaultLayout: 'grid', confirmDelete: true, theme: 'dark', accent: 'default', density: 'comfortable', fontSize: 'medium', motion: 'auto', sidebarCompact: false, startupCategory: 'last', sidebarHidden: false, gameFields: DEFAULT_GAME_FIELDS, musicFields: DEFAULT_MUSIC_FIELDS, mangaFields: DEFAULT_MANGA_FIELDS, movieFields: DEFAULT_MOVIE_FIELDS, animeFields: DEFAULT_ANIME_FIELDS, seriesFields: DEFAULT_SERIES_FIELDS }

function getUniqueTags(list: Item[]): string[] {
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
function pickYear(i: Item): number {
  const first = i.releaseYear || i.seasonYear || i.startYear
    || (i.airedFrom ? i.airedFrom.slice(0, 4) : '')
    || (i.releaseDate ? i.releaseDate.slice(0, 4) : '')
  const n = parseInt(first || '', 10)
  return isNaN(n) ? 0 : n
}

// Total runtime / listen time in seconds. Music sums track durations,
// movies use their `duration` (minutes), series/anime use eps * ep duration.
function pickDuration(i: Item): number {
  if (i.tracks && i.tracks.length > 0) {
    return i.tracks.reduce((acc, t) => acc + parseDurationToSeconds(t.duration), 0)
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

function filterAndSort(list: Item[], search: string, filterTags: string[], filterStatus: GameStatus[], filterPlatforms: Platform[], filterGenres: string[], sortBy: SortBy | null, customOrder: string[] = []): Item[] {
  let result = list
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    result = result.filter((i) => i.title.toLowerCase().includes(q))
  }
  if (filterTags.length > 0) result = result.filter((i) => i.tags?.some((t) => filterTags.includes(t)))
  if (filterStatus.length > 0) result = result.filter((i) => filterStatus.includes(i.gameStatus || 'backlog'))
  if (filterPlatforms.length > 0) result = result.filter((i) => i.platforms?.some((p) => filterPlatforms.includes(p)))
  if (filterGenres.length > 0) result = result.filter((i) => i.genres?.some((g) => filterGenres.includes(g)))
  if (!sortBy) return result
  const arr = [...result]
  // Universal
  if (sortBy === 'alpha') arr.sort((a, b) => a.title.localeCompare(b.title))
  else if (sortBy === 'recent') arr.sort((a, b) => b.createdAt - a.createdAt)
  else if (sortBy === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  // Games
  else if (sortBy === 'time') arr.sort((a, b) => parseFloat(b.playTime || '0') - parseFloat(a.playTime || '0'))
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
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id)
  const [items, setItems] = useState<Item[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [layout, setLayout] = useState<Layout>('grid')
  const [specialView, setSpecialView] = useState<'none' | 'board' | 'musicBoard' | 'mangaBoard' | 'moviesBoard' | 'animeBoard' | 'seriesBoard' | 'stats' | 'settings'>('none')
  const [animeBoardStatus, setAnimeBoardStatus] = useState<AnimeStatus>('plan_to_watch')
  const [seriesBoardStatus, setSeriesBoardStatus] = useState<SeriesStatus>('plan_to_watch')
  const [viewingSeries, setViewingSeries] = useState<Item | null>(null)
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'behavior' | 'libraries' | 'cards' | 'data'>('appearance')
  const [welcomeStep, setWelcomeStep] = useState<'libraries' | 'tips'>('libraries')
  const [welcomePicks, setWelcomePicks] = useState<Record<string, boolean>>({})
  const [moviesBoardFilter, setMoviesBoardFilter] = useState<'watched' | 'unwatched'>('watched')
  const [mangaBoardStatus, setMangaBoardStatus] = useState<MangaStatus>('plan_to_read')
  const [musicBoardFilter, setMusicBoardFilter] = useState<'listened' | 'unlistened'>('listened')
  const [statsCategory, setStatsCategory] = useState(CATEGORIES[0].id)

  useEffect(() => {
    if (settings.enabledCategories && settings.enabledCategories.length > 0 && !settings.enabledCategories.includes(activeCategory)) {
      setActiveCategory(settings.enabledCategories[0])
    }
    if (settings.enabledCategories && settings.enabledCategories.length > 0 && !settings.enabledCategories.includes(statsCategory)) {
      setStatsCategory(settings.enabledCategories[0])
    }
  }, [settings.enabledCategories, activeCategory, statsCategory])

  const [subView, setSubView] = useState<'items' | 'groups' | 'artists'>('items')
  const [comicsOpen, setComicsOpen] = useState(false)
  const [animeGroupOpen, setAnimeGroupOpen] = useState(false)
  const [musicArtists, setMusicArtists] = useState<MusicArtist[]>([])
  const [newArtistName, setNewArtistName] = useState('')
  const [viewingArtist, setViewingArtist] = useState<MusicArtist | null>(null)
  const [artistPanelOpen, setArtistPanelOpen] = useState(false)
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null)
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const [panelOpen, setPanelOpen] = useState(false)
  const [editPreviewMode, setEditPreviewMode] = useState<'card' | 'detail'>('card')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingGame, setViewingGame] = useState<Item | null>(null)
  const [viewingMusic, setViewingMusic] = useState<Item | null>(null)
  const [viewingManga, setViewingManga] = useState<Item | null>(null)
  const [viewingMovie, setViewingMovie] = useState<Item | null>(null)
  const [viewingAnime, setViewingAnime] = useState<Item | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [boardStatus, setBoardStatus] = useState<GameStatus>('backlog')
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('pie')
  const [customOrders, setCustomOrders] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sgdbOpen, setSgdbOpen] = useState<null | 'grids' | 'heroes' | 'logos'>(null)
  const [bundleSgdbFor, setBundleSgdbFor] = useState<null | { entryId: string; title: string }>(null)
  const [updateInfo, setUpdateInfo] = useState<null | { current: string; latest: string; htmlUrl: string; publishedAt?: string; notes?: string; matchedAssetUrl?: string; matchedAssetName?: string }>(null)
  const [updateCheckState, setUpdateCheckState] = useState<'idle' | 'checking' | 'up-to-date' | 'error'>('idle')
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null)
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)

  const runUpdateCheck = async (silent: boolean) => {
    if (!silent) setUpdateCheckState('checking')
    setUpdateCheckError(null)
    const r = await window.ipcRenderer.invoke('updates:check', APP_VERSION)
    if (!r?.ok) {
      if (!silent) { setUpdateCheckState('error'); setUpdateCheckError(r?.error ?? 'Check failed') }
      return
    }
    if (r.hasUpdate) {
      // Point the user at the exact asset that matches their install kind.
      const installKind = await window.ipcRenderer.invoke('updates:install-kind') as { assetHint?: string } | null
      let matchedAssetUrl: string | undefined
      let matchedAssetName: string | undefined
      if (installKind?.assetHint && Array.isArray(r.assets)) {
        const hit = (r.assets as { name: string; url: string }[]).find((a) => a.name.toLowerCase().endsWith(installKind.assetHint!.toLowerCase()))
        if (hit) { matchedAssetUrl = hit.url; matchedAssetName = hit.name }
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [anilistOpen, setAnilistOpen] = useState<null | 'ANIME' | 'MANGA'>(null)
  const [jikanOpen, setJikanOpen] = useState<null | 'anime' | 'manga'>(null)
  const [tmdbOpen, setTmdbOpen] = useState<null | 'movie' | 'tv'>(null)
  const [igdbOpen, setIgdbOpen] = useState(false)
  const [mbOpen, setMbOpen] = useState(false)
  const [vgmdbOpen, setVgmdbOpen] = useState(false)
  const [comicvineOpen, setComicvineOpen] = useState(false)
  const [mangadexOpen, setMangadexOpen] = useState(false)
  const [kitsuOpen, setKitsuOpen] = useState<null | 'anime' | 'manga'>(null)
  const [malOpen, setMalOpen] = useState(false)
  const [genericImportOpen, setGenericImportOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ---- Undo / redo of library mutations ----
  // We snapshot items+collections+artists on every observable change and
  // let Ctrl+Z pop back through them. Deliberately limited to library data
  // — settings, panel state and modal state are not undoable.
  interface HistorySnap { items: Item[]; collections: Collection[]; artists: MusicArtist[] }
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
  const [hasDlc, setHasDlc] = useState(false)
  const [dlcList, setDlcList] = useState<DlcEntry[]>([])
  const [hasAddons, setHasAddons] = useState(false)
  const [addonsList, setAddonsList] = useState<DlcEntry[]>([])
  const [isBundle, setIsBundle] = useState(false)
  const [bundleContents, setBundleContents] = useState<BundleGame[]>([])

  const [releaseYear, setReleaseYear] = useState('')
  const [duration, setDuration] = useState('')
  const [consumed, setConsumed] = useState(false)
  const [artist, setArtist] = useState('')
  const [musicType, setMusicType] = useState<MusicType | ''>('')
  const [genres, setGenres] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [partOfAlbum, setPartOfAlbum] = useState('')
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
  const [producers, setProducers] = useState<string[]>([])
  const [musicReview, setMusicReview] = useState('')
  const [mangaSource, setMangaSource] = useState<MangaSource | ''>('')
  const [magazine, setMagazine] = useState('')
  const [mangaReview, setMangaReview] = useState('')
  const [hasChapters, setHasChapters] = useState(false)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [movieSource, setMovieSource] = useState<MovieSource | ''>('')
  const [movieReview, setMovieReview] = useState('')
  const [gameSource, setGameSource] = useState<GameSource | ''>('')
  const [gameReview, setGameReview] = useState('')
  const [franchise, setFranchise] = useState('')
  const [watchedWhere, setWatchedWhere] = useState<WatchLocation | ''>('')
  const [movieBanner, setMovieBanner] = useState('')
  const [hasSpoilers, setHasSpoilers] = useState(false)
  const [timesWatched, setTimesWatched] = useState('')
  const movieBannerFileInputRef = useRef<HTMLInputElement>(null)

  const handleMovieBannerFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setMovieBanner(reader.result) }
    reader.readAsDataURL(file)
  }
  const [pubStatus, setPubStatus] = useState<PublicationStatus | ''>('')
  const [readingStatus, setReadingStatus] = useState<MangaStatus>('plan_to_read')
  const [chaptersRead, setChaptersRead] = useState('')
  const [totalChapters, setTotalChapters] = useState('')
  const [volumesRead, setVolumesRead] = useState('')
  const [totalVolumesM, setTotalVolumesM] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startYear, setStartYear] = useState('')
  const [endYear, setEndYear] = useState('')
  const [totalSubUnits, setTotalSubUnits] = useState('')
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    const migrate = async (list: Item[]): Promise<{ list: Item[]; changed: boolean }> => {
      let changed = false
      const persist = async (val: string | undefined, categoryId: string, kind: string): Promise<string | undefined> => {
        if (!val || !val.startsWith('data:')) return val
        const rel = await window.ipcRenderer.invoke('image:save', categoryId, kind, val)
        if (typeof rel === 'string') { changed = true; return rel }
        return val
      }
      const migrated = await Promise.all(list.map(async (it) => {
        const cover = await persist(it.cover, it.categoryId, 'cover')
        const bannerImage = await persist(it.bannerImage, it.categoryId, 'banner')
        const bannerImage2 = await persist(it.bannerImage2, it.categoryId, 'banner')
        const logoImage = await persist(it.logoImage, it.categoryId, 'logo')
        let volumeCovers = it.volumeCovers
        if (volumeCovers && volumeCovers.length > 0) {
          volumeCovers = await Promise.all(volumeCovers.map(async (v) => ({ ...v, cover: (await persist(v.cover, it.categoryId, 'volume')) ?? v.cover })))
        }
        // Pre-0.2 stored devs as a comma-separated string and publisher as a
        // single string. Rewrite into the array shape so the rest of the app
        // (edit form, stats, detail modal) can treat them uniformly.
        const anyIt = it as unknown as { devs?: unknown; publisher?: unknown; publishers?: unknown }
        let devs = it.devs
        if (typeof anyIt.devs === 'string') {
          devs = (anyIt.devs as string).split(',').map((s) => s.trim()).filter(Boolean)
          changed = true
        }
        let publishers = it.publishers
        if (!publishers && typeof anyIt.publisher === 'string' && anyIt.publisher) {
          publishers = [(anyIt.publisher as string).trim()].filter(Boolean)
          changed = true
        }
        return { ...it, cover, bannerImage, bannerImage2, logoImage, volumeCovers, devs, publishers, publisher: undefined }
      }))
      return { list: migrated, changed }
    }
    const migrateArtists = async (list: MusicArtist[]): Promise<{ list: MusicArtist[]; changed: boolean }> => {
      let changed = false
      const persist = async (val: string | undefined): Promise<string | undefined> => {
        if (!val || !val.startsWith('data:')) return val
        const rel = await window.ipcRenderer.invoke('image:save', 'artists', 'photo', val)
        if (typeof rel === 'string') { changed = true; return rel }
        return val
      }
      const migrated = await Promise.all(list.map(async (a) => ({ ...a, photo: await persist(a.photo), bannerImage: await persist(a.bannerImage) })))
      return { list: migrated, changed }
    }
    window.ipcRenderer.invoke('data:load').then(async (data: AppData | null) => {
      let items = data?.items ?? []
      let artists = data?.artists ?? []
      const itemsRes = await migrate(items)
      items = itemsRes.list
      const artistsRes = await migrateArtists(artists)
      artists = artistsRes.list
      setItems(items)
      if (data?.collections) setCollections(data.collections)
      setMusicArtists(artists)
      if (data?.settings) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          gameFields: { ...DEFAULT_GAME_FIELDS, ...data.settings.gameFields },
          musicFields: { ...DEFAULT_MUSIC_FIELDS, ...data.settings.musicFields },
          mangaFields: { ...DEFAULT_MANGA_FIELDS, ...data.settings.mangaFields },
          movieFields: { ...DEFAULT_MOVIE_FIELDS, ...data.settings.movieFields },
          animeFields: { ...DEFAULT_ANIME_FIELDS, ...data.settings.animeFields },
          seriesFields: { ...DEFAULT_SERIES_FIELDS, ...data.settings.seriesFields },
          enabledCategories: data.settings.enabledCategories && !data.settings.enabledCategories.includes('donghua') && data.settings.enabledCategories.includes('anime')
            ? [...data.settings.enabledCategories, 'donghua']
            : data.settings.enabledCategories,
        }
        setSettings(merged)
        setLayout(merged.defaultLayout)
        if (merged.startupCategory === 'last' && merged.lastCategory && CATEGORIES.some((c) => c.id === merged.lastCategory)) {
          setActiveCategory(merged.lastCategory)
        }
      }
      if (data?.customOrders) setCustomOrders(data.customOrders)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    window.ipcRenderer.invoke('data:save', { items, collections, settings, artists: musicArtists })
  }, [items, collections, settings, musicArtists, loaded])

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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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
      else if (viewingGame) setViewingGame(null)
      else if (viewingMusic) setViewingMusic(null)
      else if (viewingManga) setViewingManga(null)
      else if (viewingMovie) setViewingMovie(null)
      else if (viewingAnime) setViewingAnime(null)
      else if (viewingSeries) setViewingSeries(null)
      else if (viewingArtist) setViewingArtist(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // closePanel / closeArtistPanel change on every render but that would
    // cause the listener to rebind constantly; the closure captures the
    // latest versions each time this effect re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertMsg, confirmState, viewingGame, viewingMusic, viewingManga, viewingMovie, viewingAnime, viewingSeries, viewingArtist, artistPanelOpen, panelOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (COMIC_CATEGORY_IDS.includes(activeCategory)) setComicsOpen(true)
  }, [activeCategory])

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
  // list; outside, it reads the per-category custom order map.
  const effectiveCustomOrder = activeCollection ? activeCollection.itemIds : (customOrders[activeCategory] || [])
  const visibleItems = filterAndSort(scopedItems, search, filterTags, filterStatus, filterPlatforms, filterGenres, sortBy, effectiveCustomOrder)
  const editingItem = items.find((i) => i.id === editingId) || null

  const resetForm = () => {
    setTitle(''); setCover(''); setNotes(''); setTags([]); setRating(0); setFinishedAt('')
    setDevs([]); setPublishers([]); setAchievementsUnlocked(''); setAchievementsTotal(''); setReleaseDate(''); setBannerImage(''); setLogoImage(''); setDescription('')
    setPlatforms([]); setOwnership(''); setGameStatus('backlog'); setPlayTime('')
    setHasDlc(false); setDlcList([]); setHasAddons(false); setAddonsList([]); setIsBundle(false); setBundleContents([])
    setReleaseYear(''); setDuration(''); setConsumed(false); setArtist(''); setMusicType('')
    setGenres([]); setLabel(''); setPartOfAlbum(''); setHasTracks(false); setTracks([]); setSingleCovers([]); setEditions([])
    setMusicSource(''); setProducers([]); setMusicReview('')
    setUnitCount(''); setStartYear(''); setEndYear(''); setTotalSubUnits(''); setUnits([])
    setMangaAuthors([]); setMangaArtists([]); setVolumeCovers([]); setMangaDescription(''); setPubStatus(''); setReadingStatus('plan_to_read')
    setMangaSource(''); setMagazine(''); setMangaReview(''); setHasChapters(false); setChapters([])
    setMovieSource(''); setMovieReview('')
    setGameSource(''); setGameReview('')
    setDirectors([]); setCast([]); setProductionCompanies([]); setDistributors([]); setMovieDescription(''); setFranchise(''); setWatchedWhere(''); setMovieBanner(''); setHasSpoilers(false); setTimesWatched('')
    setStudios([]); setAnimeFormat(''); setAiringStatus(''); setWatchStatus('plan_to_watch'); setEpisodesWatched(''); setTotalEpisodes(''); setAnimeDescription('')
    setSeason(''); setSeasonYear(''); setDemographic('')
    setAlternativeTitles([]); setAnimeSource(''); setEpisodeDuration(''); setAiredFrom(''); setAiredTo(''); setAgeRating('')
    setFavoriteEpisode(''); setFavoriteEpisodeNote(''); setDroppedAtEpisode(''); setDroppedReason('')
    setHasEpisodes(false); setEpisodes([])
    setAnimeReview(''); setRewatches([]); setRelatedItems([]); setRecommendedItems([])
    setSeriesStatus('plan_to_watch'); setSeriesFormat(''); setSeriesDescription(''); setShowrunners([]); setWriters([])
    setNetwork(''); setCountry(''); setLanguage(''); setContentRating('')
    setHasSeasons(false); setSeasons([]); setSeriesReview('')
    setChaptersRead(''); setTotalChapters(''); setVolumesRead(''); setTotalVolumesM(''); setStartDate('')
  }

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
    setArtistPanelOpen(true)
  }

  const closeArtistPanel = () => {
    setArtistPanelOpen(false)
    setEditingArtistId(null)
  }

  const handleArtistPhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setArtistPhotoField(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleArtistBannerFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setArtistBannerField(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleSaveArtistEdit = async () => {
    if (!artistNameField.trim() || !editingArtistId) return
    const persistArtistImg = async (val: string): Promise<string | undefined> => {
      const trimmed = val.trim()
      if (!trimmed) return undefined
      if (!trimmed.startsWith('data:')) return trimmed
      const rel = await window.ipcRenderer.invoke('image:save', 'artists', 'photo', trimmed)
      return typeof rel === 'string' ? rel : trimmed
    }
    const photo = await persistArtistImg(artistPhotoField)
    const bannerImage = await persistArtistImg(artistBannerField)
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
    setViewingGame(null); setViewingMusic(null); setViewingManga(null); setViewingMovie(null); setViewingAnime(null); setViewingSeries(null); setViewingArtist(null)
  }

  const switchCategory = (id: string) => {
    // Reset the sort back to a value that makes sense in every category so
    // you don't carry "Time played" from Games into Music, etc.
    setActiveCategory(id); setSpecialView('none'); setSubView('items'); setActiveCollectionId(null); resetListControls(); setSortBy('recent'); closePanel()
    closeAllDetailViews()
    setSettings((s) => ({ ...s, lastCategory: id }))
  }

  const openAddPanel = () => { setEditingId(null); resetForm(); setPanelOpen(true) }

  const loadItemIntoForm = (item: Item) => {
    setActiveCategory(item.categoryId)
    setEditingId(item.id)
    setTitle(item.title)
    setCover(item.cover ?? '')
    setNotes(item.notes ?? '')
    setTags(item.tags ?? [])
    setRating(item.rating ?? 0)
    setFinishedAt(item.finishedAt ?? '')
    setDevs(item.devs ?? [])
    setPublishers(item.publishers ?? [])
    setAchievementsUnlocked(item.achievementsUnlocked ?? '')
    setAchievementsTotal(item.achievementsTotal ?? '')
    setReleaseDate(item.releaseDate ?? '')
    setBannerImage(item.bannerImage ?? '')
    setLogoImage(item.logoImage ?? '')
    setDescription(item.description ?? '')
    setPlatforms(item.platforms ?? [])
    setOwnership(item.ownership ?? '')
    setGameStatus(item.gameStatus ?? 'backlog')
    setPlayTime(item.playTime ?? '')
    setHasDlc(item.hasDlc ?? false)
    setDlcList(item.dlcList ?? [])
    setHasAddons(item.hasAddons ?? false)
    setAddonsList(item.addonsList ?? [])
    setIsBundle(item.isBundle ?? false)
    setBundleContents(item.bundleContents ?? [])
    setReleaseYear(item.releaseYear ?? '')
    setDuration(item.duration ?? '')
    setConsumed(item.consumed ?? false)
    setArtist(item.artist ?? '')
    setMusicType(item.musicType ?? '')
    setGenres(item.genres ?? [])
    setPartOfAlbum(item.partOfAlbum ?? '')
    setMusicSource(item.musicSource ?? '')
    setProducers(item.producers ?? [])
    setMusicReview(item.musicReview ?? '')
    setLabel(item.label ?? '')
    setHasTracks(item.hasTracks ?? false)
    setTracks(item.tracks ?? [])
    setSingleCovers(item.singleCovers ?? [])
    setEditions(item.editions ?? [])
    setUnitCount(item.unitCount ?? '')
    setStartYear(item.startYear ?? '')
    setEndYear(item.endYear ?? '')
    setTotalSubUnits(item.totalSubUnits ?? '')
    setUnits(item.units ?? [])
    setMangaAuthors(item.authors ?? [])
    setMangaSource(item.mangaSource ?? '')
    setMagazine(item.magazine ?? '')
    setMangaReview(item.mangaReview ?? '')
    setHasChapters(item.hasChapters ?? false)
    setChapters(item.chapters ?? [])
    setMovieSource(item.movieSource ?? '')
    setMovieReview(item.movieReview ?? '')
    setGameSource(item.gameSource ?? '')
    setGameReview(item.gameReview ?? '')
    setMangaArtists(item.mangaArtists ?? [])
    setVolumeCovers(item.volumeCovers ?? [])
    setMangaDescription(item.mangaDescription ?? '')
    setDirectors(item.directors ?? [])
    setCast(item.cast ?? [])
    setProductionCompanies(item.productionCompanies ?? [])
    setDistributors(item.distributors ?? [])
    setMovieDescription(item.movieDescription ?? '')
    setStudios(item.studios ?? [])
    setAnimeFormat(item.animeFormat ?? '')
    setAiringStatus(item.airingStatus ?? '')
    setWatchStatus(item.watchStatus ?? 'plan_to_watch')
    setEpisodesWatched(item.episodesWatched ?? '')
    setTotalEpisodes(item.totalEpisodes ?? '')
    setAnimeDescription(item.animeDescription ?? '')
    setSeason(item.season ?? '')
    setSeasonYear(item.seasonYear ?? '')
    setDemographic(item.demographic ?? '')
    setAlternativeTitles(item.alternativeTitles ?? [])
    setAnimeSource(item.animeSource ?? '')
    setEpisodeDuration(item.episodeDuration ?? '')
    setAiredFrom(item.airedFrom ?? '')
    setAiredTo(item.airedTo ?? '')
    setAgeRating(item.ageRating ?? '')
    setFavoriteEpisode(item.favoriteEpisode ?? '')
    setFavoriteEpisodeNote(item.favoriteEpisodeNote ?? '')
    setDroppedAtEpisode(item.droppedAtEpisode ?? '')
    setDroppedReason(item.droppedReason ?? '')
    setHasEpisodes(item.hasEpisodes ?? false)
    setEpisodes(item.episodes ?? [])
    setAnimeReview(item.animeReview ?? '')
    setRewatches(item.rewatches ?? [])
    setRelatedItems(item.relatedItems ?? [])
    setRecommendedItems(item.recommendedItems ?? [])
    setSeriesStatus(item.seriesStatus ?? 'plan_to_watch')
    setSeriesFormat(item.seriesFormat ?? '')
    setSeriesDescription(item.seriesDescription ?? '')
    setShowrunners(item.showrunners ?? [])
    setWriters(item.writers ?? [])
    setNetwork(item.network ?? '')
    setCountry(item.country ?? '')
    setLanguage(item.language ?? '')
    setContentRating(item.contentRating ?? '')
    if (item.seasons && item.seasons.length > 0) {
      setHasSeasons(item.hasSeasons ?? true)
      setSeasons(item.seasons)
    } else if (item.units && item.units.length > 0) {
      setHasSeasons(true)
      setSeasons(item.units.map((u) => ({ id: crypto.randomUUID(), number: String(u.number), watched: u.watched })))
    } else {
      setHasSeasons(item.hasSeasons ?? false)
      setSeasons([])
    }
    setSeriesReview(item.seriesReview ?? '')
    setFranchise(item.franchise ?? '')
    setWatchedWhere(item.watchedWhere ?? '')
    setMovieBanner(item.bannerImage2 ?? '')
    setHasSpoilers(item.hasSpoilers ?? false)
    setTimesWatched(item.timesWatched ?? '')
    setPubStatus(item.pubStatus ?? '')
    setReadingStatus(item.mangaStatus ?? 'plan_to_read')
    setChaptersRead(item.chaptersRead ?? '')
    setTotalChapters(item.totalChapters ?? '')
    setVolumesRead(item.volumesRead ?? '')
    setTotalVolumesM(item.totalVolumes ?? '')
    setStartDate(item.startDate ?? '')
  }

  const openEditPanel = (item: Item) => {
    if (item.categoryId === 'videojuegos') { setViewingGame(item); return }
    if (item.categoryId === 'musica') { setViewingMusic(item); return }
    if (isMangaLike(item.categoryId)) { setViewingManga(item); return }
    if (item.categoryId === 'peliculas') { setViewingMovie(item); return }
    if (isAnimeLikeCategory(item.categoryId)) { setViewingAnime(item); return }
    if (item.categoryId === 'series') { setViewingSeries(item); return }
    loadItemIntoForm(item)
    setPanelOpen(true)
  }

  // Global search / cross-category open: switches category first so the
  // sidebar reflects where the item lives, then hands off to the normal
  // detail-modal flow. Also closes any open modals so we land clean.
  const navigateToItem = (item: Item) => {
    setViewingGame(null); setViewingMusic(null); setViewingManga(null)
    setViewingMovie(null); setViewingAnime(null); setViewingSeries(null); setViewingArtist(null)
    setActiveCategory(item.categoryId)
    setActiveCollectionId(null)
    setSpecialView('none')
    setSubView('items')
    setTimeout(() => openEditPanel(item), 0)
  }

  const navigateToArtist = (a: MusicArtist) => {
    setViewingGame(null); setViewingMusic(null); setViewingManga(null)
    setViewingMovie(null); setViewingAnime(null); setViewingSeries(null)
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

  const applyToSelected = (updater: (item: Item) => Partial<Item>) => {
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
  const bulkMoveToLibrary = (targetCategoryId: string) => {
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
    patch: Partial<Item>,
    coverPath?: string,
    bannerPath?: string,
    sourceLabel = 'Metadata',
  ) => {
    if (patch.title) setTitle(patch.title)
    if (patch.alternativeTitles) setAlternativeTitles(patch.alternativeTitles)
    if (patch.genres) setGenres(patch.genres)
    if (patch.airedFrom) setAiredFrom(patch.airedFrom)
    if (patch.airedTo) setAiredTo(patch.airedTo)
    if (patch.releaseDate) setReleaseDate(patch.releaseDate)
    if (patch.seasonYear) setSeasonYear(patch.seasonYear)
    if (patch.season) setSeason(patch.season)
    if (patch.episodeDuration) setEpisodeDuration(patch.episodeDuration)
    if (patch.studios) setStudios(patch.studios)
    if (patch.animeFormat) setAnimeFormat(patch.animeFormat)
    if (patch.animeSource) setAnimeSource(patch.animeSource)
    if (patch.totalEpisodes) setTotalEpisodes(patch.totalEpisodes)
    if (patch.totalChapters) setTotalChapters(patch.totalChapters)
    if (patch.totalVolumes) setTotalVolumesM(patch.totalVolumes)

    // Movies / Series (TMDb)
    if (patch.movieDescription) setMovieDescription(patch.movieDescription)
    if (patch.seriesDescription) setSeriesDescription(patch.seriesDescription)
    if (patch.cast) setCast(patch.cast)
    if (patch.directors) setDirectors(patch.directors)
    if (patch.writers) setWriters(patch.writers)
    if (patch.showrunners) setShowrunners(patch.showrunners)
    if (patch.productionCompanies) setProductionCompanies(patch.productionCompanies)
    if (patch.network !== undefined) setNetwork(patch.network ?? '')
    if (patch.country !== undefined) setCountry(patch.country ?? '')
    if (patch.language !== undefined) setLanguage(patch.language ?? '')
    if (patch.seriesFormat) setSeriesFormat(patch.seriesFormat)
    if (patch.duration) setDuration(patch.duration)
    if (patch.hasSeasons !== undefined) setHasSeasons(patch.hasSeasons)
    if (patch.seasons) setSeasons(patch.seasons)

    // Music (MusicBrainz, VGMdb)
    if (patch.artist !== undefined) setArtist(patch.artist ?? '')
    if (patch.releaseYear) setReleaseYear(patch.releaseYear)
    if (patch.musicType) setMusicType(patch.musicType)
    if (patch.musicSource) setMusicSource(patch.musicSource)
    if (patch.label !== undefined) setLabel(patch.label ?? '')
    if (patch.producers) setProducers(patch.producers)
    if (patch.hasTracks !== undefined) setHasTracks(patch.hasTracks)
    if (patch.tracks) setTracks(patch.tracks)

    // Games (IGDB)
    if (patch.devs) setDevs(patch.devs)
    if (patch.publishers) setPublishers(patch.publishers)
    if (patch.platforms) setPlatforms(patch.platforms)
    if (patch.franchise !== undefined) setFranchise(patch.franchise ?? '')

    // Comics / Manga family (ComicVine, later MangaDex)
    if (patch.authors) setMangaAuthors(patch.authors)
    if (patch.mangaArtists) setMangaArtists(patch.mangaArtists)
    if (patch.mangaDescription) setMangaDescription(patch.mangaDescription)
    if (patch.totalChapters) setTotalChapters(patch.totalChapters)
    if (patch.totalVolumes) setTotalVolumesM(patch.totalVolumes)
    if (patch.magazine !== undefined) setMagazine(patch.magazine ?? '')
    if (patch.pubStatus) setPubStatus(patch.pubStatus)
    if (patch.mangaSource) setMangaSource(patch.mangaSource)

    // Explicit description fields (Kitsu passes them typed rather than
    // routing through the generic description key).
    if (patch.animeDescription) setAnimeDescription(patch.animeDescription)
    if (patch.mangaDescription && !patch.description) setMangaDescription(patch.mangaDescription)
    if (patch.airingStatus) setAiringStatus(patch.airingStatus)

    if (patch.description) {
      if (activeCategory === 'anime' || activeCategory === 'donghua') setAnimeDescription(patch.description)
      else if (isMangaLike(activeCategory)) setMangaDescription(patch.description)
      else setDescription(patch.description)
    }
    if (coverPath) setCover(coverPath)
    if (bannerPath) setBannerImage(bannerPath)
    setToast(`${sourceLabel} data applied`)
  }

  // Keep the old name as a thin wrapper so existing callers don't move.
  const applyAniListPatch = (patch: Partial<Item>, coverPath?: string, bannerPath?: string) =>
    applyFetchedPatch(patch, coverPath, bannerPath, 'AniList')

  const openEditFromModal = () => {
    if (!viewingGame) return
    loadItemIntoForm(viewingGame)
    setPanelOpen(true)
  }

  const openEditFromMusicModal = () => {
    if (!viewingMusic) return
    loadItemIntoForm(viewingMusic)
    setPanelOpen(true)
  }

  const openEditFromMangaModal = () => {
    if (!viewingManga) return
    loadItemIntoForm(viewingManga)
    setPanelOpen(true)
  }

  const openEditFromMovieModal = () => {
    if (!viewingMovie) return
    loadItemIntoForm(viewingMovie)
    setPanelOpen(true)
  }

  const openEditFromAnimeModal = () => {
    if (!viewingAnime) return
    loadItemIntoForm(viewingAnime)
    setPanelOpen(true)
  }

  const openEditFromSeriesModal = () => {
    if (!viewingSeries) return
    loadItemIntoForm(viewingSeries)
    setPanelOpen(true)
  }

  const closePanel = () => { setPanelOpen(false); setEditingId(null); resetForm() }

  const buildPreviewItem = (): Item => ({
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
  } as Item)

  const handleCoverFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setCover(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleBannerFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setBannerImage(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setLogoImage(reader.result) }
    reader.readAsDataURL(file)
  }

  const buildItemFromForm = (id: string, createdAt: number): Item => {
    const base: Item = {
      id, categoryId: activeCategory, title: title.trim(),
      cover: cover.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      rating: rating || undefined,
      finishedAt: finishedAt || undefined,
      createdAt,
    }

    if (isVideojuegos) {
      return {
        ...base,
        devs: devs.length > 0 ? devs : undefined,
        publishers: publishers.length > 0 ? publishers : undefined,
        achievementsUnlocked: achievementsUnlocked.trim() || undefined,
        achievementsTotal: achievementsTotal.trim() || undefined,
        releaseDate: releaseDate || undefined,
        bannerImage: bannerImage.trim() || undefined,
        logoImage: logoImage.trim() || undefined,
        description: description.trim() || undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        ownership: ownership || undefined,
        gameStatus,
        playTime: playTime || undefined,
        hasDlc,
        dlcList: hasDlc && dlcList.length > 0 ? dlcList : undefined,
        hasAddons,
        addonsList: hasAddons && addonsList.length > 0 ? addonsList : undefined,
        isBundle,
        bundleContents: isBundle && bundleContents.length > 0 ? bundleContents : undefined,
        alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : undefined,
        gameSource: gameSource || undefined,
        ageRating: ageRating || undefined,
        genres: genres.length > 0 ? genres : undefined,
        gameReview: gameReview.trim() || undefined,
        hasSpoilers: gameReview.trim() ? hasSpoilers : undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
        franchise: franchise.trim() || undefined,
        relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
        recommendedItems: recommendedItems.length > 0 ? recommendedItems : undefined,
      }
    }

    if (activeCategory === 'peliculas') {
      return {
        ...base,
        directors: directors.length > 0 ? directors : undefined,
        cast: cast.length > 0 ? cast : undefined,
        writers: writers.length > 0 ? writers : undefined,
        productionCompanies: productionCompanies.length > 0 ? productionCompanies : undefined,
        distributors: distributors.length > 0 ? distributors : undefined,
        movieDescription: movieDescription.trim() || undefined,
        franchise: franchise.trim() || undefined,
        watchedWhere: watchedWhere || undefined,
        bannerImage2: movieBanner.trim() || undefined,
        hasSpoilers: movieReview.trim() ? hasSpoilers : undefined,
        genres: genres.length > 0 ? genres : undefined,
        releaseYear: releaseYear || undefined,
        duration: duration || undefined,
        consumed,
        timesWatched: timesWatched || undefined,
        alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : undefined,
        movieSource: movieSource || undefined,
        contentRating: contentRating.trim() || undefined,
        movieReview: movieReview.trim() || undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
        relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
        recommendedItems: recommendedItems.length > 0 ? recommendedItems : undefined,
      }
    }

    if (isSeriesLike) {
      const useSeasons = hasSeasons && seasons.length > 0
      const derived = useSeasons ? seasonsDerivedCounts(seasons) : null
      return {
        ...base,
        unitCount: useSeasons ? String(seasons.length) : (unitCount || undefined),
        startYear: startYear || undefined,
        endYear: endYear || undefined,
        totalSubUnits: totalSubUnits || undefined,
        units: useSeasons ? undefined : (units.length > 0 ? units : undefined),
        seriesStatus,
        seriesFormat: seriesFormat || undefined,
        seriesDescription: seriesDescription.trim() || undefined,
        directors: directors.length > 0 ? directors : undefined,
        cast: cast.length > 0 ? cast : undefined,
        showrunners: showrunners.length > 0 ? showrunners : undefined,
        writers: writers.length > 0 ? writers : undefined,
        genres: genres.length > 0 ? genres : undefined,
        network: network.trim() || undefined,
        country: country.trim() || undefined,
        language: language.trim() || undefined,
        contentRating: contentRating.trim() || undefined,
        watchedWhere: watchedWhere || undefined,
        episodesWatched: derived ? String(derived.watched) : (episodesWatched || undefined),
        totalEpisodes: derived && derived.total > 0 ? String(derived.total) : (totalEpisodes || undefined),
        episodeDuration: episodeDuration || undefined,
        airedFrom: airedFrom || undefined,
        airedTo: airedTo || undefined,
        startDate: startDate || undefined,
        franchise: franchise.trim() || undefined,
        hasSeasons: useSeasons ? true : undefined,
        seasons: useSeasons ? seasons : undefined,
        seriesReview: seriesReview.trim() || undefined,
        hasSpoilers: seriesReview.trim() ? hasSpoilers : undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
      }
    }

    if (isAnime) {
      const useEpisodes = hasEpisodes && episodes.length > 0
      const derivedWatched = useEpisodes ? String(episodes.filter((e) => e.watched).length) : (episodesWatched || undefined)
      const derivedTotal = useEpisodes ? String(episodes.length) : (totalEpisodes || undefined)
      return {
        ...base,
        studios: studios.length > 0 ? studios : undefined,
        genres: genres.length > 0 ? genres : undefined,
        animeFormat: animeFormat || undefined,
        airingStatus: airingStatus || undefined,
        watchStatus,
        episodesWatched: derivedWatched,
        totalEpisodes: derivedTotal,
        animeDescription: animeDescription.trim() || undefined,
        season: season || undefined,
        seasonYear: seasonYear || undefined,
        demographic: demographic || undefined,
        startDate: startDate || undefined,
        alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : undefined,
        animeSource: animeSource || undefined,
        episodeDuration: episodeDuration || undefined,
        airedFrom: airedFrom || undefined,
        airedTo: airedTo || undefined,
        ageRating: ageRating || undefined,
        favoriteEpisode: favoriteEpisode || undefined,
        favoriteEpisodeNote: favoriteEpisodeNote.trim() || undefined,
        droppedAtEpisode: watchStatus === 'dropped' ? (droppedAtEpisode || undefined) : undefined,
        droppedReason: watchStatus === 'dropped' ? (droppedReason.trim() || undefined) : undefined,
        hasEpisodes: useEpisodes ? true : undefined,
        episodes: useEpisodes ? episodes : undefined,
        animeReview: animeReview.trim() || undefined,
        hasSpoilers: animeReview.trim() ? hasSpoilers : undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
        franchise: franchise.trim() || undefined,
        relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
        recommendedItems: recommendedItems.length > 0 ? recommendedItems : undefined,
      }
    }

    if (isManga) {
      const useChapters = hasChapters && chapters.length > 0
      const derivedChaptersRead = useChapters ? String(chapters.filter((c) => c.read).length) : (chaptersRead || undefined)
      const derivedTotalChapters = useChapters ? String(chapters.length) : (totalChapters || undefined)
      return {
        ...base,
        authors: mangaAuthors.length > 0 ? mangaAuthors : undefined,
        mangaArtists: mangaArtists.length > 0 ? mangaArtists : undefined,
        volumeCovers: volumeCovers.length > 0 ? volumeCovers : undefined,
        mangaDescription: mangaDescription.trim() || undefined,
        genres: genres.length > 0 ? genres : undefined,
        pubStatus: pubStatus || undefined,
        mangaStatus: readingStatus,
        chaptersRead: derivedChaptersRead,
        totalChapters: derivedTotalChapters,
        volumesRead: volumesRead || undefined,
        totalVolumes: totalVolumesM || undefined,
        startDate: startDate || undefined,
        alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : undefined,
        mangaSource: mangaSource || undefined,
        magazine: magazine.trim() || undefined,
        ageRating: ageRating || undefined,
        mangaReview: mangaReview.trim() || undefined,
        hasSpoilers: mangaReview.trim() ? hasSpoilers : undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
        franchise: franchise.trim() || undefined,
        relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
        recommendedItems: recommendedItems.length > 0 ? recommendedItems : undefined,
        hasChapters: useChapters ? true : undefined,
        chapters: useChapters ? chapters : undefined,
      }
    }

    if (activeCategory === 'musica') {
      const albumLike = isAlbumLikeMusic(musicType || undefined)
      return {
        ...base,
        releaseYear: !albumLike ? (releaseYear || undefined) : undefined,
        releaseDate: albumLike ? (releaseDate || undefined) : undefined,
        musicType: musicType || undefined,
        consumed,
        artist: artist.trim() || undefined,
        genres: albumLike && genres.length > 0 ? genres : undefined,
        partOfAlbum: !albumLike ? (partOfAlbum.trim() || undefined) : undefined,
        label: albumLike ? (label.trim() || undefined) : undefined,
        hasTracks: albumLike ? hasTracks : undefined,
        tracks: albumLike && hasTracks && tracks.length > 0 ? tracks : undefined,
        singleCovers: albumLike && singleCovers.length > 0 ? singleCovers : undefined,
        editions: albumLike && editions.length > 0 ? editions : undefined,
        alternativeTitles: alternativeTitles.length > 0 ? alternativeTitles : undefined,
        musicSource: musicSource || undefined,
        producers: producers.length > 0 ? producers : undefined,
        musicReview: musicReview.trim() || undefined,
        hasSpoilers: musicReview.trim() ? hasSpoilers : undefined,
        rewatches: rewatches.length > 0 ? rewatches : undefined,
        relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
        recommendedItems: recommendedItems.length > 0 ? recommendedItems : undefined,
      }
    }

    return base
  }

  const persistDataUrl = async (val: string | undefined, categoryId: string, kind: string): Promise<string | undefined> => {
    if (!val || !val.startsWith('data:')) return val
    const rel = await window.ipcRenderer.invoke('image:save', categoryId, kind, val)
    return typeof rel === 'string' ? rel : val
  }

  const persistItemImages = async (item: Item): Promise<Item> => {
    const cover = await persistDataUrl(item.cover, item.categoryId, 'cover')
    const bannerImage = await persistDataUrl(item.bannerImage, item.categoryId, 'banner')
    const bannerImage2 = await persistDataUrl(item.bannerImage2, item.categoryId, 'banner')
    const logoImage = await persistDataUrl(item.logoImage, item.categoryId, 'logo')
    let volumeCovers = item.volumeCovers
    if (volumeCovers && volumeCovers.length > 0) {
      volumeCovers = await Promise.all(volumeCovers.map(async (v) => ({ ...v, cover: (await persistDataUrl(v.cover, item.categoryId, 'volume')) ?? v.cover })))
    }
    let singleCovers = item.singleCovers
    if (singleCovers && singleCovers.length > 0) {
      singleCovers = await Promise.all(singleCovers.map(async (s) => ({ ...s, cover: (await persistDataUrl(s.cover, item.categoryId, 'single')) ?? s.cover })))
    }
    let editions = item.editions
    if (editions && editions.length > 0) {
      editions = await Promise.all(editions.map(async (e) => ({ ...e, cover: await persistDataUrl(e.cover, item.categoryId, 'edition') })))
    }
    return { ...item, cover, bannerImage, bannerImage2, logoImage, volumeCovers, singleCovers, editions }
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
  const findOrphanedItemAssets = (oldItem: Item | undefined, newItem: Item): string[] => {
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
    if (editingId) {
      const oldItem = items.find((it) => it.id === editingId)
      const createdAt = oldItem?.createdAt ?? Date.now()
      const built = buildItemFromForm(editingId, createdAt)
      const updated = await persistItemImages(built)
      findOrphanedItemAssets(oldItem, updated).forEach(deleteAssetFile)
      setItems((prev) => prev.map((it) => (it.id === editingId ? updated : it)))
      if (viewingGame && viewingGame.id === editingId) setViewingGame(updated)
      if (viewingMusic && viewingMusic.id === editingId) setViewingMusic(updated)
      if (viewingManga && viewingManga.id === editingId) setViewingManga(updated)
      if (viewingMovie && viewingMovie.id === editingId) setViewingMovie(updated)
      if (viewingAnime && viewingAnime.id === editingId) setViewingAnime(updated)
      if (viewingSeries && viewingSeries.id === editingId) setViewingSeries(updated)
    } else {
      const built = buildItemFromForm(crypto.randomUUID(), Date.now())
      const created = await persistItemImages(built)
      setItems((prev) => [...prev, created])
    }
    setToast('Saved')
    closePanel()
  }

  const performDelete = (item: Item) => {
    // Fire-and-forget removal of any local asset files this item owned so
    // deleting an entry doesn't leave orphan images under assets/.
    deleteAssetFile(item.cover)
    deleteAssetFile(item.bannerImage)
    deleteAssetFile(item.bannerImage2)
    deleteAssetFile(item.logoImage)
    ;(item.volumeCovers ?? []).forEach((v) => deleteAssetFile(v.cover))
    ;(item.singleCovers ?? []).forEach((s) => deleteAssetFile(s.cover))
    ;(item.editions ?? []).forEach((e) => deleteAssetFile(e.cover))
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setCollections((prev) => prev.map((c) => ({ ...c, itemIds: c.itemIds.filter((id) => id !== item.id) })))
    if (editingId === item.id) closePanel()
    if (viewingGame && viewingGame.id === item.id) setViewingGame(null)
    if (viewingMusic && viewingMusic.id === item.id) setViewingMusic(null)
    if (viewingManga && viewingManga.id === item.id) setViewingManga(null)
    if (viewingMovie && viewingMovie.id === item.id) setViewingMovie(null)
    if (viewingAnime && viewingAnime.id === item.id) setViewingAnime(null)
    if (viewingSeries && viewingSeries.id === item.id) setViewingSeries(null)
  }

  const handleDelete = (item: Item) => {
    if (settings.confirmDelete) askConfirm(`Delete "${item.title}"? This can't be undone.`, () => performDelete(item), true)
    else performDelete(item)
  }

  const handleDeleteFromPanel = () => { if (editingItem) handleDelete(editingItem) }

  const handleDuplicateGame = () => {
    if (!viewingGame) return
    const copy: Item = { ...viewingGame, id: crypto.randomUUID(), title: `${viewingGame.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingGame(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleDuplicateMusic = () => {
    if (!viewingMusic) return
    const copy: Item = { ...viewingMusic, id: crypto.randomUUID(), title: `${viewingMusic.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingMusic(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleDuplicateManga = () => {
    if (!viewingManga) return
    const copy: Item = { ...viewingManga, id: crypto.randomUUID(), title: `${viewingManga.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingManga(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleDuplicateMovie = () => {
    if (!viewingMovie) return
    const copy: Item = { ...viewingMovie, id: crypto.randomUUID(), title: `${viewingMovie.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingMovie(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleDuplicateAnime = () => {
    if (!viewingAnime) return
    const copy: Item = { ...viewingAnime, id: crypto.randomUUID(), title: `${viewingAnime.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingAnime(null)
    loadItemIntoForm(copy)
    setPanelOpen(true)
  }

  const handleDuplicateSeries = () => {
    if (!viewingSeries) return
    const copy: Item = { ...viewingSeries, id: crypto.randomUUID(), title: `${viewingSeries.title} (Copy)`, createdAt: Date.now() }
    setItems((prev) => [...prev, copy])
    setViewingSeries(null)
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

  const handleCollectionCoverFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setCollectionCoverField(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleSaveCollectionEdit = async () => {
    if (!collectionNameField.trim() || !editingCollectionId) return
    const trimmedCover = collectionCoverField.trim()
    let cover: string | undefined
    if (!trimmedCover) cover = undefined
    else if (trimmedCover.startsWith('data:')) {
      const rel = await window.ipcRenderer.invoke('image:save', 'groups', 'cover', trimmedCover)
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

  return (
    <Suspense fallback={null}>
    <div
      className="app"
      data-theme={settings.theme}
      data-accent={settings.accent === 'default' ? undefined : settings.accent}
      data-density={settings.density}
      data-font-size={settings.fontSize}
      data-motion={settings.motion}
    >
      {updateInfo && !updateBannerDismissed && (
        <div className="update-banner">
          <span className="update-banner-icon">↗</span>
          <div className="update-banner-body">
            <span className="update-banner-title">Omnio {updateInfo.latest} is available</span>
            <span className="update-banner-sub">
              You're on {updateInfo.current}.
              {updateInfo.matchedAssetName ? ` Download matches your build: ${updateInfo.matchedAssetName}.` : ' Pick the build for your platform on the release page.'}
            </span>
          </div>
          <div className="update-banner-actions">
            {updateInfo.matchedAssetUrl && (
              <button type="button" className="update-banner-btn primary" onClick={() => window.ipcRenderer.invoke('updates:open-url', updateInfo.matchedAssetUrl!)}>Download</button>
            )}
            <button type="button" className={updateInfo.matchedAssetUrl ? 'update-banner-btn ghost' : 'update-banner-btn primary'} onClick={() => window.ipcRenderer.invoke('updates:open-url', updateInfo.htmlUrl)}>Release page</button>
            <button type="button" className="update-banner-btn ghost" onClick={() => setUpdateBannerDismissed(true)}>Later</button>
          </div>
        </div>
      )}
      <div className="body">
        {!settings.sidebarHidden && (
        <nav className={settings.sidebarCompact ? 'sidebar sidebar-icons' : 'sidebar'}>
          <div className="brand-row">
            <svg className="brand-logo" viewBox="0 0 128 128" aria-hidden="true">
              <circle cx="64" cy="64" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
              <path d="M64 26 L71.5 56.5 L102 64 L71.5 71.5 L64 102 L56.5 71.5 L26 64 L56.5 56.5 Z" fill="currentColor" />
              <circle cx="64" cy="64" r="6" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
            <span className="brand-mark">Omnio</span>
            <button className="sidebar-toggle" onClick={() => setSettings((s) => ({ ...s, sidebarHidden: true }))} title="Hide sidebar">⟨⟨</button>
          </div>

          <span className="sidebar-section-title">Library</span>
          <div className="sidebar-nav">
            {CATEGORIES.filter((c) => !settings.enabledCategories || settings.enabledCategories.includes(c.id)).map((cat) => {
              const enabledFn = (id: string) => !settings.enabledCategories || settings.enabledCategories.includes(id)
              const firstEnabledComic = CATEGORIES.filter((c) => enabledFn(c.id) && COMIC_CATEGORY_IDS.includes(c.id))[0]?.id
              const firstEnabledAnime = CATEGORIES.filter((c) => enabledFn(c.id) && ANIME_CATEGORY_IDS.includes(c.id))[0]?.id
              if (COMIC_CATEGORY_IDS.includes(cat.id) && cat.id !== firstEnabledComic) return null
              if (ANIME_CATEGORY_IDS.includes(cat.id) && cat.id !== firstEnabledAnime) return null
              if (cat.id === firstEnabledComic) {
                const enabledComics = CATEGORIES.filter((c) => COMIC_CATEGORY_IDS.includes(c.id) && enabledFn(c.id))
                const groupActive = specialView === 'none' && COMIC_CATEGORY_IDS.includes(activeCategory)
                return (
                  <div key="comics-group">
                    <button className={groupActive ? 'nav-item active' : 'nav-item'} onClick={() => setComicsOpen((o) => !o)}>
                      <span className="nav-icon"><CategoryIcon id="manga" /></span>
                      <span>{COMIC_GROUP_LABEL}</span>
                      <span className="nav-caret"><ChevronIcon open={comicsOpen} /></span>
                    </button>
                    {comicsOpen && (
                      <div className="nav-subgroup">
                        {enabledComics.map((sub) => (
                          <button
                            key={sub.id}
                            className={specialView === 'none' && activeCategory === sub.id ? 'nav-item sub active' : 'nav-item sub'}
                            onClick={() => switchCategory(sub.id)}
                          >
                            <span className="nav-icon"><CategoryIcon id={sub.id} /></span>
                            <span>{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              if (cat.id === firstEnabledAnime) {
                const enabledAnimeCats = CATEGORIES.filter((c) => ANIME_CATEGORY_IDS.includes(c.id) && enabledFn(c.id))
                const groupActive = specialView === 'none' && ANIME_CATEGORY_IDS.includes(activeCategory)
                return (
                  <div key="anime-group">
                    <button className={groupActive ? 'nav-item active' : 'nav-item'} onClick={() => setAnimeGroupOpen((o) => !o)}>
                      <span className="nav-icon"><CategoryIcon id="anime" /></span>
                      <span>{ANIME_GROUP_LABEL}</span>
                      <span className="nav-caret"><ChevronIcon open={animeGroupOpen} /></span>
                    </button>
                    {animeGroupOpen && (
                      <div className="nav-subgroup">
                        {enabledAnimeCats.map((sub) => (
                          <button
                            key={sub.id}
                            className={specialView === 'none' && activeCategory === sub.id ? 'nav-item sub active' : 'nav-item sub'}
                            onClick={() => switchCategory(sub.id)}
                          >
                            <span className="nav-icon"><CategoryIcon id={sub.id} /></span>
                            <span>{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button key={cat.id} className={specialView === 'none' && cat.id === activeCategory ? 'nav-item active' : 'nav-item'} onClick={() => switchCategory(cat.id)}>
                  <span className="nav-icon"><CategoryIcon id={cat.id} /></span>
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {activeCategory === 'videojuegos' && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                {GAME_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    className={specialView === 'board' && boardStatus === s.value ? 'nav-item active' : 'nav-item'}
                    onClick={() => { setSpecialView('board'); setBoardStatus(s.value); closePanel(); closeAllDetailViews() }}
                  >
                    <span className="nav-icon"><GameStatusIcon value={s.value} /></span>
                    <span>{s.label}</span>
                    <span className="nav-count">{gamesList.filter((g) => (g.gameStatus || 'backlog') === s.value).length}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeCategory === 'musica' && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                <button
                  className={specialView === 'musicBoard' && musicBoardFilter === 'listened' ? 'nav-item active' : 'nav-item'}
                  onClick={() => { setSpecialView('musicBoard'); setMusicBoardFilter('listened'); closePanel(); closeAllDetailViews() }}
                >
                  <span className="nav-icon">✓</span>
                  <span>Listened</span>
                  <span className="nav-count">{musicList.filter((m) => m.consumed).length}</span>
                </button>
                <button
                  className={specialView === 'musicBoard' && musicBoardFilter === 'unlistened' ? 'nav-item active' : 'nav-item'}
                  onClick={() => { setSpecialView('musicBoard'); setMusicBoardFilter('unlistened'); closePanel(); closeAllDetailViews() }}
                >
                  <span className="nav-icon">○</span>
                  <span>Not listened</span>
                  <span className="nav-count">{musicList.filter((m) => !m.consumed).length}</span>
                </button>
              </div>
            </>
          )}

          {activeCategory === 'peliculas' && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                <button
                  className={specialView === 'moviesBoard' && moviesBoardFilter === 'watched' ? 'nav-item active' : 'nav-item'}
                  onClick={() => { setSpecialView('moviesBoard'); setMoviesBoardFilter('watched'); closePanel(); closeAllDetailViews() }}
                >
                  <span className="nav-icon">✓</span>
                  <span>Watched</span>
                  <span className="nav-count">{itemsInCategory.filter((i) => i.consumed).length}</span>
                </button>
                <button
                  className={specialView === 'moviesBoard' && moviesBoardFilter === 'unwatched' ? 'nav-item active' : 'nav-item'}
                  onClick={() => { setSpecialView('moviesBoard'); setMoviesBoardFilter('unwatched'); closePanel(); closeAllDetailViews() }}
                >
                  <span className="nav-icon">○</span>
                  <span>Not watched</span>
                  <span className="nav-count">{itemsInCategory.filter((i) => !i.consumed).length}</span>
                </button>
              </div>
            </>
          )}

          {isAnime && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                {ANIME_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    className={specialView === 'animeBoard' && animeBoardStatus === s.value ? 'nav-item active' : 'nav-item'}
                    onClick={() => { setSpecialView('animeBoard'); setAnimeBoardStatus(s.value); closePanel(); closeAllDetailViews() }}
                  >
                    <span className="nav-icon"><AnimeStatusIcon value={s.value} /></span>
                    <span>{s.label}</span>
                    <span className="nav-count">{itemsInCategory.filter((i) => (i.watchStatus || 'plan_to_watch') === s.value).length}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {isSeriesLike && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                {SERIES_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    className={specialView === 'seriesBoard' && seriesBoardStatus === s.value ? 'nav-item active' : 'nav-item'}
                    onClick={() => { setSpecialView('seriesBoard'); setSeriesBoardStatus(s.value); closePanel(); closeAllDetailViews() }}
                  >
                    <span className="nav-icon"><AnimeStatusIcon value={s.value} /></span>
                    <span>{s.label}</span>
                    <span className="nav-count">{itemsInCategory.filter((i) => (i.seriesStatus || 'plan_to_watch') === s.value).length}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {isManga && (
            <>
              <div className="sidebar-divider" />
              <span className="sidebar-section-title">Collections</span>
              <div className="sidebar-nav">
                {MANGA_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    className={specialView === 'mangaBoard' && mangaBoardStatus === s.value ? 'nav-item active' : 'nav-item'}
                    onClick={() => { setSpecialView('mangaBoard'); setMangaBoardStatus(s.value); closePanel(); closeAllDetailViews() }}
                  >
                    <span className="nav-icon"><MangaStatusIcon value={s.value} /></span>
                    <span>{s.label}</span>
                    <span className="nav-count">{itemsInCategory.filter((i) => (i.mangaStatus || 'plan_to_read') === s.value).length}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="sidebar-divider" />
          <div className="sidebar-nav">
            <button className={specialView === 'stats' ? 'nav-item active' : 'nav-item'} onClick={() => { setSpecialView('stats'); closePanel(); closeAllDetailViews() }}>
              <span className="nav-icon"><InsightsIcon /></span>
              <span>Statistics</span>
            </button>
          </div>

          <div className="sidebar-footer">
            <button className={specialView === 'settings' ? 'sidebar-action active' : 'sidebar-action'} onClick={() => { setSpecialView('settings'); closePanel(); closeAllDetailViews() }}>
              <span className="nav-icon"><SettingsIcon /></span>
              <span>Settings</span>
            </button>
          </div>
        </nav>
        )}

        {settings.sidebarHidden && (
          <button className="sidebar-reveal" onClick={() => setSettings((s) => ({ ...s, sidebarHidden: false }))} title="Show sidebar">⟩⟩</button>
        )}

        <main className="content">
          {viewingGame ? (
            <GameDetailModal
              item={viewingGame}
              groups={collections.filter((c) => c.categoryId === 'videojuegos' && c.itemIds.includes(viewingGame.id))}
              allGames={items.filter((i) => i.categoryId === 'videojuegos')}
              onClose={() => setViewingGame(null)}
              onEdit={openEditFromModal}
              onDuplicate={handleDuplicateGame}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingGame(target) }}
            />
          ) : viewingMusic ? (
            <MusicDetailModal
              item={viewingMusic}
              groups={collections.filter((c) => c.categoryId === 'musica' && c.itemIds.includes(viewingMusic.id))}
              allMusic={items.filter((i) => i.categoryId === 'musica')}
              onClose={() => setViewingMusic(null)}
              onEdit={openEditFromMusicModal}
              onDuplicate={handleDuplicateMusic}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingMusic(target) }}
              onSaveTrackLyrics={(trackId, lyrics) => {
                const updated: Item = { ...viewingMusic, tracks: (viewingMusic.tracks ?? []).map((t) => t.id === trackId ? { ...t, lyrics: lyrics.trim() || undefined } : t) }
                setItems((prev) => prev.map((i) => i.id === viewingMusic.id ? updated : i))
                setViewingMusic(updated)
                setToast('Lyrics saved')
              }}
            />
          ) : viewingMovie ? (
            <MovieDetailModal
              item={viewingMovie}
              groups={collections.filter((c) => c.categoryId === 'peliculas' && c.itemIds.includes(viewingMovie.id))}
              allMovies={items.filter((i) => i.categoryId === 'peliculas')}
              onClose={() => setViewingMovie(null)}
              onEdit={openEditFromMovieModal}
              onDuplicate={handleDuplicateMovie}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingMovie(target) }}
            />
          ) : viewingAnime ? (
            <AnimeDetailModal
              item={viewingAnime}
              groups={collections.filter((c) => c.categoryId === viewingAnime.categoryId && c.itemIds.includes(viewingAnime.id))}
              allAnime={items.filter((i) => isAnimeLikeCategory(i.categoryId))}
              onClose={() => setViewingAnime(null)}
              onEdit={openEditFromAnimeModal}
              onDuplicate={handleDuplicateAnime}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingAnime(target) }}
            />
          ) : viewingSeries ? (
            <SeriesDetailModal
              item={viewingSeries}
              groups={collections.filter((c) => c.categoryId === 'series' && c.itemIds.includes(viewingSeries.id))}
              allSeries={items.filter((i) => i.categoryId === 'series')}
              onClose={() => setViewingSeries(null)}
              onEdit={openEditFromSeriesModal}
              onDuplicate={handleDuplicateSeries}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingSeries(target) }}
            />
          ) : viewingManga ? (
            <MangaDetailModal
              item={viewingManga}
              groups={collections.filter((c) => c.categoryId === viewingManga.categoryId && c.itemIds.includes(viewingManga.id))}
              allManga={items.filter((i) => isMangaLike(i.categoryId))}
              onClose={() => setViewingManga(null)}
              onEdit={openEditFromMangaModal}
              onDuplicate={handleDuplicateManga}
              onNavigate={(id) => { const target = items.find((i) => i.id === id); if (target) setViewingManga(target) }}
            />
          ) : viewingArtist ? (
            <ArtistDetailView
              artist={viewingArtist}
              items={musicList.filter((m) => m.artist === viewingArtist.name)}
              layout={layout}
              onSetLayout={setLayout}
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
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><GameStatusIcon value={boardStatus} /></span>
                  <div><h1>{GAME_STATUS_OPTIONS.find((s) => s.value === boardStatus)?.label}</h1><span className="page-count">{gamesList.filter((g) => (g.gameStatus || 'backlog') === boardStatus).length} games</span></div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input
                  className="search-input"
                  placeholder="Search by title... (Ctrl+F)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={g.id} item={g} layout={layout} onOpen={openEditPanel} onDelete={handleDelete}
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
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon">{musicBoardFilter === 'listened' ? '✓' : '○'}</span>
                  <div>
                    <h1>{musicBoardFilter === 'listened' ? 'Listened' : 'Not listened'}</h1>
                    <span className="page-count">{list.length} items</span>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={m.id} item={m} layout={layout} onOpen={openEditPanel} onDelete={handleDelete} musicFields={settings.musicFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'mangaBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.mangaStatus || 'plan_to_read') === mangaBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><MangaStatusIcon value={mangaBoardStatus} /></span>
                  <div>
                    <h1>{getMangaStatus(mangaBoardStatus).label}</h1>
                    <span className="page-count">{list.length} items</span>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={i.id} item={i} layout={layout} onOpen={openEditPanel} onDelete={handleDelete} mangaFields={settings.mangaFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'moviesBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => moviesBoardFilter === 'watched' ? i.consumed : !i.consumed), search, [], [], [], [], sortBy)
            return (<>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon">{moviesBoardFilter === 'watched' ? '✓' : '○'}</span>
                  <div>
                    <h1>{moviesBoardFilter === 'watched' ? 'Watched' : 'Not watched'}</h1>
                    <span className="page-count">{list.length} items</span>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={i.id} item={i} layout={layout} onOpen={openEditPanel} onDelete={handleDelete} movieFields={settings.movieFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'animeBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.watchStatus || 'plan_to_watch') === animeBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><AnimeStatusIcon value={animeBoardStatus} /></span>
                  <div>
                    <h1>{getAnimeStatus(animeBoardStatus).label}</h1>
                    <span className="page-count">{list.length} items</span>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={i.id} item={i} layout={layout} onOpen={openEditPanel} onDelete={handleDelete} animeFields={settings.animeFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'seriesBoard' && (() => {
            const list = filterAndSort(itemsInCategory.filter((i) => (i.seriesStatus || 'plan_to_watch') === seriesBoardStatus), search, [], [], [], [], sortBy)
            return (<>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><AnimeStatusIcon value={seriesBoardStatus} /></span>
                  <div>
                    <h1>{getSeriesStatus(seriesBoardStatus).label}</h1>
                    <span className="page-count">{list.length} items</span>
                  </div>
                </div>
                <div className="header-actions">
                  <div className="view-toggle">
                    <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                    <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                    <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                  </div>
                </div>
              </div>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by title... (Ctrl+F)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
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
                  <ItemCard key={i.id} item={i} layout={layout} onOpen={openEditPanel} onDelete={handleDelete} seriesFields={settings.seriesFields} />
                ))}
              </div>
              </div>
            </>)
          })()}

          {specialView === 'stats' && (
            <>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><InsightsIcon /></span>
                  <div><h1>Statistics</h1></div>
                </div>
              </div>
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
              </div>
              </div>
            </>
          )}

          {specialView === 'settings' && (
            <>
              <div className="content-header">
                <div className="page-title">
                  <span className="page-icon"><SettingsIcon /></span>
                  <div><h1>Settings</h1></div>
                </div>
              </div>
              <div className="settings-layout">
              <aside className="settings-sidebar">
                <button className={settingsTab === 'appearance' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('appearance')}><span className="settings-nav-icon">◐</span>Appearance</button>
                <button className={settingsTab === 'behavior' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('behavior')}><span className="settings-nav-icon">⚙</span>Behavior</button>
                <button className={settingsTab === 'libraries' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('libraries')}><span className="settings-nav-icon">☰</span>Libraries</button>
                <button className={settingsTab === 'cards' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('cards')}><span className="settings-nav-icon">▦</span>Card Fields</button>
                <button className={settingsTab === 'data' ? 'settings-nav-btn active' : 'settings-nav-btn'} onClick={() => setSettingsTab('data')}><span className="settings-nav-icon">⌘</span>Data</button>
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
                      <label>Font size</label>
                      <div className="yesno">
                        <button type="button" className={settings.fontSize === 'small' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, fontSize: 'small' }))}>Small</button>
                        <button type="button" className={settings.fontSize === 'medium' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, fontSize: 'medium' }))}>Medium</button>
                        <button type="button" className={settings.fontSize === 'large' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, fontSize: 'large' }))}>Large</button>
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Sidebar</label>
                      <div className="yesno">
                        <button type="button" className={!settings.sidebarCompact ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, sidebarCompact: false }))}>Full</button>
                        <button type="button" className={settings.sidebarCompact ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, sidebarCompact: true }))}>Icons only</button>
                      </div>
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
                      <label>On startup, open</label>
                      <div className="yesno">
                        <button type="button" className={settings.startupCategory === 'last' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, startupCategory: 'last' }))}>Last used category</button>
                        <button type="button" className={settings.startupCategory === 'first' ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, startupCategory: 'first' }))}>First category</button>
                      </div>
                    </div>
                  </>
                )}

                {settingsTab === 'libraries' && (
                  <div className="field-group">
                    <label>Enabled libraries</label>
                    <p className="hint">Uncheck a library to hide it from the sidebar and insights. Your data is preserved even if you disable one.</p>
                    <div className="library-toggle-list">
                      {CATEGORIES.map((cat) => {
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
                )}

                {settingsTab === 'cards' && (
                  <>
                    <div className="field-group">
                      <label>Games</label>
                      <div className="pills">
                        {GAME_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.gameFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, gameFields: { ...s.gameFields, [f.value]: !s.gameFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Music</label>
                      <div className="pills">
                        {MUSIC_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.musicFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, musicFields: { ...s.musicFields, [f.value]: !s.musicFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Manga, Manhwa, Manhua &amp; Western Comics</label>
                      <div className="pills">
                        {MANGA_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.mangaFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, mangaFields: { ...s.mangaFields, [f.value]: !s.mangaFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Movies</label>
                      <div className="pills">
                        {MOVIE_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.movieFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, movieFields: { ...s.movieFields, [f.value]: !s.movieFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Anime</label>
                      <div className="pills">
                        {ANIME_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.animeFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, animeFields: { ...s.animeFields, [f.value]: !s.animeFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Series</label>
                      <div className="pills">
                        {SERIES_FIELD_OPTIONS.map((f) => (
                          <button key={f.value} type="button" className={settings.seriesFields[f.value] ? 'pill active' : 'pill'} onClick={() => setSettings((s) => ({ ...s, seriesFields: { ...s.seriesFields, [f.value]: !s.seriesFields[f.value] } }))}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {settingsTab === 'data' && (
                  <>
                    <div className="field-group">
                      <label>Backup</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={handleExport}>⬇ Export backup</button>
                        <button type="button" className="secondary-btn" onClick={() => importInputRef.current?.click()}>⬆ Import backup</button>
                        <input type="file" accept="application/json" ref={importInputRef} style={{ display: 'none' }} onChange={handleImportFile} />
                      </div>
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
                      <label>Data quality</label>
                      <button type="button" className="secondary-btn" onClick={() => setDupOpen(true)}>Find similar titles</button>
                    </div>
                    <div className="field-group">
                      <label>Import from other trackers</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => setMalOpen(true)}>Import MAL / AniList XML</button>
                        <button type="button" className="secondary-btn" onClick={() => setGenericImportOpen(true)}>Import Excel / CSV / Notion / TXT</button>
                      </div>
                      <p className="hint">Bulk-load titles from other places. MAL/AniList uses the XML export; the generic importer takes an .xlsx, .csv (including Notion database exports), .tsv or .txt file with one title per line.</p>
                    </div>
                    <div className="field-group">
                      <label>Share your library</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => setWrappedOpen(true)}>Yearly wrapped</button>
                        <button type="button" className="secondary-btn" disabled={exporting} onClick={async () => {
                          const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose where to export your Omnio site')
                          if (!dir) return
                          setExporting(true)
                          const html = buildStaticSiteHtml(items, musicArtists, 'My Omnio Library')
                          const r = await window.ipcRenderer.invoke('export:site', dir, html)
                          setExporting(false)
                          if (r?.ok) setToast(`Exported to ${r.path}`)
                          else setToast(`Export failed: ${r?.error ?? 'unknown'}`)
                        }}>{exporting ? 'Exporting…' : 'Export as HTML'}</button>
                      </div>
                      <p className="hint">Wrapped is a year-in-review view. Export builds a standalone <code>index.html</code> and copies your <code>assets/</code> folder — send the folder to a friend and it just opens.</p>
                    </div>
                    <div className="field-group">
                      <label>Integrations · ComicVine API key (Western Comics)</label>
                      <input
                        type="password"
                        placeholder="Paste your ComicVine key…"
                        value={settings.comicvineApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, comicvineApiKey: e.target.value }))}
                      />
                      <p className="hint">
                        Register a free key at <code>comicvine.gamespot.com/api/</code>. Enables
                        the "↗ ComicVine" button in the Western Comics editor. Covers Marvel,
                        DC, Image and indie publishers.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>Integrations · IGDB (Games) — Twitch Client ID + Secret</label>
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
                      <p className="hint">
                        Create a free Twitch app at <code>dev.twitch.tv/console/apps</code> (category
                        "Application Integration", any localhost redirect URL). Enables the
                        "↗ IGDB" button next to the cover in the Game editor.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>Integrations · TMDb API key (Movies + Series)</label>
                      <input
                        type="password"
                        placeholder="Paste your TMDb v3 API key…"
                        value={settings.tmdbApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, tmdbApiKey: e.target.value }))}
                      />
                      <p className="hint">
                        Get a free v3 key at <code>themoviedb.org/settings/api</code>. Enables
                        the "↗ TMDb" button next to the cover field in the Movie and Series editors.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>Integrations · SteamGridDB API key</label>
                      <input
                        type="password"
                        placeholder="Paste your SteamGridDB key…"
                        value={settings.sgdbApiKey ?? ''}
                        onChange={(e) => setSettings((s) => ({ ...s, sgdbApiKey: e.target.value }))}
                      />
                      <p className="hint">
                        Get a free key at <code>steamgriddb.com/profile/preferences/api</code>. Enables
                        the "↗ SteamGridDB" button next to cover / banner / logo in the game editor.
                        AniList (anime & manga) needs no key.
                      </p>
                    </div>
                    <div className="field-group">
                      <label>Updates</label>
                      <div className="settings-actions">
                        <button type="button" className="secondary-btn" onClick={() => runUpdateCheck(false)} disabled={updateCheckState === 'checking'}>
                          {updateCheckState === 'checking' ? 'Checking…' : 'Check for updates'}
                        </button>
                        {updateInfo?.matchedAssetUrl && (
                          <button type="button" className="secondary-btn" onClick={() => window.ipcRenderer.invoke('updates:open-url', updateInfo.matchedAssetUrl!)}>
                            ⬇ Download {updateInfo.matchedAssetName}
                          </button>
                        )}
                        {updateInfo && (
                          <button type="button" className="secondary-btn" onClick={() => window.ipcRenderer.invoke('updates:open-url', updateInfo.htmlUrl)}>
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
                    <div className="field-group">
                      <label>Reset settings</label>
                      <button type="button" className="secondary-btn" onClick={() => askConfirm('Reset all settings to defaults? Your library data won’t be affected.', () => { setSettings(DEFAULT_SETTINGS); setLayout(DEFAULT_SETTINGS.defaultLayout); setToast('Settings reset') })}>Reset to defaults</button>
                    </div>
                    <div className="field-group">
                      <label>Danger zone</label>
                      <button type="button" className="danger-btn" onClick={handleWipeAll}>Delete all data</button>
                    </div>
                    <div className="field-group">
                      <label>About</label>
                      <div className="about-box">
                        <p className="about-title">Omnio <span className="about-version">v{APP_VERSION}</span></p>
                        <p className="about-tagline">A personal hobby backlog tracker for games, music, movies, series, anime and comics.</p>
                        <p className="about-line">Local-only. No accounts, no telemetry, no cloud. Your data lives in this machine.</p>
                        <p className="about-line about-stack">Built with Electron · React · Vite · TypeScript</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </div>
              </div>
            </>
          )}

          {specialView === 'none' && (
            <>
              <div className="content-header">
                <div className="page-title">
                  {activeCollectionId && <button className="back-btn" onClick={() => { setActiveCollectionId(null); resetListControls() }}>←</button>}
                  <span className="page-icon">{activeCollectionId ? <FolderIcon /> : <CategoryIcon id={current?.id ?? ''} />}</span>
                  <div>
                    <h1>{activeCollectionId ? activeCollection?.name : current?.label}</h1>
                    <span className="page-count">
                      {showFolderListing
                        ? `${categoryCollections.length} ${categoryCollections.length === 1 ? 'group' : 'groups'}`
                        : `${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'items'}`}
                    </span>
                  </div>
                </div>
                <div className="header-actions">
                  {!showFolderListing && (
                    <div className="view-toggle">
                      <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
                      <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
                      <button className={layout === 'compact' ? 'active' : ''} onClick={() => setLayout('compact')}>≡ Compact</button>
                    </div>
                  )}
                  {subView === 'items' && <button className="add-btn" onClick={openAddPanel}>+ Add</button>}
                </div>
              </div>

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
                  </div>
                  <div className="folder-grid">
                    {musicArtists.length === 0 && <p className="empty">No artists yet.</p>}
                    {musicArtists.map((a) => (
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
                  </div>
                  <div className="folder-grid">
                    {categoryCollections.length === 0 && <p className="empty">You haven't created any groups here yet.</p>}
                    {categoryCollections.map((c) => (
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
                    <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                      <option value="recent">Most recent</option>
                      <option value="alpha">Alphabetical</option>
                      <option value="rating">Rating</option>
                      <option value="custom">{activeCollection ? 'Manual order' : 'Custom order'}</option>
                      {activeCategory === 'videojuegos' && <>
                        <option value="time">Time played</option>
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
                      onClear={() => { setFilterTags([]); setFilterStatus([]); setFilterPlatforms([]); setFilterGenres([]) }}
                    />
                  </div>

                  <div className="content-scroll">
                  {sortBy === 'custom' && <p className="hint drag-hint">Drag cards to reorder them.</p>}

                  <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
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
                          <button className="secondary-btn" onClick={resetListControls}>Clear filters</button>
                        </div>
                      )
                    )}
                    {visibleItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        layout={layout}
                        onOpen={openEditPanel}
                        onDelete={handleDelete}
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
                      />
                    ))}
                  </div>
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
                <button className="panel-close" onClick={closePanel}>✕</button>
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
                        item={buildPreviewItem()}
                        layout="grid"
                        onOpen={() => { /* preview only */ }}
                        onDelete={() => { /* preview only */ }}
                        gameFields={settings.gameFields}
                        musicFields={settings.musicFields}
                        mangaFields={settings.mangaFields}
                        movieFields={settings.movieFields}
                        animeFields={settings.animeFields}
                        seriesFields={settings.seriesFields}
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

                  <div className="form">
                    <div className="metadata-sources-panel">
                      <div className="metadata-sources-header">
                        <span className="metadata-sources-title">↗ Fetch metadata</span>
                        <span className="metadata-sources-hint">Auto-fills title, cover, and category-specific fields</span>
                      </div>
                      <div className="metadata-sources-grid">
                        {isVideojuegos && (
                          <button type="button" className="metadata-source-btn" onClick={() => setIgdbOpen(true)}>
                            <span className="ms-name">↗ IGDB</span>
                            <span className="ms-desc">Full metadata — devs, publishers, platforms, genres</span>
                          </button>
                        )}
                        {(activeCategory === 'anime' || activeCategory === 'donghua') && <>
                          <button type="button" className="metadata-source-btn" onClick={() => setAnilistOpen('ANIME')}>
                            <span className="ms-name">↗ AniList</span>
                            <span className="ms-desc">Metadata + cover + banner</span>
                          </button>
                          <button type="button" className="metadata-source-btn" onClick={() => setJikanOpen('anime')}>
                            <span className="ms-name">↗ MyAnimeList</span>
                            <span className="ms-desc">Via Jikan — metadata + cover</span>
                          </button>
                          <button type="button" className="metadata-source-btn" onClick={() => setKitsuOpen('anime')}>
                            <span className="ms-name">↗ Kitsu</span>
                            <span className="ms-desc">Fallback when other sources miss it</span>
                          </button>
                        </>}
                        {isMangaLike(activeCategory) && <>
                          <button type="button" className="metadata-source-btn" onClick={() => setAnilistOpen('MANGA')}>
                            <span className="ms-name">↗ AniList</span>
                            <span className="ms-desc">Metadata + cover</span>
                          </button>
                          <button type="button" className="metadata-source-btn" onClick={() => setJikanOpen('manga')}>
                            <span className="ms-name">↗ MyAnimeList</span>
                            <span className="ms-desc">Via Jikan — authors + magazine</span>
                          </button>
                          {activeCategory !== 'comics_west' && <>
                            <button type="button" className="metadata-source-btn" onClick={() => setMangadexOpen(true)}>
                              <span className="ms-name">↗ MangaDex</span>
                              <span className="ms-desc">Deep catalog incl. obscure titles</span>
                            </button>
                            <button type="button" className="metadata-source-btn" onClick={() => setKitsuOpen('manga')}>
                              <span className="ms-name">↗ Kitsu</span>
                              <span className="ms-desc">Fallback when other sources miss it</span>
                            </button>
                          </>}
                          {activeCategory === 'comics_west' && (
                            <button type="button" className="metadata-source-btn" onClick={() => setComicvineOpen(true)}>
                              <span className="ms-name">↗ ComicVine</span>
                              <span className="ms-desc">Marvel, DC, Image, indies + creator credits</span>
                            </button>
                          )}
                        </>}
                        {activeCategory === 'peliculas' && (
                          <button type="button" className="metadata-source-btn" onClick={() => setTmdbOpen('movie')}>
                            <span className="ms-name">↗ TMDb</span>
                            <span className="ms-desc">Cast, crew, backdrop, dates, genres</span>
                          </button>
                        )}
                        {activeCategory === 'series' && (
                          <button type="button" className="metadata-source-btn" onClick={() => setTmdbOpen('tv')}>
                            <span className="ms-name">↗ TMDb</span>
                            <span className="ms-desc">Cast, seasons, network, dates, genres</span>
                          </button>
                        )}
                        {activeCategory === 'musica' && <>
                          <button type="button" className="metadata-source-btn" onClick={() => setMbOpen(true)}>
                            <span className="ms-name">↗ MusicBrainz</span>
                            <span className="ms-desc">Releases, tracklist, artists + Cover Art</span>
                          </button>
                          <button type="button" className="metadata-source-btn" onClick={() => setVgmdbOpen(true)}>
                            <span className="ms-name">↗ VGMdb</span>
                            <span className="ms-desc">Game & anime soundtracks, JP releases</span>
                          </button>
                        </>}
                      </div>
                    </div>

                    <div className="form-section-header">
                      <span className="form-section-title">Basic info</span>
                    </div>
                    <div className="field-group">
                      <label>Title</label>
                      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>

                    <div className="form-section-header">
                      <span className="form-section-title">Media</span>
                      <span className="form-section-hint">Cover · banner · logo</span>
                    </div>
                    <div className="field-group">
                      <label>Cover</label>
                      <input
                        placeholder={cover.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
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

                    {isVideojuegos && (
                      <>
                        <div className="field-group">
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
                        <div className="field-group">
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
                      <>
                        <div className="form-section-header">
                          <span className="form-section-title">Game details</span>
                          <span className="form-section-hint">Devs, publishers, platforms, franchise</span>
                        </div>
                        <TagEditor
                          label="Developers"
                          placeholder="Add developer"
                          tags={devs}
                          onAdd={(v) => setDevs((prev) => prev.includes(v) ? prev : [...prev, v])}
                          onRemove={(i) => setDevs((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Publishers"
                          placeholder="Add publisher"
                          tags={publishers}
                          onAdd={(v) => setPublishers((prev) => prev.includes(v) ? prev : [...prev, v])}
                          onRemove={(i) => setPublishers((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-row">
                          <div className="field-group">
                            <label>Achievements unlocked</label>
                            <input placeholder="0" value={achievementsUnlocked} onChange={(e) => setAchievementsUnlocked(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                          </div>
                          <div className="field-group">
                            <label>Achievements total</label>
                            <input placeholder="0" value={achievementsTotal} onChange={(e) => setAchievementsTotal(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Release date</label>
                          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
                        </div>
                        <div className="field-group">
                          <label>Description</label>
                          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>
                        <div className="field-group">
                          <label>Platforms</label>
                          <PlatformEditor value={platforms} onChange={setPlatforms} existing={Array.from(new Set(items.filter((i) => i.categoryId === 'videojuegos').flatMap((i) => i.platforms || [])))} />
                        </div>
                        <div className="field-row">
                          <div className="field-group">
                            <label>Ownership</label>
                            <select value={ownership} onChange={(e) => setOwnership(e.target.value as Ownership | '')}>
                              <option value="">Unspecified</option>
                              {OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="field-group">
                            <label>Status</label>
                            <select value={gameStatus} onChange={(e) => setGameStatus(e.target.value as GameStatus)}>
                              {GAME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Time played (hours.minutes)</label>
                          <input placeholder="e.g. 22.49" value={playTime} onChange={(e) => handlePlayTimeChange(e.target.value)} inputMode="decimal" />
                        </div>
                        <GameSubItems
                          question="Has DLC or expansions?"
                          placeholder="DLC/expansion name"
                          enabled={hasDlc}
                          onToggle={(v) => { setHasDlc(v); if (!v) setDlcList([]) }}
                          entries={dlcList}
                          onAdd={(name) => setDlcList((prev) => [...prev, { id: crypto.randomUUID(), name, status: 'backlog' }])}
                          onRemove={(id) => setDlcList((prev) => prev.filter((d) => d.id !== id))}
                          onStatusChange={(id, s) => setDlcList((prev) => prev.map((d) => (d.id === id ? { ...d, status: s } : d)))}
                        />
                        <GameSubItems
                          question="Has addons or packs?"
                          placeholder="Addon/pack name"
                          enabled={hasAddons}
                          onToggle={(v) => { setHasAddons(v); if (!v) setAddonsList([]) }}
                          entries={addonsList}
                          onAdd={(name) => setAddonsList((prev) => [...prev, { id: crypto.randomUUID(), name, status: 'backlog' }])}
                          onRemove={(id) => setAddonsList((prev) => prev.filter((d) => d.id !== id))}
                          onStatusChange={(id, s) => setAddonsList((prev) => prev.map((d) => (d.id === id ? { ...d, status: s } : d)))}
                          showStatus={false}
                        />
                        <BundleGamesEditor
                          enabled={isBundle}
                          onToggle={(v) => { setIsBundle(v); if (!v) setBundleContents([]) }}
                          entries={bundleContents}
                          onChange={setBundleContents}
                          onRequestSgdb={(entryId, title) => setBundleSgdbFor({ entryId, title })}
                        />
                        <div className="field-group">
                          <label>Rating</label>
                          <RatingPicker value={rating} onChange={setRating} />
                        </div>
                        <div className="field-group">
                          <label>Completion date</label>
                          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                        </div>
                        <TagEditor
                          label="Alternative titles"
                          placeholder="Add title (regional, original…)"
                          tags={alternativeTitles}
                          onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
                          onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Genres"
                          placeholder="Add genre"
                          tags={genres}
                          onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                          onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-row">
                          <div className="field-group">
                            <label>Source</label>
                            <select value={gameSource} onChange={(e) => setGameSource(e.target.value as GameSource | '')}>
                              <option value="">Unspecified</option>
                              {GAME_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="field-group">
                            <label>Age rating</label>
                            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
                              <option value="">Unspecified</option>
                              {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Franchise</label>
                          <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. The Legend of Zelda" />
                        </div>
                        <div className="field-group">
                          <label>Review</label>
                          <textarea value={gameReview} onChange={(e) => setGameReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                          {gameReview.trim() && (
                            <div className="yesno">
                              <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                              <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                            </div>
                          )}
                        </div>
                        <div className="field-group">
                          <label>Replay history</label>
                          <RewatchListEditor
                            rewatches={rewatches}
                            onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                            onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                            onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                            onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                          />
                        </div>
                        <div className="field-group">
                          <label>Related games</label>
                          <RelatedListEditor
                            related={relatedItems}
                            options={items.filter((i) => i.categoryId === 'videojuegos' && i.id !== editingId)}
                            onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                            onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                            onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                            pickerPlaceholder="Add related game…"
                          />
                        </div>
                        <div className="field-group">
                          <label>Recommendations</label>
                          <RecommendationsEditor
                            ids={recommendedItems}
                            options={items.filter((i) => i.categoryId === 'videojuegos' && i.id !== editingId)}
                            onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                            onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                            pickerPlaceholder="Add recommended game…"
                          />
                        </div>
                      </>
                    )}
                    {activeCategory === 'peliculas' && (
                      <>
                        <div className="form-section-header">
                          <span className="form-section-title">Movie details</span>
                          <span className="form-section-hint">Cast, crew, backdrop, franchise</span>
                        </div>
                        <div className="field-group">
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
                        <TagEditor
                          label="Directors"
                          placeholder="Add director"
                          tags={directors}
                          onAdd={(d) => setDirectors((prev) => prev.includes(d) ? prev : [...prev, d])}
                          onRemove={(i) => setDirectors((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Writers"
                          placeholder="Add writer"
                          tags={writers}
                          onAdd={(w) => setWriters((prev) => prev.includes(w) ? prev : [...prev, w])}
                          onRemove={(i) => setWriters((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Cast"
                          placeholder="Add actor/actress"
                          tags={cast}
                          onAdd={(c) => setCast((prev) => prev.includes(c) ? prev : [...prev, c])}
                          onRemove={(i) => setCast((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Production companies"
                          placeholder="Add production company"
                          tags={productionCompanies}
                          onAdd={(c) => setProductionCompanies((prev) => prev.includes(c) ? prev : [...prev, c])}
                          onRemove={(i) => setProductionCompanies((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <TagEditor
                          label="Distributed by"
                          placeholder="Add distributor"
                          tags={distributors}
                          onAdd={(d) => setDistributors((prev) => prev.includes(d) ? prev : [...prev, d])}
                          onRemove={(i) => setDistributors((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-group">
                          <label>Description</label>
                          <textarea value={movieDescription} onChange={(e) => setMovieDescription(e.target.value)} rows={3} />
                        </div>
                        <TagEditor
                          label="Genres"
                          placeholder="Add genre"
                          tags={genres}
                          onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                          onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-row">
                          <div className="field-group">
                            <label>Release year</label>
                            <input value={releaseYear} onChange={(e) => yearHandler(setReleaseYear)(e.target.value)} inputMode="numeric" maxLength={4} placeholder="e.g. 2023" />
                          </div>
                          <div className="field-group">
                            <label>Duration (minutes)</label>
                            <input value={duration} onChange={(e) => intHandler(setDuration)(e.target.value)} inputMode="numeric" placeholder="e.g. 120" />
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Franchise / Saga (optional)</label>
                          <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Fast & Furious" />
                        </div>
                        <div className="field-group">
                          <label>Watched?</label>
                          <div className="yesno">
                            <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(true)}>Watched</button>
                            <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>No</button>
                          </div>
                        </div>
                        <div className="field-row">
                          <div className="field-group">
                            <label>Times watched (rewatches)</label>
                            <input value={timesWatched} onChange={(e) => intHandler(setTimesWatched)(e.target.value)} inputMode="numeric" placeholder="e.g. 2" />
                          </div>
                          <div className="field-group">
                            <label>Where watched</label>
                            <select value={watchedWhere} onChange={(e) => setWatchedWhere(e.target.value as WatchLocation | '')}>
                              <option value="">Unspecified</option>
                              {WATCH_LOCATION_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Rating</label>
                          <RatingPicker value={rating} onChange={setRating} />
                        </div>
                        <div className="field-group">
                          <label>Watched on</label>
                          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                        </div>
                        <TagEditor
                          label="Alternative titles"
                          placeholder="Add title (original, translated…)"
                          tags={alternativeTitles}
                          onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
                          onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-row">
                          <div className="field-group">
                            <label>Source</label>
                            <select value={movieSource} onChange={(e) => setMovieSource(e.target.value as MovieSource | '')}>
                              <option value="">Unspecified</option>
                              {MOVIE_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="field-group">
                            <label>Content rating</label>
                            <input value={contentRating} onChange={(e) => setContentRating(e.target.value)} placeholder="e.g. PG-13, R" />
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Review</label>
                          <textarea value={movieReview} onChange={(e) => setMovieReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                          {movieReview.trim() && (
                            <div className="yesno">
                              <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                              <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                            </div>
                          )}
                        </div>
                        <div className="field-group">
                          <label>Rewatch history</label>
                          <RewatchListEditor
                            rewatches={rewatches}
                            onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                            onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                            onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                            onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                          />
                        </div>
                        <div className="field-group">
                          <label>Related movies</label>
                          <RelatedListEditor
                            related={relatedItems}
                            options={items.filter((i) => i.categoryId === 'peliculas' && i.id !== editingId)}
                            onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                            onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                            onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                            pickerPlaceholder="Add related movie…"
                          />
                        </div>
                        <div className="field-group">
                          <label>Recommendations</label>
                          <RecommendationsEditor
                            ids={recommendedItems}
                            options={items.filter((i) => i.categoryId === 'peliculas' && i.id !== editingId)}
                            onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                            onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                            pickerPlaceholder="Add recommended movie…"
                          />
                        </div>
                      </>
                    )}

                    {isSeriesLike && (
                  <>
                    <div className="form-section-header">
                      <span className="form-section-title">Series details</span>
                      <span className="form-section-hint">Cast, crew, network, seasons</span>
                    </div>
                    <div className="field-group">
                      <label>Description</label>
                      <textarea value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)} rows={3} />
                    </div>
                    <TagEditor label="Directors" placeholder="Add director" tags={directors} onAdd={(d) => setDirectors((prev) => prev.includes(d) ? prev : [...prev, d])} onRemove={(i) => setDirectors((prev) => prev.filter((_, idx) => idx !== i))} />
                    <TagEditor label="Showrunners" placeholder="Add showrunner" tags={showrunners} onAdd={(s) => setShowrunners((prev) => prev.includes(s) ? prev : [...prev, s])} onRemove={(i) => setShowrunners((prev) => prev.filter((_, idx) => idx !== i))} />
                    <TagEditor label="Writers" placeholder="Add writer" tags={writers} onAdd={(w) => setWriters((prev) => prev.includes(w) ? prev : [...prev, w])} onRemove={(i) => setWriters((prev) => prev.filter((_, idx) => idx !== i))} />
                    <TagEditor label="Cast" placeholder="Add actor" tags={cast} onAdd={(c) => setCast((prev) => prev.includes(c) ? prev : [...prev, c])} onRemove={(i) => setCast((prev) => prev.filter((_, idx) => idx !== i))} />
                    <TagEditor label="Genres" placeholder="Add genre" tags={genres} onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])} onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))} />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Watch status</label>
                        <select value={seriesStatus} onChange={(e) => setSeriesStatus(e.target.value as SeriesStatus)}>
                          {SERIES_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Format</label>
                        <select value={seriesFormat} onChange={(e) => setSeriesFormat(e.target.value as SeriesFormat | '')}>
                          <option value="">Unspecified</option>
                          {SERIES_FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Network</label>
                        <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="e.g. HBO, Netflix" />
                      </div>
                      <div className="field-group">
                        <label>Watched where</label>
                        <select value={watchedWhere} onChange={(e) => setWatchedWhere(e.target.value as WatchLocation | '')}>
                          <option value="">Unspecified</option>
                          {WATCH_LOCATION_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Country</label>
                        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA" />
                      </div>
                      <div className="field-group">
                        <label>Language</label>
                        <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. English" />
                      </div>
                      <div className="field-group">
                        <label>Content rating</label>
                        <input value={contentRating} onChange={(e) => setContentRating(e.target.value)} placeholder="e.g. TV-MA" />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Number of seasons</label>
                        <input value={unitCount} onChange={(e) => handleUnitCountChange(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
                      </div>
                      <div className="field-group">
                        <label>Total episodes</label>
                        <input value={totalEpisodes} onChange={(e) => intHandler(setTotalEpisodes)(e.target.value)} inputMode="numeric" placeholder="e.g. 62" />
                      </div>
                      <div className="field-group">
                        <label>Episodes watched</label>
                        <input value={episodesWatched} onChange={(e) => intHandler(setEpisodesWatched)(e.target.value)} inputMode="numeric" placeholder="e.g. 40" />
                      </div>
                      <div className="field-group">
                        <label>Ep. duration (min)</label>
                        <input value={episodeDuration} onChange={(e) => intHandler(setEpisodeDuration)(e.target.value)} inputMode="numeric" placeholder="e.g. 45" />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>First season year</label>
                        <input value={startYear} onChange={(e) => yearHandler(setStartYear)(e.target.value)} inputMode="numeric" maxLength={4} />
                      </div>
                      <div className="field-group">
                        <label>Last season year</label>
                        <input value={endYear} onChange={(e) => yearHandler(setEndYear)(e.target.value)} inputMode="numeric" maxLength={4} />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Aired from</label>
                        <input type="date" value={airedFrom} onChange={(e) => setAiredFrom(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label>Aired to</label>
                        <input type="date" value={airedTo} onChange={(e) => setAiredTo(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Start date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label>Completion date</label>
                        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Franchise</label>
                      <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Star Trek" />
                    </div>
                    <div className="field-group">
                      <label>Related series</label>
                      <RelatedListEditor
                        related={relatedItems}
                        options={items.filter((i) => i.categoryId === 'series' && i.id !== editingId)}
                        onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                        onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                        onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                        pickerPlaceholder="Add related series…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Recommendations</label>
                      <RecommendationsEditor
                        ids={recommendedItems}
                        options={items.filter((i) => i.categoryId === 'series' && i.id !== editingId)}
                        onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                        onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                        pickerPlaceholder="Add recommended series…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Rating</label>
                      <RatingPicker value={rating} onChange={setRating} />
                    </div>
                    <div className="field-group">
                      <label>Review</label>
                      <textarea value={seriesReview} onChange={(e) => setSeriesReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                      {seriesReview.trim() && (
                        <div className="yesno">
                          <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                          <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                        </div>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Rewatch history</label>
                      <RewatchListEditor
                        rewatches={rewatches}
                        onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                        onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                        onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                        onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Season list?</label>
                      <div className="yesno">
                        <button type="button" className={hasSeasons ? 'pill active' : 'pill'} onClick={() => setHasSeasons(true)}>Yes</button>
                        <button type="button" className={!hasSeasons ? 'pill active' : 'pill'} onClick={() => { setHasSeasons(false); setSeasons([]) }}>No</button>
                      </div>
                      {hasSeasons && (
                        <SeasonListEditor
                          seasons={seasons}
                          onAdd={(s) => setSeasons((prev) => [...prev, { ...s, id: crypto.randomUUID() }])}
                          onRemove={(id) => setSeasons((prev) => prev.filter((s) => s.id !== id))}
                          onUpdate={(id, patch) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))}
                          onToggleWatched={(id) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, watched: !s.watched, watchedDate: !s.watched ? new Date().toISOString().slice(0, 10) : s.watchedDate } : s))}
                          onRatingChange={(id, r) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, rating: r || undefined } : s))}
                          onBulkAdd={(count) => setSeasons((prev) => {
                            const start = prev.length + 1
                            const additions: Season[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
                            return [...prev, ...additions]
                          })}
                          onEpisodesChange={(seasonId, eps) => setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, episodes: eps } : s))}
                        />
                      )}
                    </div>
                  </>
                )}

                {isAnime && (
                  <>
                    <div className="form-section-header">
                      <span className="form-section-title">{activeCategory === 'donghua' ? 'Donghua' : 'Anime'} details</span>
                      <span className="form-section-hint">Studios, format, airing, episodes</span>
                    </div>
                    <TagEditor
                      label="Studios"
                      placeholder="Add studio"
                      tags={studios}
                      onAdd={(s) => setStudios((prev) => prev.includes(s) ? prev : [...prev, s])}
                      onRemove={(i) => setStudios((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-group">
                      <label>Description</label>
                      <textarea value={animeDescription} onChange={(e) => setAnimeDescription(e.target.value)} rows={3} />
                    </div>
                    <TagEditor
                      label="Genres"
                      placeholder="Add genre"
                      tags={genres}
                      onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                      onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Format</label>
                        <select value={animeFormat} onChange={(e) => setAnimeFormat(e.target.value as AnimeFormat | '')}>
                          <option value="">Unspecified</option>
                          {ANIME_FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Airing status</label>
                        <select value={airingStatus} onChange={(e) => setAiringStatus(e.target.value as AiringStatus | '')}>
                          <option value="">Unknown</option>
                          {AIRING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Season aired</label>
                        <select value={season} onChange={(e) => setSeason(e.target.value as AnimeSeason | '')}>
                          <option value="">Unspecified</option>
                          {ANIME_SEASON_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Season year</label>
                        <input value={seasonYear} onChange={(e) => yearHandler(setSeasonYear)(e.target.value)} inputMode="numeric" maxLength={4} placeholder="e.g. 2006" />
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Demographic</label>
                      <select value={demographic} onChange={(e) => setDemographic(e.target.value as Demographic | '')}>
                        <option value="">Unspecified</option>
                        {DEMOGRAPHIC_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Watch status</label>
                      <select value={watchStatus} onChange={(e) => setWatchStatus(e.target.value as AnimeStatus)}>
                        {ANIME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Episodes watched</label>
                        <input value={episodesWatched} onChange={(e) => intHandler(setEpisodesWatched)(e.target.value)} inputMode="numeric" placeholder="e.g. 12" />
                      </div>
                      <div className="field-group">
                        <label>Total episodes (if known)</label>
                        <input value={totalEpisodes} onChange={(e) => intHandler(setTotalEpisodes)(e.target.value)} inputMode="numeric" placeholder="e.g. 24" />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Start date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label>Finished on</label>
                        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Rating</label>
                      <RatingPicker value={rating} onChange={setRating} />
                    </div>
                    <TagEditor
                      label="Alternative titles"
                      placeholder="Add title (English, Japanese, synonym…)"
                      tags={alternativeTitles}
                      onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
                      onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Source</label>
                        <select value={animeSource} onChange={(e) => setAnimeSource(e.target.value as AnimeSource | '')}>
                          <option value="">Unspecified</option>
                          {ANIME_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Age rating</label>
                        <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
                          <option value="">Unspecified</option>
                          {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Ep. duration (min)</label>
                        <input value={episodeDuration} onChange={(e) => intHandler(setEpisodeDuration)(e.target.value)} inputMode="numeric" placeholder="e.g. 24" />
                      </div>
                      <div className="field-group">
                        <label>Aired from</label>
                        <input type="date" value={airedFrom} onChange={(e) => setAiredFrom(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label>Aired to</label>
                        <input type="date" value={airedTo} onChange={(e) => setAiredTo(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Favorite episode</label>
                        <input value={favoriteEpisode} onChange={(e) => intHandler(setFavoriteEpisode)(e.target.value)} inputMode="numeric" placeholder="e.g. 8" />
                      </div>
                      <div className="field-group">
                        <label>Favorite ep. note</label>
                        <input value={favoriteEpisodeNote} onChange={(e) => setFavoriteEpisodeNote(e.target.value)} placeholder="Why is it your favorite?" />
                      </div>
                    </div>
                    {watchStatus === 'dropped' && (
                      <div className="field-row">
                        <div className="field-group">
                          <label>Dropped at ep.</label>
                          <input value={droppedAtEpisode} onChange={(e) => intHandler(setDroppedAtEpisode)(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
                        </div>
                        <div className="field-group">
                          <label>Reason</label>
                          <input value={droppedReason} onChange={(e) => setDroppedReason(e.target.value)} placeholder="Why did you drop it?" />
                        </div>
                      </div>
                    )}
                    <div className="field-group">
                      <label>Review</label>
                      <textarea value={animeReview} onChange={(e) => setAnimeReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                      {animeReview.trim() && (
                        <div className="yesno">
                          <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                          <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                        </div>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Franchise</label>
                      <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Fullmetal Alchemist" />
                    </div>
                    <div className="field-group">
                      <label>Related anime</label>
                      <RelatedListEditor
                        related={relatedItems}
                        options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
                        onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                        onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                        onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                        pickerPlaceholder="Add related anime…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Recommendations</label>
                      <RecommendationsEditor
                        ids={recommendedItems}
                        options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
                        onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                        onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                        pickerPlaceholder="Add recommended anime…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Rewatch history</label>
                      <RewatchListEditor
                        rewatches={rewatches}
                        onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                        onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                        onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                        onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Episode list?</label>
                      <div className="yesno">
                        <button type="button" className={hasEpisodes ? 'pill active' : 'pill'} onClick={() => setHasEpisodes(true)}>Yes</button>
                        <button type="button" className={!hasEpisodes ? 'pill active' : 'pill'} onClick={() => { setHasEpisodes(false); setEpisodes([]) }}>No</button>
                      </div>
                      {hasEpisodes && (
                        <EpisodeListEditor
                          episodes={episodes}
                          onAdd={(e) => setEpisodes((prev) => [...prev, { ...e, id: crypto.randomUUID() }])}
                          onRemove={(id) => setEpisodes((prev) => prev.filter((e) => e.id !== id))}
                          onUpdate={(id, patch) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e))}
                          onToggleWatched={(id) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, watched: !e.watched, watchedDate: !e.watched ? new Date().toISOString().slice(0, 10) : e.watchedDate } : e))}
                          onToggleFiller={(id) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, filler: !e.filler } : e))}
                          onRatingChange={(id, r) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, rating: r || undefined } : e))}
                          onBulkAdd={(count) => setEpisodes((prev) => {
                            const start = prev.length + 1
                            const additions: Episode[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
                            return [...prev, ...additions]
                          })}
                        />
                      )}
                    </div>
                  </>
                )}

                {isManga && (
                  <>
                    <div className="form-section-header">
                      <span className="form-section-title">Publication details</span>
                      <span className="form-section-hint">Authors, artists, chapters, magazine</span>
                    </div>
                    <TagEditor
                      label="Authors"
                      placeholder="Add author"
                      tags={mangaAuthors}
                      onAdd={(a) => setMangaAuthors((prev) => prev.includes(a) ? prev : [...prev, a])}
                      onRemove={(i) => setMangaAuthors((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <TagEditor
                      label="Artists"
                      placeholder="Add artist"
                      tags={mangaArtists}
                      onAdd={(a) => setMangaArtists((prev) => prev.includes(a) ? prev : [...prev, a])}
                      onRemove={(i) => setMangaArtists((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-group">
                      <label>Description</label>
                      <textarea value={mangaDescription} onChange={(e) => setMangaDescription(e.target.value)} rows={3} />
                    </div>
                    <TagEditor
                      label="Genres"
                      placeholder="Add genre"
                      tags={genres}
                      onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                      onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Publication status</label>
                        <select value={pubStatus} onChange={(e) => setPubStatus(e.target.value as PublicationStatus | '')}>
                          <option value="">Unknown</option>
                          {PUBLICATION_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Reading status</label>
                        <select value={readingStatus} onChange={(e) => setReadingStatus(e.target.value as MangaStatus)}>
                          {MANGA_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Chapters read</label>
                        <input value={chaptersRead} onChange={(e) => intHandler(setChaptersRead)(e.target.value)} inputMode="numeric" placeholder="e.g. 45" />
                      </div>
                      <div className="field-group">
                        <label>Total chapters (if known)</label>
                        <input value={totalChapters} onChange={(e) => intHandler(setTotalChapters)(e.target.value)} inputMode="numeric" placeholder="e.g. 120" />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Volumes read</label>
                        <input value={volumesRead} onChange={(e) => intHandler(setVolumesRead)(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
                      </div>
                      <div className="field-group">
                        <label>Total volumes (if known)</label>
                        <input value={totalVolumesM} onChange={(e) => intHandler(setTotalVolumesM)(e.target.value)} inputMode="numeric" placeholder="e.g. 14" />
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field-group">
                        <label>Start date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label>Finished on</label>
                        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Rating</label>
                      <RatingPicker value={rating} onChange={setRating} />
                    </div>
                    <TagEditor
                      label="Alternative titles"
                      placeholder="Add title (romaji, English, synonym…)"
                      tags={alternativeTitles}
                      onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
                      onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Source</label>
                        <select value={mangaSource} onChange={(e) => setMangaSource(e.target.value as MangaSource | '')}>
                          <option value="">Unspecified</option>
                          {MANGA_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Age rating</label>
                        <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
                          <option value="">Unspecified</option>
                          {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Magazine / serialization</label>
                        <input value={magazine} onChange={(e) => setMagazine(e.target.value)} placeholder="e.g. Weekly Shonen Jump" />
                      </div>
                    </div>
                    <div className="field-group">
                      <label>Review</label>
                      <textarea value={mangaReview} onChange={(e) => setMangaReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                      {mangaReview.trim() && (
                        <div className="yesno">
                          <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                          <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                        </div>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Reread history</label>
                      <RewatchListEditor
                        rewatches={rewatches}
                        onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                        onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                        onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                        onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Franchise</label>
                      <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Naruto saga" />
                    </div>
                    <div className="field-group">
                      <label>Related manga</label>
                      <RelatedListEditor
                        related={relatedItems}
                        options={items.filter((i) => isMangaLike(i.categoryId) && i.id !== editingId)}
                        onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                        onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                        onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                        pickerPlaceholder="Add related manga…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Recommendations</label>
                      <RecommendationsEditor
                        ids={recommendedItems}
                        options={items.filter((i) => isMangaLike(i.categoryId) && i.id !== editingId)}
                        onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                        onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                        pickerPlaceholder="Add recommended manga…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Chapter list?</label>
                      <div className="yesno">
                        <button type="button" className={hasChapters ? 'pill active' : 'pill'} onClick={() => setHasChapters(true)}>Yes</button>
                        <button type="button" className={!hasChapters ? 'pill active' : 'pill'} onClick={() => { setHasChapters(false); setChapters([]) }}>No</button>
                      </div>
                      {hasChapters && (
                        <ChapterListEditor
                          chapters={chapters}
                          onAdd={(c) => setChapters((prev) => [...prev, { ...c, id: crypto.randomUUID() }])}
                          onRemove={(id) => setChapters((prev) => prev.filter((c) => c.id !== id))}
                          onUpdate={(id, patch) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))}
                          onToggleRead={(id) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, read: !c.read, readDate: !c.read ? new Date().toISOString().slice(0, 10) : c.readDate } : c))}
                          onRatingChange={(id, r) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, rating: r || undefined } : c))}
                          onBulkAdd={(count) => setChapters((prev) => {
                            const start = prev.length + 1
                            const additions: Chapter[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
                            return [...prev, ...additions]
                          })}
                        />
                      )}
                    </div>
                    <div className="field-group">
                      <label>Volume covers</label>
                      <VolumeCoverEditor
                        volumes={volumeCovers}
                        onAdd={(v) => setVolumeCovers((prev) => [...prev, { ...v, id: crypto.randomUUID() }])}
                        onRemove={(id) => setVolumeCovers((prev) => prev.filter((v) => v.id !== id))}
                      />
                    </div>
                  </>
                )}

                    {activeCategory === 'musica' && (
                  <>
                    <div className="form-section-header">
                      <span className="form-section-title">Music details</span>
                      <span className="form-section-hint">Artist, tracklist, editions, singles</span>
                    </div>
                    <div className="field-group">
                      <label>Artist</label>
                      <input value={artist} onChange={(e) => setArtist(e.target.value)} />
                    </div>
                    <TagEditor
                      label="Alternative titles"
                      placeholder="Add title (romaji, English…)"
                      tags={alternativeTitles}
                      onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
                      onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                    <div className="field-row">
                      <div className="field-group">
                        <label>Type</label>
                        <select value={musicType} onChange={(e) => setMusicType(e.target.value as MusicType | '')}>
                          <option value="">Unspecified</option>
                          {MUSIC_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label>Source</label>
                        <select value={musicSource} onChange={(e) => setMusicSource(e.target.value as MusicSource | '')}>
                          <option value="">Unspecified</option>
                          {MUSIC_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <TagEditor
                      label="Producers"
                      placeholder="Add producer"
                      tags={producers}
                      onAdd={(p) => setProducers((prev) => prev.includes(p) ? prev : [...prev, p])}
                      onRemove={(i) => setProducers((prev) => prev.filter((_, idx) => idx !== i))}
                    />

                    {isAlbumLikeMusic(musicType || undefined) ? (
                      <>
                        <div className="field-group">
                          <label>Released</label>
                          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
                        </div>
                        <TagEditor
                          label="Genres"
                          placeholder="Add genre"
                          tags={genres}
                          onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
                          onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
                        />
                        <div className="field-group">
                          <label>Label</label>
                          <input value={label} onChange={(e) => setLabel(e.target.value)} />
                        </div>
                        <div className="field-group">
                          <label>Listened?</label>
                          <div className="yesno">
                            <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(true)}>Listened</button>
                            <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>No</button>
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Rating</label>
                          <RatingPicker value={rating} onChange={setRating} />
                        </div>
                        <div className="field-group">
                          <label>Day listened</label>
                          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                        </div>
                        <div className="field-group">
                          <label>Add tracks?</label>
                          <div className="yesno">
                            <button type="button" className={hasTracks ? 'pill active' : 'pill'} onClick={() => setHasTracks(true)}>Yes</button>
                            <button type="button" className={!hasTracks ? 'pill active' : 'pill'} onClick={() => { setHasTracks(false); setTracks([]) }}>No</button>
                          </div>
                          {hasTracks && (
                            <TrackListEditor
                              tracks={tracks}
                              mainArtist={artist}
                              onAdd={(t) => setTracks((prev) => [...prev, { ...t, id: crypto.randomUUID() }])}
                              onRemove={(id) => setTracks((prev) => prev.filter((t) => t.id !== id))}
                              onToggleFavorite={(id) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)))}
                              onRatingChange={(id, r) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, rating: r || undefined } : t)))}
                              onArtistChange={(id, a) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, artist: a || undefined } : t)))}
                              onFillAllArtist={() => setTracks((prev) => prev.map((t) => ({ ...t, artist })))}
                              onToggleListened={(id) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, listened: !t.listened } : t)))}
                            />
                          )}
                        </div>
                        <div className="field-group">
                          <label>Single covers</label>
                          <p className="hint">Artwork for singles released with their own cover (often before the album).</p>
                          <SingleCoverEditor
                            singles={singleCovers}
                            onAdd={(s) => setSingleCovers((prev) => [...prev, { ...s, id: crypto.randomUUID() }])}
                            onRemove={(id) => setSingleCovers((prev) => prev.filter((s) => s.id !== id))}
                          />
                        </div>
                        <div className="field-group">
                          <label>Editions</label>
                          <p className="hint">Deluxe, Japan, Anniversary… each with its own cover and extra tracks.</p>
                          <EditionsEditor editions={editions} mainArtist={artist} onChange={setEditions} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="field-group">
                          <label>Release year</label>
                          <input value={releaseYear} onChange={(e) => yearHandler(setReleaseYear)(e.target.value)} inputMode="numeric" maxLength={4} />
                        </div>
                        <div className="field-group">
                          <label>Listened?</label>
                          <div className="yesno">
                            <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(true)}>Listened</button>
                            <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>No</button>
                          </div>
                        </div>
                        <div className="field-group">
                          <label>Rating</label>
                          <RatingPicker value={rating} onChange={setRating} />
                        </div>
                        <div className="field-group">
                          <label>Completion date</label>
                          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
                        </div>
                      </>
                    )}
                    <div className="field-group">
                      <label>Review</label>
                      <textarea value={musicReview} onChange={(e) => setMusicReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
                      {musicReview.trim() && (
                        <div className="yesno">
                          <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
                          <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
                        </div>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Listen history</label>
                      <RewatchListEditor
                        rewatches={rewatches}
                        onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
                        onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
                        onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
                        onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Related albums</label>
                      <RelatedListEditor
                        related={relatedItems}
                        options={items.filter((i) => i.categoryId === 'musica' && i.id !== editingId)}
                        onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
                        onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
                        onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
                        pickerPlaceholder="Add related album…"
                      />
                    </div>
                    <div className="field-group">
                      <label>Recommendations</label>
                      <RecommendationsEditor
                        ids={recommendedItems}
                        options={items.filter((i) => i.categoryId === 'musica' && i.id !== editingId)}
                        onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
                        onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
                        pickerPlaceholder="Add recommended album…"
                      />
                    </div>
                  </>
                )}

                    <div className="form-section-header">
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
                  </div>
                </div>
                </div>

                <div className="panel-footer">
                  {editingId && <button className="danger" onClick={handleDeleteFromPanel}>Delete</button>}
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
                    <button className="ghost" onClick={closePanel}>Cancel</button>
                    <button className="primary" onClick={handleSave}>{editingId ? 'Save changes' : 'Add'}</button>
                  </div>
                </div>
              </>
          </aside>
          </div>
          </>
        )}
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
                <div className="modal-actions">
                  <button className="danger-solid" onClick={() => {
                    const picked = CATEGORIES.filter((c) => welcomePicks[c.id] ?? true).map((c) => c.id)
                    setSettings((s) => ({ ...s, enabledCategories: picked.length > 0 ? picked : CATEGORIES.map((c) => c.id) }))
                    const firstEnabled = picked[0]
                    if (firstEnabled) setActiveCategory(firstEnabled)
                    setWelcomeStep('tips')
                  }}>Continue</button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-message">
                  You're all set. A few tips to get started:
                </p>
                <ul className="welcome-tips">
                  <li>Pick a category on the left sidebar.</li>
                  <li>Click <b>+ Add</b> to create your first entry.</li>
                  <li>Personalize theme, density and card fields in <b>Settings</b>.</li>
                  <li>Press <b>Ctrl+F</b> to search, <b>Esc</b> to close any panel.</li>
                </ul>
                <div className="modal-actions">
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
        <>
          <div className="panel-backdrop" />
          <aside className="detail-panel" style={{ width: 480 }}>
            <div className="panel-header">
              <h3>Edit Artist</h3>
              <div className="panel-header-actions">
                <button className="panel-close" onClick={closeArtistPanel}>✕</button>
              </div>
            </div>
            <div className="panel-body">
              <div className="form">
                <div className="field-group">
                  <label>Name</label>
                  <input value={artistNameField} onChange={(e) => setArtistNameField(e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Photo</label>
                  <input
                    placeholder={artistPhotoField.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                    value={artistPhotoField.startsWith('data:') ? '' : artistPhotoField}
                    onChange={(e) => setArtistPhotoField(e.target.value)}
                  />
                  <div className="upload-row">
                    <button type="button" className="upload-btn" onClick={() => artistPhotoFileInputRef.current?.click()}>Upload from PC</button>
                    {artistPhotoField && <button type="button" className="upload-btn clear" onClick={() => setArtistPhotoField('')}>Clear</button>}
                  </div>
                  <input type="file" accept="image/*" ref={artistPhotoFileInputRef} style={{ display: 'none' }} onChange={handleArtistPhotoFile} />
                </div>
                <div className="field-group">
                  <label>Banner image</label>
                  <input
                    placeholder={artistBannerField.startsWith('data:') ? 'Image uploaded from your PC' : 'Image URL'}
                    value={artistBannerField.startsWith('data:') ? '' : artistBannerField}
                    onChange={(e) => setArtistBannerField(e.target.value)}
                  />
                  <div className="upload-row">
                    <button type="button" className="upload-btn" onClick={() => artistBannerFileInputRef.current?.click()}>Upload from PC</button>
                    {artistBannerField && <button type="button" className="upload-btn clear" onClick={() => setArtistBannerField('')}>Clear</button>}
                  </div>
                  <input type="file" accept="image/*" ref={artistBannerFileInputRef} style={{ display: 'none' }} onChange={handleArtistBannerFile} />
                </div>
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
                <div className="field-group">
                  <label>Members</label>
                  <BandMembersEditor members={artistMembers} onChange={setArtistMembers} />
                </div>
              </div>
            </div>
            <div className="panel-footer">
              <button className="danger" onClick={() => { const id = editingArtistId!; closeArtistPanel(); handleDeleteArtist(id) }}>Delete</button>
              <div className="panel-footer-right">
                <button className="ghost" onClick={closeArtistPanel}>Cancel</button>
                <button className="primary" onClick={handleSaveArtistEdit}>Save changes</button>
              </div>
            </div>
          </aside>
        </>
      )}

      <GlobalSearch
        open={searchOpen}
        items={items}
        artists={musicArtists}
        onClose={() => setSearchOpen(false)}
        onOpenItem={navigateToItem}
        onOpenArtist={navigateToArtist}
      />

      {dupOpen && (
        <DuplicatesModal
          items={items}
          onOpenItem={navigateToItem}
          onClose={() => setDupOpen(false)}
        />
      )}

      <BulkActionBar
        items={items}
        selectedIds={selectedIds}
        collections={collections}
        onClear={clearSelection}
        onApplyStatus={applyToSelected}
        onApplyTag={bulkAddTag}
        onAddToGroup={bulkAddToGroup}
        onMoveToLibrary={bulkMoveToLibrary}
        onDelete={bulkDelete}
      />

      {sgdbOpen && (
        <SteamGridDbPicker
          apiKey={settings.sgdbApiKey}
          initialQuery={title}
          kind={sgdbOpen}
          onPick={(rel) => {
            if (sgdbOpen === 'grids') setCover(rel)
            else if (sgdbOpen === 'heroes') setBannerImage(rel)
            else if (sgdbOpen === 'logos') setLogoImage(rel)
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
            setBundleContents((prev) => prev.map((b) => b.id === bundleSgdbFor.entryId ? { ...b, cover: rel } : b))
            setToast('Bundle cover downloaded')
          }}
          onClose={() => setBundleSgdbFor(null)}
        />
      )}

      {anilistOpen && (
        <AniListFetcher
          initialQuery={title}
          kind={anilistOpen}
          categoryId={activeCategory}
          onApply={applyAniListPatch}
          onClose={() => setAnilistOpen(null)}
        />
      )}

      {jikanOpen && (
        <JikanFetcher
          initialQuery={title}
          kind={jikanOpen}
          categoryId={activeCategory}
          onApply={applyAniListPatch}
          onClose={() => setJikanOpen(null)}
        />
      )}

      {tmdbOpen && (
        <TmdbFetcher
          apiKey={settings.tmdbApiKey}
          initialQuery={title}
          kind={tmdbOpen}
          categoryId={activeCategory}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'TMDb')}
          onClose={() => setTmdbOpen(null)}
        />
      )}

      {igdbOpen && (
        <IgdbFetcher
          clientId={settings.igdbClientId}
          clientSecret={settings.igdbClientSecret}
          initialQuery={title}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'IGDB')}
          onClose={() => setIgdbOpen(false)}
        />
      )}

      {mbOpen && (
        <MusicBrainzFetcher
          initialQuery={title}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'MusicBrainz')}
          onClose={() => setMbOpen(false)}
        />
      )}

      {vgmdbOpen && (
        <VgmdbFetcher
          initialQuery={title}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'VGMdb')}
          onClose={() => setVgmdbOpen(false)}
        />
      )}

      {comicvineOpen && (
        <ComicVineFetcher
          apiKey={settings.comicvineApiKey}
          initialQuery={title}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'ComicVine')}
          onClose={() => setComicvineOpen(false)}
        />
      )}

      {mangadexOpen && (
        <MangaDexFetcher
          initialQuery={title}
          categoryId={activeCategory}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'MangaDex')}
          onClose={() => setMangadexOpen(false)}
        />
      )}

      {kitsuOpen && (
        <KitsuFetcher
          initialQuery={title}
          kind={kitsuOpen}
          categoryId={activeCategory}
          onApply={(p, c, b) => applyFetchedPatch(p, c, b, 'Kitsu')}
          onClose={() => setKitsuOpen(null)}
        />
      )}

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
          onImport={(newItems) => {
            setItems((all) => [...all, ...newItems])
            setToast(`Imported ${newItems.length} items`)
          }}
          onClose={() => setGenericImportOpen(false)}
        />
      )}

      {wrappedOpen && (
        <YearlyWrapped items={items} onClose={() => setWrappedOpen(false)} />
      )}

      {toast && <Toast message={toast} />}

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
    </div>
    </Suspense>
  )
}

export default App