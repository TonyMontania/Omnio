import { describe, expect, it } from 'vitest'
import { greeting, welcomeLines } from './welcome'
import type { Item } from '../types'

const now = new Date(2026, 9, 25, 9, 0) // Sunday morning
const item = (p: Partial<Item>): Item => ({ id: Math.random().toString(), categoryId: 'anime', title: 'X', createdAt: 0, ...p } as Item)

describe('welcomeLines', () => {
  it('greets an empty library', () => {
    expect(welcomeLines([], now)[0]).toMatch(/^Welcome to Omnio/)
  })

  it('names what you are in the middle of', () => {
    const lines = welcomeLines([
      item({ title: 'Frieren', watchStatus: 'watching', createdAt: 3 }),
      item({ title: 'Berserk', categoryId: 'manga', mangaStatus: 'reading', createdAt: 2 }),
      item({ title: 'Dune', categoryId: 'libros', bookStatus: 'reading', createdAt: 1 }),
    ], now)
    expect(lines[0]).toBe("You're in the middle of Frieren, Berserk and 1 more.")
  })

  it('mentions a show airing today', () => {
    const lines = welcomeLines([item({ title: 'Dandadan', airingStatus: 'airing', airingDay: 'sunday' })], now)
    expect(lines).toContain('Dandadan airs today.')
  })

  it('celebrates what was finished this month and never compares', () => {
    const lines = welcomeLines([item({ finishedAt: '2026-10-03' }), item({ finishedAt: '2026-10-20' })], now)
    expect(lines).toContain("You've finished 2 things this month.")
    expect(lines.join(' ')).not.toMatch(/less|haven't|behind/i)
  })

  it('picks a greeting for the time of day', () => {
    expect(greeting(now)).toBe('Good morning')
    expect(greeting(new Date(2026, 9, 25, 21))).toBe('Good evening')
  })
})
