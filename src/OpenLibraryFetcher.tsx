// OpenLibrary metadata fetcher for Books. Free, no API key.
// Search hits carry enough to render a picker; picking an item optionally
// resolves the /works/ endpoint to grab description + subjects. Covers are
// keyed by the numeric cover_i field on the hit.

import type { Item, PublicationStatus, BookFormat } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

interface Props {
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface OlHit {
  key: string                       // "/works/OL45804W"
  title: string
  author_name?: string[]
  first_publish_year?: number
  publisher?: string[]
  isbn?: string[]
  number_of_pages_median?: number
  cover_i?: number
  subject?: string[]
  language?: string[]
}

interface OlWork {
  description?: string | { value?: string }
  subjects?: string[]
  covers?: number[]
  // OL doesn't publish a canonical "publication status" per work — leave it
  // to the user to set after applying.
}

const COVER_URL = (id?: number) => (id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null)

// OpenLibrary "subjects" are a huge messy list — cap to a reasonable few
// so the tag pool doesn't explode after a single fetch.
function pickSubjects(hit: OlHit, work: OlWork | null): string[] {
  const raw = [...(hit.subject ?? []), ...(work?.subjects ?? [])]
  // Drop obvious noise (year ranges, generic library headings).
  return Array.from(new Set(raw.filter((s) => s.length < 40 && !/^\d+$/.test(s)))).slice(0, 8)
}

function stripDesc(v?: string | { value?: string }): string | undefined {
  if (!v) return undefined
  return typeof v === 'string' ? v : v.value
}

// Best-guess format from OL's format hints when the ISBN list contains
// something obvious. Users override in the editor anyway.
function guessFormat(): BookFormat | undefined {
  return undefined  // no reliable signal; leave for user.
}

async function hitToPatch(hit: OlHit): Promise<Partial<Item>> {
  const wr = await window.ipcRenderer.invoke('openlibrary:work', hit.key) as { ok: boolean; data?: OlWork; error?: string }
  const work = wr?.ok ? (wr.data ?? null) : null
  const patch: Partial<Item> = {
    title: hit.title,
    authors: hit.author_name && hit.author_name.length > 0 ? hit.author_name : undefined,
    description: stripDesc(work?.description),
    genres: pickSubjects(hit, work),
    publisher: hit.publisher?.[0],
    totalPages: hit.number_of_pages_median ? String(hit.number_of_pages_median) : undefined,
    isbn: hit.isbn?.[0],
    releaseDate: hit.first_publish_year ? `${hit.first_publish_year}-01-01` : undefined,
    bookFormat: guessFormat(),
    // OpenLibrary's model is book-per-edition; if the user is tracking a
    // specific edition, they'll adjust after fetching.
    pubStatus: undefined as PublicationStatus | undefined,
  }
  return patch
}

export default function OpenLibraryFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<OlHit>> => {
    const r = await window.ipcRenderer.invoke('openlibrary:search', q)
    return r?.ok ? { ok: true, data: r.data as OlHit[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (h: OlHit) => {
    const coverUrl = COVER_URL(h.cover_i)
    const patch = await hitToPatch(h)
    const coverPath = coverUrl
      ? await downloadImageAsset(coverUrl, 'libros', 'cover', assetBasename(h.title, 'cover'))
      : null
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<OlHit>
      title="OpenLibrary"
      hint={<>Free, no API key. Search across every book in OpenLibrary and apply title, authors, publisher, page count, ISBN and first-publish year. Reading status, rating and notes are left alone.</>}
      placeholder="Search a book…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(h) => {
        const authors = h.author_name?.slice(0, 2).join(', ')
        const sub = [authors, h.first_publish_year ? String(h.first_publish_year) : null, h.number_of_pages_median ? `${h.number_of_pages_median} p` : null].filter(Boolean).join(' · ')
        return {
          key: h.key,
          title: h.title,
          sub,
          thumbUrl: COVER_URL(h.cover_i) ?? undefined,
        }
      }}
    />
  )
}
