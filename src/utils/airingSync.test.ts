import { describe, expect, it } from 'vitest'
import type { AnyItem } from '../types'
import type { AniListMedia } from './anilist'
import { formatCountdown, matchAniListMedia } from './anilist'
import { syncAiring, syncSeriesAiring, tracksAiring, type AiringApi, type SeriesApi, type TmdbShow } from './airingSync'

const NOW = Date.UTC(2026, 9, 15, 12)
const anime = (fields: Partial<AnyItem>): AnyItem => ({ id: 'a', categoryId: 'anime', title: 'Frieren', createdAt: 0, airingStatus: 'airing', ...fields }) as AnyItem
const media = (fields: Partial<AniListMedia>): AniListMedia => ({ id: 1, title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey\'s End' }, ...fields })

function fakeApi(searchResults: AniListMedia[], airingResults: AniListMedia[]) {
  const calls = { search: [] as string[], airing: [] as number[][] }
  const api: AiringApi = {
    search: async (t) => { calls.search.push(t); return { ok: true, data: searchResults } },
    airing: async (ids) => { calls.airing.push(ids); return { ok: true, data: airingResults } },
    sleep: async () => {},
  }
  return { api, calls }
}

describe('matchAniListMedia', () => {
  it('matches on any title ignoring case and punctuation', () => {
    expect(matchAniListMedia([media({})], ['frieren beyond journeys end'])?.id).toBe(1)
    expect(matchAniListMedia([media({ synonyms: ['Frieren'] })], ['Frieren'])?.id).toBe(1)
  })
  it('refuses to guess', () => {
    expect(matchAniListMedia([media({})], ['Frieren 2'])).toBeUndefined()
  })
})

describe('tracksAiring', () => {
  it('follows airing anime and donghua only', () => {
    expect(tracksAiring(anime({}))).toBe(true)
    expect(tracksAiring(anime({ watchStatus: 'dropped' }))).toBe(false)
    expect(tracksAiring(anime({ categoryId: 'series' }))).toBe(false)
    expect(tracksAiring(anime({ airingStatus: 'finished' }))).toBe(false)
  })
})

describe('syncAiring', () => {
  it('links by title, then fills the next episode and the airing weekday', async () => {
    const next = { episode: 7, airingAt: Date.UTC(2026, 9, 17, 15) / 1000 }
    const { api, calls } = fakeApi([media({ synonyms: ['Frieren'] })], [media({ status: 'RELEASING', nextAiringEpisode: next })])
    const [p] = await syncAiring([anime({})], api, { now: NOW })
    expect(calls.search).toEqual(['Frieren'])
    expect(calls.airing).toEqual([[1]])
    expect(p.patch).toMatchObject({ anilistId: 1, anilistCheckedAt: NOW, nextAiring: { ...next, checkedAt: NOW } })
    expect(p.patch.airingDay).toBeDefined()
  })

  it('remembers a failed lookup and does not retry for a week', async () => {
    const { api, calls } = fakeApi([media({ title: { romaji: 'Something else' } })], [])
    const [p] = await syncAiring([anime({})], api, { now: NOW })
    expect(p.patch).toEqual({ anilistId: 0, anilistCheckedAt: NOW })
    await syncAiring([anime({ anilistId: 0, anilistCheckedAt: NOW })], api, { now: NOW + 1000 })
    expect(calls.search).toHaveLength(1)
  })

  it('skips fresh countdowns and refreshes passed ones', async () => {
    const fresh = anime({ id: 'f', anilistId: 1, nextAiring: { episode: 2, airingAt: NOW / 1000 + 3600, checkedAt: NOW } })
    const passed = anime({ id: 'p', anilistId: 2, nextAiring: { episode: 2, airingAt: NOW / 1000 - 60, checkedAt: NOW } })
    const { api, calls } = fakeApi([], [media({ id: 2, status: 'FINISHED', nextAiringEpisode: null })])
    const patches = await syncAiring([fresh, passed], api, { now: NOW })
    expect(calls.airing).toEqual([[2]])
    expect(patches).toEqual([{ id: 'p', patch: { airingStatus: 'finished', nextAiring: undefined } }])
  })
})

describe('formatCountdown', () => {
  it('shows the two largest units', () => {
    expect(formatCountdown(NOW / 1000 + 3 * 86400 + 4 * 3600, NOW)).toBe('3d 4h')
    expect(formatCountdown(NOW / 1000 + 5 * 3600 + 12 * 60, NOW)).toBe('5h 12m')
    expect(formatCountdown(NOW / 1000 - 100, NOW)).toBe('0m')
  })
})

describe('syncSeriesAiring', () => {
  const series = (fields: Partial<AnyItem>): AnyItem => ({ id: 's', categoryId: 'series', title: 'Severance', createdAt: 0, seriesStatus: 'watching', startYear: '2022', ...fields }) as AnyItem
  const show = { id: 95396, name: 'Severance', first_air_date: '2022-02-17', status: 'Returning Series', next_episode_to_air: { air_date: '2026-10-20', episode_number: 4, season_number: 3 } }

  function api(results: TmdbShow[], details: TmdbShow) {
    const calls = { search: 0, details: 0 }
    const a: SeriesApi = {
      search: async () => { calls.search++; return { ok: true, data: results } },
      details: async () => { calls.details++; return { ok: true, data: details } },
      sleep: async () => {},
    }
    return { a, calls }
  }

  it('links by title and year, then stores the next episode as a local date', async () => {
    const { a } = api([{ ...show, id: 1, first_air_date: '1999-01-01' }, show], show)
    const [p] = await syncSeriesAiring([series({})], a, { now: NOW })
    expect(p.patch.tmdbId).toBe(95396)
    expect(p.patch.nextAiring).toMatchObject({ episode: 4, season: 3, dateOnly: true })
    expect(new Date(p.patch.nextAiring!.airingAt * 1000).getDate()).toBe(20)
  })

  it('keeps a date-only episode fresh for its whole air day', async () => {
    const airDay = new Date(2026, 9, 20).getTime() / 1000
    const now = airDay * 1000 + 12 * 3600 * 1000
    const item = series({ tmdbId: 95396, nextAiring: { episode: 4, airingAt: airDay, checkedAt: now - 3600 * 1000, dateOnly: true } })
    const { a, calls } = api([], show)
    await syncSeriesAiring([item], a, { now })
    expect(calls.details).toBe(0)
  })

  it('clears the countdown when the show ends', async () => {
    const item = series({ tmdbId: 95396, nextAiring: { episode: 9, airingAt: 1, checkedAt: 1 } })
    const { a } = api([], { ...show, status: 'Ended', next_episode_to_air: null })
    const [p] = await syncSeriesAiring([item], a, { now: NOW })
    expect(p.patch).toEqual({ nextAiring: undefined })
  })
})
