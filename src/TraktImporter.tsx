// Trakt.tv history JSON importer → Movies + Series libraries.
//
// Trakt lets users export their history at trakt.tv/settings/data as JSON
// (one file per type: movies, shows, episodes, watchlist, ratings). We
// accept any subset dropped in together and auto-detect what each file
// contains by shape sniffing (the API shapes are stable and documented
// at trakt.docs.apiary.io / trakt.tv/api-docs).
//
// Currently handled:
//   - Watched movies (from movies.json / watched movies file). Each entry
//     has { movie: { title, year, ids }, plays, last_watched_at? }. Maps
//     to a Movie item with consumed=true and finishedAt.
//   - Watched shows (from shows.json / watched shows file). Each entry has
//     { show: { title, year, ids }, plays, last_watched_at?, seasons? }.
//     Maps to a Series item with seriesStatus='watching' and
//     episodesWatched = total watched-episode count across all seasons.
//   - Ratings on movies / shows enrich the same item's .rating (10-scale
//     halved into Omnio's 5-scale).
//
// Skipped for v1:
//   - Per-episode granularity (Omnio's Episode[] is a lot to fill from a
//     history dump and we don't know episode titles from Trakt export
//     without an extra API call).
//   - Watchlists — different semantics (plan_to_watch, not consumed).
//     Could be a follow-up if users want it.

import { useMemo, useState } from 'react'
import type { Item, SeriesStatus } from './types'

interface Props {
  existingItems: Item[]
  onImport: (result: {
    movieUpdates: Map<string, Partial<Item>>
    movieCreates: Item[]
    seriesUpdates: Map<string, Partial<Item>>
    seriesCreates: Item[]
  }) => void
  onClose: () => void
}

type MovieRow = {
  key: string
  title: string
  year?: string
  plays: number
  lastWatchedAt?: string
  rating?: number
}
type ShowRow = {
  key: string
  title: string
  year?: string
  plays: number
  lastWatchedAt?: string
  episodesWatched: number
  rating?: number
}

// Trakt's 10-point ratings mapped to Omnio's 5-point RatingPicker
// (halved, floored to nearest 0.5).
function toFiveScale(r: number | undefined): number | undefined {
  if (r === undefined || r === null || !Number.isFinite(r)) return undefined
  if (r <= 0) return undefined
  return Math.round((r / 2) * 2) / 2
}

function yearFromString(s?: string | number): string | undefined {
  if (!s) return undefined
  const str = String(s)
  const m = /^(\d{4})/.exec(str)
  return m ? m[1] : undefined
}

