// MusicBrainz + Cover Art Archive metadata fetcher for Music.
// Two-step: search release-groups, pick one, then fetch the primary
// Official release inside it to build a tracklist. Cover art comes from
// coverartarchive.org keyed by the chosen release's MBID.

import type { Item, MusicType, MusicSource, Track } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

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
interface MbTagLike { name: string; count?: number }
interface MbRelation {
  type: string
  'target-type'?: string
  artist?: { id: string; name: string }
  attributes?: string[]
}
interface MbAlias { name: string; type?: string; primary?: boolean }
interface Release {
  id: string
  title: string
  date?: string
  country?: string
  'artist-credit'?: ArtistCredit[]
  'label-info'?: { label?: Named }[]
  media?: Media[]
  tags?: MbTagLike[]
  genres?: MbTagLike[]
  relations?: MbRelation[]
  aliases?: MbAlias[]
  _releaseGroup?: {
    tags?: MbTagLike[]
    genres?: MbTagLike[]
    aliases?: MbAlias[]
  }
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

// Producer / co-producer / executive producer credits live in the release's
// `relations` array as artist-target relations. `attributes` marks the
// producer variant (co-producer, executive) and we surface all of them.
function extractProducers(rel: Release): string[] {
  const rs = rel.relations ?? []
  const names = rs
    .filter((r) => r['target-type'] === 'artist' && /producer/i.test(r.type))
    .map((r) => r.artist?.name)
    .filter((n): n is string => !!n)
  return Array.from(new Set(names))
}

// MB tags are user-submitted (noisy, useful as a fallback). MB genres are
// a curated subset of tags. Prefer whichever list has more entries in the
// richer of the two sources (release-group usually beats release), then
// dedupe. Falls back cleanly when a release has neither.
function extractGenres(rel: Release): string[] {
  const sources: MbTagLike[][] = [
    rel._releaseGroup?.genres ?? [],
    rel.genres ?? [],
    rel._releaseGroup?.tags ?? [],
    rel.tags ?? [],
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const src of sources) {
    if (src.length === 0) continue
    // Sort by count desc so the most-tagged genres come first, then take
    // this source's entries. Break once we have a reasonable list —
    // spilling every user-submitted tag would swamp the genre field.
    const sorted = [...src].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    for (const t of sorted) {
      const name = t.name.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
      if (out.length >= 8) return out
    }
    if (out.length > 0) return out    // don't dilute a curated genre list with looser tags
  }
  return out
}

// Alternate title picks: MB aliases (both release and release-group), each
// filtered to primary/name variants, plus the raw MB release-group title
// if it differs from the release title picked as the main one.
function extractAltTitles(rel: Release, primary: string): string[] {
  const aliases = [
    ...(rel.aliases ?? []),
    ...(rel._releaseGroup?.aliases ?? []),
  ]
  const seen = new Set<string>([primary.toLowerCase()])
  const out: string[] = []
  for (const a of aliases) {
    const n = a.name?.trim()
    if (!n) continue
    const key = n.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key); out.push(n)
  }
  return out
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
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed' }
    // MB *usually* returns hits by score, but not always — sort explicitly
    // so the best match is always on top. Also drop obviously-off matches
    // (score < 50) so a query for "Wolves Within" doesn't surface a
    // Broker/Dealer ringtone just because both contain "Dig Deep".
    const hits = (r.data as ReleaseGroupHit[])
      .filter((h) => (h.score ?? 0) >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return { ok: true, data: hits }
  }

  const apply = async (rg: ReleaseGroupHit) => {
    const r = await window.ipcRenderer.invoke('mb:release-group-details', rg.id)
    if (!r?.ok) return
    const rel = r.data as Release
    const releaseId = r.chosenReleaseId as string

    // Cover Art Archive returns a redirect to the actual image. `front-500`
    // is the "medium" front cover — usually enough for a music card.
    const caaUrl = `https://coverartarchive.org/release/${releaseId}/front-500`
    const coverPath = await downloadImageAsset(caaUrl, 'musica', 'cover', assetBasename(rg.title, 'cover')) as string | null

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

    const title = rel.title || rg.title
    const producers = extractProducers(rel)
    const genres = extractGenres(rel)
    const altTitles = extractAltTitles(rel, title)
    // Full ISO date if MB has one, falling back to the release group's
    // first-release date. Empty string turns into undefined so we don't
    // clobber a user-edited date with garbage.
    const isoDate = (rel.date ?? rg['first-release-date'] ?? '').trim()
    const patch: Partial<Item> = {
      title,
      artist: joinArtists(rel['artist-credit'] ?? rg['artist-credit']) || undefined,
      alternativeTitles: altTitles.length > 0 ? altTitles : undefined,
      releaseYear: isoDate.slice(0, 4) || undefined,
      // releaseDate is the full ISO date; applyFetchedPatch derives releaseYear
      // from its first 4 chars, but keeping both means the Music editor's
      // date picker shows day/month too when MB has them.
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : undefined,
      musicType: mbToOmnioType(rg['primary-type'], rg['secondary-types']),
      musicSource: mbToOmnioSource(rg['secondary-types']),
      label: rel['label-info']?.[0]?.label?.name,
      producers: producers.length > 0 ? producers : undefined,
      genres: genres.length > 0 ? genres : undefined,
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
        title, artist, alternative titles, release date, type, source, label, genres,
        producers and tracklist. Cover comes from Cover Art Archive (same project).
        Rating, notes and listen history are left alone. Include the artist in your
        search for sharper results (e.g. <code>in rainbows radiohead</code>). Rate
        limit is one request per second; expect a small wait.</>
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
        const scoreBadge = typeof rg.score === 'number' ? `${rg.score}%` : null
        return {
          key: rg.id,
          title: rg.title,
          sub: [artist, rg['primary-type'], secondaries, y, scoreBadge].filter(Boolean).join(' · '),
        }
      }}
    />
  )
}
