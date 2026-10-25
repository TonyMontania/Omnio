import { describe, expect, it } from 'vitest'
import { greeting, welcomeLine } from './welcome'
import type { Item } from '../types'

const now = new Date(2026, 9, 25, 9, 0) // Sunday morning
const item = (p: Partial<Item>): Item => ({ id: Math.random().toString(), categoryId: 'anime', title: 'X', createdAt: 0, ...p } as Item)

describe('welcomeLine', () => {
  it('greets an empty library', () => {
    expect(welcomeLine([], now)).toMatch(/^Welcome to Omnio/)
  })

  it('leads with a show airing today', () => {
    const line = welcomeLine([
      item({ title: 'Elden Ring', categoryId: 'videojuegos', gameStatus: 'playing' }),
      item({ title: 'Dandadan', watchStatus: 'watching', airingStatus: 'airing', airingDay: 'sunday' }),
    ], now)
    expect(line).toBe('Dandadan has a new episode today.')
  })

  it('celebrates something finished this week', () => {
    expect(welcomeLine([item({ title: 'Perfect Days', finishedAt: '2026-10-22' })], now))
      .toBe('You finished Perfect Days this week. Nice one.')
  })

  it('names one thing in progress, never a list', () => {
    const line = welcomeLine([
      item({ title: 'Old one', watchStatus: 'watching', createdAt: 1 }),
      item({ title: 'Frieren', watchStatus: 'watching', createdAt: 5 }),
      item({ title: 'Dune', categoryId: 'libros', bookStatus: 'reading', createdAt: 2 }),
    ], now)
    expect(line).toContain('Frieren')
    expect(line).not.toMatch(/Dune|Old one|more/)
  })

  it('falls back to a friendly library count', () => {
    expect(welcomeLine([item({ watchStatus: 'completed' }), item({ watchStatus: 'completed' })], now))
      .toBe('2 things in your library, ready when you are.')
  })

  it('picks a greeting for the time of day', () => {
    expect(greeting(now)).toBe('Good morning')
    expect(greeting(new Date(2026, 9, 25, 21))).toBe('Good evening')
  })
})
