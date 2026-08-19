import { describe, it, expect } from 'vitest'
import { expandTagSelection, flattenTagTree } from './tags'

describe('expandTagSelection', () => {
  it('returns the selection untouched when no tree is provided', () => {
    expect(expandTagSelection(['jrpg'], undefined)).toEqual(['jrpg'])
  })

  it('adds direct children of a selected parent', () => {
    const tree = { 'turn-based': 'jrpg', 'action': 'jrpg' }
    const out = expandTagSelection(['jrpg'], tree).sort()
    expect(out).toEqual(['action', 'jrpg', 'turn-based'])
  })

  it('walks transitively into grandchildren', () => {
    const tree = { 'shonen': 'anime', 'battle-shonen': 'shonen' }
    const out = expandTagSelection(['anime'], tree).sort()
    expect(out).toEqual(['anime', 'battle-shonen', 'shonen'])
  })

  it('does not loop when the map contains a cycle', () => {
    const tree = { 'a': 'b', 'b': 'a' }
    const out = expandTagSelection(['a'], tree).sort()
    expect(out).toEqual(['a', 'b'])
  })
})

describe('flattenTagTree', () => {
  it('lists every known tag with the right depth', () => {
    const rows = flattenTagTree(
      ['jrpg', 'turn-based', 'action', 'sports'],
      { 'turn-based': 'jrpg', 'action': 'jrpg' },
    )
    expect(rows).toEqual([
      { tag: 'jrpg', depth: 0 },
      { tag: 'action', depth: 1 },
      { tag: 'turn-based', depth: 1 },
      { tag: 'sports', depth: 0 },
    ])
  })

  it('ignores parent links whose parent is not itself a known tag', () => {
    const rows = flattenTagTree(['orphan'], { orphan: 'ghost-parent' })
    expect(rows).toEqual([{ tag: 'orphan', depth: 0 }])
  })
})
