// AniList metadata fetcher. Given an anime/manga title, search AniList,
// show a picker of matches, and hand back a shaped Partial<Item> the
// caller can merge into its editor state.

import type { Item } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'
import {
  type AniListMedia as Media, type StaffEdge,
  aniListCommonPatch, aniListAnimePatch, aniListCover, aniListThemeTags, aniListTitle, stripAniListHtml, PUB_STATUS_MAP,
} from './utils/anilist'

type MediaType = 'ANIME' | 'MANGA'

interface Props {
  initialQuery: string
  kind: MediaType
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string, hints?: { suggestedTags?: string[] }) => void
  onClose: () => void
}

// AniList staff roles are free-text — "Story", "Art", "Story & Art", "Original
// Creator", etc. Split them into authors (writing) vs mangaArtists (drawing)
// so both fields fill correctly for manga imports.
function splitMangaStaff(staff?: { edges?: StaffEdge[] }): { authors: string[]; artists: string[] } {
  const authors: string[] = []
  const artists: string[] = []
  const seenA = new Set<string>()
  const seenB = new Set<string>()
  for (const e of staff?.edges ?? []) {
    const name = e.node?.name?.full
    const role = (e.role ?? '').toLowerCase()
    if (!name) continue
    if (/(story|writer|scenario|author|original creator|screenplay)/.test(role) && !seenA.has(name)) {
      authors.push(name); seenA.add(name)
    }
    if (/(art|illustrator|illustration|character design|drawer)/.test(role) && !seenB.has(name)) {
      artists.push(name); seenB.add(name)
    }
  }
  return { authors, artists }
}

export default function AniListFetcher({ initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<Media>> => {
    const r = await window.ipcRenderer.invoke('anilist:search', q, kind)
    return r?.ok ? { ok: true, data: r.data as Media[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (m: Media) => {
    const title = aniListTitle(m)
    const cover = aniListCover(m)
    const coverPath = cover
      ? await downloadImageAsset(cover, categoryId, 'cover', assetBasename(title, 'cover'))
      : undefined
    const bannerPath = m.bannerImage
      ? await downloadImageAsset(m.bannerImage, categoryId, 'banner', assetBasename(title, 'banner'))
      : undefined
    const patch: Partial<Item> = kind === 'ANIME' ? aniListAnimePatch(m) : aniListCommonPatch(m, 'MANGA')
    if (kind === 'MANGA') {
      patch.totalChapters = m.chapters ? String(m.chapters) : undefined
      patch.totalVolumes = m.volumes ? String(m.volumes) : undefined
      const { authors, artists } = splitMangaStaff(m.staff)
      if (authors.length) patch.authors = authors
      if (artists.length) patch.mangaArtists = artists
      if (m.status && PUB_STATUS_MAP[m.status]) patch.pubStatus = PUB_STATUS_MAP[m.status]
    }
    const themeTags = aniListThemeTags(m)
    onApply(patch, coverPath || undefined, bannerPath || undefined, themeTags.length > 0 ? { suggestedTags: themeTags } : undefined)
    onClose()
  }

  return (
    <FetcherModal<Media>
      title={kind === 'ANIME' ? 'AniList · Anime' : 'AniList · Manga'}
      hint={
        <>AniList is free and needs no API key. Applying overwrites the standard fields
        (title, description, cover, banner, dates, episodes/chapters, studios, source, genres).
        Rating, notes, watch/read status and personal history stay as they are.</>
      }
      placeholder={`Search ${kind === 'ANIME' ? 'anime' : 'manga'}…`}
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(m) => {
        const t = m.title.english || m.title.romaji || m.title.native || ''
        const y = m.startDate?.year
        const sub = [
          m.format ? m.format.replace('_', ' ').toLowerCase() : null,
          y,
          kind === 'ANIME' ? (m.episodes ? `${m.episodes} eps` : null) : (m.chapters ? `${m.chapters} ch` : null),
          m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : null,
        ].filter(Boolean).join(' · ')
        return { key: m.id, title: t, sub, thumbUrl: m.coverImage?.large, desc: stripAniListHtml(m.description) }
      }}
    />
  )
}
