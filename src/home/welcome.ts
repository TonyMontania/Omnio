// The short note under the Home greeting: what you're in the middle of,
// what airs or releases soon, what you wrapped up this month. Only ever
// encouraging — no comparisons, no "you haven't…".

import type { Item } from '../types'
import { getUniversalStatusValue, statusTone } from '../utils/statusUniversal'
import { airingWeekday, isCurrentlyAiring } from '../utils/airing'
import { plural, t } from '../i18n'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function names(list: Item[], max: number): string {
  const shown = list.slice(0, max).map((i) => i.title)
  const rest = list.length - shown.length
  if (rest > 0) return t('{names} and {n} more', { names: shown.join(', '), n: rest })
  if (shown.length <= 1) return shown.join('')
  return t('{names} and {last}', { names: shown.slice(0, -1).join(', '), last: shown[shown.length - 1] })
}

function dayOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export function welcomeLines(items: Item[], now: Date = new Date()): string[] {
  if (items.length === 0) return [t('Welcome to Omnio. Add the first thing you are playing, watching, reading or listening to and it will show up here.')]

  const lines: string[] = []
  const inProgress = items
    .filter((i) => statusTone(getUniversalStatusValue(i)) === 'progress')
    .sort((a, b) => b.createdAt - a.createdAt)
  if (inProgress.length > 0) lines.push(t("You're in the middle of {names}.", { names: names(inProgress, 2) }))

  const today = WEEKDAYS[now.getDay()]
  const airingToday = items.filter((i) => isCurrentlyAiring(i, now) && airingWeekday(i) === today)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekEnd = new Date(start.getTime() + 7 * 864e5)
  const releasing = items.filter((i) => {
    const d = i.releaseDate ? dayOnly(i.releaseDate) : null
    return !!d && d >= start && d < weekEnd
  })
  if (airingToday.length > 0) lines.push(t('{names} airs today.', { names: names(airingToday, 2) }))
  else if (releasing.length > 0) lines.push(plural(releasing.length, '{n} release coming this week.', '{n} releases coming this week.'))

  const finishedThisMonth = items.filter((i) => {
    const d = i.finishedAt ? dayOnly(i.finishedAt) ?? new Date(i.finishedAt) : null
    return !!d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  if (lines.length < 2 && finishedThisMonth > 0) {
    lines.push(plural(finishedThisMonth, "You've finished {n} thing this month.", "You've finished {n} things this month."))
  }

  if (lines.length === 0) lines.push(plural(items.length, '{n} item in your library, ready when you are.', '{n} items in your library, ready when you are.'))
  return lines
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  return h < 6 ? t('Good night') : h < 12 ? t('Good morning') : h < 19 ? t('Good afternoon') : t('Good evening')
}
