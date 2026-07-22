// ComicVine metadata fetcher for Western Comics. Two-step: search
// volumes (ComicVine's word for "series"), pick one, then fetch the
// full details for the volume — including person_credits so we can
// split creators into writers → authors and artists → mangaArtists.

import { useEffect, useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  apiKey?: string
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface CvImage {
  icon_url?: string
  small_url?: string
  medium_url?: string
  screen_url?: string
  super_url?: string
  original_url?: string
}
interface CvPublisher { id?: number; name?: string }
interface CvPerson    { id?: number; name?: string; role?: string }
interface CvSearchHit {
  id: number
  name?: string
  deck?: string
  start_year?: string
  count_of_issues?: number
  publisher?: CvPublisher
  image?: CvImage
}
interface CvVolume extends CvSearchHit {
  description?: string        // HTML
  person_credits?: CvPerson[]
}

// Strip HTML tags + collapse whitespace. ComicVine descriptions come
// as HTML with <p>, <a>, <em>… — we don't want any of that in the notes.
function stripHtml(s?: string): string | undefined {
  if (!s) return undefined
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ComicVine person roles are comma-separated strings like
// "writer, penciler, cover". Match loosely against writer/artist buckets.
function splitCreators(people?: CvPerson[]): { writers: string[]; artists: string[] } {
  const writers: string[] = []
  const artists: string[] = []
  const seenW = new Set<string>()
  const seenA = new Set<string>()
  for (const p of people ?? []) {
    const name = p.name
    if (!name) continue
    const role = (p.role ?? '').toLowerCase()
    if (/(writer|scripter|story|author)/.test(role) && !seenW.has(name)) {
      writers.push(name); seenW.add(name)
    }
    if (/(artist|penciler|inker|colorist|letterer|cover)/.test(role) && !seenA.has(name)) {
      artists.push(name); seenA.add(name)
    }
  }
  return { writers, artists }
}

function volumeToPatch(v: CvVolume): Partial<Item> {
  const { writers, artists } = splitCreators(v.person_credits)
  const desc = stripHtml(v.description) || v.deck || undefined
  return {
    title: v.name,
    mangaDescription: desc,
    releaseYear: v.start_year || undefined,
    totalChapters: v.count_of_issues ? String(v.count_of_issues) : undefined,
    authors: writers.length ? writers : undefined,
    mangaArtists: artists.length ? artists : undefined,
    magazine: v.publisher?.name,
  }
}

export default function ComicVineFetcher({ apiKey, initialQuery, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<CvSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  const keyLooksSet = useMemo(() => (apiKey ?? '').trim().length >= 20, [apiKey])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!keyLooksSet) { setError('No API key configured'); return }
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('comicvine:search', apiKey, query.trim())
    setLoading(false)
    if (r?.ok) setResults((r.data as CvSearchHit[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if (keyLooksSet && (initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (hit: CvSearchHit) => {
    if (!keyLooksSet) return
    setApplying(hit.id)
    const r = await window.ipcRenderer.invoke('comicvine:volume', apiKey, hit.id)
    if (!r?.ok) { setApplying(null); setError(r?.error ?? 'Failed to load volume'); return }
    const v = r.data as CvVolume

    const coverUrl = v.image?.super_url || v.image?.screen_url || v.image?.medium_url
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, 'comics_west', 'cover') as string | null
      : null

    const patch = volumeToPatch(v)
    setApplying(null)
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ComicVine · Western Comics</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!keyLooksSet && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              Set your ComicVine API key in Settings → Data → Integrations first.
              Register a free one at <code>comicvine.gamespot.com/api/</code>.
            </p>
          )}
          <p className="hint" style={{ marginTop: 0 }}>
            Applying overwrites title, description, cover, start year, total issues,
            writers (into Authors), artists / pencilers / inkers / colorists (into Artists),
            and the publisher (into Magazine / imprint). Rating, reading status, notes
            and personal history are left alone.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="Search volume, e.g. 'saga' or 'watchmen'…"
              disabled={!keyLooksSet}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={!keyLooksSet || loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && keyLooksSet && (
            <p className="hint">No matches. Try the volume start year for disambiguation.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((hit) => {
                const sub = [
                  hit.publisher?.name,
                  hit.start_year,
                  hit.count_of_issues ? `${hit.count_of_issues} issues` : null,
                ].filter(Boolean).join(' · ')
                const thumb = hit.image?.small_url || hit.image?.medium_url
                return (
                  <li key={hit.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(hit)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{(hit.name || '?').charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{hit.name}</div>
                        <div className="anilist-sub">{sub}</div>
                        {hit.deck && <div className="anilist-desc">{hit.deck.slice(0, 180)}…</div>}
                      </div>
                      {applying === hit.id && <span className="anilist-applying">Fetching…</span>}
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
