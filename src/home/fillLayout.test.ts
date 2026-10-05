import { describe, expect, it } from 'vitest'
import { fillLayout } from './fillLayout'

const continueCards = { minWidth: 240, gap: 12, rows: 2, stretch: true }
const coverCards = { minWidth: 140, gap: 14, rows: 2, stretch: false }

describe('fillLayout', () => {
  it('trims a partial last row (full width, 8 items, 6 columns)', () => {
    expect(fillLayout({ width: 1580, available: 8, ...continueCards })).toEqual({ columns: 6, count: 6 })
  })

  it('fills two rows when enough items exist (medium, 3 columns)', () => {
    expect(fillLayout({ width: 770, available: 8, ...continueCards })).toEqual({ columns: 3, count: 6 })
  })

  it('trims medium with 4 items down to one full row', () => {
    expect(fillLayout({ width: 770, available: 4, ...continueCards })).toEqual({ columns: 3, count: 3 })
  })

  it('stretches a short single row to the full width', () => {
    expect(fillLayout({ width: 1580, available: 2, ...continueCards })).toEqual({ columns: 2, count: 2 })
  })

  it('keeps cover cards at their natural size when there are fewer than one row', () => {
    expect(fillLayout({ width: 1580, available: 3, ...coverCards })).toEqual({ columns: 10, count: 3 })
  })

  it('never shows more rows than requested', () => {
    expect(fillLayout({ width: 1580, available: 40, ...coverCards })).toEqual({ columns: 10, count: 20 })
  })

  it('falls back to one column before the container is measured', () => {
    expect(fillLayout({ width: 0, available: 5, ...continueCards })).toEqual({ columns: 1, count: 2 })
  })
})