function isoDateOf(raw?: string): string | undefined {
  if (!raw) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// Sniff what a top-level JSON array holds by looking at the shape of its
// first non-null element. Trakt's shapes are stable — every watched-movies
// entry has `.movie`, watched-shows has `.show` + optional `.seasons`,
// ratings have `.rating` + one of `.movie|.show|.episode|.season`.
type Kind = 'watched-movies' | 'watched-shows' | 'ratings' | 'unknown'
function sniffKind(arr: unknown[]): Kind {
  const first = arr.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined
  if (!first) return 'unknown'
  if ('rating' in first) return 'ratings'
  if ('show' in first) return 'watched-shows'
  if ('movie' in first && !('show' in first)) return 'watched-movies'
  return 'unknown'
}

type Parsed = {
  movies: MovieRow[]
  shows: ShowRow[]
}

function parseFile(text: string): Parsed {
  const empty: Parsed = { movies: [], shows: [] }
  let json: unknown
  try { json = JSON.parse(text) } catch { return empty }
  const arr = Array.isArray(json) ? json : [json]
  const kind = sniffKind(arr)
  if (kind === 'unknown') return empty
  const movies = new Map<string, MovieRow>()
  const shows = new Map<string, ShowRow>()
  const ratedMovies = new Map<string, number>()
  const ratedShows = new Map<string, number>()

  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>

    if (kind === 'ratings') {
      const rating = typeof r.rating === 'number' ? r.rating : undefined
      if (rating === undefined) continue
      if (r.movie && typeof r.movie === 'object') {
        const m = r.movie as Record<string, unknown>
        const title = typeof m.title === 'string' ? m.title : ''
        const year = yearFromString(m.year as string | number | undefined)
        if (title) ratedMovies.set(`${title.toLowerCase()}::${year ?? ''}`, rating)
      } else if (r.show && typeof r.show === 'object') {
        const s = r.show as Record<string, unknown>
        const title = typeof s.title === 'string' ? s.title : ''
        const year = yearFromString(s.year as string | number | undefined)
        if (title) ratedShows.set(`${title.toLowerCase()}::${year ?? ''}`, rating)
      }
      continue
    }

    if (kind === 'watched-movies' && r.movie && typeof r.movie === 'object') {
      const m = r.movie as Record<string, unknown>
      const title = typeof m.title === 'string' ? m.title : ''
      if (!title) continue
      const year = yearFromString(m.year as string | number | undefined)
      const plays = typeof r.plays === 'number' ? r.plays : 1
      const lastWatchedAt = isoDateOf(typeof r.last_watched_at === 'string' ? r.last_watched_at : undefined)
      movies.set(`${title.toLowerCase()}::${year ?? ''}`, { key: `${title.toLowerCase()}::${year ?? ''}`, title, year, plays, lastWatchedAt })
      continue
    }

    if (kind === 'watched-shows' && r.show && typeof r.show === 'object') {
      const s = r.show as Record<string, unknown>
      const title = typeof s.title === 'string' ? s.title : ''
      if (!title) continue
      const year = yearFromString(s.year as string | number | undefined)
      const plays = typeof r.plays === 'number' ? r.plays : 0
      const lastWatchedAt = isoDateOf(typeof r.last_watched_at === 'string' ? r.last_watched_at : undefined)
      // Count episodes watched across all seasons.
      let epCount = 0
      const seasons = r.seasons as unknown
      if (Array.isArray(seasons)) {
        for (const seasonRaw of seasons) {
          if (!seasonRaw || typeof seasonRaw !== 'object') continue
          const eps = (seasonRaw as Record<string, unknown>).episodes
          if (Array.isArray(eps)) epCount += eps.length
        }
      }
      shows.set(`${title.toLowerCase()}::${year ?? ''}`, {
        key: `${title.toLowerCase()}::${year ?? ''}`,
        title, year, plays,
        lastWatchedAt,
        episodesWatched: epCount || plays,
      })
    }
  }

  // Fold ratings into the matching rows if the same file also had watched
  // data — rare but possible when the user concatenates their exports.
  for (const [k, r] of ratedMovies) {
    const row = movies.get(k)
    if (row) row.rating = toFiveScale(r)
  }
  for (const [k, r] of ratedShows) {
    const row = shows.get(k)
    if (row) row.rating = toFiveScale(r)
  }

  return { movies: Array.from(movies.values()), shows: Array.from(shows.values()) }
}

function mergeParsed(a: Parsed, b: Parsed): Parsed {
  const mMap = new Map<string, MovieRow>()
  for (const m of [...a.movies, ...b.movies]) {
    const prev = mMap.get(m.key)
    if (prev) {
      prev.plays += m.plays
      prev.lastWatchedAt = [prev.lastWatchedAt, m.lastWatchedAt].filter(Boolean).sort().at(-1) ?? prev.lastWatchedAt
      prev.rating = prev.rating ?? m.rating
    } else mMap.set(m.key, { ...m })
  }
  const sMap = new Map<string, ShowRow>()
  for (const s of [...a.shows, ...b.shows]) {
    const prev = sMap.get(s.key)
    if (prev) {
      prev.plays += s.plays
      prev.episodesWatched = Math.max(prev.episodesWatched, s.episodesWatched)
      prev.lastWatchedAt = [prev.lastWatchedAt, s.lastWatchedAt].filter(Boolean).sort().at(-1) ?? prev.lastWatchedAt
      prev.rating = prev.rating ?? s.rating
    } else sMap.set(s.key, { ...s })
  }
  return { movies: Array.from(mMap.values()), shows: Array.from(sMap.values()) }
}

function findMovie(existing: Item[], title: string, year?: string): Item | undefined {
  const tLc = title.toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'peliculas') continue
    if (it.title.toLowerCase() !== tLc) continue
    if (!year || !it.releaseYear || year === it.releaseYear) return it
  }
  return undefined
}
function findSeries(existing: Item[], title: string, year?: string): Item | undefined {
  const tLc = title.toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'series') continue
    if (it.title.toLowerCase() !== tLc) continue
    if (!year || !it.releaseYear || year === it.releaseYear) return it
  }
  return undefined
}

