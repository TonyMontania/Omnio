// MusicBrainz + Cover Art Archive metadata fetcher for Music.
// Two-step: search release-groups, pick one, then fetch the primary
// Official release inside it to build a tracklist. Cover art comes from
// coverartarchive.org keyed by the chosen release's MBID.

import type { Item, MusicType, MusicSource, Track } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename } from './utils/files'

interface Props {
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface Named { name: string }
interface ArtistCredit { name: string; artist?: { id: string; name: string } }
interface ReleaseGroupHit {
  id: string
  title: string
  'primary-type'?: string
  'secondary-types'?: string[]
  'first-release-date'?: string
  'artist-credit'?: ArtistCredit[]
  score?: number
}
interface Recording { id: string; title: string; length?: number }
interface MediaTrack { id: string; number: string; title: string; length?: number; recording?: Recording }
interface Media { format?: string; 'track-count'?: number; tracks?: MediaTrack[] }
interface Release {
  id: string
  title: string
  date?: string
  'artist-credit'?: ArtistCredit[]
  'label-info'?: { label?: Named }[]
  media?: Media[]
}

const PRIMARY_TO_TYPE: Record<string, MusicType> = {
  Album: 'album',
  EP: 'ep',
  Single: 'single',
  Broadcast: 'live',
  Other: 'album',
}
// Secondary types layer on top of primary; a soundtrack-tagged Album maps
// to OST here (Omnio treats it as a distinct type), and a live album maps
// to Live. Compilation/Remaster/etc flow into musicSource instead.
function mbToOmnioType(primary?: string, secondary?: string[]): MusicType | undefined {
  const sec = new Set((secondary ?? []).map((s) => s.toLowerCase()))
  if (sec.has('soundtrack')) return 'ost'
  if (sec.has('live')) return 'live'
  if (sec.has('compilation')) return 'recopilation'
  return primary ? PRIMARY_TO_TYPE[primary] : undefined
}
function mbToOmnioSource(secondary?: string[]): MusicSource | undefined {
  const sec = new Set((secondary ?? []).map((s) => s.toLowerCase()))
  if (sec.has('remaster')) return 'remaster'
  if (sec.has('compilation')) return 'compilation'
  if (sec.has('soundtrack')) return 'soundtrack'
  return undefined
}

function joinArtists(credit: ArtistCredit[] | undefined): string {
  if (!credit || credit.length === 0) return ''
  return credit.map((c) => c.name).join(' ')
}

function msToMmSs(ms?: number): string {
  if (!ms || ms <= 0) return ''
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MusicBrainzFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<ReleaseGroupHit>> => {
    const r = await window.ipcRenderer.invoke('mb:search', q)
    return r?.ok ? { ok: true, data: r.data as ReleaseGroupHit[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (rg: ReleaseGroupHit) => {
    const r = await window.ipcRenderer.invoke('mb:release-group-details', rg.id)
    if (!r?.ok) return
    const rel = r.data as Release
    const releaseId = r.chosenReleaseId as string

    // Cover Art Archive returns a redirect to the actual image. `front-500`
    // is the "medium" front cover — usually enough for a music card.
    const caaUrl = `https://coverartarchive.org/release/${releaseId}/front-500`
    const coverPath = await window.ipcRenderer.invoke('image:download', caaUrl, 'musica', 'cover', assetBasename(rg.title, 'cover')) as string | null

    // Flatten multi-disc into one numbered tracklist. MB tracks already
    // carry a per-medium `number` string like "1", "A1" for vinyl, etc.
    const tracks: Track[] = []
    let running = 0
    for (const media of rel.media ?? []) {
      for (const t of media.tracks ?? []) {
        running += 1
        tracks.push({
          id: crypto.randomUUID(),
          number: t.number || String(running),
          name: t.title,
          duration: msToMmSs(t.length),
        })
      }
    }

    const patch: Partial<Item> = {
      title: rel.title || rg.title,
      artist: joinArtists(rel['artist-credit'] ?? rg['artist-credit']) || undefined,
      releaseYear: (rel.date ?? rg['first-release-date'] ?? '').slice(0, 4) || undefined,
      musicType: mbToOmnioType(rg['primary-type'], rg['secondary-types']),
      musicSource: mbToOmnioSource(rg['secondary-types']),
      label: rel['label-info']?.[0]?.label?.name,
      hasTracks: tracks.length > 0,
      tracks: tracks.length > 0 ? tracks : undefined,
    }

    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<ReleaseGroupHit>
      title="MusicBrainz · Music"
      hint={
        <>Open, community-run music database — no API key needed. Applying overwrites
        title, artist, release year, type, source, label and tracklist. Cover comes
        from Cover Art Archive (same project). Rating, notes and listen history are
        left alone. Rate limit is one request per second; expect a small wait.</>
      }
      placeholder="Search release, e.g. 'in rainbows radiohead'…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(rg) => {
        const y = (rg['first-release-date'] ?? '').slice(0, 4)
        const artist = joinArtists(rg['artist-credit'])
        const secondaries = rg['secondary-types']?.join(', ')
        return {
          key: rg.id,
          title: rg.title,
          sub: [artist, rg['primary-type'], secondaries, y].filter(Boolean).join(' · '),
        }
      }}
    />
  )
}
