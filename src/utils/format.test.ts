import { describe, it, expect } from 'vitest'
import { formatBytes, formatIsoDate, formatDate } from './format'

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB')
  })
})

describe('formatIsoDate', () => {
  it('parses YYYY-MM-DD locally so no TZ shift', () => {
    // The whole point of the helper — new Date("2009-04-28") parses as UTC
    // midnight, which in any TZ west of UTC formats as the previous day.
    // formatIsoDate builds a local-midnight date instead.
    const out = formatIsoDate('2009-04-28')
    expect(out).toContain('2009')
    expect(out).toMatch(/4\/28|28\/4|Apr 28|28 Apr|04\/28/)
    // Must not be off-by-one to the 27th.
    expect(out).not.toMatch(/4\/27|27\/4|Apr 27|27 Apr|04\/27/)
  })

  it('returns empty for undefined / empty input', () => {
    expect(formatIsoDate(undefined)).toBe('')
    expect(formatIsoDate('')).toBe('')
  })

  it('handles YYYY-MM-DD with a trailing time component', () => {
    const out = formatIsoDate('2020-06-15T12:30:00')
    expect(out).toContain('2020')
  })

  it('falls back to native Date on garbage input', () => {
    // Not-a-date string returns the raw string so callers can debug.
    expect(formatIsoDate('nonsense')).toBe('nonsense')
  })
})

describe('formatDate', () => {
  it('formats a parseable ISO string', () => {
    const out = formatDate('2023-01-15T10:00:00Z')
    expect(out).toContain('2023')
  })

  it('returns empty for invalid input', () => {
    expect(formatDate('nope')).toBe('')
  })
})
