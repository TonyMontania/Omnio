// Auto-status transitions — nudge an item's status when the user
// commits a signal that implies "I finished this".
//
// Two triggers:
//   - rating: a rating went from unset/0 to a real value, or moved
//     between real values. Implies the user has enough exposure to
//     rate → auto-mark as completed IF the current status is a
//     backlog / in-progress one.
//   - finishedAt: a date was set. If the status is still an unfinished
//     one, bump it to completed.
//
// The reverse triggers (rating cleared → back to backlog) are on
// purpose NOT implemented — clearing a rating shouldn't unwind the
// user's status choice.
//
// Both transitions are gated by `settings.autoStatusOnRate` (default
// on). Users who prefer to log status by hand can disable it in
// Settings → Behavior and none of this fires.

import type { AnyItem } from '../types/entities'

interface AutoStatusOpts {
  enabled: boolean
  autoFinishedAt?: boolean   // when we mark completed, also stamp finishedAt=now
}

// Given the item before and after an edit, return a patched "after"
// with any auto-transition applied. When nothing changes, returns
// `next` as-is (referentially stable) so callers can use === checks.
export function applyAutoStatus(prev: AnyItem | null, next: AnyItem, opts: AutoStatusOpts): AnyItem {
  if (!opts.enabled) return next

  const gainedRating = (prev?.rating ?? 0) === 0 && (next.rating ?? 0) > 0
  const gainedFinished = !prev?.finishedAt && !!next.finishedAt
  if (!gainedRating && !gainedFinished) return next

  const patched = { ...next }
  let touched = false

  switch (next.categoryId) {
    case 'videojuegos': {
      // Games get bumped to 'played' (not 'completed'). Users reserve
      // 'completed' for the meaningful "I 100%'d this / got every
      // achievement" milestone — auto-picking it would trample that.
      // 'played' means "credits rolled or I stopped, and I have an
      // opinion now" which is what a rating already signals.
      if (isUnfinishedGame(next.gameStatus)) {
        patched.gameStatus = 'played'
        touched = true
      }
      break
    }
    case 'anime':
    case 'donghua': {
      if (isUnfinishedAnime(next.watchStatus)) {
        patched.watchStatus = 'completed'
        touched = true
      }
      break
    }
    case 'series': {
      if (isUnfinishedSeries(next.seriesStatus)) {
        patched.seriesStatus = 'completed'
        touched = true
      }
      break
    }
    case 'manga':
    case 'manhwa':
    case 'manhua':
    case 'comics_west': {
      if (isUnfinishedManga(next.mangaStatus)) {
        patched.mangaStatus = 'completed'
        touched = true
      }
      break
    }
    case 'libros': {
      if (isUnfinishedBook(next.bookStatus)) {
        patched.bookStatus = 'completed'
        touched = true
      }
      break
    }
    case 'visual_novels': {
      if (isUnfinishedVn(next.visualNovelStatus)) {
        patched.visualNovelStatus = 'completed'
        touched = true
      }
      break
    }
    case 'peliculas':
    case 'musica': {
      if (!next.consumed) {
        patched.consumed = true
        touched = true
      }
      break
    }
  }

  if (touched && opts.autoFinishedAt !== false && !patched.finishedAt) {
    patched.finishedAt = new Date().toISOString().slice(0, 10)
  }
  return touched ? patched : next
}

function isUnfinishedGame(s: string | undefined): boolean {
  return s === undefined || s === 'backlog' || s === 'playing'
}
function isUnfinishedAnime(s: string | undefined): boolean {
  return s === undefined || s === 'plan_to_watch' || s === 'watching' || s === 'on_hold'
}
function isUnfinishedSeries(s: string | undefined): boolean {
  return s === undefined || s === 'plan_to_watch' || s === 'watching' || s === 'on_hold'
}
function isUnfinishedManga(s: string | undefined): boolean {
  return s === undefined || s === 'plan_to_read' || s === 'reading' || s === 'on_hold'
}
function isUnfinishedBook(s: string | undefined): boolean {
  return s === undefined || s === 'plan_to_read' || s === 'reading'
}
function isUnfinishedVn(s: string | undefined): boolean {
  return s === undefined || s === 'plan_to_play' || s === 'playing' || s === 'on_hold'
}
