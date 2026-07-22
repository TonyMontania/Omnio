// MangaDex metadata fetcher. Covers manga, manhwa (Korean), manhua
// (Chinese) — the user opens it from within the specific library, and we
// show every match regardless of origin language, tagging each row with
// its origin so it's obvious when a hit belongs elsewhere.

import { useEffect, useState } from 'react'
import type { Item, MangaSource, PublicationStatus } from './types'

interface Props {
  initialQuery: string
  categoryId: string       // used only for the cover download path
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface MdLocalized { [locale: string]: string }
interface MdTagAttrs { name: MdLocalized; group?: string }
interface MdTag { id: string; type: 'tag'; attributes: MdTagAttrs }
interface MdRelBase { id: string; type: string }
interface MdCoverRel  extends MdRelBase { type: 'cover_art'; attributes?: { fileName: string } }
interface MdAuthorRel extends MdRelBase { type: 'author';    attributes?: { name: string } }
interface MdArtistRel extends MdRelBase { type: 'artist';    attributes?: { name: string } }
type MdRel = MdCoverRel | MdAuthorRel | MdArtistRel | MdRelBase

interface MdMangaAttrs {
  title?: MdLocalized
  altTitles?: MdLocalized[]
  description?: MdLocalized
  originalLanguage?: string     // 'ja' | 'ko' | 'zh' | 'zh-hk' | 'en' | …
  status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
  year?: number | null
  contentRating?: string
  publicationDemographic?: string | null
  tags?: MdTag[]
  lastVolume?: string | null
  lastChapter?: string | null
}
interface MdManga {
  id: string
  type: 'manga'
  attributes: MdMangaAttrs
  relationships?: MdRel[]
}

// Prefer English, then Japanese romaji, then Japanese, then anything.
function pickLocalized(m?: MdLocalized): string | undefined {
  if (!m) return undefined
  return m.en || m['ja-ro'] || m.ja || m.ko || m.zh || m['zh-hk'] || Object.values(m).find(Boolean)
}

function collectAltTitles(a: MdMangaAttrs, primary?: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (s?: string) => {
    if (!s) return
    if (s === primary) return
    if (seen.has(s)) return
    seen.add(s); out.push(s)
  }
  // Every locale of the main title is an alt except the picked one.
  if (a.title) for (const v of Object.values(a.title)) push(v)
  // Explicit alt titles — each is a locale object with one entry usually.
  for (const alt of a.altTitles ?? []) for (const v of Object.values(alt)) push(v)
  return out
}

const STATUS_MAP: Record<NonNullable<MdMangaAttrs['status']>, PublicationStatus> = {
  ongoing: 'publishing',
  completed: 'finished',
  hiatus: 'hiatus',
  cancelled: 'cancelled',
}

const SOURCE_LABEL: Record<string, MangaSource> = {
  ja: 'original', ko: 'original', zh: 'original', 'zh-hk': 'original',
}

function originLabel(lang?: string): string {
  if (!lang) return 'unknown'
  if (lang === 'ja') return 'manga (JP)'
  if (lang === 'ko') return 'manhwa (KR)'
  if (lang === 'zh' || lang === 'zh-hk') return 'manhua (CN)'
  return lang.toUpperCase()
}

function coverUrlFor(m: MdManga, size: 256 | 512 = 512): string | null {
  const cover = m.relationships?.find((r) => r.type === 'cover_art') as MdCoverRel | undefined
  const fileName = cover?.attributes?.fileName
  if (!fileName) return null
  return `https://uploads.mangadex.org/covers/${m.id}/${fileName}.${size}.jpg`
}

function mangaToPatch(m: MdManga): Partial<Item> {
  const a = m.attributes
  const title = pickLocalized(a.title) || ''
  const alts = collectAltTitles(a, title)
  const authors = m.relationships?.filter((r): r is MdAuthorRel => r.type === 'author').map((r) => r.attributes?.name).filter(Boolean) as string[]
  const artists = m.relationships?.filter((r): r is MdArtistRel => r.type === 'artist').map((r) => r.attributes?.name).filter(Boolean) as string[]
  const genres = a.tags?.filter((t) => t.attributes.group === 'genre').map((t) => pickLocalized(t.attributes.name)).filter(Boolean) as string[]
  const themes = a.tags?.filter((t) => t.attributes.group === 'theme').map((t) => pickLocalized(t.attributes.name)).filter(Boolean) as string[]

  return {
    title,
    alternativeTitles: alts.length ? alts : undefined,
    mangaDescription: pickLocalized(a.description),
    releaseYear: a.year ? String(a.year) : undefined,
    authors: authors.length ? Array.from(new Set(authors)) : undefined,
    mangaArtists: artists.length ? Array.from(new Set(artists)) : undefined,
    genres: (genres && genres.length ? genres : themes) || undefined,
    tags: themes.length && genres.length ? themes : undefined,   // themes as tags if genres already present
    totalChapters: a.lastChapter || undefined,
    totalVolumes: a.lastVolume || undefined,
    pubStatus: a.status ? STATUS_MAP[a.status] : undefined,
    mangaSource: a.originalLanguage ? (SOURCE_LABEL[a.originalLanguage] ?? undefined) : undefined,
  }
}

export default function MangaDexFetcher({ initialQuery, categoryId, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<MdManga[]>([])
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
    const r = await window.ipcRenderer.invoke('mangadex:search', query.trim())
    setLoading(false)
    if (r?.ok) setResults((r.data as MdManga[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (m: MdManga) => {
    setApplying(m.id)
    const url = coverUrlFor(m, 512)
    const coverPath = url
      ? await window.ipcRenderer.invoke('image:download', url, categoryId, 'cover') as string | null
      : null
    const patch = mangaToPatch(m)
    setApplying(null)
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>MangaDex</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Free, no API key. Applying overwrites title, alternative titles, description,
            release year, authors, artists, genres, total chapters/volumes, publication
            status, and cover. Rating, reading status, notes and personal history are
            left alone. Each hit is labelled by origin (JP / KR / CN) so you can spot
            manga vs manhwa vs manhua at a glance.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="Search title, e.g. 'chainsaw man' or 'solo leveling'…"
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && (
            <p className="hint">No matches. Try a different spelling or the original title.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((m) => {
                const a = m.attributes
                const title = pickLocalized(a.title) || '(untitled)'
                const authors = m.relationships?.filter((r): r is MdAuthorRel => r.type === 'author').map((r) => r.attributes?.name).filter(Boolean).slice(0, 2)
                const sub = [
                  originLabel(a.originalLanguage),
                  a.year,
                  a.status,
                  authors?.join(' · ') || null,
                ].filter(Boolean).join(' · ')
                const thumb = coverUrlFor(m, 256)
                const desc = pickLocalized(a.description)
                return (
                  <li key={m.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(m)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{title.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{title}</div>
                        <div className="anilist-sub">{sub}</div>
                        {desc && <div className="anilist-desc">{desc.slice(0, 180)}…</div>}
                      </div>
                      {applying === m.id && <span className="anilist-applying">Fetching…</span>}
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
