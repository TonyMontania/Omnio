import { describe, expect, it } from 'vitest'
import type { Item } from '../types'
import { formatHours, getTimeInvested } from './stats'

const item = (fields: Record<string, unknown>) => ({ id: 'x', title: 'x', createdAt: 0, ...fields }) as unknown as Item

describe('getTimeInvested', () => {
  it('sums game play time stored as H.MM', () => {
    const r = getTimeInvested('videojuegos', [item({ playTime: '12.30' }), item({ playTime: '1.05' })])
    expect(r.minutes).toBe(12 * 60 + 30 + 65)
  })

  it('counts each movie viewing including rewatches', () => {
    const r = getTimeInvested('peliculas', [item({ consumed: true, duration: '100', rewatches: [{}, {}] }), item({ consumed: false, duration: '90' })])
    expect(r.minutes).toBe(300)
  })

  it('multiplies watched episodes by their length', () => {
    const r = getTimeInvested('anime', [item({ episodesWatched: '12', episodeDuration: '24' }), item({ episodesWatched: '3' })])
    expect(r.minutes).toBe(288)
    expect(r.units).toEqual({ count: 15, label: 'episodes' })
  })

  it('adds up track lengths of listened albums', () => {
    const r = getTimeInvested('musica', [item({ consumed: true, tracks: [{ duration: '3:30' }, { duration: '1:02:30' }] })])
    expect(r.minutes).toBe(66)
  })

  it('reads free-text visual novel play time and falls back to length when completed', () => {
    const r = getTimeInvested('visual_novels', [item({ playTime: '12h 30m' }), item({ visualNovelStatus: 'completed', vnLengthHours: '20' })])
    expect(r.minutes).toBe(750 + 1200)
  })

  it('counts pages and chapters where time is unknown', () => {
    expect(getTimeInvested('libros', [item({ pagesRead: '120' }), item({ bookStatus: 'completed', totalPages: '300' })]).units).toEqual({ count: 420, label: 'pages' })
    expect(getTimeInvested('manga', [item({ chaptersRead: '1' })]).units).toEqual({ count: 1, label: 'chapter' })
  })
})

describe('formatHours', () => {
  it('formats short and long totals', () => {
    expect(formatHours(45)).toBe('45m')
    expect(formatHours(90)).toBe('1.5h')
    expect(formatHours(120)).toBe('2h')
    expect(formatHours(60 * 250)).toBe('250h')
  })
})
