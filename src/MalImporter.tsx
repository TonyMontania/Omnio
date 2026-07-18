// Import a MyAnimeList / AniList XML export into the anime & manga
// libraries. MAL uses `<myanimelist>` as the root; each entry lives under
// either `<anime>` or `<manga>`. AniList's export uses the same shape so
// the same parser covers both.

import { useMemo, useState } from 'react'
import type { Item, AnimeStatus, MangaStatus } from './types'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type Kind = 'anime' | 'manga'

interface Parsed {
  kind: Kind
  id?: number
  title: string
  altTitles: string[]
  totalEpisodes?: string
  watched?: string
  totalChapters?: string
  totalVolumes?: string
  readChapters?: string
  readVolumes?: string
  score?: number
  status?: string
  startDate?: string
  finishDate?: string
  timesConsumed?: number
  tags?: string[]
  notes?: string
}

const MAL_ANIME_STATUS: Record<string, AnimeStatus> = {
  'Watching': 'watching',
  'Completed': 'completed',
  'On-Hold': 'paused',
  'Dropped': 'dropped',
  'Plan to Watch': 'plan_to_watch',
}
const MAL_MANGA_STATUS: Record<string, MangaStatus> = {
  'Reading': 'reading',
  'Completed': 'completed',
  'On-Hold': 'paused',
  'Dropped': 'dropped',
  'Plan to Read': 'plan_to_read',
}

function text(node: Element | null, selector: string): string | undefined {
  const el = node?.querySelector(selector)
  const t = el?.textContent?.trim()
  return t ? t : undefined
}

// Accepts either the field name MyAnimeList itself exports (series_title,
// series_animedb_id, series_chapters…) OR the field name the AniList
// scraper uses (manga_title, manga_mangadb_id, manga_chapters…). Try each
// in order and return the first hit.
function textAny(node: Element | null, selectors: string[]): string | undefined {
  for (const s of selectors) {
    const v = text(node, s)
    if (v !== undefined) return v
  }
  return undefined
}

function normalizeDate(s?: string): string | undefined {
  if (!s || s === '0000-00-00') return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined
}

function parseXml(xml: string): { entries: Parsed[]; error?: string } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) return { entries: [], error: 'Not a valid XML file.' }
  const root = doc.querySelector('myanimelist')
  if (!root) return { entries: [], error: 'Root element <myanimelist> is missing. Is this a MAL/AniList export?' }
  const out: Parsed[] = []
  root.querySelectorAll('anime').forEach((el) => {
    const title = textAny(el, ['series_title', 'anime_title'])
    if (!title) return
    const alt = [
      textAny(el, ['series_english', 'anime_english']),
      textAny(el, ['series_synonyms', 'anime_synonyms']),
    ].filter(Boolean) as string[]
    const idStr = textAny(el, ['series_animedb_id', 'anime_animedb_id'])
    const score = textAny(el, ['my_score'])
    const times = textAny(el, ['my_times_watched'])
    out.push({
      kind: 'anime',
      id: idStr ? parseInt(idStr, 10) : undefined,
      title,
      altTitles: alt,
      totalEpisodes: textAny(el, ['series_episodes', 'anime_episodes']),
      watched: textAny(el, ['my_watched_episodes']),
      score: score ? parseFloat(score) : undefined,
      status: textAny(el, ['my_status']),
      startDate: textAny(el, ['my_start_date']),
      finishDate: textAny(el, ['my_finish_date']),
      timesConsumed: times ? parseInt(times, 10) : undefined,
      tags: textAny(el, ['my_tags'])?.split(',').map((s) => s.trim()).filter(Boolean),
      notes: textAny(el, ['my_comments']),
    })
  })
  root.querySelectorAll('manga').forEach((el) => {
    const title = textAny(el, ['series_title', 'manga_title'])
    if (!title) return
    const alt = [
      textAny(el, ['series_english', 'manga_english']),
      textAny(el, ['series_synonyms', 'manga_synonyms']),
    ].filter(Boolean) as string[]
    const idStr = textAny(el, ['series_mangadb_id', 'manga_mangadb_id'])
    const score = textAny(el, ['my_score'])
    const times = textAny(el, ['my_times_read'])
    out.push({
      kind: 'manga',
      id: idStr ? parseInt(idStr, 10) : undefined,
      title,
      altTitles: alt,
      totalChapters: textAny(el, ['series_chapters', 'manga_chapters']),
      totalVolumes: textAny(el, ['series_volumes', 'manga_volumes']),
      readChapters: textAny(el, ['my_read_chapters']),
      readVolumes: textAny(el, ['my_read_volumes']),
      score: score ? parseFloat(score) : undefined,
      status: textAny(el, ['my_status']),
      startDate: textAny(el, ['my_start_date']),
      finishDate: textAny(el, ['my_finish_date']),
      timesConsumed: times ? parseInt(times, 10) : undefined,
      tags: textAny(el, ['my_tags'])?.split(',').map((s) => s.trim()).filter(Boolean),
      notes: textAny(el, ['my_comments']),
    })
  })
  return { entries: out }
}

