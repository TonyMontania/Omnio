import { describe, expect, it } from 'vitest'
import type { AnyItem } from '../types'
import { newEpisodes, noticeMessages } from './episodeNotices'

const NOW = Date.UTC(2026, 9, 15, 12)
const show = (fields: Partial<AnyItem>): AnyItem => ({
  id: 'a', categoryId: 'anime', title: 'Frieren', createdAt: 0, watchStatus: 'watching',
  nextAiring: { episode: 7, airingAt: NOW / 1000 - 600, checkedAt: NOW - 3600_000 }, ...fields,
}) as AnyItem

describe('newEpisodes', () => {
  it('announces an episode that just aired for a show you watch', () => {
    expect(newEpisodes([show({})], NOW)).toEqual([{ id: 'a', title: 'Frieren', episode: 7, label: 'Episode 7' }])
  })
  it('skips episodes already announced, not yet aired, too old, or shows you are not watching', () => {
    expect(newEpisodes([show({ notifiedEpisode: 7 })], NOW)).toEqual([])
    expect(newEpisodes([show({ nextAiring: { episode: 7, airingAt: NOW / 1000 + 60, checkedAt: NOW } })], NOW)).toEqual([])
    expect(newEpisodes([show({ nextAiring: { episode: 7, airingAt: NOW / 1000 - 4 * 86400, checkedAt: NOW } })], NOW)).toEqual([])
    expect(newEpisodes([show({ watchStatus: 'plan_to_watch' })], NOW)).toEqual([])
  })
  it('labels series episodes with their season', () => {
    const s = show({ categoryId: 'series', seriesStatus: 'watching', nextAiring: { episode: 4, season: 3, airingAt: NOW / 1000 - 60, checkedAt: NOW, dateOnly: true } })
    expect(newEpisodes([s], NOW)[0].label).toBe('S3E4')
  })
})

describe('noticeMessages', () => {
  it('sends up to three separate notifications, then one summary', () => {
    const n = (i: number) => ({ id: String(i), title: `Show ${i}`, episode: 1, label: 'Episode 1' })
    expect(noticeMessages([n(1), n(2)])).toEqual([{ title: 'Show 1', body: 'Episode 1 is out.' }, { title: 'Show 2', body: 'Episode 1 is out.' }])
    expect(noticeMessages([1, 2, 3, 4, 5].map(n))).toEqual([{ title: '5 new episodes', body: 'Show 1, Show 2, Show 3, Show 4 and 1 more.' }])
  })
})
