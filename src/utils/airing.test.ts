import { describe, expect, it } from 'vitest'
import type { AnyItem } from '../types'
import { airingWeekday, weekdayFromDate } from './airing'

describe('weekdayFromDate', () => {
  it('returns the weekday of a calendar date', () => {
    expect(weekdayFromDate('2026-10-04')).toBe('sunday')
    expect(weekdayFromDate('2026-10-05')).toBe('monday')
    expect(weekdayFromDate('2026-01-10')).toBe('saturday')
  })

  it('ignores empty or malformed input', () => {
    expect(weekdayFromDate('')).toBeUndefined()
    expect(weekdayFromDate(undefined)).toBeUndefined()
    expect(weekdayFromDate('2026')).toBeUndefined()
  })
})

describe('airingWeekday', () => {
  it('prefers the weekday the user picked', () => {
    expect(airingWeekday({ airingDay: 'friday', airedFrom: '2026-10-05' } as AnyItem)).toBe('friday')
  })

  it('falls back to the weekday of the first air date', () => {
    expect(airingWeekday({ airedFrom: '2026-10-05' } as AnyItem)).toBe('monday')
  })
})