function toItem(p: Parsed): Item {
  const rating = p.score && p.score > 0 ? Math.max(0.5, Math.min(5, p.score / 2)) : undefined
  const base: Item = {
    id: crypto.randomUUID(),
    categoryId: p.kind === 'anime' ? 'anime' : 'manga',
    title: p.title,
    createdAt: Date.now(),
    alternativeTitles: p.altTitles.length ? Array.from(new Set(p.altTitles)) : undefined,
    rating,
    finishedAt: normalizeDate(p.finishDate),
    startDate: normalizeDate(p.startDate),
    tags: p.tags && p.tags.length ? p.tags : undefined,
    notes: p.notes,
  }
  if (p.kind === 'anime') {
    base.totalEpisodes = p.totalEpisodes && p.totalEpisodes !== '0' ? p.totalEpisodes : undefined
    base.episodesWatched = p.watched && p.watched !== '0' ? p.watched : undefined
    base.watchStatus = p.status ? MAL_ANIME_STATUS[p.status] ?? 'plan_to_watch' : 'plan_to_watch'
  } else {
    base.totalChapters = p.totalChapters && p.totalChapters !== '0' ? p.totalChapters : undefined
    base.totalVolumes = p.totalVolumes && p.totalVolumes !== '0' ? p.totalVolumes : undefined
    base.chaptersRead = p.readChapters && p.readChapters !== '0' ? p.readChapters : undefined
    base.volumesRead = p.readVolumes && p.readVolumes !== '0' ? p.readVolumes : undefined
    base.mangaStatus = p.status ? MAL_MANGA_STATUS[p.status] ?? 'plan_to_read' : 'plan_to_read'
  }
  return base
}

export default function MalImporter({ existingItems, onImport, onClose }: Props) {
  const [parsed, setParsed] = useState<Parsed[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>('')
  const [skipExisting, setSkipExisting] = useState(true)

  const existingTitles = useMemo(() => {
    const s = new Set<string>()
    for (const it of existingItems) {
      if (it.categoryId === 'anime' || it.categoryId === 'manga') {
        s.add(`${it.categoryId}::${it.title.toLowerCase().trim()}`)
      }
    }
    return s
  }, [existingItems])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setParsed(null)
    const f = e.target.files?.[0]
    if (!f) return
    setFilename(f.name)
    const txt = await f.text()
    const r = parseXml(txt)
    if (r.error) { setError(r.error); return }
    if (r.entries.length === 0) {
      const doc = new DOMParser().parseFromString(txt, 'application/xml')
      const rawCount = doc.querySelectorAll('anime, manga').length
      setError(rawCount > 0
        ? `Found ${rawCount} <anime>/<manga> element(s) but none had a title — this XML uses field names Omnio doesn't recognize.`
        : 'No <anime> or <manga> entries found.')
      return
    }
    setParsed(r.entries)
  }

  const toImport = useMemo(() => {
    if (!parsed) return []
    if (!skipExisting) return parsed
    return parsed.filter((p) => !existingTitles.has(`${p.kind}::${p.title.toLowerCase().trim()}`))
  }, [parsed, skipExisting, existingTitles])

  const animeCount = toImport.filter((p) => p.kind === 'anime').length
  const mangaCount = toImport.filter((p) => p.kind === 'manga').length
  const skipped = parsed ? parsed.length - toImport.length : 0

  const doImport = () => {
    const items = toImport.map(toItem)
    onImport(items)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import from MyAnimeList / AniList XML</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Works with the native MyAnimeList export (Profile → Export) and with the AniList
            scraper's <code>_anilistanime</code> / <code>_anilistmanga</code> XML. Unzip the
            <code>.gz</code> if you got one and pick the <code>.xml</code> here.
            Imported items land in the <em>Anime</em> and <em>Manga</em> libraries with title,
            episodes/chapters, rating, status, start/finish dates, tags and notes filled in.
            Covers and descriptions can be added afterwards using the AniList metadata fetcher.
          </p>
          <label className="upload-btn" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            {filename ? `Selected: ${filename}` : 'Choose XML file…'}
            <input type="file" accept=".xml" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {parsed && (
            <>
              <div className="mal-import-summary">
                <div><strong>{parsed.length}</strong> entries parsed</div>
                <div><span>{parsed.filter((p) => p.kind === 'anime').length}</span> anime</div>
                <div><span>{parsed.filter((p) => p.kind === 'manga').length}</span> manga</div>
              </div>
              <label className="mal-skip">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                Skip titles that already exist in your library (case-insensitive match)
              </label>
              <div className="mal-import-summary">
                <div><strong>{toImport.length}</strong> ready to import</div>
                {skipped > 0 && <div className="hint">{skipped} skipped as duplicates</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                <button type="button" className="primary" onClick={doImport} disabled={toImport.length === 0}
                  style={{ background: 'var(--accent)', color: '#1a1408', padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                  Import {toImport.length} · {animeCount} anime, {mangaCount} manga
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
