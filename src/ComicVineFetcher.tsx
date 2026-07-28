// ComicVine metadata fetcher for Western Comics. Two-step: search
// volumes (ComicVine's word for "series"), pick one, then fetch the
// full details for the volume — including person_credits so we can
// split creators into writers → authors and artists → mangaArtists.

import { useMemo } from 'react'
import type { Item } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename } from './utils/files'

interface Props {
  apiKey?: string
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface CvImage {
  icon_url?: string
  small_url?: string
  medium_url?: string
  screen_url?: string
  super_url?: string
  original_url?: string
}
interface CvPublisher { id?: number; name?: string }
interface CvPerson    { id?: number; name?: string; role?: string }
interface CvSearchHit {
  id: number
  name?: string
  deck?: string
  start_year?: string
  count_of_issues?: number
  publisher?: CvPublisher
  image?: CvImage
}
interface CvVolume extends CvSearchHit {
  description?: string        // HTML
  person_credits?: CvPerson[]
}

// Strip HTML tags + collapse whitespace. ComicVine descriptions come
// as HTML with <p>, <a>, <em>… — we don't want any of that in the notes.
function stripHtml(s?: string): string | undefined {
  if (!s) return undefined
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ComicVine person roles are comma-separated strings like
// "writer, penciler, cover". Match loosely against writer/artist buckets.
function splitCreators(people?: CvPerson[]): { writers: string[]; artists: string[] } {
  const writers: string[] = []
  const artists: string[] = []
  const seenW = new Set<string>()
  const seenA = new Set<string>()
  for (const p of people ?? []) {
    const name = p.name
    if (!name) continue
    const role = (p.role ?? '').toLowerCase()
    if (/(writer|scripter|story|author)/.test(role) && !seenW.has(name)) {
      writers.push(name); seenW.add(name)
    }
    if (/(artist|penciler|inker|colorist|letterer|cover)/.test(role) && !seenA.has(name)) {
      artists.push(name); seenA.add(name)
    }
  }
  return { writers, artists }
}

function volumeToPatch(v: CvVolume): Partial<Item> {
  const { writers, artists } = splitCreators(v.person_credits)
  const desc = stripHtml(v.description) || v.deck || undefined
  return {
    title: v.name,
    mangaDescription: desc,
    releaseYear: v.start_year || undefined,
    totalChapters: v.count_of_issues ? String(v.count_of_issues) : undefined,
    authors: writers.length ? writers : undefined,
    mangaArtists: artists.length ? artists : undefined,
    magazine: v.publisher?.name,
  }
}

export default function ComicVineFetcher({ apiKey, initialQuery, onApply, onClose }: Props) {
  const keyLooksSet = useMemo(() => (apiKey ?? '').trim().length >= 20, [apiKey])

  const search = async (q: string): Promise<FetcherResult<CvSearchHit>> => {
    const r = await window.ipcRenderer.invoke('comicvine:search', apiKey, q)
    return r?.ok ? { ok: true, data: r.data as CvSearchHit[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (hit: CvSearchHit) => {
    const r = await window.ipcRenderer.invoke('comicvine:volume', apiKey, hit.id)
    if (!r?.ok) return
    const v = r.data as CvVolume

    const coverUrl = v.image?.super_url || v.image?.screen_url || v.image?.medium_url
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, 'comics_west', 'cover', assetBasename(v.name, 'cover')) as string | null
      : null

    onApply(volumeToPatch(v), coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<CvSearchHit>
      title="ComicVine · Western Comics"
      disabled={!keyLooksSet}
      disabledMessage={
        <>Set your ComicVine API key in Settings → Data → Integrations first.
        Register a free one at <code>comicvine.gamespot.com/api/</code>.</>
      }
      hint={
        <>Applying overwrites title, description, cover, start year, total issues,
        writers (into Authors), artists / pencilers / inkers / colorists (into Artists),
        and the publisher (into Magazine / imprint). Rating, reading status, notes
        and personal history are left alone.</>
      }
      placeholder="Search volume, e.g. 'saga' or 'watchmen'…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(hit) => {
        const sub = [
          hit.publisher?.name,
          hit.start_year,
          hit.count_of_issues ? `${hit.count_of_issues} issues` : null,
        ].filter(Boolean).join(' · ')
        return {
          key: hit.id,
          title: hit.name || '(untitled)',
          sub,
          thumbUrl: hit.image?.small_url || hit.image?.medium_url,
          desc: hit.deck,
        }
      }}
    />
  )
}
