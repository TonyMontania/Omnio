// Per-category CSV export. Called from Settings → Data → Export → CSV.
// Emits one file per category so column sets stay category-shaped
// (Games get playTime + platforms; Books get pages + ISBN; etc), which
// is what users actually want to open in Excel or LibreOffice Calc.
//
// The renderer builds { filename → csv } and the main process (via a
// dedicated IPC handler) writes them into the folder the user chose.

import { buildCsv } from './utils/csv'
import type { Item, MusicArtist } from './types'
import { CATEGORIES } from './categories'

const COMMON_FIELDS: (keyof Item)[] = [
  'id', 'title', 'rating', 'tags', 'genres', 'createdAt', 'finishedAt', 'notes',
]

// Per-category extra fields we surface in the CSV. Anything not listed
// here (deep arrays like `tracks`, `episodes`, `saveFiles`) is intentionally
// dropped — CSV isn't the right shape for nested data. Users who need
// the full structure should use per-item JSON export or the HTML site.
const EXTRAS: Record<string, (keyof Item)[]> = {
  videojuegos: ['gameStatus', 'playTime', 'platforms', 'devs', 'publishers', 'releaseDate', 'releaseYear', 'franchise', 'ownership', 'gameSource', 'ageRating', 'achievementsUnlocked', 'achievementsTotal'],
  musica:      ['musicType', 'musicSource', 'artist', 'releaseDate', 'releaseYear', 'label', 'producers', 'consumed', 'vinylCondition', 'partOfAlbum'],
  peliculas:   ['releaseDate', 'releaseYear', 'directors', 'writers', 'cast', 'duration', 'franchise', 'consumed'],
  series:      ['releaseDate', 'airedFrom', 'airedTo', 'totalEpisodes', 'showrunners', 'directors', 'cast', 'network', 'seriesFormat', 'seriesStatus'],
  anime:       ['animeFormat', 'watchStatus', 'totalEpisodes', 'episodesWatched', 'studios', 'season', 'seasonYear', 'airedFrom', 'airedTo', 'airingStatus', 'demographic', 'ageRating', 'airingDay'],
  donghua:     ['animeFormat', 'watchStatus', 'totalEpisodes', 'episodesWatched', 'studios', 'airedFrom', 'airedTo', 'airingStatus', 'airingDay'],
  manga:       ['mangaStatus', 'pubStatus', 'totalChapters', 'chaptersRead', 'totalVolumes', 'authors', 'mangaArtists', 'magazine', 'demographic', 'mangaSource', 'mediaOwnership'],
  manhwa:      ['mangaStatus', 'pubStatus', 'totalChapters', 'chaptersRead', 'totalVolumes', 'authors', 'mangaArtists', 'magazine', 'mangaSource', 'mediaOwnership'],
  manhua:      ['mangaStatus', 'pubStatus', 'totalChapters', 'chaptersRead', 'totalVolumes', 'authors', 'mangaArtists', 'magazine', 'mangaSource', 'mediaOwnership'],
  comics_west: ['mangaStatus', 'pubStatus', 'totalChapters', 'chaptersRead', 'totalVolumes', 'authors', 'mangaArtists', 'publisher', 'mediaOwnership'],
  libros:      ['bookStatus', 'authors', 'publisher', 'totalPages', 'pagesRead', 'isbn', 'bookFormat', 'releaseDate', 'saga', 'sagaIndex', 'bookSource'],
}

function itemToRow(it: Item): Record<string, unknown> {
  const cols = [...COMMON_FIELDS, ...(EXTRAS[it.categoryId] ?? [])]
  const row: Record<string, unknown> = { category: it.categoryId }
  for (const k of cols) {
    const v = (it as unknown as Record<string, unknown>)[k]
    if (v === undefined) continue
    // ISO the createdAt so spreadsheets recognise it as a date.
    if (k === 'createdAt' && typeof v === 'number') row[k] = new Date(v).toISOString()
    else row[k] = v
  }
  return row
}

function artistToRow(a: MusicArtist): Record<string, unknown> {
  return {
    id: a.id,
    name: a.name,
    origin: a.origin,
    bandStatus: a.bandStatus,
    activeFrom: a.activeFrom,
    activeTo: a.activeTo,
    genres: a.genres,
    labels: a.labels,
    membersCount: a.members?.length ?? 0,
    concertsAttended: a.concerts?.length ?? 0,
    createdAt: new Date(a.createdAt).toISOString(),
  }
}

// Build { filename → csv text } for the given scope. Scope is either
// 'all' (one file per category) or a specific category id (one file).
// Music always ships an extra artists.csv when in scope, because
// artists are first-class alongside items.
export function buildCsvExports(items: Item[], artists: MusicArtist[], scope: string): Record<string, string> {
  const out: Record<string, string> = {}
  const targetCategories = scope === 'all'
    ? CATEGORIES.map((c) => c.id)
    : [scope]
  for (const cat of targetCategories) {
    const rows = items.filter((i) => i.categoryId === cat).map(itemToRow)
    if (rows.length === 0) continue
    const label = CATEGORIES.find((c) => c.id === cat)?.id ?? cat
    out[`omnio-${label}.csv`] = buildCsv(rows)
  }
  if ((scope === 'all' || scope === 'musica') && artists.length > 0) {
    out['omnio-artists.csv'] = buildCsv(artists.map(artistToRow))
  }
  return out
}
