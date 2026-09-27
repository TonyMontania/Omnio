// VGMdb fetcher for game/anime soundtracks. Routes through the
// community-run vgmdb.info JSON proxy.

import type { Item, Track } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

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
  link: string
  titles?: MultiName
  release_date?: string
  media_format?: string
  catalog?: string
  // Backfilled by search() below — the /search endpoint itself doesn't
  // return covers.
  picture_small?: string
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

// English → romaji → Japanese → whatever else is populated.
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

// Only the first N hits get their heavy album endpoint fetched for
// a thumbnail — anything below the fold isn't worth the extra RTTs
// against a proxy with no known rate limit.
const THUMB_FETCH_LIMIT = 8

export default function VgmdbFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<SearchHit>> => {
    const r = await window.ipcRenderer.invoke('vgmdb:search', q)
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed (vgmdb.info may be down)' }
    const hits = r.data as SearchHit[]
    await Promise.all(
      hits.slice(0, THUMB_FETCH_LIMIT).map(async (h) => {
        try {
          const d = await window.ipcRenderer.invoke('vgmdb:album', h.link)
          if (d?.ok) h.picture_small = (d.data as AlbumDetails).picture_small
        } catch { /* one missing thumbnail is fine */ }
      })
    )
    return { ok: true, data: hits }
  }

  const apply = async (hit: SearchHit) => {
    const r = await window.ipcRenderer.invoke('vgmdb:album', hit.link)
    if (!r?.ok) return
    const d = r.data as AlbumDetails

    const albumTitle = d.name || d.names?.en || d.names?.ja || hit.titles?.en || hit.titles?.ja || ''
    const coverUrl = d.picture_full || d.picture_small
    const coverPath = coverUrl
      ? await downloadImageAsset( coverUrl, 'musica', 'cover', assetBasename(albumTitle, 'cover')) as string | null
      : null

    // VGMdb often omits per-track numbers; generate them by flattening
    // all discs into one running list.
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

    const producerOrgs = (d.organizations ?? []).filter((o) => /producer/i.test(o.role ?? ''))
    const producers: string[] = producerOrgs
      .map((o) => displayName(o.names))
      .filter(Boolean)
    // For game/anime OSTs the composer usually IS the producer, so
    // fall back to composers when no explicit producer role is set.
    if (producers.length === 0 && d.composers && d.composers.length > 0) {
      for (const c of d.composers) {
        const n = displayName(c.names)
        if (n) producers.push(n)
      }
    }

    // release_date is "YYYY", "YYYY-MM", or "YYYY-MM-DD"; keep whatever
    // precision the source has.
    const dateRaw = (d.release_date ?? '').trim()
    const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : undefined

    const title = displayName(d.names) || d.name || ''
    const patch: Partial<Item> = {
      title,
      artist: joinNames(d.performers) || joinNames(d.composers),
      releaseYear: dateRaw.slice(0, 4) || undefined,
      releaseDate,
      musicType: 'ost',
      musicSource: 'soundtrack',
      label: displayName(d.publisher?.names) || undefined,
      distributors: d.distributor?.names ? [displayName(d.distributor.names)].filter(Boolean) : undefined,
      genres: d.categories && d.categories.length ? d.categories : undefined,
      producers: producers.length > 0 ? Array.from(new Set(producers)) : undefined,
      alternativeTitles: altsFromNames(d.names, title),
      hasTracks: tracks.length > 0,
      tracks: tracks.length > 0 ? tracks : undefined,
    }

    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<SearchHit>
      title="VGMdb · Game & anime soundtracks"
      hint={
        <>Video-game music database. No API key — routed through the community
        <code> vgmdb.info </code> JSON proxy. Applying overwrites title, artist
        (performers or composers), alternative titles, full release date, label,
        distributor, genres, producers (falling back to composers when VGMdb
        doesn't split the role), cover and tracklist; sets type to <em>OST</em>
        and source to <em>Soundtrack</em>. Best fit for game/anime OSTs and
        Japanese physical releases.</>
      }
      placeholder="Search album, e.g. 'nier automata ost'…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(hit) => {
        const t = displayName(hit.titles)
        const y = (hit.release_date ?? '').slice(0, 4)
        return {
          key: hit.link,
          title: t || '(untitled)',
          sub: [y, hit.media_format, hit.catalog].filter(Boolean).join(' · '),
          thumbUrl: hit.picture_small,
        }
      }}
    />
  )
}
