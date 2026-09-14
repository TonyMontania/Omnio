// Smart lists — user-defined saved filter presets.
//
// Each list carries a name, a category scope (a specific library or
// "all"), and an ordered set of rules. An item passes when it belongs
// to the scope AND satisfies every rule. Missing/empty rule values
// are treated as "don't filter on this" so a partial edit doesn't
// silently blank the list.
//
// The intent is that a user can bottle up "Games I rated 4+ but never
// finished" or "Anime with reviews written this year" once and reuse
// it from the toolbar, instead of re-toggling five filter chips.

import type { AnyItem } from './entities'
import { getUniversalStatusValue } from '../utils/statusUniversal'

export type SmartListRule =
  | { kind: 'favorite'; value: boolean }
  | { kind: 'minRating'; value: number }           // 1-5
  | { kind: 'maxRating'; value: number }
  | { kind: 'hasTag'; value: string }              // tag must appear on the item
  | { kind: 'status'; values: string[] }           // universal-status list; any-of
  | { kind: 'yearMin'; value: number }
  | { kind: 'yearMax'; value: number }
  | { kind: 'hasReview'; value: boolean }
  | { kind: 'hasCover'; value: boolean }
  | { kind: 'consumed'; value: boolean }           // finished / watched / listened

export interface SmartList {
  id: string
  name: string
  // 'all' spans every library. A CategoryId string scopes to one.
  categoryId: string
  rules: SmartListRule[]
  createdAt: number
  updatedAt?: number
}

// True when the item satisfies every rule of `list`. An empty rule set
// matches everything in scope — that's on purpose: a freshly-created
// list with no rules yet just shows "everything in this library" as a
// starting point.
export function matchesSmartList(item: AnyItem, list: SmartList): boolean {
  if (list.categoryId !== 'all' && item.categoryId !== list.categoryId) return false
  for (const r of list.rules) {
    if (!matchesRule(item, r)) return false
  }
  return true
}

function matchesRule(item: AnyItem, rule: SmartListRule): boolean {
  switch (rule.kind) {
    case 'favorite':
      return !!item.favorite === rule.value
    case 'minRating':
      return (item.rating ?? 0) >= rule.value
    case 'maxRating':
      return (item.rating ?? 0) <= rule.value
    case 'hasTag':
      return !!item.tags?.includes(rule.value)
    case 'status':
      if (rule.values.length === 0) return true
      return rule.values.includes(getUniversalStatusValue(item))
    case 'yearMin': {
      const y = pickYear(item)
      return y !== null && y >= rule.value
    }
    case 'yearMax': {
      const y = pickYear(item)
      return y !== null && y <= rule.value
    }
    case 'hasReview': {
      const r = item.gameReview || item.seriesReview || item.bookReview || item.vnReview || item.notes || ''
      return (r.trim().length > 0) === rule.value
    }
    case 'hasCover':
      return !!item.cover === rule.value
    case 'consumed':
      return !!item.consumed === rule.value
  }
}

function pickYear(it: AnyItem): number | null {
  const raw = it.releaseYear
    || it.seasonYear
    || it.startYear
    || (it.airedFrom ? it.airedFrom.slice(0, 4) : '')
    || (it.releaseDate ? it.releaseDate.slice(0, 4) : '')
    || ''
  const n = parseInt(String(raw), 10)
  if (isNaN(n) || n < 1000 || n > 3000) return null
  return n
}

// Human-readable summary of a rule, used by the sidebar chip and the
// manager modal so users can scan a list without opening its editor.
export function ruleSummary(rule: SmartListRule): string {
  switch (rule.kind) {
    case 'favorite': return rule.value ? 'Favorited' : 'Not favorited'
    case 'minRating': return `Rating ≥ ${rule.value}`
    case 'maxRating': return `Rating ≤ ${rule.value}`
    case 'hasTag': return `Tag: ${rule.value}`
    case 'status': return rule.values.length === 0 ? 'Any status' : `Status: ${rule.values.join(' / ')}`
    case 'yearMin': return `Year ≥ ${rule.value}`
    case 'yearMax': return `Year ≤ ${rule.value}`
    case 'hasReview': return rule.value ? 'Has review' : 'No review'
    case 'hasCover': return rule.value ? 'Has cover' : 'No cover'
    case 'consumed': return rule.value ? 'Finished' : 'Not finished'
  }
}
