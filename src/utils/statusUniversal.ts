// Universal per-item status resolver.
//
// Every library has its own status field (`gameStatus`, `watchStatus`,
// `mangaStatus`, `consumed`, …). The Sprint-B views (Kanban, Diary,
// Timeline) don't want to know that — they just want "what's this
// item's status" and "what statuses can I move it to". This module
// bridges the two.
//
// Movies + Music don't have a discrete enum — they use a `consumed`
// boolean. We normalize both to a two-value pseudo-enum so they slot
// into the same Kanban / Group-by machinery as the others.

import type { AnyItem } from '../types/entities'
import type { CategoryId } from '../types/items'
import {
  GAME_STATUS_OPTIONS,
  ANIME_STATUS_OPTIONS,
  SERIES_STATUS_OPTIONS,
  MANGA_STATUS_OPTIONS,
  BOOK_STATUS_OPTIONS,
  VN_STATUS_OPTIONS,
} from '../types/options'

export interface UniversalStatusOption {
  value: string
  label: string
}

const MOVIE_STATUS_OPTIONS: UniversalStatusOption[] = [
  { value: 'unwatched', label: 'Not watched' },
  { value: 'watched',   label: 'Watched' },
]

const MUSIC_STATUS_OPTIONS: UniversalStatusOption[] = [
  { value: 'unlistened', label: 'Not listened' },
  { value: 'listened',   label: 'Listened' },
]

export function getUniversalStatusOptions(categoryId: string): UniversalStatusOption[] {
  switch (categoryId) {
    case 'videojuegos':
      return GAME_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'peliculas':
      return MOVIE_STATUS_OPTIONS
    case 'musica':
      return MUSIC_STATUS_OPTIONS
    case 'series':
      return SERIES_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'anime':
    case 'donghua':
      return ANIME_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'manga':
    case 'manhwa':
    case 'manhua':
    case 'comics_west':
      return MANGA_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'libros':
      return BOOK_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'visual_novels':
      return VN_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    default:
      return []
  }
}

export function getUniversalStatusValue(item: AnyItem): string {
  switch (item.categoryId) {
    case 'videojuegos':
      return item.gameStatus ?? 'backlog'
    case 'peliculas':
      return item.consumed ? 'watched' : 'unwatched'
    case 'musica':
      return item.consumed ? 'listened' : 'unlistened'
    case 'series':
      return item.seriesStatus ?? 'plan_to_watch'
    case 'anime':
    case 'donghua':
      return item.watchStatus ?? 'plan_to_watch'
    case 'manga':
    case 'manhwa':
    case 'manhua':
    case 'comics_west':
      return item.mangaStatus ?? 'plan_to_read'
    case 'libros':
      return item.bookStatus ?? 'plan_to_read'
    case 'visual_novels':
      return item.visualNovelStatus ?? 'plan_to_play'
    default:
      return ''
  }
}

/** Return a `Partial<AnyItem>` patch that sets the right field for the
 *  category. Callers merge this with `setItems((prev) => …)` in App.tsx. */
export function patchItemStatus(categoryId: CategoryId, value: string): Partial<AnyItem> {
  switch (categoryId) {
    case 'videojuegos':
      return { gameStatus: value as AnyItem['gameStatus'] }
    case 'peliculas':
      return { consumed: value === 'watched' }
    case 'musica':
      return { consumed: value === 'listened' }
    case 'series':
      return { seriesStatus: value as AnyItem['seriesStatus'] }
    case 'anime':
    case 'donghua':
      return { watchStatus: value as AnyItem['watchStatus'] }
    case 'manga':
    case 'manhwa':
    case 'manhua':
    case 'comics_west':
      return { mangaStatus: value as AnyItem['mangaStatus'] }
    case 'libros':
      return { bookStatus: value as AnyItem['bookStatus'] }
    case 'visual_novels':
      return { visualNovelStatus: value as AnyItem['visualNovelStatus'] }
    default:
      return {}
  }
}
