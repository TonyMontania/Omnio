// VGMdb metadata fetcher — game and anime soundtracks, Japanese releases.
// Uses the community-run vgmdb.info JSON proxy of the site. No API key
// but availability depends on the proxy; errors are surfaced as-is.

import type { Item, Track } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename } from './utils/files'

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
      ? await window.ipcRenderer.invoke('image:download', coverUrl, 'musica', 'cover', assetBasename(albumTitle, 'cover')) as string | null
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

    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<SearchHit>
      title="VGMdb · Game & anime soundtracks"
      hint={
        <>Video-game music database. No API key — routed through the community
        <code> vgmdb.info </code> JSON proxy. Applying overwrites title, artist
        (performers or composers), release year, label, tracklist, cover; sets
        type to <em>OST</em> and source to <em>Soundtrack</em>. Best fit for
        game/anime OSTs and Japanese physical releases.</>
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
