// MusicBrainz + Cover Art Archive metadata fetcher for Music.
// Two-step: search release-groups, pick one, then fetch the primary
// Official release inside it to build a tracklist. Cover art comes from
// coverartarchive.org keyed by the chosen release's MBID.

import { useEffect, useState } from 'react'
import type { Item, MusicType, MusicSource, Track } from './types'

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
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<ReleaseGroupHit[]>([])
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
    const r = await window.ipcRenderer.invoke('mb:search', query.trim())
    setLoading(false)
    if (r?.ok) setResults((r.data as ReleaseGroupHit[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (rg: ReleaseGroupHit) => {
    setApplying(rg.id)
    const r = await window.ipcRenderer.invoke('mb:release-group-details', rg.id)
    if (!r?.ok) { setApplying(null); setError(r?.error ?? 'Failed to load release'); return }
    const rel = r.data as Release
    const releaseId = r.chosenReleaseId as string

    // Cover Art Archive returns a redirect to the actual image. `front-500`
    // is the "medium" front cover — usually enough for a music card.
    const caaUrl = `https://coverartarchive.org/release/${releaseId}/front-500`
    const coverPath = await window.ipcRenderer.invoke('image:download', caaUrl, 'musica', 'cover') as string | null

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

    setApplying(null)
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>MusicBrainz · Music</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Open, community-run music database — no API key needed. Applying overwrites
            title, artist, release year, type, source, label and tracklist. Cover comes
            from Cover Art Archive (same project). Rating, notes and listen history are
            left alone. Rate limit is one request per second; expect a small wait.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="Search release, e.g. 'in rainbows radiohead'…"
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && (
            <p className="hint">No matches. Try adding the artist name.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((rg) => {
                const y = (rg['first-release-date'] ?? '').slice(0, 4)
                const artist = joinArtists(rg['artist-credit'])
                const secondaries = rg['secondary-types']?.join(', ')
                const sub = [
                  artist,
                  rg['primary-type'],
                  secondaries,
                  y,
                ].filter(Boolean).join(' · ')
                return (
                  <li key={rg.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(rg)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        <span>{(rg.title || '?').charAt(0)}</span>
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{rg.title}</div>
                        <div className="anilist-sub">{sub}</div>
                      </div>
                      {applying === rg.id && <span className="anilist-applying">Fetching…</span>}
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
