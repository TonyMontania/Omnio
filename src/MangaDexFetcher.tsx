// MangaDex metadata fetcher. Covers manga, manhwa (Korean), manhua
// (Chinese) — the user opens it from within the specific library, and we
// show every match regardless of origin language, tagging each row with
// its origin so it's obvious when a hit belongs elsewhere.

import type { Item, MangaSource, PublicationStatus, MangaVolume } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'

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

interface MdCoverEntry {
  id: string
  attributes?: { fileName?: string; volume?: string; locale?: string }
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
  const search = async (q: string): Promise<FetcherResult<MdManga>> => {
    const r = await window.ipcRenderer.invoke('mangadex:search', q)
    return r?.ok ? { ok: true, data: r.data as MdManga[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (m: MdManga) => {
    const url = coverUrlFor(m, 512)
    const coverPath = url
      ? await window.ipcRenderer.invoke('image:download', url, categoryId, 'cover') as string | null
      : null

    // Fetch every cover the series has and file the ones tagged with a
    // volume number into volumeCovers. Runs in parallel with the main
    // cover so slow connections don't block the primary flow.
    const covers = await window.ipcRenderer.invoke('mangadex:covers', m.id) as { ok: boolean; data?: MdCoverEntry[] }
    const volumeCovers: MangaVolume[] = []
    if (covers?.ok && Array.isArray(covers.data)) {
      for (const c of covers.data) {
        const vol = c.attributes?.volume
        const file = c.attributes?.fileName
        if (!vol || !file) continue
        const coverUrl = `https://uploads.mangadex.org/covers/${m.id}/${file}.512.jpg`
        const rel = await window.ipcRenderer.invoke('image:download', coverUrl, categoryId, 'volume') as string | null
        if (rel) volumeCovers.push({ id: crypto.randomUUID(), number: vol, cover: rel })
      }
    }
    const patch = mangaToPatch(m)
    if (volumeCovers.length > 0) patch.volumeCovers = volumeCovers
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<MdManga>
      title="MangaDex"
      hint={
        <>Free, no API key. Applying overwrites title, alternative titles, description,
        release year, authors, artists, genres, total chapters/volumes, publication
        status, cover and per-volume covers (each volume that MangaDex has art
        for lands in the gallery). Rating, reading status, notes and personal
        history are left alone. Each hit is labelled by origin (JP / KR / CN)
        so you can spot manga vs manhwa vs manhua at a glance.</>
      }
      placeholder="Search title, e.g. 'chainsaw man' or 'solo leveling'…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(m) => {
        const a = m.attributes
        const title = pickLocalized(a.title) || '(untitled)'
        const authors = m.relationships?.filter((r): r is MdAuthorRel => r.type === 'author').map((r) => r.attributes?.name).filter(Boolean).slice(0, 2)
        const sub = [
          originLabel(a.originalLanguage),
          a.year,
          a.status,
          authors?.join(' · ') || null,
        ].filter(Boolean).join(' · ')
        return {
          key: m.id,
          title,
          sub,
          thumbUrl: coverUrlFor(m, 256) ?? undefined,
          desc: pickLocalized(a.description),
        }
      }}
    />
  )
}
