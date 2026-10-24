import { describe, expect, it } from 'vitest'
import { numColumnWidth } from './numColumn'

describe('numColumnWidth', () => {
  it('fits two digits at least and grows with longer numbers', () => {
    expect(numColumnWidth([])).toBe(52)
    expect(numColumnWidth(['1', '12'])).toBe(52)
    expect(numColumnWidth(['1', '120'])).toBe(61)
    expect(numColumnWidth(['1-12'])).toBe(70)
  })
})