type Action = 'apply' | 'create' | 'skip'

export default function TraktImporter({ existingItems, onImport, onClose }: Props) {
  const [parsed, setParsed] = useState<Parsed>({ movies: [], shows: [] })
  const [fileNames, setFileNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [movieActions, setMovieActions] = useState<Record<string, Action>>({})
  const [showActions, setShowActions] = useState<Record<string, Action>>({})

  const movieMatches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const m of parsed.movies) map.set(m.key, findMovie(existingItems, m.title, m.year))
    return map
  }, [parsed.movies, existingItems])
  const showMatches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const s of parsed.shows) map.set(s.key, findSeries(existingItems, s.title, s.year))
    return map
  }, [parsed.shows, existingItems])

  const handleFiles = async (files: FileList | File[]) => {
    setError(null)
    setBusy(true)
    try {
      let merged: Parsed = { movies: [], shows: [] }
      const names: string[] = []
      for (const f of Array.from(files)) {
        if (!f.name.toLowerCase().endsWith('.json')) continue
        names.push(f.name)
        const text = await f.text()
        merged = mergeParsed(merged, parseFile(text))
      }
      if (merged.movies.length === 0 && merged.shows.length === 0) {
        setError('No Trakt movies or shows found. Expected the JSON files from trakt.tv/settings/data (watched movies / watched shows / ratings).')
        setBusy(false)
        return
      }
      merged.movies.sort((a, b) => a.title.localeCompare(b.title))
      merged.shows.sort((a, b) => a.title.localeCompare(b.title))
      setParsed(merged)
      setFileNames(names)
      const mInit: Record<string, Action> = {}
      for (const m of merged.movies) mInit[m.key] = findMovie(existingItems, m.title, m.year) ? 'apply' : 'create'
      setMovieActions(mInit)
      const sInit: Record<string, Action> = {}
      for (const s of merged.shows) sInit[s.key] = findSeries(existingItems, s.title, s.year) ? 'apply' : 'create'
      setShowActions(sInit)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setMovieAction = (k: string, a: Action) => setMovieActions((s) => ({ ...s, [k]: a }))
  const setShowAction = (k: string, a: Action) => setShowActions((s) => ({ ...s, [k]: a }))

  const summary = useMemo(() => {
    let mApply = 0, mCreate = 0, sApply = 0, sCreate = 0
    for (const m of parsed.movies) {
      const a = movieActions[m.key]
      if (a === 'apply') mApply++; else if (a === 'create') mCreate++
    }
    for (const s of parsed.shows) {
      const a = showActions[s.key]
      if (a === 'apply') sApply++; else if (a === 'create') sCreate++
    }
    return { mApply, mCreate, sApply, sCreate }
  }, [parsed, movieActions, showActions])

  const handleImport = () => {
    const now = Date.now()
    const movieUpdates = new Map<string, Partial<Item>>()
    const movieCreates: Item[] = []
    const seriesUpdates = new Map<string, Partial<Item>>()
    const seriesCreates: Item[] = []

    for (const m of parsed.movies) {
      const a = movieActions[m.key]
      if (a === 'skip') continue
      if (a === 'apply') {
        const match = movieMatches.get(m.key)
        if (!match) continue
        movieUpdates.set(match.id, {
          consumed: true,
          finishedAt: match.finishedAt || m.lastWatchedAt,
          rating: match.rating || m.rating,
        })
      } else if (a === 'create') {
        movieCreates.push({
          id: crypto.randomUUID(),
          categoryId: 'peliculas',
          title: m.title,
          releaseYear: m.year,
          consumed: true,
          finishedAt: m.lastWatchedAt,
          rating: m.rating,
          createdAt: now,
        })
      }
    }

    for (const s of parsed.shows) {
      const a = showActions[s.key]
      if (a === 'skip') continue
      if (a === 'apply') {
        const match = showMatches.get(s.key)
        if (!match) continue
        seriesUpdates.set(match.id, {
          seriesStatus: (match.seriesStatus ?? 'watching') as SeriesStatus,
          episodesWatched: String(Math.max(parseInt(match.episodesWatched || '0', 10) || 0, s.episodesWatched)),
          finishedAt: match.finishedAt || s.lastWatchedAt,
          rating: match.rating || s.rating,
        })
      } else if (a === 'create') {
        seriesCreates.push({
          id: crypto.randomUUID(),
          categoryId: 'series',
          title: s.title,
          releaseYear: s.year,
          seriesStatus: 'watching',
          episodesWatched: s.episodesWatched > 0 ? String(s.episodesWatched) : undefined,
          finishedAt: s.lastWatchedAt,
          rating: s.rating,
          createdAt: now,
        })
      }
    }
    onImport({ movieUpdates, movieCreates, seriesUpdates, seriesCreates })
    onClose()
  }

  const totalToApply = summary.mApply + summary.mCreate + summary.sApply + summary.sCreate

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel trakt-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from Trakt.tv</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Go to <b>trakt.tv/settings/data</b> and export your history. Drop any of the resulting JSON
            files here (watched movies, watched shows, ratings — drop them all together and ratings
            merge into the matching rows). Per row you can apply the data to an existing library item
            or create a new one. Watchlists and per-episode detail are skipped in this pass.
          </p>

          <div className="importer-dropzone">
            <input
              type="file"
              multiple
              accept=".json"
              style={{ display: 'none' }}
              id="trakt-file-input"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <label htmlFor="trakt-file-input" className="importer-file-btn">
              {busy ? 'Reading…' : (parsed.movies.length + parsed.shows.length > 0) ? 'Pick different files' : '+ Pick Trakt JSON files'}
            </label>
            {fileNames.length > 0 && <span className="importer-file-list">{fileNames.join(' · ')}</span>}
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {parsed.movies.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{parsed.movies.length} movie{parsed.movies.length === 1 ? '' : 's'}</span>
                <span className="importer-new">{summary.mCreate} to create</span>
                <span className="importer-dupe">{summary.mApply} to apply</span>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th>Movie</th>
                      <th style={{ width: 60 }}>Year</th>
                      <th style={{ width: 60 }}>Plays</th>
                      <th style={{ width: 110 }}>Last watched</th>
                      <th style={{ width: 60 }}>Rating</th>
                      <th style={{ width: 180 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.movies.map((m) => {
                      const match = movieMatches.get(m.key)
                      const action = movieActions[m.key] ?? 'skip'
                      return (
                        <tr key={m.key} className={!match ? 'dupe' : ''}>
                          <td>{m.title}</td>
                          <td>{m.year ?? '—'}</td>
                          <td>{m.plays}</td>
                          <td>{m.lastWatchedAt ?? '—'}</td>
                          <td>{m.rating ? m.rating.toFixed(1) : '—'}</td>
                          <td>
                            <select value={action} onChange={(e) => setMovieAction(m.key, e.target.value as Action)}>
                              {match && <option value="apply">Apply to existing</option>}
                              <option value="create">Create in Movies</option>
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {parsed.shows.length > 0 && (
            <>
              <div className="importer-summary" style={{ marginTop: 18 }}>
                <span>{parsed.shows.length} show{parsed.shows.length === 1 ? '' : 's'}</span>
                <span className="importer-new">{summary.sCreate} to create</span>
                <span className="importer-dupe">{summary.sApply} to apply</span>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th>Show</th>
                      <th style={{ width: 60 }}>Year</th>
                      <th style={{ width: 80 }}>Episodes</th>
                      <th style={{ width: 110 }}>Last watched</th>
                      <th style={{ width: 60 }}>Rating</th>
                      <th style={{ width: 180 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.shows.map((s) => {
                      const match = showMatches.get(s.key)
                      const action = showActions[s.key] ?? 'skip'
                      return (
                        <tr key={s.key} className={!match ? 'dupe' : ''}>
                          <td>{s.title}</td>
                          <td>{s.year ?? '—'}</td>
                          <td>{s.episodesWatched}</td>
                          <td>{s.lastWatchedAt ?? '—'}</td>
                          <td>{s.rating ? s.rating.toFixed(1) : '—'}</td>
                          <td>
                            <select value={action} onChange={(e) => setShowAction(s.key, e.target.value as Action)}>
                              {match && <option value="apply">Apply to existing</option>}
                              <option value="create">Create in Series</option>
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {(parsed.movies.length > 0 || parsed.shows.length > 0) && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              disabled={totalToApply === 0}
              onClick={handleImport}
            >
              Apply to {totalToApply} item{totalToApply === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
