// VGMdb metadata fetcher — game and anime soundtracks, Japanese releases.
// Uses the community-run vgmdb.info JSON proxy of the site. No API key
// but availability depends on the proxy; errors are surfaced as-is.

import { useEffect, useState } from 'react'
import type { Item, Track } from './types'

interface Props {
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface MultiName {
  en?: string
  ja?: string
  'ja-latn'?: string
  [k: string]: string | undefined
}

interface SearchHit {
  link: string                    // e.g. "album/12345"
  titles?: MultiName
  release_date?: string
  media_format?: string
  catalog?: string
}

interface Performer { link?: string; names?: MultiName }
interface Organization { link?: string; names?: MultiName; role?: string }
interface AlbumTrack { names?: MultiName; track_length?: string }
interface AlbumDisc { name?: string; tracks?: AlbumTrack[] }
interface AlbumDetails {
  link?: string
  names?: MultiName
  name?: string
  release_date?: string
  release_price?: unknown
  publisher?: Organization
  distributor?: Organization
  media_format?: string
  performers?: Performer[]
  composers?: Performer[]
  arrangers?: Performer[]
  lyricists?: Performer[]
  organizations?: Organization[]
  categories?: string[]
  classification?: string
  picture_full?: string
  picture_small?: string
  discs?: AlbumDisc[]
}

// Pick the best display name from a multilingual object — English if
// present, then romaji, then Japanese, then the first value found.
function displayName(m?: MultiName): string {
  if (!m) return ''
  if (m.en) return m.en
  if (m['ja-latn']) return m['ja-latn']
  if (m.ja) return m.ja
  for (const k of Object.keys(m)) if (m[k]) return m[k] as string
  return ''
}

function joinNames(list?: { names?: MultiName }[]): string | undefined {
  if (!list || list.length === 0) return undefined
  const names = list.map((p) => displayName(p.names)).filter(Boolean)
  if (names.length === 0) return undefined
  return names.join(', ')
}

function altsFromNames(m?: MultiName, primary?: string): string[] | undefined {
  if (!m) return undefined
  const set = new Set<string>()
  for (const k of Object.keys(m)) {
    const v = m[k]
    if (v && v !== primary) set.add(v)
  }
  const arr = Array.from(set)
  return arr.length > 0 ? arr : undefined
}

export default function VgmdbFetcher({ initialQuery, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('vgmdb:search', query.trim())
    setLoading(false)
    if (r?.ok) setResults((r.data as SearchHit[]) ?? [])
    else setError(r?.error ?? 'Search failed (vgmdb.info may be down)')
  }

  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (hit: SearchHit) => {
    setApplying(hit.link)
    const r = await window.ipcRenderer.invoke('vgmdb:album', hit.link)
    if (!r?.ok) { setApplying(null); setError(r?.error ?? 'Failed to load album'); return }
    const d = r.data as AlbumDetails

    const coverUrl = d.picture_full || d.picture_small
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, 'musica', 'cover') as string | null
      : null

    // Flatten multi-disc into one running tracklist; VGMdb often omits
    // per-track numbers so we generate them.
    const tracks: Track[] = []
    let running = 0
    for (const disc of d.discs ?? []) {
      for (const t of disc.tracks ?? []) {
        running += 1
        tracks.push({
          id: crypto.randomUUID(),
          number: String(running),
          name: displayName(t.names),
          duration: t.track_length || '',
        })
      }
    }

    const title = displayName(d.names) || d.name || ''
    const patch: Partial<Item> = {
      title,
      artist: joinNames(d.performers) || joinNames(d.composers),
      releaseYear: (d.release_date ?? '').slice(0, 4) || undefined,
      musicType: 'ost',
      musicSource: 'soundtrack',
      label: displayName(d.publisher?.names) || undefined,
      genres: d.categories && d.categories.length ? d.categories : undefined,
      producers: joinNames(d.composers) ? [joinNames(d.composers)!] : undefined,
      alternativeTitles: altsFromNames(d.names, title),
      hasTracks: tracks.length > 0,
      tracks: tracks.length > 0 ? tracks : undefined,
    }

    setApplying(null)
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>VGMdb · Game & anime soundtracks</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Video-game music database. No API key — routed through the community
            <code> vgmdb.info </code> JSON proxy. Applying overwrites title, artist
            (performers or composers), release year, label, tracklist, cover; sets
            type to <em>OST</em> and source to <em>Soundtrack</em>. Best fit for
            game/anime OSTs and Japanese physical releases.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="Search album, e.g. 'nier automata ost'…"
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && (
            <p className="hint">No matches. Try romanised or original spelling.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((hit) => {
                const t = displayName(hit.titles)
                const y = (hit.release_date ?? '').slice(0, 4)
                const sub = [y, hit.media_format, hit.catalog].filter(Boolean).join(' · ')
                return (
                  <li key={hit.link}>
                    <button type="button" className="anilist-hit" onClick={() => apply(hit)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        <span>{(t || '?').charAt(0)}</span>
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{t}</div>
                        <div className="anilist-sub">{sub}</div>
                      </div>
                      {applying === hit.link && <span className="anilist-applying">Fetching…</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
