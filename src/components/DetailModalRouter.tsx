// Dispatch component for the eight per-category detail modals.
//
// One `viewing: AnyItem | null` state slot flows through this router.
// It calls a single type guard per branch (`isGameItem`, `isMusicItem`, …)
// and hands the matching item to the right modal.

import { lazy, Suspense } from 'react'
import type { AnyItem, Collection, Track, MusicArtist } from '../types'
import {
  isGameItem, isMusicItem, isMangaItem, isAnimeItem,
  isMovieItem, isSeriesItem, isBookItem, isVnItem,
} from '../types'
import { isAnimeLikeCategory } from '../categories'
import { isMangaLike } from '../types'

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
  onSaveTrackLyrics: (item: AnyItem, trackId: string, lyrics: string) => void
}

function groupsFor(item: AnyItem, collections: Collection[]): Collection[] {
  return collections.filter((c) => c.categoryId === item.categoryId && c.itemIds.includes(item.id))
}

export default function DetailModalRouter(props: DetailModalRouterProps) {
  const { viewing, items, collections, onClose, onEdit, onDuplicate, onNavigate, onSaveTrackLyrics } = props
  if (!viewing) return null

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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
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
        allItems={items}
      />,
    )
  }

  return null
}

export type OnSaveTrackLyrics = (item: AnyItem, trackId: string, lyrics: string) => void
export type { Track, MusicArtist }
