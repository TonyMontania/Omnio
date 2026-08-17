import { describe, it, expect } from 'vitest'
import { parseCsv, colIndex, buildCsv } from './csv'

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const rows = parseCsv('a,b,c\n1,2,3\n4,5,6')
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']])
  })

  it('handles quoted fields with commas inside', () => {
    const rows = parseCsv('a,b\n"hello, world",42')
    expect(rows).toEqual([['a', 'b'], ['hello, world', '42']])
  })

  it('handles escaped quotes (RFC 4180)', () => {
    const rows = parseCsv('a\n"she said ""hi"""')
    expect(rows).toEqual([['a'], ['she said "hi"']])
  })

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('strips BOM', () => {
    const rows = parseCsv('﻿a,b\n1,2')
    expect(rows[0]).toEqual(['a', 'b'])
  })

  it('drops fully empty rows', () => {
    const rows = parseCsv('a\n1\n\n2')
    expect(rows).toEqual([['a'], ['1'], ['2']])
  })

  it('respects an alternate delimiter', () => {
    const rows = parseCsv('a\tb\n1\t2', '\t')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('colIndex', () => {
  const headers = ['Title', 'Year', 'Rating']

  it('finds by exact name', () => {
    expect(colIndex(headers, 'Title')).toBe(0)
    expect(colIndex(headers, 'Rating')).toBe(2)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(colIndex(headers, '  TITLE  ')).toBe(0)
    expect(colIndex(headers, 'year')).toBe(1)
  })

  it('returns -1 when missing', () => {
    expect(colIndex(headers, 'Nope')).toBe(-1)
  })

  it('takes the first matching synonym', () => {
    expect(colIndex(headers, 'Missing', 'Rating')).toBe(2)
  })
})

describe('buildCsv', () => {
  it('emits headers + rows with CRLF terminator', () => {
    const out = buildCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }])
    expect(out).toBe('a,b\r\n1,2\r\n3,4\r\n')
  })

  it('quotes cells with commas / quotes / newlines', () => {
    const out = buildCsv([{ x: 'a, b', y: 'she said "hi"' }])
    expect(out).toContain('"a, b"')
    expect(out).toContain('"she said ""hi"""')
  })

  it('joins arrays with "; "', () => {
    const out = buildCsv([{ tags: ['rpg', 'action'] }])
    expect(out).toContain('rpg; action')
  })

  it('unions header keys across rows in first-seen order', () => {
    const out = buildCsv([{ a: 1 }, { b: 2 }, { c: 3 }])
    expect(out.split('\r\n')[0]).toBe('a,b,c')
  })

  it('empties undefined and null cells', () => {
    const out = buildCsv([{ a: undefined, b: null, c: '' }])
    expect(out).toBe('a,b,c\r\n,,\r\n')
  })
})
