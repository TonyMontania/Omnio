// The one-line note under the Home greeting. It names at most one thing,
// picked by what matters today: something airing, something just
// finished, or what you were last into. Always friendly — no lists, no
// counts of what's left, no comparisons.

import type { Item } from '../types'
import { getUniversalStatusValue, statusTone } from '../utils/statusUniversal'
import { airingWeekday, isCurrentlyAiring } from '../utils/airing'
import { plural, t, tk } from '../i18n'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Phrasings for "what you were last into", rotated by day so the Home
// doesn't read the same every morning.
const LEFT_OFF = [
  tk('{title} is right where you left it.'),
  tk('{title} is waiting for you whenever you feel like it.'),
  tk('Picking up {title} again sounds like a plan.'),
]

function dayOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5)
}

export function welcomeLine(items: Item[], now: Date = new Date()): string {
  if (items.length === 0) return t('Welcome to Omnio. Add the first thing you are playing, watching, reading or listening to and it will show up here.')

  const today = WEEKDAYS[now.getDay()]
  const airingToday = items.find((i) => isCurrentlyAiring(i, now) && airingWeekday(i) === today
    && statusTone(getUniversalStatusValue(i)) === 'progress')
    ?? items.find((i) => isCurrentlyAiring(i, now) && airingWeekday(i) === today)
  if (airingToday) return t('{title} has a new episode today.', { title: airingToday.title })

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(start.getTime() - 6 * 864e5)
  const justFinished = items
    .map((i) => ({ i, d: i.finishedAt ? dayOnly(i.finishedAt) : null }))
    .filter((x): x is { i: Item; d: Date } => !!x.d && x.d >= weekAgo && x.d <= now)
    .sort((a, b) => b.d.getTime() - a.d.getTime())[0]
  if (justFinished) return t('You finished {title} this week. Nice one.', { title: justFinished.i.title })

  const startedAt = (i: Item) => (i.startDate ? dayOnly(i.startDate)?.getTime() ?? 0 : 0) || i.createdAt
  const current = items
    .filter((i) => statusTone(getUniversalStatusValue(i)) === 'progress')
    .sort((a, b) => startedAt(b) - startedAt(a))[0]
  if (current) return t(LEFT_OFF[dayOfYear(now) % LEFT_OFF.length], { title: current.title })

  return plural(items.length, '{n} thing in your library, ready when you are.', '{n} things in your library, ready when you are.')
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  return h < 6 ? t('Good night') : h < 12 ? t('Good morning') : h < 19 ? t('Good afternoon') : t('Good evening')
}
