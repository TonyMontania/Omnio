// Wikipedia scraper for Music Artists.
//
// Fetches en.wikipedia.org's {{Infobox musical artist}} for a band /
// solo artist and hands the parsed fields (origin, genres, active years,
// labels, current + past members, photo URL) back to the Artist editor.
//
// Search picks the top hit from a keyword search restricted to pages
// carrying the infobox template — Wikipedia's own advanced-search filter
// under the hood. Applying downloads the photo asset and calls a single
// callback the editor uses to merge the payload into its form buffers.

import type { BandMember, MusicArtist } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

// Best-effort mapping from Wikipedia's free-text active-years strings
// into the tri-state bandStatus the app tracks. If we can't be sure,
// leave it alone so the fetch doesn't overwrite a user's own pick.
function inferBandStatus(activeTo: string | null): MusicArtist['bandStatus'] | undefined {
  if (activeTo === '') return 'active'         // "1999–present"
  if (activeTo && /^\d{4}$/.test(activeTo)) return 'disbanded'
  return undefined
}

interface Props {
  initialQuery: string
  onApply: (payload: WikiArtistApply) => void
  onClose: () => void
}

export interface WikiArtistApply {
  origin?: string
  genres?: string[]
  labels?: string[]
  activeFrom?: string
  activeTo?: string
  bandStatus?: MusicArtist['bandStatus']
  members?: BandMember[]
  photoPath?: string
}

interface Hit {
  title: string
  snippet?: string
  pageid?: number
}

interface FetchResponse {
  title: string
  origin: string | null
  genres: string[]
  labels: string[]
  activeFrom: string | null
  activeTo: string | null
  currentMembers: { name: string; roles?: string[]; joinedIn?: string; leftIn?: string }[]
  pastMembers: { name: string; roles?: string[]; joinedIn?: string; leftIn?: string }[]
  imageUrl: string | null
}

function stripHtml(s?: string): string {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim()
}

export default function WikipediaArtistFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<Hit>> => {
    const r = await window.ipcRenderer.invoke('wiki:artist_search', q) as
      | { ok: true; data: Hit[] }
      | { ok: false; error: string }
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed' }
    return { ok: true, data: r.data ?? [] }
  }

  const apply = async (h: Hit) => {
    const r = await window.ipcRenderer.invoke('wiki:artist_fetch', h.title) as
      | { ok: true; data: FetchResponse }
      | { ok: false; error: string }
    if (!r?.ok) {
      window.dispatchEvent(new CustomEvent('omnio-toast', { detail: `Wikipedia fetch: ${r?.error ?? 'unknown'}` }))
      return
    }
    const d = r.data
    // Photo: download the raw URL if one came back so the artist card
    // lands with a persistent asset instead of a remote URL.
    let photoPath: string | undefined
    if (d.imageUrl) {
      const dl = await downloadImageAsset(d.imageUrl, 'musica', 'photo', assetBasename(d.title, 'photo'))
      if (dl) photoPath = dl
    }
    // Members: convert to BandMember shape. Current members default to
    // membership='current', past members to 'former'. Roles come from
    // the infobox bullet suffix ("* [[M. Shadows]] – lead vocals").
    const members: BandMember[] = [
      ...d.currentMembers.map((m) => ({
        id: crypto.randomUUID(),
        name: m.name,
        roles: m.roles ?? [],
        membership: 'current' as const,
        joinedIn: m.joinedIn,
        leftIn: m.leftIn,
      })),
      ...d.pastMembers.map((m) => ({
        id: crypto.randomUUID(),
        name: m.name,
        roles: m.roles ?? [],
        membership: 'former' as const,
        joinedIn: m.joinedIn,
        leftIn: m.leftIn,
      })),
    ]
    onApply({
      origin: d.origin ?? undefined,
      genres: d.genres.length > 0 ? d.genres : undefined,
      labels: d.labels.length > 0 ? d.labels : undefined,
      activeFrom: d.activeFrom ?? undefined,
      activeTo: d.activeTo ?? undefined,
      bandStatus: inferBandStatus(d.activeTo),
      members: members.length > 0 ? members : undefined,
      photoPath,
    })
    onClose()
  }

  return (
    <FetcherModal<Hit>
      title="Wikipedia (English)"
      hint={<>Reads the artist's <code>{'{{Infobox musical artist}}'}</code> from en.wikipedia.org: origin, genres, active
        years, labels, current + past members, and the main photo. Overwrites those fields. Your concerts, banner and
        anything else stays untouched.</>}
      placeholder="Search an artist / band…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(h) => ({
        key: h.pageid ?? h.title,
        title: h.title,
        sub: stripHtml(h.snippet).slice(0, 140),
      })}
    />
  )
}
