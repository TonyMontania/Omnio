// VGMdb metadata fetcher — game and anime soundtracks, Japanese releases.
// Uses the community-run vgmdb.info JSON proxy of the site. No API key
// but availability depends on the proxy; errors are surfaced as-is.

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
  const search = async (q: string): Promise<FetcherResult<SearchHit>> => {
    const r = await window.ipcRenderer.invoke('vgmdb:search', q)
    return r?.ok ? { ok: true, data: r.data as SearchHit[] } : { ok: false, error: r?.error ?? 'Search failed (vgmdb.info may be down)' }
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

    // Producer roles live on `organizations` (or occasionally on
    // publisher/distributor entries themselves) — role strings VGMdb uses:
    // "Producer", "Executive Producer", "Music Producer", "Sound Producer".
    // Composers are surfaced separately as tags at the end so both credits
    // survive without one clobbering the other.
    const producerOrgs = (d.organizations ?? []).filter((o) => /producer/i.test(o.role ?? ''))
    const producers: string[] = producerOrgs
      .map((o) => displayName(o.names))
      .filter(Boolean)
    // Fallback: when VGMdb doesn't split roles, treat composers as the
    // production credit (matches how the vast majority of game/anime OSTs
    // are attributed — the composer IS the producer of the album).
    if (producers.length === 0 && d.composers && d.composers.length > 0) {
      for (const c of d.composers) {
        const n = displayName(c.names)
        if (n) producers.push(n)
      }
    }

    // VGMdb release_date is ISO "YYYY-MM-DD" when the day is known and
    // "YYYY-MM" or just "YYYY" otherwise. Keep whatever precision is
    // available: full date to `releaseDate`, always the year to
    // `releaseYear` so the card still shows a year on partial data.
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
      // Distributor is a distinct role in VGMdb's model (the org that
      // physically shipped the CDs, often different from the label) and
      // maps cleanly onto Omnio's distributors field.
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
        }
      }}
    />
  )
}
