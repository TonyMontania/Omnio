// Dispatch component for the eight per-category detail modals.
//
// Before: App.tsx held eight separate `viewingGame` / `viewingMusic` /
// `viewingBook` / … useState slots, eight `openEditFromXModal`
// helpers, eight `handleDuplicateX` helpers, and one giant JSX
// ternary chain that walked all eight branches — every new category
// meant editing App.tsx in twelve places.
//
// Now: one `viewing: AnyItem | null` state slot flows through this
// router. It calls a single type guard per branch (`isGameItem`,
// `isMusicItem`, …) and hands the matching item to the right modal.
// Adding the ninth category is one branch here plus the modal
// component itself.

import { lazy, Suspense } from 'react'
import type { AnyItem, Collection, Track, MusicArtist } from '../types'
import {
  isGameItem, isMusicItem, isMangaItem, isAnimeItem,
  isMovieItem, isSeriesItem, isBookItem, isVnItem,
} from '../types'
import { isAnimeLikeCategory } from '../categories'
import { isMangaLike } from '../types'

// Same lazy imports as before, moved here so the router owns the
// module boundary. Falls back to `null` while chunks fetch — the app
// already renders the empty detail area at that point.
const GameDetailModal        = lazy(() => import('../GameDetailModal'))
const MusicDetailModal       = lazy(() => import('../MusicDetailModal'))
const MangaDetailModal       = lazy(() => import('../MangaDetailModal'))
const MovieDetailModal       = lazy(() => import('../MovieDetailModal'))
const AnimeDetailModal       = lazy(() => import('../AnimeDetailModal'))
const SeriesDetailModal      = lazy(() => import('../SeriesDetailModal'))
const BookDetailModal        = lazy(() => import('../BookDetailModal'))
const VisualNovelDetailModal = lazy(() => import('../VisualNovelDetailModal'))

export interface DetailModalRouterProps {
  viewing: AnyItem | null
  items: AnyItem[]
  collections: Collection[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  // Music-only: called when the user saves per-track lyrics inline
  // from the detail view. Wired only for the music branch; every
  // other category ignores it.
  onSaveTrackLyrics: (item: AnyItem, trackId: string, lyrics: string) => void
}

// Small helper that trims the `collections.filter(...)` boilerplate
// duplicated across every branch.
function groupsFor(item: AnyItem, collections: Collection[]): Collection[] {
  return collections.filter((c) => c.categoryId === item.categoryId && c.itemIds.includes(item.id))
}

export default function DetailModalRouter(props: DetailModalRouterProps) {
  const { viewing, items, collections, onClose, onEdit, onDuplicate, onNavigate, onSaveTrackLyrics } = props
  if (!viewing) return null

  // Every branch below narrows via a category type guard so the
  // matching modal receives a strict per-variant type (GameItem,
  // MusicItem, …). Fase 1.1 landed those variants; this is where the
  // narrowing actually pays off.

  const wrap = (child: React.ReactElement) => <Suspense fallback={null}>{child}</Suspense>

  if (isGameItem(viewing)) {
    return wrap(
      <GameDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allGames={items.filter((i) => i.categoryId === 'videojuegos')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isMusicItem(viewing)) {
    return wrap(
      <MusicDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allMusic={items.filter((i) => i.categoryId === 'musica')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
        onSaveTrackLyrics={(trackId, lyrics) => onSaveTrackLyrics(viewing, trackId, lyrics)}
      />,
    )
  }

  if (isMovieItem(viewing)) {
    return wrap(
      <MovieDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allMovies={items.filter((i) => i.categoryId === 'peliculas')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isAnimeItem(viewing)) {
    return wrap(
      <AnimeDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allAnime={items.filter((i) => isAnimeLikeCategory(i.categoryId))}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isSeriesItem(viewing)) {
    return wrap(
      <SeriesDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allSeries={items.filter((i) => i.categoryId === 'series')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isMangaItem(viewing)) {
    return wrap(
      <MangaDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allManga={items.filter((i) => isMangaLike(i.categoryId))}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isBookItem(viewing)) {
    return wrap(
      <BookDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allBooks={items.filter((i) => i.categoryId === 'libros')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  if (isVnItem(viewing)) {
    return wrap(
      <VisualNovelDetailModal
        item={viewing}
        groups={groupsFor(viewing, collections)}
        allVns={items.filter((i) => i.categoryId === 'visual_novels')}
        onClose={onClose}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onNavigate={onNavigate}
      />,
    )
  }

  // Uncategorised / future category → no modal. App.tsx still shows
  // the library grid behind so the user isn't blocked.
  return null
}

// Music track lyric save is the only per-modal side-effect that
// couldn't collapse into the generic `onSaveTrackLyrics` prop above —
// it needs access to setItems + toast. Rather than plumb those in,
// App.tsx owns the state mutation and hands us a bound callback.
// Exposed so App.tsx can build the callback without importing Track
// from types.
export type OnSaveTrackLyrics = (item: AnyItem, trackId: string, lyrics: string) => void
export type { Track, MusicArtist }
