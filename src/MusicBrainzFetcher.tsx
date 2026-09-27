// MusicBrainz + Cover Art Archive fetcher. Three steps: search
// release-groups, pick one; list every release under it so the user
// can choose the actual edition (Deluxe, Reissue, 20th Anniversary
// each have their own tracklist and cover); apply the picked release.

import { useState } from 'react'
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
  disambiguation?: string
}
interface Recording { id: string; title: string; length?: number; 'artist-credit'?: ArtistCredit[] }
interface MediaTrack { id: string; number: string; title: string; length?: number; 'artist-credit'?: ArtistCredit[]; recording?: Recording }
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

interface EditionOption {
  id: string
  title: string
  disambiguation?: string
  status?: string
  date?: string
  country?: string
  'label-info'?: { label?: Named; 'catalog-number'?: string }[]
  media?: { format?: string; 'track-count'?: number }[]
}

const PRIMARY_TO_TYPE: Record<string, MusicType> = {
  Album: 'album',
  EP: 'ep',
  Single: 'single',
  Broadcast: 'live',
  Other: 'album',
}
// A soundtrack-tagged Album maps to Omnio's distinct OST type. Live
// covers Live-tagged. Compilation/Remaster flow into musicSource instead.
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

function extractProducers(rel: Release): string[] {
  const rs = rel.relations ?? []
  const names = rs
    .filter((r) => r['target-type'] === 'artist' && /producer/i.test(r.type))
    .map((r) => r.artist?.name)
    .filter((n): n is string => !!n)
  return Array.from(new Set(names))
}

// Prefer curated `genres` over user-submitted `tags`; prefer the
// release-group's lists over the release's when both exist.
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
    // Never dilute a curated genre list with looser tags below it.
    if (out.length > 0) return out
  }
  return out
}

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
  const [pendingRg, setPendingRg] = useState<ReleaseGroupHit | null>(null)
  const [editions, setEditions] = useState<EditionOption[] | null>(null)
  const [applyingEdition, setApplyingEdition] = useState<string | null>(null)

  const search = async (q: string): Promise<FetcherResult<ReleaseGroupHit>> => {
    const r = await window.ipcRenderer.invoke('mb:search', q)
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed' }
    // MB doesn't always return hits pre-sorted by score, and low-score
    // matches often surface accidental keyword overlaps.
    const hits = (r.data as ReleaseGroupHit[])
      .filter((h) => (h.score ?? 0) >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return { ok: true, data: hits }
  }

  const chooseReleaseGroup = async (rg: ReleaseGroupHit) => {
    const r = await window.ipcRenderer.invoke('mb:release-group-releases', rg.id)
    if (!r?.ok) {
      // Fall back to auto-pick rather than dead-ending the flow.
      await applyRelease(rg, undefined)
      return
    }
    const releases = (r.data as EditionOption[]) ?? []
    if (releases.length <= 1) {
      await applyRelease(rg, releases[0]?.id)
      return
    }
    setPendingRg(rg)
    setEditions(releases)
  }

  const applyRelease = async (rg: ReleaseGroupHit, wantedReleaseId: string | undefined) => {
    const r = await window.ipcRenderer.invoke('mb:release-group-details', rg.id, wantedReleaseId)
    if (!r?.ok) return
    const rel = r.data as Release
    const releaseId = r.chosenReleaseId as string

    const caaUrl = `https://coverartarchive.org/release/${releaseId}/front-500`
    const coverPath = await downloadImageAsset(caaUrl, 'musica', 'cover', assetBasename(rg.title, 'cover')) as string | null

    const tracks: Track[] = []
    let running = 0
    // Only carry a track-level artist when it actually differs from the
    // release artist — otherwise the tracklist reads as noise.
    const releaseArtist = joinArtists(rel['artist-credit'] ?? rg['artist-credit'])
    for (const media of rel.media ?? []) {
      for (const t of media.tracks ?? []) {
        running += 1
        const trackArtist = joinArtists(t['artist-credit'] ?? t.recording?.['artist-credit'])
        tracks.push({
          id: crypto.randomUUID(),
          number: t.number || String(running),
          name: t.title,
          artist: trackArtist && trackArtist !== releaseArtist ? trackArtist : undefined,
          duration: msToMmSs(t.length),
        })
      }
    }

    const title = rel.title || rg.title
    const producers = extractProducers(rel)
    const genres = extractGenres(rel)
    const altTitles = extractAltTitles(rel, title)
    const isoDate = (rel.date ?? rg['first-release-date'] ?? '').trim()
    const patch: Partial<Item> = {
      title,
      artist: joinArtists(rel['artist-credit'] ?? rg['artist-credit']) || undefined,
      alternativeTitles: altTitles.length > 0 ? altTitles : undefined,
      releaseYear: isoDate.slice(0, 4) || undefined,
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

  const closeEditionPicker = () => { setPendingRg(null); setEditions(null) }

  const pickEdition = async (rg: ReleaseGroupHit, ed: EditionOption) => {
    setApplyingEdition(ed.id)
    try { await applyRelease(rg, ed.id) }
    finally { setApplyingEdition(null) }
  }

  return (
    <>
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
        onApply={chooseReleaseGroup}
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
            desc: rg.disambiguation || undefined,
            thumbUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
          }
        }}
      />

      {pendingRg && editions && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={closeEditionPicker}>
          <div className="modal-panel fetch-modal mb-editions-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Choose an edition — {pendingRg.title}</h2>
              <button type="button" className="panel-close" onClick={closeEditionPicker}>✕</button>
            </div>
            <div className="modal-body">
              <p className="hint" style={{ marginTop: 0 }}>
                MusicBrainz has {editions.length} different releases of this album — different
                countries, formats (CD / vinyl / digital) and named editions (Deluxe, Limited,
                Reissue, Anniversary…), each with its own tracklist and cover. Pick the one that
                matches what you're tracking.
              </p>
              <div className="mb-editions-grid">
                {editions.map((ed) => {
                  const formats = Array.from(new Set((ed.media ?? []).map((m) => m.format).filter(Boolean))).join(' + ')
                  const trackCount = (ed.media ?? []).reduce((sum, m) => sum + (m['track-count'] ?? 0), 0)
                  const label = ed['label-info']?.[0]?.label?.name
                  const displayTitle = ed.disambiguation ? `${ed.title} (${ed.disambiguation})` : ed.title
                  const busy = applyingEdition !== null
                  return (
                    <button
                      type="button"
                      key={ed.id}
                      className="mb-edition-card"
                      disabled={busy}
                      onClick={() => pickEdition(pendingRg, ed)}
                    >
                      <div className="mb-edition-cover">
                        <img
                          src={`https://coverartarchive.org/release/${ed.id}/front-250`}
                          alt=""
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <div className="mb-edition-title">{displayTitle}</div>
                      <div className="mb-edition-meta">
                        {[formats, trackCount ? `${trackCount} tracks` : null, ed.country, ed.date].filter(Boolean).join(' · ')}
                      </div>
                      {label && <div className="mb-edition-label">{label}</div>}
                      {applyingEdition === ed.id && <span className="anilist-applying">Applying…</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
